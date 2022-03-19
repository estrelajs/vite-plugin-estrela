import MagicString from 'magic-string';
import ts from 'typescript';
import { CodeReplace } from './interfaces';
import { Range } from './Range';
import {
  createSource,
  getElementAttributes,
  getElements,
  getEstrelaMetadata,
  getImportMap,
  getVariableDeclarations,
} from './utils';

export function preprocessScript(tag: string, script: string): CodeReplace[] {
  const codeReplaces: CodeReplace[] = [];
  const source = createSource(script);
  const importMap = getImportMap(source);
  const firstStatement = source.statements[Object.keys(importMap).length];
  const { jsxElements, jsxExpressions } = getElements(source);

  codeReplaces.push({
    start: firstStatement ? firstStatement.getFullStart() : 0,
    content: `defineElement("${tag}", () => {\n`,
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
  const { filename, tag } = getEstrelaMetadata(filePath);

  const ms = new MagicString(code);
  const source = createSource(`<>${code}</>`);
  const { script, style, jsxElements, jsxExpressions } = getElements(
    source,
    true
  );

  if (script) {
    const startRange = Range.fromNode(script.openingElement, source);
    const endRange = Range.fromNode(script.closingElement, source);
    const scriptAttributes = getElementAttributes(script);
    const shift = script.openingElement.getEnd() + 2;
    const scriptContent = script.children
      .map(node => node.getFullText(source))
      .join('');
    const scriptReplaces = preprocessScript(
      scriptAttributes.tag || tag || '',
      scriptContent
    );

    ms.overwrite(
      startRange.shift(-2).start,
      startRange.shift(-2).end,
      'import { defineElement, html } from "estrela";'
    );

    scriptReplaces.forEach(range => {
      if (range.end === undefined) {
        ms.appendLeft(range.start + shift, range.content);
      } else {
        ms.overwrite(range.start + shift, range.end + shift, range.content);
      }
    });

    ms.overwrite(
      endRange.shift(-2).start,
      endRange.shift(-2).end,
      'return () => html`'
    );
  } else {
    ms.prepend(
      'import { defineElement, html } from "estrela";\n' +
        `defineElement("${tag}", () => {\n` +
        'return () => html`\n'
    );
  }

  // append render close
  ms.append('\n`;\n}');

  if (style) {
    const styleRange = Range.fromNode(style, source);
    const styleContent = style.children
      .map(node => node.getFullText(source))
      .join('');
    ms.remove(styleRange.shift(-2).start, styleRange.shift(-2).end);
    ms.append(', `\n' + styleContent + '`');

    // TODO: keep style in html when it has jsx expressions
  }

  // append defineElement close
  ms.append(');');

  // prepend "$" on jsx expressions braces.
  jsxExpressions.forEach(range => {
    ms.prependLeft(range.shift(-2).start, '$');
  });

  // add html directive for jsx elements.
  jsxElements.forEach(range => {
    ms.prependLeft(range.shift(-2).start, ' html`');
    ms.appendRight(range.shift(-2).end, '`');
  });

  // tried to trim lines
  // ms.toString()
  //   .split('\n')
  //   .reduce((index, line) => {
  //     const trimedLine = line.trimStart();
  //     const charCount = line.length - trimedLine.length;
  //     if (charCount > 0) {
  //       ms.remove(index, index + charCount);
  //       return index + line.length;
  //     }
  //     return index + 1;
  //   }, 0);

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
