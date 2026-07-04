// ============================================================================
// CALTEX MD WhatsApp Bot - Session Manager
// Manages WhatsApp sessions with persistence, backup, and restore
// ============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import pino from 'pino';
import type { SessionInfo, SessionBackup } from './types';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino/file',
    options: { destination: join(process.cwd(), 'bot.log') },
  },
}).child({ module: 'session-manager' });

export class SessionManager {
  private sessionsDir: string;
  private backupDir: string;
  private sessionMetadata: Map<string, SessionInfo> = new Map();

  constructor(baseDir?: string) {
    this.sessionsDir = baseDir ?? join(process.cwd(), 'auth_info_baileys');
    this.backupDir = join(process.cwd(), 'backups');

    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }

    this.loadSessionMetadata();
  }

  // ---------------------------------------------------------------------------
  // Metadata Persistence
  // ---------------------------------------------------------------------------
  private loadSessionMetadata(): void {
    const metadataFile = join(this.sessionsDir, 'metadata.json');
    if (existsSync(metadataFile)) {
      try {
        const data = JSON.parse(readFileSync(metadataFile, 'utf-8'));
        for (const [key, value] of Object.entries(data)) {
          this.sessionMetadata.set(key, value as SessionInfo);
        }
        logger.info({ count: this.sessionMetadata.size }, 'Loaded session metadata');
      } catch (err) {
        logger.error({ err }, 'Failed to load session metadata');
      }
    }
  }

  private saveSessionMetadata(): void {
    const metadataFile = join(this.sessionsDir, 'metadata.json');
    const data: Record<string, SessionInfo> = {};
    for (const [key, value] of this.sessionMetadata) {
      data[key] = value;
    }
    writeFileSync(metadataFile, JSON.stringify(data, null, 2));
  }

  private getSessionDir(sessionId: string): string {
    const dir = join(this.sessionsDir, sessionId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  // ---------------------------------------------------------------------------
  // CRUD Operations
  // ---------------------------------------------------------------------------
  async createSession(sessionId: string): Promise<SessionInfo> {
    const sessionDir = this.getSessionDir(sessionId);

    const existing = this.sessionMetadata.get(sessionId);
    if (existing) {
      logger.info({ sessionId }, 'Session already exists, reusing');
      existing.lastActive = Date.now();
      this.saveSessionMetadata();
      return existing;
    }

    const info: SessionInfo = {
      sessionId,
      createdAt: Date.now(),
      lastActive: Date.now(),
      status: 'disconnected',
    };

    this.sessionMetadata.set(sessionId, info);
    this.saveSessionMetadata();

    logger.info({ sessionId }, 'Session created');
    return info;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const sessionDir = join(this.sessionsDir, sessionId);
    if (existsSync(sessionDir)) {
      try {
        rmSync(sessionDir, { recursive: true, force: true });
      } catch (err) {
        logger.error({ err, sessionId }, 'Failed to delete session directory');
        return false;
      }
    }

    const removed = this.sessionMetadata.delete(sessionId);
    if (removed) {
      this.saveSessionMetadata();
    }

    logger.info({ sessionId, removed }, 'Session deleted');
    return true;
  }

  async restoreSession(sessionId: string): Promise<SessionInfo | null> {
    const sessionDir = join(this.sessionsDir, sessionId);
    if (!existsSync(sessionDir)) {
      logger.warn({ sessionId }, 'Cannot restore session - directory not found');
      return null;
    }

    const credsFile = join(sessionDir, 'creds.json');
    if (!existsSync(credsFile)) {
      logger.warn({ sessionId }, 'Cannot restore session - creds.json not found');
      return null;
    }

    const info = this.sessionMetadata.get(sessionId) ?? {
      sessionId,
      createdAt: Date.now(),
      lastActive: Date.now(),
      status: 'disconnected' as const,
    };

    info.lastActive = Date.now();
    info.status = 'disconnected';
    this.sessionMetadata.set(sessionId, info);
    this.saveSessionMetadata();

    logger.info({ sessionId }, 'Session restored');
    return info;
  }

  // ---------------------------------------------------------------------------
  // Export / Import
  // ---------------------------------------------------------------------------
  async exportSession(sessionId: string): Promise<Record<string, any> | null> {
    const sessionDir = join(this.sessionsDir, sessionId);
    if (!existsSync(sessionDir)) {
      logger.warn({ sessionId }, 'Cannot export session - not found');
      return null;
    }

    const data: Record<string, any> = {};

    try {
      const files = readdirSync(sessionDir);
      for (const file of files) {
        const filePath = join(sessionDir, file);
        const stat = statSync(filePath);
        if (stat.isFile()) {
          try {
            const content = readFileSync(filePath, 'utf-8');
            data[file] = JSON.parse(content);
          } catch {
            logger.warn({ file, sessionId }, 'Skipping non-JSON file during export');
          }
        }
      }

      logger.info({ sessionId, fileCount: Object.keys(data).length }, 'Session exported');
      return data;
    } catch (err) {
      logger.error({ err, sessionId }, 'Failed to export session');
      return null;
    }
  }

  async importSession(sessionId: string, data: Record<string, any>): Promise<boolean> {
    const sessionDir = this.getSessionDir(sessionId);

    try {
      for (const [filename, content] of Object.entries(data)) {
        const filePath = join(sessionDir, filename);
        writeFileSync(filePath, JSON.stringify(content, null, 2));
      }

      const info: SessionInfo = {
        sessionId,
        createdAt: this.sessionMetadata.get(sessionId)?.createdAt ?? Date.now(),
        lastActive: Date.now(),
        status: 'disconnected',
      };

      this.sessionMetadata.set(sessionId, info);
      this.saveSessionMetadata();

      logger.info({ sessionId, fileCount: Object.keys(data).length }, 'Session imported');
      return true;
    } catch (err) {
      logger.error({ err, sessionId }, 'Failed to import session');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Backup Operations
  // ---------------------------------------------------------------------------
  async backupAllSessions(): Promise<SessionBackup[]> {
    const backups: SessionBackup[] = [];
    const sessions = this.listSessions();

    for (const sessionId of sessions) {
      try {
        const data = await this.exportSession(sessionId);
        if (data) {
          const backup: SessionBackup = {
            sessionId,
            timestamp: Date.now(),
            data,
          };

          const backupFile = join(this.backupDir, `${sessionId}_${Date.now()}.json`);
          writeFileSync(backupFile, JSON.stringify(backup, null, 2));

          backups.push(backup);
          logger.info({ sessionId }, 'Session backed up');
        }
      } catch (err) {
        logger.error({ err, sessionId }, 'Failed to backup session');
      }
    }

    logger.info({ totalBackups: backups.length }, 'All sessions backed up');
    return backups;
  }

  async restoreFromBackup(backupPath: string): Promise<boolean> {
    if (!existsSync(backupPath)) {
      logger.error({ backupPath }, 'Backup file not found');
      return false;
    }

    try {
      const content = readFileSync(backupPath, 'utf-8');
      const backup: SessionBackup = JSON.parse(content);
      return await this.importSession(backup.sessionId, backup.data);
    } catch (err) {
      logger.error({ err, backupPath }, 'Failed to restore from backup');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Listing & Status
  // ---------------------------------------------------------------------------
  listSessions(): string[] {
    const sessions: string[] = [];

    try {
      const entries = readdirSync(this.sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          const credsPath = join(this.sessionsDir, entry.name, 'creds.json');
          if (existsSync(credsPath)) {
            sessions.push(entry.name);
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to list sessions');
    }

    for (const key of this.sessionMetadata.keys()) {
      if (!sessions.includes(key)) {
        sessions.push(key);
      }
    }

    return [...new Set(sessions)];
  }

  getSessionStatus(sessionId: string): SessionInfo | undefined {
    return this.sessionMetadata.get(sessionId);
  }

  updateSessionStatus(sessionId: string, status: SessionInfo['status'], extra?: Partial<SessionInfo>): void {
    const info = this.sessionMetadata.get(sessionId);
    if (info) {
      info.status = status;
      info.lastActive = Date.now();
      if (extra?.phoneNumber) info.phoneNumber = extra.phoneNumber;
      if (extra?.name) info.name = extra.name;
      this.sessionMetadata.set(sessionId, info);
      this.saveSessionMetadata();
    }
  }

  getAllSessionInfo(): SessionInfo[] {
    return Array.from(this.sessionMetadata.values());
  }

  listBackups(): string[] {
    if (!existsSync(this.backupDir)) return [];
    try {
      return readdirSync(this.backupDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => join(this.backupDir, f));
    } catch {
      return [];
    }
  }
}
