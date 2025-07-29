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

    appendToConsole(`RFID erkannt: ${data.tagId}`);
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