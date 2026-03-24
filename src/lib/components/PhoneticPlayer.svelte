<script lang="ts">
	let { audioUrl }: { audioUrl: string } = $props();

	function play() {
		new Audio(audioUrl).play();
	}
</script>

<button
	onclick={play}
	type="button"
	aria-label="Listen to pronunciation"
	class="inline-flex items-center gap-1 rounded-lg bg-surface px-3 py-2.5 text-sm font-medium text-primary hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none sm:py-1.5"
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="h-4 w-4"
		aria-hidden="true"
	>
		<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
		<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
		<path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
	</svg>
	Listen
</button>
