let storageWarningShown = false;

/**
 * Safe wrapper around localStorage.setItem that catches QuotaExceededError.
 * Shows a one-time warning toast when storage is full.
 */
export function safeSave(key: string, value: string): boolean {
	try {
		localStorage.setItem(key, value);
		return true;
	} catch (e) {
		if (!storageWarningShown) {
			storageWarningShown = true;
			// Show a non-blocking warning — reset flag after 30s so it can show again
			setTimeout(() => { storageWarningShown = false; }, 30_000);

			if (typeof document !== 'undefined') {
				showStorageWarning();
			}
		}
		console.warn('[storage] Failed to save:', key, e);
		return false;
	}
}

function showStorageWarning() {
	const toast = document.createElement('div');
	toast.textContent = 'พื้นที่จัดเก็บเต็ม — ข้อมูลอาจไม่ถูกบันทึก ลองลบ Diagram ที่ไม่ใช้';
	Object.assign(toast.style, {
		position: 'fixed',
		bottom: '80px',
		left: '50%',
		transform: 'translateX(-50%)',
		background: '#dc2626',
		color: '#fff',
		padding: '10px 20px',
		borderRadius: '8px',
		fontSize: '13px',
		zIndex: '9999',
		boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
		transition: 'opacity 0.3s',
		whiteSpace: 'nowrap'
	});
	document.body.appendChild(toast);
	setTimeout(() => {
		toast.style.opacity = '0';
		setTimeout(() => toast.remove(), 300);
	}, 5000);
}
