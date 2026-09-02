import { promises as fs } from 'node:fs';
import { google, type gmail_v1 } from 'googleapis';
import { log } from '../logger.js';

/** OAuth2 client instance type, derived without a direct google-auth-library import. */
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;
import type { EmailMessage, EmailProvider } from './provider.js';

export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export interface GmailOptions {
  credentialsPath: string;
  tokenPath: string;
  query: string;
}

/**
 * Read-only Gmail provider. Requires a prior `npm run auth:gmail` to mint the
 * token file. Uses the Gmail search `query` to locate ticket emails.
 */
export class GmailProvider implements EmailProvider {
  readonly name = 'gmail';
  private gmail?: gmail_v1.Gmail;

  constructor(private readonly opts: GmailOptions) {}

  async fetchMessages(max: number): Promise<EmailMessage[]> {
    const gmail = await this.client();
    const listed = await gmail.users.messages.list({
      userId: 'me',
      q: this.opts.query,
      maxResults: max,
    });

    const ids = (listed.data.messages ?? []).map((m) => m.id).filter((x): x is string => Boolean(x));
    log.info(`Gmail: ${ids.length} message(s) match query.`);

    const out: EmailMessage[] = [];
    for (const id of ids) {
      const res = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
      out.push(normalise(id, res.data));
    }
    return out;
  }

  private async client(): Promise<gmail_v1.Gmail> {
    if (this.gmail) return this.gmail;
    const auth = await loadAuthorizedClient(this.opts.credentialsPath, this.opts.tokenPath);
    this.gmail = google.gmail({ version: 'v1', auth });
    return this.gmail;
  }
}

/** Build an OAuth2 client from the stored credentials + token files. */
export async function loadAuthorizedClient(
  credentialsPath: string,
  tokenPath: string,
): Promise<OAuth2Client> {
  const oauth2 = await buildOAuthClient(credentialsPath);
  let token: unknown;
  try {
    token = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
  } catch {
    throw new Error(
      `No Gmail token at ${tokenPath}. Run \`npm run auth:gmail\` once to authorise the app.`,
    );
  }
  oauth2.setCredentials(token as Record<string, unknown>);
  return oauth2;
}

/** Construct an OAuth2 client (no token yet) from a Google client-secret file. */
export async function buildOAuthClient(credentialsPath: string): Promise<OAuth2Client> {
  const { clientId, clientSecret, redirect } = await readClientSecret(credentialsPath);
  return new google.auth.OAuth2(clientId, clientSecret, redirect ?? 'urn:ietf:wg:oauth:2.0:oob');
}

/**
 * OAuth2 client for the browser redirect flow used by the in-app sign-in page.
 * Client id/secret come from env (GOOGLE_CLIENT_ID/SECRET) or credentials.json;
 * the redirect URI is this server's own callback for the current origin.
 */
export async function buildWebOAuthClient(
  credentialsPath: string,
  redirectUri: string,
): Promise<OAuth2Client> {
  const envId = process.env.GOOGLE_CLIENT_ID;
  const envSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (envId && envSecret) {
    return new google.auth.OAuth2(envId, envSecret, redirectUri);
  }
  const { clientId, clientSecret } = await readClientSecret(credentialsPath);
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function readClientSecret(
  credentialsPath: string,
): Promise<{ clientId: string; clientSecret: string; redirect?: string }> {
  let parsed: any;
  try {
    parsed = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
  } catch {
    throw new Error(
      `Could not read Google OAuth client secret at ${credentialsPath}. Create one in the ` +
        'Google Cloud Console (OAuth client ID) and set GMAIL_CREDENTIALS_PATH, or set ' +
        'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.',
    );
  }
  const key = parsed.installed ?? parsed.web;
  if (!key) throw new Error('Credentials file is missing an "installed"/"web" section.');
  return { clientId: key.client_id, clientSecret: key.client_secret, redirect: key.redirect_uris?.[0] };
}

// ── Gmail message → EmailMessage ─────────────────────────────────────────────

function normalise(id: string, msg: gmail_v1.Schema$Message): EmailMessage {
  const headers = msg.payload?.headers ?? [];
  const header = (name: string): string =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

  const parts = flattenParts(msg.payload ?? undefined);
  const htmlPart = parts.find((p) => p.mimeType === 'text/html');
  const textPart = parts.find((p) => p.mimeType === 'text/plain');

  const html = htmlPart ? decodeBody(htmlPart.body?.data) : undefined;
  const text = textPart
    ? decodeBody(textPart.body?.data)
    : html
      ? stripHtml(html)
      : decodeBody(msg.payload?.body?.data);

  const dateHeader = header('Date');
  const date = dateHeader
    ? new Date(dateHeader).toISOString()
    : msg.internalDate
      ? new Date(Number(msg.internalDate)).toISOString()
      : new Date().toISOString();

  return {
    id,
    from: header('From'),
    to: header('To'),
    subject: header('Subject'),
    date,
    text: text ?? '',
    html,
  };
}

function flattenParts(part: gmail_v1.Schema$MessagePart | undefined): gmail_v1.Schema$MessagePart[] {
  if (!part) return [];
  if (!part.parts || part.parts.length === 0) return [part];
  return part.parts.flatMap(flattenParts);
}

function decodeBody(data: string | null | undefined): string {
  if (!data) return '';
  return Buffer.from(data, 'base64url').toString('utf8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&pound;/g, '£')
    .replace(/&#163;/g, '£')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}
