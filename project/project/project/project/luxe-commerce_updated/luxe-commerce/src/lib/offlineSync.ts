import { supabase } from '@/lib/supabase';

const DB_NAME = 'PosOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pendingCheckoutQueue';

export interface OfflineSalePayload {
  p_branch_id: string;
  p_cashier_id: string;
  p_customer_id: string | null;
  p_items: Array<{
    product_id: string;
    variant_id?: string | null;
    quantity: number;
    unit_price: number;
    batch_number?: string | null;
    serial_number?: string | null;
  }>;
  p_discount_amount: number;
  p_tax_amount: number;
  p_payment_method: string;
}

export interface OfflineRecord {
  id?: number;
  payload: OfflineSalePayload;
  timestamp: number;
}

/**
 * Opens or initializes the browser IndexedDB instance.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a sales transaction to IndexedDB when offline.
 */
export async function queueOfflineSale(payload: OfflineSalePayload): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: OfflineRecord = { payload, timestamp: Date.now() };

    const request = store.add(record);

    tx.oncomplete = () => resolve(request.result as number);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieves the current count of unsynced offline sales.
 */
export async function getPendingOfflineCount(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return 0;
  }
}

/**
 * Uploads all queued offline transactions to Supabase RPC.
 */
export async function syncOfflineSales(): Promise<{ synced: number; failed: number }> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch (err) {
    console.error('Failed to open IndexedDB for sync:', err);
    return { synced: 0, failed: 0 };
  }

  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const getAllRequest = store.getAll();

  return new Promise((resolve) => {
    getAllRequest.onsuccess = async () => {
      const records: OfflineRecord[] = getAllRequest.result || [];
      if (records.length === 0) {
        resolve({ synced: 0, failed: 0 });
        return;
      }

      let synced = 0;
      let failed = 0;

      for (const record of records) {
        try {
          const { error } = await supabase.rpc('process_pos_checkout', record.payload);

          if (!error) {
            // Delete record from IndexedDB upon successful sync
            const deleteTx = db.transaction(STORE_NAME, 'readwrite');
            const deleteStore = deleteTx.objectStore(STORE_NAME);
            if (record.id !== undefined) {
              deleteStore.delete(record.id);
            }
            synced++;
          } else {
            console.error(`Failed to sync offline record ID ${record.id}:`, error.message);
            failed++;
          }
        } catch (err) {
          console.error(`Error processing offline record ID ${record.id}:`, err);
          failed++;
        }
      }

      resolve({ synced, failed });
    };

    getAllRequest.onerror = () => resolve({ synced: 0, failed: 0 });
  });
}

/**
 * Global event listener to trigger auto-sync when browser restores connection.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOfflineSales().then((result) => {
      if (result.synced > 0) {
        console.log(`[Offline Sync Engine] Successfully auto-synced ${result.synced} offline sale(s).`);
      }
    });
  });
}