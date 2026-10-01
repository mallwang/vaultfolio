import { ApiProperty } from '@nestjs/swagger';

/**
 * Mirrors `libs/api-contract/src/lib/requests.ts` (specs/033-parser-requests/contracts/
 * requests-api.md). Presentation-layer mirror only: the `earnings/new-parser` handler validates
 * the `payload` with the strict hand-written schema of `@vaultfolio/earnings` (Layout Submission
 * v1, contracts/layout-submission-v1.md), which rejects any unknown key.
 */

export class SubmitRequestDto {
  @ApiProperty({ example: 'earnings', description: 'Registry feature key.' })
  feature!: string;

  @ApiProperty({ example: 'new-parser', description: 'Registry request-type key.' })
  type!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Type-specific payload. For earnings/new-parser: a Layout Submission v1 — anonymized, structured layout data only (never a file, never original values).',
    example: {
      schemaVersion: 1,
      pages: [
        {
          width: 595.3,
          height: 841.9,
          lines: [
            {
              y: 96,
              size: 9,
              words: [
                { text: 'Brutto', x: 56.7 },
                { text: '3.842,17', x: 391.4 },
              ],
            },
          ],
        },
      ],
    },
  })
  payload!: Record<string, unknown>;
}

export class SubmitRequestResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  submittedAt!: string;

  @ApiProperty({
    description: 'Another open request has the same layout (non-blocking hint).',
  })
  possibleDuplicate!: boolean;
}

const STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED'];

export class RequestListItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() feature!: string;
  @ApiProperty() type!: string;
  @ApiProperty() requesterEmail!: string;
  @ApiProperty({ enum: STATUSES }) status!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty() possibleDuplicate!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) closedAt!: string | null;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'closedAt + 30 days while a sample exists.',
  })
  sampleDeletesAt!: string | null;
  @ApiProperty() hasSample!: boolean;
}

export class RequestListResponseDto {
  @ApiProperty({ description: 'OPEN + IN_PROGRESS regardless of the status filter.' })
  openCount!: number;
  @ApiProperty({ type: [RequestListItemDto] }) items!: RequestListItemDto[];
}

export class RequestAttachmentMetaDto {
  @ApiProperty() contentType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() pageCount!: number;
  @ApiProperty() sha256!: string;
  @ApiProperty() downloadCount!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastDownloadedAt!:
    string | null;
}

export class RequestDetailDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() feature!: string;
  @ApiProperty() type!: string;
  @ApiProperty() requesterEmail!: string;
  @ApiProperty({ enum: STATUSES }) status!: string;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, nullable: true }) handledByEmail!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) handledAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) closedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) sampleDeletesAt!:
    string | null;
  @ApiProperty() possibleDuplicate!: boolean;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Type-specific stored payload; null once the retention sweep removed it.',
  })
  payload!: unknown;
  @ApiProperty({ type: RequestAttachmentMetaDto, nullable: true })
  attachment!: RequestAttachmentMetaDto | null;
  @ApiProperty() sampleDeleted!: boolean;
}

export class UpdateRequestDto {
  @ApiProperty({ enum: STATUSES, required: false }) status?: string;
  @ApiProperty({ required: false, maxLength: 2000 }) note?: string;
}
