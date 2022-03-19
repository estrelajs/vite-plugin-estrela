import MagicString from 'magic-string';
import ts from 'typescript';
import { CodeReplace } from './interfaces';
import { Range } from './Range';
import {
  createSource,
  findTag,
  getJsxElements,
  getEstrelaFilename,
  getImportMap,
  getVariableDeclarations,
} from './utils';

export function preprocessScript(tag: string, script: string): CodeReplace[] {
  const codeReplaces: CodeReplace[] = [];
  const source = createSource(script);
  const importMap = getImportMap(source);
  const firstStatement = source.statements[Object.keys(importMap).length];
  const { jsxElements, jsxExpressions } = getJsxElements(source);

  codeReplaces.push({
    start: firstStatement ? firstStatement.getStart(source) : 0,
    content: `\ndefineElement("${tag}", host => {\n`,
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
            const range = Range.fromNode(callArg, source);
            codeReplaces.push({
              start: range.start,
              end: range.end,
              content: optionsArg,
            });
          } else {
            const range = Range.fromNode(node.initializer, source);
            codeReplaces.push({
              start: range.shift(-1).end,
              content: optionsArg,
            });
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

  // prepend "$" on jsx expressions braces.
  jsxExpressions.forEach(({ start }) => {
    codeReplaces.push({ start, content: '$' });
  });

  // add html directive for jsx elements.
  jsxElements.forEach(({ start, end }) => {
    codeReplaces.push({ start, content: ' html`' });
    codeReplaces.push({ start: end, content: '`' });
  });

  return codeReplaces;
}

export function preprocessFile(code: string, filePath: string) {
  const filename = getEstrelaFilename(filePath);
  const ms = new MagicString(code);

  const script = findTag('script', code);
  const template = findTag('template', code);
  const style = findTag('style', code);

  if (script) {
    const openingIndex = code.indexOf(script.opening);
    const closingIndex = code.indexOf(script.closing);
    const contentIndex = openingIndex + script.opening.length;
    const replaces = preprocessScript(
      script.attributes.tag ?? filename,
      script.content
    );

    ms.overwrite(
      openingIndex,
      openingIndex + script.opening.length,
      'import { defineElement, html } from "estrela";'
    );

    replaces.forEach(range => {
      if (range.end === undefined) {
        ms.appendLeft(range.start + contentIndex, range.content);
      } else {
        ms.overwrite(
          range.start + contentIndex,
          range.end + contentIndex,
          range.content
        );
      }
    });

    ms.overwrite(
      closingIndex,
      closingIndex + script.closing.length,
      'return () => html`'
    );
  } else {
    ms.prepend(
      'import { defineElement, html } from "estrela";\n' +
        `defineElement("${filename}", () => {\n` +
        'return () => html`\n'
    );
  }

  if (template) {
  } else {
    const start = script
      ? code.indexOf(script.fullContent) + script.fullContent.length
      : 0;
    const end = style ? code.indexOf(style.fullContent) : undefined;
    const scopedTemplate = code.slice(start, end);
    const shift = code.indexOf(scopedTemplate) - 2;
    const source = createSource(`<>${scopedTemplate}</>`);
    const { jsxElements, jsxExpressions } = getJsxElements(source, true);

    // prepend "$" on jsx expressions braces.
    jsxExpressions.forEach(range => {
      ms.prependLeft(range.shift(shift).start, '$');
    });

    // add html directive for jsx elements.
    jsxElements.forEach(range => {
      ms.prependLeft(range.shift(shift).start, ' html`');
      ms.appendRight(range.shift(shift).end, '`');
    });
  }

  if (style) {
    const openingIndex = code.indexOf(style.opening);
    const closingIndex = code.indexOf(style.closing);

    ms.overwrite(
      openingIndex,
      openingIndex + style.opening.length,
      '\n`;\n}, `\n'
    );

    ms.overwrite(closingIndex, closingIndex + style.closing.length, '`);');
  } else {
    // close html and open css
    ms.append('\n`;\n});');
  }

  return {
    code: ms.toString(),
    map: ms.generateMap({
      hires: true,
      source: filePath,
      file: filePath + '.map',
      includeContent: true,
    }),
  };
}
