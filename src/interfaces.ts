export interface CodeReplace {
  start: number;
  end?: number;
  content: string;
}

export interface ImportMap {
  defaultKey: string | undefined;
  imports: string[];
}

export interface TagMetadata {
  tag: string;
  attributes: Record<string, string>;
  content: string;
  fullContent: string;
  opening: string;
  closing: string;
}
