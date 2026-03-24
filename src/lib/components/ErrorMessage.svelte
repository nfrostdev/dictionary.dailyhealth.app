<script lang="ts">
	let {
		error,
		suggestions = [],
		onsuggest
	}: {
		error: 'not-found' | 'network-error';
		suggestions?: string[];
		onsuggest?: (word: string) => void;
	} = $props();
</script>

<div
	role="alert"
	class="mt-4 rounded-2xl border-2 border-border bg-surface p-4 text-center sm:mt-6 sm:p-6"
>
	{#if error === 'not-found'}
		<p class="text-xl font-semibold">We couldn't find that word</p>
		{#if suggestions.length > 0}
			<p class="mt-3 text-text-muted">Did you mean?</p>
			<div class="mt-2 flex flex-wrap justify-center gap-2">
				{#each suggestions as word (word)}
					<button
						type="button"
						onclick={() => onsuggest?.(word)}
						class="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:py-2"
					>
						{word}
					</button>
				{/each}
			</div>
		{:else}
			<p class="mt-2 text-text-muted">Check the spelling and try again!</p>
		{/if}
	{:else}
		<p class="text-xl font-semibold">Something went wrong</p>
		<p class="mt-2 text-text-muted">Check your internet and try again.</p>
	{/if}
</div>
