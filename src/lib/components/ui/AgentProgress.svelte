<script lang="ts">
	import { agent } from '$lib/stores/agent.svelte';
</script>

{#if agent.running || agent.steps.length > 0}
	<div class="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg-secondary)] p-3">
		<div class="mb-2 flex items-center justify-between">
			<span class="text-[11px] font-medium text-[var(--ui-text)]">
				{agent.running ? 'กำลังทำงาน...' : 'เสร็จแล้ว'}
			</span>
			{#if agent.running}
				<button
					onclick={() => agent.cancelAgent()}
					class="rounded px-2 py-0.5 text-[10px] text-red-500 transition hover:bg-red-50 dark:hover:bg-red-900/20"
				>ยกเลิก</button>
			{:else}
				<button
					onclick={() => agent.undoAgent()}
					class="rounded px-2 py-0.5 text-[10px] text-[var(--ui-text-secondary)] transition hover:bg-[var(--ui-hover)]"
				>ย้อนกลับทั้งหมด</button>
			{/if}
		</div>
		<div class="space-y-1.5">
			{#each agent.steps as step}
				<div class="flex items-center gap-2 text-[10px]">
					{#if step.status === 'running'}
						<span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--ui-accent)] border-t-transparent"></span>
					{:else if step.status === 'done'}
						<svg class="h-3 w-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
					{:else if step.status === 'error'}
						<svg class="h-3 w-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
					{:else}
						<span class="inline-block h-3 w-3 rounded-full border border-[var(--ui-border)]"></span>
					{/if}
					<span class="text-[var(--ui-text-secondary)] {step.status === 'error' ? 'text-red-500' : ''}">
						{step.label}
						{#if step.error}
							<span class="text-red-400"> — {step.error}</span>
						{/if}
					</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
