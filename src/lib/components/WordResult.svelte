<script lang="ts">
	import type { DictionaryEntry } from '$lib/types/dictionary';
	import PhoneticPlayer from './PhoneticPlayer.svelte';
	import PartOfSpeech from './PartOfSpeech.svelte';

	let { entry }: { entry: DictionaryEntry } = $props();

	const phonetic = $derived(entry.phonetics.find((p) => p.text) ?? null);
	const audioUrl = $derived(entry.phonetics.find((p) => p.audio)?.audio ?? null);
</script>

<article class="mt-6 rounded-2xl border-2 border-border bg-surface p-6">
	<div class="mb-4 flex flex-wrap items-baseline gap-3">
		<h2 class="text-3xl font-bold">{entry.word}</h2>
		{#if phonetic?.text}
			<span class="text-lg text-text-muted">{phonetic.text}</span>
		{/if}
		{#if audioUrl}
			<PhoneticPlayer {audioUrl} />
		{/if}
	</div>

	{#each entry.meanings as meaning (meaning.partOfSpeech)}
		<PartOfSpeech {meaning} />
	{/each}
</article>
