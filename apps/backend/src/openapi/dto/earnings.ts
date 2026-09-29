import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Mirrors `libs/api-contract/src/lib/earnings.ts` (specs/032-earnings-domain/contracts/
 * earnings-api.md). Every monetary field is a canonical decimal string with two decimal places;
 * ratios have four. Presentation-layer mirror only — the service validates import bodies with the
 * strict whitelist of `@vaultfolio/earnings` (unknown keys are rejected at any depth).
 */

const MONEY = {
  type: String,
  example: '1234.56',
  description: 'Canonical decimal string, 2 decimal places.',
};
const MONEY_NULLABLE = { ...MONEY, nullable: true };
const RATIO = { type: String, example: '0.6160', description: 'Decimal string, 4 decimal places.' };
const PERIOD = { type: String, example: '2026-09', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' };
const RECORD_KINDS = ['REGULAR', 'CORRECTION', 'PAYOUT_ONLY'] as const;
const SOURCE_TYPES = ['PAYSLIP_PDF', 'CERTIFICATE_PDF', 'EXPORT_JSON'] as const;

export class EarningsOneOffAmountsDto {
  @ApiPropertyOptional(MONEY) gross?: string;
  @ApiPropertyOptional(MONEY) taxGross?: string;
  @ApiPropertyOptional(MONEY) wageTax?: string;
  @ApiPropertyOptional(MONEY) soli?: string;
  @ApiPropertyOptional(MONEY) churchTax?: string;
  @ApiPropertyOptional(MONEY) health?: string;
  @ApiPropertyOptional(MONEY) care?: string;
  @ApiPropertyOptional(MONEY) pension?: string;
  @ApiPropertyOptional(MONEY) unemployment?: string;
}

export class EarningsEmployerSubsidyDto {
  @ApiProperty(MONEY) health!: string;
  @ApiProperty(MONEY) care!: string;
}

export class EarningsCheckResultDto {
  @ApiProperty({ enum: ['NET', 'PAYOUT'] }) code!: 'NET' | 'PAYOUT';
  @ApiProperty() passed!: boolean;
  @ApiProperty({ ...MONEY, description: 'Signed expected − actual.' }) difference!: string;
}

export class EarningsPayRecordAmountsDto {
  @ApiProperty(MONEY) gross!: string;
  @ApiProperty(MONEY) taxGross!: string;
  @ApiProperty(MONEY) svGrossKv!: string;
  @ApiProperty(MONEY) svGrossRv!: string;
  @ApiProperty(MONEY) wageTax!: string;
  @ApiProperty(MONEY) soli!: string;
  @ApiProperty(MONEY) churchTax!: string;
  @ApiProperty(MONEY) health!: string;
  @ApiProperty(MONEY) care!: string;
  @ApiProperty(MONEY) pension!: string;
  @ApiProperty(MONEY) unemployment!: string;
  @ApiProperty(MONEY) net!: string;
  @ApiProperty(MONEY) other!: string;
  @ApiProperty({
    ...MONEY_NULLABLE,
    description: "Only on the section of the payslip's own month.",
  })
  payout!: string | null;
  @ApiProperty({ type: EarningsOneOffAmountsDto }) oneOff!: EarningsOneOffAmountsDto;
  @ApiProperty({ type: EarningsEmployerSubsidyDto, nullable: true })
  employerSubsidy!: EarningsEmployerSubsidyDto | null;
  @ApiProperty({
    type: EarningsOneOffAmountsDto,
    nullable: true,
    description: 'Printed year-to-date totals.',
  })
  ytd!: EarningsOneOffAmountsDto | null;
}

export class EarningsStoredPayRecordAmountsDto extends EarningsPayRecordAmountsDto {
  @ApiProperty({ type: [EarningsCheckResultDto] }) checks!: EarningsCheckResultDto[];
}

export class EarningsCertificateAmountsDto {
  @ApiProperty({ ...MONEY, description: 'Line 3' }) grossWage!: string;
  @ApiProperty({ ...MONEY, description: 'Line 4' }) wageTax!: string;
  @ApiProperty({ ...MONEY, description: 'Line 5' }) soli!: string;
  @ApiProperty({ ...MONEY, description: 'Line 6' }) churchTax!: string;
  @ApiProperty({ ...MONEY, description: 'Line 10' }) multiYearComp!: string;
  @ApiProperty({ ...MONEY, description: 'Line 11' }) multiYearWageTax!: string;
  @ApiProperty({ ...MONEY, description: 'Line 12' }) multiYearSoli!: string;
  @ApiProperty({ ...MONEY, description: 'Line 13' }) multiYearChurchTax!: string;
  @ApiProperty({ ...MONEY, description: 'Line 22a' }) pensionEmployer!: string;
  @ApiProperty({ ...MONEY, description: 'Line 23a' }) pensionEmployee!: string;
  @ApiProperty({ ...MONEY, description: 'Line 24a' }) employerSubsidyHealth!: string;
  @ApiProperty({ ...MONEY, description: 'Line 24c' }) employerSubsidyCare!: string;
  @ApiProperty({ ...MONEY, description: 'Line 25' }) health!: string;
  @ApiProperty({ ...MONEY, description: 'Line 26' }) care!: string;
  @ApiProperty({ ...MONEY, description: 'Line 27' }) unemployment!: string;
}

// ------------------------------------------------------------------ import

export class EarningsPayRecordInputDto {
  @ApiProperty({ maxLength: 200 }) employer!: string;
  @ApiProperty(PERIOD) period!: string;
  @ApiProperty(PERIOD) issued!: string;
  @ApiProperty({ enum: RECORD_KINDS }) kind!: (typeof RECORD_KINDS)[number];
  @ApiProperty({ minimum: 1 }) seq!: number;
  @ApiProperty({ type: EarningsPayRecordAmountsDto }) amounts!: EarningsPayRecordAmountsDto;
}

export class EarningsCertificateInputDto {
  @ApiProperty({ maxLength: 200 }) employer!: string;
  @ApiProperty({ example: 2025 }) year!: number;
  @ApiProperty({ type: EarningsCertificateAmountsDto }) amounts!: EarningsCertificateAmountsDto;
}

export class EarningsImportFileDto {
  @ApiProperty({ pattern: '^[A-Za-z0-9_-]{1,64}$' }) clientFileId!: string;
  @ApiProperty({ maxLength: 255 }) fileName!: string;
  @ApiProperty({ enum: SOURCE_TYPES }) sourceType!: (typeof SOURCE_TYPES)[number];
  @ApiProperty({ pattern: '^[0-9a-f]{64}$' }) fileSha256!: string;
  @ApiProperty({ example: 'sap-entgeltnachweis' }) parserId!: string;
  @ApiProperty({ example: '1.0.0' }) parserVersion!: string;
  @ApiProperty({ type: [EarningsPayRecordInputDto], maxItems: 2000 })
  records!: EarningsPayRecordInputDto[];
  @ApiProperty({ type: [EarningsCertificateInputDto], maxItems: 2000 })
  certificates!: EarningsCertificateInputDto[];
}

export class EarningsImportBatchDto {
  @ApiProperty({ type: [EarningsImportFileDto], maxItems: 400 }) files!: EarningsImportFileDto[];
}

export class EarningsRejectionDto {
  @ApiProperty({ example: 'CHECK_FAILED' }) code!: string;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { check: 'NET', period: '2026-08', difference: '12.40' },
  })
  params?: Record<string, string>;
}

