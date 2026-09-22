# Druckerliste und Drucker-Auswahl

Handgeräte haben keine IPC-Verbindung zum Electron-Backend, der Druckbefehl läuft
dort über den Websocket. Läuft LogMod lokal im Electron-Kontext, steht derselbe
Funktionsumfang über IPC zur Verfügung. Es gibt zwei Bausteine:

1. eine Abfrage aller im System bekannten Drucker
   (Websocket `LOGMODPRINTERLIST`, IPC `printer-list`)
2. ein optionales Feld `printer` im bestehenden Druckbefehl
   (Websocket `LOGMODPRINT`, IPC `direct-print-invoice`)

Die Konfiguration (`printing.defaultProductLabelPrinter` usw. in der
`default.json`) bleibt unverändert und greift immer dann, wenn kein Drucker
mitgeschickt wird.

## 1. Druckerliste abfragen

Request (Handgerät -> Electron), Event `LOGMODPRINTERLIST`:

```json
{
  "event": "LOGMODPRINTERLIST",
  "type": "logMod",
  "senderUserId": 42,
  "receiverLogModIdent": "ELOG-KASSE1",
  "data": {
    "requestId": "a4f1c8",
    "logModIdent": "ELOG-KASSE1"
  }
}
```

- `receiverLogModIdent` bzw. `data.logModIdent` adressieren eine bestimmte
  LogMod-Instanz. Ist eines von beiden gesetzt, antwortet ausschliesslich die
  adressierte Instanz. Ohne Adressierung antwortet jede Instanz, die die
  Nachricht empfängt.
- `data.requestId` ist optional und wird in der Antwort unverändert
  zurückgegeben, damit Request und Response zugeordnet werden können.
- `senderUserId` (alternativ `data.userId` / `data.senderUserId`) wird als
  `receiverUserId` der Antwort zurückgespiegelt. Fehlt die Angabe, wird `0`
  gesendet, also eine öffentliche Nachricht - auf demselben Weg erreicht auch
  der Heartbeat die Geräte. Das `receiverUserId` der Anfrage wird bewusst nicht
  übernommen, es adressiert die LogMod-Instanz.
- Die Adressfelder `receiverLogModIdent` und `logModIdent` der Antwort bleiben
  leer. Steht dort ein Ident, wird die Antwort an eine LogMod-Instanz
  ausgeliefert statt an das fragende Gerät. Welche Instanz geantwortet hat,
  steht in `data.logModIdent`.

Response (Electron -> Handgerät), Event `logModPrinterListResponse`:

```json
{
  "event": "logModPrinterListResponse",
  "type": "logMod",
  "receiverUserId": 42,
  "receiverLogModIdent": "",
  "logModIdent": null,
  "data": {
    "requestId": "a4f1c8",
    "logModIdent": "ELOG-KASSE1",
    "defaultPrinter": "HP",
    "configuredPrinters": {
      "invoice": "PDF",
      "delivery": "PDF",
      "return": "PDF",
      "productLabel": "ZPL",
      "movementLabel": "",
      "additionalDocument": "PDF",
      "personalization": "PDF"
    },
    "printers": [
      {
        "name": "ZPL",
        "displayName": "Zebra GK420d",
        "status": "idle",
        "paperSizes": [],
        "isDefault": false
      }
    ]
  }
}
```

- Anfrage und Antwort haben bewusst **unterschiedliche** Event-Namen. Der Socket
  stellt gesendete Nachrichten auch dem Absender zu - trügen beide denselben
  Namen, würde die antwortende Instanz ihre eigene Antwort als neue Anfrage
  lesen und endlos weiterantworten.
- `printers[].name` ist der Wert, der im Druckbefehl als `printer` zurückgegeben
  werden muss. Die Liste wird bei jeder Abfrage frisch vom System geholt.
- `printers[].displayName` ist der sprechende Name für die Anzeige, unter Linux
  die CUPS-Beschreibung, unter Windows der Druckername.
- `printers[].status` ist plattformabhängig (Linux: `idle`, `paused`, ...;
  unter Windows meist leer) und rein informativ.
