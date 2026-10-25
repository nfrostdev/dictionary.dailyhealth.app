/**
 * Name of the static/dict file holding `word` (already lowercased): its first
 * three characters, anything outside a-z replaced by `_`, padded with `_`.
 * Must match shard_key() in scripts/dict/build.py.
 */
export function shardKey(word: string): string {
	return Array.from(word)
		.slice(0, 3)
		.map((c) => (c >= 'a' && c <= 'z' ? c : '_'))
		.join('')
		.padEnd(3, '_');
}
