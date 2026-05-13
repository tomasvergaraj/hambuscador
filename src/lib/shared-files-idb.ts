// ============================================================================
// shared-files-idb — handoff de archivos entre el Service Worker y el cliente.
// ----------------------------------------------------------------------------
// Cuando el usuario comparte fotos desde el SO al PWA (share_target POST), el
// SW intercepta el POST a /api/share, extrae los Files del FormData y los
// guarda acá. Después redirige a /agregar?share=1; el cliente al montar lee
// los archivos y los pasa al PhotoUploader.
//
// Indexed DB es la única API que permite persistir Blobs/Files entre SW y
// cliente sin re-serializar (a diferencia de localStorage o un message channel
// efímero). Misma origin garantiza el handoff.
//
// Pattern: una sola key "current" — cada share reemplaza el set anterior. Si
// el cliente lo lee y consume, lo borra (single-use). Si el SO comparte de
// nuevo antes de consumir, el primer set se pierde — aceptable, lo último
// gana.
// ============================================================================

const DB_NAME = "hambuscador-share";
const STORE = "files";
const KEY = "current";
const VERSION = 1;

type StoredEntry = { files: File[]; createdAt: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Persiste un set de archivos compartidos. Reemplaza el set anterior.
 * Llamado desde el Service Worker (mismo origin, mismo IDB).
 */
export async function putSharedFiles(files: File[]): Promise<void> {
  if (files.length === 0) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ files, createdAt: Date.now() }, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Lee + borra los archivos compartidos pendientes (single-use). Llamado
 * desde el cliente al montar /agregar?share=1. Si no hay nada (ej. share
 * sin SW), retorna lista vacía.
 *
 * Defensa: ignora entradas más viejas que 5min — un share viejo cacheado
 * sin consumir no debería pegar a una sesión nueva.
 */
export async function consumeSharedFiles(): Promise<File[]> {
  if (typeof indexedDB === "undefined") return [];
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return [];
  }
  try {
    const entry = await new Promise<StoredEntry | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const getReq = store.get(KEY);
      getReq.onsuccess = () => {
        const val = getReq.result as StoredEntry | undefined;
        store.delete(KEY);
        resolve(val);
      };
      getReq.onerror = () => reject(getReq.error);
    });
    if (!entry || !Array.isArray(entry.files)) return [];
    if (Date.now() - entry.createdAt > 5 * 60 * 1000) return [];
    return entry.files.filter((f) => f instanceof File && f.type.startsWith("image/"));
  } finally {
    db.close();
  }
}
