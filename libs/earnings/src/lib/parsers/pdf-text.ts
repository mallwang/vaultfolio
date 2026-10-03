import { normalizeEmployerName } from '../model';

export {
  allLines,
  amountAtColumn,
  amountsIn,
  documentText,
  findLine,
  labelOf,
  parseGermanAmount,
  textDocument,
  textLine,
  type PdfDocumentText,
  type PdfLine,
  type PdfPageText,
  type PdfWord,
} from '@vaultfolio/document-text';

const LEGAL_FORM = /\b(?:GmbH & Co\. KG|GmbH|AG|SE|KGaA|KG|OHG|UG|mbH|e\.\s?V\.)(?=$|[\s,·|])/;

/**
 * Employer name from document lines: the first line naming a legal entity (GmbH, AG, SE, …), cut
 * after the legal form and before an address separator (` · `, ` | `, `,`). Shared by every parser
 * so a payslip and a certificate of one employer resolve to the same detected name (FR-020).
 */
export function employerFromLines(lines: readonly string[]): string | null {
  for (const line of lines) {
    const m = LEGAL_FORM.exec(line);
    if (m) {
      const name = line.slice(0, m.index + m[0].length).split(/\s[·|]\s|,/)[0];
      return normalizeEmployerName(name) || null;
    }
  }
  return null;
}
