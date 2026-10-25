"""Kid-friendly pronunciation helpers: spelling syllables and a sound-it-out respelling.

Both are computed at build time from American IPA. Anything uncertain returns
None, because wrong-looking output is worse than none.
"""

import pyphen

SEP = '·'

# ipa -> (open form, closed form)
VOWELS = {
    'æ': ('a', 'a'), 'ɑ': ('ah', 'o'), 'ɒ': ('ah', 'o'), 'ɔ': ('aw', 'aw'),
    'ʌ': ('uh', 'u'), 'ə': ('uh', 'u'), 'ɐ': ('uh', 'u'), 'ɛ': ('eh', 'e'),
    'e': ('eh', 'e'), 'ɪ': ('ih', 'i'), 'ᵻ': ('ih', 'i'), 'i': ('ee', 'ee'),
    'ʊ': ('uu', 'uu'), 'u': ('oo', 'oo'), 'ɵ': ('oo', 'oo'),
    'eɪ': ('ay', 'ay'), 'aɪ': ('eye', 'y'), 'ɔɪ': ('oy', 'oy'), 'aʊ': ('ow', 'ow'),
    'oʊ': ('oh', 'oh'), 'o': ('oh', 'oh'), 'ɚ': ('er', 'er'), 'ɝ': ('er', 'er'),
}
# Rhotic vowels only match when the ɹ is not followed by a vowel.
RHOTIC = {
    'ɜɹ': 'er', 'ɑɹ': 'ar', 'ɔɹ': 'or', 'oɹ': 'or', 'ɛɹ': 'air', 'eɹ': 'air',
    'ɪɹ': 'eer', 'iɹ': 'eer', 'ʊɹ': 'oor', 'uɹ': 'oor',
}
SYLLABIC = {'l': 'ul', 'n': 'un', 'm': 'um'}
SYLLABIC_MARKS = '̩̍'
CHECKED = set('æɛɪʊʌɒ')

# Normalized ipa -> letters. 'ɹ' is normalized to 'r' for onset checks.
CONSONANTS = {
    'p': 'p', 'b': 'b', 't': 't', 'd': 'd', 'k': 'k', 'g': 'g', 'f': 'f', 'v': 'v',
    's': 's', 'z': 'z', 'h': 'h', 'm': 'm', 'n': 'n', 'l': 'l', 'w': 'w', 'r': 'r',
    'ɾ': 't', 'ʔ': 't', 'θ': 'th', 'ð': 'th', 'ʃ': 'sh', 'ʒ': 'zh', 'tʃ': 'ch',
    'dʒ': 'j', 'ŋ': 'ng', 'j': 'y', 'ʍ': 'wh',
}
AFFRICATES = {'t͡ʃ': 'tʃ', 't͜ʃ': 'tʃ', 'tʃ': 'tʃ', 'd͡ʒ': 'dʒ', 'd͜ʒ': 'dʒ', 'dʒ': 'dʒ'}
DROP = set('/ˑː̯ʰ')
BOUNDARIES = {'.': '', ' ': '', 'ˈ': 'p', 'ˌ': 's'}

ONSETS = {tuple(c.split()) for c in (
    'p l|b l|k l|g l|f l|s l|p r|b r|t r|d r|k r|g r|f r|θ r|ʃ r|s p|s t|s k|s m|s n|s w'
    '|t w|d w|k w|g w|θ w|s p l|s p r|s t r|s k r|s k w'
).split('|')}
ONSETS = {tuple('r' if x == 'ɹ' else x for x in o) for o in ONSETS}

_hyphenator = pyphen.Pyphen(lang='en_US')


def _tokenize(ipa):
    """-> list of ('V', open, closed, checked) | ('C', key) | ('B', stress), or None."""
    s = ''.join(ch for ch in ipa if ch not in DROP)
    s = s.replace('ɡ', 'g')
    tokens = []
    i = 0
    n = len(s)
    while i < n:
        ch = s[i]
        if ch in BOUNDARIES:
            tokens.append(('B', BOUNDARIES[ch]))
            i += 1
            continue
        if s[i:i + 3] in AFFRICATES:
            tokens.append(('C', AFFRICATES[s[i:i + 3]]))
            i += 3
            continue
        if s[i:i + 2] in AFFRICATES:
            tokens.append(('C', AFFRICATES[s[i:i + 2]]))
            i += 2
            continue
        pair = s[i:i + 2]
        if pair in RHOTIC and not (i + 2 < n and _is_vowel_start(s[i + 2])):
            r = RHOTIC[pair]
            tokens.append(('V', r, r, False))
            i += 2
            continue
        if pair in VOWELS:
            o, c = VOWELS[pair]
            tokens.append(('V', o, c, False))
            i += 2
            continue
        if ch in SYLLABIC and i + 1 < n and s[i + 1] in SYLLABIC_MARKS:
            tokens.append(('V', SYLLABIC[ch], SYLLABIC[ch], False))
            i += 2
            continue
        if ch in VOWELS:
            o, c = VOWELS[ch]
            tokens.append(('V', o, c, ch in CHECKED))
            i += 1
            continue
        key = 'r' if ch == 'ɹ' else ch
        if key in CONSONANTS and not (i + 1 < n and s[i + 1] in SYLLABIC_MARKS):
            tokens.append(('C', key))
            i += 1
            continue
        return None
    return tokens


