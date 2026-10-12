



interface FileSystemHandlePermissionDescriptor {
	mode?: 'read' | 'readwrite';
}
declare global {
	interface FileSystemFileHandle {
		queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
		requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
	}
	interface Window {
		showSaveFilePicker(options?: unknown): Promise<FileSystemFileHandle>;
		showOpenFilePicker(options?: unknown): Promise<FileSystemFileHandle[]>;
	}
}

export interface DiagramFileHandle {
	handle: FileSystemFileHandle;
	fileName: string;
	lastSaved: number;
}


export function isInIframe(): boolean {
	try {
		return window.self !== window.top;
	} catch {
		
		return true;
	}
}


export function isFileSystemSupported(): boolean {
	if (isInIframe()) return false;
	return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
}


export function downloadAsFile(data: object, filename: string = 'diagram.erd'): void {
	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}


export function openFileViaInput(): Promise<{ data: object; fileName: string } | null> {
	return new Promise((resolve, reject) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.erd,.json';
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return resolve(null);
			if (file.size > 10 * 1024 * 1024) return reject(new Error('File too large (max 10MB)'));
			const reader = new FileReader();
			reader.onload = () => {
				try {
					const data = JSON.parse(reader.result as string);
					resolve({ data, fileName: file.name });
				} catch {
					reject(new Error('Invalid JSON file'));
				}
			};
			reader.onerror = () => reject(reader.error);
			reader.readAsText(file);
		};
		input.click();
	});
}


export async function pickSaveLocation(suggestedName: string = 'diagram.erd'): Promise<DiagramFileHandle | null> {
	if (!isFileSystemSupported()) {
		return null;
	}

	try {
		const handle = await window.showSaveFilePicker({
			suggestedName,
			types: [
				{
					description: 'ER Diagram Files',
					accept: {
						'application/json': ['.erd', '.json']
					}
				}
			]
		});

		return {
			handle,
			fileName: handle.name,
			lastSaved: Date.now()
		};
	} catch (err) {
		
		if ((err as Error).name === 'AbortError') {
			return null;
		}
		console.error('Error picking save location:', err);
		throw err;
	}
}


export async function writeToFile(
	fileHandle: DiagramFileHandle,
	data: object
): Promise<void> {
	try {
		
		const writable = await fileHandle.handle.createWritable();

		
		await writable.write(JSON.stringify(data, null, 2));

		
		await writable.close();

		
		fileHandle.lastSaved = Date.now();
	} catch (err) {
		console.error('Error writing to file:', err);
		throw err;
	}
}


export async function readFromFile(
	handle: FileSystemFileHandle
): Promise<object | null> {
	try {
		const file = await handle.getFile();
		const text = await file.text();
		return JSON.parse(text);
	} catch (err) {
		console.error('Error reading from file:', err);
		return null;
	}
}


export async function verifyPermission(
	fileHandle: FileSystemFileHandle,
	readWrite: boolean = true
): Promise<boolean> {
	const options: FileSystemHandlePermissionDescriptor = {
		mode: readWrite ? 'readwrite' : 'read'
	};

	
	if ((await fileHandle.queryPermission(options)) === 'granted') {
		return true;
	}

	
	if ((await fileHandle.requestPermission(options)) === 'granted') {
		return true;
	}

	return false;
}


export async function pickAndOpenFile(): Promise<{ handle: FileSystemFileHandle; data: object } | null> {
	if (!isFileSystemSupported()) {
		return null;
	}

	try {
		const [handle] = await window.showOpenFilePicker({
			types: [
				{
					description: 'ER Diagram Files',
					accept: {
						'application/json': ['.erd', '.json']
					}
				}
			],
			multiple: false
		});

		const data = await readFromFile(handle);
		if (!data) {
			throw new Error('Failed to read file');
		}

		return { handle, data };
	} catch (err) {
		if ((err as Error).name === 'AbortError') {
			return null;
		}
		console.error('Error opening file:', err);
		throw err;
	}
}
