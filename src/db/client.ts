import * as SQLite from 'expo-sqlite';

// Open the database synchronously
export const db = SQLite.openDatabaseSync('sleep_app.db');

export interface SleepLog {
  id: number;
  bedtime: string;
  wake_time: string;
  duration: number;
  /** 寝起き評価 (1: 良い, 0: 悪い, null: 未設定) */
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

    // Migration v1: Migrate mood values from 3 options (0: Good, 1: Normal, 2: Bad)
    // to 2 options (1: Good, 0: Bad). Normal(1) and Good(0) are merged into Good(1).
    try {
      const versionResult = db.getFirstSync<{ user_version: number }>('PRAGMA user_version;');
      const currentVersion = versionResult?.user_version ?? 0;
      if (currentVersion < 1) {
        db.execSync(`
          -- Step 1: Temporarily shift old 'Good' (0) to 99
          UPDATE sleep_logs SET mood = 99 WHERE mood = 0;
          -- Step 2: Convert old 'Bad' (2) to new 'Bad' (0)
          UPDATE sleep_logs SET mood = 0 WHERE mood = 2;
          -- Step 3: Convert old 'Good' (99) to new 'Good' (1)
          UPDATE sleep_logs SET mood = 1 WHERE mood = 99;
          -- Note: Old 'Normal' (1) is already 1, which now represents 'Good'
          PRAGMA user_version = 1;
        `);
        console.log('[DB] Migration v1: converted mood to 2-option system (Good: 1, Bad: 0).');
      }
    } catch (migError) {
      console.warn('[DB] Migration v1 failed:', migError);
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