def _is_vowel_start(ch):
    return ch in VOWELS or ch in 'ɜ'


def count_syllables(ipa):
    tokens = _tokenize(ipa)
    if tokens is None:
        return None
    return sum(1 for t in tokens if t[0] == 'V')


def _split_cluster(cluster):
    """Split consonants between two nuclei into (coda, onset) by longest legal onset."""
    for k in range(len(cluster)):
        onset = tuple(cluster[k:])
        if len(onset) == 1:
            if onset[0] != 'ŋ':
                return cluster[:k], list(onset)
        elif onset in ONSETS:
            return cluster[:k], list(onset)
    return list(cluster), []


def _build(ipa):
    """-> list of syllable dicts, or None."""
    tokens = _tokenize(ipa)
    if tokens is None:
        return None
    # Group tokens by boundary; each group remembers the strongest stress mark.
    groups = []
    stress = ''
    cur = []
    for t in tokens:
        if t[0] == 'B':
            if cur:
                groups.append((stress, cur))
                cur = []
                stress = ''
            if t[1] == 'p' or (t[1] == 's' and stress != 'p'):
                stress = t[1]
        else:
            cur.append(t)
    if cur:
        groups.append((stress, cur))
    sylls = []
    for stress, toks in groups:
        pieces = []  # alternating consonant runs and vowels
        run = []
        for t in toks:
            if t[0] == 'C':
                run.append(t[1])
            else:
                pieces.append(run)
                pieces.append(t)
                run = []
        pieces.append(run)
        vowels = pieces[1::2]
        if not vowels:
            if not sylls:
                return None
            sylls[-1]['coda'] += pieces[0]
            continue
        first = len(sylls)
        for idx, v in enumerate(vowels):
            sylls.append({'onset': [], 'v': v, 'coda': [], 'stress': '', 'implicit': idx > 0})
        sylls[first]['onset'] = pieces[0]
        sylls[first]['stress'] = stress
        for idx in range(len(vowels) - 1):
            coda, onset = _split_cluster(pieces[2 + 2 * idx])
            sylls[first + idx]['coda'] += coda
            sylls[first + idx + 1]['onset'] = onset
        sylls[first + len(vowels) - 1]['coda'] += pieces[-1]
    # Checked stressed vowel with no coda borrows one consonant from the next onset,
    # unless the IPA marked the syllable boundary itself.
    for i, sy in enumerate(sylls[:-1]):
        nxt = sylls[i + 1]
        if sy['stress'] == 'p' and sy['v'][3] and not sy['coda'] and nxt['onset'] and nxt['implicit']:
            sy['coda'].append(nxt['onset'].pop(0))
    return sylls


def respell(ipa):
    sylls = _build(ipa)
    if not sylls:
        return None
    primary = sum(1 for s in sylls if s['stress'] == 'p')
    if len(sylls) == 1:
        sylls[0]['stress'] = 'p'
    elif primary != 1:
        return None
    out = []
    for s in sylls:
        text = ''.join(CONSONANTS[c] for c in s['onset'])
        text += s['v'][2] if s['coda'] else s['v'][1]
        text += ''.join(CONSONANTS[c] for c in s['coda'])
        out.append(text.upper() if s['stress'] == 'p' else text)
    return '-'.join(out)


def syllables(word, ipa, parts):
    count = count_syllables(ipa)
    if not count or count < 2:
        return None
    lower = word.lower()
    candidates = []
    if parts:
        candidates.append([p.lower() for p in parts])
    candidates.append(_hyphenator.inserted(lower, hyphen=SEP).split(SEP))
    for cand in candidates:
        if len(cand) == count and all(cand) and ''.join(cand) == lower:
            return SEP.join(cand)
    return None
