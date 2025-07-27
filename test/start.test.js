const { expect } = require('chai');
const { spawn } = require('child_process');
const path = require('path');

describe('Electron client startup', function () {
    this.timeout(31000);
    let electronProcess = null;

    it('start client without error', (done) => {
        let hasExited = false;
        let checkConfigFound = false;
        let bootStartFound = false;
        let bootEndFound = false;

        let securityTimeout = setTimeout(() => {
            if (!hasExited) {
                electronProcess.kill();
                done();
            }
        }, 30000);

        const electronPath = require('electron');
        const appPath = path.join(__dirname, '..');

        electronProcess = spawn(electronPath, [appPath, '--trace-deprecation', '--trace-warnings', '--no-sandbox', '--disable-gpu'], { env: { ...process.env, TESTING: true}});

        electronProcess.stderr.on('data', (data) => {
            electronProcess.kill();
            done(new Error(`Electron exited with data ${data}`));
        });

        electronProcess.stdout.on('data', (data) => {
            console.log(`electron client output: ${data}`)
            if (data.includes('setupConfig::checkConfig::start')) {
                checkConfigFound = true;
            }
            if (data.includes('application::bootApplication::start')) {
                bootStartFound = true;
            }
            if (data.includes('application::bootApplication::end')) {
                bootEndFound = true;
            }

            if (checkConfigFound && bootStartFound && bootEndFound) {
                clearTimeout(securityTimeout);
                electronProcess.kill();
            }
        });

        electronProcess.on('exit', (code) => {
            expect(checkConfigFound).to.be.true;
            expect(bootStartFound).to.be.true;
            expect(bootEndFound).to.be.true;

            done();
        });

    });
});