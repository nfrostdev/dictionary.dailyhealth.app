/**
 * Choose a voice for the Listen button. Only on-device English voices qualify:
 * cloud voices would send the word off the device. American English wins.
 */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
	const local = voices.filter((v) => v.localService && v.lang.toLowerCase().startsWith('en'));
	return local.find((v) => v.lang.replace('_', '-').toLowerCase() === 'en-us') ?? local[0] ?? null;
}
