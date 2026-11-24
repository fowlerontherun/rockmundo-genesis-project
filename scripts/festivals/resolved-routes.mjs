import ts from "typescript";

/** Resolve nested routes before comparing semantic identities. */
export function resolveFestivalRoutes(source, patterns) {
  const file = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rows = [];
  const expressionPath = expression => {
    if (ts.isStringLiteral(expression)) return expression.text;
    const text = expression.getText(file);
    const match = text.match(/^festivalRoutePatterns\.(\w+)(\.split\("\/"\)\.at\(-1\))?$/);
    if (!match || !patterns[match[1]]) return null;
    return match[2] ? patterns[match[1]].split("/").at(-1) : patterns[match[1]];
  };
  const walk = (node, parent = "") => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      if (opening.tagName.getText(file) === "Route") {
        const attributes = opening.attributes.properties.filter(ts.isJsxAttribute);
        const pathAttribute = attributes.find(attribute => attribute.name.getText(file) === "path");
        const initial = pathAttribute?.initializer;
        const own = initial && ts.isStringLiteral(initial) ? initial.text
          : initial && ts.isJsxExpression(initial) && initial.expression ? expressionPath(initial.expression) : null;
        const resolved = own === null ? parent : own.startsWith("/") ? own : `${parent}/${own}`.replace(/\/+/g, "/");
        if (own !== null && /festival/i.test(resolved)) {
          const element = attributes.find(attribute => attribute.name.getText(file) === "element")?.initializer;
          rows.push({ path: resolved, element: element?.getText(file) ?? "", index: node.pos });
        }
        if (ts.isJsxElement(node)) for (const child of node.children) walk(child, resolved);
        return;
      }
    }
    ts.forEachChild(node, child => walk(child, parent));
  };
  walk(file);
  return rows;
}