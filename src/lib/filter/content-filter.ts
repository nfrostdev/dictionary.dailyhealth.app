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
	'bitchy',
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
	'shitpost',
	'shitposting',
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
	'orgasmic',
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

	// Sexual or crude words that slip past Wiktionary tags
	'cocksucker',
	'cocksuckers',
	'gangbang',
	'gangbangs',
	'gangbanging',
	'pornstar',
	'rapey',
	'pedo',
	'pedos',
	'pedophiles',
	'paedophile',
	'paedophiles',
	'paedo',
	'paedos',
	'sx',
	'sext',
	'sexts',
	'sexting',
	'ggg',
	'poon',
	'bde',
	'foursome',
	'foursomes',
	'pornstars',
	'porno',
	'pornos',
	'pornographer',
	'pornographers',
	'pimps',
	'pimping',
	'nuru',
	'merkin',
	'nudie',
	'nudies',
	'titty',
	'titties',
	'jizz',
	'butthurt',

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
	'xanax',

	// Sexual violence
	'rape',

	// Self-harm slang ("kill myself")
	'kms'
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

	// Porn, suicide, prostitution and slurs
	/\bporn/i,
	/\bsuicid/i,
	/\bsexy\b/i,
	/\bprostitut/i,
	/\bpubic\b/i,
	/\bpa?edophil/i,
	/\b(to|or) rape\b/i,
	/\bsex (acts?|positions?|partners?|symbol|maniac|offenders?|work(ers?)?)\b/i,
	/\b(ethnic|racial|religious|homophobic) slurs?\b/i,

	// Drug references
	/\billicit drug\b/i,
	/\brecreational drug\b/i,
	/\bnarcotics?\b/i,
	/\bhallucinogen(ic)?\b/i,
	/\bmarijuana\b/i,
	/\bcannabis\b(?! sativa)/i,
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
	/\borgasm(s|ic)?\b/i,
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
	/\b(for|having|has|have) sex\b/i,
	// "have homosexual sex", but not "having a sex" or "had its sex determined"
	/\b(having|has|have|had) (?!(a|an|the|its|their|either|each|one|both|opposite|same)\b)\w+ sex\b/i,
	/\bcum\b/i,
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
	// Narrowed to people: a bare match blocked geography (aardvark, bai, swee)
	/\bsub-Saharan (Africans?|peoples?|persons?|descent|ancestry|origin)\b/i,
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

/** Extra patterns for example sentences only; definitions with these words stay. */
const EXAMPLE_ONLY_PATTERNS: RegExp[] = [
	/\bnaked\b/i,
	/\bnude\b/i,
	/\btied to a bed\b/i,
	/\brap(e|es|ed|ing|ists?)\b/i,
	/\bsex\b/i
];

function exampleOk(example: string): boolean {
	if (isInappropriate(example) || EXAMPLE_ONLY_PATTERNS.some((p) => p.test(example))) return false;
	// "Can I blag a fag?" teaches the blocked word
	return !(example.match(/[\w']+/g) ?? []).some(isBlockedWord);
}

/** Form-of glosses ("plural of nigger"); the captured word is the base form. */
const FORM_OF_GLOSS =
	/^(?:plural|(?:simple past|present participle|past participle|comparative|superlative|third-person)[^.]*?|alternative (?:form|spelling)|filter-avoidance spelling|eye dialect spelling|deliberate misspelling|censored spelling|pronunciation spelling|clipping|initialism|abbreviation|synonym) of ([\w'-]+)/i;

export function isBlockedWord(word: string): boolean {
	return BLOCKED_WORDS.has(word.trim().toLowerCase());
}

export function isInappropriate(text: string): boolean {
	return INAPPROPRIATE_PATTERNS.some((pattern) => pattern.test(text));
}

function filterDefinition(def: Definition): Definition | null {
	if (isInappropriate(def.definition)) return null;
	// "plural of nigger" must not outlive its blocked base word
	const base = FORM_OF_GLOSS.exec(def.definition)?.[1];
	if (base && isBlockedWord(base)) return null;
	// An inappropriate example costs only the example, not a clean definition
	const { example, ...rest } = def;
	const clean = example && exampleOk(example) ? { ...rest, example } : rest;
	return { ...clean, synonyms: [], antonyms: [] };
}

function filterMeaning(meaning: Meaning): Meaning | null {
	const definitions = meaning.definitions
		.map(filterDefinition)
		.filter((d): d is Definition => d !== null);
	if (definitions.length === 0) return null;
	return { ...meaning, definitions, synonyms: [], antonyms: [] };
}

export function filterEntry(entry: DictionaryEntry): DictionaryEntry | null {
	const meanings = entry.meanings.map(filterMeaning).filter((m): m is Meaning => m !== null);

	if (meanings.length === 0) return null;
	return { ...entry, meanings };
}
