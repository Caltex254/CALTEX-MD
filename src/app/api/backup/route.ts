import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

async function ensureBackupDir() {
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
  } catch {}
}

export const GET = withAuth(async (request: NextRequest) => {
  try {
    await ensureBackupDir();
    const { readdir, stat } = await import('fs/promises');
    const files = await readdir(BACKUP_DIR);

    const backups = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async f => {
          const filePath = path.join(BACKUP_DIR, f);
          const fileStat = await stat(filePath);
          return {
            filename: f,
            size: fileStat.size,
            createdAt: fileStat.birthtime,
          };
        })
    );

    backups.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

    return NextResponse.json({ success: true, data: { backups, total: backups.length } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list backups' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    await ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;

    const [users, groups, settings, commands, plugins, broadcasts, aiSettings] = await Promise.all([
      db.user.findMany(),
      db.group.findMany(),
      db.setting.findMany(),
      db.command.findMany(),
      db.plugin.findMany(),
      db.broadcast.findMany(),
      db.aISettings.findMany(),
    ]);

    const backupData = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      data: { users, groups, settings, commands, plugins, broadcasts, aiSettings },
    };

    const filePath = path.join(BACKUP_DIR, filename);
    await writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      data: { filename, size: Buffer.byteLength(JSON.stringify(backupData)), message: 'Backup created' },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create backup' },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json(
        { success: false, error: 'Backup filename is required' },
        { status: 400 }
      );
    }

    const filePath = path.join(BACKUP_DIR, filename);
    const { readFile } = await import('fs/promises');

    const content = await readFile(filePath, 'utf-8');
    const backupData = JSON.parse(content);

    if (!backupData.data) {
      return NextResponse.json(
        { success: false, error: 'Invalid backup file format' },
        { status: 400 }
      );
    }

    // Restore settings
    if (backupData.data.settings?.length) {
      await Promise.all(
        backupData.data.settings.map((s: any) =>
          db.setting.upsert({
            where: { key: s.key },
            update: { value: s.value, category: s.category },
            create: { key: s.key, value: s.value, category: s.category || 'general' },
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Backup restored successfully', restoredAt: new Date().toISOString() },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to restore backup' },
      { status: 500 }
    );
  }
});
