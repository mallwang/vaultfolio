import { APPLICATION_AREAS } from '../core/layout/application-areas';

/** The icon and nav label of the domain that owns a tile, taken from its application area. */
export function tileDomainOf(domainId: string): { icon: string; labelKey: string } | null {
  const area = APPLICATION_AREAS.find((candidate) => candidate.domainId === domainId);
  return area ? { icon: area.icon, labelKey: area.labelKey } : null;
}
