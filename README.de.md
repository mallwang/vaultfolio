# Vaultfolio

<p align="center">
  <img src="logo.png" alt="Vaultfolio" width="120" />
</p>

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=mallwang_vaultfolio&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=mallwang_vaultfolio)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=mallwang_vaultfolio&metric=coverage)](https://sonarcloud.io/summary/new_code?id=mallwang_vaultfolio)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=mallwang_vaultfolio&metric=bugs)](https://sonarcloud.io/summary/new_code?id=mallwang_vaultfolio)

**[English version](README.md)**

Eine persönliche Finanzanwendung – Frontend, Backend und Datenbank, verpackt und betrieben als
Docker-Container.

Vaultfolio ist um unabhängige Domänen organisiert (siehe
[Frontend-Domänenbibliothek-Architektur](#frontend-domänenbibliothek-architektur)). **Holdings** –
die Verfolgung _deiner Anlagen_ (ETFs, Aktien, Gold und weitere Positionen) – ist die erste,
vollständig ausgebaute Domäne. Sie verbindet sich nicht mit Bank- oder Broker-APIs; alle Daten
werden manuell über die Oberfläche eingegeben, mit CSV/JSON-Import als Komfort für die
Massenerfassung. Geplante Domänen erweitern die Anwendung über das Anlagetracking hinaus zu
einer umfassenden Finanzverwaltungs-App: Altersvorsorge, Versicherungen, Haushaltsplaner
(Haushalt und Budget), Historische Vermögensentwicklung und Kontenübersicht.

## Status

Das technische Grundgerüst ist vorhanden (Nx-Monorepo, NestJS-Backend, Angular-Frontend, SQLite,
Docker-Compose-Orchestrierung). Holdings-Tracking (manuelle Eingabe, CRUD,
Verteilungsdiagramme nach Typ) ist ausgebaut. Das Frontend ist zu einer Multi-Domänen-App-Shell
gewachsen – Authentifizierung/Sitzungen, Administration (Konten, Einladungen, Registrierungen),
Selbstregistrierung, Profil-/Passwort-/Präferenzeinstellungen, mehrsprachige Oberfläche,
Thema-Umschaltung und ein Dashboard – mit Holdings als erster von mehreren geplanten Domänen.

Die Domäne **Einkommensentwicklung** (Gehaltsabrechnungen und Lohnsteuerbescheinigungen) ist
ebenfalls ausgebaut – siehe [Einkommensentwicklung](#einkommensentwicklung).

Für eine vollständige Beschreibung der Oberfläche siehe [docs/user-guide.de.md](docs/user-guide.de.md)
([English](docs/user-guide.md)).

## Einkommensentwicklung

Die Einkommensentwicklung (032-earnings-domain) macht aus Gehaltsabrechnungen einen Überblick über
das ganze Berufsleben – Brutto, Netto, Steuern und Sozialversicherung: Gesamtverdienst, das
aktuelle Jahr im Vergleich zu denselben Monaten des Vorjahres, Monats- und Jahresdiagramme,
Tabellen, ein Monatsdetail und eine **Datenprüfung**, die die Summen der Abrechnungen mit den
Jahressummen und der Lohnsteuerbescheinigung vergleicht.

**Unterstützte Dokumente**:

| Dokument                                     | Gelesen von                                         |
| -------------------------------------------- | --------------------------------------------------- |
| SAP-Entgeltnachweis                          | Parser `sap-entgeltnachweis`                        |
| Verdienstabrechnung der Deutschen Bundesbank | Parser `bundesbank-verdienstabrechnung`             |
| Wehrsoldabrechnung der Bundeswehr            | Parser `bundeswehr-wehrsoldabrechnung`              |
| Lohnsteuerbescheinigung                      | Parser `lohnsteuerbescheinigung` (alle Arbeitgeber) |
| Exportdatei (`earnings-export`, Vers. 1)     | JSON-Leser                                          |

Alle anderen Layouts sowie gescannte PDFs (nur Bild) werden mit klarer Begründung abgelehnt; aus
einer abgelehnten Datei wird nichts gespeichert. Jeder Wert durchläuft vor dem Import
Rechenprüfungen (Brutto − Steuern − Sozialversicherung = Netto, Netto ± Sonstiges = Auszahlung). Besteht eine
Abrechnung eine Prüfung nicht, bleiben ihre Werte in der Importvorschau sichtbar: Die an der
fehlgeschlagenen Prüfung beteiligten Werte lassen sich dort korrigieren (falsch gelesene Ziffer),
die Prüfungen laufen bei jeder Änderung neu, und der Server prüft beim Import erneut. Gespeichert
werden nur die Namen korrigierter Werte; sie bleiben in Vorschau, Importverlauf und Monatsdetail
als „von Ihnen korrigiert“ markiert.

**Datenschutz und Bedrohungsmodell**

- PDFs werden **im Browser** gelesen (PDF.js). Weder die Datei noch ihr Text wird hochgeladen –
  nur die freigegebenen Werte aus der Importvorschau („Werte, die gesendet werden“) sowie
  Dateiname, SHA-256-Fingerabdruck und Parser-ID/-Version. Steuer-ID, Sozialversicherungsnummer,
  IBAN, Name oder Adresse werden weder gelesen noch gesendet.
- Jeder Betrag wird **verschlüsselt gespeichert** (AES-256-GCM) – mit einem Schlüssel, den der
  Betreiber der Instanz konfiguriert (`EARNINGS_ENCRYPTION_KEY`). Eine Kopie der Datenbankdatei
  oder ein Backup allein verrät keinen Betrag; Zeitraum, Arbeitgeber, Art und Jahr bleiben für
  Abfragen im Klartext.
- Die Daten sieht **nur ihr Eigentümer** – auch Administratoren sehen die Einkommensdaten anderer
  nicht. Der Betreiber betreibt den Server und hält den Schlüssel; ihm wird also vertraut, und der
  Datenschutzhinweis in der App sagt das offen.
- Logs enthalten nur Import-Metadaten (Import-ID, Hash, Parser, Anzahlen, Ergebnis) – nie einen
  Betrag oder Dokumenttext.
- Nutzer können einzelne Importe oder alle Einkommensdaten jederzeit löschen; die Daten sind Teil
  des vollständigen Archivs „Meine Daten exportieren“.

**Freischaltung** – Die Einkommensentwicklung ist für Mitglieder **nicht** standardmäßig
freigeschaltet. Ein Administrator aktiviert sie pro Mitglied im Administrationsbereich (Reiter _Konten_,
Domänen-Schalter). Administratoren können die Domäne für ihre eigenen Daten nutzen.

**Schlüsselverwaltung und -verlust** – siehe
[Schlüssel für die Einkommensentwicklung](#schlüssel-für-die-einkommensentwicklung). Fehlt der
Schlüssel oder ist er ungültig, zeigt die Domäne „Einkommensdaten sind vorübergehend nicht
verfügbar“, die API antwortet mit `503 EARNINGS_UNAVAILABLE` und es werden keine Importe
angenommen; alle anderen Domänen funktionieren weiter. **Geht der Schlüssel verloren oder wird er
geändert, sind alle gespeicherten Einkommensbeträge unwiederbringlich verloren** – sichern Sie ihn
getrennt von der Datenbank. Eine Schlüsselrotation wird noch nicht unterstützt.

Die Übereinstimmung der Parser mit dem Referenz-Extraktor (earnings-evolution) lässt sich lokal prüfen (nie in der CI, echte
Abrechnungen verlassen den Rechner nicht) mit `tools/earnings/parity-check.mjs` – siehe
[specs/032-earnings-domain/quickstart.md](specs/032-earnings-domain/quickstart.md) §6.

## Tech-Stack

- **Monorepo**: [Nx](https://nx.dev), TypeScript durchgehend
- **Backend**: [NestJS](https://nestjs.com) (`apps/backend`) – stellt `GET /health`, Auth/Session,
  Konten/Einladungen und die `/holdings`-API bereit
- **Frontend**: [Angular](https://angular.dev) (`apps/frontend`) – eine App-Shell (Routing,
  Layout, Navigation, Auth/Session, Dashboard, Einstellungen), die unabhängige Domänenbibliotheken
  zusammensetzt
- **Datenbank**: SQLite, direkt in den Backend-Prozess eingebettet als einzelne Datei, per
  Bind-Mount aus dem Host-Verzeichnis `./data`
- **Gemeinsame Bibliotheken**: `libs/api-contract` (Wire-Typen zwischen Backend/Frontend),
  `libs/domain/holdings`, `libs/domain/auth`, `libs/domain/invitations`, `libs/domain/accounts`,
  `libs/account-fields`, `libs/market-data`, `libs/notifications`, `libs/observability`
  (Correlation-IDs, strukturiertes Request-Logging und die kategorisierte
  `BusinessException`-Hierarchie hinter jeder Backend-Fehlerantwort)

## Frontend-Domänenbibliothek-Architektur

Das Frontend ist in eine App-Shell plus unabhängige Domänenbibliotheken unter
`libs/frontend/domain/<name>` aufgeteilt (Holdings heute; Klaro als Info-Seite mit Verlinkung zur
eigenständigen [Klaro](https://klaro.allwang.family/)-App, Kontosynchronisierung geplant; weitere
Domänen als Platzhalter). Diese Struktur und die Nx-Projektgrenzen, die sie durchsetzen, sind eine
bindende Architekturentscheidung:

- `libs/frontend/domain/<name>` (`scope:frontend-domain`) – eine pro Domäne; darf KEINE andere
  Domänenbibliothek importieren, nur `scope:shared`-Bibliotheken.
- `libs/frontend/domain-access` (`scope:shared`) – der einzige Ort für Berechtigungsprüfungen.
- `libs/frontend/admin` (`scope:frontend-admin`) – Administrationsbereich.
- `libs/frontend/shared-ui` (`scope:shared`) – gemeinsame Komponenten/Pipes/i18n.
- `apps/frontend` (`scope:frontend`, die App-Shell) – Routing, Layout/Navigation und die
  Dashboard-/Einstellungs-Erweiterungsregistries.

Die Grenzen werden zur Linting-Zeit über `@nx/enforce-module-boundaries` durchgesetzt.

## Den Stack lokal ausführen

Voraussetzungen: Docker + Docker Compose. Keine lokale Node.js- oder Datenbankinstallation
erforderlich – alles läuft in Containern.

```bash
docker compose up --build
```

- Frontend: <http://localhost:4200>
- Backend Health-Check: <http://localhost:3000/health>
- Interaktive API-Dokumentation: <http://localhost:4200/swagger> — Schema jedes Endpunkts, direkt
  aus den Backend-Controllern/DTOs generiert, mit „Try it out“ unter Verwendung deiner echten
  Browser-Sitzung (melde dich zuerst in der App an). Dasselbe Dokument steht auch unter
  <http://localhost:4200/api/openapi.yml> zum Download bereit, und eine eingecheckte
  [Bruno](https://www.usebruno.com/)-Collection liegt unter [api/bruno/](api/bruno/) zum
  Ausprobieren der API außerhalb des Browsers — siehe
  specs/031-openapi-swagger-integration/quickstart.md für eine vollständige Anleitung.
- Datenbank: einzelne SQLite-Datei unter `./data` auf dem Host

Stack stoppen mit `docker compose down` – `./data` ist ein Host-Bind-Mount und überlebt `down`
automatisch; lösche das Verzeichnis selbst, wenn du alle Daten löschen möchtest.

### Authentifizierung

Alle Routen erfordern eine angemeldete Sitzung, außer `/health`. Beim ersten Start gegen eine
leere Datenbank legt das Backend ein einzelnes Administrator-Konto aus Umgebungsvariablen an –
setze sie vor dem ersten Start:

```bash
cp .env.example .env
# dann .env bearbeiten und BOOTSTRAP_ADMIN_PASSWORD (und weitere) befüllen
```

| Variable                             | Pflicht | Standard | Zweck                                                                             |
| ------------------------------------ | ------- | -------- | --------------------------------------------------------------------------------- |
| `BOOTSTRAP_ADMIN_EMAIL`              | Ja\*    | —        | Anmelde-E-Mail des angelegten Administrator-Kontos (nur bei leerem `users`-Table) |
| `BOOTSTRAP_ADMIN_PASSWORD`           | Ja\*    | —        | Passwort (8–200 Zeichen); mit Argon2id gehasht, nie im Klartext gespeichert       |
| `SESSION_INACTIVITY_TIMEOUT_MINUTES` | Nein    | `30`     | Sitzung wird nach dieser Inaktivitätsdauer beim nächsten Zugriff abgewiesen       |
| `SESSION_ABSOLUTE_LIFETIME_HOURS`    | Nein    | `12`     | Absolute Obergrenze für die Sitzungsdauer, unabhängig von der Aktivität           |

\*Nur beim ersten Start gegen eine leere Datenbank erforderlich – bei bereits befüllten
Datenbanken werden diese Variablen ignoriert.

`.env` ist in `.gitignore` eingetragen (nur `.env.example` ist eingecheckt). Docker Compose lädt
sie automatisch; Nx lädt sie automatisch in `process.env` für jeden Target, den es ausführt.

### Schlüssel für die Einkommensentwicklung

Die Einkommensentwicklung verschlüsselt jeden gespeicherten Betrag mit `EARNINGS_ENCRYPTION_KEY`
(Base64 von genau 32 Zufallsbytes). Erzeugen Sie ihn einmalig und tragen Sie ihn in `.env` ein
(bzw. in die Umgebung des Stacks in Portainer):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Sichern Sie den Schlüssel **getrennt** von `./data`: Ein Datenbank-Backup ohne seinen Schlüssel
lässt sich nicht entschlüsseln, und ein verlorener oder geänderter Schlüssel macht alle
gespeicherten Einkommensbeträge unwiederbringlich. Ohne gültigen Schlüssel startet das Backend
trotzdem; nur die Einkommensentwicklung meldet „vorübergehend nicht verfügbar“.

### Hot-Reload-Entwicklungsmodus

Der obige Befehl baut Produktions-Images (kein Live-Reload). Für die tägliche Entwicklung:

```bash
npm run dev
```

- Frontend: <http://localhost:4200>, baut neu und lädt bei Speicherung
- Backend: <http://localhost:3000>, baut neu und startet bei Speicherung

Entspricht:

```bash
npm exec nx serve frontend
npm exec nx serve backend
```

### Lokale Entwicklungs-Tools

Linting, Formatierung, Dependency-Hygiene (knip), Secret-Scanning und die Git-Hooks, die das
automatisch ausführen, sind separat dokumentiert in
[docs/development.de.md](docs/development.de.md) ([English](docs/development.md)).

### Schlüssel für die Altersvorsorge

Die Altersvorsorge verschlüsselt jeden gespeicherten Betrag, jede Vertragsnummer und jede Ergänzung
mit einem eigenen `RETIREMENT_ENCRYPTION_KEY` (Base64 von genau 32 Zufallsbytes), getrennt vom
Schlüssel der Einkommensentwicklung. Erzeugen und sichern Sie ihn wie diesen (siehe oben) – ein
verlorener oder geänderter Schlüssel macht alle gespeicherten Altersvorsorge-Daten unwiederbringlich
unlesbar. **Ohne gültigen Schlüssel startet das Backend trotzdem**, aber jede `/retirement`-Route
antwortet mit `503 RETIREMENT_UNAVAILABLE` (fail closed) und der Bereich zeigt „nicht verfügbar“;
die übrigen Bereiche bleiben unberührt, gespeicherte Daten gehen nicht verloren.

### Schlüssel für das Vermögen

Der Bereich „Vermögen“ (Vermögensentwicklung) verschlüsselt jeden gespeicherten Stichtag –
Positionsnamen, Klassen, Beträge und Notizen – mit einem eigenen `WEALTH_ENCRYPTION_KEY` (Base64 von
genau 32 Zufallsbytes), getrennt von den Schlüsseln für Einkommensentwicklung und Altersvorsorge.
Erzeugen und sichern Sie ihn wie den Schlüssel der Einkommensentwicklung (siehe oben) – ein
verlorener oder geänderter Schlüssel macht alle gespeicherten Vermögensdaten unwiederbringlich
unlesbar. **Ohne gültigen Schlüssel startet das Backend trotzdem**, aber jede `/wealth`-Route
antwortet mit `503 WEALTH_UNAVAILABLE` (fail closed) und der Bereich zeigt „nicht verfügbar“; die
übrigen Bereiche bleiben unberührt, gespeicherte Daten gehen nicht verloren.

### Schlüssel für die Versicherungen

Der Bereich „Versicherungen“ verschlüsselt jeden gespeicherten Vertrag (Bezeichnungen, Versicherer,
Vertragsnummern, Beiträge, Daten, Notizen), das Profil des Lückenchecks und die
Erinnerungseinstellungen mit einem eigenen `INSURANCES_ENCRYPTION_KEY` (Base64 von genau 32
Zufallsbytes), getrennt von den übrigen Schlüsseln. Erzeugen und sichern Sie ihn wie den Schlüssel
der Einkommensentwicklung (siehe oben) – ein verlorener oder geänderter Schlüssel macht alle
gespeicherten Versicherungsdaten unwiederbringlich unlesbar. **Ohne gültigen Schlüssel startet das
Backend trotzdem**, aber jede `/insurances`-Route antwortet mit `503 INSURANCES_UNAVAILABLE` (fail
closed), es werden keine Erinnerungs-E-Mails versendet und der Bereich zeigt „nicht verfügbar“; die
übrigen Bereiche bleiben unberührt, gespeicherte Daten gehen nicht verloren. Erinnerungs-E-Mails
nutzen die SMTP-Einstellungen der übrigen Benachrichtigungen und den Link aus `APP_BASE_URL`.

### Schlüssel für die Kontoübersicht

Die Kontoübersicht verschlüsselt jeden gespeicherten Konto-Eintrag (Namen, Anbieter, Websites,
Zwecke, Kartennummern, Notizen) mit einem eigenen `ACCOUNT_OVERVIEW_ENCRYPTION_KEY` (Base64 von
genau 32 Zufallsbytes), getrennt von den übrigen Schlüsseln. Erzeugen und sichern Sie ihn wie den
Schlüssel der Einkommensentwicklung (siehe oben) – ein verlorener oder geänderter Schlüssel macht
alle gespeicherten Kontodaten unwiederbringlich unlesbar. **Ohne gültigen Schlüssel startet das
Backend trotzdem**, aber jede `/account-overview`-Route antwortet mit
`503 ACCOUNT_OVERVIEW_UNAVAILABLE` (fail closed) und die Kontoübersicht zeigt „nicht verfügbar“;
die übrigen Bereiche bleiben unberührt, gespeicherte Daten gehen nicht verloren.

### Schlüsselrotation, Sicherung und Wiederherstellung

Jeder verschlüsselte Bereich nutzt ein **zweistufiges Schlüsselverfahren**: Der konfigurierte
`<BEREICH>_ENCRYPTION_KEY` ist ein _Hauptschlüssel_, der nur zufällig erzeugte _Datenschlüssel_ schützt,
die verpackt in der Datenbank liegen; die Datenschlüssel verschlüsseln die Daten. Eine Neuinstallation
oder ein Upgrade einer bestehenden Installation braucht keinen manuellen Schritt: Beim ersten Start
nach dem Upgrade werden vorhandene Daten einmalig mit den bisherigen Schlüsseln auf einen
Datenschlüssel umgestellt (der betroffene Bereich antwortet dabei kurz mit `503`, bei üblichen
Datenmengen Sekunden).

- **Schlüssel getrennt von `./data` sichern** (Passwortmanager oder Secret-Store, nicht in derselben
  Sicherung wie die Datenbank). Datenbank und Schlüssel zusammen stellen alles wieder her, jedes allein
  nicht. Nach einer Wiederherstellung die App starten und **Verwaltung → Verschlüsselung** öffnen: Jeder
  Bereich sollte _Bereit_ anzeigen.
- **Fehlender oder falscher Schlüssel**: Der Bereich ist gesperrt (`503`), nichts wird geschrieben oder
  verändert, und Verwaltung → Verschlüsselung zeigt die Ursache. Den richtigen Schlüssel wiederherstellen
  und neu starten; alle Daten sind wieder da.
- **Planmäßige Rotation eines Hauptschlüssels** (ohne Ausfall, Daten bleiben unberührt): den neuen
  Schlüssel als `<BEREICH>_ENCRYPTION_KEY` und den alten als `<BEREICH>_ENCRYPTION_KEY_PREVIOUS` setzen,
  neu starten, Verwaltung → Verschlüsselung öffnen und je Bereich **Hauptschlüssel rotieren** ausführen.
  Meldet die Seite den vorherigen Schlüssel als entfernbar, `<BEREICH>_ENCRYPTION_KEY_PREVIOUS` löschen
  und neu starten. Der alte Schlüssel öffnet danach nichts mehr.
- **Notfall-Rotation nach einem Schlüsselleck**: die Hauptschlüssel-Rotation wie oben ausführen, dann
  **Daten neu verschlüsseln** für den Bereich (Bestätigung durch Eingabe der Bereichs-ID; der Bereich ist
  währenddessen nicht verfügbar) und zuletzt **Schlüssel vernichten** für den ausgemusterten
  Datenschlüssel. Die neuen Schlüssel erneut sichern.
- Schlüssel werden ausschließlich über die Server-Umgebung geliefert; sie erscheinen nie in der
  Oberfläche, der API oder den Logs.

## Mit Portainer deployen (oder einem anderen Docker-Hub-basierten Host)

`docker-compose.yml` baut Images lokal aus dem Quellcode, was für Portainer auf einem NAS nicht
ideal ist. Nutze stattdessen
[`docker-compose.portainer.yml`](docker-compose.portainer.yml) – es zieht vorgefertigte Images
von Docker Hub.

1. Bringe die beiden Images auf Docker Hub, entweder:

   - **Automatisch**: ein Push mit einem `v*.*.*`-Tag startet
     [`.github/workflows/release.yml`](.github/workflows/release.yml), das beide Dockerfiles
     baut und `walefish/vaultfolio-backend`/`walefish/vaultfolio-frontend` als `:latest` und
     `:<tag>` pusht (benötigt die Repo-Secrets `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN`).
   - **Manuell** von einem Entwicklungsrechner:

     ```bash
     docker login
     docker build -f docker/backend.Dockerfile -t <dockerhub-user>/vaultfolio-backend:latest .
     docker build -f docker/frontend.Dockerfile -t <dockerhub-user>/vaultfolio-frontend:latest .
     docker push <dockerhub-user>/vaultfolio-backend:latest
     docker push <dockerhub-user>/vaultfolio-frontend:latest
     ```

2. In Portainer: **Stacks → Stack hinzufügen**, Inhalt von `docker-compose.portainer.yml`
   einfügen. Unter **Umgebungsvariablen** `DOCKERHUB_USER` nur setzen, wenn du auf ein anderes
   Konto pushst, und `TAG`, wenn nicht `latest` deployed werden soll.
3. Stack deployen. Das Frontend ist auf Port 4200 erreichbar (`http://<nas-ip>:4200`). Die
   Datenbank liegt in `/opt/vaultfolio/data` auf dem Host – Verzeichnis vor dem Deployen anlegen:
   `mkdir -p /opt/vaultfolio/data`.

Neu deployen nach einem neuen Push: erneut die `docker push`-Befehle ausführen, dann in
Portainer **Stacks → dein Stack → Pull and redeploy**.

### Was Portainer eigentlich ist

Portainer ist eine **Web-Oberfläche über Docker** — es ruft die Docker-API auf und zeigt sie im
Browser. Es ist keine Laufzeitumgebung. Deine Stacks (Frontend, Backend, etc.) laufen als ganz
normale Docker-Container direkt auf dem Host; Portainer erlaubt dir nur, sie ohne Terminal zu
verwalten.

Wichtige Konsequenz: **Portainer stoppen oder neustarten berührt deine Stacks nicht.** Die Stacks
laufen weiter. Portainer ist wie ein Cockpit-Display — wenn man es ausschaltet, fliegt das
Flugzeug weiter.

### Portainer selbst aktualisieren

Portainer läuft als eigener Docker-Container und speichert seine Konfiguration (Endpunkte, Nutzer,
Stack-Definitionen, Umgebungsvariablen) in einem Docker-verwalteten Volume (`portainer_data`).
Aktualisieren bedeutet: Container ersetzen, Volume behalten.

```bash
# Optional aber empfohlen: Volume vorher sichern
docker run --rm \
  -v portainer_data:/data \
  -v /root:/backup \
  alpine tar czf /backup/portainer_backup_$(date +%Y%m%d).tar.gz /data

# Container ersetzen (Stacks laufen die ganze Zeit durch)
docker stop portainer && docker rm portainer
docker pull portainer/portainer-ce:2.45.0
docker run -d \
  -p 8000:8000 -p 9443:9443 \
  --name portainer \
  --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:2.45.0
```

Ausfallzeit: ~15 Sekunden. Alle Stacks laufen unterbrechungsfrei weiter. Das `portainer_data`
Volume — inklusive aller Stack-Definitionen und Umgebungsvariablen — bleibt über das Update
hinweg erhalten.

## Frontend-Umgebungskonfiguration

`apps/frontend` folgt dem Standard-Angular-Umgebungsdatei-Muster unter
`apps/frontend/src/environments/`:

- `environment.ts` – eingecheckt. Nur sichere Standardwerte, keine Secrets.
- `environment.local.example.ts` – eingecheckte Vorlage.
- `environment.local.ts` – **gitignored**, nie eingecheckt. Jeder Entwickler erstellt sie lokal.

Einrichtung für neue Entwickler:

```bash
cp apps/frontend/src/environments/environment.local.example.ts \
   apps/frontend/src/environments/environment.local.ts
# dann environment.local.ts bearbeiten und den PrimeUI-Lizenzschlüssel einfügen
```

## Tests ausführen

```bash
npm run test:backend   # apps/backend – kein Frontend, kein Browser erforderlich
npm run test:frontend  # apps/frontend – kein Backend erforderlich (HTTP gemockt)
```

## Eine neue Bibliothek hinzufügen

```bash
npx nx g @nx/js:library some-new-domain-lib --directory=libs/domain/some-new-domain-lib
npx nx test some-new-domain-lib
```

## Release-Prozess

Frontend und Backend werden gemeinsam unter einer einzigen Versionsnummer veröffentlicht.
Dies wird von [Nx Release](https://nx.dev/docs/features/manage-releases) mit
`release.projectsRelationship: "fixed"` gehandhabt: Jedes Release erhöht
`apps/frontend/package.json` und `apps/backend/package.json` auf dieselbe Version, abgeleitet
aus [Conventional Commits](https://www.conventionalcommits.org) seit dem letzten Release.

Releases werden interaktiv über den `release`-Claude-Code-Skill gesteuert. Nach Bestätigung:

```bash
npm run release   # entspricht: npx nx release --skip-publish
```

## Entwicklungsprozess

Dieses Projekt verwendet [Spec Kit](.specify/) für die Entwicklung:

1. `/speckit-constitution` – Projektprinzipien und -constraints (abgeschlossen)
2. `/speckit-specify` – Feature definieren
3. `/speckit-plan` – Implementierung planen
4. `/speckit-tasks` – Plan in Tasks aufteilen
5. `/speckit-implement` – Tasks implementieren

## PrimeNG

Das Frontend-UI-Framework ist [PrimeNG](https://primeng.dev). Um Claude Code bei PrimeNG-APIs
aktuell zu halten, installiert jeder Entwickler das offizielle PrimeNG-Claude-Code-Plugin lokal:

```bash
npx @primeui/cli plugin install --tool claude --library primeng
```

Claude Code neu starten, dann `/mcp` ausführen, um zu prüfen, ob der `primeng`-MCP-Server
verbunden ist.

## Lizenz

[MIT](LICENSE.md)
