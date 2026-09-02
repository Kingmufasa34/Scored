import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import type { Config } from '../config.js';

/**
 * Persists the account connections the user makes through the sign-in page
 * (currently the Realtime Trains credentials) to a gitignored JSON file under
 * the data dir. The Gmail token is stored separately at cfg.gmail.tokenPath by
 * the OAuth flow.
 */
export interface Connection {
  rtt?: { username: string; password: string };
}

function file(cfg: Config): string {
  return path.join(cfg.dataDir, 'connection.json');
}

export async function readConnection(cfg: Config): Promise<Connection> {
  try {
    return JSON.parse(await fs.readFile(file(cfg), 'utf8')) as Connection;
  } catch {
    return {};
  }
}

export async function writeConnection(cfg: Config, conn: Connection): Promise<void> {
  await fs.mkdir(cfg.dataDir, { recursive: true });
  await fs.writeFile(file(cfg), JSON.stringify(conn, null, 2), 'utf8');
  // Best-effort: keep the secrets file owner-only.
  await fs.chmod(file(cfg), 0o600).catch(() => {});
}

/** RTT creds come from the sign-in page first, falling back to env. */
export async function resolveRttCreds(
  cfg: Config,
): Promise<{ username: string; password: string } | null> {
  const conn = await readConnection(cfg);
  if (conn.rtt?.username && conn.rtt.password) return conn.rtt;
  if (cfg.rtt.username && cfg.rtt.password) {
    return { username: cfg.rtt.username, password: cfg.rtt.password };
  }
  return null;
}

export function gmailConnected(cfg: Config): boolean {
  return existsSync(cfg.gmail.tokenPath);
}
