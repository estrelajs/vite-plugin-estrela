import MagicString from "magic-string";
import ts from "typescript";
import { Plugin } from "vite";

interface Range {
  start: number;
  end: number;
}

const ESTRELA_FILE_REGEX = /([\w-]+)\.estrela$/;

const createSource = (content: string) => {
  return ts.createSourceFile(
    "file.ts",
    content,
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TSX
  );
};

const getRange = (node: ts.Node, source: ts.SourceFile): Range => {
  const start = node.getStart(source) - 2; // minus fake fragment length
  const end = node.getEnd() - 2;
  return { start, end };
};

const shiftRange =
  (amount: number) =>
  ({ start, end }: Range): Range => ({
    start: start + amount,
    end: end + amount,
  });

const getElements = (source: ts.SourceFile, skipRootJsx?: boolean) => {
  let script: ts.JsxElement | undefined;
  const jsxElements: Range[] = [];
  const jsxExpressions: Range[] = [];

  const visitElements = (node: ts.Node, isInJsxTree?: boolean) => {
    if (
      ts.isJsxElement(node) &&
      ts.isIdentifier(node.openingElement.tagName) &&
      node.openingElement.tagName.text === "script"
    ) {
      script = node;
      return;
    }
    node.forEachChild((child) =>
      visitElements(child, isInJsxTree || ts.isJsxElement(node))
    );
    if (ts.isJsxElement(node) && (!skipRootJsx || isInJsxTree)) {
      jsxElements.push(getRange(node, source));
    }
    if (ts.isJsxExpression(node)) {
      jsxExpressions.push(getRange(node, source));
    }
  };

  visitElements(source);
  return { script, jsxElements, jsxExpressions };
};

const compileEstrela = (code: string, filePath: string) => {
  let [filename, tag] = ESTRELA_FILE_REGEX.exec(filePath) ?? [];

  const ms = new MagicString(code);
  const source = createSource(`<>${code}</>`);
  const { script, jsxElements, jsxExpressions } = getElements(source, true);

  if (script) {
    const scriptOpenRange = getRange(script.openingElement, source);
    const scriptCloseRange = getRange(script.closingElement, source);
    const scriptShifter = shiftRange(
      script.openingElement.getWidth(source) + 2
    );
    const scriptAttributes = script.openingElement.attributes.properties.reduce(
      (acc, attr) => {
        if (
          ts.isJsxAttribute(attr) &&
          attr.initializer &&
          ts.isStringLiteral(attr.initializer)
        ) {
          acc[String(attr.name.text)] = attr.initializer.text;
        }
        return acc;
      },
      {} as Record<string, string>
    );

    const scriptContent = script.children
      .map((child) => child.getFullText(source))
      .join("");

    const scriptSource = createSource(scriptContent);
    const elements = getElements(scriptSource);
    jsxElements.push(...elements.jsxElements.map(scriptShifter));
    jsxExpressions.push(...elements.jsxExpressions.map(scriptShifter));

    // replace imports
    const imports = scriptSource.statements.filter((node) =>
      ts.isImportDeclaration(node)
    ) as ts.ImportDeclaration[];

    ms.overwrite(
      scriptOpenRange.start,
      scriptOpenRange.end,
      'import { defineElement, html } from "estrela";'
    );

    // add defineElement
    const elementStatement = scriptSource.statements[imports.length];
    const elementRange = scriptShifter(
      getRange(elementStatement, scriptSource)
    );
    ms.prependLeft(
      elementRange.start,
      `defineElement("${scriptAttributes.tag ?? tag}", () => {\n`
    );

    // replace with element return
    ms.overwrite(
      scriptCloseRange.start,
      scriptCloseRange.end,
      "return () => html`"
    );

    // close final template string
    ms.append("`;\n});");
  } else {
    ms.prepend(
      'import { defineElement, html } from "estrela";\n' +
        `defineElement("${tag}", () => () => html\``
    );
    ms.append("`);");
  }

  // prepend "$" on jsx expressions braces.
  jsxExpressions.forEach(({ start }) => {
    ms.prependLeft(start, "$");
  });

  // add html directive for jsx elements.
  jsxElements.forEach(({ start, end }) => {
    ms.prependLeft(start, "html`");
    ms.appendRight(end, "`");
  });

  return {
    code: ms.toString(),
    map: ms.generateMap({
      hires: true,
      source: filename,
      file: filename + ".map",
      includeContent: true,
    }),
  };
};

export default function (): Plugin {
  return {
    name: "vite-plugin-estrela",
    transform(code, id) {
      return ESTRELA_FILE_REGEX.test(id) ? compileEstrela(code, id) : code;
    },
  };
}
