<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a href="#main-content" class="skip-link">Skip to main content</a>

<div class="mx-auto flex min-h-dvh max-w-2xl flex-col px-4">
	<header class="py-6">
		<h1 class="text-center text-3xl font-bold text-primary">Kids Dictionary</h1>
	</header>

	<main id="main-content" class="flex-1">
		{@render children()}
	</main>

	<footer class="py-6 text-center text-sm text-text-muted">
		<p>A free dictionary for kids. No tracking, no ads.</p>
	</footer>
</div>
