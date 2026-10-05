const LABELS: Record<string, { de: string; en: string }> = {
  STATUTORY_HEALTH: { de: 'Gesetzliche Krankenversicherung', en: 'Statutory health insurance' },
  STATUTORY_CARE: {
    de: 'Gesetzliche Pflegeversicherung',
    en: 'Statutory long-term care insurance',
  },
  STATUTORY_PENSION: { de: 'Gesetzliche Rentenversicherung', en: 'Statutory pension insurance' },
  STATUTORY_UNEMPLOYMENT: {
    de: 'Gesetzliche Arbeitslosenversicherung',
    en: 'Statutory unemployment insurance',
  },
  PRIVATE_HEALTH: { de: 'Private Krankenversicherung', en: 'Private health insurance' },
  SUPPLEMENTARY_HEALTH: { de: 'Krankenzusatzversicherung', en: 'Supplementary health insurance' },
  DENTAL_SUPPLEMENT: { de: 'Zahnzusatzversicherung', en: 'Dental supplement' },
  TRAVEL_HEALTH: { de: 'Auslandsreisekrankenversicherung', en: 'Travel health insurance' },
  LONG_TERM_CARE: { de: 'Pflegezusatzversicherung', en: 'Long-term care insurance' },
  DISABILITY: { de: 'Berufsunfähigkeitsversicherung', en: 'Disability insurance' },
  TERM_LIFE: { de: 'Risikolebensversicherung', en: 'Term life insurance' },
  ACCIDENT: { de: 'Unfallversicherung', en: 'Accident insurance' },
  PRIVATE_LIABILITY: { de: 'Privathaftpflicht', en: 'Private liability insurance' },
  PET_LIABILITY: { de: 'Tierhalterhaftpflicht', en: 'Pet liability insurance' },
  PROPERTY_OWNER_LIABILITY: {
    de: 'Haus- und Grundbesitzerhaftpflicht',
    en: 'Property owner liability insurance',
  },
  HOUSEHOLD: { de: 'Hausratversicherung', en: 'Household contents insurance' },
  BUILDING: { de: 'Wohngebäudeversicherung', en: 'Residential building insurance' },
  NATURAL_HAZARD: { de: 'Elementarschadenversicherung', en: 'Natural-hazard insurance' },
  GLASS: { de: 'Glasversicherung', en: 'Glass insurance' },
  CAR: { de: 'Kfz-Versicherung', en: 'Car insurance' },
  BICYCLE: { de: 'Fahrradversicherung', en: 'Bicycle insurance' },
  LEGAL_PROTECTION: { de: 'Rechtsschutzversicherung', en: 'Legal protection insurance' },
  OTHER: { de: 'Sonstige Versicherung', en: 'Other insurance' },
};

/** Label of a catalog type in the e-mail language; falls back to the id. */
export function insuranceTypeLabel(typeId: string, language: 'de' | 'en'): string {
  return LABELS[typeId]?.[language] ?? typeId;
}
