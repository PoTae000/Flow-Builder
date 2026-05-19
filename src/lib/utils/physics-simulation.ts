import type { Position } from '$lib/types/geometry';

export interface PhysicsBody {
	id: string;
	x: number;
	y: number;
	vx: number;
	vy: number;
	fx: number;
	fy: number;
	pinned: boolean;
}

export interface Spring {
	fromId: string;
	toId: string;
	restLength: number;
}

export class PhysicsSimulation {
	bodies = new Map<string, PhysicsBody>();
	springs: Spring[] = [];

	private readonly REPULSION = 5000;
	private readonly SPRING_K = 0.005;
	private readonly DEFAULT_REST = 200;
	private readonly DAMPING = 0.85;
	private readonly MAX_VELOCITY = 20;
	private readonly MIN_VELOCITY = 0.5;

	addBody(id: string, x: number, y: number) {
		if (this.bodies.has(id)) return;
		this.bodies.set(id, { id, x, y, vx: 0, vy: 0, fx: 0, fy: 0, pinned: false });
	}

	removeBody(id: string) {
		this.bodies.delete(id);
		this.springs = this.springs.filter(s => s.fromId !== id && s.toId !== id);
	}

	setSprings(springs: Spring[]) {
		this.springs = springs;
	}

	pin(id: string) {
		const b = this.bodies.get(id);
		if (b) {
			b.pinned = true;
			b.vx = 0;
			b.vy = 0;
		}
	}

	unpin(id: string) {
		const b = this.bodies.get(id);
		if (b) b.pinned = false;
	}

	moveBody(id: string, x: number, y: number) {
		const b = this.bodies.get(id);
		if (b) {
			b.x = x;
			b.y = y;
		}
	}

	/** Run one simulation step. Returns true if still active (any body moving). */
	step(): boolean {
		const bodies = [...this.bodies.values()];

		// Reset forces
		for (const b of bodies) {
			b.fx = 0;
			b.fy = 0;
		}

		// Repulsion: all pairs (Coulomb-like)
		for (let i = 0; i < bodies.length; i++) {
			for (let j = i + 1; j < bodies.length; j++) {
				const a = bodies[i];
				const b = bodies[j];
				const dx = a.x - b.x;
				const dy = a.y - b.y;
				const distSq = dx * dx + dy * dy;
				const dist = Math.sqrt(distSq) || 1;
				const force = this.REPULSION / distSq;
				const fx = (dx / dist) * force;
				const fy = (dy / dist) * force;
				a.fx += fx;
				a.fy += fy;
				b.fx -= fx;
				b.fy -= fy;
			}
		}

		// Attraction: spring pairs (Hooke's law)
		for (const spring of this.springs) {
			const a = this.bodies.get(spring.fromId);
			const b = this.bodies.get(spring.toId);
			if (!a || !b) continue;
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const dist = Math.sqrt(dx * dx + dy * dy) || 1;
			const displacement = dist - spring.restLength;
			const force = this.SPRING_K * displacement;
			const fx = (dx / dist) * force;
			const fy = (dy / dist) * force;
			a.fx += fx;
			a.fy += fy;
			b.fx -= fx;
			b.fy -= fy;
		}

		// Integrate + clamp
		let maxV = 0;
		for (const b of bodies) {
			if (b.pinned) continue;
			b.vx = (b.vx + b.fx) * this.DAMPING;
			b.vy = (b.vy + b.fy) * this.DAMPING;

			// Clamp velocity
			const v = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
			if (v > this.MAX_VELOCITY) {
				b.vx = (b.vx / v) * this.MAX_VELOCITY;
				b.vy = (b.vy / v) * this.MAX_VELOCITY;
			}

			b.x += b.vx;
			b.y += b.vy;

			maxV = Math.max(maxV, Math.abs(b.vx), Math.abs(b.vy));
		}

		return maxV > this.MIN_VELOCITY;
	}

	getPositions(): Map<string, Position> {
		const result = new Map<string, Position>();
		for (const [id, b] of this.bodies) {
			result.set(id, { x: b.x, y: b.y });
		}
		return result;
	}
}
