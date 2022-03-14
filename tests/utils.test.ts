import ts from 'typescript';
import { Range } from '../src/interfaces';
import {
  createSource,
  getEstrelaMetadata,
  getRange,
  isEstrelaFile,
  shiftRange,
} from '../src/utils';

describe('utils', () => {
  it('should create ts source', () => {
    const content = 'const arr: string = [];';
    const source = createSource(content);
    const isSouce = ts.isSourceFile(source);
    expect(isSouce).toBe(true);
    expect(source.getFullText()).toBe(content);
  });

  it('should get range for node', () => {
    const content = `
      const arr: string = [ 'test' ];
      const test: string = arr[0];
      arr.push('ok');
    `;

    const source = createSource(content);
    const testNode = source.statements[1];
    const range = getRange(testNode, source);

    expect(testNode.getText(source)).toBe('const test: string = arr[0];');
    expect(range).toEqual({ start: 43, end: 71 });
  });

  it('should create a range shifter', () => {
    const range: Range = { start: 10, end: 30 };
    const rangeShifter = shiftRange(5);
    const result = rangeShifter(range);

    expect(typeof rangeShifter).toBe('function');
    expect(result).toEqual({ start: 15, end: 35 });
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
