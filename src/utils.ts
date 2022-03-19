import ts from 'typescript';
import { ElementsResult, ImportMap } from './interfaces';
import { Range } from './Range';

const ESTRELA_FILE_REGEX = /([\w-]+)\.estrela$/;

export function createSource(content: string): ts.SourceFile {
  return ts.createSourceFile(
    'file.ts',
    content,
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TSX
  );
}

export function getElements(
  source: ts.SourceFile,
  skipRoot?: boolean
): ElementsResult {
  let script: ts.JsxElement | undefined = undefined;
  let style: ts.JsxElement | undefined = undefined;
  let template: ts.JsxElement | undefined = undefined;
  const jsxElements: Range[] = [];
  const jsxExpressions: Range[] = [];

  const visitElements = (node: ts.Node, isInClosure: boolean) => {
    // check for <script>, <style> and <template>
    if (ts.isJsxElement(node)) {
      const isTagName = (tag: string) =>
        ts.isIdentifier(node.openingElement.tagName) &&
        node.openingElement.tagName.text === tag;

      if (isTagName('script')) {
        script = node;
        return;
      }
      if (isTagName('style')) {
        style = node;
        return;
      }
      if (isTagName('template')) {
        template = node;
        node.forEachChild(node => visitElements(node, isInClosure));
        return;
      }
    }

    // get JsxElements respecting "skipRootJsx" logic
    if (ts.isJsxElement(node) && isInClosure) {
      jsxElements.push(Range.fromNode(node));
      isInClosure = false;
    }

    // get JsxExpressions
    if (ts.isJsxExpression(node)) {
      jsxExpressions.push(Range.fromNode(node));
      isInClosure = true;
    }

    // iterate over children
    node.forEachChild(child => visitElements(child, isInClosure));
  };
  visitElements(source, !skipRoot);

  return {
    script,
    style,
    template,
    jsxElements,
    jsxExpressions,
  };
}

export function getElementAttributes(
  element: ts.JsxElement
): Record<string, string> {
  return element.openingElement.attributes.properties.reduce((acc, attr) => {
    if (
      ts.isJsxAttribute(attr) &&
      attr.initializer &&
      ts.isStringLiteral(attr.initializer)
    ) {
      acc[String(attr.name.text)] = attr.initializer.text;
    }
    return acc;
  }, {} as Record<string, string>);
}

export function getEstrelaMetadata(file: string): {
  filename?: string;
  tag?: string;
} {
  const [filename, tag] = ESTRELA_FILE_REGEX.exec(file) ?? [];
  return { filename, tag };
}

export function getImportMap(
  source: ts.SourceFile
): Record<string, ImportMap | undefined>;
export function getImportMap(
  imports: ts.ImportDeclaration[]
): Record<string, ImportMap | undefined>;
export function getImportMap(
  sourceOrImports: ts.SourceFile | ts.ImportDeclaration[]
): Record<string, ImportMap | undefined> {
  const imports = Array.isArray(sourceOrImports)
    ? sourceOrImports
    : sourceOrImports.statements.filter(ts.isImportDeclaration);
  return imports.reduce((acc, _import) => {
    if (ts.isStringLiteral(_import.moduleSpecifier)) {
      const key = _import.moduleSpecifier.text;
      const defaultKey = _import.importClause?.name?.text;
      const imports =
        (_import.importClause?.namedBindings &&
          ts.isNamedImports(_import.importClause.namedBindings) &&
          _import.importClause.namedBindings.elements
            .map(
              element =>
                (ts.isImportSpecifier(element) && element.name.text) || ''
            )
            .filter(text => text !== '')) ||
        [];
      acc[key] = {
        defaultKey,
        imports,
      };
    }
    return acc;
  }, {} as Record<string, ImportMap>);
}

export function getVariableDeclarations(
  source: ts.SourceFile
): ts.VariableDeclaration[] {
  const declarations: ts.VariableDeclaration[] = [];
  const visitElements = (node: ts.Node) => {
    node.forEachChild(visitElements);
    if (ts.isVariableDeclaration(node)) {
      declarations.push(node);
    }
  };
  visitElements(source);
  return declarations;
}

export function isEstrelaFile(file: string): boolean {
  return ESTRELA_FILE_REGEX.test(file);
}
