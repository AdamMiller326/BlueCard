// IndexedDB persistence (via idb). One save slot per device.
import { openDB, type IDBPDatabase } from 'idb';
import type { GameState } from '../core/state.ts';
import type { PackDependency } from '../packs/schema.ts';

export interface StoredSave {
  state: GameState;
  packs: PackDependency[];
  /** Set after the save is exported as a transfer; the mon lives elsewhere now. */
  dormant: boolean;
}

const DB_NAME = 'dm-vpet';
const STORE = 'kv';
const SAVE_KEY = 'save';

let dbp: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  dbp ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore(STORE);
    },
  });
  return dbp;
}

export async function loadSave(): Promise<StoredSave | undefined> {
  return (await db()).get(STORE, SAVE_KEY) as Promise<StoredSave | undefined>;
}

export async function writeSave(save: StoredSave): Promise<void> {
  await (await db()).put(STORE, save, SAVE_KEY);
}

export async function clearSave(): Promise<void> {
  await (await db()).delete(STORE, SAVE_KEY);
}

/** Ask the browser not to evict our storage (helps iOS when installed). */
export async function requestPersistence(): Promise<boolean> {
  return navigator.storage?.persist ? navigator.storage.persist() : false;
}
