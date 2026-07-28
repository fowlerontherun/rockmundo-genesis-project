import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const boundary = fs.readFileSync("src/features/festivals/certification/routeIdentifiers.ts", "utf8");
const inventory = JSON.parse(fs.readFileSync("docs/festivals/festival-active-callers.json", "utf8"));

test("inventory records every App Festival route in source order", () => {
  const actual = [...app.matchAll(/<Route\s+path="([^"]*festival[^"]*)"/gi)].map(m => `/${m[1].replace(/^\//, "")}`);
  assert.deepEqual(inventory.routes.map(route => route.route), actual);
});

test("every Festival route parameter has one domain meaning", () => {
  for (const route of inventory.routes) {
    const parameterCount = [...route.route.matchAll(/:([A-Za-z0-9_]+)/g)].length;
    assert.equal(route.identifierSemantics.length, parameterCount, route.route);
    assert.ok(route.identifierSemantics.every(item => item.meaning !== "unknown"), route.route);
  }
});

test("route boundary publishes stable domain errors and strict validators", () => {
  for (const error of ["FESTIVAL_COMPANY_NOT_FOUND", "FESTIVAL_EDITION_NOT_FOUND", "FESTIVAL_IDENTIFIER_LEGACY_ONLY", "FESTIVAL_IDENTIFIER_AMBIGUOUS", "FESTIVAL_EDITION_ACCESS_DENIED"])
    assert.match(boundary, new RegExp(error));
  assert.match(boundary, /const UUID = \^?\//);
  assert.doesNotMatch(boundary, /\.from\(|\.rpc\(/);
});
