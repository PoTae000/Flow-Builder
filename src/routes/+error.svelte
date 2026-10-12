<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="min-h-screen flex items-center justify-center bg-[var(--ui-bg,#f8fafc)] text-[var(--ui-text,#1e293b)]">
	<div class="text-center px-6">
		<h1 class="text-6xl font-bold mb-4 text-[var(--ui-text-muted,#94a3b8)]">
			{$page.status}
		</h1>
		<p class="text-lg mb-8">
			{$page.error?.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด'}
		</p>
		<a
			href="/"
			class="inline-block px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
		>
			กลับหน้าหลัก
		</a>
	</div>
</div>
