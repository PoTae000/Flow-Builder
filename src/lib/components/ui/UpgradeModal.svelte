<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import PromptPayCheckout from './PromptPayCheckout.svelte';
	import { onMount } from 'svelte';

	let { embedded = false, onsignin, onsubscribe, onorderchange }: { embedded?: boolean; onsignin?: () => void; onsubscribe?: () => void; onorderchange?: (active: boolean, amount?: number) => void } = $props();
	let loading = $state(false);
	let checking = $state(false);
	let order = $state<{ id: string; amount: number; qrImage: string; receiverName: string; expiresAt: string } | null>(null);
	let orderStatus = $state('pending');
	$effect(() => { onorderchange?.(!!order, order?.amount); });
	let slipFile = $state<File | null>(null);
	let errorMsg = $state('');
	let payment = $state<{ available: boolean; provider?: string; amount?: number; currency?: string; interval?: string; intervalCount?: number; testMode?: boolean } | null>(null);
	async function refreshPayment() {
		try {
			const response = await fetch('/api/stripe/config');
			payment = response.ok ? await response.json() : { available: false };
		} catch { payment = { available: false }; }
	}
	onMount(() => {
		void refreshPayment();
		const timer = setInterval(() => { void refreshPayment(); }, 30_000);
		const refresh = () => { if (!document.hidden) void refreshPayment(); };
		document.addEventListener('visibilitychange', refresh);
		return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
	});
	const priceText = $derived(payment?.amount !== undefined && payment.currency
		? new Intl.NumberFormat('th-TH', { style: 'currency', currency: payment.currency.toUpperCase() }).format(payment.amount / 100)
		: '');
	const intervalText = $derived(({ month: 'เดือน', year: 'ปี', week: 'สัปดาห์', day: 'วัน' } as Record<string, string>)[payment?.interval ?? ''] ?? '');

	async function submitSlip() {
        if (!order || !slipFile || checking) return;
        const token = sessionStorage.getItem('er-diagram:id-token');
        if (!token) { if (onsignin) onsignin(); else ui.loginRequested = true; return; }
        checking = true;
        errorMsg = '';
        try {
            const form = new FormData();
            form.append('id', order.id);
            form.append('slip', slipFile);
            const response = await fetch('/api/payments/verify-slip', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'ตรวจสลิปไม่สำเร็จ กรุณาลองใหม่');
            orderStatus = data.status;
            if (data.status === 'paid') {
                const planResponse = await fetch('/api/user/plan', { headers: { Authorization: `Bearer ${token}` } });
                if (planResponse.ok) {
                    const plan = await planResponse.json();
                    auth.updatePlan(plan.plan, plan.isAdmin, plan.planExpiresAt);
                }
                slipFile = null;
            }
        } catch (err) { errorMsg = err instanceof Error ? err.message : 'ตรวจสลิปไม่สำเร็จ'; }
        finally { checking = false; }
    }
    function chooseSlip(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4_194_304) {
            errorMsg = 'ใช้สลิป JPG, PNG หรือ WebP ไม่เกิน 4 MB';
            slipFile = null;
            input.value = '';
            return;
        }
        errorMsg = '';
        slipFile = file;
    }
	function close() {
		ui.showUpgradeModal = false;
	}

	async function handleUpgrade() {
		if (!embedded && onsubscribe) { onsubscribe(); return; }
		loading = true;
		errorMsg = '';

		try {
			const token = sessionStorage.getItem('er-diagram:id-token');
			if (!token) {
				if (onsignin) onsignin(); else ui.loginRequested = true;
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
				if (res.status === 401 && onsignin) onsignin();
				const data: any = await res.json().catch(() => ({}));
				throw new Error(data.message || 'ไม่สามารถสร้าง checkout session ได้');
			}

			const data = await res.json();
			if (data.order) { order = data.order; orderStatus = 'pending'; }
			else if (data.url) {
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
<div class={embedded ? 'w-full' : 'fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm'} onkeydown={(e) => { if (e.key === 'Escape') close(); }}>
	<div class={embedded ? 'w-full' : 'relative mx-4 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-6 shadow-2xl'}>

		{#if !embedded}
		<button
			class="absolute right-4 top-4 rounded-lg p-1 text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
			onclick={close}
			aria-label="Close"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>


		<div class="mb-6 text-center">
			<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--ui-border-light)] bg-[var(--ui-bg-secondary)]">
				<svg class="h-6 w-6 text-[var(--ui-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
			</div>
			<h2 class="text-lg font-semibold text-[var(--ui-text)]">สมัคร Pro</h2>
			<p class="mt-1 text-sm text-[var(--ui-text-muted)]">ปลดล็อก AI Features ทั้งหมด</p>
			{#if payment?.available}
				<p class="mt-2 text-sm font-medium text-[var(--ui-text)]">{priceText} / {payment.intervalCount === 1 ? '' : payment.intervalCount}{intervalText}</p>
				<p class="mt-1 text-xs text-[var(--ui-text-muted)]">สแกน QR พร้อมเพย์ {priceText} ใช้งาน 1 เดือน ไม่ตัดเงินอัตโนมัติ</p>
				{#if payment.testMode}<p class="mt-1 text-xs text-amber-500">โหมดทดสอบ ยังไม่มีการเรียกเก็บเงินจริง</p>{/if}
			{:else if payment}
				<p class="mt-2 text-xs text-[var(--ui-text-muted)]">ยังไม่เปิดรับชำระเงิน</p>
			{/if}
		</div>


		{/if}
		{#if !order && !embedded}
		<div class="mb-6 grid grid-cols-2 gap-3">

			<div class="rounded-xl border border-[var(--ui-border)] p-3">
				<div class="mb-2 flex items-center gap-1.5">
					<span class="rounded bg-[var(--ui-bg-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--ui-text-secondary)]">Basic</span>
					<span class="text-xs text-[var(--ui-text-muted)]">Free</span>
				</div>
				<ul class="space-y-1 text-[11px] text-[var(--ui-text-muted)]">
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-[var(--ui-text-secondary)]" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						ER/Flowchart/DFD
					</li>
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-[var(--ui-text-secondary)]" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						Export/Share
					</li>
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-[var(--ui-text-secondary)]" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						Cloud Sync
					</li>
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
						AI Features
					</li>
				</ul>
			</div>


			<div class="rounded-xl border border-[var(--ui-text-secondary)] bg-[var(--ui-bg-secondary)] p-3">
				<div class="mb-2 flex items-center gap-1.5">
					<span class="rounded bg-[var(--ui-bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--ui-text-secondary)]">Pro</span>
				</div>
				<ul class="space-y-1 text-[11px] text-[var(--ui-text-muted)]">
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-[var(--ui-text-secondary)]" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						Everything in Basic
					</li>
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-[var(--ui-text-secondary)]" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						AI Features ทั้งหมด
					</li>
					<li class="flex items-center gap-1">
						<svg class="h-3 w-3 text-[var(--ui-text-secondary)]" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						Priority Support
					</li>
				</ul>
			</div>
		</div>


		<div class="mb-6">
			<p class="mb-2 text-xs font-medium text-[var(--ui-text-secondary)]">AI Features ที่จะปลดล็อก:</p>
			<div class="grid grid-cols-2 gap-1">
				{#each features as feature}
					<div class="flex items-center gap-1.5 text-[11px] text-[var(--ui-text-muted)]">
						<svg class="h-3 w-3 shrink-0 text-[var(--ui-text-secondary)]" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
						{feature}
					</div>
				{/each}
			</div>
		</div>


		{/if}
		{#if order}
            {#if orderStatus === 'paid'}
                <div class="rounded-lg border border-[var(--ui-border)] p-4 text-center"><p class="font-medium text-green-500">ชำระสำเร็จ เปิด Pro แล้ว</p><a href="/" class="mt-3 inline-block text-sm text-[var(--ui-text-secondary)] underline">กลับไปพื้นที่วาด</a></div>
            {:else if orderStatus === 'expired'}
                <p>รายการหมดอายุ หากชำระแล้ว กรุณาติดต่อผู้ดูแล</p>
                <button onclick={() => { order = null; }}>สร้างรายการใหม่</button>
            {:else}
                <PromptPayCheckout {order} accepting={payment?.available === true} busy={checking} file={slipFile} onselect={chooseSlip} onsubmit={submitSlip} />
            {/if}
        {/if}
		{#if errorMsg}
			<p class="mb-3 text-center text-xs text-red-500">{errorMsg}</p>
		{/if}


		{#if !order}
		<button
			class="w-full rounded-xl bg-[var(--ui-accent)] px-4 py-3 text-sm font-medium text-[var(--ui-accent-text)] transition hover:opacity-90 disabled:opacity-50"
			onclick={handleUpgrade}
			disabled={loading || (embedded && !payment?.available)}
		>
			{#if loading}
				<span class="flex items-center justify-center gap-2">
					<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
					กำลังเชื่อมต่อ...
				</span>
			{:else}
				{!embedded ? 'สมัคร Pro' : payment?.available ? `ชำระ ${priceText} ด้วยพร้อมเพย์` : payment ? 'ยังไม่เปิดรับชำระเงิน' : 'กำลังตรวจสอบ...'}
			{/if}
		</button>

		{/if}
		{#if !embedded}
		<p class="mt-3 text-center text-[10px] text-[var(--ui-text-muted)]">
			สแกนพร้อมเพย์ในหน้านี้ | เปิด Pro หลังตรวจสลิปสำเร็จ
		</p>
		{/if}
	</div>
</div>
