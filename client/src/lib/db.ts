import type { SongMetadata } from "@shared/schema";

const DB_NAME = "MusicDownloaderDB";
const DB_VERSION = 1;
const STORE_NAME = "songs";

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open database"));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("videoId", "videoId", { unique: true });
        store.createIndex("artist", "artist", { unique: false });
        store.createIndex("downloadedAt", "downloadedAt", { unique: false });
      }
    };
  });
}

export async function saveSong(song: SongMetadata): Promise<void> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(song);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Failed to save song"));
  });
}

export async function getSong(id: string): Promise<SongMetadata | undefined> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Failed to get song"));
  });
}

export async function getSongByVideoId(videoId: string): Promise<SongMetadata | undefined> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("videoId");
    const request = index.get(videoId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Failed to get song by video ID"));
  });
}

export async function getAllSongs(): Promise<SongMetadata[]> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const songs = request.result;
      songs.sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime());
      resolve(songs);
    };
    request.onerror = () => reject(new Error("Failed to get all songs"));
  });
}

export async function deleteSong(id: string): Promise<void> {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Failed to delete song"));
  });
}

export async function updateSongMetadata(id: string, metadata: Partial<SongMetadata>): Promise<void> {
  const song = await getSong(id);
  if (!song) throw new Error("Song not found");
  
  const updatedSong = { ...song, ...metadata };
  await saveSong(updatedSong);
}
