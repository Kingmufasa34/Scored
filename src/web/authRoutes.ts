import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import express, { type Request } from 'express';
import type { Config } from '../config.js';
import { log } from '../logger.js';
import { buildWebOAuthClient, GMAIL_SCOPES } from '../email/gmail.js';
import { basicAuth, fetchJson } from '../util/http.js';
import { authStatus } from './deps.js';
import { readConnection, writeConnection } from './connection.js';

/** Short-lived CSRF state tokens for the OAuth round-trip. */
const pendingStates = new Map<string, number>();
const STATE_TTL_MS = 10 * 60 * 1000;

function newState(): string {
  const s = crypto.randomBytes(16).toString('hex');
  pendingStates.set(s, Date.now());
  return s;
}
function consumeState(s: string | undefined): boolean {
  if (!s) return false;
  const at = pendingStates.get(s);
  pendingStates.delete(s);
  return at !== undefined && Date.now() - at < STATE_TTL_MS;
}

function origin(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] ?? req.protocol;
  return `${proto}://${req.get('host')}`;
}

/** Routes powering the in-app sign-in page. */
export function authRoutes(cfg: Config): express.Router {
  const router = express.Router();

  router.get('/api/auth/status', async (_req, res) => {
    res.json(await authStatus(cfg));
  });

  // Step 1: bounce the user to Google's consent screen.
  router.get('/auth/google', async (req, res) => {
    try {
      const redirectUri = `${origin(req)}/auth/google/callback`;
      const client = await buildWebOAuthClient(cfg.gmail.credentialsPath, redirectUri);
      const url = client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: GMAIL_SCOPES,
        state: newState(),
      });
      res.redirect(url);
    } catch (err) {
      log.error(err);
      res.redirect('/?error=' + encodeURIComponent('Google sign-in is not set up on the server yet.'));
    }
  });

  // Step 2: Google redirects back here with a code.
  router.get('/auth/google/callback', async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>;
    if (error) {
      res.redirect('/?error=' + encodeURIComponent(error));
      return;
    }
    if (!consumeState(state)) {
      res.redirect('/?error=' + encodeURIComponent('Sign-in expired, please try again.'));
      return;
    }
    if (!code) {
      res.redirect('/?error=' + encodeURIComponent('No authorization code returned.'));
      return;
    }
    try {
      const redirectUri = `${origin(req)}/auth/google/callback`;
      const client = await buildWebOAuthClient(cfg.gmail.credentialsPath, redirectUri);
      const { tokens } = await client.getToken(code);
      await fs.writeFile(cfg.gmail.tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
      await fs.chmod(cfg.gmail.tokenPath, 0o600).catch(() => {});
      log.info('Gmail connected via sign-in page.');
      res.redirect('/?connected=gmail');
    } catch (err) {
      log.error(err);
      res.redirect('/?error=' + encodeURIComponent('Could not complete Google sign-in.'));
    }
  });

  // Connect Realtime Trains: validate the creds, then store them.
  router.post('/api/settings/rtt', async (req, res) => {
    const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: 'Enter both your Realtime Trains username and password.' });
      return;
    }
    try {
      // A cheap authenticated call — 200 proves the creds work.
      await fetchJson(`${cfg.rtt.baseUrl}/search/PAD`, {
        headers: { Authorization: basicAuth(username, password) },
        retries: 0,
      });
    } catch {
      res.status(401).json({ error: 'Those Realtime Trains details were rejected. Check them and try again.' });
      return;
    }
    const conn = await readConnection(cfg);
    conn.rtt = { username, password };
    await writeConnection(cfg, conn);
    log.info('Realtime Trains connected via sign-in page.');
    res.json({ ok: true });
  });

  router.post('/api/auth/signout', async (_req, res) => {
    await fs.rm(cfg.gmail.tokenPath, { force: true }).catch(() => {});
    const conn = await readConnection(cfg);
    delete conn.rtt;
    await writeConnection(cfg, conn);
    res.json({ ok: true });
  });

  return router;
}
