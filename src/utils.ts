import ts from 'typescript';
import { ImportMap, TagMetadata } from './interfaces';
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

export function findTag(tag: string, code: string): TagMetadata | undefined {
  const pattern = `(<${tag}(.*?)>)(.*?)(<\/${tag}>)`;
  const regex = new RegExp(pattern, 's');

  const [fullContent, opening, attrs, content, closing] =
    regex.exec(code) ?? [];

  let match: RegExpExecArray | null;
  const tagRegex = /([\w-]+)=["']?([\w-]+)["']?/g;
  const attributes: Record<string, string> = {};

  while ((match = tagRegex.exec(attrs))) {
    const [, attr, value] = match;
    attributes[attr] = value;
  }

  if (fullContent) {
    return {
      tag,
      content,
      fullContent,
      attributes,
      opening,
      closing,
    };
  }

  return undefined;
}

export function getElements(
  source: ts.SourceFile,
  skipRoot?: boolean
): { jsxElements: Range[]; jsxExpressions: Range[] } {
  const jsxElements: Range[] = [];
  const jsxExpressions: Range[] = [];

  const visitElements = (node: ts.Node, isInClosure: boolean) => {
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
    jsxElements,
    jsxExpressions,
  };
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

export function getEstrelaFilename(file: string): string | undefined {
  const [, filename] = ESTRELA_FILE_REGEX.exec(file) ?? [];
  return filename;
}
