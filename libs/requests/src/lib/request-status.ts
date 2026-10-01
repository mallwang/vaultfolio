export const REQUEST_STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED'] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Statuses that start the sample retention countdown (FR-039). */
export const CLOSED_STATUSES: readonly RequestStatus[] = ['DONE', 'REJECTED'];

export const REQUEST_LIMITS = { open: 3, perDay: 5, retentionDays: 30 } as const;
