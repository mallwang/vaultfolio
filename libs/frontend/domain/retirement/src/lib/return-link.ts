const RETURN_TABS = ['statutory', 'occupational', 'private'] as const;

/**
 * Where "Back"/"Cancel" of the form and import screens lead: the pillar tab they were opened
 * from (`?from=statutory|occupational|private`), else the overview. Unknown values are ignored.
 */
export function returnLink(from: string | null): string[] {
  return (RETURN_TABS as readonly string[]).includes(from ?? '')
    ? ['/app/retirement', from as string]
    : ['/app/retirement'];
}

/** Translation key of the "Back to …" label matching `returnLink`. */
export function returnLabelKey(from: string | null): string {
  const link = returnLink(from);
  return `retirement.backTo.${link[1] ?? 'overview'}`;
}
