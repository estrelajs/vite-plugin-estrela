import ts from 'typescript';
import {
  createSource,
  getElements,
  getEstrelaMetadata,
  isEstrelaFile,
} from '../src/utils';

describe('getElements', () => {
  test('no style and template tags', () => {
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

  test('complete', () => {
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
});

describe('utils', () => {
  it('should create ts source', () => {
    const content = 'const arr: string = [];';
    const source = createSource(content);
    const isSouce = ts.isSourceFile(source);
    expect(isSouce).toBe(true);
    expect(source.getFullText()).toBe(content);
  });

  it('should get Estrela metadata from file path', () => {
    const file1 = 'src/app-root.estrela';
    const file2 = 'src/app-root.ts';

    const meta1 = getEstrelaMetadata(file1);
    const meta2 = getEstrelaMetadata(file2);

    expect(meta1).toEqual({ filename: 'app-root.estrela', tag: 'app-root' });
    expect(meta2).toEqual({ filename: undefined, tag: undefined });
  });

  it('should check if is Estrela file', () => {
    const file1 = 'src/app-root.estrela';
    const file2 = 'src/app-root.ts';

    const check1 = isEstrelaFile(file1);
    const check2 = isEstrelaFile(file2);

    expect(check1).toBe(true);
    expect(check2).toBe(false);
  });
});
