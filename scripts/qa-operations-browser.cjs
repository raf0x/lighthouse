/* Release assertions for the exact L1 P1 v1/v2 storage contract.
 * Run only against a local Next server, never against production.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { chromium, firefox, webkit } = require('playwright');

require.extensions['.ts'] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename,
);

const {
  ENGINE_VERSION, operationCases, assessCase, currentReview,
} = require('../app/lib/operations.ts');
const {
  WORKSPACE_STORAGE_KEY: V2, LEGACY_WORKSPACE_STORAGE_KEY: V1, WORKSPACE_WRITE_LOCK: LOCK,
} = require('../app/lib/workspace.ts');

const base = 'http://127.0.0.1:3000';
const output = path.join(process.cwd(), 'storage-qa-screenshots');
fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const caseInput = structuredClone(operationCases.find(c => c.id === 'OPS-105'));
const drafts = assessCase(caseInput).drafts;
const v1Initial = JSON.stringify({
  version: ENGINE_VERSION,
  cases: { 'OPS-105': { input: caseInput, analyzed: true, drafts, history: [
    { id: 'h-before', at: '2026-11-18T22:00:00Z', event: 'Imported evidence reviewed', detail: 'History preserved' },
  ] } },
});
const v1Modified = (() => {
  const next = JSON.parse(v1Initial);
  next.cases['OPS-105'].input.payment.amountCents -= 1;
  next.cases['OPS-105'].drafts.client += ' Older tab text';
  return JSON.stringify(next);
})();
const storageRaw = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
const currentV2 = async page => JSON.parse(await storageRaw(page, V2));
const noOverflow = async (page, where) => {
  const { width, scroll } = await page.evaluate(() => ({
    width: window.innerWidth, scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(scroll <= width + 1, `Horizontal overflow in ${where} at ${width}px: ${scroll}`);
};

async function loadWithLegacy(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
  await context.addInitScript(({ key, raw }) => {
    if (!sessionStorage.getItem('l1-storage-setup')) {
      localStorage.setItem(key, raw);
      sessionStorage.setItem('l1-storage-setup', 'yes');
    }
  }, { key: V1, raw: v1Initial });
  const page = await context.newPage();
  await page.goto(base + '/operations?case=OPS-105');
  await page.getByText('Saved on this device').first().waitFor({ timeout: 15000 });
  // A rendered status alone is not a release assertion. In WebKit a new
  // isolated context may complete hydration before the storage read is
  // observable in the test's next evaluation. Assert the exact committed v2
  // envelope independently before inspecting any of its case records.
  await page.waitForFunction(key => {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    try {
      const saved = JSON.parse(raw);
      return Boolean(saved?.cases?.['OPS-105']);
    } catch { return false; }
  }, V2, { timeout: 15000 });
  assert.equal(await storageRaw(page, V1), v1Initial);
  const v2 = await currentV2(page);
  assert.equal(v2.cases['OPS-105'].input.payment.amountCents, 4800000);
  assert.equal(v2.cases['OPS-105'].review, undefined);
  assert.equal(v2.cases['OPS-105'].history.length, 1);
  await noOverflow(page, 'initial migration');
  return { context, page };
}

async function oldUnlockedWrite(context, raw = v1Modified) {
  // A document on the same origin, without Lighthouse v2 code, represents the
  // already-open v1 tab. It does NOT acquire a Web Lock and its UI is not tested.
  const legacy = await context.newPage();
  await legacy.goto(base + '/robots.txt');
  await legacy.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: V1, value: raw });
  await legacy.close();
}
async function approve(page) {
  await page.getByRole('button', { name: 'Approve plan', exact: true }).click();
  await page.getByRole('textbox', { name: 'Reviewer name' }).fill('Browser QA');
  await page.getByRole('button', { name: 'Confirm plan approval' }).click();
  await page.getByText('Plan approval recorded on this device').waitFor({ timeout: 15000 });
  const saved = (await currentV2(page)).cases['OPS-105'];
  assert.ok(currentReview(saved.input, saved.drafts, saved.review), 'exact v2 review must be current');
  assert.equal(saved.review.reviewer, 'Browser QA');
  assert.equal(saved.history.filter(h => h.event === 'Plan approved locally').length, 1);
  return saved;
}

async function heldLock(page) {
  await page.evaluate(lockName => {
    window.__l1LockHeld = false;
    void navigator.locks.request(lockName, { mode: 'exclusive' }, async () => {
      window.__l1LockHeld = true;
      await new Promise(resolve => { window.__l1Release = resolve; });
    });
  }, LOCK);
  await page.waitForFunction(() => window.__l1LockHeld === true);
}
async function releaseLock(page) {
  await page.evaluate(() => window.__l1Release());
}

async function scenario(browser, name, ordering, width) {
  const { context, page } = await loadWithLegacy(browser, width);
  const held = await context.newPage();
  await held.goto(base + '/robots.txt');
  try {
    if (ordering === 'v1-first') {
      await heldLock(held);
      await page.getByRole('button', { name: 'Approve plan', exact: true }).click();
      await page.getByRole('textbox', { name: 'Reviewer name' }).fill('Browser QA');
      await page.getByRole('button', { name: 'Confirm plan approval' }).click();
      await oldUnlockedWrite(context);
      await delay(1200);
      assert.equal((await currentV2(page)).cases['OPS-105'].review, undefined,
        'No false approval acknowledgement while lock is held');
      await releaseLock(held);
      await page.getByText('Plan approval recorded on this device').waitFor({ timeout: 15000 });
    } else {
      await approve(page);
      await heldLock(held);
      await oldUnlockedWrite(context);
      await delay(1200);
      await releaseLock(held);
    }

    const saved = (await currentV2(page)).cases['OPS-105'];
    assert.ok(currentReview(saved.input, saved.drafts, saved.review));
    assert.equal(saved.input.payment.amountCents, 4800000);
    assert.equal(saved.history.filter(x => x.event === 'Plan approved locally').length, 1);
    await page.getByText('Unsynchronized changes were detected').waitFor({ timeout: 15000 });
    await page.reload();
    await page.getByText('Unsynchronized changes were detected').waitFor({ timeout: 15000 });
    assert.ok(currentReview((await currentV2(page)).cases['OPS-105'].input,
      (await currentV2(page)).cases['OPS-105'].drafts,
      (await currentV2(page)).cases['OPS-105'].review),
      'legacy-only changes must not invalidate v2 approval after reload');

    await page.getByText('Inspect older v1 workspace (read-only)').click();
    await page.getByText('Inspection: changed.').waitFor({ timeout: 15000 });
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download local v1 backup' }).click();
    const download = await downloading;
    assert.equal(fs.readFileSync(await download.path(), 'utf8'), v1Modified,
      'recovery backup must match the entire raw v1 text exactly');
    await noOverflow(page, 'legacy recovery panel');
    if (name === 'chromium' && width === 390) {
      await page.screenshot({ path: path.join(output, 'legacy-recovery-mobile-390.png'), fullPage: true });
    }
    if (name === 'chromium' && width === 1440) {
      await page.screenshot({ path: path.join(output, 'legacy-recovery-desktop-1440.png'), fullPage: true });
    }

    // Exact packet contains v2 approval and v2 drafts, never the legacy-only text.
    const packetEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download review packet' }).click();
    const packet = fs.readFileSync(await (await packetEvent).path(), 'utf8');
    assert.match(packet, /approved by Browser QA/);
    assert.match(packet, /Imported evidence reviewed/);
    assert.ok(packet.includes(drafts.internal));
    assert.ok(packet.includes(drafts.client));
    assert.ok(!packet.includes('Older tab text'));

    // A genuine v2 draft edit must remove the prior approval (and any success).
    await page.getByRole('button', { name: 'Review message drafts' }).click();
    await page.getByRole('textbox', { name: 'Client update' }).fill(drafts.client + ' New v2 edit');
    await page.waitForFunction(key => {
      const value = localStorage.getItem(key);
      const workspace = value && JSON.parse(value).cases['OPS-105'];
      return workspace?.drafts?.client?.endsWith('New v2 edit') && !workspace.review;
    }, V2, { timeout: 15000 });
    assert.equal((await currentV2(page)).cases['OPS-105'].review, undefined);
    await page.reload();
    const after = (await currentV2(page)).cases['OPS-105'];
    assert.equal(after.review, undefined);
    assert.ok(after.drafts.client.endsWith('New v2 edit'));
    assert.equal(after.history.at(-1).event, 'Drafts edited');
    assert.ok((await storageRaw(page, V1)) === v1Modified);
    await noOverflow(page, 'v2 draft edit');
    console.log(`PASS ${name} ${width}px ${ordering}: exact migration, independent old write, review, recovery backup, export, v2 retraction, reload`);
  } finally {
    await held.close();
    await context.close();
  }
}

async function failureModes(browser, name) {
  for (const failed of ['no-locks', 'write-denied', 'write-noop']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(({ raw, v1, v2, failed }) => {
      localStorage.setItem(v1, raw);
      if (failed === 'no-locks') Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
      if (failed === 'write-denied' || failed === 'write-noop') {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === v2) {
            if (failed === 'write-denied') throw new Error('Simulated v2 write denied');
            return undefined;
          }
          return original.call(this, key, value);
        };
      }
    }, { raw: v1Initial, v1: V1, v2: V2, failed });
    const page = await context.newPage();
    try {
      await page.goto(base + '/operations?case=OPS-105');
      await page.getByText('Save unavailable').first().waitFor({ timeout: 15000 });
      assert.equal(await storageRaw(page, V2), null);
      assert.equal(await storageRaw(page, V1), v1Initial);
      assert.equal(await page.getByText('Plan approval recorded on this device').count(), 0);
      await noOverflow(page, failed);
      console.log(`PASS ${name} ${failed}: no false migration, save or approval acknowledgment`);
    } finally {
      await context.close();
    }
  }
}

async function immediateSuccessRetraction(browser, name) {
  const { context, page } = await loadWithLegacy(browser, 390);
  try {
    await approve(page);
    assert.ok(await page.getByText('Plan approval recorded on this device').count() > 0,
      'successful v2 review initially has visible success notice');
    await page.getByRole('button', { name: 'Review message drafts' }).click();
    await page.getByRole('textbox', { name: 'Client update' }).fill(drafts.client + ' Current v2 edit');
    await page.getByText('Draft saved locally.').waitFor({ timeout: 15000 });
    assert.equal(await page.getByText('Plan approval recorded on this device').count(), 0,
      'v2 draft edit must retract the earlier approval success notice');
    const latest = (await currentV2(page)).cases['OPS-105'];
    assert.equal(latest.review, undefined);
    assert.ok(latest.drafts.client.endsWith('Current v2 edit'));
    console.log(`PASS ${name} 390px: live success notice retracted on genuine v2 draft change`);
  } finally { await context.close(); }
}

async function layoutWidths(browser, name) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/operations');
      await page.getByText('Saved on this device').first().waitFor({ timeout: 15000 });
      await noOverflow(page, name + ' responsive');
    }
    console.log(`PASS ${name}: 1440/1024/768/390 responsive overflow checks`);
  } finally { await context.close(); }
}

(async () => {
  for (const [name, kind] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
    const browser = await kind.launch({ headless: true });
    try {
      await layoutWidths(browser, name);
      await scenario(browser, name, 'v1-first', 390);
      await scenario(browser, name, 'v2-first', 1440);
      await immediateSuccessRetraction(browser, name);
      await failureModes(browser, name);
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
