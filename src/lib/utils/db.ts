const DB_NAME = 'asistente_db';
const DB_VERSION = 2;
const STORE_INSTANTANEAS = 'instantaneas';
const STORE_SESSIONS = 'sessions';

export interface SerializedInstantanea {
    id: string;
    name: string;
    timestamp: number;
    data: Record<string, ArrayBufferLike | number[]>;
    visible: boolean;
    color: string;
    source: 'manual' | 'secuencial';
    metric: string;
    offsetY: number;
    // Fase 1j: nuevos campos
    tags?: {
        ubicacion?: string;
        posicion?: string;
        custom: string[];
    };
    sessionId?: string;
    metadata?: {
        sampleRate: number;
        fftSize: number;
        averagingDepth: number;
    };
}

export interface SerializedSession {
    id: string;
    name: string;
    venue?: string;
    event?: string;
    createdAt: number;
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
        request.onupgradeneeded = (event) => {
            const db = request.result;
            const oldVersion = event.oldVersion;

            // v1: crear store de instantáneas
            if (oldVersion < 1) {
                if (!db.objectStoreNames.contains(STORE_INSTANTANEAS)) {
                    db.createObjectStore(STORE_INSTANTANEAS, { keyPath: 'id' });
                }
            }
            // v2: crear store de sessions
            if (oldVersion < 2) {
                if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
                    db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
                }
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

// ─── Instantáneas CRUD ───

export async function saveInstantanea(item: SerializedInstantanea): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_INSTANTANEAS, 'readwrite');
        tx.objectStore(STORE_INSTANTANEAS).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadAllInstantaneas(): Promise<SerializedInstantanea[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_INSTANTANEAS, 'readonly');
        const request = tx.objectStore(STORE_INSTANTANEAS).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteInstantanea(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_INSTANTANEAS, 'readwrite');
        tx.objectStore(STORE_INSTANTANEAS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ─── Sessions CRUD (Fase 1k) ───

export async function saveSession(item: SerializedSession): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SESSIONS, 'readwrite');
        tx.objectStore(STORE_SESSIONS).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function loadAllSessions(): Promise<SerializedSession[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SESSIONS, 'readonly');
        const request = tx.objectStore(STORE_SESSIONS).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteSession(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SESSIONS, 'readwrite');
        tx.objectStore(STORE_SESSIONS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
