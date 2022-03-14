export interface ImportMap {
  defaultKey: string | undefined;
  imports: string[];
}

export interface Range {
  start: (shift?: number) => number;
  end: (shift?: number) => number;
}
