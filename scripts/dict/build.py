#!/usr/bin/env python3
"""Build the bundled kids dictionary from kaikki.org's English Wiktionary dump.

Usage:
  curl -sL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl \\
    | .venv-dict/bin/python -I scripts/dict/build.py - static/dict

The input may be a path, a .gz path, or '-' for stdin. Keeps the wordfreq top
100k words, drops unsuitable senses by Wiktionary tag, caps senses per part of
speech, and writes one JSON file per three-letter prefix. File naming must
match shardKey() in src/lib/api/shard-key.ts.
"""

import datetime
import gzip
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I drops the script dir

from pron import respell, syllables  # noqa: E402
from wordfreq import top_n_list  # noqa: E402

WORD_LIMIT = 100_000
MAX_SENSES = 3
MAX_EXAMPLE_LEN = 160
# Mirrors HTML_TAG in src/lib/api/dict-data.test.ts; keep the two in step.
HTML_TAG = re.compile(r'</?[a-z][^>]*>', re.I)

POS_LABELS = {
    'noun': 'noun',
    'verb': 'verb',
    'adj': 'adjective',
    'adv': 'adverb',
    'intj': 'interjection',
    'prep': 'preposition',
    'pron': 'pronoun',
    'conj': 'conjunction',
    'det': 'determiner',
    'num': 'number',
    'postp': 'adverb',  # "ago"
    'name': 'proper noun',
}

# Senses carrying any of these Wiktionary tags or topics are dropped.
BAD_TAGS = {
    'vulgar', 'offensive', 'derogatory', 'pejorative', 'slur', 'ethnic', 'obscene',
    'slang', 'archaic', 'obsolete', 'dated', 'rare', 'nonstandard', 'euphemistic', 'humorous',
}
BAD_TOPICS = {'sexuality', 'sex', 'drugs', 'pharmacology', 'pornography', 'lgbtq'}

# Proper nouns are mostly people and places; keep only senses in these categories.
PROPER_NOUN_CATEGORIES = re.compile(
    r'^(Months|Days of the week|Countries in |Continents|Planets of the Solar System'
    r'|Dwarf planets|Oceans|Holidays|Languages$|States of the United States'
    r'|Provinces and territories of Canada|Constituent countries of the United Kingdom)'
)

# Some month senses lack the Months category (December's sits on its given-name sense).
MONTH_GLOSS = re.compile(r'^The \w+( and last)? month of the\b.*\bGregorian calendars?\b')

# Kaikki's categories are page-level, so person/place senses leak in beside month senses.
# Anchored to the head of the gloss: country glosses end "Capital and largest city: Tokyo."
NAME_JUNK = re.compile(
    r'^(An? |The )?([\w-]+ ){0,3}(given name|surname|town|city|village|civil parish|county'
    r'|census-designated place)\b',
    re.I,
)

# "Initialism of alt.suicide.holiday" is noise beside a word's real senses.
ABBREVIATION = re.compile(r'^(Initialism|Abbreviation|Acronym) of\b')

MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
          'august', 'september', 'october', 'november', 'december']

# Build fails unless these exist; a value also pins the display form.
REQUIRED = {
    'hello': None,
    'tadpole': None,
    'mitten': None,
    'ago': None,
    'italian': 'Italian',
    'january': 'January',
    'december': 'December',
    'monday': None,
    'jupiter': None,
    'france': None,
    'africa': None,
    'america': None,
    # japan, canada and texas also have lowercase common nouns, so like "polish"
    # they display lowercase; only germany can pin its capital form.
    'japan': None,
    'germany': 'Germany',
    'canada': None,
    'texas': None,
    'england': 'England',
}


def shard_key(word):
    return re.sub(r'[^a-z]', '_', word[:3]).ljust(3, '_')


def read_lines(src):
    if src == '-':
        return sys.stdin
    if src.endswith('.gz'):
        return gzip.open(src, 'rt', encoding='utf-8')
    return open(src, encoding='utf-8')


