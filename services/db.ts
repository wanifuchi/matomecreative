/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'matome-creative-gallery';
const STORE_NAME = 'saved-items';
const DB_VERSION = 2; // Incremented version

export interface SavedItem { // Renamed from SavedImage
    id: number;
    file: File;
    createdAt: Date;
}

let dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

const initDB = () => {
    if (dbPromise) {
        return dbPromise;
    }
    dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
            if (oldVersion < 2) {
                 // If the old store exists from v1, delete it.
                if (db.objectStoreNames.contains('saved-images')) {
                    db.deleteObjectStore('saved-images');
                }
                 // Create the new store
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    store.createIndex('createdAt', 'createdAt');
                }
            }
        },
    });
    return dbPromise;
};

export const saveItemToGallery = async (itemFile: File): Promise<number> => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const id = await store.add({
        file: itemFile,
        createdAt: new Date(),
    });
    await tx.done;
    return id as number;
};

export const getAllItemsFromGallery = async (): Promise<SavedItem[]> => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const items = await store.getAll();
    // Sort by newest first
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export const deleteItemFromGallery = async (id: number): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await store.delete(id);
    await tx.done;
};