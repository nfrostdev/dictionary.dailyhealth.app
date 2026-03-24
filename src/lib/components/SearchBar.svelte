<script lang="ts">
	let { onsearch }: { onsearch: (word: string) => void } = $props();
	let query = $state('');
	let inputEl: HTMLInputElement | undefined = $state();

	function handleSubmit(e: Event) {
		e.preventDefault();
		const trimmed = query.trim();
		if (trimmed) {
			onsearch(trimmed);
		}
	}
</script>

<form onsubmit={handleSubmit} role="search" class="w-full">
	<label for="search-input" class="sr-only">Search for a word</label>
	<div class="flex gap-2 sm:gap-3">
		<input
			bind:this={inputEl}
			bind:value={query}
			id="search-input"
			type="search"
			autocomplete="off"
			spellcheck="true"
			placeholder="Type a word..."
			class="min-w-0 flex-1 rounded-xl border-2 border-border bg-surface px-3 py-3 text-base text-text placeholder:text-text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none sm:px-4 sm:text-lg"
		/>
		<button
			type="submit"
			class="rounded-xl bg-primary px-4 py-3 text-base font-semibold text-white hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:px-6 sm:text-lg"
		>
			Look up
		</button>
	</div>
</form>
