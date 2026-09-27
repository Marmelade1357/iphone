# iPhone-Vergleich

Statische Web-Seite, die alle iPhones von 2007 bis 2026 (inkl. iPhone Duo) **maßstabsgetreu in 3D** nebeneinanderstellt.

- 1–4 Geräte gleichzeitig, frei drehbar (einzeln oder gemeinsam), Kamera per Maus/Touch
- Ansichten: Vorne, Hinten, Links, Rechts, Oben, Unten, 3/4
- Display an/aus, iPhone Duo zugeklappt / halb / aufgeklappt (Schieberegler)
- **Drückbare Tasten:** Seitentaste (Display an/aus, beim Duo mit Touch ID), Home-Taste, Lautstärke (HUD / Auslöser),
  Stummschalter (schiebt um, orange Markierung), Action-Taste (Taschenlampe), Kamerasteuerung (Kamera-App), Display antippen
- Speichervariante und Farbe je Gerät wählbar, Preis passend zur Speichervariante (deutsche Start-UVP)
- Preise wahlweise **inflationsbereinigt** (VPI Destatis, Stand August 2026)
- Vergleichstabelle: Maße, Gewicht, Display, Auflösung, Display-Anteil, Chip, Kamera, Tasten, Anschluss, Laden, Neuerungen …
- Auswahl wird in der URL gespeichert (Link teilen = gleicher Vergleich)

Alles läuft im Browser (three.js liegt lokal unter `public/vendor/`, keine externen CDNs). Der Pi liefert nur statische Dateien aus.

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
| `public/app.js` | Szene, Steuerung, Vergleichstabelle |

## Deployment (Raspberry Pi)

Repository: https://github.com/Marmelade1357/iphone

**Einmalig auf dem Pi** (neben den anderen Projekten, damit `deploy-all.sh` den Ordner findet):

```bash
cd ~
git clone https://github.com/Marmelade1357/iphone.git iPhoneVergleich
cd iPhoneVergleich
chmod +x deploy.sh
./deploy.sh
```

**Danach aktuell halten** – wie bei den Spielen:

1. Am PC `push-all.bat` (pusht auch dieses Repo)
2. Am PC `deploy-all.bat` (zieht auf dem Pi alles und baut neu) – nur dieses Projekt: `deploy-all.bat iphonevergleich`

Alternativ direkt auf dem Pi: `cd ~/iPhoneVergleich && ./deploy.sh`

Der Container lauscht auf `127.0.0.1:8103`. Im Reverse Proxy des Pi z. B. `iphone.oualid.de` → `127.0.0.1:8103` routen
(genau wie `games.oualid.de` → 8094).

## Lokal testen

```bash
docker compose up --build
# http://localhost:8103/
```

Ohne Docker reicht jeder statische Webserver, z. B. `cd public && python -m http.server 8103`.
