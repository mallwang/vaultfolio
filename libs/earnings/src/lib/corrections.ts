import { type EditableKey, isMoney, type Money, type PayRecordInput, toMoney } from './model';

const PLAIN = /^(-?)(\d+)(?:[.,](\d{2}))?$/;
const GERMAN = /^(-?)(\d{1,3}(?:\.\d{3})+),(\d{2})$/;
const ENGLISH = /^(-?)(\d{1,3}(?:,\d{3})+)\.(\d{2})$/;

/**
 * Canonical money from what a user typed (research R16): `1234.56`, `1.234,56`, `1,234.56`, `-45,00`
 * or a whole number. Rounds nothing — anything but exactly two decimals (or none) is ambiguous or
 * lossy and yields `null`, as does a value beyond the money range.
 */
export function parseMoneyInput(text: string): Money | null {
  const input = text.trim();
  const match = PLAIN.exec(input) ?? GERMAN.exec(input) ?? ENGLISH.exec(input);
  if (!match) return null;
  const [, sign, integer, cents] = match;
  const digits = integer.replace(/[.,]/g, '');
  const money = toMoney(`${sign}${digits}.${cents ?? '00'}`);
  return isMoney(money) ? money : null;
}

function figureOf(record: PayRecordInput, key: EditableKey): Money | null {
  return record.amounts[key];
}

/**
 * Pure: returns new records with one figure replaced and its name added to `corrected` (once).
 * `null` when the figure is not in the editable set (FR-004: the preview is no manual entry).
 * With `original` given, putting the read value back removes the name again.
 */
export function applyCorrection(
  records: readonly PayRecordInput[],
  edit: { recordIndex: number; key: EditableKey; value: Money },
  editable: readonly { recordIndex: number; key: EditableKey }[],
  original?: readonly PayRecordInput[],
): PayRecordInput[] | null {
  const { recordIndex, key, value } = edit;
  const record = records[recordIndex];
  if (!record || !editable.some((e) => e.recordIndex === recordIndex && e.key === key)) {
    return null;
  }
  const restored = original?.[recordIndex] && figureOf(original[recordIndex], key) === value;
  const others = (record.corrected ?? []).filter((k) => k !== key);
  const corrected = restored ? others : [...others, key];
  return records.map((r, i) => {
    if (i !== recordIndex) return r;
    const next: PayRecordInput = { ...r, amounts: { ...r.amounts, [key]: value } };
    delete next.corrected;
    return corrected.length > 0 ? { ...next, corrected } : next;
  });
}
