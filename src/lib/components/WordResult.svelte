<script lang="ts">
	import type { DictionaryEntry } from '$lib/types/dictionary';
	import PhoneticPlayer from './PhoneticPlayer.svelte';
	import PartOfSpeech from './PartOfSpeech.svelte';

	let { entry }: { entry: DictionaryEntry } = $props();

	const phonetic = $derived(entry.phonetics.find((p) => p.text) ?? null);
</script>

<article class="mt-4 rounded-2xl border-2 border-border bg-surface p-4 sm:mt-6 sm:p-6">
	<div class="mb-3 flex flex-wrap items-baseline gap-2 sm:mb-4 sm:gap-3">
		<h2 class="text-2xl font-bold sm:text-3xl">{entry.word}</h2>
		{#if phonetic?.text}
			<span class="text-base text-text-muted sm:text-lg">{phonetic.text}</span>
		{/if}
		<PhoneticPlayer word={entry.word} />
	</div>

	{#each entry.meanings as meaning, i (i)}
		<PartOfSpeech {meaning} />
	{/each}
</article>
