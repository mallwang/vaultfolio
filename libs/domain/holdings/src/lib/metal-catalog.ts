/** The four supported precious metals (ISO 4217 codes). Display names come from i18n. */
export type MetalCode = 'XAU' | 'XAG' | 'XPT' | 'XPD';

export interface MetalCatalogEntry {
  readonly code: MetalCode;
  readonly symbol: string;
}

export const METAL_CATALOG: readonly MetalCatalogEntry[] = [
  { code: 'XAU', symbol: 'Au' },
  { code: 'XAG', symbol: 'Ag' },
  { code: 'XPT', symbol: 'Pt' },
  { code: 'XPD', symbol: 'Pd' },
];

export function findMetal(code: string): MetalCatalogEntry | undefined {
  return METAL_CATALOG.find((metal) => metal.code === code);
}
