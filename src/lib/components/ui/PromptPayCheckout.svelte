<script lang="ts">
	let { order, accepting = true, busy, file, onselect, onsubmit }: {
		accepting?: boolean;
		order: { id: string; qrImage: string; receiverName: string; expiresAt: string; amount: number };
		busy: boolean;
		file: File | null;
		onselect: (event: Event) => void;
		onsubmit: () => void;
	} = $props();
</script>

<div class="payment-grid">
	<section class="qr-pane" aria-label="QR ชำระเงิน">
		{#if accepting}
		<h3>1. สแกนจ่าย {new Intl.NumberFormat('th-TH').format(order.amount / 100)} บาท</h3>
		<img src={order.qrImage} alt={`QR พร้อมเพย์ ${order.amount / 100} บาท`} width="208" height="208" />
		<p class="receiver">ผู้รับ: {order.receiverName}</p>
		<a href={order.qrImage} download={`flow-builder-pro-${order.amount / 100}.png`}>บันทึก QR</a>
		{:else}
		<p class="instruction" role="status">ปิดรับชำระเงินชั่วคราว บริการตรวจสลิปไม่พร้อม หากโอนแล้วให้เก็บสลิปไว้และอย่าโอนซ้ำ</p>
		{/if}
	</section>
	<section class="slip-pane" aria-label="ยืนยันการชำระเงิน">
		<h3>2. แนบสลิปเพื่อเปิด Pro</h3>
		<p class="instruction">ตรวจชื่อผู้รับในแอปธนาคารให้ตรง แล้วแนบสลิปจากรายการที่ชำระสำเร็จ</p>
		<div class="upload">
			<label for="pro-slip">เลือกไฟล์สลิป</label>
			<input id="pro-slip" type="file" accept="image/jpeg,image/png,image/webp" onchange={onselect} disabled={busy} />
			<p class="hint">JPG, PNG หรือ WebP ไม่เกิน 4 MB</p>
		</div>
		{#if file}<p class="filename">{file.name}</p>{/if}
		<button onclick={onsubmit} disabled={busy || !file}>{busy ? 'กำลังตรวจสลิป…' : 'ยืนยันการชำระเงิน'}</button>
		<p class="deadline">ชำระภายใน {new Date(order.expiresAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}<br />ถ้าโอนแล้วตรวจไม่ผ่าน ห้ามโอนซ้ำ</p>
	</section>
</div>
<p class="order-id">คำสั่งซื้อ {order.id}</p>

<style>
	.payment-grid{display:grid;grid-template-columns:208px minmax(0,1fr);gap:20px;align-items:start;color:var(--ui-text)}
	h3{font-size:12px;font-weight:500;margin:0 0 12px;line-height:1.5}.qr-pane{text-align:center}.qr-pane img{display:block;width:208px;height:auto;max-width:100%;border-radius:8px;background:#fff;margin:0 auto}.receiver{font-size:11px;line-height:1.6;margin:10px 0 5px;overflow-wrap:anywhere}.qr-pane a{font-size:11px;color:var(--ui-text-secondary);text-decoration:underline;text-underline-offset:3px}
	.instruction{font-size:11px;line-height:1.8;color:var(--ui-text-secondary);margin:0 0 16px}.upload{padding:12px;border:1px dashed var(--ui-border);border-radius:8px;background:var(--ui-bg-secondary)}.upload label{display:block;font-size:11px;margin-bottom:8px}.upload input{display:block;max-width:100%;width:100%;font-size:10px}.hint{font-size:9px;color:var(--ui-text-muted);margin:7px 0 0}.filename{font-size:10px;overflow-wrap:anywhere;margin:8px 0;color:var(--ui-text-secondary)}
	button{width:100%;margin-top:12px;padding:10px 8px;border-radius:8px;background:var(--ui-accent);color:var(--ui-accent-text);font-size:12px;font-weight:500;transition:opacity .15s}button:hover{opacity:.9}button:disabled{opacity:.45}.deadline{font-size:10px;line-height:1.8;color:var(--ui-text-muted);margin:12px 0 0}.order-id{font-size:9px;overflow-wrap:anywhere;color:var(--ui-text-muted);margin:16px 0 0;padding-top:12px;border-top:1px solid var(--ui-border-light)}
	@media(max-width:1050px) and (min-width:651px){.payment-grid{grid-template-columns:170px minmax(0,1fr);gap:14px}.qr-pane img{width:170px}}
	@media(max-width:650px){.payment-grid{grid-template-columns:1fr;gap:24px}.slip-pane{max-width:340px;width:100%;margin:auto}.qr-pane img{width:208px}}
</style>
