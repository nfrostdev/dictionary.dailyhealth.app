<script lang="ts">
	import type { Definition } from '$lib/types/dictionary';

	let { definition }: { definition: Definition } = $props();
</script>

<li class="mb-3">
	<p>{definition.definition}</p>
	{#if definition.example}
		<blockquote class="mt-1 border-l-3 border-primary pl-3 text-text-muted italic">
			"{definition.example}"
		</blockquote>
	{/if}
</li>