export class EarningsReplacedItemDto {
  @ApiProperty() employer!: string;
  @ApiProperty({ ...PERIOD, nullable: true }) period!: string | null;
  @ApiProperty({ enum: RECORD_KINDS, nullable: true }) kind!: (typeof RECORD_KINDS)[number] | null;
  @ApiProperty({ nullable: true }) seq!: number | null;
  @ApiProperty({ nullable: true }) year!: number | null;
  @ApiProperty() importedAt!: string;
  @ApiProperty() fileName!: string;
}

export class EarningsDuplicateOfDto {
  @ApiProperty({ format: 'uuid' }) importId!: string;
  @ApiProperty() importedAt!: string;
  @ApiProperty() fileName!: string;
}

export class EarningsFilePreviewDto {
  @ApiProperty() clientFileId!: string;
  @ApiProperty({ enum: ['NEW', 'REPLACES', 'DUPLICATE', 'REJECTED'] }) status!: string;
  @ApiProperty({ type: [String] }) employers!: string[];
  @ApiProperty({ type: [String] }) periods!: string[];
  @ApiProperty({ type: [Number] }) years!: number[];
  @ApiProperty() recordCount!: number;
  @ApiProperty() certificateCount!: number;
  @ApiProperty() includesCorrection!: boolean;
  @ApiProperty({ type: [EarningsReplacedItemDto] }) replaces!: EarningsReplacedItemDto[];
  @ApiProperty({ type: EarningsDuplicateOfDto, nullable: true })
  duplicateOf!: EarningsDuplicateOfDto | null;
  @ApiProperty({ nullable: true }) conflictsWith!: string | null;
  @ApiProperty({ type: EarningsRejectionDto, nullable: true })
  rejection!: EarningsRejectionDto | null;
}

export class EarningsImportPreviewDto {
  @ApiProperty({ type: [EarningsFilePreviewDto] }) files!: EarningsFilePreviewDto[];
}

