# RFID-Karten: Zugangsschlüssel schreiben & Login — Design

**Datum:** 2026-06-26
**Branch:** `feature/rfid-card-key-write-login`
**Status:** Genehmigt (Brainstorming abgeschlossen)

## Ziel

Erweiterung der bestehenden RFID-Anbindung (`src/rfid/handler.js`) um zwei Features:

1. **Schreiben:** Aus logmod heraus einen verschlüsselten Zugangsschlüssel (`EXEC.…`-Token) auf eine MIFARE-Classic-Karte schreiben.
2. **Login:** Beim Auflegen einer Karte den gespeicherten Token lesen und an logmod reichen, das damit den Login durchführt.

## Kontext / Ist-Zustand

- Reader: **Feitian 502-CL [NFC]** (PC/SC), unterstützt die MIFARE-Pseudo-APDUs (auf Hardware verifiziert).
- Karte (Test): **MIFARE Classic 1K**, leer, Default-Keys `FFFFFFFFFFFF` authentifizieren (auf Hardware verifiziert: `FF 82`/`FF 86`/`FF B0` → SW `9000`).
- Bestehender Handler liest nur die UID (`FF CA 00 00`) und sendet `debug-rfid` an den Renderer.
- IPC-Muster im Projekt:
  - `ipcMain.on(evt, cb)` — fire-and-forget Renderer→Main
  - `promiseIpc.on(evt, cb)` — Request/Response (Timeout nur 1000 ms im Renderer, zu kurz fürs Warten auf Kartenkontakt)
  - `windowInstance.webContents.send(evt, data)` — Main→Renderer
  - Auto-Login-Flow existiert: Main sendet `auth-request`, Renderer loggt ein, meldet `authentication-succeed`.

## Grundprinzip: Verantwortungstrennung

- **Electron = reines Hardware-I/O.** Keine Krypto, keine Business-Logik. Speichert den vom Backend gelieferten `EXEC.…`-Token als Bytes und liest ihn unverändert zurück.
- **logmod (Backend/Frontend, anderes Repo) = Krypto + Login.** Erzeugt den verschlüsselten JWT-Token, validiert ihn beim Login. In diesem Repo wird nur der **IPC-Vertrag** definiert; der HTTP-Login wird hier **nicht** implementiert.

### Token-Format (vom PHP-Backend erzeugt)

```
EXEC.<userId>.<base64(iv)>.<base64(tag)>.<base64(cipherText)>
```

Der Token darf **niemals verändert** werden (jede Änderung invalidiert die Krypto-Signatur).

## Kapazität & verlustfreie Speicherung

Ein realer Token misst **767 Byte** — passt damit **nicht** auf eine 1K-Karte (max. 752 Byte nutzbar). Lösung **ohne Veränderung des Tokens**:

Der String besteht zu ~75 % aus Base64 (Transport-Kodierung, +33 % Overhead). Wir dekodieren `iv`/`tag`/`cipher` zu **Rohbytes**, speichern diese, und rekonstruieren beim Lesen **bit-identisch** den Base64-String.

**Verifiziert:** `rebuild === original` → `true`.

| Variante | Größe |
|---|---|
| Token als ASCII-String (naiv) | 767 B → passt nicht |
| Rohbytes: userId + iv(12) + tag(16) + cipher(536) + Header | **573 B** → passt (36 von 45 Blöcken) |

## On-Card-Binärlayout

```
Header:   [magic "LM" 2B][version 1B][payloadLen 2B big-endian]
Payload:  [userIdLen 1B][userId ASCII][ivLen 1B][iv bytes][tagLen 1B][tag bytes][cipher bytes …]
```

- `cipher`-Länge = `payloadLen` − (Summe der vorausgehenden Felder). Cipher ist das letzte Feld, daher kein eigener Längen-Header nötig.
- `userId` wird als ASCII gespeichert (beliebige Länge, keine Integer-Range-Probleme).
- Gesamter Byte-Buffer = `[magic, version, payloadLen, payload…]`, **flach** über die geplanten Datenblöcke geschrieben (16 Byte/Block, letzter Block mit `00` aufgefüllt).

### Block-Planung (MIFARE Classic, 1K- & 4K-sicher)

- Nutzdaten nur in **Sektoren 1–15** (Sektor 0 mit Manufacturer-Block komplett ausgespart → robuster).
- Sektor-Trailer (`Block 4i+3`: 7, 11, …, 63) werden **niemals** beschrieben → kein Bricking.
- Kapazität: **45 Datenblöcke × 16 = 720 Byte** (minus 5 B Header → 715 B nutzbar).
- **4K-Kompatibilität:** Der Planer ist **kapazitäts-begrenzt auf den regulären Bereich (Sektoren < 32)**. Die ersten 32 Sektoren einer 4K-Karte haben dasselbe Layout wie 1K (4 Blöcke/Sektor, Trailer `4i+3`). Die irregulären Großsektoren 32–39 (16 Blöcke) werden **nie** erreicht. Damit funktioniert dasselbe Layout auf 1K **und** 4K ohne Codeänderung.
- Auth mit Key A, Key = `FFFFFFFFFFFF`, konfigurierbar via `config` (`rfid.sectorKey`).

### Übergröße

Payload > 715 B wird **vor** dem Schreiben sauber abgelehnt (`rfid-write-result {success:false}`). **Nie** ein Teil-Write.

## Module (`src/rfid/`)

