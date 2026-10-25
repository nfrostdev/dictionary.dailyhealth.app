import { describe, it, expect } from 'vitest';
import { shardKey } from './shard-key';

describe('shardKey', () => {
	it.each([
		['hello', 'hel'],
		['a', 'a__'],
		['ox', 'ox_'],
		['t-shirt', 't_s'],
		["o'clock", 'o_c'],
		['café', 'caf'],
		['éclair', '_cl'],
		['3d', '_d_']
	])('%s -> %s', (word, key) => {
		expect(shardKey(word)).toBe(key);
	});
});
