import type { AssetType, HoldingResponse } from '@vaultfolio/api-contract';
import { findCoin, findMetal } from '@vaultfolio/domain-holdings';

/** Translation keys (`assetType.*`) for each asset type's display label. */
export const ASSET_TYPE_LABEL_KEYS: Readonly<Record<AssetType, string>> = {
  ETF: 'assetType.ETF',
  SHARE: 'assetType.SHARE',
  PRECIOUS_METAL: 'assetType.PRECIOUS_METAL',
  CRYPTO: 'assetType.CRYPTO',
  DEPOSIT_MONEY: 'assetType.DEPOSIT_MONEY',
};

/** Translation keys for the "name" field's example placeholder, per asset type. */
export const ASSET_TYPE_NAME_PLACEHOLDER_KEYS: Readonly<Record<AssetType, string>> = {
  ETF: 'holdingForm.namePlaceholderEtf',
  SHARE: 'holdingForm.namePlaceholderShare',
  PRECIOUS_METAL: 'holdingForm.namePlaceholderPreciousMetal',
  CRYPTO: 'holdingForm.namePlaceholderCrypto',
  DEPOSIT_MONEY: 'holdingForm.namePlaceholderDepositMoney',
};

/**
 * What a holding is called in the table and charts: translated metal name,
 * "Coin (SYM)", or the entered name. A metal/coin no longer in the catalogue
 * falls back to its raw code instead of throwing.
 */
export function holdingAssetName(
  holding: HoldingResponse,
  translate: (key: string) => string,
): string {
  if (holding.metal) {
    return findMetal(holding.metal) ? translate(`holdingMetal.${holding.metal}`) : holding.metal;
  }
  if (holding.coinId) {
    const coin = findCoin(holding.coinId);
    return coin ? `${coin.name} (${coin.symbol})` : holding.coinId;
  }
  return holding.name ?? '';
}
