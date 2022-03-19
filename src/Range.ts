import ts from 'typescript';

export class Range {
  constructor(public readonly start: number, public readonly end: number) {}

  shift(ammount: number): Range {
    return new Range(this.start + ammount, this.end + ammount);
  }

  static fromNode(node: ts.Node, source?: ts.SourceFile): Range {
    return new Range(
      source ? node.getStart(source) : node.getFullStart(),
      node.getEnd()
    );
  }
}
