import { existsSync } from 'node:fs';
import type { Config } from '../config.js';
import type { EmailProvider } from '../email/provider.js';
import { GmailProvider } from '../email/gmail.js';
import type { RailDataProvider } from '../rail/provider.js';
import { RealtimeTrainsProvider } from '../rail/realtimeTrains.js';
import { ClaimStore } from '../store/store.js';
import { FixtureEmailProvider, FixtureRailProvider } from '../demo.js';

export interface WebDeps {
  email: EmailProvider;
  rail: RailDataProvider;
  store: ClaimStore;
  /** True when we fell back to bundled sample data (no real credentials). */
  demo: boolean;
}

/** True when both Gmail (token present) and RTT (creds present) are configured. */
export function isConfigured(cfg: Config): boolean {
  const gmailReady = existsSync(cfg.gmail.credentialsPath) && existsSync(cfg.gmail.tokenPath);
  const rttReady = Boolean(cfg.rtt.username && cfg.rtt.password);
  return gmailReady && rttReady;
}

/**
 * Build the providers the web app runs on. When credentials aren't configured
 * we transparently fall back to the demo fixtures so the app is usable
 * immediately (on a phone, before any setup).
 */
export function buildWebDeps(cfg: Config): WebDeps {
  if (isConfigured(cfg)) {
    return {
      email: new GmailProvider(cfg.gmail),
      rail: new RealtimeTrainsProvider(cfg.rtt),
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
