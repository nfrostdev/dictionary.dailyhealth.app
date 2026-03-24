<script lang="ts">
	import type { Meaning } from '$lib/types/dictionary';
	import Definition from './Definition.svelte';

	let { meaning }: { meaning: Meaning } = $props();
</script>

<section class="mb-6">
	<h3 class="mb-2 text-lg font-semibold text-primary italic">{meaning.partOfSpeech}</h3>
	<ol class="list-decimal pl-4 sm:pl-6">
		{#each meaning.definitions as def, i (i)}
			<Definition definition={def} />
		{/each}
	</ol>
</section>
