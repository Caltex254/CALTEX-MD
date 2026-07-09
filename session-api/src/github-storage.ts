// ============================================================================
// CALTEX MD - GitHub Credential Storage
// Stores WhatsApp session credentials in a private GitHub repo so they survive
// Render free-tier restarts (which have no persistent disk).
//
// Used by:
//   - session-api: saves credentials here after successful WhatsApp pairing
//   - bot: restores credentials here on startup before connecting
//
// Repo structure:
//   sessions/CALTEX-XXXX-XXXX.json  ->  { files: { "creds.json": "...", ... }, meta: {...} }
// ============================================================================

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface StoredSession {
  caltexSessionId: string;
  phoneNumber?: string;
  createdAt: number;
  files: Record<string, string>;  // filename -> base64 content
  meta: {
    baileysVersion?: string;
    [k: string]: any;
  };
}

const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const GH_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'Caltex254';
const GH_REPO_NAME = process.env.GITHUB_REPO_NAME || 'caltex-sessions';
const GH_BRANCH = process.env.GITHUB_BRANCH || 'main';

function authHeaders(): Record<string, string> {
  return {
    'Authorization': `token ${GH_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'caltex-md',
  };
}

function repoApiBase(): string {
  return `https://api.github.com/repos/${GH_REPO_OWNER}/${GH_REPO_NAME}`;
}

export function isGithubStorageConfigured(): boolean {
  return !!GH_TOKEN && !!GH_REPO_OWNER && !!GH_REPO_NAME;
}

// ---------------------------------------------------------------------------
// UPLOAD: read all files from an auth directory and store them as a single
// JSON file in the GitHub repo, keyed by the CALTEX session id.
// ---------------------------------------------------------------------------
export async function uploadSessionToGithub(
  caltexSessionId: string,
  authDir: string,
  meta: { phoneNumber?: string; baileysVersion?: string } = {}
): Promise<{ commitSha: string; fileCount: number }> {
  if (!isGithubStorageConfigured()) {
    throw new Error('GitHub storage not configured (set GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME)');
  }
  if (!existsSync(authDir)) {
    throw new Error(`Auth directory does not exist: ${authDir}`);
  }

  const files: Record<string, string> = {};
  const entries = readdirSync(authDir);
  for (const file of entries) {
    try {
      const content = readFileSync(join(authDir, file));
      files[file] = content.toString('base64');
    } catch (err: any) {
      // skip unreadable files
    }
  }

  if (!files['creds.json']) {
    throw new Error('creds.json missing from auth directory — cannot upload incomplete session');
  }

  const payload: StoredSession = {
    caltexSessionId,
    phoneNumber: meta.phoneNumber,
    createdAt: Date.now(),
    files,
    meta: {
      baileysVersion: meta.baileysVersion,
      fileCount: Object.keys(files).length,
    },
  };

  const path = `sessions/${caltexSessionId}.json`;
  const content = Buffer.from(JSON.stringify(payload, null, 2)).toString('base64');

  // Check if file already exists (to get its SHA for update vs create)
  let existingSha: string | undefined;
  try {
    const resp = await fetch(`${repoApiBase()}/contents/${path}?ref=${GH_BRANCH}`, {
      headers: authHeaders(),
    });
    if (resp.ok) {
      const data = await resp.json() as any;
      existingSha = data.sha;
    }
  } catch {
    // ignore — treat as create
  }

  const body: any = {
    message: `chore: store session ${caltexSessionId} (${Object.keys(files).length} files)`,
    content,
    branch: GH_BRANCH,
  };
  if (existingSha) body.sha = existingSha;

  const resp = await fetch(`${repoApiBase()}/contents/${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub PUT failed: HTTP ${resp.status} ${text.slice(0, 300)}`);
  }

  const data = await resp.json() as any;
  return {
    commitSha: data.commit?.sha || '',
    fileCount: Object.keys(files).length,
  };
}

// ---------------------------------------------------------------------------
// DOWNLOAD: fetch a session's credentials from GitHub by CALTEX session id
// and write them to a local auth directory.
// ---------------------------------------------------------------------------
export async function downloadSessionFromGithub(
  caltexSessionId: string,
  targetAuthDir: string
): Promise<{ fileCount: number; phoneNumber?: string }> {
  if (!isGithubStorageConfigured()) {
    throw new Error('GitHub storage not configured');
  }

  const path = `sessions/${caltexSessionId}.json`;
  const resp = await fetch(`${repoApiBase()}/contents/${path}?ref=${GH_BRANCH}`, {
    headers: authHeaders(),
  });

  if (resp.status === 404) {
    throw new Error(`Session ${caltexSessionId} not found in GitHub repo`);
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub GET failed: HTTP ${resp.status} ${text.slice(0, 300)}`);
  }

  const data = await resp.json() as any;
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  const payload = JSON.parse(content) as StoredSession;

  if (!payload.files || !payload.files['creds.json']) {
    throw new Error('Stored session is missing creds.json — corrupted or incomplete');
  }

  // Ensure target directory exists
  if (!existsSync(targetAuthDir)) {
    mkdirSync(targetAuthDir, { recursive: true });
  }

  let count = 0;
  for (const [filename, base64content] of Object.entries(payload.files)) {
    const filePath = join(targetAuthDir, filename);
    const fileContent = Buffer.from(base64content, 'base64');
    writeFileSync(filePath, fileContent);
    count++;
  }

  return {
    fileCount: count,
    phoneNumber: payload.phoneNumber,
  };
}

// ---------------------------------------------------------------------------
// CHECK: does a session exist in GitHub for the given CALTEX id?
// ---------------------------------------------------------------------------
export async function sessionExistsInGithub(caltexSessionId: string): Promise<boolean> {
  if (!isGithubStorageConfigured()) return false;
  const path = `sessions/${caltexSessionId}.json`;
  try {
    const resp = await fetch(`${repoApiBase()}/contents/${path}?ref=${GH_BRANCH}`, {
      headers: authHeaders(),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
