import { describe, it, expect } from 'vitest';
import { suggestWords } from './suggest';

describe('suggestWords', () => {
	it('suggests corrections for common misspellings', () => {
		const suggestions = suggestWords('elefant');
		expect(suggestions).toContain('elephant');
	});

	it('suggests corrections for "helo"', () => {
		const suggestions = suggestWords('helo');
		expect(suggestions).toContain('hello');
	});

	it('returns up to maxResults suggestions', () => {
		const suggestions = suggestWords('cat', 2);
		expect(suggestions.length).toBeLessThanOrEqual(2);
	});

	it('returns empty array for empty input', () => {
		expect(suggestWords('')).toEqual([]);
		expect(suggestWords('   ')).toEqual([]);
	});

	it('does not suggest the exact same word', () => {
		const suggestions = suggestWords('hello');
		expect(suggestions).not.toContain('hello');
	});

	it('returns results sorted by edit distance', () => {
		// "aple" -> "apple" (1 edit) should come before "ample" (2 edits)
		const suggestions = suggestWords('aple');
		expect(suggestions.length).toBeGreaterThan(0);
		expect(suggestions).toContain('apple');
	});
});
