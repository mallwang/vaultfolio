import type { AssetType } from '@vaultfolio/api-contract';

/**
 * Per-type field visibility for the add/edit form and list display, mirroring
 * `libs/domain/holdings/src/lib/asset-type.ts`'s `ASSET_TYPE_FIELDS` (the
 * domain-layer source of truth). Duplicated here — rather than imported —
 * because `apps/frontend` (tag `scope:frontend`) is only permitted to depend
 * on `scope:shared` libraries per the module-boundary rules in
 * `eslint.config.mjs`; `libs/domain/holdings` is `scope:domain`. This is
 * purely a UI-layer concern (which controls to show); `holding-validation.ts`
 * remains the single source of truth for what the server actually accepts.
 */
export const ASSET_TYPES: readonly AssetType[] = [
  'ETF',
  'SHARE',
  'PRECIOUS_METAL',
  'CRYPTO',
  'DEPOSIT_MONEY',
];

export interface AssetTypeFieldSet {
  isin: boolean;
  name: boolean;
  quantity: boolean;
  purchasePrice: boolean;
  /** ETF/PRECIOUS_METAL never show a purchase date field at all (FR-005, FR-006). */
  purchaseDate: 'hidden' | 'optional';
  weightGrams: boolean;
  currentValue: boolean;
}

export const ASSET_TYPE_FIELD_SETS: Readonly<Record<AssetType, AssetTypeFieldSet>> = {
  ETF: {
    isin: true,
    name: true,
    quantity: true,
    purchasePrice: true,
    purchaseDate: 'hidden',
    weightGrams: false,
    currentValue: false,
  },
  SHARE: {
    isin: true,
    name: true,
    quantity: true,
    purchasePrice: true,
    purchaseDate: 'optional',
    weightGrams: false,
    currentValue: false,
  },
  PRECIOUS_METAL: {
    isin: false,
    name: true,
    quantity: false,
    purchasePrice: false,
    purchaseDate: 'hidden',
    weightGrams: true,
    currentValue: true,
  },
  CRYPTO: {
    isin: false,
    name: true,
    quantity: true,
    purchasePrice: true,
    purchaseDate: 'optional',
    weightGrams: false,
    currentValue: false,
  },
  DEPOSIT_MONEY: {
    isin: false,
    name: true,
    quantity: false,
    purchasePrice: false,
    purchaseDate: 'hidden',
    weightGrams: false,
    currentValue: true,
  },
};

/**
 * Translation-dictionary keys (`core/i18n/translations/{en,de}.ts`'s
 * `assetType` section) for each asset type's display label — resolve
 * through `TranslatePipe`/`I18nService` rather than using these as literal
 * UI text, so the label follows the active language (FR-003).
 */
export const ASSET_TYPE_LABEL_KEYS: Readonly<Record<AssetType, string>> = {
  ETF: 'assetType.ETF',
  SHARE: 'assetType.SHARE',
  PRECIOUS_METAL: 'assetType.PRECIOUS_METAL',
  CRYPTO: 'assetType.CRYPTO',
  DEPOSIT_MONEY: 'assetType.DEPOSIT_MONEY',
};

/**
 * Translation-dictionary keys for the "name" field's placeholder text, which
 * shows a realistic example — what counts as a "name" differs a lot by
 * asset type (a fund name vs. a coin vs. a bank account label).
 */
export const ASSET_TYPE_NAME_PLACEHOLDER_KEYS: Readonly<Record<AssetType, string>> = {
  ETF: 'holdingForm.namePlaceholderEtf',
  SHARE: 'holdingForm.namePlaceholderShare',
  PRECIOUS_METAL: 'holdingForm.namePlaceholderPreciousMetal',
  CRYPTO: 'holdingForm.namePlaceholderCrypto',
  DEPOSIT_MONEY: 'holdingForm.namePlaceholderDepositMoney',
};

/**
 * Standard ISIN checksum — kept in sync with
 * `libs/domain/holdings/src/lib/holding-validation.ts`'s `isValidIsin`
 * (same module-boundary reasoning as above). Used only for immediate
 * client-side feedback; the server is the authority.
 */
export function isValidIsin(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
    return false;
  }

  const expanded = isin
    .split('')
    .map((char) => (/[0-9]/.test(char) ? char : String(char.charCodeAt(0) - 55)))
    .join('');

  let sum = 0;
  let doubleDigit = false;
  for (let i = expanded.length - 1; i >= 0; i--) {
    let digit = Number(expanded[i]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}
