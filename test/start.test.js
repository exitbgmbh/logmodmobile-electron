const { expect } = require('chai');
const { spawn } = require('child_process');
const path = require('path');

describe('Electron client startup', function () {
    console.log(process.platform)
    this.timeout(10000); // Gib Electron ein paar Sekunden zum Starten

    let electronProcess = null;

    it('should start without crashing', (done) => {
        const electronPath = require('electron');
        const appPath = path.join(__dirname, '..');

        electronProcess = spawn(electronPath, [appPath, '--trace-deprecation', '--trace-warnings']);

        let hasExited = false;

        electronProcess.stderr.on('data', (data) => {
            done(new Error(`Electron exited with data ${data}`));
            electronProcess.kill();
        });

        electronProcess.on('exit', (code) => {
            hasExited = true;
        });

        // Sicherheitshalber nach 3 Sekunden prüfen, ob es noch läuft
        setTimeout(() => {
            if (!hasExited) {
                expect(true).to.be.true;
                electronProcess.kill();
                done();
            }
        }, 3000);
    });
});