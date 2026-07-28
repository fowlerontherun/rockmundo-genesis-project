import test from "node:test";
import assert from "node:assert/strict";
import { findUndefinedFestivalRouteComponents } from "./route-component-certification.mjs";

test("Festival route component certification accepts imports and local declarations", () => {
  const source = `import { Route } from "react-router-dom";
    import Directory from "./Directory";
    const Redirect = () => null;
    <><Route path="festivals" element={<Directory />} />
    <Route path={festivalRoutePatterns.publicDirectory} element={<Redirect />} /></>`;
  assert.deepEqual(findUndefinedFestivalRouteComponents(source), []);
});

test("Festival route component certification catches an undeclared JSX component", () => {
  const source = `import { Route } from "react-router-dom";
    <Route path="festivals/simulation" element={<Gate><UndefinedComponent /></Gate>} />`;
  assert.deepEqual(findUndefinedFestivalRouteComponents(source), ["Gate", "UndefinedComponent"]);
});
