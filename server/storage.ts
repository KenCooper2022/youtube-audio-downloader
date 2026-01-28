/**
 * DATABASE STORAGE LAYER
 * 
 * This module provides the data access layer for the songs table.
 * All database operations are performed through Drizzle ORM.
 * 
 * SQL Operations Performed:
 * - SELECT * FROM songs WHERE id = ? (getSong)
 * - SELECT * FROM songs WHERE video_id = ? (getSongByVideoId)
 * - SELECT * FROM songs ORDER BY downloaded_at DESC (getAllSongs)
 * - INSERT INTO songs (...) VALUES (...) RETURNING * (createSong)
 * - UPDATE songs SET ... WHERE id = ? RETURNING * (updateSong)
 * - DELETE FROM songs WHERE id = ? (deleteSong)
 */

import { songs, type Song, type InsertSong } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

/**
 * Storage interface defining all database operations.
 * This interface allows for easy testing with mock implementations.
 */
export interface IStorage {
  // Retrieve a single song by primary key
  getSong(id: string): Promise<Song | undefined>;
  
  // Retrieve a song by YouTube video ID
  getSongByVideoId(videoId: string): Promise<Song | undefined>;
  
  // Retrieve all songs, ordered by download date (newest first)
  getAllSongs(): Promise<Song[]>;
  
  // Insert a new song record
  createSong(song: InsertSong): Promise<Song>;
  
  // Update an existing song's metadata
  updateSong(id: string, updates: Partial<InsertSong>): Promise<Song | undefined>;
  
  // Delete a song by primary key
  deleteSong(id: string): Promise<boolean>;
}

/**
 * DatabaseStorage - PostgreSQL implementation of IStorage
 * 
 * Uses Drizzle ORM to execute type-safe SQL queries against PostgreSQL.
 * All methods are async and return Promises.
 */
export class DatabaseStorage implements IStorage {
  /**
   * GET SONG BY ID
   * 
   * SQL: SELECT * FROM songs WHERE id = $1 LIMIT 1
   * 
   * @param id - Primary key (UUID)
   * @returns Song record or undefined if not found
   */
  async getSong(id: string): Promise<Song | undefined> {
    const [song] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, id));
    return song || undefined;
  }

  /**
   * GET SONG BY VIDEO ID
   * 
   * SQL: SELECT * FROM songs WHERE video_id = $1 LIMIT 1
   * 
   * Used to check if a video has already been downloaded.
   * The video_id column has a UNIQUE constraint.
   * 
   * @param videoId - YouTube video identifier
   * @returns Song record or undefined if not found
   */
  async getSongByVideoId(videoId: string): Promise<Song | undefined> {
    const [song] = await db
      .select()
      .from(songs)
      .where(eq(songs.videoId, videoId));
    return song || undefined;
  }

  /**
   * GET ALL SONGS
   * 
   * SQL: SELECT * FROM songs ORDER BY downloaded_at DESC
   * 
   * Returns all songs sorted by download date (newest first).
   * Used to populate the Library view.
   * 
   * @returns Array of all Song records
   */
  async getAllSongs(): Promise<Song[]> {
    return await db
      .select()
      .from(songs)
      .orderBy(desc(songs.downloadedAt));
  }

  /**
   * CREATE SONG
   * 
   * SQL: INSERT INTO songs (id, video_id, title, artist, album, genre, thumbnail, file_path)
   *      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
   *      RETURNING *
   * 
   * Inserts a new song record. The downloaded_at timestamp is auto-generated.
   * Will fail if video_id already exists (UNIQUE constraint).
   * 
   * @param song - Song data to insert
   * @returns The created Song record with all fields populated
   */
  async createSong(song: InsertSong): Promise<Song> {
    const [created] = await db
      .insert(songs)
      .values(song)
      .returning();
    return created;
  }

  /**
   * UPDATE SONG
   * 
   * SQL: UPDATE songs SET column1 = $1, column2 = $2, ...
   *      WHERE id = $3
   *      RETURNING *
   * 
   * Updates specific fields of an existing song record.
   * Only the fields provided in the updates object are modified.
   * 
   * @param id - Primary key of song to update
   * @param updates - Partial song data with fields to update
   * @returns Updated Song record or undefined if not found
   */
  async updateSong(id: string, updates: Partial<InsertSong>): Promise<Song | undefined> {
    const [updated] = await db
      .update(songs)
      .set(updates)
      .where(eq(songs.id, id))
      .returning();
    return updated || undefined;
  }

  /**
   * DELETE SONG
   * 
   * SQL: DELETE FROM songs WHERE id = $1
   * 
   * Removes a song record from the database.
   * Note: This does not delete the physical MP3 file.
   * 
   * @param id - Primary key of song to delete
   * @returns true if a record was deleted, false otherwise
   */
  async deleteSong(id: string): Promise<boolean> {
    const result = await db
      .delete(songs)
      .where(eq(songs.id, id))
      .returning();
    return result.length > 0;
  }
}

// Singleton instance for use throughout the application
export const storage = new DatabaseStorage();
