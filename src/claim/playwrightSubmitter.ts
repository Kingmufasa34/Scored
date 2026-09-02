import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Claim, ClaimField } from '../types.js';
import { log } from '../logger.js';
import { formatClaimFields } from './fields.js';
import type { Submitter } from './submitter.js';

export interface PlaywrightOptions {
  /** Where to save verification screenshots. */
  screenshotDir: string;
  /** When true, click the form's final submit button. Default false = fill & pause. */
  autoConfirm?: boolean;
  /** Run with a visible browser so you can watch/intervene. Default false. */
  headed?: boolean;
}

/**
 * Opt-in auto-submitter: drives the operator's Delay Repay web form via
 * Playwright, filling every field it has a selector for, then screenshotting.
 *
 * Reality check: operator forms change often and many use CAPTCHAs / logins, so
 * this fills what it can and — unless `autoConfirm` is set AND a submit selector
 * exists — stops short of the final click, leaving you a filled form + a
 * screenshot to finish. Add `formSelectors` per operator in operators.ts to make
 * a given operator fully hands-off.
 */
export class PlaywrightSubmitter implements Submitter {
  readonly mode = 'auto' as const;
  constructor(private readonly opts: PlaywrightOptions) {}

  async submit(claim: Claim): Promise<Claim> {
    const now = () => new Date().toISOString();
    if (!claim.operator.claimUrl) {
      return fail(claim, 'No claim URL known for this operator; cannot auto-submit.');
    }

    let chromium: typeof import('playwright').chromium;
    try {
      ({ chromium } = await import('playwright'));
    } catch {
      return fail(
        claim,
        'Playwright is not installed. Run `npm i -D playwright && npx playwright install chromium`, or use SUBMIT_MODE=prepare.',
      );
    }

    await fs.mkdir(this.opts.screenshotDir, { recursive: true });
    const shot = path.join(this.opts.screenshotDir, `${claim.id.replace(/[^\w.-]+/g, '-')}.png`);
    const browser = await chromium.launch({ headless: !this.opts.headed });

    try {
      const page = await browser.newPage();
      await page.goto(claim.operator.claimUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const selectors = claim.operator.formSelectors;
      const values = formatClaimFields(claim);
      let filled = 0;

      if (selectors) {
        for (const [field, selector] of Object.entries(selectors) as [ClaimField, string][]) {
          const value = values[field];
          if (!selector || !value) continue;
          try {
            await page.fill(selector, value, { timeout: 5_000 });
            filled++;
          } catch (err) {
            log.warn(`Could not fill ${field} (${selector}): ${String(err)}`);
          }
        }
      }

      const selectorMap = selectors as Record<string, string> | undefined;
      const submitSelector = selectorMap?.submit;
      const canConfirm = Boolean(this.opts.autoConfirm && submitSelector);

      if (canConfirm && submitSelector) {
        await page.click(submitSelector, { timeout: 5_000 });
        await page.screenshot({ path: shot, fullPage: true });
        return {
          ...claim,
          status: 'submitted',
          updatedAt: now(),
          submission: { mode: 'auto', ok: true, detail: `Submitted (${filled} fields filled).`, artifactPath: shot },
        };
      }

      await page.screenshot({ path: shot, fullPage: true });
      const detail =
        filled > 0
          ? `Opened form and filled ${filled} field(s). Review the screenshot and submit manually (no submit selector / autoConfirm off).`
          : 'Opened the claim form but no field selectors are configured for this operator yet. Add formSelectors in operators.ts.';
      return {
        ...claim,
        status: 'prepared',
        updatedAt: now(),
        submission: { mode: 'auto', ok: filled > 0, detail, artifactPath: shot },
      };
    } catch (err) {
      return fail(claim, `Browser automation error: ${String(err)}`);
    } finally {
      await browser.close().catch(() => {});
    }
  }
}

function fail(claim: Claim, detail: string): Claim {
  return {
    ...claim,
    status: 'submit-failed',
    updatedAt: new Date().toISOString(),
    submission: { mode: 'auto', ok: false, detail },
  };
}
