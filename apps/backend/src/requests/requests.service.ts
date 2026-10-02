import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  RequestErrorCode,
  type RequestDetail,
  type RequestListResponse,
  type RequestStatusDto,
  type SubmitRequestResponse,
  UserRole,
} from '@vaultfolio/api-contract';
import { BusinessException } from '@vaultfolio/observability';
import { findRequestType, REQUEST_LIMITS, REQUEST_STATUSES } from '@vaultfolio/requests';
import type { RequestUser } from '../auth/current-user.decorator';
import { REQUEST_TYPE_HANDLERS, type RequestTypeHandler } from './request-type-handler';
import {
  invalidSubmission,
  RequestForbiddenException,
  RequestLimitDailyException,
  RequestLimitOpenException,
  RequestNotFoundException,
  SampleDeletedException,
} from './requests.exceptions';
import { RequestsEmailService } from './requests-email.service';
import { RequestsRepository, type StoredRequest } from './requests.repository';

const DAY_MS = 24 * 60 * 60 * 1000;
const ENVELOPE_KEYS = new Set(['feature', 'type', 'payload']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const NOTE_MAX = 2000;

function deletesAt(closedAt: string | null): string | null {
  if (!closedAt) return null;
  return new Date(Date.parse(closedAt) + REQUEST_LIMITS.retentionDays * DAY_MS).toISOString();
}

function parseUpdate(body: unknown): { status?: RequestStatusDto; note?: string } {
  const invalid = () => invalidSubmission(RequestErrorCode.INVALID_REQUEST_UPDATE);
  if (!isRecord(body)) throw invalid();
  const { status, note } = body;
  if (Object.keys(body).some((key) => key !== 'status' && key !== 'note')) throw invalid();
  if (status === undefined && note === undefined) throw invalid();
  if (status !== undefined && !(REQUEST_STATUSES as readonly unknown[]).includes(status)) {
    throw invalid();
  }
  if (note !== undefined && (typeof note !== 'string' || note.length > NOTE_MAX)) throw invalid();
  return { status: status as RequestStatusDto | undefined, note: note as string | undefined };
}

/**
 * Generic request handling (033): registry lookup, entitlement and abuse limits, then the type's
 * handler validates the payload and builds the attachment; request and attachment are stored in
 * one transaction. Log lines carry ids, sizes, hashes and codes only (FR-023).
 */
@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    private readonly repository: RequestsRepository,
    @Inject(REQUEST_TYPE_HANDLERS) private readonly handlers: RequestTypeHandler[],
    private readonly mail: RequestsEmailService,
  ) {}

  submit(user: RequestUser, body: unknown): SubmitRequestResponse {
    try {
      return this.doSubmit(user, body);
    } catch (error) {
      if (error instanceof BusinessException) this.logRejection(error);
      throw error;
    }
  }

  private doSubmit(user: RequestUser, body: unknown): SubmitRequestResponse {
    const envelope = this.parseEnvelope(body);
    const definition = findRequestType(envelope.feature, envelope.type);
    const handler = this.handlers.find(
      (candidate) => candidate.feature === envelope.feature && candidate.type === envelope.type,
    );
    if (!definition || !handler) {
      throw invalidSubmission(RequestErrorCode.UNKNOWN_REQUEST_TYPE);
    }
    if (user.role !== UserRole.ADMIN && !user.domainScopes.includes(definition.requiredDomain)) {
      throw new RequestForbiddenException();
    }
    this.enforceLimits(user.id);

    const valid = handler.validate(envelope.payload);
    const attachment = handler.buildAttachment(valid);
    const fingerprint = handler.fingerprint(valid);
    const id = randomUUID();
    const submittedAt = new Date().toISOString();
    const sha256 = createHash('sha256').update(attachment.bytes).digest('hex');
    const possibleDuplicate = this.repository.hasOpenWithFingerprint(fingerprint);

    this.repository.insert({
      id,
      feature: envelope.feature,
      type: envelope.type,
      requesterId: user.id,
      payload: JSON.stringify(handler.toStoredPayload(valid)),
      layoutFingerprint: fingerprint,
      possibleDuplicate,
      createdAt: submittedAt,
      attachment: {
        contentType: attachment.contentType,
        bytes: attachment.bytes,
        sha256,
        pageCount: attachment.pageCount,
      },
    });

    this.logger.log({
      event: 'RequestSubmitted',
      requestId: id,
      feature: envelope.feature,
      type: envelope.type,
      sizeBytes: attachment.bytes.byteLength,
      sha256,
      possibleDuplicate,
    });
    // After commit; best effort, the mail service never rejects (FR-036).
    void this.mail.notifyAdmins({ id, feature: envelope.feature, type: envelope.type });
    return { id, submittedAt, possibleDuplicate };
  }

  list(statuses: readonly RequestStatusDto[]): RequestListResponse {
    return {
      openCount: this.repository.openCount(),
      items: this.repository.list(statuses).map((row) => ({
        ...row,
        sampleDeletesAt: row.hasSample ? deletesAt(row.closedAt) : null,
      })),
    };
  }

  detail(id: string): RequestDetail {
    return this.toDetail(this.requireRequest(id));
  }

  update(adminId: string, id: string, body: unknown): RequestDetail {
    const change = parseUpdate(body);
    const result = this.repository.update(id, change, adminId, new Date().toISOString());
    if (!result) throw new RequestNotFoundException();
    this.logger.log({
      event: 'RequestUpdated',
      requestId: id,
      feature: result.request.feature,
      type: result.request.type,
      status: result.request.status,
    });
    if (result.previousStatus !== 'DONE' && result.request.status === 'DONE') {
      void this.mail.notifyDone(result.request.requesterId, result.request);
    }
    return this.toDetail(result.request);
  }

  /** Returns the sample bytes and writes one audit row (FR-021). */
  downloadAttachment(adminId: string, id: string): { id: string; bytes: Buffer } {
    const request = this.requireRequest(id);
    const bytes = request.attachment ? this.repository.findAttachmentContent(id) : null;
    if (!bytes) throw new SampleDeletedException();
    this.repository.recordDownload(id, adminId, new Date().toISOString());
    this.logger.log({
      event: 'RequestSampleDownloaded',
      requestId: id,
      feature: request.feature,
      type: request.type,
      sizeBytes: bytes.byteLength,
      sha256: request.attachment?.sha256,
    });
    return { id, bytes };
  }

  private requireRequest(id: string): StoredRequest {
    const request = this.repository.findById(id);
    if (!request) throw new RequestNotFoundException();
    return request;
  }

  private toDetail(request: StoredRequest): RequestDetail {
    return {
      id: request.id,
      feature: request.feature,
      type: request.type,
      requesterEmail: request.requesterEmail,
      status: request.status,
      note: request.note,
      createdAt: request.createdAt,
      handledByEmail: request.handledByEmail,
      handledAt: request.handledAt,
      closedAt: request.closedAt,
      sampleDeletesAt: request.attachment ? deletesAt(request.closedAt) : null,
      possibleDuplicate: request.possibleDuplicate,
      payload: request.payload === null ? null : JSON.parse(request.payload),
      attachment: request.attachment,
      sampleDeleted: request.payloadPurgedAt !== null,
    };
  }

  private parseEnvelope(body: unknown): { feature: string; type: string; payload: unknown } {
    if (!isRecord(body)) throw invalidSubmission(RequestErrorCode.UNKNOWN_REQUEST_TYPE);
    if (Object.keys(body).some((key) => !ENVELOPE_KEYS.has(key))) {
      throw invalidSubmission(RequestErrorCode.LAYOUT_UNKNOWN_FIELD, '$');
    }
    if (typeof body['feature'] !== 'string' || typeof body['type'] !== 'string') {
      throw invalidSubmission(RequestErrorCode.UNKNOWN_REQUEST_TYPE);
    }
    return { feature: body['feature'], type: body['type'], payload: body['payload'] };
  }

  /** Open and daily limits (FR-040), checked before any validation work. */
  private enforceLimits(requesterId: string): void {
    if (this.repository.countOpenByRequester(requesterId) >= REQUEST_LIMITS.open) {
      throw new RequestLimitOpenException();
    }
    const since = new Date(Date.now() - DAY_MS).toISOString();
    if (this.repository.countSince(requesterId, since) >= REQUEST_LIMITS.perDay) {
      throw new RequestLimitDailyException();
    }
  }

  private logRejection(error: BusinessException): void {
    const response = error.getResponse() as { error: string };
    const kinds =
      response.error === RequestErrorCode.PERSONAL_DATA_DETECTED
        ? [...new Set((error.details ?? []).map((detail) => detail.message))]
        : undefined;
    this.logger.warn({ event: 'RequestRejected', errorCode: response.error, kinds });
  }
}
