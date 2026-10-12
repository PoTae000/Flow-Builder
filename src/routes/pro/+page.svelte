<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte';
	import { initGoogleAuth, renderGoogleButton, isTokenValid, isGoogleAuthAvailable } from '$lib/utils/google-auth';
	import UpgradeModal from '$lib/components/ui/UpgradeModal.svelte';
	let priceAmount = $state(24900);
	let paymentActive = $state(false);
	let mounted = $state(false);
	let googleButton = $state<HTMLDivElement | null>(null);
	let requestLogin = $state(false);
	const signedIn = $derived.by(() => {
		const user = auth.user;
		return mounted && !!user && isTokenValid();
	});
	onMount(() => { mounted = true; initGoogleAuth();
		void fetch('/api/stripe/config').then(r => r.json()).then(c => { if (Number.isSafeInteger(c.amount) && c.amount > 0) priceAmount = c.amount; }).catch(() => {});
	});
	$effect(() => {
		if (googleButton && auth.googleReady) {
			try { sessionStorage.setItem('er-diagram:login-return', '/pro'); } catch {}
			renderGoogleButton(googleButton);
		}
	});
	$effect(() => { if (mounted && auth.user && isTokenValid()) requestLogin = false; });
	$effect(() => { if (mounted && !signedIn) void goto('/', { replaceState: true }); });
	const features = [
		{ title: 'จากไอเดีย สู่แผนภาพ', text: 'ให้ AI ช่วยสร้าง ER Diagram, Flowchart และ DFD จากข้อความ รูปภาพ หรือลายมือ', icon: 'M4 5h16v14H4z M8 9h8 M8 13h5' },
		{ title: 'ตรวจงานให้มั่นใจก่อนส่ง', text: 'วิเคราะห์แผนภาพ หาจุดที่ควรแก้ พร้อมคำอธิบายและตัวช่วยปรับปรุง', icon: 'M9 12l2 2 4-4 M12 3l8 4v5c0 5-8 9-8 9s-8-4-8-9V7z' },
		{ title: 'ต่อยอดเป็นโค้ด', text: 'สร้าง SQL และโค้ด ORM จากแบบฐานข้อมูล ลดงานที่ต้องเขียนซ้ำ', icon: 'M8 7l-5 5 5 5 M16 7l5 5-5 5 M14 4l-4 16' }
	];
</script>

<svelte:head>
	<title>Flow Builder Pro — ออกแบบแผนภาพด้วย AI</title>
	<meta name="description" content="Flow Builder Pro ชำระรายเดือน ใช้ AI ช่วยสร้างและตรวจ ER Diagram, Flowchart และ DFD ชำระด้วย QR พร้อมเพย์ ไม่ตัดเงินอัตโนมัติ" />
</svelte:head>

