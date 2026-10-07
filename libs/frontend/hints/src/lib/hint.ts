export type HintSeverity = 'warning' | 'info';

export interface HintTarget {
  commands: string[];
  queryParams?: Record<string, string>;
}

export interface Hint {
  id: string;
  severity: HintSeverity;
  titleKey: string;
  descriptionKey: string;
  params?: Record<string, string | number>;
  target: HintTarget;
  linkLabelKey: string;
}
