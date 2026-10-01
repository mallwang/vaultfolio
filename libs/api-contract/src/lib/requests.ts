/**
 * Shared contract for the Requests API — see
 * specs/033-parser-requests/contracts/requests-api.md. Plain TypeScript
 * interfaces, no runtime dependency (Principle II). The status literals mirror
 * `REQUEST_STATUSES` in `@vaultfolio/requests`, which this library must not import.
 */

export type RequestStatusDto = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';

/** `payload` is type specific; for `earnings/new-parser` it is a Layout Submission v1. */
export interface SubmitRequestBody {
  feature: string;
  type: string;
  payload: unknown;
}

export interface SubmitRequestResponse {
  id: string;
  submittedAt: string;
  possibleDuplicate: boolean;
}

export interface RequestListItem {
  id: string;
  feature: string;
  type: string;
  requesterEmail: string;
  status: RequestStatusDto;
  createdAt: string;
  possibleDuplicate: boolean;
  closedAt: string | null;
  sampleDeletesAt: string | null;
  hasSample: boolean;
}

export interface RequestListResponse {
  /** OPEN + IN_PROGRESS regardless of the status filter (tab badge). */
  openCount: number;
  items: RequestListItem[];
}

export interface RequestAttachmentMeta {
  contentType: string;
  sizeBytes: number;
  pageCount: number;
  sha256: string;
  downloadCount: number;
  lastDownloadedAt: string | null;
}

export interface RequestDetail {
  id: string;
  feature: string;
  type: string;
  requesterEmail: string;
  status: RequestStatusDto;
  note: string | null;
  createdAt: string;
  handledByEmail: string | null;
  handledAt: string | null;
  closedAt: string | null;
  sampleDeletesAt: string | null;
  possibleDuplicate: boolean;
  /** Type-specific stored payload; null once the retention sweep removed it. */
  payload: unknown;
  /** Null once the retention sweep removed the sample. */
  attachment: RequestAttachmentMeta | null;
  sampleDeleted: boolean;
}

export interface UpdateRequestBody {
  status?: RequestStatusDto;
  note?: string;
}

export const RequestErrorCode = {
  UNKNOWN_REQUEST_TYPE: 'UNKNOWN_REQUEST_TYPE',
  INVALID_LAYOUT: 'INVALID_LAYOUT',
  LAYOUT_UNKNOWN_FIELD: 'LAYOUT_UNKNOWN_FIELD',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  PERSONAL_DATA_DETECTED: 'PERSONAL_DATA_DETECTED',
  INVALID_RULE_DRAFT: 'INVALID_RULE_DRAFT',
  REQUEST_LIMIT_OPEN: 'REQUEST_LIMIT_OPEN',
  REQUEST_LIMIT_DAILY: 'REQUEST_LIMIT_DAILY',
  REQUEST_NOT_FOUND: 'REQUEST_NOT_FOUND',
  SAMPLE_DELETED: 'SAMPLE_DELETED',
  INVALID_REQUEST_UPDATE: 'INVALID_REQUEST_UPDATE',
} as const;

export type RequestErrorCode = (typeof RequestErrorCode)[keyof typeof RequestErrorCode];

/** Personal-data kinds reported (never the text) by a `PERSONAL_DATA_DETECTED` rejection. */
export interface PersonalDataFinding {
  kind: string;
  page: number;
  line: number;
}
