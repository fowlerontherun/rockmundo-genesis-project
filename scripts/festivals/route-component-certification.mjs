import ts from "typescript";

const isFestivalRoute = node => {
  const pathAttribute = node.attributes.properties.find(
    property => ts.isJsxAttribute(property) && property.name.text === "path",
  );
  if (!pathAttribute?.initializer) return false;
  return pathAttribute.initializer.getText().toLowerCase().includes("festival");
};

const declarationNames = sourceFile => {
  const names = new Set(["Route", "Navigate", "Suspense"]);
  const addBinding = binding => {
    if (ts.isIdentifier(binding)) names.add(binding.text);
    else for (const element of binding.elements) addBinding(element.name);
  };
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.name) names.add(clause.name.text);
      if (clause?.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) names.add(clause.namedBindings.name.text);
        else for (const element of clause.namedBindings.elements) names.add(element.name.text);
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) addBinding(declaration.name);
    } else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
      names.add(statement.name.text);
    }
  }
  return names;
};

/** Certifies actual JSX symbols rather than maintaining a list of retired page names. */
export function findUndefinedFestivalRouteComponents(source, fileName = "src/App.tsx") {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declared = declarationNames(sourceFile);
  const referenced = new Set();

  const inspectElement = node => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName;
      if (ts.isIdentifier(tag) && /^[A-Z]/.test(tag.text)) referenced.add(tag.text);
    }
    ts.forEachChild(node, inspectElement);
  };
  const visit = node => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText() === "Route" && isFestivalRoute(node)) {
      const element = node.attributes.properties.find(
        property => ts.isJsxAttribute(property) && property.name.text === "element",
      );
      if (element?.initializer) inspectElement(element.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...referenced].filter(name => !declared.has(name)).sort();
}
