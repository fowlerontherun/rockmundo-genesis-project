import { describe, expect, it, vi } from "vitest";
import {
  cookingStagingApiGet,
  cookingStagingApiPost,
  trustedCookingStagingApiUrl,
  forbiddenCookingStagingRequest,
  validateCookingStagingOrigins,
} from "../../../tests/cooking-staging/stagingNetworkSafety";

const app = "https://cooking-staging.example.test";
const api = "https://isolated-test.supabase.co";

describe("isolated cooking staging host safety", () => {
  it("accepts clearly disposable staging app and API origins", () => {
    expect(validateCookingStagingOrigins(app, api)).toEqual({
      appOrigin: app, apiOrigin: api,
    });
    expect(validateCookingStagingOrigins("http://localhost:5173", "http://127.0.0.1:54321"))
      .toEqual({ appOrigin: "http://localhost:5173", apiOrigin: "http://127.0.0.1:54321" });
    expect(validateCookingStagingOrigins(
      "https://cooking-preview.example.test/", "https://api-staging.example.test/",
    ).apiOrigin).toBe("https://api-staging.example.test");
  });

  it("rejects production or ambiguous browser/API configurations before login", () => {
    for (const [badApp,badApi] of [
      ["https://rockmundo.uk",api],
      ["https://game.rockmundo.uk",api],
      ["https://rockmundo-staging.rockmundo.uk",api],
      ["https://rockmundo.uk.evil.example",api],
      ["https://game.example.test",api],
      ["http://cooking-staging.example.test",api],
      ["https://username:secret@cooking-staging.example.test",api],
      ["https://cooking-staging.example.test/unexpected",api],
      [app,"https://yztogmdixmchsmimtent.supabase.co"],
      [app,"https://api.rockmundo.uk"],
      [app,"https://auth-production.example.test"],
      [app,"https://unlabelled.example.test"],
      [app,"http://api-staging.example.test"],
      [app,"https://cooking-staging.example.test/api/v1"],
    ] as const) {
      // rockmundo.uk.evil.example is a deceptive but non-production hostname;
      // it is rejected because the frontend is not explicitly named staging.
      expect(() => validateCookingStagingOrigins(badApp,badApi),
        `Must reject unsafe app=${badApp} api=${badApi}`).toThrow();
    }
  });

  it("does not leak authentication or functions to custom production APIs", () => {
    for (const url of [
      "https://yztogmdixmchsmimtent.supabase.co/auth/v1/token",
      "https://api.rockmundo.uk/functions/v1/cooking-session",
      "https://foreign.supabase.co/rest/v1/profiles",
      "https://api.other-game.example/auth/v1/token?grant_type=password",
      "https://backend.example/rest/v1/rpc/purchase_cooking_food_stall_listing",
      "https://backend.example/functions/v1/cooking-session",
      "https://backend.example/storage/v1/object/avatar",
      "https://backend.example/realtime/v1/websocket",
      "https://backend.example/graphql/v1",
      "https://rockmundo.uk/app",
    ]) {
      expect(forbiddenCookingStagingRequest(url,api),url).toBe(true);
    }
  });

  it("validates direct API request URL and blocks production targets before sending a bearer token", async () => {
    const post = vi.fn(async () => ({ status: () => 403 }));
    const request = { post } as unknown as Parameters<typeof cookingStagingApiPost>[0];
    const headers = { Authorization: "Bearer staging-only-jwt" };
    for (const url of [
      "https://yztogmdixmchsmimtent.supabase.co/rest/v1/rpc/withdraw",
      "https://api.rockmundo.uk/functions/v1/cooking-session",
      "https://foreign.supabase.co/rest/v1/profiles",
      "https://foreign.example.test/auth/v1/token",
      "https://unknown.example.test/not-an-api",
      "http://isolated-test.supabase.co/rest/v1/profiles",
      "https://someone:secret@isolated-test.supabase.co/rest/v1/profiles",
    ]) {
      expect(() => trustedCookingStagingApiUrl(api,url), url).toThrow();
      await expect(cookingStagingApiPost(request,api,url,headers,{})).rejects.toThrow();
    }
    expect(post).not.toHaveBeenCalled();
  });

  it("uses only the approved staging API with redirects disabled for reads and writes", async () => {
    const get = vi.fn(async () => ({ status: () => 200 }));
    const post = vi.fn(async () => ({ status: () => 400 }));
    const request = { get,post } as unknown as Parameters<typeof cookingStagingApiGet>[0];
    const headers = { Authorization: "Bearer test-value", apikey: "disposable-key" };
    const body = { p_profile_id: "disposable" };
    await cookingStagingApiGet(request, api, "/rest/v1/profiles?select=cash", headers);
    await cookingStagingApiPost(request, api, "/rest/v1/rpc/browse_cooking_food_stalls", headers, body);
    expect(get).toHaveBeenCalledWith(`${api}/rest/v1/profiles?select=cash`, {
      headers, maxRedirects: 0, timeout: 30_000,
    });
    expect(post).toHaveBeenCalledWith(`${api}/rest/v1/rpc/browse_cooking_food_stalls`, {
      headers, data: body, maxRedirects: 0, timeout: 30_000,
    });
    expect(trustedCookingStagingApiUrl(api, `${api}/functions/v1/cooking-session`))
      .toBe(`${api}/functions/v1/cooking-session`);
  });

  it("allows only the configured API and harmless third-party assets", () => {
    expect(forbiddenCookingStagingRequest(`${api}/auth/v1/token`,api)).toBe(false);
    expect(forbiddenCookingStagingRequest(`${api}/rest/v1/profiles`,api)).toBe(false);
    expect(forbiddenCookingStagingRequest(`${api}/functions/v1/cooking-session`,api))
      .toBe(false);
    expect(forbiddenCookingStagingRequest(`${app}/auth`,api)).toBe(false);
    expect(forbiddenCookingStagingRequest("https://fonts.gstatic.com/s/font.woff2",api))
      .toBe(false);
  });
});