export class EarningsFileResultDto {
  @ApiProperty() clientFileId!: string;
  @ApiProperty({ enum: ['SAVED', 'SKIPPED_DUPLICATE', 'REJECTED'] }) status!: string;
  @ApiPropertyOptional({ format: 'uuid' }) importId?: string;
  @ApiPropertyOptional() recordCount?: number;
  @ApiPropertyOptional() certificateCount?: number;
  @ApiPropertyOptional({ type: EarningsRejectionDto }) rejection?: EarningsRejectionDto;
}

export class EarningsImportResultDto {
  @ApiProperty({ type: [EarningsFileResultDto] }) files!: EarningsFileResultDto[];
}

export class EarningsImportSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty({ enum: SOURCE_TYPES }) sourceType!: string;
  @ApiProperty() parserId!: string;
  @ApiProperty() parserVersion!: string;
  @ApiProperty() importedAt!: string;
  @ApiProperty({
    description: 'Records still attributed to this import (0 once all were replaced).',
  })
  recordCount!: number;
  @ApiProperty() certificateCount!: number;
  @ApiProperty({ type: [String] }) employers!: string[];
  @ApiProperty({ ...PERIOD, nullable: true }) firstPeriod!: string | null;
  @ApiProperty({ ...PERIOD, nullable: true }) lastPeriod!: string | null;
  @ApiProperty({ type: [Number] }) years!: number[];
}

// ------------------------------------------------------------------ employers

export class EarningsEmployerDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() detectedName!: string;
  @ApiProperty({ nullable: true }) displayName!: string | null;
}

export class RenameEarningsEmployerDto {
  @ApiProperty({ maxLength: 120, description: 'Trimmed; empty → null (use the detected name).' })
  displayName!: string;
}

// ------------------------------------------------------------------ read models

export class EarningsTotalsDto {
  @ApiProperty(MONEY) gross!: string;
  @ApiProperty(MONEY) net!: string;
  @ApiProperty(MONEY) taxes!: string;
  @ApiProperty(MONEY) social!: string;
  @ApiProperty(MONEY) bonus!: string;
}

export class CareerEntryDto {
  @ApiProperty({ description: "'ALL' for the whole career, else the employer id." }) key!: string;
  @ApiProperty() label!: string;
  @ApiProperty(PERIOD) firstPeriod!: string;
  @ApiProperty(PERIOD) lastPeriod!: string;
  @ApiProperty() monthsEmployed!: number;
  @ApiProperty() employerCount!: number;
  @ApiProperty({ type: EarningsTotalsDto }) totals!: EarningsTotalsDto;
  @ApiProperty({ type: EarningsTotalsDto }) perMonth!: EarningsTotalsDto;
  @ApiProperty(RATIO) netRatio!: string;
}

export class LatestYearFiguresDto extends EarningsTotalsDto {
  @ApiProperty(RATIO) netRatio!: string;
}

export class LatestYearDto {
  @ApiProperty() year!: number;
  @ApiProperty() months!: number;
  @ApiProperty({ type: [Number], example: [1, 9] }) comparedMonths!: [number, number];
  @ApiProperty({ type: LatestYearFiguresDto }) current!: LatestYearFiguresDto;
  @ApiProperty({ type: LatestYearFiguresDto, nullable: true })
  previous!: LatestYearFiguresDto | null;
}

export class YearlyPointDto {
  @ApiProperty() year!: number;
  @ApiProperty() monthsEmployed!: number;
  @ApiProperty(MONEY) gross!: string;
  @ApiProperty(MONEY) regular!: string;
  @ApiProperty(MONEY) bonus!: string;
  @ApiProperty(MONEY) net!: string;
  @ApiProperty(MONEY) taxes!: string;
  @ApiProperty(MONEY) social!: string;
  @ApiProperty(RATIO) taxRatio!: string;
  @ApiProperty(RATIO) socialRatio!: string;
}

export class MonthlyPointDto {
  @ApiProperty(PERIOD) period!: string;
  @ApiProperty({ format: 'uuid' }) employerId!: string;
  @ApiProperty(MONEY) gross!: string;
  @ApiProperty(MONEY) regular!: string;
  @ApiProperty(MONEY) bonus!: string;
  @ApiProperty(MONEY) net!: string;
  @ApiProperty(MONEY) taxes!: string;
  @ApiProperty(MONEY) social!: string;
  @ApiProperty(MONEY) payout!: string;
  @ApiProperty() hasCorrection!: boolean;
}

export class EarningsOverviewDto {
  @ApiProperty() hasData!: boolean;
  @ApiProperty({ type: [CareerEntryDto] }) career!: CareerEntryDto[];
  @ApiProperty({ type: LatestYearDto, nullable: true }) latestYear!: LatestYearDto | null;
  @ApiProperty({ type: [YearlyPointDto] }) yearly!: YearlyPointDto[];
  @ApiProperty({ type: [MonthlyPointDto] }) monthly!: MonthlyPointDto[];
  @ApiProperty({ type: [String] }) employerChanges!: string[];
  @ApiProperty() dataCheckIssues!: number;
}

