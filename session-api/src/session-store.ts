// ============================================================================
// CALTEX Session API - Session Store
// In-memory + filesystem session management with auto-cleanup
// ============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from './logger';
import { config } from './config';

const log = createLogger('session-store');

export interface SessionRecord {
  id: string;                   // Unique session ID (UUID)
  status: 'waiting_qr' | 'waiting_pairing' | 'waiting_connect' | 'connected' | 'expired' | 'failed';
  phoneNumber?: string;
  pairingCode?: string;
  qrCode?: string;              // Base64 data URL of QR image
  createdAt: number;
  lastActiveAt: number;
  connectedAt?: number;
  creds?: any;                  // WhatsApp credentials after connection
  sessionData?: Record<string, any>; // Full session data (all auth files)
}

class SessionStore {
  private sessions: Map<string, SessionRecord> = new Map();
  private sessionsDir: string;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.sessionsDir = config.sessionsDir;
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
    this.startCleanup();
  }

  /** Create a new session record */
  create(phoneNumber?: string): SessionRecord {
    const id = uuidv4();
    const record: SessionRecord = {
      id,
      status: 'waiting_qr',
      phoneNumber,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    this.sessions.set(id, record);
    log.info({ sessionId: id, phoneNumber }, 'Session created');
    return record;
  }

  /** Get a session by ID */
  get(id: string): SessionRecord | undefined {
    return this.sessions.get(id);
  }

  /** Update a session record */
  update(id: string, partial: Partial<SessionRecord>): SessionRecord | undefined {
    const record = this.sessions.get(id);
    if (!record) return undefined;
    Object.assign(record, partial, { lastActiveAt: Date.now() });
    this.sessions.set(id, record);
    return record;
  }

  /** Delete a session and its files */
  delete(id: string): boolean {
    const record = this.sessions.get(id);
    if (!record) return false;

    // Remove auth directory
    const authDir = join(this.sessionsDir, id);
    if (existsSync(authDir)) {
      try {
        rmSync(authDir, { recursive: true, force: true });
      } catch (err) {
        log.error({ err, sessionId: id }, 'Failed to remove session directory');
      }
    }

    this.sessions.delete(id);
    log.info({ sessionId: id }, 'Session deleted');
    return true;
  }

  /** List all active sessions */
  list(): SessionRecord[] {
    return Array.from(this.sessions.values());
  }

  /** Get the auth directory path for a session */
  getAuthDir(sessionId: string): string {
    const dir = join(this.sessionsDir, sessionId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /** Export session data as a JSON string (for user download) */
  exportSession(id: string): string | null {
    const authDir = join(this.sessionsDir, id);
    if (!existsSync(authDir)) return null;

    const data: Record<string, any> = {};
    try {
      const files = readdirSync(authDir);
      for (const file of files) {
        const filePath = join(authDir, file);
        const stat = statSync(filePath);
        if (stat.isFile()) {
          try {
            const content = readFileSync(filePath, 'utf-8');
            data[file] = JSON.parse(content);
          } catch {
            // skip non-JSON
          }
        }
      }
    } catch (err) {
      log.error({ err, sessionId: id }, 'Failed to export session');
      return null;
    }

    return JSON.stringify(data);
  }

  /** Validate that a session has valid credentials */
  validate(id: string): { valid: boolean; reason?: string } {
    const record = this.sessions.get(id);
    if (!record) return { valid: false, reason: 'Session not found' };

    const authDir = join(this.sessionsDir, id);
    if (!existsSync(authDir)) return { valid: false, reason: 'Auth directory not found' };

    const credsFile = join(authDir, 'creds.json');
    if (!existsSync(credsFile)) return { valid: false, reason: 'Credentials file not found' };

    try {
      const creds = JSON.parse(readFileSync(credsFile, 'utf-8'));
      if (!creds.me || !creds.me.id) {
        return { valid: false, reason: 'Invalid credentials — missing device identity' };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: 'Corrupted credentials file' };
    }
  }

  /** Clean up expired sessions */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, record] of this.sessions) {
      const age = now - record.lastActiveAt;
      if (age > config.sessionExpiryMs) {
        log.info({ sessionId: id, ageMs: age }, 'Cleaning up expired session');
        this.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.info({ cleaned, remaining: this.sessions.size }, 'Session cleanup completed');
    }
    return cleaned;
  }

  /** Start the periodic cleanup timer */
  private startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, config.cleanupIntervalMs);

    // Don't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /** Stop cleanup timer (for graceful shutdown) */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

// Singleton instance
export const sessionStore = new SessionStore();
