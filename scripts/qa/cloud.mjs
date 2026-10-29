// Implemented by Codex. Real UI and isolated localhost identities / inspect namespace only.
import { launch, fixture, base, shot } from "./browser.mjs";
const browser = await launch();
const wallet = (page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("perfect-season:profile:v1")).coins,
  );
async function cloud(page) {
  if (await page.locator(".ut-tabs").count()) {
    await page.locator(".ut-tabs button").filter({ hasText: "HOME" }).click();
    await page
      .getByRole("button", { name: "Leave Ultimate Team", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: /CLOUD SAVE/ }).click();
}
async function saved(page) {
  await cloud(page);
  await page.waitForFunction(
    () =>
      !!document.querySelector(".cloud-save-status:is(.is-saved,.is-conflict)"),
    null,
    { timeout: 30000 },
  );
  if (
    await page
      .getByText("TWO SAVES FOUND", { exact: true })
      .isVisible()
      .catch(() => false)
  ) {
    await page
      .getByRole("button", { name: "KEEP THIS PHONE", exact: true })
      .click();
    await page
      .getByRole("button", { name: "CONFIRM & CONTINUE", exact: true })
      .click();
  }
  await page
    .getByText("SAVED TO SERVER", { exact: true })
    .waitFor({ timeout: 30000 });
}
async function rewards(page) {
  await page.getByRole("button", { name: /Ultimate Team:/ }).click();
  await page.getByRole("button", { name: /Collection Gallery/ }).click();
  await page.getByRole("button", { name: /COLLECTION REWARDS/ }).click();
}
try {
  for (const sport of ["nba", "nfl"]) {
    const a = await fixture(browser, sport, "ServerSaveQA");
    await saved(a.page);
    await a.page.getByRole("button", { name: "DONE", exact: true }).click();
    const before = await a.current(),
      identity = await a.page.evaluate(() =>
        localStorage.getItem("perfect-season:key:v1"),
      );
    await rewards(a.page);
    await a.page
      .getByRole("button", { name: "CLAIM", exact: true })
      .first()
      .click();
    await a.page.getByRole("button", { name: "CLOSE", exact: true }).click();
    await saved(a.page);
    const after = await a.current();
    if (after.coins !== before.coins + 100)
      throw Error("Reward was lost during sync");
    await shot(a.page, "cloud-save-" + sport);
    if (await a.page.locator("input[type=file]").count())
      throw Error("File flow still visible");
    await a.page.getByRole("button", { name: "DONE", exact: true }).click();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      ignoreHTTPSErrors: true,
    });
    await context.addInitScript((key) => {
      if (!localStorage.getItem("perfect-season:key:v1"))
        localStorage.setItem("perfect-season:key:v1", key);
    }, identity);
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const u = new URL(base);
    u.search = new URLSearchParams({
      sport,
      ns: "inspect",
      relay: "ws://localhost:7777",
    });
    await page.goto(u.href, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: /Ultimate Team:/ })
      .waitFor({ timeout: 35000 });
    await page.waitForFunction(
      ({ sport, count }) => {
        const s = JSON.parse(
          localStorage.getItem(
            sport === "nba"
              ? "perfect-season:profile:v1"
              : "perfect-season:profile:nfl:v1",
          ) ?? "null",
        );
        return s?.ut?.owned?.length === count;
      },
      { sport, count: after.ut.owned.length },
      { timeout: 30000 },
    );
    await saved(page);
    await page.getByRole("button", { name: "DONE", exact: true }).click();
    const restored = await page.evaluate((sport) => {
      const p = JSON.parse(
        localStorage.getItem(
          sport === "nba"
            ? "perfect-season:profile:v1"
            : "perfect-season:profile:nfl:v1",
        ),
      );
      p.coins = JSON.parse(
        localStorage.getItem("perfect-season:profile:v1"),
      ).coins;
      return p;
    }, sport);
    if (
      restored.coins !== after.coins ||
      JSON.stringify(restored.ut.owned) !== JSON.stringify(after.ut.owned) ||
      JSON.stringify(restored.ut.squad) !== JSON.stringify(after.ut.squad)
    )
      throw Error("Server restore lost original wallet/cards/squad");
    if (
      (await page.evaluate(() =>
        localStorage.getItem("perfect-season:key:v1"),
      )) !== identity
    )
      throw Error("Server restore changed identity");
    // Keep client B offline while A earns a different reward; both mutate through normal React UI.
    await page.route("**/functions/v1/player-save", (route) => route.abort());
    await rewards(a.page);
    await a.page
      .locator(".ut-book-goal")
      .filter({ hasText: "50 editions discovered" })
      .getByRole("button", { name: "CLAIM", exact: true })
      .click();
    await a.page.getByRole("button", { name: "CLOSE", exact: true }).click();
    await saved(a.page);
    await a.page.getByRole("button", { name: "DONE", exact: true }).click();
    const serverCoins = await wallet(a.page);
    await rewards(page);
    await page
      .locator(".ut-book-goal")
      .filter({
        hasText:
          sport === "nba" ? "Chicago Bulls collection" : "Patriots collection",
      })
      .getByRole("button", { name: "CLAIM", exact: true })
      .click();
    await page.getByRole("button", { name: "CLOSE", exact: true }).click();
    const deviceCoins = await wallet(page);
    if (deviceCoins === serverCoins) throw Error("Test did not diverge");
    await cloud(page);
    await page.unroute("**/functions/v1/player-save");
    await page.getByRole("button", { name: /RETRY SYNC|SYNC NOW/ }).click();
    await page
      .getByText("TWO SAVES FOUND", { exact: true })
      .waitFor({ timeout: 30000 });
    await shot(page, "cloud-conflict-" + sport);
    await page
      .getByRole("button", { name: "USE SERVER SAVE", exact: true })
      .click();
    const reloaded = page.waitForEvent("domcontentloaded", { timeout: 30000 });
    await page
      .getByRole("button", { name: "CONFIRM & CONTINUE", exact: true })
      .click();
    await reloaded;
    await page
      .getByRole("button", { name: /Ultimate Team:/ })
      .waitFor({ timeout: 30000 });
    if ((await wallet(page)) !== serverCoins)
      throw Error("Conflict resolution did not restore server wallet");
    if (errors.length || a.errors.length)
      throw Error([...errors, ...a.errors].join(";"));
    console.log(
      JSON.stringify({
        sport,
        serverRestoredCards: restored.ut.owned.length,
        coinsPreserved: true,
        identityPreserved: true,
        offlineCopyKept: true,
        conflictPaused: true,
        serverChoiceRestored: true,
        noBackupFile: true,
        errors,
      }),
    );
    await context.close();
    await a.context.close();
  }
} catch (e) {
  for (const c of browser.contexts())
    for (const p of c.pages())
      console.log("failure", {
        url: p.url(),
        body: await p
          .locator("body")
          .innerText()
          .catch(() => "unavailable"),
      });
  throw e;
} finally {
  await browser.close();
}
