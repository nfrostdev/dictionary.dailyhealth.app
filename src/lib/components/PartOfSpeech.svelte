<script lang="ts">
	import type { Meaning } from '$lib/types/dictionary';
	import Definition from './Definition.svelte';

	const CAP = 3;

	let { meaning }: { meaning: Meaning } = $props();
	let expanded = $state(false);

	const hasMore = $derived(meaning.definitions.length > CAP);
	const visibleDefs = $derived(expanded ? meaning.definitions : meaning.definitions.slice(0, CAP));
	const remaining = $derived(meaning.definitions.length - CAP);
</script>

<section class="mb-6">
	<h3 class="mb-2 text-lg font-semibold text-primary italic">{meaning.partOfSpeech}</h3>
	<ol class="list-decimal pl-4 sm:pl-6">
		{#each visibleDefs as def, i (i)}
			<Definition definition={def} />
		{/each}
	</ol>
	{#if hasMore}
		<button
			type="button"
			onclick={() => (expanded = !expanded)}
			class="mt-1 rounded-lg px-2 py-1.5 text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
		>
			{expanded ? 'Show fewer definitions' : `Show ${remaining} more definitions`}
		</button>
	{/if}
</section>
