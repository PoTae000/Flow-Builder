<script lang="ts">
	import { collab } from '$lib/stores/collab.svelte';
</script>

{#if collab.connected}
	<div class="flex items-center gap-1.5 text-[10px]">
		{#if collab.peerCount > 0}
			<span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
			<span class="hidden sm:inline text-emerald-600 dark:text-emerald-400">{collab.peerCount} online</span>
		{:else}
			<span class="inline-block h-2 w-2 rounded-full bg-orange-400"></span>
			<span class="hidden sm:inline text-orange-500 dark:text-orange-400">ไม่มีคนออนไลน์</span>
		{/if}
	</div>
{/if}