- `defaultPrinter` ist der Systemstandarddrucker, `configuredPrinters` enthält
  die in der `default.json` hinterlegten Drucker je Dokumenttyp - damit kann das
  Handgerät den aktuell verwendeten Drucker vorauswählen. Leere Werte bedeuten,
  dass kein Drucker konfiguriert ist und der Systemstandarddrucker greift. Bei
  `additionalDocument` wird zusätzlich auf `invoice` zurückgefallen, wenn kein
  eigener Drucker hinterlegt ist.
- Versandlabel sind nicht enthalten, sie werden je `shipmentTypeCode` unter
  `shipping.<code>.printing.shipmentLabelPrinter` konfiguriert und lassen sich
  nicht per Druckbefehl überschreiben.
- Kann die Druckerliste nicht vom System gelesen werden, ist `printers` leer.
  Der Rest der Antwort bleibt gültig. Eine leere Liste bedeutet also entweder
  "keine Drucker vorhanden" oder "Drucker nicht auslesbar", das Frontend kann
  beides nicht unterscheiden (der Grund steht im Log der Anwendung).

## 2. Drucker im Druckbefehl mitgeben

Im bestehenden Event `LOGMODPRINT` kann `data.printer` gesetzt werden:

```json
{
  "event": "LOGMODPRINT",
  "type": "logMod",
  "data": {
    "documentType": "productLabel",
    "productEan": "4001234567890",
    "quantity": 2,
    "printer": "ZPL"
  }
}
```

Regeln:

- `printer` ist optional. Ohne Angabe (oder bei leerem String) gilt wie bisher
  ausschliesslich die Konfiguration.
- Ist `printer` gesetzt, gewinnt der Drucker gegenüber allen konfigurierten
  Druckern, auch gegenüber `advertisingMediumConfig`. Alle übrigen
  Einstellungen (Kopien, Papierformat, Rotation, Farbe/Monochrom) kommen
  weiterhin aus der Konfiguration.
- Ist der übergebene Drucker im System nicht bekannt, wird er verworfen, der
  konfigurierte Drucker verwendet und eine Warnung geloggt. Ausnahme: solange
  noch keine Druckerliste gelesen werden konnte (Start der Anwendung oder Fehler
  beim Auslesen), wird der übergebene Drucker ungeprüft übernommen.
- Das Feld gilt für alle `documentType`-Varianten von `LOGMODPRINT`:
  `productLabel`, `movementLabel`, `shippingRequestPackageLabel`, `invoice`,
  `delivery`, `return`, `allDocs`, `repairCaseCoverLetter`, `relocationProof`.

## 3. Derselbe Funktionsumfang über IPC

Läuft die Oberfläche im Electron-Renderer, braucht es keinen Websocket.

### Druckerliste

```js
// im Renderer
const printerList = await window.ipcRenderer.invoke('printer-list');

// gleichwertig, per preload bereitgestellte Kurzform
const printerList = await window.getPrinterList();
```

Das Ergebnis ist exakt das `data`-Objekt der Websocket-Antwort ohne
`requestId`, also `{logModIdent, defaultPrinter, configuredPrinters, printers}`.
Beide Transporte verwenden denselben Payload-Builder, die Auswertung im Frontend
ist also identisch.

Hinweise:

- Es wird bewusst `ipcRenderer.invoke` verwendet und nicht `promiseIpc`, weil
  dieses im preload mit `maxTimeoutMs: 1000` konfiguriert ist. Das Auslesen der
  Drucker unter Windows läuft über PowerShell und kann diese Grenze reissen.
- Die Abfrage funktioniert auch vor der Anmeldung, sie hängt nicht an der
  Initialisierung des Printing-Handlers.
- `window.printer` (direkt `pdf-to-printer`) bleibt aus Kompatibilitätsgründen
  bestehen, ist unter Linux aber das falsche Modul. Für die Druckerliste ist
  `window.getPrinterList()` der richtige Weg.

### Drucker im Druckbefehl

`ipcMain.on('direct-print-invoice')` reicht sein Argument unverändert an
dieselbe Verarbeitung weiter wie der Websocket-Druckbefehl. `printer` wird dort
also ohne Zusatzaufwand unterstützt:

```js
window.ipcRenderer.send('direct-print-invoice', {
  documentType: 'productLabel',
  productEan: '4001234567890',
  quantity: 2,
  printer: 'ZPL'
});
```

Es gelten dieselben Regeln wie beim Websocket-Druckbefehl.
