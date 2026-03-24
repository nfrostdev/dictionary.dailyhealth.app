import { commonWords } from './words';

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

	for (let i = 0; i <= m; i++) dp[i][0] = i;
	for (let j = 0; j <= n; j++) dp[0][j] = j;

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1];
			} else {
				dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
			}
		}
	}

	return dp[m][n];
}

/**
 * Suggest up to `maxResults` words similar to the input.
 * Returns words sorted by edit distance (closest first).
 */
export function suggestWords(input: string, maxResults = 3): string[] {
	const word = input.trim().toLowerCase();
	if (!word) return [];

	const maxDistance = Math.max(2, Math.floor(word.length / 2));

	const candidates: { word: string; distance: number }[] = [];

	for (const candidate of commonWords) {
		// Skip if length difference alone exceeds max distance
		if (Math.abs(candidate.length - word.length) > maxDistance) continue;

		const distance = levenshtein(word, candidate);
		if (distance > 0 && distance <= maxDistance) {
			candidates.push({ word: candidate, distance });
		}
	}

	candidates.sort((a, b) => a.distance - b.distance);
	return candidates.slice(0, maxResults).map((c) => c.word);
}
