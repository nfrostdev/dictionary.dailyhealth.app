import type { DictionaryEntry, Definition, Meaning } from '$lib/types/dictionary';

/**
 * Words that should be blocked at search time — never even sent to the API.
 * Lowercase. Checked against the trimmed, lowercased search input.
 */
const BLOCKED_WORDS: Set<string> = new Set([
	// Profanity
	'ass',
	'asshole',
	'badass',
	'bastard',
	'bitch',
	'bollocks',
	'bullshit',
	'cunt',
	'damn',
	'dammit',
	'dick',
	'dipshit',
	'douchebag',
	'dumbass',
	'fuck',
	'fucking',
	'goddamn',
	'hell',
	'jackass',
	'motherfucker',
	'piss',
	'prick',
	'scumbag',
	'shit',
	'shitty',
	'slut',
	'smartass',
	'whore',

	// British profanity
	'arse',
	'arsehole',
	'bellend',
	'bloodclaat',
	'bugger',
	'minge',
	'slag',
	'tosser',

	// Slurs
	'beaner',
	'chink',
	'coon',
	'dago',
	'darkie',
	'dyke',
	'fag',
	'faggot',
	'gook',
	'gypsy',
	'half-breed',
	'homo',
	'honky',
	'kike',
	'lesbo',
	'mick',
	'mulatto',
	'negro',
	'nigga',
	'nigger',
	'paki',
	'poof',
	'retard',
	'retarded',
	'skank',
	'spic',
	'tard',
	'tranny',
	'wetback',
	'wog',
	'wop',
	'yid',

	// Sexual/anatomical terms and slang
	'adultery',
	'anal',
	'bimbo',
	'blowjob',
	'boner',
	'boobs',
	'bukkake',
	'brothel',
	'chode',
	'circumcision',
	'clit',
	'clitoris',
	'concubine',
	'condom',
	'cunnilingus',
	'dildo',
	'dominatrix',
	'fellatio',
	'fondle',
	'foreplay',
	'foreskin',
	'fornication',
	'gigolo',
	'grope',
	'handjob',
	'hussy',
	'incest',
	'kinky',
	'labia',
	'lewd',
	'lingerie',
	'masturbate',
	'milf',
	'orgasm',
	'orgy',
	'pedophile',
	'penis',
	'perv',
	'pimp',
	'porn',
	'prostitute',
	'pussy',
	'raunchy',
	'schlong',
	'scrotum',
	'sex',
	'sexy',
	'shag',
	'shagging',
	'shemale',
	'slutty',
	'sodomy',
	'sperm',
	'stiffy',
	'stripper',
	'testicles',
	'threesome',
	'tits',
	'twat',
	'vagina',
	'viagra',
	'voyeur',
	'vulva',
	'wank',
	'wanker',

	// Drug terms
	'adderall',
	'ganja',
	'amphetamine',
	'barbiturate',
	'benzodiazepine',
	'cocaine',
	'ecstasy',
	'fentanyl',
	'hashish',
	'heroin',
	'ketamine',
	'lsd',
	'mdma',
	'meth',
	'methamphetamine',
	'opium',
	'opioid',
	'oxycodone',
	'psilocybin',
	'reefer',
	'xanax'
]);

/**
 * Profane words that should be filtered out of definition/example text.
 * These catch cases where the API defines words using profanity
 * (e.g. "damn" defined as "Generic intensifier. Fucking; bloody.").
 */
const PROFANE_WORDS: RegExp[] = [
	/\bass(hole)?\b/i,
	/\bbastard\b/i,
	/\bbitch(y|es|ing)?\b/i,
	/\bbollocks\b/i,
	/\bbullshit\b/i,
	/\bcunt\b/i,
	/\bdick(head)?\b/i,
	/\bfuck(ing|ed|er|s)?\b/i,
	/\bgoddamn\b/i,
	/\bmotherfuck(er|ing)?\b/i,
	/\bpiss(ed|ing)?\b/i,
	/\bshit(ty|s|head)?\b/i,
	/\bslut(ty|s)?\b/i,
	/\bwhore\b/i
];

/**
 * Patterns that flag a definition as inappropriate for kids ages 5-11.
 * Matched case-insensitively against definition text and examples.
 */
