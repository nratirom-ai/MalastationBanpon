import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
  getDocFromServer,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Product, DailyCountRecord, LineSyncSettings, UserPresence } from '../types/inventory';
import { INITIAL_PRODUCTS, INITIAL_DAILY_COUNTS } from '../data/initialData';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Validate connection per skill guidelines
(async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (e: any) {
    // Offline / permission is handled gracefully
    if (e?.message?.includes('the client is offline')) {
      console.warn('Firestore offline / verify connection');
    }
  }
})();

// Real-time listener for Products across all web browsers and web apps
export function subscribeToProducts(
  onUpdate: (products: Product[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const productsCol = collection(db, 'products');

  return onSnapshot(
    productsCol,
    async (snapshot) => {
      if (snapshot.empty || snapshot.size < 50) {
        // If Firestore is empty or has old demo data (< 50 items), seed the full 139 CSV catalog
        try {
          const batch = writeBatch(db);
          for (const p of INITIAL_PRODUCTS) {
            batch.set(doc(db, 'products', p.id), p, { merge: true });
          }
          await batch.commit();
          // The snapshot listener will trigger again with the full 139 seeded products
        } catch (err) {
          console.warn('Failed to auto-seed initial products to Firestore:', err);
          onUpdate(INITIAL_PRODUCTS);
        }
      } else {
        const list: Product[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Product);
        });
        // Sort by order or name
        list.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          return (a.order ?? 9999) - (b.order ?? 9999);
        });
        onUpdate(list);
      }
    },
    (err) => {
      console.error('Firestore subscribeToProducts error:', err);
      if (onError) onError(err);
    }
  );
}

// Real-time listener for Daily Counts across all web browsers and web apps
export function subscribeToDailyCounts(
  onUpdate: (counts: DailyCountRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const countsCol = collection(db, 'daily_counts');

  return onSnapshot(
    countsCol,
    async (snapshot) => {
      if (snapshot.empty) {
        // Seed initial daily counts if empty
        try {
          const batch = writeBatch(db);
          for (const record of INITIAL_DAILY_COUNTS) {
            const docId = `${record.productId}_${record.date}`;
            batch.set(doc(db, 'daily_counts', docId), record);
          }
          await batch.commit();
        } catch (err) {
          console.warn('Failed to auto-seed daily counts to Firestore:', err);
          onUpdate(INITIAL_DAILY_COUNTS);
        }
      } else {
        const list: DailyCountRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as DailyCountRecord);
        });
        onUpdate(list);
      }
    },
    (err) => {
      console.error('Firestore subscribeToDailyCounts error:', err);
      if (onError) onError(err);
    }
  );
}

// Real-time listener for LINE synchronization settings
export function subscribeToLineSettings(
  onUpdate: (settings: LineSyncSettings) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const settingDoc = doc(db, 'settings', 'line');

  return onSnapshot(
    settingDoc,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as LineSyncSettings);
      }
    },
    (err) => {
      console.error('Firestore subscribeToLineSettings error:', err);
      if (onError) onError(err);
    }
  );
}

// Save single product to Firestore
export async function saveProductToFirestore(product: Product): Promise<void> {
  const ref = doc(db, 'products', product.id);
  await setDoc(ref, product, { merge: true });
}

// Batch save multiple products (for reordering or bulk import)
export async function batchSaveProductsToFirestore(products: Product[]): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (let j = 0; j < chunk.length; j++) {
      const p = { ...chunk[j], order: i + j + 1 };
      batch.set(doc(db, 'products', p.id), p, { merge: true });
    }
    await batch.commit();
  }
}

// Delete product from Firestore
export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const ref = doc(db, 'products', productId);
  await deleteDoc(ref);
}

// Save single daily count record to Firestore
export async function saveDailyCountToFirestore(record: DailyCountRecord): Promise<void> {
  const docId = `${record.productId}_${record.date}`;
  const ref = doc(db, 'daily_counts', docId);
  await setDoc(ref, record, { merge: true });
}

// Batch save multiple daily count records (e.g. daily reset to 0 or undo)
export async function batchSaveDailyCountsToFirestore(records: DailyCountRecord[]): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const r of chunk) {
      const docId = `${r.productId}_${r.date}`;
      batch.set(doc(db, 'daily_counts', docId), r, { merge: true });
    }
    await batch.commit();
  }
}

// Save LINE sync settings
export async function saveLineSettingsToFirestore(settings: LineSyncSettings): Promise<void> {
  const ref = doc(db, 'settings', 'line');
  await setDoc(ref, {
    ...settings,
    lastSyncTimestamp: new Date().toISOString()
  }, { merge: true });
}

// Record stock log for audit trail & line notifications
export async function recordStockLog(
  type: 'count' | 'alert' | 'line_sync' | 'undo' | 'product_change',
  message: string,
  meta?: { productId?: string; productName?: string; date?: string }
): Promise<void> {
  try {
    const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const ref = doc(db, 'stock_logs', id);
    await setDoc(ref, {
      id,
      timestamp: new Date().toISOString(),
      date: meta?.date || new Date().toISOString().split('T')[0],
      type,
      productId: meta?.productId || '',
      productName: meta?.productName || '',
      message
    });
  } catch (e) {
    console.warn('Failed to record stock log:', e);
  }
}

// Real-time listener for Online Collaborators
export function subscribeToOnlineCollaborators(
  onUpdate: (collaborators: UserPresence[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const presenceCol = collection(db, 'presence');

  return onSnapshot(
    presenceCol,
    (snapshot) => {
      const now = Date.now();
      const list: UserPresence[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as UserPresence;
        // Filter active within last 2 minutes (120,000 ms)
        const lastActiveTime = new Date(data.lastActive).getTime();
        if (!isNaN(lastActiveTime) && now - lastActiveTime < 120000) {
          list.push(data);
        }
      });
      // Sort: active editors first, then by displayName
      list.sort((a, b) => {
        if (a.status === 'editing' && b.status !== 'editing') return -1;
        if (b.status === 'editing' && a.status !== 'editing') return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Firestore subscribeToOnlineCollaborators notice:', err);
      if (onError) onError(err);
    }
  );
}

// Update presence heartbeat
export async function updateCollaboratorPresence(presence: UserPresence): Promise<void> {
  try {
    const ref = doc(db, 'presence', presence.uid);
    await setDoc(ref, {
      ...presence,
      lastActive: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to update collaborator presence:', err);
  }
}

// Remove presence on leave / logout
export async function removeCollaboratorPresence(uid: string): Promise<void> {
  try {
    const ref = doc(db, 'presence', uid);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Failed to remove collaborator presence:', err);
  }
}

