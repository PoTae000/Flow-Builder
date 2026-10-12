<script lang="ts">
	import { diagram } from '$lib/stores/diagram.svelte';

	
	
	
	let {
		targetId,
		x,
		y
	}: {
		targetId: string;
		
		x: number;
		y: number;
	} = $props();

	const count = $derived(diagram.commentCountByTarget.get(targetId) ?? 0);

	function open(e: MouseEvent | TouchEvent) {
		e.stopPropagation();
		e.preventDefault();
		diagram.selectEntity(targetId);
		diagram.openCommentsPanel?.();
	}
</script>

{#if count > 0}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	
	<g transform="translate({x - 8}, {y - 8})" style="cursor: pointer;" onclick={open} ontouchstart={open}>
		<title>{count} ความคิดเห็น — คลิกเพื่อดู</title>
		<g class="comment-badge">
			
			<path
				d="M2 2 h20 a3 3 0 0 1 3 3 v10 a3 3 0 0 1 -3 3 h-11 l-5 4 v-4 h-1 a3 3 0 0 1 -3 -3 v-10 a3 3 0 0 1 3 -3 z"
				fill="#f59e0b"
				stroke="white"
				stroke-width="1.5"
			/>
			<text
				x="12.5"
				y="11.5"
				text-anchor="middle"
				dominant-baseline="central"
				font-size="11"
				font-weight="700"
				fill="white"
			>{count > 9 ? '9+' : count}</text>
		</g>
	</g>
{/if}

<style>
	.comment-badge { transition: transform 0.12s ease; transform-box: fill-box; transform-origin: center; }
	.comment-badge:hover { transform: scale(1.12); }
</style>
