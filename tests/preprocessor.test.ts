import ts from 'typescript';
import { getElements, preprocess } from '../src/preprocessor';
import { createSource } from '../src/utils';

describe('preprocessor', () => {
  const linesExtractor = (str: string) =>
    str
      .trim()
      .split('\n')
      .map(line => line.trim());

  test('getElements - no style and template tags', () => {
    const content = `
      <script tag="app-root">
        import { state } from 'estrela';
        const count = state(0);
        setInterval(() => count.update(value => ++value), 1000);
      </script>
      <div>Count is { count }</div>
    `;

    const source = createSource(content);
    const result1 = getElements(source, false);
    const result2 = getElements(source, true);

    // check script
    expect(ts.isJsxElement(result1.script!)).toBe(true);
    expect(ts.isJsxElement(result2.script!)).toBe(true);

    // check style
    expect(result1.style).toBe(undefined);
    expect(result2.style).toBe(undefined);

    // check template
    expect(result1.template).toBe(undefined);
    expect(result2.template).toBe(undefined);

    // check JsxElements
    expect(result1.jsxElements).toHaveLength(1);
    expect(result2.jsxElements).toHaveLength(0);
  });

  test('getElements - complete', () => {
    const content = `
      <script tag="app-root">
        import { state } from 'estrela';
        const count = state(0);
        setInterval(() => count.update(value => ++value), 1000);
      </script>
      <template>
        <div>Count is { count }</div>
      </template>
      <style>
        div {
          background: black;
        }
      </style>
    `;

    const source = createSource(content);
    const result1 = getElements(source, false);
    const result2 = getElements(source, true);

    // check script
    expect(ts.isJsxElement(result1.script!)).toBe(true);
    expect(ts.isJsxElement(result2.script!)).toBe(true);

    // check style
    expect(ts.isJsxElement(result1.style!)).toBe(true);
    expect(ts.isJsxElement(result2.style!)).toBe(true);

    // check template
    expect(ts.isJsxElement(result1.template!)).toBe(true);
    expect(ts.isJsxElement(result2.template!)).toBe(true);

    // check JsxElements
    expect(result1.jsxElements).toHaveLength(1);
    expect(result2.jsxElements).toHaveLength(0);
  });

  test('preprocess - basic', () => {
    const file = 'app.estrela';
    const content = `
      <script tag="app-root">
        import { state } from 'estrela';
        const count = state(0);
        setInterval(() => count.update(value => ++value), 1000);
      </script>
      <div>Count is { count }</div>
    `;

    const { code } = preprocess(content, file);

    const expected = `
      import { defineElement, html } from "estrela";
      import { state } from 'estrela';
      defineElement("app-root", () => {
        const count = state(0);
        setInterval(() => count.update(value => ++value), 1000);
        return () => html\`
          <div>Count is \${ count }</div>
        \`;
      });
    `;

    expect(linesExtractor(code)).toEqual(linesExtractor(expected));
  });
});
