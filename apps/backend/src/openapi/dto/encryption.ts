import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ENCRYPTION_DOMAIN_IDS,
  ENCRYPTION_DOMAIN_STATES,
  ENCRYPTION_RUN_KINDS,
  ENCRYPTION_RUN_STATUSES,
} from '@vaultfolio/api-contract';

/** Mirrors `libs/api-contract/src/lib/encryption.ts` (specs/040-encryption-key-rotation/contracts). */

export class RotationRunDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ENCRYPTION_DOMAIN_IDS }) domain!: (typeof ENCRYPTION_DOMAIN_IDS)[number];
  @ApiProperty({ enum: ENCRYPTION_RUN_KINDS }) kind!: (typeof ENCRYPTION_RUN_KINDS)[number];
  @ApiProperty({ enum: ENCRYPTION_RUN_STATUSES }) status!: (typeof ENCRYPTION_RUN_STATUSES)[number];
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String }) finishedAt!:
    string | null;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'null for system runs such as the startup migration.',
  })
  triggeredByEmail!: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) fromVersion!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) toVersion!: number | null;
  @ApiProperty() recordsTotal!: number;
  @ApiProperty() recordsDone!: number;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Machine code only, never key material or row content.',
  })
  errorCode!: string | null;
}

export class DomainKeyStatusDto {
  @ApiProperty({ enum: ENCRYPTION_DOMAIN_IDS }) domain!: (typeof ENCRYPTION_DOMAIN_IDS)[number];
  @ApiProperty({ enum: ENCRYPTION_DOMAIN_STATES })
  state!: (typeof ENCRYPTION_DOMAIN_STATES)[number];
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Data key version used for writes; null while the domain has no usable key.',
  })
  currentVersion!: number | null;
  @ApiProperty({ type: [Number] }) retiredVersions!: number[];
  @ApiProperty({ description: 'Some data key is still wrapped with the previous master key.' })
  rotationPending!: boolean;
  @ApiProperty({
    description: 'A previous master key is configured but nothing depends on it any more.',
  })
  previousKeyRemovable!: boolean;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    description: 'key version -> row count across the domain’s tables (counts only).',
  })
  rowsPerVersion!: Record<string, number>;
  @ApiPropertyOptional({ type: RotationRunDto, nullable: true }) lastRun!: RotationRunDto | null;
  @ApiPropertyOptional({ type: RotationRunDto, nullable: true }) runningRun!: RotationRunDto | null;
}

export class EncryptionStatusResponseDto {
  @ApiProperty({ type: [DomainKeyStatusDto] }) domains!: DomainKeyStatusDto[];
}

export class EncryptionHistoryResponseDto {
  @ApiProperty({ type: [RotationRunDto] }) runs!: RotationRunDto[];
}

export class StartReencryptionRequestDto {
  @ApiProperty({ type: String, description: 'Must equal the domain id.', example: 'wealth' })
  confirm!: string;
}
