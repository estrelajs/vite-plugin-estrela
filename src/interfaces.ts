import ts from 'typescript';
import { Range } from './Range';

export interface CodeReplace {
  start: number;
  end?: number;
  content: string;
}

export interface ElementsResult {
  script: ts.JsxElement | undefined;
  style: ts.JsxElement | undefined;
  template: ts.JsxElement | undefined;
  jsxElements: Range[];
  jsxExpressions: Range[];
}

export interface ImportMap {
  defaultKey: string | undefined;
  imports: string[];
}
