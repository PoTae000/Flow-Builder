import type { DiagramMeta, DiagramData } from '$lib/types/session';

const DB_NAME = 'er-offline';
const STORE_NAME = 'sync-queue';
const DB_VERSION = 1;

export interface QueueEntry {
	id?: number;
	operation: 'push' | 'delete' | 'active';
	diagramId: string;
	data?: DiagramData;
	meta?: DiagramMeta;
	timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function enqueue(entry: Omit<QueueEntry, 'id'>): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).add(entry);
		tx.oncomplete = () => { db.close(); resolve(); };
		tx.onerror = () => { db.close(); reject(tx.error); };
	});
}

export async function dequeueAll(): Promise<QueueEntry[]> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const req = tx.objectStore(STORE_NAME).getAll();
		req.onsuccess = () => { db.close(); resolve(req.result); };
		req.onerror = () => { db.close(); reject(req.error); };
	});
}

export async function clearQueue(): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).clear();
		tx.oncomplete = () => { db.close(); resolve(); };
		tx.onerror = () => { db.close(); reject(tx.error); };
	});
}

export async function getQueueSize(): Promise<number> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const req = tx.objectStore(STORE_NAME).count();
		req.onsuccess = () => { db.close(); resolve(req.result); };
		req.onerror = () => { db.close(); reject(req.error); };
	});
}
