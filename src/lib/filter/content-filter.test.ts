import { describe, it, expect } from 'vitest';
import { isInappropriate, isBlockedWord, filterEntry } from './content-filter';
import type { DictionaryEntry, Meaning, Definition } from '$lib/types/dictionary';

function makeDef(definition: string, example?: string): Definition {
	return { definition, synonyms: [], antonyms: [], example };
}

function makeMeaning(partOfSpeech: string, defs: Definition[]): Meaning {
	return { partOfSpeech, definitions: defs, synonyms: [], antonyms: [] };
}

function makeEntry(word: string, meanings: Meaning[]): DictionaryEntry {
	return { word, phonetics: [], meanings, license: { name: '', url: '' }, sourceUrls: [] };
}

describe('isBlockedWord', () => {
	it('blocks profanity', () => {
		expect(isBlockedWord('shit')).toBe(true);
		expect(isBlockedWord('fuck')).toBe(true);
		expect(isBlockedWord('damn')).toBe(true);
	});

	it('blocks slurs', () => {
		expect(isBlockedWord('faggot')).toBe(true);
		expect(isBlockedWord('retard')).toBe(true);
		expect(isBlockedWord('chink')).toBe(true);
		expect(isBlockedWord('spic')).toBe(true);
		expect(isBlockedWord('kike')).toBe(true);
		expect(isBlockedWord('gook')).toBe(true);
		expect(isBlockedWord('beaner')).toBe(true);
		expect(isBlockedWord('wetback')).toBe(true);
		expect(isBlockedWord('dyke')).toBe(true);
		expect(isBlockedWord('honky')).toBe(true);
	});

	it('blocks British profanity', () => {
		expect(isBlockedWord('arse')).toBe(true);
		expect(isBlockedWord('arsehole')).toBe(true);
		expect(isBlockedWord('bugger')).toBe(true);
		expect(isBlockedWord('tosser')).toBe(true);
		expect(isBlockedWord('wanker')).toBe(true);
	});

	it('blocks sexual terms', () => {
		expect(isBlockedWord('porn')).toBe(true);
		expect(isBlockedWord('sex')).toBe(true);
		expect(isBlockedWord('condom')).toBe(true);
		expect(isBlockedWord('sperm')).toBe(true);
		expect(isBlockedWord('kinky')).toBe(true);
		expect(isBlockedWord('pimp')).toBe(true);
		expect(isBlockedWord('fellatio')).toBe(true);
		expect(isBlockedWord('sodomy')).toBe(true);
		expect(isBlockedWord('vulva')).toBe(true);
		expect(isBlockedWord('clitoris')).toBe(true);
		expect(isBlockedWord('brothel')).toBe(true);
		expect(isBlockedWord('orgy')).toBe(true);
		expect(isBlockedWord('pedophile')).toBe(true);
		expect(isBlockedWord('incest')).toBe(true);
	});

	it('blocks drug terms', () => {
		expect(isBlockedWord('cocaine')).toBe(true);
		expect(isBlockedWord('heroin')).toBe(true);
		expect(isBlockedWord('meth')).toBe(true);
		expect(isBlockedWord('ecstasy')).toBe(true);
		expect(isBlockedWord('fentanyl')).toBe(true);
		expect(isBlockedWord('ketamine')).toBe(true);
		expect(isBlockedWord('amphetamine')).toBe(true);
		expect(isBlockedWord('xanax')).toBe(true);
	});

	it('allows bathroom words', () => {
		expect(isBlockedWord('poop')).toBe(false);
		expect(isBlockedWord('pee')).toBe(false);
		expect(isBlockedWord('fart')).toBe(false);
		expect(isBlockedWord('butt')).toBe(false);
	});

	it('is case insensitive', () => {
		expect(isBlockedWord('SHIT')).toBe(true);
		expect(isBlockedWord('Fuck')).toBe(true);
	});

	it('allows normal words', () => {
		expect(isBlockedWord('hello')).toBe(false);
		expect(isBlockedWord('cat')).toBe(false);
		expect(isBlockedWord('happy')).toBe(false);
	});
});

