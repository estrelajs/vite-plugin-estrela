import MagicString from 'magic-string';
import ts from 'typescript';
import { Range } from './interfaces';
import {
  createSource,
  getEstrelaMetadata,
  getImportMap,
  getRange,
  shiftRange,
} from './utils';

interface ElementsResult {
  script: ts.JsxElement | undefined;
  style: ts.JsxElement | undefined;
  template: ts.JsxElement | undefined;
  jsxElements: Range[];
  jsxExpressions: Range[];
}

export function getElements(
  source: ts.SourceFile,
  skipRootJsx?: boolean
): ElementsResult {
  let script: ts.JsxElement | undefined = undefined;
  let style: ts.JsxElement | undefined = undefined;
  let template: ts.JsxElement | undefined = undefined;
  const jsxElements: Range[] = [];
  const jsxExpressions: Range[] = [];

  const visitElements = (node: ts.Node, isInJsxTree?: boolean) => {
    // check for <script>, <style> and <template>
    if (!isInJsxTree && ts.isJsxElement(node)) {
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
        node.forEachChild(visitElements);
        return;
      }
    }

    // get JsxElements respecting "skipRootJsx" logic
    if (ts.isJsxElement(node) && (!skipRootJsx || isInJsxTree)) {
      jsxElements.push(getRange(node, source));
    }

    // get JsxExpressions
    if (ts.isJsxExpression(node)) {
      jsxExpressions.push(getRange(node, source));
    }

    // iterate over children
    node.forEachChild(child =>
      visitElements(child, isInJsxTree || ts.isJsxElement(node))
    );
  };
  visitElements(source);

  return {
    script,
    style,
    template,
    jsxElements,
    jsxExpressions,
  };
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

export function parseScript(
  defaultTag: string | undefined,
  script: ts.JsxElement,
  source: ts.SourceFile,
  ms: MagicString
) {
  const openRange = getRange(script.openingElement, source);
  const closeRange = getRange(script.closingElement, source);
  const scriptShifter = shiftRange(script.openingElement.getWidth(source) + 2);

  const attributes = script.openingElement.attributes.properties.reduce(
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

  const scriptSource = createSource(
    script.children.map(child => child.getFullText(source)).join('')
  );
  const importMap = getImportMap(scriptSource);
  const importCount = Object.keys(importMap).length;

  // find prop and emitters to replace key
  if (importMap['estrela']?.imports) {
    const declarations = getVariableDeclarations(scriptSource);

    if (importMap['estrela'].imports.some(key => key === 'prop')) {
      declarations.forEach(node => {
        if (
          node.initializer &&
          ts.isCallExpression(node.initializer) &&
          ts.isIdentifier(node.initializer.expression) &&
          node.initializer.expression.text === 'prop' &&
          ts.isIdentifier(node.name)
        ) {
          const key = node.name.text;
          const callArg = node.initializer.arguments[0];
          const optionsArg = `{ key: '${key}', ...${
            callArg?.getText(scriptSource) ?? '{}'
          } }`;

          if (callArg) {
            const range = scriptShifter(getRange(callArg, scriptSource));
            ms.overwrite(range.start, range.end, optionsArg);
          } else {
            const _range = getRange(node.initializer, scriptSource);
            const range = scriptShifter(_range);
            ms.prependLeft(range.end, optionsArg);
          }
        }
      });
    }

    if (importMap['estrela'].imports.some(key => key === 'emitter')) {
    }
  }

  // add imports
  ms.overwrite(
    openRange.start,
    openRange.end,
    'import { defineElement, html } from "estrela";'
  );

  // add defineElement
  const elementStatement = scriptSource.statements[importCount];
  const elementRange = scriptShifter(getRange(elementStatement, scriptSource));
  ms.prependLeft(
    elementRange.start,
    `defineElement("${attributes.tag ?? defaultTag}", () => {\n`
  );

  // replace with element return
  ms.overwrite(closeRange.start, closeRange.end, 'return () => html`');

  // close final template string
  ms.append('`;\n});');

  const elements = getElements(scriptSource);
  const jsxElements = elements.jsxElements.map(scriptShifter);
  const jsxExpressions = elements.jsxExpressions.map(scriptShifter);

  return { jsxElements, jsxExpressions };
}

export function preprocess(code: string, filePath: string) {
  const { filename, tag } = getEstrelaMetadata(filePath);

  const ms = new MagicString(code);
  const source = createSource(`<>${code}</>`);
  const { script, jsxElements, jsxExpressions } = getElements(source, true);

  if (script) {
    const result = parseScript(tag, script, source, ms);
    jsxElements.push(...result.jsxElements);
    jsxExpressions.push(...result.jsxExpressions);
  } else {
    ms.prepend(
      'import { defineElement, html } from "estrela";\n' +
        `defineElement("${tag}", () => () => html\``
    );
    ms.append('`);');
  }

  // prepend "$" on jsx expressions braces.
  jsxExpressions.forEach(({ start }) => {
    ms.prependLeft(start, '$');
  });

  // add html directive for jsx elements.
  jsxElements.forEach(({ start, end }) => {
    ms.prependLeft(start, 'html`');
    ms.appendRight(end, '`');
  });

  return {
    code: ms.toString(),
    map: ms.generateMap({
      hires: true,
      source: filename,
      file: filename + '.map',
      includeContent: true,
    }),
  };
}
