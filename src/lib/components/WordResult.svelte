<script lang="ts">
	import type { DictionaryEntry } from '$lib/types/dictionary';
	import PhoneticPlayer from './PhoneticPlayer.svelte';
	import PartOfSpeech from './PartOfSpeech.svelte';

	let { entry }: { entry: DictionaryEntry } = $props();

	const syllableLabel = $derived(entry.syllables ? entry.syllables.split('·').join(', ') : '');
</script>

<article class="mt-4 rounded-2xl border-2 border-border bg-surface p-4 sm:mt-6 sm:p-6">
	<div class="mb-3 flex flex-wrap items-baseline gap-2 sm:mb-4 sm:gap-3">
		<h2 class="text-2xl font-bold sm:text-3xl">{entry.word}</h2>
		{#if entry.syllables}
			<span class="text-base text-text-muted sm:text-lg" aria-label={`Syllables: ${syllableLabel}`}
				>{entry.syllables}</span
			>
		{/if}
	</div>
	<div class="mb-3 flex flex-wrap items-center gap-2 sm:mb-4 sm:gap-3">
		{#if entry.sayIt}
			<p class="text-base text-text-muted sm:text-lg">
				Say it: <strong class="font-bold text-text">{entry.sayIt}</strong>
			</p>
		{/if}
		<PhoneticPlayer word={entry.word} />
	</div>

	{#each entry.meanings as meaning, i (i)}
		<PartOfSpeech {meaning} />
	{/each}
</article>