def pick_ipa(entry):
    """American (or neutral) phonemic IPA; never British or dialect lines."""
    sounds = [s for s in entry.get('sounds', []) if (s.get('ipa') or '').startswith('/')]
    for s in sounds:
        if {'General-American', 'US'} & set(s.get('tags', [])):
            return s['ipa']
    for s in sounds:
        if not s.get('tags') and not s.get('note'):
            return s['ipa']
    return None


def pick_parts(entry):
    hyphenations = entry.get('hyphenations') or []
    parts = hyphenations[0].get('parts') if hyphenations else None
    return parts if parts and all(isinstance(p, str) for p in parts) else None


def pick_example(sense):
    for ex in sense.get('examples', []):
        text = (ex.get('text') or '').strip()
        if ex.get('type') == 'example' and 0 < len(text) < MAX_EXAMPLE_LEN and not HTML_TAG.search(text):
            return text
    return None


def keep_sense(sense, key, pos):
    if not sense.get('glosses'):
        return False
    if set(sense.get('tags', [])) & BAD_TAGS:
        return False
    if set(sense.get('topics', [])) & BAD_TOPICS:
        return False
    # "Alternative letter-case form of Italian" adds nothing under the same key.
    if any((a.get('word') or '').lower() == key for a in sense.get('alt_of', [])):
        return False
    gloss = sense['glosses'][-1].strip()
    if gloss.startswith('Alternative letter-case form of'):
        return False
    if HTML_TAG.search(gloss):
        return False
    if pos == 'name' and NAME_JUNK.search(gloss):
        return False
    if pos == 'name':
        names = [c.get('name', '') if isinstance(c, dict) else c for c in sense.get('categories', [])]
        if MONTH_GLOSS.match(gloss):
            return True
        return any(PROPER_NOUN_CATEGORIES.match(n) for n in names)
    return True


def collect(src, words):
    """key -> list of (rank, order, display, ipa, label, senses, hyphenation parts)."""
    contributions = {}
    order = 0
    for line in read_lines(src):
        entry = json.loads(line)
        display = entry.get('word') or ''
        key = display.lower()
        pos = entry.get('pos')
        if key not in words or entry.get('lang_code') != 'en' or pos not in POS_LABELS:
            continue
        # Possessives such as "donkey's" only repeat the base word.
        if key.endswith("'s"):
            continue
        senses = []
        for s in entry.get('senses', []):
            if keep_sense(s, key, pos):
                sense = {'d': s['glosses'][-1].strip()}
                example = pick_example(s)
                if example:
                    sense['x'] = example
                senses.append(sense)
        if not senses:
            continue
        # Lowercase words first, then capitalized ones, then proper nouns,
        # so "polish" (shine) leads and "Polish" (from Poland) follows.
        rank = 2 if pos == 'name' else (0 if display == key else 1)
        contributions.setdefault(key, []).append(
            (rank, order, display, pick_ipa(entry), POS_LABELS[pos], senses, pick_parts(entry))
        )
        order += 1
    return contributions


def merge(key, parts):
    parts.sort(key=lambda p: (p[0], p[1]))
    # Keep abbreviation senses only when the word has nothing else.
    has_real = any(not ABBREVIATION.match(s['d']) for p in parts for s in p[5])
    meanings = {}
    for _, _, _, _, label, senses, _ in parts:
        bucket = meanings.setdefault(label, [])
        for s in senses:
            if has_real and ABBREVIATION.match(s['d']):
                continue
            if len(bucket) < MAX_SENSES and s not in bucket:
                bucket.append(s)
    record = {'m': [{'p': label, 'd': defs} for label, defs in meanings.items() if defs]}
    display = key if any(p[2] == key for p in parts) else parts[0][2]
    if display != key:
        record['w'] = display
    best = next((p for p in parts if p[3]), None)
    if best:
        syl = syllables(display, best[3], best[6])
        if syl:
            record['s'] = syl
        say = respell(best[3])
        if say:
            record['say'] = say
    return record


