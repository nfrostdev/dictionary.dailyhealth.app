<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import WordResult from '$lib/components/WordResult.svelte';
	import ErrorMessage from '$lib/components/ErrorMessage.svelte';
	import { lookupWord } from '$lib/api/dictionary';
	import { suggestWords } from '$lib/spelling/suggest';
	import type { DictionaryResult } from '$lib/types/dictionary';

	let result: DictionaryResult | null = $state(null);
	let loading = $state(false);
	let suggestions: string[] = $state([]);

	async function handleSearch(word: string) {
		loading = true;
		result = null;
		suggestions = [];
		result = await lookupWord(word);
		if (!result.ok && result.error === 'not-found') {
			suggestions = suggestWords(word);
		}
		loading = false;
	}
</script>

<svelte:head>
	<title>Kids Dictionary — Look up any word</title>
</svelte:head>

<div class="mt-6">
	<SearchBar onsearch={handleSearch} />
</div>

<div aria-live="polite" aria-atomic="true">
	{#if loading}
		<p class="mt-8 text-center text-text-muted">Looking up word...</p>
	{:else if result === null}
		<p class="mt-8 text-center text-text-muted">Type a word to look it up!</p>
	{:else if result.ok}
		{#each result.entries as entry}
			<WordResult {entry} />
		{/each}
	{:else}
		<ErrorMessage error={result.error} {suggestions} onsuggest={handleSearch} />
	{/if}
</div>
