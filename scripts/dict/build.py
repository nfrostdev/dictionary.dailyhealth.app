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

from wordfreq import top_n_list

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
    r'|Provinces and territories of Canada)'
)

# Some month senses lack the Months category (December's sits on its given-name sense).
MONTH_GLOSS = re.compile(r'^The \w+( and last)? month of the\b.*\bGregorian calendars?\b')

# Kaikki's categories are page-level, so person/place senses leak in beside month senses.
NAME_JUNK = re.compile(r'\b(given name|surname|town|city|village|civil parish|county|census-designated place)\b', re.I)

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
    sounds = [s for s in entry.get('sounds', []) if s.get('ipa')]
    us = [s for s in sounds if 'US' in s.get('tags', [])]
    return (us or sounds or [{}])[0].get('ipa')


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
    """key -> list of (rank, order, display, ipa, label, senses)."""
    contributions = {}
    order = 0
    for line in read_lines(src):
        entry = json.loads(line)
        display = entry.get('word') or ''
        key = display.lower()
        pos = entry.get('pos')
        if key not in words or entry.get('lang_code') != 'en' or pos not in POS_LABELS:
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
            (rank, order, display, pick_ipa(entry), POS_LABELS[pos], senses)
        )
        order += 1
    return contributions


def merge(key, parts):
    parts.sort(key=lambda p: (p[0], p[1]))
    meanings = {}
    for _, _, _, _, label, senses in parts:
        bucket = meanings.setdefault(label, [])
        for s in senses:
            if len(bucket) < MAX_SENSES and s not in bucket:
                bucket.append(s)
    record = {'m': [{'p': label, 'd': defs} for label, defs in meanings.items()]}
    display = key if any(p[2] == key for p in parts) else parts[0][2]
    if display != key:
        record['w'] = display
    ipa = next((p[3] for p in parts if p[3]), None)
    if ipa:
        record['ipa'] = ipa
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
    polish = shards.get('pol', {}).get('polish')
    if not polish or 'w' in polish or polish['m'][0]['p'] == 'adjective':
        problems.append('polish should lead with the lowercase word')
    return problems


def main(src, out_dir):
    words = set(top_n_list('en', WORD_LIMIT))
    shards = {}
    for key, parts in collect(src, words).items():
        shards.setdefault(shard_key(key), {})[key] = merge(key, parts)
    write(shards, out_dir)
    problems = check(shards)
    if problems:
        print('\n'.join(problems), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
