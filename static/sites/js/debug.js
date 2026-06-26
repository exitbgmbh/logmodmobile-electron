const consoleEl = document.getElementById('console');
const button = document.getElementById('request-weight');

function appendToConsole(text) {
    const timestamp = new Date().toLocaleTimeString();
    consoleEl.textContent += `> [${timestamp}] ${text}\n`;
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

window.ipcRenderer.on('debug-rfid', (_, data) => {
    console.log('debug', 'rfid', data)
    if (!data.tagId) {
        return;
    }

    appendToConsole(`RFID erkannt (keine logmod-Karte): ${data.tagId}`);
});

window.ipcRenderer.on('rfid-login', (_, data) => {
    console.log('debug', 'rfid-login', data)
    if (!data || !data.encryptedKey) {
        return;
    }

    appendToConsole(`RFID Login-Karte: UID ${data.tagId}, Key ${data.encryptedKey.slice(0, 24)}... (${data.encryptedKey.length} Zeichen)`);
});

window.ipcRenderer.on('rfid-write-result', (_, result) => {
    console.log('debug', 'rfid-write-result', result)
    if (result && result.success) {
        appendToConsole(`Karte beschrieben ✓ (UID ${result.tagId})`);
    } else {
        appendToConsole(`Schreiben fehlgeschlagen: ${result && result.error}`);
    }
});
window.ipcRenderer.on('debug-weight', (_, data) => {
    console.log('debug', 'weight', data)
    if (!data.weight) {
        return;
    }

    appendToConsole(`Gewicht: ${data.weight} kg`);
});

button.addEventListener('click', () => {
    window.ipcRenderer.send('request-weight');
});

const rfidWriteButton = document.getElementById('rfid-write');
const rfidTokenInput = document.getElementById('rfid-token');
rfidWriteButton.addEventListener('click', () => {
    const encryptedKey = rfidTokenInput.value.trim();
    if (!encryptedKey) {
        appendToConsole('Kein Token eingegeben.');
        return;
    }
    appendToConsole('Warte auf Karte zum Beschreiben...');
    window.ipcRenderer.send('rfid-write', { encryptedKey });
});