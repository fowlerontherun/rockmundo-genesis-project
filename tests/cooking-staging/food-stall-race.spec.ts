import { expect, test, type Browser, type Page } from "@playwright/test";
import { forbiddenCookingStagingRequest } from "./stagingNetworkSafety";

// Opt-in only: requires an ISOLATED staging app+Supabase project and three
// disposable, independently authenticated user accounts in the same city.
// The seller must own a fresh unlisted legal recipe batch with >=1 portion.
// All three accounts should have no unrelated cash-generating jobs running.
// This file never runs as part of normal CI or against production.
const stagingApi = new URL(process.env.COOKING_STAGING_SUPABASE_URL!).origin;


interface StagingActor {
  page: Page;
  profileId: string;
  cityId: string;
  userId: string;
  headers: Record<string, string>;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing protected staging-only value: ${name}`);
  return value;
}

async function login(browser: Browser, role: "SELLER" | "BUYER_A" | "BUYER_B"): Promise<StagingActor> {
  // browser.newContext() does not inherit Playwright's test.use(baseURL).
  // These three isolated contexts need the verified staging app origin
  // explicitly or page.goto("/auth") fails before any race assertions run.
  const context = await browser.newContext({
    baseURL: new URL(required("COOKING_STAGING_BASE_URL")).origin,
    // Standalone browser contexts do not inherit test fixture settings.
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const email = required(`COOKING_STAGING_STALL_${role}_EMAIL`);
  const password = required(`COOKING_STAGING_STALL_${role}_PASSWORD`);
  const foreignApiHosts: string[] = [];
  await page.route("**/*", async route => {
    if (forbiddenCookingStagingRequest(route.request().url(), stagingApi)) {
      foreignApiHosts.push(new URL(route.request().url()).origin);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  await page.goto("/auth");
  await expect(page.locator("#login-email")).toBeVisible();
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  const signInResponse = page.waitForResponse(response =>
    response.url().startsWith(stagingApi + "/auth/v1/token") && response.request().method() === "POST");
  await page.locator("form:has(#login-email) button[type=submit]").click();
  expect((await signInResponse).ok(), `${role} must authenticate to the isolated staging Supabase project`).toBe(true);

  const browseResponse = page.waitForResponse(response =>
    response.url().startsWith(stagingApi + "/rest/v1/rpc/browse_cooking_food_stalls")
    && response.request().method() === "POST");
  await page.goto("/cooking");
  await expect(page.getByRole("heading", { name: "Player food stalls" })).toBeVisible();
  const observed = await browseResponse;
  expect(observed.ok()).toBe(true);
  const request = observed.request();
  const bearer = request.headers()["authorization"] ?? "";
  const apikey = request.headers()["apikey"] ?? "";
  expect(bearer.startsWith("Bearer ")).toBe(true);
  expect(apikey.length).toBeGreaterThan(10);
  const payload = request.postDataJSON() as { p_profile_id?: string };
  expect(payload.p_profile_id).toMatch(/^[a-f\d-]{36}$/i);
  const market = await observed.json() as { enabled: boolean; cityId: string };
  expect(market.enabled, `${role} requires enabled STAGING-only food stalls`).toBe(true);
  expect(market.cityId).toMatch(/^[a-f\d-]{36}$/i);
  expect(foreignApiHosts, `${role} attempted unexpected production / foreign Supabase access`).toEqual([]);

  // Reading sub is solely a fixture sanity check; the server validates JWTs.
  const tokenParts = bearer.slice(7).split(".");
  expect(tokenParts).toHaveLength(3);
  const userId = (JSON.parse(Buffer.from(tokenParts[1], "base64url").toString("utf8")) as { sub?: string }).sub ?? "";
  expect(userId).toMatch(/^[a-f\d-]{36}$/i);
  return {
    page, profileId: payload.p_profile_id!, cityId: market.cityId, userId,
    headers: { Authorization: bearer, apikey, "Content-Type": "application/json" },
  };
}

async function rpc(actor: StagingActor, name: string, body: Record<string, unknown>) {
  // Deliberately construct every API URL from the verified staging-only origin.
  return actor.page.request.post(`${stagingApi}/rest/v1/rpc/${name}`, {
    headers: actor.headers,
    data: body,
    timeout: 30_000,
  });
}

async function readOriginalBatch(actor: StagingActor, batchId: string) {
  const result = await actor.page.request.get(
    `${stagingApi}/rest/v1/cooking_food_batches?select=id,profile_id,recipe_slug,quality,portions,prepared_at,expires_at&id=eq.${batchId}`,
    { headers: actor.headers },
  );
  expect(result.ok(), "The seller must be able to read the original food batch").toBe(true);
  const rows = await result.json() as Array<{
    id: string; profile_id: string; recipe_slug: string; quality: number;
    portions: number; prepared_at: string; expires_at: string;
  }>;
  expect(rows).toHaveLength(1);
  expect(rows[0].profile_id).toBe(actor.profileId);
  return rows[0];
}

async function readCash(actor: StagingActor): Promise<number> {
  const result = await actor.page.request.get(
    `${stagingApi}/rest/v1/profiles?select=id,cash&id=eq.${actor.profileId}`,
    { headers: actor.headers },
  );
  expect(result.ok(), "The signed-in staging character must read its own cash").toBe(true);
  const rows = await result.json() as Array<{ id: string; cash: number }>;
  expect(rows).toHaveLength(1);
  return Number(rows[0].cash);
}

test("two buyers and concurrent seller cancellation settle food escrow exactly once", async ({ browser }) => {
  test.skip(process.env.COOKING_STAGING_STALL_TRADES !== "YES_STAGING_ONLY",
    "Opt-in staging-only food stall transaction certification is disabled");
  test.setTimeout(180_000);

  const actors: StagingActor[] = [];
  try {
    // Separate browser contexts provide independent real authenticated JWTs.
    for (const role of ["SELLER", "BUYER_A", "BUYER_B"] as const) {
      actors.push(await login(browser, role));
    }
    const [seller, buyerA, buyerB] = actors;
    expect(new Set(actors.map(actor => actor.userId)).size,
      "Seller and two buyers must be different Supabase users").toBe(3);
    expect(new Set(actors.map(actor => actor.cityId)).size,
      "All three staging characters must be in the same city").toBe(1);

    const before = await Promise.all(actors.map(readCash));
    expect(before[1]).toBeGreaterThanOrEqual(150);
    expect(before[2]).toBeGreaterThanOrEqual(150);

    await expect(seller.page.getByRole("button", { name: "List fresh portions" })).toBeVisible();
    // Both separate races use the same original fresh batch. Explicitly
    // check fixture stock so a second listing failure is never ambiguous.
    const selectedBatchId = await seller.page.getByRole("combobox", { name: "Prepared dish" }).inputValue();
    const original = await readOriginalBatch(seller, selectedBatchId);
    expect(original.portions, "Seller needs >=2 fresh portions for buyer/buyer and buyer/cancel races")
      .toBeGreaterThanOrEqual(2);
    expect(Date.parse(original.expires_at)).toBeGreaterThan(Date.now() + 5 * 60_000);
    await seller.page.getByRole("spinbutton", { name: "Portions to list" }).fill("1");
    await seller.page.getByRole("spinbutton", { name: /Price per portion/ }).fill("150");

    const listingResponse = seller.page.waitForResponse(response =>
      response.url().startsWith(stagingApi + "/rest/v1/rpc/create_cooking_food_stall_listing")
      && response.request().method() === "POST");
    await seller.page.getByRole("button", { name: "List fresh portions" }).click();
    const listingResult = await listingResponse;
    expect(listingResult.ok(), "Food must be reserved by the real server").toBe(true);
    const listed = await listingResult.json() as { status: string; listingId: string };
    expect(listed.status).toBe("created");
    expect(listed.listingId).toMatch(/^[a-f\d-]{36}$/i);

    for (const buyer of [buyerA, buyerB]) {
      const visible = await rpc(buyer, "browse_cooking_food_stalls", {
        p_profile_id: buyer.profileId, p_limit: 50,
      });
      expect(visible.ok()).toBe(true);
      const market = await visible.json() as { listings: Array<{ id: string; portions: number }> };
      expect(market.listings.filter(item => item.id === listed.listingId && item.portions === 1)).toHaveLength(1);
    }

    const requestA = crypto.randomUUID();
    const requestB = crypto.randomUUID();
    const [responseA, responseB] = await Promise.all([
      rpc(buyerA, "purchase_cooking_food_stall_listing", {
        p_buyer_profile_id: buyerA.profileId,p_listing_id: listed.listingId,
        p_portions: 1,p_request_id: requestA,
      }),
      rpc(buyerB, "purchase_cooking_food_stall_listing", {
        p_buyer_profile_id: buyerB.profileId,p_listing_id: listed.listingId,
        p_portions: 1,p_request_id: requestB,
      }),
    ]);
    const responses = [responseA, responseB];
    const winners = responses.map((response,index) => ({ response,index })).filter(item => item.response.ok());
    const losers = responses.map((response,index) => ({ response,index })).filter(item => !item.response.ok());
    expect(winners, "Only one of two concurrent buyers may receive the one reserved portion").toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].response.status()).toBeGreaterThanOrEqual(400);
    const winnerIndex = winners[0].index;
    const winner = winnerIndex === 0 ? buyerA : buyerB;
    const winnerRequest = winnerIndex === 0 ? requestA : requestB;
    const settlement = await winners[0].response.json() as {
      status: string; batchId: string; saleId: string; subtotal: number; fee: number;
    };
    expect(settlement.status).toBe("completed");
    expect(settlement.subtotal).toBe(150);
    expect(settlement.fee).toBeGreaterThanOrEqual(0);
    expect(settlement.fee).toBeLessThanOrEqual(15);

    // Retry the exact same request after the listing is sold: it must return
    // the original sale without transferring another portion or charging again.
    const repeat = await rpc(winner, "purchase_cooking_food_stall_listing", {
      p_buyer_profile_id: winner.profileId,p_listing_id: listed.listingId,
      p_portions: 1,p_request_id: winnerRequest,
    });
    expect(repeat.ok()).toBe(true);
    const replay = await repeat.json() as { status: string; saleId: string; batchId: string };
    expect(replay).toMatchObject({
      status: "already_completed", saleId: settlement.saleId, batchId: settlement.batchId,
    });

    const sellerSales = await seller.page.request.get(
      `${stagingApi}/rest/v1/cooking_food_stall_sales?select=id,purchase_id,buyer_profile_id,portions,subtotal,city_fee&listing_id=eq.${listed.listingId}`,
      { headers: seller.headers },
    );
    expect(sellerSales.ok()).toBe(true);
    const sales = await sellerSales.json() as Array<{
      id: string; buyer_profile_id: string; portions: number; subtotal: number; city_fee: number;
    }>;
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({
      id: settlement.saleId, buyer_profile_id: winner.profileId,
      portions: 1,subtotal: 150,city_fee: settlement.fee,
    });

    const after = await Promise.all(actors.map(readCash));
    expect(after[0] - before[0]).toBe(150 - settlement.fee);
    expect(after[1] - before[1]).toBe(winnerIndex === 0 ? -150 : 0);
    expect(after[2] - before[2]).toBe(winnerIndex === 1 ? -150 : 0);

    const source = await seller.page.request.get(
      `${stagingApi}/rest/v1/cooking_food_stall_listings?select=status,portions_remaining&id=eq.${listed.listingId}`,
      { headers: seller.headers },
    );
    expect(source.ok()).toBe(true);
    expect(await source.json()).toEqual([{ status: "sold",portions_remaining: 0 }]);

    // The first sale's destination batch must keep the original recipe,
    // quality and exact food expiry. Trading cannot reset a meal's freshness.
    const winningBatch = await winner.page.request.get(
      `${stagingApi}/rest/v1/cooking_food_batches?select=recipe_slug,quality,prepared_at,expires_at,portions,profile_id&id=eq.${settlement.batchId}`,
      { headers: winner.headers },
    );
    expect(winningBatch.ok()).toBe(true);
    expect(await winningBatch.json()).toEqual([{
      recipe_slug: original.recipe_slug, quality: original.quality,
      prepared_at: original.prepared_at, expires_at: original.expires_at,
      portions: 1, profile_id: winner.profileId,
    }]);

    // The loser of the first race still has their original $150.
    // Repeat with a SECOND portion, racing a seller cancellation against
    // a real buyer checkout on separate PostgREST requests/connections.
    const buyer = winnerIndex === 0 ? buyerB : buyerA;
    await expect(seller.page.getByRole("button", { name: "List fresh portions" })).toBeVisible();
    await seller.page.getByRole("spinbutton", { name: "Portions to list" }).fill("1");
    await seller.page.getByRole("spinbutton", { name: /Price per portion/ }).fill("150");
    const secondListingResponse = seller.page.waitForResponse(response =>
      response.url().startsWith(stagingApi + "/rest/v1/rpc/create_cooking_food_stall_listing")
      && response.request().method() === "POST");
    await seller.page.getByRole("button", { name: "List fresh portions" }).click();
    const secondResponse = await secondListingResponse;
    expect(secondResponse.ok(), "Seller must reserve the second fresh portion").toBe(true);
    const second = await secondResponse.json() as { status: string; listingId: string };
    expect(second.status).toBe("created");
    expect(second.listingId).toMatch(/^[a-f\d-]{36}$/i);
    expect(second.listingId).not.toBe(listed.listingId);
    const afterSecondEscrow = await readOriginalBatch(seller, selectedBatchId);
    expect(afterSecondEscrow.portions).toBe(original.portions - 2);

    // Client ownership must be rejected even on a listing that exists.
    const stolenCancellation = await rpc(buyer, "cancel_cooking_food_stall_listing", {
      p_profile_id: buyer.profileId, p_listing_id: second.listingId,
    });
    expect(stolenCancellation.ok(), "Buyer cannot cancel seller's escrow").toBe(false);
    const selfPurchase = await rpc(seller, "purchase_cooking_food_stall_listing", {
      p_buyer_profile_id: seller.profileId, p_listing_id: second.listingId,
      p_portions: 1, p_request_id: crypto.randomUUID(),
    });
    expect(selfPurchase.ok(), "Seller cannot buy their own listing").toBe(false);

    const beforeCancelRace = await Promise.all(actors.map(readCash));
    const racePurchaseId = crypto.randomUUID();
    const [cancelResponse, buyResponse] = await Promise.all([
      rpc(seller, "cancel_cooking_food_stall_listing", {
        p_profile_id: seller.profileId, p_listing_id: second.listingId,
      }),
      rpc(buyer, "purchase_cooking_food_stall_listing", {
        p_buyer_profile_id: buyer.profileId, p_listing_id: second.listingId,
        p_portions: 1, p_request_id: racePurchaseId,
      }),
    ]);
    expect(cancelResponse.ok(), "Seller cancel must settle or report already closed").toBe(true);
    const cancellation = await cancelResponse.json() as {
      status: string; listingStatus: string; returnedPortions?: number;
    };
    const buyWon = buyResponse.ok();
    expect(cancellation.status).toBe(buyWon ? "already_closed" : "closed");
    const purchase = buyWon
      ? await buyResponse.json() as { status: string; saleId: string; batchId: string; fee: number; subtotal: number }
      : null;
    if (buyWon) {
      expect(purchase).toMatchObject({ status: "completed", subtotal: 150 });
    } else {
      expect(buyResponse.status()).toBeGreaterThanOrEqual(400);
      expect(cancellation).toMatchObject({
        status: "closed", listingStatus: "cancelled", returnedPortions: 1,
      });
    }

    const [finalListingResponse, finalSalesResponse, finalCancelResponse] = await Promise.all([
      seller.page.request.get(
        `${stagingApi}/rest/v1/cooking_food_stall_listings?select=status,portions_remaining&id=eq.${second.listingId}`,
        { headers: seller.headers },
      ),
      seller.page.request.get(
        `${stagingApi}/rest/v1/cooking_food_stall_sales?select=id,portions,subtotal,city_fee,recipe_slug,food_expires_at&listing_id=eq.${second.listingId}`,
        { headers: seller.headers },
      ),
      seller.page.request.get(
        `${stagingApi}/rest/v1/cooking_food_stall_cancellation_events?select=id,returned_portions,recipe_slug,quality,food_expires_at&listing_id=eq.${second.listingId}`,
        { headers: seller.headers },
      ),
    ]);
    for (const result of [finalListingResponse, finalSalesResponse, finalCancelResponse]) {
      expect(result.ok()).toBe(true);
    }
    expect(await finalListingResponse.json()).toEqual([{
      status: buyWon ? "sold" : "cancelled", portions_remaining: 0,
    }]);
    const finalSales = await finalSalesResponse.json() as Array<{
      id: string; portions: number; subtotal: number; city_fee: number;
      recipe_slug: string; food_expires_at: string;
    }>;
    const finalCancellations = await finalCancelResponse.json() as Array<{
      id: string; returned_portions: number; recipe_slug: string;
      quality: number; food_expires_at: string;
    }>;
    expect(finalSales).toHaveLength(buyWon ? 1 : 0);
    expect(finalCancellations).toHaveLength(buyWon ? 0 : 1);
    if (buyWon) {
      expect(finalSales[0]).toMatchObject({
        id: purchase!.saleId, portions: 1, subtotal: 150,
        recipe_slug: original.recipe_slug, food_expires_at: original.expires_at,
      });
    } else {
      expect(finalCancellations[0]).toMatchObject({
        returned_portions: 1, recipe_slug: original.recipe_slug,
        quality: original.quality, food_expires_at: original.expires_at,
      });
    }
    // Replaying the buyer's original request after the race may only
    // retrieve the already-completed sale or remain rejected. It must
    // never create a new sale after a cancellation.
    const buyerReplay = await rpc(buyer, "purchase_cooking_food_stall_listing", {
      p_buyer_profile_id: buyer.profileId, p_listing_id: second.listingId,
      p_portions: 1, p_request_id: racePurchaseId,
    });
    expect(buyerReplay.ok()).toBe(buyWon);
    if (buyWon) {
      expect(await buyerReplay.json()).toMatchObject({
        status: "already_completed", saleId: purchase!.saleId,
        batchId: purchase!.batchId,
      });
    }
    const afterCancelRace = await Promise.all(actors.map(readCash));
    const buyerIndex = actors.indexOf(buyer);
    expect(afterCancelRace[0] - beforeCancelRace[0])
      .toBe(buyWon ? 150 - purchase!.fee : 0);
    expect(afterCancelRace[buyerIndex] - beforeCancelRace[buyerIndex])
      .toBe(buyWon ? -150 : 0);
    const finalOriginal = await readOriginalBatch(seller, selectedBatchId);
    expect(finalOriginal.portions).toBe(afterSecondEscrow.portions + (buyWon ? 0 : 1));

    // Exactly-once terminal action: repeated seller cancellation cannot
    // mint more portions even if the winning operation was a purchase.
    const cancelAgain = await rpc(seller, "cancel_cooking_food_stall_listing", {
      p_profile_id: seller.profileId, p_listing_id: second.listingId,
    });
    expect(cancelAgain.ok()).toBe(true);
    expect((await cancelAgain.json() as { status: string }).status).toBe("already_closed");
    expect((await readOriginalBatch(seller, selectedBatchId)).portions)
      .toBe(finalOriginal.portions);
    const secondSalesAfterRetry = await seller.page.request.get(
      `${stagingApi}/rest/v1/cooking_food_stall_sales?select=id&listing_id=eq.${second.listingId}`,
      { headers: seller.headers },
    );
    expect(secondSalesAfterRetry.ok()).toBe(true);
    expect(await secondSalesAfterRetry.json()).toHaveLength(buyWon ? 1 : 0);
  } finally {
    for (const actor of actors) await actor.page.context().close();
  }
});
