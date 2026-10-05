import { REQUIREMENTS, typeDef } from './catalog';
import type {
  Classification,
  InsuranceContract,
  InsuranceTypeId,
  Profile,
  RequirementId,
  SocialKind,
} from './model';
import { SOCIAL_TYPE_BY_KIND } from './model';
import { isActiveOn } from './premium';

export interface GapItem {
  requirement: RequirementId;
  classification: Classification;
  /** Ids of the contracts that satisfy it (covered only). */
  contractIds: string[];
  /** Satisfied by a linked Earnings line instead of a contract. */
  linked: boolean;
}

export interface RedundantItem {
  contractId: string;
  type: InsuranceTypeId;
  /** The overlapping contract. */
  otherContractId: string;
  reason: 'COMBINATION' | 'INCLUDED_IN';
}

export interface GapResult {
  missing: GapItem[];
  covered: GapItem[];
  dismissed: GapItem[];
  redundant: RedundantItem[];
}

export interface GapInput {
  contracts: readonly InsuranceContract[];
  profile: Profile;
  dismissedRequirements: readonly RequirementId[];
  /** Statutory kinds shown from Earnings; they satisfy the matching statutory types. */
  linkedKinds?: readonly SocialKind[];
  /** When given, contracts not active on that date are ignored. */
  today?: string;
}

const ORDER: Record<Classification, number> = {
  ESSENTIAL: 0,
  RECOMMENDED: 1,
  SITUATIONAL: 2,
  OPTIONAL: 3,
};
const byClass = (a: GapItem, b: GapItem) => ORDER[a.classification] - ORDER[b.classification];

function classify(
  req: (typeof REQUIREMENTS)[number],
  current: readonly InsuranceContract[],
  linkedTypes: ReadonlySet<InsuranceTypeId>,
): GapItem {
  const contractIds = current
    .filter(
      (c) =>
        req.satisfiedBy.includes(c.type) || c.alsoCovers?.some((t) => req.satisfiedBy.includes(t)),
    )
    .map((c) => c.id);
  const linked = contractIds.length === 0 && req.satisfiedBy.some((t) => linkedTypes.has(t));
  return { requirement: req.id, classification: req.classification, contractIds, linked };
}

function findRedundant(current: readonly InsuranceContract[]): RedundantItem[] {
  const result: RedundantItem[] = [];
  for (const a of current) {
    const included = typeDef(a.type).usuallyIncludedIn ?? [];
    for (const b of current.filter((other) => other.id !== a.id)) {
      const reason = redundancyReason(a, b, included);
      if (reason) result.push({ contractId: a.id, type: a.type, otherContractId: b.id, reason });
    }
  }
  return result;
}

function redundancyReason(
  a: InsuranceContract,
  b: InsuranceContract,
  included: readonly InsuranceTypeId[],
): RedundantItem['reason'] | null {
  if (b.alsoCovers?.includes(a.type)) return 'COMBINATION';
  return included.includes(b.type) ? 'INCLUDED_IN' : null;
}

export function checkGaps(input: GapInput): GapResult {
  const current = input.contracts.filter((c) =>
    input.today ? isActiveOn(c, input.today) : c.status === 'ACTIVE',
  );
  const linkedTypes = new Set((input.linkedKinds ?? []).map((k) => SOCIAL_TYPE_BY_KIND[k]));
  const result: GapResult = { missing: [], covered: [], dismissed: [], redundant: [] };

  for (const req of REQUIREMENTS.filter((r) => r.appliesWhen(input.profile))) {
    const item = classify(req, current, linkedTypes);
    if (item.contractIds.length > 0 || item.linked) result.covered.push(item);
    else if (input.dismissedRequirements.includes(req.id)) result.dismissed.push(item);
    else if (req.classification !== 'OPTIONAL') result.missing.push(item);
  }

  result.redundant = findRedundant(current);
  result.missing.sort(byClass);
  result.covered.sort(byClass);
  return result;
}
