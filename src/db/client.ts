import * as SQLite from 'expo-sqlite';

// Open the database synchronously
export const db = SQLite.openDatabaseSync('sleep_app.db');

export interface SleepLog {
  id: number;
  bedtime: string;
  wake_time: string;
  duration: number;
  mood: number | null;
  memo?: string | null;
}

/**
 * Initializes the SQLite database and ensures that the sleep_logs table exists.
 */
export const initializeDatabase = (): void => {
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS sleep_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bedtime TEXT NOT NULL,
        wake_time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        memo TEXT,
        mood INTEGER
      );
    `);

    // Migration: add mood column to existing tables that lack it
    try {
      db.execSync(`ALTER TABLE sleep_logs ADD COLUMN mood INTEGER;`);
      console.log('[DB] Migration: added mood column.');
    } catch (_) {
      // Column already exists – safe to ignore
    }

    console.log('[DB] Database initialized successfully and sleep_logs table is ready.');
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
};

/**
 * Inserts a new sleep log record into the database.
 */
export const insertSleepLog = (
  bedtime: string,
  wakeTime: string,
  duration: number,
  memo?: string | null,
  mood?: number | null
): void => {
  try {
    db.runSync(
      'INSERT INTO sleep_logs (bedtime, wake_time, duration, memo, mood) VALUES (?, ?, ?, ?, ?)',
      [bedtime, wakeTime, duration, memo ?? null, mood ?? null]
    );
    console.log('[DB] Successfully inserted sleep log:', { bedtime, wakeTime, duration, memo, mood });
  } catch (error) {
    console.error('[DB] Failed to insert sleep log:', error);
    throw error;
  }
};

/**
 * Fetches all sleep logs from the database, ordered by bedtime descending.
 */
export const getAllSleepLogs = (): SleepLog[] => {
  try {
    return db.getAllSync<SleepLog>('SELECT * FROM sleep_logs ORDER BY bedtime DESC');
  } catch (error) {
    console.error('[DB] Failed to fetch sleep logs:', error);
    return [];
  }
};

/**
 * Deletes a specific sleep log record from the database by its ID.
 */
export const deleteSleepLog = (id: number): void => {
  try {
    db.runSync('DELETE FROM sleep_logs WHERE id = ?', [id]);
    console.log('[DB] Successfully deleted sleep log with id:', id);
  } catch (error) {
    console.error('[DB] Failed to delete sleep log:', error);
    throw error;
  }
};

/**
 * Updates a specific sleep log record in the database.
 */
export const updateSleepLog = (
  id: number,
  bedtime: string,
  wakeTime: string,
  duration: number,
  memo?: string | null,
  mood?: number | null
): void => {
  try {
    db.runSync(
      'UPDATE sleep_logs SET bedtime = ?, wake_time = ?, duration = ?, memo = ?, mood = ? WHERE id = ?',
      [bedtime, wakeTime, duration, memo ?? null, mood ?? null, id]
    );
    console.log('[DB] Successfully updated sleep log:', { id, bedtime, wakeTime, duration, memo, mood });
  } catch (error) {
    console.error('[DB] Failed to update sleep log:', error);
    throw error;
  }
};

/**
 * Deletes all sleep logs from the database. (Development helper)
 */
export const deleteAllSleepLogs = (): void => {
  try {
    db.runSync('DELETE FROM sleep_logs');
    console.log('[DB] All sleep logs deleted successfully.');
  } catch (error) {
    console.error('[DB] Failed to delete all sleep logs:', error);
    throw error;
  }
};
