import { expect, test, type Browser, type Page } from "@playwright/test";

// Opt-in only: requires an ISOLATED staging app+Supabase project and three
// disposable, independently authenticated user accounts in the same city.
// The seller must own a fresh unlisted legal recipe batch with >=1 portion.
// All three accounts should have no unrelated cash-generating jobs running.
// This file never runs as part of normal CI or against production.
const stagingApi = new URL(process.env.COOKING_STAGING_SUPABASE_URL!).origin;
const productionProjectId = "yztogmdixmchsmimtent";

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
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = required(`COOKING_STAGING_STALL_${role}_EMAIL`);
  const password = required(`COOKING_STAGING_STALL_${role}_PASSWORD`);
  const foreignApiHosts: string[] = [];
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    const supabaseHost = url.hostname === "supabase.co" || url.hostname.endsWith(".supabase.co");
    if (url.hostname.includes(productionProjectId) || (supabaseHost && url.origin !== stagingApi)) {
      foreignApiHosts.push(url.origin);
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

test("two buyers racing for one food portion settle exactly one sale", async ({ browser }) => {
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
  } finally {
    for (const actor of actors) await actor.page.context().close();
  }
});
