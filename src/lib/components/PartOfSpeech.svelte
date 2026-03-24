<script lang="ts">
	import type { Meaning } from '$lib/types/dictionary';
	import Definition from './Definition.svelte';

	let { meaning }: { meaning: Meaning } = $props();
</script>

<section class="mb-6">
	<h3 class="mb-2 text-lg font-semibold text-primary italic">{meaning.partOfSpeech}</h3>
	<ol class="list-decimal pl-6">
		{#each meaning.definitions as def, i (i)}
			<Definition definition={def} />
		{/each}
	</ol>
	{#if meaning.synonyms.length > 0}
		<p class="mt-2 text-sm text-text-muted">
			<span class="font-semibold">Synonyms:</span>
			{meaning.synonyms.join(', ')}
		</p>
	{/if}
	{#if meaning.antonyms.length > 0}
		<p class="mt-1 text-sm text-text-muted">
			<span class="font-semibold">Antonyms:</span>
			{meaning.antonyms.join(', ')}
		</p>
	{/if}
</section>
