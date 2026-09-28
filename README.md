# iPhone-Vergleich

Web-Seite, die alle iPhones von 2007 bis 2026 (inkl. iPhone Duo) **maßstabsgetreu in 3D** nebeneinanderstellt.

- 1–4 Geräte gleichzeitig, frei drehbar (einzeln oder gemeinsam), Kamera per Maus/Touch
- Ansichten: Vorne, Hinten, Links, Rechts, Oben, Unten, 3/4
- Display an/aus, iPhone Duo zugeklappt / halb / aufgeklappt (Schieberegler)
- **Drückbare Tasten:** Seitentaste (Display an/aus, beim Duo mit Touch ID), Home-Taste, Lautstärke (HUD / Auslöser),
  Stummschalter (schiebt um, orange Markierung), Action-Taste (Taschenlampe), Kamerasteuerung (Kamera-App), Display antippen
- Speichervariante und Farbe je Gerät wählbar, Preis passend zur Speichervariante (deutsche Start-UVP)
- Preise wahlweise **inflationsbereinigt** (VPI Destatis, Stand August 2026)
- Vergleichstabelle: Maße, Gewicht, Display, Auflösung, Display-Anteil, Chip, Kamera, Tasten, Anschluss, Laden, Neuerungen …
- Auswahl wird in der URL gespeichert (Link teilen = gleicher Vergleich)
- **Tischkarten** vor jedem Gerät mit 5 Kernwerten (Preis, Display, Kamera, Akku, Chip) – bester Wert in Magenta
- **Geräteauswahl** mit Suche, Jahresgruppen, 3D-Vorschaubildern und Farben
- **Upgrade-Modus**: Kundengerät wählen → Vorschläge (18 Pro, 18 Pro Max, Duo, Air, 17, 17e) mit
  „Das wird besser“ / „Beachten“-Liste für die Beratung
- Datenblatt mit Schalter **„Nur Unterschiede“** und **PDF** (eine Seite, über den Druckdialog „Als PDF speichern“)
- **Bildschirme im Stil der jeweiligen iOS-Generation** (iOS 1 bis iOS 27)
- **Einstellungen**: Tag/Nacht im Showroom, Admin-Bereich für **Telekom-Preise** (Einmalpreis + Monatsrate je Speicher)
- Ladebalken „Showroom wird erstellt“, Tastenkürzel (Pfeile, F/B/L/R/O/U, P, Esc), Doppelklick holt ein Gerät heran

Alles läuft im Browser (three.js liegt lokal unter `public/vendor/`, keine externen CDNs). Zwei Container:
`app` (nginx, liefert die Seite) und `api` (kleiner Node-Dienst ohne Abhängigkeiten, speichert die Telekom-Preise
in `data/prices.json`).

## Admin-Passwort (Telekom-Preise)

Das Passwort steht in der Datei `.env` neben `docker-compose.yml` (wird **nicht** ins Git hochgeladen):

```bash
cd ~/iPhoneVergleich
echo 'ADMIN_PASSWORD=dein-passwort' > .env
chmod 600 .env
docker compose up -d
```

Danach auf der Seite: Zahnrad → Admin → anmelden → „Preise bearbeiten“. Alle Besucher sehen die gespeicherten
Preise, ändern kann sie nur, wer das Passwort kennt. Ohne `.env` ist der Admin-Bereich einfach aus.
Lokal (Windows) fragt `start.bat` beim ersten Start nach dem Passwort und legt die `.env` an.

## Genauigkeit

Kamera-, Tasten- und Displaypositionen der Modelle von iPhone 12 mini bis 18 Pro Max (inkl. Air, 16e/17e) stammen aus den
offiziellen Apple *Dimensional Drawings* (developer.apple.com/accessories/dimensional-drawings). Ältere Modelle (2007–2020) und das
iPhone Duo (noch keine Apple-Zeichnung veröffentlicht) sind anhand der offiziellen Außenmaße nachgebaut.

## Dateien

| Datei | Inhalt |
|---|---|
| `public/data.js` | Gerätedaten, Speicher-Preise, VPI-Tabelle – hier neue Modelle ergänzen |
| `public/phone.js` | Prozeduraler 3D-Aufbau der Geräte (Gehäuse, Kameras, drückbare Tasten, Duo-Scharnier) |
| `public/screen.js` | Bildschirm-Inhalte (Sperrbildschirm, Home, Kamera, Lautstärke-/Stumm-Anzeigen) |
| `public/app.js` | Szene, Steuerung, Tischkarten, Vergleichstabelle, Upgrade, PDF |
| `public/insights.js` | Kernwerte und Upgrade-Argumente („Das wird besser“) |
| `public/picker.js`, `public/thumbs.js` | Geräteauswahl mit 3D-Vorschaubildern |
| `public/admin.js` | Einstellungen, Admin-Anmeldung, Telekom-Preise |
| `public/print.js` | PDF-/Druckansicht |
| `public/showroom.js` | Showroom (Tag/Nacht) |
| `api/server.js` | API für die Telekom-Preise (Login, Speichern) |

## Deployment (Raspberry Pi)

```bash
git clone <repo-url> ~/iPhoneVergleich
cd ~/iPhoneVergleich
chmod +x deploy.sh
./deploy.sh
```

Der Container lauscht auf `127.0.0.1:8103`. Danach im Reverse Proxy des Pi z. B. `iphone.oualid.de` → `127.0.0.1:8103` routen
(genau wie `games.oualid.de` → 8094). Die Seite nutzt nur relative Pfade und funktioniert daher auch unter einem Unterpfad
(z. B. `games.oualid.de/iphone/` über den Spielehub-nginx).

## Lokal testen

```bash
docker compose up --build
# http://localhost:8103/
```

Ohne Docker (ohne Admin/Telekom-Preise) reicht jeder statische Webserver, z. B. `cd public && python -m http.server 8103`.
Mit API ohne Docker: `ADMIN_PASSWORD=test STATIC_DIR=public DATA_DIR=data PORT=8103 node api/server.js`.
