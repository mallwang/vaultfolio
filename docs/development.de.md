# Lokales Entwicklungs-Setup

**[English version](development.md)**

Dieses Dokument fasst alles zusammen, was lokal genutzt wird, um die Codebasis wartbar und sicher
zu halten: Linting, Formatierung, Dependency-Hygiene, Secret-Scanning und die Git-Hooks, die das
alles durchsetzen, bevor Code überhaupt in die CI gelangt. Für das Ausführen der Anwendung selbst
(Docker Compose, Hot-Reload-Dev-Modus, Umgebungsvariablen) siehe die
[README](README.de.md#den-vollständigen-stack-lokal-ausführen) (
[English](../README.md#running-the-full-stack-locally)).

## Voraussetzungen

- Node.js `>=22`, npm `>=10` (siehe [package.json](../package.json), Feld `engines`)
- Nach dem Klonen einmal `npm ci` ausführen — das führt auch das `prepare`-Skript aus, welches die
  Git-Hooks installiert (über [Husky](https://typicode.github.io/husky/)) und die lokale
  Umgebungsdatei des Frontends erzeugt, falls sie fehlt (siehe
  [tools/ensure-frontend-env.mjs](../tools/ensure-frontend-env.mjs) und
  [Frontend-Umgebungskonfiguration](../README.md#frontend-environment-configuration) in der
  README).

## Linting

[ESLint](https://eslint.org) ist zentral in [eslint.config.mjs](../eslint.config.mjs) konfiguriert
(Flat Config), aufbauend auf dem Nx-ESLint-Plugin sowie
[eslint-plugin-sonarjs](https://github.com/SonarSource/eslint-plugin-sonarjs) für zusätzliche
Regeln zu Code-Smells und Bug-Mustern, und [@vitest/eslint-plugin](https://github.com/vitest-dev/eslint-plugin-vitest)
für die Libs, die auf Vitest laufen.

Zwei Dinge werden zur Lint-Zeit erzwungen, statt sich nur auf Konvention oder Code-Review zu
verlassen:

- **`@nx/enforce-module-boundaries`** — die in der [README](../README.md#frontend-domain-library-architecture)
  beschriebene Domänenbibliothek-Architektur (z. B. darf eine Frontend-Domänenbibliothek keine
  andere Domänenbibliothek importieren) wird über Projekt-Tags und `depConstraints` erzwungen.
- **sonarjs-Regeln** — doppelte Logik, übermäßig komplexe Bedingungen und andere fehleranfällige
  Muster. Ein paar sonarjs-Regeln (Heuristiken für hartcodierte Passwörter/IPs,
  `assertions-in-tests`) sind nur für `*.spec.ts`/`*.e2e-spec.ts` deaktiviert, da sie auf
  Namens- und Strukturmuster abzielen, die in Testcode erwartet, in echtem Quellcode aber
  problematisch wären — siehe die Kommentare in `eslint.config.mjs` für die Begründung je Regel.

Ausführung über Nx, nicht direkt über `eslint`:

```bash
npm run lint          # nx run-many -t lint — alle Projekte
npm run lint:fix       # dasselbe, mit --fix
npx nx affected -t lint --base=main   # nur von den eigenen Änderungen betroffene Projekte (das läuft auch in der CI bei PRs)
```

## Formatierung

[Prettier](https://prettier.io) formatiert alles (`.prettierrc`: einfache Anführungszeichen,
100 Zeichen Zeilenbreite). `.prettierignore` schließt Build-Output und die
Handlebars-Benachrichtigungsvorlagen aus (der eingebaute `.hbs`-Parser unterstützt die in
`libs/notifications` verwendeten eigenständigen Partials nicht).

```bash
npm run format        # prettier --write .
npm run format:check  # prettier --check . — das läuft auch in der CI
```

## Typprüfung

```bash
npm run typecheck                              # nx run-many -t typecheck
npx nx affected -t typecheck --uncommitted     # nur nicht committete Änderungen — das führt der pre-push-Hook aus
```

## Ungenutzte Dateien, Exports und Abhängigkeiten (knip)

[Knip](https://knip.dev) durchsucht das gesamte Workspace nach ungenutzten Dateien, ungenutzten
Exports sowie ungenutzten oder nicht deklarierten Abhängigkeiten. Die Konfiguration liegt in
[knip.json](../knip.json), mit einer `ignoreDependencies`-Liste pro Workspace für Fälle, die knip
nicht selbst auflösen kann (Peer-Dependencies, die nur über Konfiguration referenziert werden,
optionale Abhängigkeiten, die bedingt genutzt werden usw.) — jeder Eintrag dort sollte eng gefasst
und begründet bleiben, statt zu einer pauschalen Unterdrückung zu wachsen.

```bash
npm run knip
```

Knip hat keinen "affected"-Modus — es analysiert immer das gesamte Workspace. Es läuft in der CI
(`.github/workflows/ci.yml`), aber dort aktuell mit `continue-on-error: true`, bis die bestehenden
Funde aufgearbeitet sind; führe es lokal aus, bevor du neue Dateien oder Abhängigkeiten hinzufügst,
damit die Baseline nicht weiterwächst.

## Secret-Scanning

[secretlint](https://github.com/secretlint/secretlint) (mit dem Regelwerk
`@secretlint/secretlint-rule-preset-recommend`, siehe `.secretlintrc.json`) durchsucht gestagte
Dateien nach versehentlich committeten Zugangsdaten, Schlüsseln und Tokens. Es läuft bei jedem
`git commit` (über lint-staged, siehe unten) und erneut über den gesamten Baum in der CI
(`npx secretlint "**/*"`).

## Git-Hooks (Husky)

Die Hooks liegen in [.husky/](../.husky/) und werden automatisch durch `npm run prepare`
installiert (Teil von `npm ci`/`npm install`).

- **pre-commit** — führt [lint-staged](https://github.com/okonet/lint-staged) aus (Konfiguration
  in `package.json`), das nur auf die zum Commit vorgemerkten Dateien angewendet wird:
  - `secretlint` auf jede gestagte Datei
  - `eslint --fix` auf gestagte `.ts`/`.tsx`/`.js`/`.jsx`/`.cjs`/`.mjs`-Dateien
  - `prettier --write` auf gestagte `.ts`/`.tsx`/`.js`/`.jsx`/`.cjs`/`.mjs`/`.json`/`.html`/`.scss`/`.css`/`.md`-Dateien
- **pre-push** — führt die Prüfungen aus, die sich lohnen, einmal pro Push statt einmal pro Commit
  auszuführen:
  - `npx nx affected -t typecheck --uncommitted`
  - `npm run test:coverage:affected`

Diese Hooks sind die erste lokale Verteidigungslinie: einen Lint-Fehler, eine unformatierte Datei,
einen Typfehler oder ein geleaktes Secret vor dem Push zu erkennen ist günstiger, als es erst in
der CI zu entdecken.

## Dependency- und Supply-Chain-Prüfungen (nur CI)

Läuft nicht lokal, gehört aber zum selben Wartbarkeits-/Sicherheitsnetz:

- **[Dependency Review](../.github/workflows/dependency-review.yml)** — schlägt bei jedem PR fehl,
  wenn eine neu eingeführte Abhängigkeit (direkt oder transitiv) eine bekannte Schwachstelle hat,
  sofern nicht explizit auf einer Allow-List (siehe den `allow-ghsas`-Kommentar in diesem Workflow
  für die aktuelle Ausnahme und warum sie unbedenklich ist).
- **[step-security/harden-runner](https://github.com/step-security/harden-runner)** — umschließt
  jeden CI-Job, um ausgehenden Netzwerkverkehr des Runners zu überwachen.
- **[SonarQube Cloud](../.github/workflows/ci.yml)** — statische Analyse und Coverage, gegen den
  Quality Gate des Projekts geprüft (Badges in der [README](../README.md)); siehe
  [sonar-project.properties](../sonar-project.properties) für die Scan-Konfiguration. Nutze den
  `speckit-sonar-validate`-Claude-Code-Skill, um den Quality Gate für den aktuellen Branch/PR zu
  prüfen, bevor eine Änderung als fertig gilt.

## Überblick über die CI-Pipeline

[.github/workflows/ci.yml](../.github/workflows/ci.yml) läuft bei jedem PR und bei Push auf
`main`: `lint-and-format` (Format-Check + affected Lint + secretlint), `typecheck` (affected),
`knip` (gesamtes Workspace, nicht blockierend), `test` (affected), `build` (affected) und `sonar`
(vollständiger Coverage-Lauf + Quality Gate). `nx affected` gegenüber der Ausführung aller Projekte
zu bevorzugen hält das PR-Feedback schnell; die Jobs `sonar` und `knip` laufen gegen das gesamte
Workspace, da die Coverage- bzw. Unused-Code-Analyse das vollständige Bild benötigt.