### 1. `mifare.js` — reine, testbare Funktionen (keine Hardware)
- APDU-Builder: `buildLoadKey(key)`, `buildAuth(block, keyType)`, `buildRead(block)`, `buildWrite(block, data16)`
- `planDataBlocks(maxBytes)` → geordnete Liste nutzbarer Blocknummern (schließt Block 0 und alle `4i+3` aus, begrenzt auf Sektoren 1–15)
- `encodePayload({userId, iv, tag, cipher})` → flacher Byte-Buffer (Header + Payload)
- `decodePayload(buffer)` → `{userId, iv, tag, cipher}`
- `tokenToParts(tokenString)` / `partsToToken(parts)` → Zerlegen/Rekonstruieren des `EXEC.…`-Strings (verlustfrei)
- `bytesToBlocks(buffer)` / `blocksToBytes(blocks, length)` → Byte-Array ↔ 16-B-Blöcke

### 2. `card.js` — `MifareCard`-Wrapper um eine verbundene Reader/Protocol-Session
- `loadKey()`, `auth(block)`, `readBlock(n)`, `writeBlock(n, data16)`
- `readPayload()` → liest Header (Block 4), validiert Magic, liest nur die nötigen Blöcke, gibt Token-String zurück (oder `null` bei leerer/fremder Karte)
- `writePayload(tokenString)` → kodiert, plant Blöcke, authentifiziert je Sektor, schreibt; gibt Ergebnis zurück

### 3. `handler.js` — Reader-Lifecycle + IPC-Orchestrierung (Refactor des bestehenden)
- Verwaltet Reader-Verbindung und Card-Present-Events.
- Hält einen **Schreibmodus-Zustand** (`pendingWrite`): wenn gesetzt, führt der nächste Karten-Tap einen Write statt eines Login-Reads aus.

## Feature 1 — Schreiben (von logmod ausgelöst)

```
logmod ──ipcMain.on('rfid-write', {encryptedKey})──▶ Electron
  Electron setzt pendingWrite, wartet auf nächsten Karten-Tap (Timeout, konfigurierbar, Default 20 s)
  → MifareCard.writePayload(encryptedKey)
  ◀── webContents.send('rfid-write-result', {success, tagId?, error?})
```

- Bei Timeout (keine Karte aufgelegt): `{success:false, error:'timeout'}`.
- Bei Auth-Fehler / Karte zu früh entfernt: `{success:false, error}`.

## Feature 2 — Login (Tap-to-Login)

```
Karten-Tap ─▶ Handler liest UID + Block 4 (Header)
   ├─ Magic "LM" vorhanden → readPayload() → webContents.send('rfid-login', {tagId, encryptedKey})
   └─ kein Magic            → webContents.send('debug-rfid', {tagId})   (bestehend, bleibt erhalten)
```

- logmod-Frontend (anderes Repo) hört auf `rfid-login` und POSTet `encryptedKey` an den Login-Endpoint.
- `auth-request` wird **nicht** überladen (andere Datenform).
- Pro Tap wird **nur Block 4** gelesen, um leere/fremde Karten ohne Voll-Scan früh abzubrechen.

## IPC-Vertrag (Zusammenfassung)

| Richtung | Event | Daten |
|---|---|---|
| Renderer→Main | `rfid-write` | `{encryptedKey: string}` |
| Main→Renderer | `rfid-write-result` | `{success: bool, tagId?: string, error?: string}` |
| Main→Renderer | `rfid-login` | `{tagId: string, encryptedKey: string}` |
| Main→Renderer | `debug-rfid` | `{tagId: string}` (bestehend) |

## Konfiguration (`config`)

- `rfid.enabled` (bool, Default true) — Feature an/aus
- `rfid.sectorKey` (hex string, Default `FFFFFFFFFFFF`) — Key A für Auth
- `rfid.writeTimeoutMs` (number, Default 20000) — Timeout fürs Warten auf Karte beim Schreiben

## Fehlerbehandlung

- Reader fehlt → bestehender Timeout-Reject in `initReader`.
- Auth-Fehler / Karte mid-write entfernt → `rfid-write-result {success:false, error}`.
- Leere/fremde Karte beim Login → nur `debug-rfid`, kein `rfid-login`.
- Übergröße → Ablehnung vor dem Schreiben.

## Tests

Unit-Tests für `mifare.js` (hardware-frei):
- `planDataBlocks` schließt Block 0 und alle `4i+3` aus; bleibt in Sektoren 1–15.
- Header-Encode/Decode round-trip.
- **Verlustfreier Token-Round-Trip:** `partsToToken(tokenToParts(t)) === t` (mit realem Beispiel-Token).
- `encodePayload`/`decodePayload` round-trip.
- Payload > 715 B wird abgelehnt.
- APDU-Byte-Korrektheit der Builder.

Hardware-Pfad (`card.js`, `handler.js`): manuell mit Reader getestet.

## Sicherheitshinweis (Backend-Anforderung, nicht Electron)

MIFARE Classic Crypto1 ist gebrochen, und der gespeicherte Token ist statisch → **klonbar/replaybar**. Die Mitigation liegt im Backend:
- Token an die Karten-**UID** binden (UID wird beim Login mitgesendet: `tagId`), **und/oder**
- **kurze Gültigkeit** des Tokens.

Electron kann diese Eigenschaften nicht durchsetzen; das Design stellt mit `tagId` im `rfid-login`-Event lediglich die nötige Information bereit.

## Bewusst nicht im Scope (YAGNI)

- HTTP-Login-Implementierung (logmod-Frontend, anderes Repo).
- Nutzung der vollen 4K-Kapazität (Großsektoren 32–39) — erst nötig bei Token > ~2 KB.
- Ändern der Sektor-Keys von Default auf kundenspezifisch (Karteninhalt ist bereits verschlüsselt; Replay-Schutz liegt im Backend).
- Eigene Krypto in Electron.
