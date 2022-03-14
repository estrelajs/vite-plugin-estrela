import ts from 'typescript';
import { ImportMap, Range } from './interfaces';

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

export function getRange(node: ts.Node, source: ts.SourceFile): Range {
  const start = node.getStart(source) - 2; // minus fake fragment length
  const end = node.getEnd() - 2;
  return { start, end };
}

export function shiftRange(amount: number): (range: Range) => Range {
  return ({ start, end }: Range): Range => ({
    start: start + amount,
    end: end + amount,
  });
}

export function getEstrelaMetadata(file: string): {
  filename?: string;
  tag?: string;
} {
  const [filename, tag] = ESTRELA_FILE_REGEX.exec(file) ?? [];
  return { filename, tag };
}

export function isEstrelaFile(file: string): boolean {
  return ESTRELA_FILE_REGEX.test(file);
}
