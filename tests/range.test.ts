import { Range } from '../src/Range';
import { createSource } from '../src/utils';

describe('Range', () => {
  it('should get range for node including spaces', () => {
    const content = `
      const arr: string = [ 'test' ];
      const test: string = arr[0];
      arr.push('ok');
    `;

    const source = createSource(content);
    const testNode = source.statements[1];
    const range = Range.fromNode(testNode);

    expect(testNode.getText(source)).toBe('const test: string = arr[0];');
    expect(range).toEqual({ start: 38, end: 73 });
  });

  it('should get range for node excluding spaces', () => {
    const content = `
      const arr: string = [ 'test' ];
      const test: string = arr[0];
      arr.push('ok');
    `;

    const source = createSource(content);
    const testNode = source.statements[1];
    const range = Range.fromNode(testNode, source);

    expect(testNode.getText(source)).toBe('const test: string = arr[0];');
    expect(range).toEqual({ start: 45, end: 73 });
  });
});
