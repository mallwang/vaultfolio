/** One external resource of the "Weiterführende Informationen" tab (FR-012). Text lives in i18n. */
export interface RetirementResource {
  id: 'drv' | 'finanzfluss' | 'finanztip';
  titleKey: string;
  descriptionKey: string;
  sourceKey: string;
  categoryKey: string;
  /** Plain link: opened in a new tab, no user data is attached (FR-012, FR-016). */
  url: string;
}

function resource(
  id: RetirementResource['id'],
  category: 'overview' | 'calculator' | 'guide',
  url: string,
): RetirementResource {
  const base = `retirement.info.resources.${id}`;
  return {
    id,
    titleKey: `${base}.title`,
    descriptionKey: `${base}.description`,
    sourceKey: `${base}.source`,
    categoryKey: `retirement.info.categories.${category}`,
    url,
  };
}

export const RETIREMENT_RESOURCES: ReadonlyArray<RetirementResource> = [
  resource(
    'drv',
    'overview',
    'https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/rente_node.html',
  ),
  resource(
    'finanzfluss',
    'calculator',
    'https://www.finanzfluss.de/rechner/rentenluecke-berechnen/',
  ),
  resource(
    'finanztip',
    'guide',
    'https://www.finanztip.de/gesetzliche-rentenversicherung/rentenluecke/',
  ),
];
