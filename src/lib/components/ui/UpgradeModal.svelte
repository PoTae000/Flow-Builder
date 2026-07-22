<script lang="ts">
	import { ui } from '$lib/stores/ui.svelte';

	let loading = $state(false);
	let errorMsg = $state('');

	function close() {
		ui.showUpgradeModal = false;
	}

	async function handleUpgrade() {
		loading = true;
		errorMsg = '';

		try {
			const token = sessionStorage.getItem('er-diagram:id-token');
			if (!token) {
				errorMsg = 'กรุณาเข้าสู่ระบบก่อน';
				return;
			}

			const res = await fetch('/api/stripe/checkout', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				}
			});

			if (!res.ok) {
				const data: any = await res.json().catch(() => ({}));
				throw new Error(data.message || 'ไม่สามารถสร้าง checkout session ได้');
			}

			const data = await res.json();
			if (data.url) {
				window.location.href = data.url;
			}
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
		} finally {
			loading = false;
		}
	}

	const features = [
		'AI Analysis & Auto-Fix',
		'AI Chat Assistant',
		'Code Generation (SQL, ORM, etc.)',
		'AI Translate',
		'Domain Starter',
		'AI Import (Text & Image)',
		'Quiz Generator',
		'Smart Suggestions',
		'AI Layout',
		'Name Suggestions'
	];
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onkeydown={(e) => { if (e.key === 'Escape') close(); }}>
	<div class="relative mx-4 w-full max-w-md rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-6 shadow-2xl">
		<!-- Close button -->
		<button
			class="absolute right-4 top-4 rounded-lg p-1 text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
			onclick={close}
			aria-label="Close"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>

		<!-- Header -->
		<div class="mb-6 text-center">
			<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
				<svg class="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
			</div>
			<h2 class="text-lg font-semibold text-[var(--ui-text)]">Upgrade to Advanced</h2>
			<p class="mt-1 text-sm text-[var(--ui-text-muted)]">ปลดล็อก AI Features ทั้งหมด</p>
		</div>

		<!-- Plan comparison -->
		<div class="mb-6 grid grid-cols-2 gap-3">
			<!-- Basic -->
			<div class="rounded-xl border border-[var(--ui-border)] p-3">
				<div class="mb-2 flex items-center gap-1.5">
					<span class="rounded bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400">Basic</span>
					<span class="text-xs text-[var(--ui-text-muted)]">Free</span>
				</div>
				<ul class="space-y-1 text-[11px] text-[var(--ui-text-muted)]">
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						ER/Flowchart/DFD
					</li>
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						Export/Share
					</li>
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						Cloud Sync
					</li>
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
						AI Features
					</li>
				</ul>
			</div>

			<!-- Advanced -->
			<div class="rounded-xl border-2 border-purple-500 p-3 ring-1 ring-purple-500/20">
				<div class="mb-2 flex items-center gap-1.5">
					<span class="rounded bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">Advanced</span>
				</div>
				<ul class="space-y-1 text-[11px] text-[var(--ui-text-muted)]">
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						Everything in Basic
					</li>
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						AI Features ทั้งหมด
					</li>
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						Priority Support
					</li>
				</ul>
			</div>
		</div>

		<!-- Feature list -->
		<div class="mb-6">
			<p class="mb-2 text-xs font-medium text-[var(--ui-text-secondary)]">AI Features ที่จะปลดล็อก:</p>
			<div class="grid grid-cols-2 gap-1">
				{#each features as feature}
					<div class="flex items-center gap-1.5 text-[11px] text-[var(--ui-text-muted)]">
						<svg class="h-3 w-3 shrink-0 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						{feature}
					</div>
				{/each}
			</div>
		</div>

		<!-- Error -->
		{#if errorMsg}
			<p class="mb-3 text-center text-xs text-red-500">{errorMsg}</p>
		{/if}

		<!-- CTA -->
		<button
			class="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-purple-500/20 transition hover:bg-purple-700 disabled:opacity-50"
			onclick={handleUpgrade}
			disabled={loading}
		>
			{#if loading}
				<span class="flex items-center justify-center gap-2">
					<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
					กำลังเชื่อมต่อ...
				</span>
			{:else}
				Upgrade to Advanced
			{/if}
		</button>

		<p class="mt-3 text-center text-[10px] text-[var(--ui-text-muted)]">
			ชำระผ่าน Stripe อย่างปลอดภัย | ยกเลิกได้ทุกเมื่อ
		</p>
	</div>
</div>
