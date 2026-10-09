# Design: Holdings Rework

**Mockup**: [mockup.html](./mockup.html) (durable local copy, approved; no published Artifact link). All names and data in the mockup are invented.

## Summary

The holdings page keeps its structure (tiles, table with filter, export and add buttons). The add/edit modal is reworked: asset type chips, type-specific fields, selects for metal and crypto, unit choice for metals, a note field with counter. Rows with a note show a "Notiz anzeigen" link below the ticker. The dashboard tiles use the shared empty tile when there are no holdings, and the total-value tile shows "Kaufwert". German UI text.

## Layout per region

### Holdings table (US2, US4; FR-006, FR-007, FR-014)

- Name column shows the display name with the ticker/code below; rows with a note show a "Notiz anzeigen" link (comment icon) below the ticker.
- Import button is gone; export and "Bestand hinzufügen" remain.

### Form: type selection (US2; FR-015)

- Five chips, each once: ETF, Aktie, Edelmetall, Krypto, Tagesgeld/Festgeld. The active chip is highlighted.

### Form: ETF / share (US2; FR-005, FR-015)

- ISIN (required, validated), name, quantity, purchase price; share also optional purchase date; broker/bank; note.

### Form: precious metal (US2, US3; FR-006, FR-011)

- One row: metal select (Gold/XAU, Silber/XAG, Platin/XPT, Palladium/XPD), quantity, unit chips "oz" and "g" with tooltips ("Unzen (entspricht 31,1035 Gramm)", "Gramm"). Below the row a conversion hint (e.g. "≙ 62,207 g"). Optional current value, broker/bank, note.
- Mobile: the select takes its own row; quantity and unit share the next.

### Form: crypto (US2, US3; FR-007, FR-008, FR-012)

- Searchable select (name and symbol), quantity with up to 8 decimals, purchase price, optional purchase date, broker/bank, note.

### Form: deposit money (FR-010, FR-015)

- Name, current value, broker/bank, note. No ISIN.

### Form: note and validation (US4; FR-014, FR-016)

- Note textarea with remaining-length counter (max 500). Field-specific error messages under the field, error state shown in the mockup.

### Dashboard tiles (US5; FR-020, FR-021, FR-022)

- Distribution and total-value tiles use the shared empty tile with a call to action when empty.
- Total-value tile titled "Kaufwert" with a hint when holdings without purchase price are excluded; distinct error state.

## Requirement traceability

| Region / state      | Stories  | Requirements                   |
| ------------------- | -------- | ------------------------------ |
| Holdings table      | US2, US4 | FR-006, FR-007, FR-014, FR-019 |
| Type selection      | US2      | FR-015                         |
| Form ETF / share    | US2      | FR-005, FR-015                 |
| Form metal          | US2, US3 | FR-006, FR-009, FR-011, FR-013 |
| Form crypto         | US2, US3 | FR-007, FR-008, FR-009, FR-012 |
| Form deposit        | US2      | FR-010, FR-015                 |
| Note and validation | US4      | FR-014, FR-016                 |
| Dashboard tiles     | US5      | FR-020, FR-021, FR-022         |

## Out of scope for the mockup

- Encryption, key management, merge logic and server validation (FR-001 to FR-004).
- Name lookup from ISIN (not planned; name stays a manual field).
- Seeds, import removal on the server, API docs and tests (FR-019, FR-023 to FR-025).
- i18n in all languages, test ids (FR-016, FR-017) and the shared field-definition source (FR-018).
- Market values and prices (spec 046).

## Visual language

The mockup approximates the PrimeNG Aura preset defaults. The real implementation uses PrimeNG components (`p-dialog`, `p-select`, `p-table`) with the app's theme tokens; exact spacing and colors follow the app theme, not the mockup CSS.
