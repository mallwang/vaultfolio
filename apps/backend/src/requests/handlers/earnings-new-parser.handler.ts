import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestErrorCode } from '@vaultfolio/api-contract';
import {
  deriveRuleLabels,
  type LayoutSubmissionV1,
  layoutFingerprintInput,
  renderSamplePdf,
  scanDocument,
  toSheet,
  validateLayoutSubmission,
} from '@vaultfolio/earnings';
import { findRequestType } from '@vaultfolio/requests';
import { invalidSubmission } from '../requests.exceptions';
import type { RequestAttachmentBuild, RequestTypeHandler } from '../request-type-handler';

/**
 * `earnings/new-parser`: validates the browser's anonymized layout, scans it again for personal
 * data (a hit means a manipulated submission — FR-017), writes the sample PDF itself (the browser
 * never sends a file — FR-015/FR-018) and stores only the rule draft with server-derived labels.
 */
@Injectable()
export class EarningsNewParserHandler implements RequestTypeHandler<LayoutSubmissionV1> {
  readonly feature = 'earnings';
  readonly type = 'new-parser';

  validate(payload: unknown): LayoutSubmissionV1 {
    const result = validateLayoutSubmission(payload);
    if (!result.ok) throw invalidSubmission(result.code, result.path);

    // kinds and page/line only — never the text (contract: PERSONAL_DATA_DETECTED)
    const hits = scanDocument(result.value);
    if (hits.length > 0) {
      throw invalidSubmission(
        RequestErrorCode.PERSONAL_DATA_DETECTED,
        undefined,
        hits.map((hit) => ({
          field: `pages[${hit.page}].lines[${hit.line}]`,
          message: hit.kind,
        })),
      );
    }
    return result.value;
  }

  buildAttachment(valid: LayoutSubmissionV1): RequestAttachmentBuild {
    const bytes = renderSamplePdf(toSheet(valid));
    const maxBytes = findRequestType(this.feature, this.type)?.attachment.maxBytes;
    if (maxBytes !== undefined && bytes.byteLength > maxBytes) {
      throw invalidSubmission(RequestErrorCode.LIMIT_EXCEEDED, 'pages');
    }
    return { contentType: 'application/pdf', bytes, pageCount: valid.pages.length };
  }

  toStoredPayload(valid: LayoutSubmissionV1): Record<string, unknown> {
    return { ...deriveRuleLabels(valid) };
  }

  fingerprint(valid: LayoutSubmissionV1): string {
    return createHash('sha256').update(layoutFingerprintInput(valid)).digest('hex');
  }
}
