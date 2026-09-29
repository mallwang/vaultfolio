# Earnings test fixtures

Synthetic documents and expected values for `@vaultfolio/earnings`. **Every name, address,
identifier and amount here is invented.** Never commit real payslips, certificates, exports or
amounts (constitution v3.5.0, Sensitive Personal Data).

## `sap-entgeltnachweis.fixtures.ts`

Page lines of synthetic SAP "Entgeltnachweis" statements (employer "Brightline Software GmbH").
The frontend adapter tests render the same lines into PDFs (`libs/frontend/domain/earnings/src/testing/`).

| Fixture                         | What it covers                                                                                     | Expected                                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SAP_SEP_2026_WITH_CORRECTION`  | Regular Sep + correction for Jul; page break GRUNDDATEN → header; `Y551`/`/552`; JAHRESSUMMEN      | Sep: gross 5200.00, taxes 918.00, social 1060.80, net 3221.20, other −102.85, payout 3118.35, ytd taxGross 46680.00. Jul (CORRECTION, seq 3): gross −120.00, net −62.85, other 62.85 |
| `SAP_AUG_2026`                  | Plain month                                                                                        | gross 5000.00, taxes 864.00, social 1020.00, net 3116.00, other −40.00, payout 3076.00                                                                                               |
| `SAP_AUG_2026_NET_OFF`          | Printed net 12.40 too high                                                                         | `CHECK_FAILED` NET 2026-08 difference 12.40                                                                                                                                          |
| `SAP_AUG_2026_UNKNOWN_LINE`     | Unknown statutory deduction line                                                                   | `UNKNOWN_LINE` label `Y$58 Umlage Sonderabgabe`, period 2026-08                                                                                                                      |
| `SAP_MAR_2026_VOLUNTARY`        | Voluntary KV/PV with employer subsidy                                                              | health 260.00 / care 55.00 (own share), subsidy 260.00 / 55.00, net 4323.00, payout 4283.00                                                                                          |
| `SAP_DEC_2025_BONUS`            | One-off (bonus) month                                                                              | gross 8000.00 of which one-off 3000.00; wage tax 1700.00 of which 900.00; net 4775.77                                                                                                |
| `SAP_OCT_2026_PAYOUT_ONLY`      | Statement with only a back-payment for Aug                                                         | CORRECTION 2026-08 (net 157.80, other −157.80) + PAYOUT_ONLY 2026-10 (other = payout 157.80)                                                                                         |
| `SAP_NOV_2026_TAX_CORRECTION`   | Correction for Sep that only refunds wage tax (no `Gesamtbrutto` line)                             | Sep (CORRECTION, seq 3): gross 0.00, wage tax −50.00 of which one-off −30.00, net 50.00, other −50.00. Nov: as Aug with other 10.00, payout 3126.00                                  |
| `SAP_AUG_2026_LATE_ABSENCE`     | Aug statement with a Jul section that only books vacation days (no amounts, no net)                | Jul section is informational and yields no record; Aug as `SAP_AUG_2026`                                                                                                             |
| `SAP_AUG_2026_RECLASSIFICATION` | Aug statement with a Jun section that only moves a share benefit from taxable to tax-free (no net) | Jun (CORRECTION, seq 3): gross/net/other 0.00, oneOff gross −300.00; Aug as `SAP_AUG_2026`                                                                                           |

The arithmetic for each fixture is written next to it in the source file.

## `builders.ts`

`payRecord()` / `storedRecord()` / `certificate()` build balanced records with invented figures:
5000.00 − 800.00 − (400.00 + 90.00 + 465.00 + 65.00) = 3180.00.