def write(shards, out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('*.json'):
        old.unlink()
    sizes = []
    for name, shard in sorted(shards.items()):
        data = json.dumps(dict(sorted(shard.items())), ensure_ascii=False, separators=(',', ':')).encode()
        (out / f'{name}.json').write_bytes(data)
        sizes.append((len(gzip.compress(data, 9)), len(data), name))
    total = sum(len(s) for s in shards.values())
    meta = {
        'source': 'English Wiktionary via kaikki.org',
        'sourceUrl': 'https://kaikki.org/dictionary/English/',
        'license': 'CC BY-SA 4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
        'built': datetime.date.today().isoformat(),
        'words': total,
    }
    (out / '_meta.json').write_text(json.dumps(meta, indent='\t') + '\n', encoding='utf-8')
    sizes.sort()
    print(f'{total} words in {len(shards)} shards; '
          f'{sum(s[1] for s in sizes) / 1e6:.1f} MB raw, {sum(s[0] for s in sizes) / 1e6:.1f} MB gzip')
    print('largest (gzip):', ', '.join(f'{n} {g / 1e3:.0f} KB' for g, _, n in sizes[-5:][::-1]))


def check(shards):
    problems = []
    for word, display in REQUIRED.items():
        record = shards.get(shard_key(word), {}).get(word)
        if record is None:
            problems.append(f'missing {word}')
        elif display and record.get('w', word) != display:
            problems.append(f'{word} displays as {record.get("w", word)}, expected {display}')
    for month in MONTHS:
        record = shards.get(shard_key(month), {}).get(month)
        proper = [m for m in (record or {}).get('m', []) if m['p'] == 'proper noun']
        if not proper or 'month' not in proper[0]['d'][0]['d']:
            problems.append(f'{month} lacks a proper noun month meaning')
    for shard in shards.values():
        for word, record in shard.items():
            for m in record['m']:
                if m['p'] == 'proper noun':
                    for d in m['d']:
                        if NAME_JUNK.search(d['d']):
                            problems.append(f'{word} keeps person/place sense: {d["d"][:60]}')
    agri = shards.get('agr', {}).get('agriculture', {})
    if agri.get('s') != 'ag\u00b7ri\u00b7cul\u00b7ture' or agri.get('say') != 'AG-rih-kul-cher':
        problems.append(f'agriculture pronunciation wrong: {agri.get("s")} {agri.get("say")}')
    for word, record in ((w, r) for shard in shards.values() for w, r in shard.items()):
        if 's' in record and record['s'].replace('\u00b7', '').lower() != word:
            problems.append(f'{word} syllables do not spell it: {record["s"]}')
    polish = shards.get('pol', {}).get('polish')
    if not polish or 'w' in polish or polish['m'][0]['p'] == 'adjective':
        problems.append('polish should lead with the lowercase word')
    return problems


def report_coverage(shards, words):
    records = {w: r for shard in shards.values() for w, r in shard.items()}
    with_s = sum(1 for r in records.values() if 's' in r)
    with_say = sum(1 for r in records.values() if 'say' in r)
    print(f'pronunciation: {with_s}/{len(records)} with s, {with_say}/{len(records)} with say')
    req = [w for w in REQUIRED if w in records]
    print(f'REQUIRED: {sum(1 for w in req if "s" in records[w])}/{len(req)} with s, '
          f'{sum(1 for w in req if "say" in records[w])}/{len(req)} with say')
    ranked = top_n_list('en', 1100)[1000:1100]
    present = [w for w in ranked if w in records]
    print(f'rank 1000-1100: {len(present)} present, '
          f'{sum(1 for w in present if "s" in records[w])} with s, '
          f'{sum(1 for w in present if "say" in records[w])} with say')
    for w in present[:20]:
        print(f'  {w} -> {records[w].get("s")} | {records[w].get("say")}')


def main(src, out_dir):
    words = set(top_n_list('en', WORD_LIMIT))
    shards = {}
    for key, parts in collect(src, words).items():
        shards.setdefault(shard_key(key), {})[key] = merge(key, parts)
    write(shards, out_dir)
    report_coverage(shards, words)
    problems = check(shards)
    if problems:
        print('\n'.join(problems), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
