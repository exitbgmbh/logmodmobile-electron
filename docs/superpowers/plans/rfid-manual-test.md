# RFID Manual Hardware Verification

Round-trip test of `MifareCard.writePayload` / `readPayload` against real hardware.

## Setup
- Reader: **Feitian 502-CL [NFC]** (PC/SC)
- Card: **MIFARE Classic 1K**, default key A `FFFFFFFFFFFF`
- Run: `timeout 25 ./node_modules/.bin/electron .rfid-roundtrip.js 2>&1 | grep RESULT`
  (harness is temporary; deleted after verification)

## Result — 2026-06-26

```
RESULT reader: Feitian 502-CL [NFC   ] (7469992538127-56433072) 00 00
RESULT token bytes: 767
RESULT wrote blocks: 36
RESULT identical: true
```

- 767-byte `EXEC.…` token written across 36 data blocks (sectors 1–15).
- Read back and reconstructed **byte-identical** (`readBack === TOKEN`).
- No sector trailers touched; card remains usable.

## Notes
- The Electron startup test (`npm test`) confirms the refactored handler boots and
  connects to the reader (`initRFIDReader::connected to reader Feitian 502-CL`).
- Login path (`handler.handleLogin` → `rfid-login` IPC) and write arming
  (`handler.writeKey` → `rfid-write-result`) share the same `MifareCard` read/write
  primitives verified here; the only untested-by-this-harness layer is the IPC send,
  which mirrors the existing `request-weight`/`debug-weight` pattern.
