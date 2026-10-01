export interface RequestTypeDefinition {
  feature: string;
  type: string;
  names: { en: string; de: string };
  featureNames: { en: string; de: string };
  /** Domain entitlement a user needs to submit this type (admins always pass). */
  requiredDomain: string;
  attachment: { allowed: boolean; contentType?: 'application/pdf'; maxBytes?: number };
}

/** One row per request type; a new feature adds a row, a backend handler and an optional admin view. */
export const REQUEST_TYPES: readonly RequestTypeDefinition[] = [
  {
    feature: 'earnings',
    type: 'new-parser',
    names: { en: 'New parser', de: 'Neuer Parser' },
    featureNames: { en: 'Earnings', de: 'Einkommen' },
    requiredDomain: 'earnings',
    attachment: { allowed: true, contentType: 'application/pdf', maxBytes: 512 * 1024 },
  },
];

export function findRequestType(feature: string, type: string): RequestTypeDefinition | undefined {
  return REQUEST_TYPES.find((def) => def.feature === feature && def.type === type);
}

export function requestTypeLabel(
  def: RequestTypeDefinition,
  lang: 'en' | 'de',
): { feature: string; type: string } {
  return { feature: def.featureNames[lang], type: def.names[lang] };
}
