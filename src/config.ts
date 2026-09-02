import 'dotenv/config';
import path from 'node:path';

export type SubmitMode = 'prepare' | 'auto';

export interface Config {
  gmail: {
    credentialsPath: string;
    tokenPath: string;
    query: string;
    maxResults: number;
  };
  rtt: {
    username: string;
    password: string;
    baseUrl: string;
  };
  submitMode: SubmitMode;
  minDelayMinutes: number;
  dataDir: string;
  preparedDir: string;
}

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    return '';
  }
  return v;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(): Config {
  const submitModeRaw = env('SUBMIT_MODE', 'prepare').toLowerCase();
  const submitMode: SubmitMode = submitModeRaw === 'auto' ? 'auto' : 'prepare';

  return {
    gmail: {
      credentialsPath: path.resolve(env('GMAIL_CREDENTIALS_PATH', './credentials.json')),
      tokenPath: path.resolve(env('GMAIL_TOKEN_PATH', './gmail-token.json')),
      query: env(
        'GMAIL_QUERY',
        'from:(auto-confirm@trainline.com OR no-reply@gwr.com OR nationalrail.co.uk) newer_than:35d',
      ),
      maxResults: intEnv('GMAIL_MAX_RESULTS', 25),
    },
    rtt: {
      username: env('RTT_USERNAME'),
      password: env('RTT_PASSWORD'),
      baseUrl: env('RTT_BASE_URL', 'https://api.rtt.io/api/v1/json'),
    },
    submitMode,
    minDelayMinutes: intEnv('MIN_DELAY_MINUTES', 15),
    dataDir: path.resolve(env('DATA_DIR', './data')),
    preparedDir: path.resolve(env('PREPARED_DIR', './prepared-claims')),
  };
}
