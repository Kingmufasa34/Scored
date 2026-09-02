import { existsSync } from 'node:fs';
import type { Config } from '../config.js';
import type { EmailProvider } from '../email/provider.js';
import { GmailProvider } from '../email/gmail.js';
import type { RailDataProvider } from '../rail/provider.js';
import { RealtimeTrainsProvider } from '../rail/realtimeTrains.js';
import { ClaimStore } from '../store/store.js';
import { FixtureEmailProvider, FixtureRailProvider } from '../demo.js';
import { gmailConnected, resolveRttCreds } from './connection.js';

export interface WebDeps {
  email: EmailProvider;
  rail: RailDataProvider;
  store: ClaimStore;
  /** True when we fell back to bundled sample data (not both accounts connected). */
  demo: boolean;
}

export interface AuthStatus {
  gmail: boolean;
  rtt: boolean;
  /** Whether a Google OAuth client is configured so "Sign in with Google" can work. */
  googleClientReady: boolean;
  connected: boolean;
}

/** Report which accounts are connected, for the sign-in page. */
export async function authStatus(cfg: Config): Promise<AuthStatus> {
  const gmail = gmailConnected(cfg);
  const rtt = (await resolveRttCreds(cfg)) !== null;
  return { gmail, rtt, googleClientReady: googleClientReady(cfg), connected: gmail && rtt };
}

/** A Google OAuth client is usable if env creds or a credentials.json exist. */
export function googleClientReady(cfg: Config): boolean {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return true;
  return existsSync(cfg.gmail.credentialsPath);
}

/**
 * Build the providers the web app runs on. Uses the real Gmail + RTT
 * connections when both are present, otherwise falls back to the bundled demo
 * fixtures so the board is always populated.
 */
export async function buildWebDeps(cfg: Config): Promise<WebDeps> {
  const gmail = gmailConnected(cfg);
  const rtt = await resolveRttCreds(cfg);

  if (gmail && rtt) {
    return {
      email: new GmailProvider(cfg.gmail),
      rail: new RealtimeTrainsProvider({ ...rtt, baseUrl: cfg.rtt.baseUrl }),
      store: new ClaimStore(cfg.dataDir),
      demo: false,
    };
  }
  return {
    email: new FixtureEmailProvider(),
    rail: new FixtureRailProvider(),
    store: new ClaimStore(`${cfg.dataDir}/demo`),
    demo: true,
  };
}
