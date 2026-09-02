/**
 * One-time Gmail authorisation.
 *
 *   npm run auth:gmail
 *
 * Opens (prints) a Google consent URL, you paste back the code, and the
 * resulting refresh token is written to GMAIL_TOKEN_PATH. Read-only scope only.
 */
import { promises as fs } from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadConfig } from '../config.js';
import { buildOAuthClient, GMAIL_SCOPES } from './gmail.js';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const oauth2 = await buildOAuthClient(cfg.gmail.credentialsPath);

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
  });

  console.log('\n1. Open this URL in your browser and grant read-only Gmail access:\n');
  console.log(authUrl + '\n');
  console.log('2. Copy the authorisation code Google gives you and paste it below.\n');

  const rl = readline.createInterface({ input, output });
  const code = (await rl.question('Authorisation code: ')).trim();
  rl.close();

  const { tokens } = await oauth2.getToken(code);
  await fs.writeFile(cfg.gmail.tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
  console.log(`\n✓ Token saved to ${cfg.gmail.tokenPath}. You can now run \`npm run dev -- run\`.`);
}

main().catch((err) => {
  console.error('Authorisation failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