describe('isInappropriate', () => {
	it('returns false for clean text', () => {
		expect(isInappropriate('A large wild cat found in the Americas')).toBe(false);
	});

	it('flags vulgar content', () => {
		expect(isInappropriate('A vulgar term for something')).toBe(true);
	});

	it('flags sexual content', () => {
		expect(isInappropriate('Of or relating to sexual intercourse')).toBe(true);
	});

	it('flags offensive markers', () => {
		expect(isInappropriate('An offensive word used to describe')).toBe(true);
	});

	it('flags derogatory terms', () => {
		expect(isInappropriate('A derogatory term for a person')).toBe(true);
	});

	it('flags drug references', () => {
		expect(isInappropriate('An illicit drug derived from plants')).toBe(true);
	});

	it('flags slang with adult context', () => {
		expect(isInappropriate('Slang for an older woman who attracts younger men')).toBe(true);
	});

	it('is case insensitive', () => {
		expect(isInappropriate('VULGAR expression')).toBe(true);
		expect(isInappropriate('Obscene language')).toBe(true);
	});

	it('flags profane words in definitions', () => {
		expect(isInappropriate('Generic intensifier. Fucking; bloody.')).toBe(true);
		expect(isInappropriate('A shitty situation')).toBe(true);
	});

	it('flags drug definitions', () => {
		expect(isInappropriate('Crack cocaine, a potent, relatively cheap variety of cocaine')).toBe(
			true
		);
		expect(isInappropriate('A marijuana cigar.')).toBe(true);
		expect(isInappropriate('A drug smoked or ingested for euphoric effect, cannabis.')).toBe(true);
		expect(isInappropriate('To intoxicate, especially with narcotics.')).toBe(true);
	});

	it('flags anatomical/sexual terms in definitions', () => {
		expect(isInappropriate('(mildly, usually in the plural) A testicle.')).toBe(true);
		expect(isInappropriate('The penis.')).toBe(true);
		expect(
			isInappropriate(
				'Marked by unconventional sexual preferences or behavior, as fetishism, sadomasochism'
			)
		).toBe(true);
		expect(isInappropriate('The lower orifice of the alimentary canal')).toBe(false);
		expect(isInappropriate('The folds of tissue at the opening of the vulva')).toBe(true);
		expect(
			isInappropriate(
				'Any of several forms of sexual intercourse held to be unnatural, particularly bestiality'
			)
		).toBe(true);
	});

	it('flags intensifier definitions (bloody/damn)', () => {
		expect(isInappropriate('Used as an intensifier.')).toBe(true);
		expect(isInappropriate('(intensifier) Used to express anger, annoyance, shock')).toBe(true);
	});

	it('does not flag anal when part of analogy/analysis', () => {
		expect(isInappropriate('An analogy between two things')).toBe(false);
		expect(isInappropriate('A detailed analysis of the data')).toBe(false);
		expect(isInappropriate('An analytical approach')).toBe(false);
	});

	it('does not flag clean uses of ambiguous words', () => {
		expect(isInappropriate('A male bird, especially a rooster')).toBe(false);
		expect(isInappropriate('A valve or tap for controlling flow in plumbing.')).toBe(false);
		expect(
			isInappropriate('Any plant regarded as unwanted at the place where it is growing.')
		).toBe(false);
		expect(
			isInappropriate('A thin and usually jagged space opened in a previously solid material.')
		).toBe(false);
		expect(isInappropriate('A solid or hollow sphere, or roughly spherical mass.')).toBe(false);
	});

	it('does not flag partial word matches', () => {
		expect(isInappropriate('A tabletop game')).toBe(false);
		expect(isInappropriate('A classic piece of literature')).toBe(false);
	});
});

describe('filterEntry', () => {
	it('passes through clean entries unchanged', () => {
		const entry = makeEntry('cat', [
			makeMeaning('noun', [makeDef('A small domesticated carnivorous mammal')])
		]);
		const result = filterEntry(entry);
		expect(result).toEqual(entry);
	});

	it('removes inappropriate definitions but keeps clean ones', () => {
		const entry = makeEntry('cougar', [
			makeMeaning('noun', [
				makeDef('A large wild cat native to the Americas'),
				makeDef('Vulgar slang for an older woman')
			])
		]);
		const result = filterEntry(entry);
		expect(result).not.toBeNull();
		expect(result!.meanings[0].definitions).toHaveLength(1);
		expect(result!.meanings[0].definitions[0].definition).toBe(
			'A large wild cat native to the Americas'
		);
	});

	it('removes meanings with zero remaining definitions', () => {
		const entry = makeEntry('example', [
			makeMeaning('noun', [makeDef('A clean definition')]),
			makeMeaning('verb', [makeDef('A vulgar usage of this word')])
		]);
		const result = filterEntry(entry);
		expect(result).not.toBeNull();
		expect(result!.meanings).toHaveLength(1);
		expect(result!.meanings[0].partOfSpeech).toBe('noun');
	});

	it('returns null when all definitions are inappropriate', () => {
		const entry = makeEntry('badword', [
			makeMeaning('noun', [makeDef('An obscene term'), makeDef('A vulgar expression')])
		]);
		expect(filterEntry(entry)).toBeNull();
	});

	it('filters based on example text too', () => {
		const entry = makeEntry('example', [
			makeMeaning('noun', [
				makeDef('A word', 'Used in a sexual context'),
				makeDef('Another meaning')
			])
		]);
		const result = filterEntry(entry);
		expect(result).not.toBeNull();
		expect(result!.meanings[0].definitions).toHaveLength(1);
		expect(result!.meanings[0].definitions[0].definition).toBe('Another meaning');
	});
});
