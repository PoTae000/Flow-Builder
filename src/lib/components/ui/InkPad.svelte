<script lang="ts">
	let { disabled = false, onconvert }: { disabled?: boolean; onconvert: (file: File) => void } = $props();
	type Point = { x: number; y: number; pressure: number };
	let canvas: HTMLCanvasElement;
	let strokes = $state<Point[][]>([]);
	let pointer: number | null = null;
	let finger = $state(false);
	function point(event: PointerEvent): Point {
		const rect = canvas.getBoundingClientRect();
		return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height, pressure: event.pointerType === 'pen' ? event.pressure || 0.5 : 0.5 };
	}
	function redraw() {
		const ctx = canvas.getContext('2d'); if (!ctx) return;
		ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.strokeStyle = '#171717'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
		for (const stroke of strokes) for (let i = 0; i < stroke.length; i++) {
			const a = stroke[Math.max(0, i - 1)], b = stroke[i];
			ctx.lineWidth = 1.5 + b.pressure * 2.5;
			ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + (i === 0 ? 0.01 : 0), b.y); ctx.stroke();
		}
	}
	function start(event: PointerEvent) {
		if (disabled || pointer !== null || event.button !== 0 || (event.pointerType === 'touch' && !finger)) return;
		event.preventDefault(); canvas.setPointerCapture(event.pointerId); pointer = event.pointerId;
		strokes.push([point(event)]); redraw();
	}
	function move(event: PointerEvent) {
		if (pointer !== event.pointerId) return;
		const samples = event.getCoalescedEvents?.();
		for (const sample of samples?.length ? samples : [event]) strokes[strokes.length - 1].push(point(sample));
		redraw();
	}
	function end(event: PointerEvent) { if (pointer === event.pointerId) { pointer = null; } }
	function convert() {
		redraw(); canvas.toBlob(blob => { if (blob) onconvert(new File([blob], 'handwritten-diagram.png', { type: 'image/png' })); }, 'image/png');
	}
</script>

<div class="flex flex-col gap-3">
	<p class="text-xs text-[var(--ui-text-secondary)]">วาดกล่อง เส้นลูกศร และเขียนข้อความด้วย Apple Pencil แล้วแปลงเป็นแผนภาพ ตรวจผลก่อนนำไปใช้ได้</p>
	<div class="flex flex-wrap items-center gap-2 text-xs">
		<button disabled={disabled || !strokes.length} onclick={() => { strokes.pop(); redraw(); }} class="rounded border border-[var(--ui-border)] px-3 py-1.5 disabled:opacity-40">ย้อนกลับ</button>
		<button disabled={disabled || !strokes.length} onclick={() => { strokes = []; redraw(); }} class="rounded border border-[var(--ui-border)] px-3 py-1.5 disabled:opacity-40">ล้างภาพ</button>
		<label class="ml-auto flex items-center gap-2"><input type="checkbox" bind:checked={finger} />วาดด้วยนิ้ว</label>
	</div>
	<canvas bind:this={canvas} width="1200" height="900" aria-label="พื้นที่วาดแผนภาพด้วยปากกา" class="w-full rounded-lg border border-[var(--ui-border)] bg-white" style="touch-action:none;aspect-ratio:4/3;" onpointerdown={start} onpointermove={move} onpointerup={end} onpointercancel={end}></canvas>
	<button disabled={disabled || !strokes.length} onclick={convert} class="rounded-lg bg-[var(--ui-accent)] px-4 py-2 text-sm text-[var(--ui-accent-text)] disabled:opacity-40">{disabled ? 'กำลังประมวลผล…' : 'แปลงภาพวาดด้วย AI'}</button>
</div>
