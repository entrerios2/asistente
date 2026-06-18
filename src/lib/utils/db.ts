const DB_NAME = 'asistente_db';
const DB_VERSION = 1;
const STORE_NAME = 'instantaneas';

export interface SerializedInstantanea {
    id: string;
    name: string;
    timestamp: number;
    data: Record<string, ArrayBuffer | number[]>;
    visible: boolean;
    color: string;
    source: 'manual' | 'secuencial';
    metric: string;
    offsetY: number;
}

let cachedDB: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
    if (cachedDB) return Promise.resolve(cachedDB);

    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB no está soportado en este entorno.'));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => {
            cachedDB = request.result;
            // Si la conexión se cierra externamente, limpiar el cache
            cachedDB.onclose = () => { cachedDB = null; };
            resolve(cachedDB);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function saveInstantanea(item: SerializedInstantanea): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadAllInstantaneas(): Promise<SerializedInstantanea[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteInstantanea(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