export class EarningsImportRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fileName!: string;
}

export class EarningsRecordDetailDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) employerId!: string;
  @ApiProperty() employerLabel!: string;
  @ApiProperty(PERIOD) period!: string;
  @ApiProperty(PERIOD) issued!: string;
  @ApiProperty({ enum: RECORD_KINDS }) kind!: string;
  @ApiProperty() seq!: number;
  @ApiProperty({ type: EarningsStoredPayRecordAmountsDto })
  amounts!: EarningsStoredPayRecordAmountsDto;
  @ApiProperty({ type: EarningsImportRefDto }) import!: EarningsImportRefDto;
}

const PERIOD_MAP = {
  type: 'object',
  additionalProperties: { type: 'string' },
  example: { '2026-09': '5200.00' },
  description: 'period → amount',
} as const;

export class MonthGridMetricsDto {
  @ApiProperty(PERIOD_MAP) gross!: Record<string, string>;
  @ApiProperty(PERIOD_MAP) regular!: Record<string, string>;
  @ApiProperty(PERIOD_MAP) bonus!: Record<string, string>;
  @ApiProperty(PERIOD_MAP) net!: Record<string, string>;
  @ApiProperty(PERIOD_MAP) taxes!: Record<string, string>;
  @ApiProperty(PERIOD_MAP) social!: Record<string, string>;
  @ApiProperty(PERIOD_MAP) payout!: Record<string, string>;
}

export class MonthGridDto {
  @ApiProperty({ type: [Number] }) years!: number[];
  @ApiProperty({ type: MonthGridMetricsDto }) metrics!: MonthGridMetricsDto;
  @ApiProperty({ type: [String] }) bonusPeriods!: string[];
  @ApiProperty({ type: [String] }) missingPeriods!: string[];
}

export class TaxYearRowDto {
  @ApiProperty() year!: number;
  @ApiProperty({ format: 'uuid' }) employerId!: string;
  @ApiProperty() employerLabel!: string;
  @ApiProperty() monthsEmployed!: number;
  @ApiProperty(MONEY) gross!: string;
  @ApiProperty(MONEY) bonus!: string;
  @ApiProperty(MONEY) taxGross!: string;
  @ApiProperty(MONEY) wageTax!: string;
  @ApiProperty(MONEY) soli!: string;
  @ApiProperty(MONEY) churchTax!: string;
  @ApiProperty(MONEY) health!: string;
  @ApiProperty(MONEY) care!: string;
  @ApiProperty(MONEY) pension!: string;
  @ApiProperty(MONEY) unemployment!: string;
  @ApiProperty(RATIO) taxRatio!: string;
  @ApiProperty(RATIO) socialRatio!: string;
}

export class CertificateRowDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() year!: number;
  @ApiProperty({ format: 'uuid' }) employerId!: string;
  @ApiProperty() employerLabel!: string;
  @ApiProperty({ type: EarningsCertificateAmountsDto }) amounts!: EarningsCertificateAmountsDto;
  @ApiProperty() fileName!: string;
}

export class EarningsTablesDto {
  @ApiProperty({ type: MonthGridDto }) monthGrid!: MonthGridDto;
  @ApiProperty({ type: [TaxYearRowDto] }) taxesPerYear!: TaxYearRowDto[];
  @ApiProperty({ type: [CertificateRowDto] }) certificates!: CertificateRowDto[];
}

export class DataCheckComparisonDto {
  @ApiProperty({ enum: ['MATCH', 'DIFFERS', 'NOT_AVAILABLE', 'NOT_COMPARABLE'] }) status!: string;
  @ApiProperty() compared!: number;
  @ApiProperty({ type: [String], description: 'Field names only — never amounts.' })
  differing!: string[];
}

export class DataCheckCompletenessDto {
  @ApiProperty({ enum: ['COMPLETE', 'MISSING', 'NO_PAYSLIPS'] }) status!: string;
  @ApiProperty({ type: [String] }) missingPeriods!: string[];
}

export class LateCorrectionDto {
  @ApiProperty(PERIOD) period!: string;
  @ApiProperty(PERIOD) issued!: string;
}

export class DataCheckRowDto {
  @ApiProperty() year!: number;
  @ApiProperty({ format: 'uuid' }) employerId!: string;
  @ApiProperty() employerLabel!: string;
  @ApiProperty({ type: DataCheckComparisonDto }) ytd!: DataCheckComparisonDto;
  @ApiProperty({ type: DataCheckComparisonDto }) certificate!: DataCheckComparisonDto;
  @ApiProperty({ type: DataCheckCompletenessDto }) completeness!: DataCheckCompletenessDto;
  @ApiProperty({ type: [LateCorrectionDto] }) lateCorrections!: LateCorrectionDto[];
}
