/**
 * File System Access API utilities for auto-saving diagrams
 * Supported browsers: Chrome 86+, Edge 86+
 */

export interface DiagramFileHandle {
	handle: FileSystemFileHandle;
	fileName: string;
	lastSaved: number;
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemSupported(): boolean {
	return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
}

/**
 * Show save file picker and get a file handle
 */
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
		// User cancelled the picker
		if ((err as Error).name === 'AbortError') {
			return null;
		}
		console.error('Error picking save location:', err);
		throw err;
	}
}

/**
 * Write diagram data to file handle
 */
export async function writeToFile(
	fileHandle: DiagramFileHandle,
	data: object
): Promise<void> {
	try {
		// Create a writable stream
		const writable = await fileHandle.handle.createWritable();

		// Write the file content
		await writable.write(JSON.stringify(data, null, 2));

		// Close the file and write the contents to disk
		await writable.close();

		// Update last saved timestamp
		fileHandle.lastSaved = Date.now();
	} catch (err) {
		console.error('Error writing to file:', err);
		throw err;
	}
}

/**
 * Read diagram data from file handle
 */
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

/**
 * Request permission to read/write file
 */
export async function verifyPermission(
	fileHandle: FileSystemFileHandle,
	readWrite: boolean = true
): Promise<boolean> {
	const options: FileSystemHandlePermissionDescriptor = {
		mode: readWrite ? 'readwrite' : 'read'
	};

	// Check if permission was already granted
	if ((await fileHandle.queryPermission(options)) === 'granted') {
		return true;
	}

	// Request permission
	if ((await fileHandle.requestPermission(options)) === 'granted') {
		return true;
	}

	return false;
}

/**
 * Open file picker and load diagram
 */
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
