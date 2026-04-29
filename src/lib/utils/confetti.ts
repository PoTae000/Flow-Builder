const COLORS = ['#FFD700', '#3B82F6', '#EF4444', '#22C55E', '#A855F7', '#F97316'];

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	rotation: number;
	rotationSpeed: number;
	color: string;
	size: number;
	gravity: number;
	opacity: number;
}

export function fireConfetti(container: HTMLElement) {
	const canvas = document.createElement('canvas');
	const rect = container.getBoundingClientRect();
	canvas.width = rect.width;
	canvas.height = rect.height;
	canvas.style.position = 'absolute';
	canvas.style.top = '0';
	canvas.style.left = '0';
	canvas.style.pointerEvents = 'none';
	canvas.style.zIndex = '100';
	container.style.position = container.style.position || 'relative';
	container.appendChild(canvas);

	const ctx = canvas.getContext('2d');
	if (!ctx) { canvas.remove(); return; }

	const particles: Particle[] = [];
	const count = 80;
	const cx = canvas.width / 2;
	const cy = canvas.height * 0.3;

	for (let i = 0; i < count; i++) {
		const angle = Math.random() * Math.PI * 2;
		const speed = 3 + Math.random() * 6;
		particles.push({
			x: cx,
			y: cy,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed - 3,
			rotation: Math.random() * 360,
			rotationSpeed: (Math.random() - 0.5) * 10,
			color: COLORS[Math.floor(Math.random() * COLORS.length)],
			size: 4 + Math.random() * 4,
			gravity: 0.12 + Math.random() * 0.05,
			opacity: 1
		});
	}

	const start = performance.now();
	const duration = 2000;

	function animate(now: number) {
		const elapsed = now - start;
		if (elapsed > duration) {
			canvas.remove();
			return;
		}

		ctx!.clearRect(0, 0, canvas.width, canvas.height);
		const progress = elapsed / duration;

		for (const p of particles) {
			p.x += p.vx;
			p.y += p.vy;
			p.vy += p.gravity;
			p.vx *= 0.99;
			p.rotation += p.rotationSpeed;
			p.opacity = 1 - progress;

			ctx!.save();
			ctx!.translate(p.x, p.y);
			ctx!.rotate((p.rotation * Math.PI) / 180);
			ctx!.globalAlpha = p.opacity;
			ctx!.fillStyle = p.color;
			ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
			ctx!.restore();
		}

		requestAnimationFrame(animate);
	}

	requestAnimationFrame(animate);
}
