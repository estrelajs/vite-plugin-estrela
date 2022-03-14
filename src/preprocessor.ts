import MagicString from 'magic-string';
import ts from 'typescript';
import { Range } from './interfaces';
import {
  createSource,
  getElementAttributes,
  getEstrelaMetadata,
  getImportMap,
  getRange,
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
      jsxElements.push(getRange(node));
    }

    // get JsxExpressions
    if (ts.isJsxExpression(node)) {
      jsxExpressions.push(getRange(node));
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

export function preprocessScript(tag: string, script: string) {
  script = script.trim();

  const ms = new MagicString(script);
  const source = createSource(script);
  const importMap = getImportMap(source);
  const firstStatementIndex = Object.keys(importMap).length;

  ms.prependLeft(
    getRange(source.statements[firstStatementIndex]).start(),
    `${firstStatementIndex === 0 ? '' : '\n'}defineElement("${tag}", () => {\n`
  );
  ms.prepend('import { defineElement, html, css } from "estrela";\n');

  const { jsxElements, jsxExpressions } = getElements(source);

  // prepend "$" on jsx expressions braces.
  jsxExpressions.forEach(({ start }) => {
    ms.prependLeft(start(), '$');
  });

  // add html directive for jsx elements.
  jsxElements.forEach(({ start, end }) => {
    ms.prependLeft(start(), ' html`');
    ms.appendRight(end(), '`');
  });

  // find prop and emitters to replace key
  if (importMap['estrela']?.imports) {
    const declarations = getVariableDeclarations(source);

    const parseOptionsFor = (key: 'emitter' | 'prop') => {
      declarations.forEach(node => {
        if (
          node.initializer &&
          ts.isCallExpression(node.initializer) &&
          ts.isIdentifier(node.initializer.expression) &&
          node.initializer.expression.text === key &&
          ts.isIdentifier(node.name)
        ) {
          const key = node.name.text;
          const callArg = node.initializer.arguments[0];
          const optionsArg = callArg
            ? `{ key: "${key}", ...${callArg.getText(source)} }`
            : `{ key: "${key}" }`;

          if (callArg) {
            const range = getRange(callArg);
            ms.overwrite(range.start(), range.end(), optionsArg);
          } else {
            const range = getRange(node.initializer);
            ms.prependLeft(range.end() - 1, optionsArg);
          }
        }
      });
    };

    if (importMap['estrela'].imports.some(key => key === 'emitter')) {
      parseOptionsFor('emitter');
    }

    if (importMap['estrela'].imports.some(key => key === 'prop')) {
      parseOptionsFor('prop');
    }
  }

  return ms.toString();
}

export function preprocessFile(code: string, filePath: string) {
  const { filename, tag } = getEstrelaMetadata(filePath);

  const ms = new MagicString(code);
  const source = createSource(`<>${code}</>`);
  const { script, style, jsxElements, jsxExpressions } = getElements(
    source,
    true
  );

  if (script) {
    const scriptRange = getRange(script);
    const scriptAttributes = getElementAttributes(script);
    const scriptContent = script.children
      .map(node => node.getFullText(source))
      .join('');
    const scriptResult = preprocessScript(
      scriptAttributes.tag || tag || '',
      scriptContent
    );
    ms.overwrite(scriptRange.start(-2), scriptRange.end(-2), scriptResult);
    ms.appendRight(scriptRange.end(-2), '\nreturn () => html`');
  } else {
    ms.prepend(
      'import { defineElement, html, css } from "estrela";\n' +
        `defineElement("${tag}", () => {\n` +
        'return () => html`\n'
    );
  }

  // append render close
  ms.append('\n`;\n}');

  if (style) {
    const styleRange = getRange(style);
    const styleContent = style.children
      .map(node => node.getFullText(source))
      .join('');
    ms.remove(styleRange.start(-2), styleRange.end(-2));
    ms.append(', css`\n' + styleContent + '`');

    // TODO: keep style in html when it has jsx expressions
  }

  // append defineElement close
  ms.append(');');

  // prepend "$" on jsx expressions braces.
  jsxExpressions.forEach(({ start }) => {
    ms.prependLeft(start(-2), '$');
  });

  // add html directive for jsx elements.
  jsxElements.forEach(({ start, end }) => {
    ms.prependLeft(start(-2), ' html`');
    ms.appendRight(end(-2), '`');
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