{#if signedIn}
<div class="pro-page">
	<header class="nav">
		<a href="/" class="brand"><span>Flow Builder</span><small>PRO</small></a>
		<a href="/" class="back">กลับไปพื้นที่วาด <span aria-hidden="true">↗</span></a>
	</header>
	<main>
		<section class="intro">
			<div class="eyebrow"><span></span> สำหรับไอเดียที่อยากไปให้ไกลขึ้น</div>
			<h1>วาดให้น้อยลง<br />สร้างให้<span>ได้มากขึ้น.</span></h1>
			<p class="lead">เครื่องมือเดิมที่คุณคุ้นเคย พร้อม AI ที่ช่วยเปลี่ยนไอเดียเป็นแผนภาพ ตรวจความถูกต้อง และต่อยอดเป็นโค้ด</p>

			<div class="features">
				{#each features as feature}
					<div class="feature"><div class="feature-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={feature.icon}/></svg></div><div><h2>{feature.title}</h2><p>{feature.text}</p></div></div>
				{/each}
			</div>
		</section>
		<aside class="checkout" class:payment-active={paymentActive} aria-label="สมัครสมาชิก Pro">
			<div class="card-heading"><span>FLOW BUILDER PRO</span><span class="pill">ครบทุกฟีเจอร์ AI</span></div>
			<div class="price">{new Intl.NumberFormat('th-TH').format(priceAmount / 100)}<span>บาท / เดือน</span></div>
			<p class="price-note">จ่ายทีละเดือน คุณเลือกต่ออายุเอง</p>
			{#if !paymentActive}<div class="benefits"><p>ใช้ AI กับ ER, Flowchart และ DFD</p><p>นำเข้าจากข้อความ รูปภาพ และลายมือ</p><p>AI Chat วิเคราะห์งาน และสร้างโค้ด</p></div>{/if}
			<div class="payment-panel">
				{#if signedIn && !requestLogin}
					<div class="account"><span class="account-dot"></span>สมัครให้บัญชี <strong>{auth.user?.email}</strong></div>
					<UpgradeModal embedded onorderchange={(active, amount) => { paymentActive = active; if (amount !== undefined) priceAmount = amount; }} onsignin={() => { requestLogin = true; }} />
				{:else}
					<p class="sign-in-title">เข้าสู่ระบบเพื่อสมัคร Pro</p>
					<p class="sign-in-note">สิทธิ์ Pro จะผูกกับบัญชี Google ของคุณ</p>
					<div class="google" bind:this={googleButton}></div>
					{#if mounted && !isGoogleAuthAvailable()}<p class="sign-in-note">ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาติดต่อผู้ดูแล</p>{:else if mounted && !auth.googleReady}<p class="sign-in-note">กำลังเตรียมการเข้าสู่ระบบ…</p>{/if}
				{/if}
			</div>
			<p class="footnote">ชำระด้วย QR พร้อมเพย์ในหน้านี้<br />แนบสลิปเพื่อยืนยันยอดและเปิด Pro ไม่มีการตัดเงินอัตโนมัติ</p>
		</aside>
	</main>
	<footer><span>เครื่องมือวาดพื้นฐานยังใช้ฟรีได้</span><a href="/">กลับไปสร้างแผนภาพ</a></footer>
</div>
{/if}

<style>
    .pro-page{height:100dvh;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;background:var(--ui-bg);color:var(--ui-text);font-family:var(--font-sans)}
    .nav{max-width:1120px;margin:auto;padding:24px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--ui-border-light)}
    .brand{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:500;text-decoration:none}.brand small{font-size:9px;border:1px solid var(--ui-border);border-radius:4px;color:var(--ui-text-secondary);padding:2px 5px;margin-left:2px;letter-spacing:1px}
    .back{font-size:12px;color:var(--ui-text-secondary)}.back span{margin-left:8px}
    main{max-width:1120px;margin:auto;padding:32px 32px 28px;display:grid;grid-template-columns:minmax(280px,.8fr) minmax(0,1.2fr);gap:48px;align-items:start}
    .eyebrow{color:var(--ui-text-muted);font-size:11px;display:flex;align-items:center;gap:8px;margin-bottom:22px}.eyebrow span{width:4px;height:4px;border-radius:50%;background:var(--ui-text-secondary)}
    h1{font-size:clamp(32px,3.2vw,42px);font-weight:500;line-height:1.3;letter-spacing:-1px;margin:0 0 24px}h1 span{color:var(--ui-text-secondary)}
    .lead{font-size:14px;line-height:1.9;max-width:440px;color:var(--ui-text-secondary)}
    .features{display:grid;gap:26px;margin-top:40px}.feature{display:flex;gap:14px}.feature-icon{width:36px;height:36px;border-radius:8px;background:var(--ui-bg-secondary);border:1px solid var(--ui-border-light);display:grid;place-items:center;flex-shrink:0;color:var(--ui-text-secondary)}
    .feature h2{margin:0 0 5px;font-size:14px;font-weight:500}.feature p{margin:0;color:var(--ui-text-muted);font-size:12px;line-height:1.8}
    .checkout.payment-active .price{font-size:32px;margin-top:10px}.checkout.payment-active .price-note{margin-bottom:12px}.checkout.payment-active .payment-panel{padding-top:12px}.checkout.payment-active .footnote{margin-top:10px}
    .checkout{border:1px solid var(--ui-border);border-radius:14px;background:var(--ui-bg);padding:28px;position:sticky;top:24px}
    .card-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:10px;letter-spacing:1.4px;color:var(--ui-text-secondary)}.pill{font-size:9px;letter-spacing:0;color:var(--ui-text-secondary);background:var(--ui-bg-secondary);border:1px solid var(--ui-border-light);padding:4px 7px;border-radius:5px}
    .price{font-size:58px;font-weight:500;letter-spacing:-1.5px;line-height:1.3;margin-top:22px}.price span{font-size:12px;font-weight:300;letter-spacing:0;color:var(--ui-text-muted);margin-left:12px}.price-note{font-size:12px;color:var(--ui-text-muted);margin:4px 0 24px}
    .benefits{display:grid;gap:10px;padding:0 0 24px;border-bottom:1px solid var(--ui-border-light)}.benefits p{margin:0;font-size:12px;color:var(--ui-text-secondary);display:flex;gap:10px;align-items:center}.benefits p:before{content:'';width:4px;height:4px;background:var(--ui-text-muted);border-radius:50%}
    .payment-panel{padding-top:24px}.account{font-size:10px;color:var(--ui-text-muted);display:flex;gap:6px;align-items:center;margin-bottom:16px;flex-wrap:wrap}.account strong{font-weight:400;overflow-wrap:anywhere;color:var(--ui-text-secondary)}.account-dot{width:4px;height:4px;background:var(--ui-text-secondary);border-radius:50%;flex-shrink:0}
    .sign-in-title{text-align:center;font-size:13px;margin:0 0 8px}.sign-in-note{text-align:center;font-size:11px;color:var(--ui-text-muted)}.google{display:flex;justify-content:center;min-height:40px;margin:20px 0}.footnote{font-size:10px;line-height:1.8;text-align:center;color:var(--ui-text-muted);margin:18px 0 0}
    footer{max-width:1120px;margin:auto;padding:12px 32px;display:flex;justify-content:space-between;gap:16px;border-top:1px solid var(--ui-border-light);font-size:11px;color:var(--ui-text-muted)}a:focus-visible{outline:2px solid var(--ui-text-secondary);outline-offset:5px;border-radius:4px}
    @media(max-width:950px){main{gap:24px;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr)}.checkout{padding:22px}.pill{display:none}}
    @media(max-width:650px){.nav{padding:18px 20px}.brand{font-size:14px}.back{font-size:11px}main{grid-template-columns:1fr;gap:30px;padding:32px 20px}.intro h1{font-size:36px}.lead{font-size:13px}.features{gap:18px;margin-top:24px}.feature p{display:none}.feature-icon{width:30px;height:30px}.feature{align-items:center}.feature h2{margin:0;font-size:13px}.checkout{position:static;padding:24px}.pill{display:inline-block}.price{font-size:52px}footer{padding:22px 20px;flex-wrap:wrap}}
</style>
