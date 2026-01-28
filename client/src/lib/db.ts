/**
 * DATABASE API CLIENT
 * 
 * This module provides the client-side interface to the PostgreSQL database
 * via REST API calls. Replaces the previous IndexedDB implementation.
 * 
 * All data is now stored server-side in PostgreSQL, accessed through
 * the /api/songs endpoints.
 * 
 * SQL OPERATIONS (executed on server):
 * - SELECT * FROM songs ORDER BY downloaded_at DESC (getAllSongs)
 * - SELECT * FROM songs WHERE id = $1 (getSong)
 * - SELECT * FROM songs WHERE video_id = $1 (getSongByVideoId)
 * - INSERT INTO songs (...) VALUES (...) RETURNING * (saveSong)
 * - UPDATE songs SET ... WHERE id = $1 RETURNING * (updateSongMetadata)
 * - DELETE FROM songs WHERE id = $1 (deleteSong)
 */

import type { SongMetadata } from "@shared/schema";

/**
 * INITIALIZE DATABASE
 * 
 * No-op function for API compatibility.
 * Previously initialized IndexedDB connection.
 * Now the database is managed server-side in PostgreSQL.
 */
export async function initDB(): Promise<void> {
  // No initialization needed - PostgreSQL is always available
  return Promise.resolve();
}

/**
 * SAVE SONG
 * 
 * Creates a new song record in the database.
 * 
 * API: POST /api/songs
 * SQL: INSERT INTO songs (id, video_id, title, artist, album, genre, thumbnail, file_path)
 *      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
 *      RETURNING *
 * 
 * @param song - Song metadata to save
 */
export async function saveSong(song: SongMetadata): Promise<void> {
  const response = await fetch("/api/songs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(song),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to save song");
  }
}

/**
 * GET SONG BY ID
 * 
 * Retrieves a song by its primary key.
 * 
 * API: GET /api/songs/:id
 * SQL: SELECT * FROM songs WHERE id = $1
 * 
 * @param id - Primary key (UUID)
 * @returns Song record or undefined if not found
 */
export async function getSong(id: string): Promise<SongMetadata | undefined> {
  const response = await fetch(`/api/songs/${encodeURIComponent(id)}`);

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get song");
  }

  return response.json();
}

/**
 * GET SONG BY VIDEO ID
 * 
 * Retrieves a song by its YouTube video ID.
 * Used to check if a video has already been downloaded.
 * 
 * API: GET /api/songs/video/:videoId
 * SQL: SELECT * FROM songs WHERE video_id = $1
 * 
 * @param videoId - YouTube video identifier
 * @returns Song record or undefined if not found
 */
export async function getSongByVideoId(videoId: string): Promise<SongMetadata | undefined> {
  const response = await fetch(`/api/songs/video/${encodeURIComponent(videoId)}`);

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get song");
  }

  return response.json();
}

/**
 * GET ALL SONGS
 * 
 * Retrieves all songs from the database, ordered by download date (newest first).
 * 
 * API: GET /api/songs
 * SQL: SELECT * FROM songs ORDER BY downloaded_at DESC
 * 
 * @returns Array of all song records
 */
export async function getAllSongs(): Promise<SongMetadata[]> {
  const response = await fetch("/api/songs");

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get songs");
  }

  return response.json();
}

/**
 * DELETE SONG
 * 
 * Removes a song record from the database.
 * Note: Does not delete the physical MP3 file on the server.
 * 
 * API: DELETE /api/songs/:id
 * SQL: DELETE FROM songs WHERE id = $1
 * 
 * @param id - Primary key of song to delete
 */
export async function deleteSong(id: string): Promise<void> {
  const response = await fetch(`/api/songs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete song");
  }
}

/**
 * UPDATE SONG METADATA
 * 
 * Updates specific fields of an existing song record.
 * 
 * API: PATCH /api/songs/:id
 * SQL: UPDATE songs SET column1 = $1, column2 = $2, ...
 *      WHERE id = $n
 *      RETURNING *
 * 
 * @param id - Primary key of song to update
 * @param metadata - Partial song data with fields to update
 */
export async function updateSongMetadata(
  id: string,
  metadata: Partial<SongMetadata>
): Promise<void> {
  const response = await fetch(`/api/songs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update song");
  }
}
