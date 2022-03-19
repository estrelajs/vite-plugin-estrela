import ts from 'typescript';
import { createSource, getElements, getEstrelaFilename } from '../src/utils';

describe('getElements', () => {
  it('should get jsx elements in template', () => {
    const content = `<div>Count is { count }</div>`;

    const source = createSource(content);
    const result1 = getElements(source, false);
    const result2 = getElements(source, true);

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

  it('should get estrela file name', () => {
    const file1 = 'src/app-root.estrela';
    const file2 = 'src/app-root.ts';

    const check1 = getEstrelaFilename(file1);
    const check2 = getEstrelaFilename(file2);

    expect(check1).toBe('app-root');
    expect(check2).toBe(undefined);
  });
});
