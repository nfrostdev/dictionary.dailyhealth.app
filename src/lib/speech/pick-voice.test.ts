import { describe, it, expect } from 'vitest';
import { pickVoice } from './pick-voice';

const voice = (lang: string, localService: boolean, name = lang) =>
	({ lang, localService, name }) as SpeechSynthesisVoice;

describe('pickVoice', () => {
	it('returns null when only remote voices exist', () => {
		expect(pickVoice([voice('en-US', false), voice('en-GB', false)])).toBeNull();
	});

	it('prefers a local en-GB voice over a remote en-US one', () => {
		const gb = voice('en-GB', true);
		expect(pickVoice([voice('en-US', false), gb])).toBe(gb);
	});

	it('prefers local en-US over local en-GB', () => {
		const us = voice('en_US', true);
		expect(pickVoice([voice('en-GB', true), us])).toBe(us);
	});

	it('ignores non-English voices', () => {
		expect(pickVoice([voice('fr-FR', true), voice('de-DE', true)])).toBeNull();
	});
});
