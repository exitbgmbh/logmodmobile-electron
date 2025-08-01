const { Menu, shell } = require('electron');
const scaleHandler = require('./../scale');
const menuEventEmitter = require('./eventEmitter');
const printHandler = require('./../printing');
const config = require('config');
const isDevelopment = process.env.NODE_ENV === 'development';


buildMenu = () => {
    let template = [];
    template.push({
        label: 'Anwendung',
        submenu: [
            { role: 'quit', label: 'Beenden' }
        ]
    });

    let c = {
        label: 'Konfiguration',
        submenu: []
    };
    c.submenu.push({
        label: '... bearbeiten',
        click: async () => {
            menuEventEmitter.emit('showConfig');
        }
    });
    if (isDevelopment) {
        c.submenu.push({
            label: '... neu laden',
            click: async () => {
                menuEventEmitter.emit('reloadConfig');
            }
        });
    }
    template.push(c);

    let tools = {
        label: 'Tools',
        submenu: []
    };
    tools.submenu.push({
        label: 'Sammel-Druck',
        click: async () => {
            menuEventEmitter.emit('showBatchPrint');
        }
    });
    if (isDevelopment) {
        tools.submenu.push({
            label: 'Auf Updates prüfen',
            click: async () => {
                menuEventEmitter.emit('checkForUpdate');
            }
        });
    }

    tools.submenu.push({ role: 'toggledevtools' });
    tools.submenu.push({ type: 'separator' });
    tools.submenu.push({
        label: 'HW-Debug',
        click: async () => {
            menuEventEmitter.emit('showDebugPage');
        }
    });

    if (isDevelopment) {
        tools.submenu.push({ type: 'separator' });
        tools.submenu.push({
            label: 'Test release available',
            click: async () => {
                menuEventEmitter.emit('testNewRelease');
            }
        });
        tools.submenu.push({
            label: 'Produkt-Label RAW Druck (EPL/ZPL)',
            click: async () => {
                printHandler.productLabelPrintRaw(
                    config.get('printing.defaultProductLabelPrinter'),
                    config.get('printing.productLabelRAWTemplate'),
                    1,
                    '4029764001807',
                    '1,40EUR',
                    'club-mate-123',
                    'Club Mate',
                    'Loscher KG'
                );
            }
        });
        tools.submenu.push({
            label: 'ShippingRequestPackage-Label RAW Druck (EPL/ZPL)',
            click: async () => {
                printHandler.shippingRequestPackageLabelPrintRaw(
                    config.get('printing.defaultProductLabelPrinter'),
                    config.get('printing.shippingRequestPackageLabelRAWTemplate'),
                    1,
                    '25203590970-1',
                    '25203590970'
                );
            }
        });
    }
    template.push(tools);

    if (isDevelopment) {
        template.push({
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forcereload' },
                { type: 'separator' },
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        });
    }

    template.push({
        label: 'Hilfe',
        submenu: [
            {
                label: 'ChangeLog',
                click: async () => {
                    menuEventEmitter.emit('showChangeLog');
                }
            },
            { type: 'separator' },
            {
                label: 'Wiki',
                click: async () => {
                    await shell.openExternal('https://confluence.exitb.de')
                }
            },
            {
                label: 'Tickets',
                click: async () => {
                    await shell.openExternal('https://jira.exitb.de/servicedesk')
                }
            }
        ]
    });

    return template;
}

const menuTemplate = buildMenu();
const menu = Menu.buildFromTemplate(menuTemplate);
module.exports = menu;