const INAPPROPRIATE_PATTERNS: RegExp[] = [
	// Explicit content markers (commonly used by dictionaries)
	/\bvulgar\b/i,
	/\boffensive\b/i,
	/\btaboo\b/i,
	/\bobscene\b/i,
	/\bprofan(e|ity)\b/i,
	/\bderogatory\b/i,
	/\bpejorative\b/i,

	// Sexual content
	/\bsexual(ly)?\b/i,
	/\bsexual intercourse\b/i,
	/\bcoitus\b/i,
	/\berotic(a|ally|ism)?\b/i,
	/\bpornograph(y|ic)\b/i,
	/\bgenital(s|ia)?\b/i,
	/\bprostitu(te|tion)\b/i,

	// Drug references
	/\billicit drug\b/i,
	/\brecreational drug\b/i,
	/\bnarcotics?\b/i,
	/\bhallucinogen(ic)?\b/i,
	/\bmarijuana\b/i,
	/\bcannabis\b/i,
	/\bcocaine\b/i,
	/\bheroin\b/i,
	/\bmethamph/i,
	/\bopiat/i,
	/\bopioid\b/i,
	/\bcrack.cocaine\b/i,
	/\bmdma\b/i,
	/\beuphoric effect\b/i,
	/\bintoxicat(e|ing|ed)\b/i,
	/\bsmoked?\b.*\b(drug|weed|pot)\b/i,
	/\b(drug|weed|pot)\b.*\bsmoked?\b/i,

	// Anatomical/sexual terms in definitions
	/\btesticle\b/i,
	/\bpenis\b/i,
	/\bscrotum\b/i,
	/\bbreast(s)?\b(?!.*(bird|chicken|poultry|meat|stroke|swim))/i,
	/\bsadomasochis/i,
	/\bfetishis/i,
	/\borgasm(ic)?\b/i,
	/\berection\b/i,
	/\bejaculat/i,
	/\banus\b/i,
	/\banal\b(?!.*(ogy|ysis|ytical|ogue))/i,
	/\bclitoris\b/i,
	/\bvulva\b/i,
	/\bsodomy\b/i,
	/\bbestiality\b/i,
	/\bphall(us|ic)\b/i,
	/\bmasturbat/i,
	/\bsemen\b/i,
	/\bsexual activity\b/i,
	/\bsexual arousal\b/i,
	/\bsexually provocative\b/i,
	/\barousal\b/i,
	/\bseductiv/i,
	/\bstripper\b/i,
	/\bsodomize\b/i,
	/\bcondom\b/i,
	/\boral sex\b/i,
	/\bhave sex\b/i,
	/\bsex toy\b/i,
	/\bfellat/i,
	/\blecherous\b/i,
	/\bvibrator\b/i,
	/\bsex appeal\b/i,
	/\bsmutty\b/i,
	/\bindecen(t|cy)\b/i,
	/\bpervert(ed)?\b/i,
	/\bbdsm\b/i,
	/\bsexual pleasure\b/i,
	/\bsexual interaction\b/i,
	/\bsexual practices\b/i,
	/\bsexual desire\b/i,
	/\bquaalude\b/i,

	// Racial classification / slur definitions
	/\bCaucasian\b/i,
	/\ba black person\b/i,
	/\ba white person\b/i,
	/\bacts?\s*(like\s+a\s+)?(white|black|asian)\b/i,
	/\bsub-Saharan\b/i,
	/\bred-skinned\b/i,
	/\bdark-skinned person\b/i,
	/\bmixed\s+(black|white|racial)\b/i,
	/\bracial\b/i,

	// Profanity used as intensifier (catches "bloody", "damn" style definitions)
	/\bintensifier\b/i,

	// Slang markers combined with adult context
	/\bslang\b.*\b(older|attract|sex|woman|man|prowl)\b/i,
	/\b(older|attract|sex|woman|man|prowl)\b.*\bslang\b/i,

	// Profane words appearing in definitions
	...PROFANE_WORDS
];

export function isBlockedWord(word: string): boolean {
	return BLOCKED_WORDS.has(word.trim().toLowerCase());
}

export function isInappropriate(text: string): boolean {
	return INAPPROPRIATE_PATTERNS.some((pattern) => pattern.test(text));
}

function filterDefinition(def: Definition): boolean {
	if (isInappropriate(def.definition)) return false;
	if (def.example && isInappropriate(def.example)) return false;
	return true;
}

function filterMeaning(meaning: Meaning): Meaning | null {
	const definitions = meaning.definitions
		.filter(filterDefinition)
		.map((def) => ({ ...def, synonyms: [], antonyms: [] }));
	if (definitions.length === 0) return null;
	return { ...meaning, definitions, synonyms: [], antonyms: [] };
}

export function filterEntry(entry: DictionaryEntry): DictionaryEntry | null {
	const meanings = entry.meanings.map(filterMeaning).filter((m): m is Meaning => m !== null);

	if (meanings.length === 0) return null;
	return { ...entry, meanings };
}
