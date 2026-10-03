# Design: Altersvorsorge (Retirement Planning)

**Mockup**: [mockup.html](./mockup.html) (durable local copy) — originally reviewed at
https://claude.ai/artifact/Bd9NM34mNB4hu4194mZymD (this remote link may go stale; the local copy is
the source of truth). Approved as-is in the first review round. All people, employers, contracts,
numbers and amounts in the mockup are invented.

## Summary

The Retirement domain is a page inside the existing authenticated app shell with the nav entry
"Altersvorsorge". It has one toolbar and five tabs — Übersicht, Gesetzlich, Betrieblich, Privat,
Weiterführende Informationen — plus a separate import flow, a manual entry form, an empty state and a
dashboard tile. German UI text throughout.

## Layout per region

### Toolbar + tabs (all data screens)

```
🔒 So werden deine Daten geschützt        [⬇ Daten exportieren] [+ Manuell erfassen] [⬆ Dokument hochladen (primary)]
 Übersicht | Gesetzlich | Betrieblich (2) | Privat (3) | Weiterführende Informationen
```

- "Daten exportieren" is the shared text link from 036; "Dokument hochladen" is the primary action
  (upload preferred), "Manuell erfassen" the secondary.
- "So werden deine Daten geschützt" jumps to the privacy note on the information tab (FR-016).

### Übersicht (FR-007–FR-010)

- Four KPI tiles: erwartete Rente gesamt (hero tile, Prognose), garantierte Rente, Sparbetrag aktuell
  (split employer-based / private), Rentenbeginn (regular statutory start, "n Vertrag beginnt früher").
- Panel "Garantiert vs. erwartet": one stacked bar (guaranteed solid, additional expected hatched)
  with legend and difference badge.
- Three pillar cards (gesetzlich / betrieblich / privat): origin badge, subtotal, entry rows with
  Importiert/Manuell/Veraltet/Unvollständig badges, "Details ansehen".
- Warn note for entries older than 12 months; info note that capital payouts are not part of the
  monthly pension and that amounts are gross.

### Guaranteed vs projection (everywhere)

Guaranteed figures: bold, green "garantiert" tag. Projections: italic with "≈" prefix and "Prognose"
tag. Same treatment on cards, tiles, import review and form labels (SC-004).

### Gesetzlich / Betrieblich / Privat tabs (FR-002–FR-005, FR-010)

- One contract card per entry: title/subtitle, origin and freshness badges, copyable insurance or
  contract number, key figures grid, footer with actions.
- Imported card: lock badge "Importiert", footer note "Werte aus Dokument, nicht bearbeitbar",
  actions "Durch neues Dokument ersetzen" and "Löschen". Only figures added at import (e.g. monthly
  contribution) are labelled "manuell ergänzt".
- Manual card: "Manuell" badge, actions "Bearbeiten" and "Löschen".
- Statutory: single record; 1 %/2 % adjustment projections shown as two small tiles.
- Occupational: capital-account contract shows a capital box ("Kapital, keine Monatsrente"),
  guaranteed interest rate, "Erwartete Monatsrente: nicht angegeben".
- Private: Riester card spans full width with 0/3/6/9 % scenario tiles; Altersvorsorgedepot card has
  "keine Garantie" and an "Unvollständig" badge.
- Add buttons below the lists ("Betriebsrente hinzufügen", "Privaten Vertrag hinzufügen").

### Import flow (FR-002, FR-002a–FR-002d)

1. **Upload**: dropzone ("Art wird automatisch erkannt"), privacy note (document stays on device;
   only confirmed values saved, no name/address/bank data), link to manual entry. Stepper
   "Dokument wählen → Prüfen → Speichern".
2. **Scan consent**: file row with "Texterkennung nötig" badge and a warn note; buttons "Abbrechen" /
   "Texterkennung erlauben und fortfahren" (consent is per file).
3. **Review**: recognised values in a read-only table (field, value, kind: Kennung/garantiert/
   Prognose/Stand), "Plausibilitätsprüfung bestanden" badge, highlighted rows with inputs for values
   the document does not print (monthly contribution, annual subsidies). "Bestätigen und speichern".
4. **Not recognised**: error note, "Nichts gespeichert", actions "Anderes Dokument wählen" /
   "Manuell eingeben".

### Manual entry form (FR-003–FR-006)

Type chips (Gesetzliche Rente, Betriebsrente, Riester-Rente, Private Rentenversicherung,
Altersvorsorgedepot "ab 2027"); sections Vertrag, Leistungen, Beiträge & Wert. Fields adapt to the
type (Riester: Zulagen; Betriebsrente: Arbeitgeberanteil, Garantiezins). Inline error when expected
pension < guaranteed pension.

### Weiterführende Informationen (FR-012)

Three cards (DRV, Finanzfluss, Finanztip) each with category badge, description, source and an
"öffnen" link with external-link icon (new tab). Below: privacy note (links send no data; documents
read on device only; amounts and numbers encrypted; operator holds the key).

### Empty state

Centered panel with upload and manual buttons, plus three dashed pillar cards each with its own
call to action.

### Dashboard tile (FR-011)

Third dashboard tile: erwartete Rente / Monat (hero, Prognose), mini guaranteed/expected bar with
difference, rows Rentenbeginn, Garantierte Rente, Sparbetrag, "n veraltet" badge, link
"Zur Altersvorsorge". Whole tile is a link. Empty variant: short text and "Altersvorsorge erfassen".

### Responsive

Mobile: sidebar collapses to the top bar; KPI tiles 2×2; pillar, contract and info cards stack to one
column; form fields single column; tables scroll horizontally inside their container.

## Requirement coverage

| Region                         | Spec items                              |
| ------------------------------ | --------------------------------------- |
| Toolbar, tabs                  | FR-001, FR-016, FR-019 (export link)    |
| Übersicht                      | Story 2, FR-007–FR-010, SC-003, SC-004  |
| Pillar tabs and contract cards | Story 1, FR-002–FR-005, FR-002a, FR-010 |
| Import flow                    | Story 1, FR-002, FR-002a–d, edge cases  |
| Manual form                    | Story 1, FR-003–FR-006, Story 5         |
| Info tab                       | Story 4, FR-012, FR-016                 |
| Dashboard tile                 | Story 3, FR-011                         |

## Decisions confirmed by the mockup

- The statutory pension counts as **Prognose** only; "garantierte Rente" sums occupational and
  private contracts with a guarantee.
- Sparbetrag = monthly contributions of occupational + private contracts (statutory contributions
  are shown on the statutory card only).

## Out of scope for the mockup

- Deterministic parsing rules, text recognition behaviour, server validation (FR-006, FR-002c).
- Encryption, access control, log hygiene, account lifecycle deletion (FR-014, FR-015).
- Translations beyond German (FR-018) and export file contents (FR-019).
- Exact recognition coverage per provider layout.

## Visual language

Approximates the app's current teal PrimeNG theme with light and dark tokens. The real
implementation uses PrimeNG components and the existing `--p-primary-color` tokens; spacing and card
styling are finalized during implementation.
