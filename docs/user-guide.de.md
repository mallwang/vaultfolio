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
5. [Kontenübersicht](#5-kontenübersicht)
6. [Einstellungen](#6-einstellungen)
   - 6.1 [Profil](#61-profil)
   - 6.2 [Präferenzen](#62-präferenzen)
7. [Administrationsbereich](#7-administrationsbereich)
   - 7.1 [Konten verwalten](#71-konten-verwalten)
   - 7.2 [Einladungen](#72-einladungen)
   - 7.3 [Registrierungsanfragen](#73-registrierungsanfragen)
   - 7.4 [Systemstatus](#74-systemstatus)

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
hat (siehe [Konten verwalten](#71-konten-verwalten)).

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

---

## 3. Dashboard

Das Dashboard ist deine Startseite nach der Anmeldung. Es ist darauf ausgelegt,
Zusammenfassungs-Widgets der von dir genutzten Bereiche anzuzeigen – zum Beispiel eine Karte mit
dem Gesamtportfoliowert. Einige Widgets erscheinen erst, nachdem du Daten eingegeben hast. Das
Dashboard wird mit jeder neuen Domäne weiter ausgebaut.

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

---

## 6. Einstellungen

### 6.1 Profil

**Anzeigename** – Ändere, wie dein Name in der gesamten Anwendung erscheint. Die Änderung wird
sofort übernommen, ohne die Seite neu zu laden.

**E-Mail-Adresse** – Fordere eine Änderung an. Ein Bestätigungslink wird an die _neue_ Adresse
gesendet. Deine aktuelle Adresse bleibt aktiv, bis die neue bestätigt wurde (Link gültig
24 Stunden).

**Passwort** – Erfordert dein aktuelles Passwort. Eine Änderung meldet alle anderen aktiven
Sitzungen ab; deine aktuelle Sitzung bleibt angemeldet.

**Gefahrenzone – Konto löschen** – Löscht dein Konto und alle zugehörigen Daten dauerhaft.
Der Ablauf hat drei Schritte: ein Hinweisbildschirm, eine Option zum vorherigen Datenexport und
schließlich die Eingabe von `DELETE` zur Bestätigung. Diese Aktion kann nicht rückgängig gemacht
werden.

> Wenn du der einzige Administrator bist, ist das Löschen des Kontos gesperrt. Gib zunächst
> einem anderen Benutzer die Administrator-Rolle.

### 6.2 Präferenzen

**E-Mail-Sprache** – Legt die Sprache fest, die in E-Mails an dich verwendet wird
(Bestätigungslinks, Benachrichtigungen). Diese Einstellung ist unabhängig von der
Anzeigesprache der Oberfläche, die in der Kopfzeile geändert wird.

---

## 7. Administrationsbereich

Der Administrationsbereich ist nur für Benutzer mit der Rolle „Administrator" sichtbar.

### 7.1 Konten verwalten

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

### 7.2 Einladungen

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

### 7.3 Registrierungsanfragen

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

### 7.4 Systemstatus

**Admin → Allgemein** zeigt den aktuellen Systemstatus: Backend-Zustand (ok / beeinträchtigt)
und Datenbankverbindung (verbunden / nicht erreichbar), jeweils mit einem Zeitstempel der
letzten Prüfung. Nutze diese Seite, wenn sich die Anwendung unerwartet verhält, um zu prüfen,
ob das Backend erreichbar ist.
