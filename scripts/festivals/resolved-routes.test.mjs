import test from "node:test";
import assert from "node:assert/strict";
import { resolveFestivalRoutes } from "./resolved-routes.mjs";

test("mobile and desktop festival routes retain different parent paths", () => {
  const rows = resolveFestivalRoutes('<Routes><Route path="/mobile"><Route path="festivals" element={<Mobile />} /></Route><Route path="festivals" element={<Desktop />} /></Routes>', {});
  assert.deepEqual(rows.map(row => row.path), ["/mobile/festivals", "/festivals"]);
});
test("parameter names under the same parent remain semantic duplicates", () => {
  const rows = resolveFestivalRoutes('<Routes><Route path="/festivals"><Route path=":id" element={<A />} /><Route path=":slug" element={<B />} /></Route></Routes>', {});
  const paths = rows.map(row => row.path.replace(/:[^/]+/g, ":parameter"));
  assert.equal(paths[1], paths[2]);
});
test("registry expressions resolve relative nested edition sections", () => {
  const rows = resolveFestivalRoutes('<Route path={festivalRoutePatterns.edition}><Route path={festivalRoutePatterns.live.split("/").at(-1)} element={<Live />} /></Route>', { edition: "/festival-company/:company/editions/:edition", live: "/festival-company/:company/editions/:edition/live" });
  assert.equal(rows[1].path, "/festival-company/:company/editions/:edition/live");
});