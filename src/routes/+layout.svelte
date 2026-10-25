<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a href="#main-content" class="skip-link">Skip to main content</a>

<div class="mx-auto flex min-h-dvh max-w-2xl flex-col px-4">
	<header class="flex items-center justify-between py-4 sm:py-6">
		<h1 class="text-2xl font-bold text-primary sm:text-3xl">Kids Dictionary</h1>
		<ThemeToggle />
	</header>

	<main id="main-content" tabindex="-1" class="flex-1 outline-none">
		{@render children()}
	</main>

	<footer class="py-6 text-center text-sm text-text-muted">
		<p>A free dictionary for kids. No tracking, no ads.</p>
		<p class="mt-1">
			Word meanings come from
			<a
				href="https://en.wiktionary.org/"
				class="rounded text-primary underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
				>Wiktionary</a
			>
			(<a
				href="https://creativecommons.org/licenses/by-sa/4.0/"
				class="rounded text-primary underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
				>CC BY-SA 4.0</a
			>).
		</p>
	</footer>
</div>
