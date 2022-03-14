import ts from 'typescript';
import {
  getElements,
  preprocessFile,
  preprocessScript,
} from '../src/preprocessor';
import { createSource } from '../src/utils';

describe('preprocessor', () => {
  const linesExtractor = (str: string) =>
    str
      .split('\n')
      .map(line => line.trim())
      .filter(line => !/^(\s+)?$/.test(line));

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

  test('preprocessScript - jsx', () => {
    const script = `
      const data = <div>Count is { count }</div>`;

    const expected = `
      import { defineElement, html } from "estrela";
      defineElement("app-root", () => {
        const data = html\` <div>Count is \${ count }</div>\``;

    const result = preprocessScript('app-root', script);

    expect(linesExtractor(result)).toEqual(linesExtractor(expected));
  });

  test('preprocessScript - prop', () => {
    const script = `
      import { prop } from 'estrela';
      const count = prop<number>();`;

    const expected = `
      import { defineElement, html } from "estrela";
      import { prop } from 'estrela';
      defineElement("app-root", () => {
      const count = prop<number>({ key: "count" });`;

    const result = preprocessScript('app-root', script);

    expect(linesExtractor(result)).toEqual(linesExtractor(expected));
  });

  test('preprocessScript - emitter', () => {
    const script = `
      import { emitter } from 'estrela';
      const count = emitter<number>({ async: true });`;

    const expected = `
      import { defineElement, html } from "estrela";
      import { emitter } from 'estrela';
      defineElement("app-root", () => {
      const count = emitter<number>({ key: "count", ...{ async: true } });`;

    const result = preprocessScript('app-root', script);

    expect(linesExtractor(result)).toEqual(linesExtractor(expected));
  });

  test('preprocessFile - script', () => {
    const file = 'app.estrela';
    const content = `
      <script tag="app-root">
        import { state } from 'estrela';
        const count = state(0);
        setInterval(() => count.update(value => ++value), 1000);
      </script>
      <div>Count is { count() && <span>{count}</span> }</div>`;

    const { code } = preprocessFile(content, file);

    const expected = `
      import { defineElement, html } from "estrela";
      import { state } from 'estrela';
      defineElement("app-root", () => {

        const count = state(0);
        setInterval(() => count.update(value => ++value), 1000);
        return () => html\`
          <div>Count is \${ count() && html\` <span>\${count}</span>\` }</div>
        \`;
      });`;

    expect(linesExtractor(code)).toEqual(linesExtractor(expected));
  });

  test('preprocessFile - no script', () => {
    const file = 'app.estrela';
    const content = `<h1>Hello World!</h1>`;

    const { code } = preprocessFile(content, file);

    const expected = `
      import { defineElement, html } from "estrela";
      defineElement("app", () => {
        return () => html\`
          <h1>Hello World!</h1>
        \`;
      });`;

    expect(linesExtractor(code)).toEqual(linesExtractor(expected));
  });
});
