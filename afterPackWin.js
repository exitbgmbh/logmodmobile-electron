// electron-builder.config.js oder in deiner package.json unter "build" als externes Script
const path = require('path');
const fs = require('fs/promises');

module.exports = {
    // ... dein bisheriger Build-Config
    afterPack: async (context) => {
        console.log('building for: ', context.packager?.platform?.name)

        const abiVersion = process.versions.modules
        console.log('abi versions: ', abiVersion)

        if (context.packager.platform.name !== 'windows') {
            return;
        }

        const appOutDir = context.appOutDir;
        const outDir = context.outDir;

        const serialPortSourceBinding = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '@serialport', 'bindings-cpp', 'prebuilds', 'win32-x64', '@serialport+bindings-cpp.node');
        const serialPortTarget = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '@serialport', 'bindings-cpp', 'build', 'Release', 'bindings.node');
        const serialPortNAPISourceBinding = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'serialport', 'node_modules', '@serialport', 'bindings-cpp', 'prebuilds', 'win32-x64', 'node.napi.node');
        const serialPortNAPITarget = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'serialport', 'node_modules', '@serialport', 'bindings-cpp', 'build', 'Release', 'bindings.node');

        const nodePrinterSourceBinding = path.join(outDir, '..', 'lib', 'node-printer', `v${abiVersion}-win32-x64`, 'node_printer.node');
        const nodePrinterTarget = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '@grandchef', 'node-printer', 'lib', 'node_printer.node');

        try {
            console.log(`Swapping serialPort CPP Binding for Windows build: ${serialPortSourceBinding} -> ${serialPortTarget}`);
            await fs.copyFile(serialPortSourceBinding, serialPortTarget);
            console.log(`Replace succeed ${serialPortTarget}.`);

            console.log(`Swapping serialPort NAPI Binding for Windows build: ${serialPortNAPISourceBinding} -> ${serialPortNAPITarget}`);
            await fs.copyFile(serialPortNAPISourceBinding, serialPortNAPITarget);
            console.log(`Replace succeed ${serialPortNAPITarget}.`);

            console.log(`Swapping nodePrinter Binding for Windows build: ${nodePrinterSourceBinding} -> ${nodePrinterTarget}`);
            await fs.copyFile(nodePrinterSourceBinding, nodePrinterTarget);
            console.log(`Replace succeed ${nodePrinterTarget}.`);
        } catch (err) {
            console.error('Error copying Windows binary:', err);
            throw err;
        }
    }
};