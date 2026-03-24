<script lang="ts">
	let { error }: { error: 'not-found' | 'network-error' } = $props();
</script>

<div role="alert" class="mt-6 rounded-2xl border-2 border-border bg-surface p-6 text-center">
	{#if error === 'not-found'}
		<p class="text-xl font-semibold">We couldn't find that word</p>
		<p class="mt-2 text-text-muted">Check the spelling and try again!</p>
	{:else}
		<p class="text-xl font-semibold">Something went wrong</p>
		<p class="mt-2 text-text-muted">Check your internet and try again.</p>
	{/if}
</div>
