# Idea Intake: Deposit Money and Retirement Claims as New Asset Types

- **Slug**: deposit-money-retirement-claims
- **Created**: 2026-09-04
- **Source**: pasted text
- **Type**: new-capability

## Idea (as captured)

> I am thinking of adding two more asset types:
>
> - deposit money (german: Giralgeld): fiat money on bank accounts, cash at home, cash at reference accounts of the robo-advisor or neobank or broker
> - retirement claims (german: Altersvorsorgeansprüche): claims of former employers for retirement (in german something like "aktuell erwirtschaftete Betriebsrente"), or the german "Riester-Rente" or from insurances
>
> Both are important for me to see as part of my personal wealth, but for the retirement claims I am not sure. Even if its not accessible right now, it is somehow part of my personal wealth as it belongs to me personally, but only somewhere in the future.

## Restated

The idea is to extend Vaultfolio's set of trackable asset types with two additions: "deposit money" (cash and fiat balances held in bank accounts, at home, or as reference-account cash at brokers/neobanks/robo-advisors) and "retirement claims" (accrued, not-yet-accessible claims to future retirement income, such as employer pension entitlements, Riester-Rente, or insurance-based retirement products). The proposer wants both visible as part of total personal wealth, but is uncertain whether retirement claims — being illiquid and only realizable in the future — belong in the same wealth view as the rest.

## Origin & Context

- **Raised by**: The user (Markus Allwang), speaking as the product owner/primary user of Vaultfolio
- **Trigger**: [NEEDS CLARIFICATION: no specific triggering event given — reads as an organically-noticed gap while reviewing what asset types Vaultfolio currently supports]

## First-Glance Unknowns

- [NEEDS CLARIFICATION: What asset types does Vaultfolio currently support, and how would "deposit money" and "retirement claims" fit alongside them (e.g., relation to the existing Gold/Bitcoin asset-type rename in recent history)?]
- [NEEDS CLARIFICATION: Should retirement claims be included in the same total-wealth aggregate as liquid assets, or shown separately/flagged as illiquid/future-dated? The user explicitly flags this as unresolved.]
- [NEEDS CLARIFICATION: What data does a "retirement claim" holding need — current accrued value, projected future value, vesting/access date, provider/employer name, currency? Are these self-reported (manual entry) since no price feed exists for them?]
- [NEEDS CLARIFICATION: For "deposit money", is this a single asset type covering multiple cash locations (bank account, cash at home, broker reference account), or should each location be distinguishable (e.g. via a sub-type or free-text label)? Does it need multi-currency support?]
- [NEEDS CLARIFICATION: Do either of these need price/valuation feeds, or are they always manually-entered static or periodically-updated values (unlike market-priced assets such as stocks/Bitcoin/Gold)?]
- [NEEDS CLARIFICATION: Is there a reporting/tax angle — e.g. should retirement claims be excluded from certain net-worth calculations (like liquidity ratios) even if included in total wealth?]
