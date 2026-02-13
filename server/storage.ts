import { songs, type Song, type InsertSong } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getSong(id: string): Promise<Song | undefined>;
  getSongByVideoId(videoId: string): Promise<Song | undefined>;
  getAllSongs(): Promise<Song[]>;
  createSong(song: InsertSong): Promise<Song>;
  updateSong(id: string, updates: Partial<InsertSong>): Promise<Song | undefined>;
  deleteSong(id: string): Promise<boolean>;
  isAvailable(): boolean;
}

export class DatabaseStorage implements IStorage {
  isAvailable(): boolean {
    return db !== null;
  }

  async getSong(id: string): Promise<Song | undefined> {
    if (!db) return undefined;
    const [song] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, id));
    return song || undefined;
  }

  async getSongByVideoId(videoId: string): Promise<Song | undefined> {
    if (!db) return undefined;
    const [song] = await db
      .select()
      .from(songs)
      .where(eq(songs.videoId, videoId));
    return song || undefined;
  }

  async getAllSongs(): Promise<Song[]> {
    if (!db) return [];
    return await db
      .select()
      .from(songs)
      .orderBy(desc(songs.downloadedAt));
  }

  async createSong(song: InsertSong): Promise<Song> {
    if (!db) throw new Error("Database not available");
    const [created] = await db
      .insert(songs)
      .values(song)
      .returning();
    return created;
  }

  async updateSong(id: string, updates: Partial<InsertSong>): Promise<Song | undefined> {
    if (!db) return undefined;
    const [updated] = await db
      .update(songs)
      .set(updates)
      .where(eq(songs.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSong(id: string): Promise<boolean> {
    if (!db) return false;
    const result = await db
      .delete(songs)
      .where(eq(songs.id, id))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
