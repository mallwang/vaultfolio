# Vaultfolio – Benutzeranleitung

> This guide is also available in English: [English User Guide](user-guide.md)

Vaultfolio ist eine selbst gehostete Anwendung zur persönlichen Finanzverwaltung. Du pflegst dein
Anlageportfolio manuell – ohne Verbindung zu Banken oder Brokern. Alle Daten liegen in deiner
eigenen Infrastruktur.

---

## Inhaltsverzeichnis

1. [Zugang erhalten](#1-zugang-erhalten)
   - 1.1 [Selbstregistrierung](#11-selbstregistrierung)
   - 1.2 [Einladungsbasierte Registrierung](#12-einladungsbasierte-registrierung)
   - 1.3 [Passwort vergessen](#13-passwort-vergessen)
2. [Navigation](#2-navigation)
   - 2.1 [Seitenleiste](#21-seitenleiste)
   - 2.2 [Kopfzeile](#22-kopfzeile)
3. [Dashboard](#3-dashboard)
4. [Holdings](#4-holdings)
   - 4.1 [Die Holdings-Liste](#41-die-holdings-liste)
   - 4.2 [Eine Position hinzufügen](#42-eine-position-hinzufügen)
   - 4.3 [Anlagetypen und ihre Felder](#43-anlagetypen-und-ihre-felder)
   - 4.4 [Verteilungsdiagramme](#44-verteilungsdiagramme)
   - 4.5 [Positionen bearbeiten und löschen](#45-positionen-bearbeiten-und-löschen)
   - 4.6 [Holdings-Daten exportieren](#46-holdings-daten-exportieren)
5. [Kontenübersicht](#5-kontenübersicht)
6. [Klaro](#6-klaro)
7. [Einkommensentwicklung](#7-einkommensentwicklung)
   - 7.1 [Zugang und Datenschutz](#71-zugang-und-datenschutz)
   - 7.2 [Dokumente importieren](#72-dokumente-importieren)
   - 7.3 [Überblick, Tabellen und Monatsdetail](#73-überblick-tabellen-und-monatsdetail)
   - 7.4 [Datenprüfung](#74-datenprüfung)
   - 7.5 [Importe, Umbenennen und Löschen](#75-importe-umbenennen-und-löschen)
   - 7.6 [Parser anfragen](#76-parser-anfragen)
     7a. [Altersvorsorge](#7a-altersvorsorge)
   - 7a.1 [Daten erfassen](#7a1-daten-erfassen)
   - 7a.2 [Übersicht und Tabs](#7a2-übersicht-und-tabs)
   - 7a.3 [Datenschutz, Export und Löschen](#7a3-datenschutz-export-und-löschen)
     7b. [Vermögen](#7b-vermögen)
   - 7b.1 [Stichtage erfassen](#7b1-stichtage-erfassen)
   - 7b.2 [Entwicklung, Bilanz und Kachel](#7b2-entwicklung-bilanz-und-kachel)
   - 7b.3 [Export, Datenschutz und Löschen](#7b3-export-datenschutz-und-löschen)
     7c. [Versicherungen](#7c-versicherungen)
   - 7c.1 [Verträge erfassen](#7c1-verträge-erfassen)
   - 7c.2 [Übersicht, Fristen und Erinnerungen](#7c2-übersicht-fristen-und-erinnerungen)
   - 7c.3 [Lückencheck, Datenschutz und Löschen](#7c3-lückencheck-datenschutz-und-löschen)
8. [Einstellungen](#8-einstellungen)
   - 8.1 [Profil](#81-profil)
   - 8.2 [Präferenzen](#82-präferenzen)
9. [Administrationsbereich](#9-administrationsbereich)
   - 9.1 [Konten verwalten](#91-konten-verwalten)
   - 9.2 [Einladungen](#92-einladungen)
   - 9.3 [Registrierungsanfragen](#93-registrierungsanfragen)
   - 9.4 [Parser- und andere Anfragen](#94-parser--und-andere-anfragen)
   - 9.5 [Systemstatus](#95-systemstatus)
   - 9.6 [Domänen-Wartung](#96-domänen-wartung)

---

## 1. Zugang erhalten

### 1.1 Selbstregistrierung

Rufe `/signup` auf und gib deine E-Mail-Adresse, ein Passwort (8–200 Zeichen) und die
Bot-Schutzabfrage ein. Nach dem Absenden:

1. Du erhältst eine Bestätigungs-E-Mail – klicke auf den Link, um deine Adresse zu verifizieren.
2. Deine Anfrage landet in der Admin-Prüfwarteschlange. Ein Administrator muss sie genehmigen,
   bevor du dich anmelden kannst.
3. Nach der Genehmigung erhältst du eine Bestätigungs-E-Mail und kannst dich normal anmelden.

> **Hinweis:** Dein Konto ist erst aktiv, wenn beide Schritte abgeschlossen sind. Falls du die
> Bestätigungs-E-Mail nicht innerhalb weniger Minuten erhältst, prüfe deinen Spam-Ordner.

### 1.2 Einladungsbasierte Registrierung

Administratoren können Benutzer direkt einladen. Du erhältst eine Einladungs-E-Mail mit einem
Link. Klicke darauf, um dein eigenes Passwort festzulegen – der Administrator sieht es nicht.
Dein Konto wird sofort nach dem Akzeptieren der Einladung aktiviert.

Einladungslinks laufen ab. Wenn dein Link abgelaufen ist, bitte einen Administrator, die
Einladung erneut zu senden.

### 1.3 Passwort vergessen

Klicke auf der Anmeldeseite auf **Passwort vergessen?**. Gib deine E-Mail-Adresse ein und prüfe
deinen Posteingang auf einen Zurücksetzungs-Link. Der Link ist einmalig verwendbar und läuft
nach 24 Stunden ab.

---

## 2. Navigation

### 2.1 Seitenleiste

Die Seitenleiste listet alle Bereiche auf, auf die du Zugriff hast. Klicke auf die
Schaltfläche am unteren Rand, um sie auf nur Symbole zu reduzieren; beim Überfahren eines
Symbols mit der Maus erscheint ein Tooltip mit dem Bereichsnamen. Die aktive Seite ist
hervorgehoben.

Welche Bereiche erscheinen, hängt davon ab, welche Domänen dir dein Administrator freigegeben
hat (siehe [Konten verwalten](#91-konten-verwalten)).

### 2.2 Kopfzeile

Die Kopfzeile ist immer sichtbar. Sie enthält:

| Element          | Funktion                                                        |
| ---------------- | --------------------------------------------------------------- |
| Logo             | Zurück zum Dashboard                                            |
| Sprachumschalter | Wechselt die Anzeigesprache der Oberfläche (Englisch / Deutsch) |
| Thema-Umschalter | Wechselt zwischen hellem und dunklem Modus                      |
| Dein Name        | Zeigt deinen Anzeigenamen und deine Rolle                       |
| Abmelden         | Beendet deine Sitzung                                           |

> **Anzeigesprache vs. E-Mail-Sprache:** Der Sprachumschalter ändert, was du in der Oberfläche
> siehst. Um die Sprache der E-Mails zu ändern, die du von Vaultfolio erhältst, gehe zu
> **Einstellungen → Präferenzen**.

> **Mehrere Konten in einem Browser:** Beim Abmelden wird die Seite neu geladen, sodass nichts von
> deinen Daten für die nächste Person zurückbleibt, die sich anmeldet. Ein Browser hat immer nur
> eine Vaultfolio-Sitzung, die sich alle Tabs teilen: Meldest du dich in einem zweiten Tab mit
> einem anderen Konto an (oder nimmst dort eine Einladung an), lädt der erste Tab neu und zeigt
> dieses Konto, sobald du zu ihm zurückkehrst.

---

## 3. Dashboard

Das Dashboard ist deine Startseite nach der Anmeldung. Es ist darauf ausgelegt,
Zusammenfassungs-Widgets der von dir genutzten Bereiche anzuzeigen – zum Beispiel eine Karte mit
dem Gesamtportfoliowert. Einige Widgets erscheinen erst, nachdem du Daten eingegeben hast. Das
Dashboard wird mit jeder neuen Domäne weiter ausgebaut.

**Dashboard anordnen.** Ziehe eine Kachel am Griff oben rechts an eine andere Stelle (oder
fokussiere den Griff und nutze die Pfeiltasten). Über **Dashboard bearbeiten** oberhalb der Kacheln
schaltest du einzelne Kacheln ein oder aus. Die Kachel eines Features, das für dein Konto
deaktiviert ist, bleibt als Platzhalter an ihrer Stelle; ihr Schalter ist ausgegraut – wende dich
an den Administrator, um das Feature freischalten zu lassen. Deine Anordnung wird nur in diesem
Browser und pro Konto gespeichert; **Zurücksetzen** stellt den Standard wieder her.

---

## 4. Holdings

Holdings ist die primäre Tracking-Domäne. Hier erfasst und verfolgst du deine
Anlageposition über verschiedene Anlagetypen hinweg.

### 4.1 Die Holdings-Liste

Gehe zu **Holdings → Liste**. Die Tabelle zeigt alle deine Positionen mit folgenden Spalten:
Typ, Anlage, Verwaltung (Broker oder Bank), Menge / Gewicht, Preis / Wert und Kaufdatum.

Nutze das Suchfeld oberhalb der Tabelle, um nach einem dieser Felder zu filtern.

### 4.2 Eine Position hinzufügen

Klicke auf **Position hinzufügen** (oben rechts im Panel). Ein Dialog öffnet sich. Wähle
zuerst den Anlagetyp – die verfügbaren Felder ändern sich je nach Typ (siehe unten). Fülle
die Felder aus und speichere.

### 4.3 Anlagetypen und ihre Felder

| Feld            |      ETF      |     Aktie     | Edelmetall |    Krypto    | Einlagengeld |
| --------------- | :-----------: | :-----------: | :--------: | :----------: | :----------: |
| ISIN            | ✓ (validiert) | ✓ (validiert) |     —      |      —       |      —       |
| Name            |       ✓       |       ✓       |     ✓      |      ✓       |      ✓       |
| Verwaltung      |       ✓       |       ✓       |     ✓      |      ✓       |      ✓       |
| Menge           |       ✓       |       ✓       |     —      |      ✓       |      —       |
| Gewicht (Gramm) |       —       |       —       |     ✓      |      —       |      —       |
| Ø Kaufpreis     |       ✓       |       ✓       |     —      |      ✓       |      —       |
| Aktueller Wert  |       —       |       —       |     ✓      |      —       |      ✓       |
| Kaufdatum       |       —       | ✓ (optional)  |     —      | ✓ (optional) |      —       |

Die ISIN-Validierung prüft die Prüfsumme automatisch – bei einer fehlerhaften ISIN erscheint
sofort eine Fehlermeldung.

**Verwaltung** ist der Broker, die Bank oder die Börse, bei der du die Position hältst (z. B.
„Trade Republic", „DKB", „Coinbase"). Das Feld ist Freitext und wird zum Filtern und Gruppieren
verwendet.

### 4.4 Verteilungsdiagramme

Oberhalb der Holdings-Tabelle zeigt ein Raster aus Kreisdiagrammen, wie dein Portfolio nach
Wert verteilt ist. Das erste Diagramm umfasst alle Anlagetypen zusammen. Weitere Diagramme
schlüsseln jeden Typ einzeln auf (bis zu fünf zusätzliche Kacheln).

Diagramme erscheinen erst, wenn mindestens eine Position mit bekanntem Wert hinzugefügt wurde.

### 4.5 Positionen bearbeiten und löschen

Jede Zeile hat zwei Schaltflächen rechts:

- **Stift** – öffnet den Bearbeitungsdialog mit den aktuellen Werten vorausgefüllt.
- **Papierkorb** – öffnet einen Bestätigungsdialog, bevor die Position dauerhaft gelöscht wird.

Das Löschen kann nicht rückgängig gemacht werden.

### 4.6 Holdings-Daten exportieren

Der Link **Daten exportieren** (oben rechts im Holdings-Panel, neben **Position hinzufügen**) öffnet
einen Dialog mit einer Karte pro Format. Jede Karte zeigt eine Vorschau, den genauen Dateinamen, den
Inhalt und wofür sich das Format eignet; der Button der Karte lädt genau dieses Format herunter, und
der Dialog bleibt offen, sodass du mehrere Formate in einem Besuch exportieren kannst. Die vier Formate:

| Format | Verwendungszweck                                   |
| ------ | -------------------------------------------------- |
| PDF    | Druckbarer Bericht mit eingebettetem Kreisdiagramm |
| Excel  | Formatierte `.xlsx`-Datei mit typisierten Spalten  |
| CSV    | Tabellenimport (Excel, LibreOffice usw.)           |
| JSON   | Strukturierte Rohdaten für Skripte oder Backups    |

Klicke auf die Schaltfläche einer Karte, um dieses Format herunterzuladen; die Datei wird sofort
heruntergeladen. Eine leere Holdings-Liste erzeugt eine gültige, aber zeilenlose
Datei (CSV/JSON/Excel) bzw. ein PDF mit nur dem Kopfbereich.

---

## 5. Kontenübersicht

Die **Kontenübersicht** ist ein Referenzverzeichnis deiner Finanzkonten – Bankkonten,
Kreditkarten, Depots usw.

Jeder Eintrag enthält: Name, Kategorie, Status (Aktiv / Deaktiviert), Anbieter, Website, Zweck,
ob du eine Karte dazu nutzt, erforderliches Mindestguthaben, Kartennummer (standardmäßig
verborgen, zum Anzeigen klicken), Kartenablaufdatum und Notizen.

Kategorien: Allgemein, Freizeit, Sparen, Depot, Kreditkarte, Sonstige.

Nutze die Schaltfläche **Konto hinzufügen**, um einen Eintrag zu erstellen. Bearbeiten und
Löschen funktionieren genauso wie bei Holdings. Das Deaktivieren eines Kontos markiert es als
inaktiv, ohne es zu löschen – nützlich für das Führen historischer Aufzeichnungen.

Die Liste lässt sich über die Kategorie-Chips, die Suche und den Statusfilter eingrenzen. Lange
Texte werden auf zwei Zeilen gekürzt; **Mehr anzeigen** klappt sie auf. Unten löscht **Alle Konten
löschen** nach einer Bestätigung sämtliche Konten.

Auf dem Dashboard zeigt die Kachel **Konten** die Gesamtzahl und die Anzahl je Kategorie und
verlinkt auf die Übersicht.

Deine Kontodaten werden verschlüsselt gespeichert. Hat der Betreiber den Schlüssel der
Kontoübersicht nicht eingerichtet, zeigt die Seite statt deiner Konten den Hinweis „nicht
verfügbar“.

Der Link **Daten exportieren** (oben rechts) funktioniert genauso wie bei Holdings – JSON, CSV,
Excel und PDF stehen im Export-Dialog zur Verfügung. Alle Formate führen aktive und stillgelegte
Konten getrennt auf (zwei Blätter, zwei CSV-Dateien, zwei JSON-Listen, zwei PDF-Tabellen); die
Kategorie ist eine Spalte.

---

## 6. Klaro

**Klaro** ist eine eigenständige Gewohnheits-Tracking-Anwendung, die separat von Vaultfolio
entwickelt wird. Der Klaro-Eintrag in der Seitenleiste (mit dem Klaro-eigenen Logo) öffnet eine
Informationsseite – er bindet Klaro selbst nicht ein.

Die Seite erklärt, was Klaro macht, und verlinkt auf die eigenständige Anwendung unter
[klaro.allwang.family](https://klaro.allwang.family/), die in einem neuen Tab geöffnet wird.
Klaro erfordert derzeit ein eigenes, separates Konto; eine zukünftige Aktualisierung wird es
ermöglichen, Daten zwischen beiden Anwendungen zu synchronisieren, sofern du in beiden dieselbe
E-Mail-Adresse verwendest.

---

## 7. Einkommensentwicklung

Die **Einkommensentwicklung** macht aus deinen Gehaltsabrechnungen einen Überblick über
dein ganzes Berufsleben – Brutto, Netto, Steuern und Sozialversicherung. Sie steht nur
zur Verfügung, wenn ein Administrator die Domäne für dein Konto freigeschaltet hat
(Administratoren haben sie immer).

### 7.1 Zugang und Datenschutz

Gehaltsabrechnungen gehören zu deinen sensibelsten Daten. Deshalb funktioniert die
Einkommensentwicklung anders als andere Bereiche:

- **Dokumente bleiben auf deinem Gerät.** PDFs werden in deinem Browser gelesen. Die
  Datei und ihr Text werden nie hochgeladen – gesendet werden nur die Werte aus der
  Importvorschau.
- **Nur Werte, keine Kennungen.** Steuer-ID, Sozialversicherungsnummer, IBAN, Name oder
  Adresse werden weder gesendet noch gespeichert.
- **Beträge werden verschlüsselt gespeichert.** Der Betreiber deiner Vaultfolio-Instanz
  betreibt den Server und verwaltet den Schlüssel.
- **Nur du siehst sie.** Niemand sonst in Vaultfolio – auch keine Administratoren –
  kann deine Einkommensdaten sehen.
- **Eine optionale Ausnahme.** Wird ein Dokument nicht erkannt, kannst du einen _Parser
  anfragen_ (siehe [7.6](#76-parser-anfragen)): erst nach deiner Prüfung und Einwilligung
  wird eine anonymisierte, neu aufgebaute Kopie – nie die Datei und nie deine echten
  Beträge – an die Administratoren gesendet.

Der Link **So werden Ihre Daten geschützt** in der Werkzeugleiste öffnet diesen Hinweis
jederzeit. Zeigt die Seite _Einkommensdaten sind vorübergehend nicht verfügbar_, kann
der Server deine Werte gerade nicht entschlüsseln; deine Daten sind nicht verloren –
wende dich an den Betreiber.

### 7.2 Dokumente importieren

Klicke auf **Dokumente importieren** und lege Dateien auf der Seite ab (oder nutze
**Dateien auswählen**). Unterstützt werden:

- **SAP-Entgeltnachweise**, einschließlich Korrekturen für frühere Monate,
- **Verdienstabrechnungen der Deutschen Bundesbank**, einschließlich Korrekturen,
- **Wehrsoldabrechnungen der Bundeswehr**, einschließlich Korrekturen für frühere Monate,
- **Lohnsteuerbescheinigungen** aller Arbeitgeber,
- **Exportdateien** (`earnings-export`, Version 1).

Jede Datei bekommt eine Zeile mit ihrem Ergebnis: **Neu**, **Ersetzt** (eine neuere
Fassung bereits importierter Werte), **Duplikat** (bereits importiert – übersprungen)
oder **Abgelehnt** mit Begründung, etwa wenn Brutto − Steuern − Sozialversicherung nicht
das Netto ergibt oder ein PDF keinen automatisch auswertbaren Text enthält und du die Erkennung
ablehnst (siehe unten). Abgelehnte Dateien werden nie gespeichert.

**Scans und PDFs ohne Text.** Enthält ein PDF keinen automatisch lesbaren Text (ein Scan oder ein
PDF, dessen Text in Grafiken umgewandelt wurde), zeigt seine Zeile **Entscheidung nötig**. Mit
**Text auf diesem Gerät lesen** startest du die Texterkennung: Datei und Text bleiben in deinem
Browser, sie funktioniert offline, nichts wird hochgeladen, gespeichert oder zwischengespeichert,
und ohne deine Zustimmung (pro Datei) startet nichts. Ein Fortschrittsbalken zeigt die gerade
gelesene Seite, du kannst jederzeit abbrechen. Grenzen: nur deutsche Dokumente, bis zu 5 Seiten.
Der erkannte Text durchläuft dieselben Leser und dieselben Rechenprüfungen wie jedes andere PDF,
aber **Ziffern können falsch gelesen werden** (etwa ein verlorenes Dezimalkomma): So gelesene
Dateien tragen das Kennzeichen **Texterkennung** und einen Hinweis, jeden Betrag zu prüfen; eine
fehlgeschlagene Prüfung öffnet wie gewohnt die Korrekturansicht, und das Kennzeichen bleibt in der
Importliste sichtbar. Wählst du **Jetzt nicht**, brichst ab, wird nichts erkannt oder läuft die
Erkennung nicht, wird die Datei wie bisher abgelehnt; du kannst weiterhin **Text stattdessen auf
diesem Gerät lesen** wählen.

Wird eine Abrechnung abgelehnt, weil eine Prüfung nicht aufgeht, öffnen sich ihre Werte in
der Zeile, damit du einen falsch gelesenen Wert korrigieren kannst: Die an der fehlgeschlagenen
Prüfung beteiligten Werte sind hervorgehoben (**In fehlgeschlagener Prüfung**) und editierbar –
`1.234,56` und `1234.56` funktionieren. Die Prüfungen laufen bei jeder Änderung neu; sobald
sie bestehen, zeigt die Zeile **Von Ihnen korrigiert** und kann importiert werden. **Gelesenen
Wert wiederherstellen** setzt den Originalwert zurück. Andere Werte sind nicht editierbar, der
Server prüft beim Import alles erneut, und korrigierte Werte bleiben in Vorschau,
Importverlauf („1 Wert von Ihnen korrigiert“) und Monatsdetail markiert. Klappe **Werte, die gesendet werden** auf, um genau zu sehen, was dein
Gerät verlässt. Gespeichert wird erst, wenn du unten auf die Import-Schaltfläche
klickst.

### 7.3 Überblick, Tabellen und Monatsdetail

- **Überblick** – der Gesamtverdienst (ganzes Berufsleben und pro Arbeitgeber, mit
  Durchschnitt pro Beschäftigungsmonat), das aktuelle Jahr im Vergleich zu denselben
  Monaten des Vorjahres, Brutto pro Jahr, wohin das Brutto Monat für Monat geht
  (Netto, Steuern, Sozialversicherung) und die Abzüge als Anteil am Brutto. Ein Klick
  auf einen Monat im Diagramm öffnet das **Monatsdetail** mit allen Abrechnungsteilen
  dieses Monats.
- **Tabellen** – eine Monatsübersicht pro Jahr (ein Klick auf eine Zelle öffnet das
  Monatsdetail), Steuern und Abgaben und deine Lohnsteuerbescheinigungen.
- Der Filter **Arbeitgeber** oben schränkt jede Ansicht auf einen Arbeitgeber ein.
- **Daten exportieren** öffnet einen Dialog, der deine Einkommensdaten als JSON, CSV (ZIP mit vier
  CSV-Dateien), Excel oder PDF anbietet. Das PDF
  ist eine Querformat-Übersicht: Diagramm „Brutto je Jahr“, Summen je Arbeitgeber mit
  Abschlusszeile „Berufsleben gesamt“, Monatsübersicht sowie Steuern und Abgaben pro
  Jahr (neueste zuerst, immer für dein gesamtes Berufsleben). Excel, CSV und JSON
  enthalten dieselben vier Tabellen wie das PDF (Brutto je Jahr, Arbeitgeber mit
  „Berufsleben gesamt“, Monatsübersicht mit Brutto und Netto in getrennten Spalten,
  Steuern und Abgaben): Excel hat ein Blatt je Tabelle (Quoten und Summen sind dort
  Formeln, in der Monatsübersicht stehen Brutto und Netto je Monat nebeneinander), CSV ist eine ZIP-Datei
  mit einer Datei je Tabelle, JSON verwendet in jeder Sprache dieselben Feldnamen.
  Einzelne Abrechnungsteile werden nicht mehr aufgelistet. Die Daten sind außerdem Teil
  des vollständigen Archivs **Meine Daten exportieren** in deinem Profil.

Das Dashboard zeigt ein Einkommens-Widget mit Brutto, Netto und Nettoquote des
aktuellen Jahres.

### 7.4 Datenprüfung

Der Reiter **Datenprüfung** vergleicht pro Arbeitgeber und Jahr die Summe deiner
Abrechnungen mit den Jahressummen auf der letzten Abrechnung des Jahres und mit der
Lohnsteuerbescheinigung und listet fehlende Monate auf. Die Zahl am Reiter (und der
Hinweis im Überblick) zeigt, wie viele Probleme gefunden wurden; zu jedem gibt es einen
Hinweis, etwa welche Abrechnungen noch fehlen.

### 7.5 Importe, Umbenennen und Löschen

Der Reiter **Importe** listet jede importierte Datei mit ihren Zeiträumen, der Anzahl
der Datensätze und dem Parser (mit Version), der sie gelesen hat. Der Verlauf ist nach dem
Jahr gruppiert, zu dem die Daten gehören; alle Jahre sind beim Öffnen zugeklappt – klicke
auf ein Jahr, um es zu öffnen, oder nutze **Alle aufklappen**.

- **Arbeitgeber umbenennen** – gib einem Arbeitgeber einen Anzeigenamen deiner Wahl;
  der aus den Dokumenten erkannte Name bleibt erhalten.
- **Import löschen** – entfernt genau die Werte, die diese Datei hinzugefügt hat.
- **Alle Einkommensdaten löschen** – entfernt dauerhaft alle Werte, Bescheinigungen,
  Arbeitgebernamen und den Importverlauf. Deine übrigen Vaultfolio-Daten bleiben
  unberührt.

### 7.6 Parser anfragen

Wird ein PDF mit Text als **Format noch nicht unterstützt** abgelehnt, bietet seine Zeile
**Parser anfragen** an (nicht bei passwortgeschützten Dateien oder Dateien, die eine Prüfung
nicht bestanden haben; ein Scan erst, nachdem sein Text per Texterkennung gelesen wurde – ohne
zweite Einwilligung). Ein Assistent mit vier Schritten führt dich:

1. **Einwilligung** – was auf deinem Gerät bleibt (das PDF, sein Text, alle echten Beträge),
   was gesendet wird (nur eine neu aufgebaute Kopie) und wer es sieht: die Administratoren
   deiner Instanz, nur im Portal (nie per E-Mail), gelöscht 30 Tage nach Abschluss der
   Anfrage. Die Dokumentprüfung listet gefundene personenbezogene Daten (Bankkonto, Steuer-ID,
   Sozialversicherungsnummer, E-Mail, Telefon, PLZ und Ort – automatisch entfernt, ohne
   vorheriges Schwärzen) und Text unter schwarzen Kästen. Setze den Haken, um fortzufahren.
2. **Wörter prüfen** – die neu aufgebaute Seite. Zahlen werden durch Zufallswerte gleicher
   Form ersetzt; bekannte Bezeichnungen bleiben; personenbezogene Daten werden entfernt und
   gesperrt. Entscheide bei jedem anderen Wort, ob du es **als Bezeichnung behältst** oder
   **maskierst** (Wort anklicken oder Liste nutzen).
3. **Regeln markieren** _(optional)_ – markiere, welche Zeilen welcher Betrag sind (Brutto,
   Lohnsteuer, …), Zahlenspalte und -format sowie den Zeitraum. Eine Live-Prüfung liest deine
   Originalbeträge auf deinem Gerät und zeigt, ob Brutto − Steuern − Sozialversicherung = Netto
   stimmt; sie wird nie gesendet. Die Markierungen sind ein Hinweis für den Entwickler und
   werden nie ausgeführt. **Markierungen überspringen** verwirft sie.
4. **Vorschau & Senden** – genau das, was die Administratoren erhalten. **Anfrage senden**
   ist aktiv, sobald jedes Wort entschieden ist und nichts Persönliches übrig bleibt;
   **Verwerfen** wirft alles weg.

Nur ein Aufruf verlässt dein Gerät: eine strukturierte, anonymisierte Beschreibung des
Layouts – nie eine Datei. Der Server prüft sie erneut und erzeugt das Muster-PDF selbst. Du
kannst drei offene Anfragen haben und fünf pro Tag senden. Setzt ein Administrator deine
Anfrage auf _Erledigt_, erhältst du eine E-Mail mit Link zurück zur Importseite. Löschst du
dein Konto, werden deine Anfragen und Muster mit gelöscht.

---

## 7a. Altersvorsorge

Die **Altersvorsorge** führt gesetzliche, betriebliche und private Vorsorge in einer Übersicht
zusammen. Sie ist nur verfügbar, wenn ein Administrator den Bereich Altersvorsorge für dein Konto
freigeschaltet hat.

### 7a.1 Daten erfassen

- **Dokument hochladen.** Wähle **Dokument hochladen** und das PDF deiner Renteninformation (DRV),
  einer Mitteilung zu Betriebs- oder Privatrente oder eines Kapitalkontos. Die Art wird automatisch
  erkannt. Das PDF wird in deinem Browser gelesen; Datei und Text verlassen dein Gerät nie – nach
  der Prüfung der erkannten Werte werden nur diese Zahlen gespeichert. Gescannte Dokumente brauchen
  eine Texterkennung auf dem Gerät, dafür wird je Datei deine Zustimmung abgefragt. Wird ein
  Dokument nicht erkannt, wird nichts gespeichert und du kannst die Werte manuell eingeben.
- **Manuell erfassen.** Wähle **Manuell erfassen**, die Art (gesetzliche Rente, Betriebsrente,
  Riester, private Rentenversicherung oder Altersvorsorgedepot) und fülle die passenden Felder aus.
  Eine garantierte Rente über der erwarteten Rente wird abgelehnt.
- **Importierte Einträge sind schreibgeschützt.** Werte aus einem Dokument lassen sich nicht ändern;
  du kannst ergänzen, was das Dokument nicht ausweist (z. B. den Monatsbeitrag), und den Eintrag
  durch ein neueres Dokument ersetzen. Manuelle Einträge kannst du jederzeit bearbeiten.

Garantierte Beträge erscheinen fett mit „garantiert“-Tag; erwartete Beträge sind Prognosen und
werden kursiv mit „≈“ dargestellt.

### 7a.2 Übersicht und Tabs

Die **Übersicht** zeigt erwartete und garantierte Monatsrente, den aktuellen Sparbetrag, den
Rentenbeginn, einen Balken „garantiert vs. erwartet“ und eine Karte je Säule. Einträge, die älter
als 12 Monate sind, sind als **Veraltet** markiert; fehlen Werte für die Summen, als
**Unvollständig**. Kapitalauszahlungen und Kapitalkonten zählen nicht zur Monatsrente; alle Beträge
sind brutto. Die Tabs **Gesetzlich**, **Betrieblich** und **Privat** listen die Verträge einer
Säule; **Weiterführende Informationen** verlinkt externe Quellen (die Links senden keine Daten).

Das Dashboard zeigt eine Kachel mit den wichtigsten Zahlen; ein Klick öffnet den Bereich.

### 7a.3 Datenschutz, Export und Löschen

Beträge und Vertragsnummern werden verschlüsselt gespeichert; Name, Adresse, Steuer-ID und
Bankdaten werden nie abgefragt oder gespeichert. Der Betreiber deiner Instanz hält den Schlüssel.
Meldet die Seite _Altersvorsorge ist nicht verfügbar_, kann der Server die Daten gerade nicht
lesen – sie sind nicht verloren; wende dich an den Betreiber. Der **Export** (Werkzeugleiste)
schreibt deine Einträge als PDF, Excel, CSV oder JSON. Unten bei **Weiterführende Informationen**
kannst du alle deine Altersvorsorge-Daten löschen (das Konto bleibt); einzelne Einträge löschst du
auf ihrer Karte.

---

## 7b. Vermögen

**Vermögen** (_Vermögensentwicklung_) zeigt, wie sich dein Nettovermögen über die Zeit entwickelt –
aus Stichtagen, die du von Hand erfasst. Der Bereich steht nur zur Verfügung, wenn eine
Administration die Domäne Vermögen für dein Konto freigeschaltet hat. Es wird nichts von Banken,
Brokern oder aus den Beständen übernommen.

### 7b.1 Stichtage erfassen

- Ein **Stichtag** ist ein Referenzdatum mit beliebig vielen Positionen. Jede Position hat einen
  Namen, eine Klasse und einen Betrag; das Feld (Vermögenswerte oder Verbindlichkeiten) bestimmt
  die Seite – Beträge gibst du immer positiv ein (`12.000,50` und `12000.50` funktionieren beide).
- Die Klasse ist Freitext. Vorschläge (Bargeld, Bankguthaben, Edelmetalle, Aktien & Fonds, Krypto,
  Immobilien, Fahrzeuge, Sammlerstücke; Immobiliendarlehen, Kredit, Sonstige Schulden) werden
  angeboten, ebenso bereits verwendete eigene Klassen. Tippst du eine **neue** Klasse, wirst du
  einmal gefragt, in welche Bilanzgruppe sie gehört.
- **Aus bestehendem Stichtag kopieren** übernimmt Namen und Klassen, damit du frühere Stichtage
  schnell nachtragen kannst; entferne Positionen, die es damals noch nicht gab. Die Checkbox
  **Beträge übernehmen** daneben (standardmäßig an) übernimmt auch die alten Beträge, sodass du beim
  Eintragen vergleichen kannst; ohne Haken beginnst du mit leeren Beträgen. Stichtage können in
  beliebiger Reihenfolge erfasst werden – alles wird nach Datum sortiert. Dieselbe Aktion gibt es in
  jeder Tabellenzeile (_Als Vorlage kopieren_).
- Ziehe den Griff links neben einer Position, um die Positionen innerhalb der Vermögenswerte bzw.
  Verbindlichkeiten umzusortieren; bei fokussiertem Griff verschieben auch die Pfeiltasten hoch und
  runter die Position.
- Pro Datum gibt es einen Stichtag. Ist das Datum vergeben, kannst du den bestehenden öffnen.
  Stichtage lassen sich jederzeit bearbeiten und löschen.

### 7b.2 Entwicklung, Bilanz und Kachel

Der Tab **Entwicklung** zeigt Nettovermögen, Veränderung zum vorherigen Stichtag (absolut und
prozentual; _k. A._, wenn das vorherige Nettovermögen nicht positiv war; grün bei Zunahme, rot bei
Abnahme, grau bei keiner Veränderung), Vermögenswerte und
Verbindlichkeiten, ein Diagramm mit einer Säule je Stichtag (Vermögenswerte nach Klasse gestapelt
über der Nulllinie, Verbindlichkeiten schraffiert darunter, Nettovermögen als Linie; die Legende
blendet Klassen aus) und die Stichtagstabelle, neueste zuerst. Neben der Veränderung in € und %
zeigt die Tabelle die Veränderung **p. a.**: die prozentuale Veränderung seit dem vorherigen
Stichtag, anhand der Tage zwischen beiden Daten auf ein Jahr hochgerechnet (_k. A._, wenn nicht
beide Nettovermögen positiv sind). Bei kurzen Abständen schwankt dieser Wert stark. Der **Zeitraum**-Filter (1 Jahr,
3 Jahre, Alle) gilt für Diagramm, Tabelle, Veränderungen und PDF. Bei nur einem Stichtag siehst du
die Zusammensetzung und den Hinweis auf einen zweiten; ohne Stichtage eine Einladung zum ersten.

Der Tab **Bilanz** ordnet die Positionen eines gewählten Stichtags in _Aktiva_ und _Passiva_ mit
Zwischensummen; das Eigenkapital ist das Nettovermögen, beide Seiten ergeben also stets dieselbe
Summe. Mit der Klassenauswahl verschiebst du eine Klasse in eine andere Bilanzgruppe – die Änderung
gilt für alle Stichtage. Kennzahlen werden nicht berechnet.

Das Dashboard zeigt eine Vermögens-Kachel mit dem aktuellen Nettovermögen, der Veränderung und
einem kleinen Verlauf; sie lässt sich wie jede Kachel ausblenden und umsortieren, ein Klick öffnet
den Bereich.

### 7b.3 Export, Datenschutz und Löschen

**Daten exportieren** schreibt einen PDF-Bericht (Kennzahlen, Diagramm, letzter Stichtag nach Klasse,
alle Stichtage und die Bilanz; er folgt dem Zeitraum-Filter) oder alle Positionen und Summen als
Excel, CSV oder JSON. Im PDF sind Zunahmen teal und Abnahmen orange, und die Bilanz zeigt
Gruppensummen fett mit eingerückten Positionen darunter. Positionsnamen, Klassen, Beträge und Notizen werden verschlüsselt gespeichert
und nie in Logs geschrieben. Unten auf der Seite entfernt **Alle Vermögensdaten löschen** jeden
Stichtag und jede Einstellung (das Konto bleibt); einzelne Stichtage löschst du in ihrer
Tabellenzeile. Steht dort _Vermögensdaten sind vorübergehend nicht verfügbar_, kann der Server die
Daten gerade nicht lesen – sie sind nicht verloren; wende dich an den Betreiber.

---

## 7c. Versicherungen

**Versicherungen** verwaltet alle deine persönlichen Versicherungen an einem Ort: Verträge, was sie
kosten und wann du sie kündigen kannst. Der Bereich steht nur zur Verfügung, wenn eine
Administratorin oder ein Administrator die Domäne Versicherungen für dein Konto freigeschaltet hat.
Alles wird von Hand erfasst; es wird nichts von Versicherern importiert und es werden keine Dokumente
gespeichert (nur Notizen).

### 7c.1 Verträge erfassen

- **Vertrag erfassen** öffnet ein Formular. Wähle den Versicherungstyp aus dem Katalog (gruppiert
  nach Personen, Haftung, Sachen, Mobilität, Recht und Sonstiges; jeder Typ zeigt, ob er wesentlich,
  empfohlen, situativ oder optional ist) und gib die Vertragsdaten ein: Versicherer, Vertragsnummer,
  Beginn und optional Ende, die **Prämie** mit Zahlweise (monatlich, vierteljährlich, halbjährlich,
  jährlich) und den Zahlungsmonat bei nicht monatlicher Zahlweise.
- **Kündigung**: Gib die Kündigungsfrist (Wochen oder Monate) an, ob sich der Vertrag automatisch
  verlängert (und um wie viele Monate), optional eine Mindestlaufzeit und, wenn der Versicherer eines
  nutzt, ein festes Kündigungsdatum pro Jahr (zum Beispiel 30. November bei der Kfz-Versicherung).
  Das Feld rechts zeigt beim Tippen die monatlichen und jährlichen Kosten und das **nächste mögliche
  Kündigungsdatum**.
- Je nach Typ werden weitere Angaben angeboten (zum Beispiel Deckungssumme und Selbstbeteiligung,
  Kennzeichen und Schadenfreiheitsklasse beim Auto, versicherte Monatsrente bei der
  Berufsunfähigkeit). **Deckt zusätzlich ab** ist für Kombiprodukte: Wähle die weiteren Typen, die der
  Vertrag abdeckt, damit der Lückencheck sie nicht als fehlend meldet.
- Einen Vertrag bearbeitest oder löschst du in seiner Zeile. Damit ein Vertrag nicht mehr zählt,
  setze seinen Status auf _Gekündigt_ mit einem Ende; er bleibt unter dem Statusfilter _Inaktiv_
  sichtbar.
- Gesetzliche Sozialversicherungen (Kranken-, Pflege-, Renten-, Arbeitslosenversicherung) sind
  Verträge des passenden gesetzlichen Typs mit monatlicher Prämie. Hast du Einkommensdaten, erscheinen
  sie automatisch als grüne, schreibgeschützte Zeilen mit dem Hinweis _aus Einkommen MM/JJJJ_
  (Arbeitnehmeranteil deiner neuesten Abrechnung) und aktualisieren sich mit jedem Import.
  **Manuell erfassen** legt stattdessen einen eigenen Vertrag an; die verknüpfte Zeile verschwindet
  dann, damit nichts doppelt gezählt wird. Der Schalter **Sozialversicherungen einrechnen** in der
  Werkzeugleiste nimmt sie in alle Summen auf oder lässt sie heraus.

### 7c.2 Übersicht, Fristen und Erinnerungen

Die Registerkarte **Übersicht** zeigt die Kosten pro Monat und pro Jahr (mit dem gesetzlichen Anteil),
die Anzahl aktiver Verträge, die nächste Kündigungsfrist, einen Ring der Jahreskosten nach Gruppe,
ein Balkendiagramm der Zahlungen pro Monat des gewählten Jahres (Jahresbeiträge erscheinen als
Spitzen), die anstehenden Kündigungsfristen und eine Zusammenfassung des Lückenchecks. Fristen im
Warnfenster werden hervorgehoben; das Fenster entspricht deinem Erinnerungsvorlauf (30 Tage, solange
Erinnerungen aus sind). Ohne Verträge erhältst du eine Einladung, den ersten zu erfassen.

Die Registerkarte **Verträge** listet alle Verträge, filterbar nach Gruppe, Status und Einstufung und
sortierbar nach Prämie und nächster Kündigung. Die Daten sind die berechneten Daten; sie werden nicht
an Wochenenden oder Feiertage angepasst.

Der Link **Erinnerungen** (Werkzeugleiste, z. B. „3 Erinnerungen aktiv“ oder „Erinnerungen aus“)
öffnet einen Dialog, in dem du Erinnerungs-E-Mails zu Kündigungsfristen ein- oder ausschaltest
(Standard: aus), den Vorlauf wählst (7 bis 120 Tage, Standard 30) und einzelne Verträge abschaltest;
bei ausgeschalteten Erinnerungen sind die Schalter pro Vertrag deaktiviert. Jede Vertragskachel zeigt,
wann die E-Mail versendet wird, und eine E-Mail-Vorschau zeigt, was du in deiner E-Mail-Sprache
erhältst (einstellbar unter Einstellungen > Präferenzen; ein Hinweis erscheint, wenn sie von der
Anzeigesprache abweicht). Du erhältst eine E-Mail pro Vertrag und Frist und keine für inaktive
Verträge. Die E-Mail enthält nur Versicherungstyp, Vertragsbezeichnung und Datum. Die Liste der
anstehenden Fristen zeigt dasselbe Versanddatum pro Vertrag. Das Dashboard zeigt eine Kachel
Versicherungen mit den monatlichen Kosten und der nächsten Frist.

### 7c.3 Lückencheck, Datenschutz und Löschen

Die Registerkarte **Lückencheck** stellt wenige Fragen (Immobilien, Auto, Kinder, Haustiere,
Auslandsreisen, Beschäftigung) und listet, welche relevanten Versicherungen **fehlen** (wesentliche
zuerst, mit kurzer Erklärung), welche **abgedeckt** sind und welche Verträge **Doppelungen** sein
könnten (zum Beispiel Überschneidung mit einem Kombiprodukt). **Ausblenden** entfernt einen Vorschlag,
bis du ihn **wiederherstellst**. Das Ergebnis ist eine allgemeine Orientierung, keine individuelle
Versicherungsberatung.

**Daten exportieren** schreibt alle Verträge und verknüpften gesetzlichen Zeilen als PDF, Excel, CSV
oder JSON. Vertragsdaten, dein Profil und die Erinnerungseinstellungen werden verschlüsselt gespeichert
und nie in Logs geschrieben. Unten auf der Seite entfernt **Alle Versicherungsdaten löschen** jeden
Vertrag und jede Einstellung (das Konto bleibt). Steht dort _Versicherungsdaten sind vorübergehend
nicht verfügbar_, kann der Server die Daten gerade nicht lesen – sie sind nicht verloren; wende dich
an den Betreiber.

---

## 8. Einstellungen

### 8.1 Profil

**Anzeigename** – Ändere, wie dein Name in der gesamten Anwendung erscheint. Die Änderung wird
sofort übernommen, ohne die Seite neu zu laden.

**E-Mail-Adresse** – Fordere eine Änderung an. Ein Bestätigungslink wird an die _neue_ Adresse
gesendet. Deine aktuelle Adresse bleibt aktiv, bis die neue bestätigt wurde (Link gültig
24 Stunden).

**Passwort** – Erfordert dein aktuelles Passwort. Eine Änderung meldet alle anderen aktiven
Sitzungen ab; deine aktuelle Sitzung bleibt angemeldet.

**Daten exportieren** – Lädt ein ZIP-Archiv mit deinen Daten aus allen Domänen in allen
unterstützten Formaten (JSON, CSV, Excel, PDF) herunter. Nutze diese Funktion vor dem Löschen
deines Kontos oder für ein Offline-Backup.

**Gefahrenzone – Konto löschen** – Löscht dein Konto und alle zugehörigen Daten dauerhaft.
Der Ablauf hat drei Schritte: ein Hinweisbildschirm, eine Option zum vorherigen Datenexport und
schließlich die Eingabe von `DELETE` zur Bestätigung. Diese Aktion kann nicht rückgängig gemacht
werden.

> Wenn du der einzige Administrator bist, ist das Löschen des Kontos gesperrt. Gib zunächst
> einem anderen Benutzer die Administrator-Rolle.

### 8.2 Präferenzen

**E-Mail-Sprache** – Legt die Sprache fest, die in E-Mails an dich verwendet wird
(Bestätigungslinks, Benachrichtigungen). Diese Einstellung ist unabhängig von der
Anzeigesprache der Oberfläche, die in der Kopfzeile geändert wird.

---

## 9. Administrationsbereich

Der Administrationsbereich ist nur für Benutzer mit der Rolle „Administrator" sichtbar.

### 9.1 Konten verwalten

Die Registerkarte **Konten** listet alle Konten (aktive und archivierte) auf.

**Rollen:**

- **Mitglied** – Standardzugriff, auf die freigegebenen Domänen beschränkt.
- **Administrator** – Vollzugriff auf alle Domänen und den Administrationsbereich.

Ändere die Rolle eines Benutzers mit dem Rollenauswahlfeld in seiner Zeile. Administratoren
haben automatisch Zugriff auf alle Domänen; die Domänen-Umschalter sind für Admin-Konten
deaktiviert.

**Domänenzugriff** – Schalte je Mitglied einzelne Domänen frei, um zu steuern, welche Bereiche
es aufrufen kann. Änderungen greifen beim nächsten Seitenaufruf des Benutzers.

**Archivieren** – Archivierte Konten können sich nicht anmelden. Ein archiviertes Konto kann
innerhalb von 30 Tagen reaktiviert werden; danach wird es dauerhaft gelöscht. Du kannst den
letzten verbleibenden Administrator nicht archivieren oder degradieren.

### 9.2 Einladungen

Die Registerkarte **Einladungen** zeigt alle Einladungen und ihren Status:

| Status      | Bedeutung                                                |
| ----------- | -------------------------------------------------------- |
| Ausstehend  | Versendet, noch nicht akzeptiert                         |
| Akzeptiert  | Benutzer hat sein Passwort festgelegt und ist aktiv      |
| Abgelaufen  | Link wurde nicht rechtzeitig verwendet                   |
| Abgebrochen | Manuell von einem Admin abgebrochen                      |
| Ersetzt     | Eine neuere Einladung wurde an dieselbe Adresse gesendet |

Klicke auf **Mitglied einladen**, um eine neue Einladung zu senden (E-Mail-Adresse und Rolle).
Der eingeladene Benutzer legt sein eigenes Passwort fest – du siehst es nie.

Zeilenaktionen: **Erneut senden** (erzeugt einen neuen Link, der den alten ersetzt) und
**Abbrechen** (mit Bestätigung).

### 9.3 Registrierungsanfragen

Die Registerkarte **Registrierungen** zeigt Selbstregistrierungsanfragen. Jede Anfrage
durchläuft folgende Phasen:

1. **Wartet auf Verifizierung** – Benutzer hat sich registriert, aber noch nicht auf den
   E-Mail-Link geklickt.
2. **Wartet auf Prüfung** – E-Mail verifiziert, wartet auf Entscheidung des Administrators.
3. **Genehmigt** oder **Abgelehnt** – Abschlusszustände.

Zeilenaktionen:

- **Genehmigen** – erstellt ein aktives Konto und benachrichtigt den Benutzer per E-Mail.
- **Ablehnen** – du kannst eine interne Begründung hinterlegen (der Benutzer wird nicht über
  den Grund informiert).
- **Löschen** – entfernt den Eintrag und gibt die E-Mail-Adresse für eine erneute Registrierung
  frei.

### 9.4 Parser- und andere Anfragen

**Admin → Anfragen** listet von Nutzern gesendete Anfragen, neueste zuerst, mit Statusfilter
und der Zahl offener Anfragen am Reiter. Öffne eine Zeile (oder den Link in der
Benachrichtigungs-E-Mail, der eine Anmeldung verlangt), um zu sehen, wer sie wann gesendet
hat – und bei einer Parser-Anfrage das **anonymisierte Muster** (als PDF herunterladen; jeder
Download wird protokolliert), die vom Anfragenden markierten **Regelhinweise** (nur als
Hinweis, nie ausgeführt) und einen Hinweis auf ein **mögliches Duplikat**, wenn eine andere
offene Anfrage dasselbe Layout hat.

Setze den **Status** (Offen, In Bearbeitung, Erledigt, Abgelehnt) und eine interne **Notiz**.
_Erledigt_ sendet dem Anfragenden eine E-Mail. Muster und Regelhinweise werden 30 Tage nach
Erledigt oder Abgelehnt automatisch gelöscht (Wiedereröffnen bricht das ab); die Anfrage und
ihr Status bleiben. Außer Administratoren sieht niemand Anfragen, auch nicht die Person, die
sie gesendet hat.

### 9.5 Systemstatus

**Admin → Allgemein** zeigt den aktuellen Systemstatus: Backend-Zustand (ok / beeinträchtigt)
und Datenbankverbindung (verbunden / nicht erreichbar), jeweils mit einem Zeitstempel der
letzten Prüfung. Nutze diese Seite, wenn sich die Anwendung unerwartet verhält, um zu prüfen,
ob das Backend erreichbar ist.

### 9.6 Domänen-Wartung

**Admin → Domänen** listet jede Domäne mit ihrem Status (Aktiv / In Wartung) und wer sie
zuletzt geändert hat. Mit dem Schalter lässt sich eine einzelne Domäne in Wartung setzen,
zum Beispiel während fehlerhafte Berechnungen, ein Export oder Daten repariert werden; das
Einschalten fragt nach einer Bestätigung, das Ausschalten nicht.

Während eine Domäne in Wartung ist:

- Mitglieder sehen ihren Navigationseintrag weiterhin (mit Schraubenschlüssel markiert), beim
  Öffnen erscheint aber ein orangefarbener Hinweis „Vorübergehend nicht verfügbar“, und die
  Dashboard-Kachel zeigt einen Wartungstext.
- Alle Anfragen von Mitgliedern an diese Domäne werden mit einer Wartungsantwort abgelehnt,
  es wird also nichts gelesen, geändert oder exportiert.
- Admins behalten vollen Zugriff und sehen ein Banner (Seite) bzw. eine Marke (Dashboard-Kachel).
- Erinnerungs-E-Mails zu Versicherungen pausieren und werden nach der Wartung nachgeholt,
  sofern die Frist noch nicht abgelaufen ist.

Es werden keine Daten verändert oder gelöscht, und jede Änderung wird in einem Audit-Protokoll
festgehalten. Mitglieder sehen eine Änderung beim nächsten Laden der Seite.
