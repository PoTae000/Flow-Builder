
export async function downscaleImage(
	file: File,
	maxDim = 1400,
	quality = 0.85
): Promise<File> {
	if (typeof document === 'undefined') return file;
	
	if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) return file;

	try {
		const bitmap = await loadBitmap(file);
		const { width, height } = bitmap;

		
		if (Math.max(width, height) <= maxDim) {
			close(bitmap);
			return file;
		}

		const scale = maxDim / Math.max(width, height);
		const w = Math.round(width * scale);
		const h = Math.round(height * scale);

		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			close(bitmap);
			return file;
		}
		
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, w, h);
		ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
		close(bitmap);

		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, 'image/jpeg', quality)
		);
		if (!blob) return file;

		
		if (blob.size >= file.size) return file;

		const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
		return new File([blob], name, { type: 'image/jpeg' });
	} catch {
		return file;
	}
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
	if (typeof createImageBitmap === 'function') {
		try {
			return await createImageBitmap(file);
		} catch {
			// fall through to <img> decode
		}
	}
	const url = URL.createObjectURL(file);
	try {
		const img = new Image();
		img.src = url;
		await img.decode();
		return img;
	} finally {
		URL.revokeObjectURL(url);
	}
}

function close(bitmap: ImageBitmap | HTMLImageElement) {
	if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
}
