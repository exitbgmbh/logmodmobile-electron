const { Menu, shell } = require('electron');
const scaleHandler = require('./../scale');
const menuEventEmitter = require('./eventEmitter');
const printHandler = require('./../printing');
const config = require('config');

const template = [
    {
        label: 'File',
        submenu: [
            { role: 'quit' }
        ]
    },
    {
        label: 'Edit',
        submenu: [
            {
                label: 'Configuration',
                click: async () => {
                    menuEventEmitter.emit('showConfig');
                }
            }
        ]
    },
    {
        label: 'Tools',
        submenu: [
            {
                label: 'Batch print',
                click: async () => {
                    menuEventEmitter.emit('showBatchPrint');
                }
            },
            { type: 'separator' },
            {
                label: 'Test scale',
                click: async () => {
                    console.log('got scale result', await scaleHandler.callScale());
                }
            },
            {
                label: 'Test release available',
                click: async () => {
                    menuEventEmitter.emit('testNewRelease');
                }
            },
            {
                label: 'Test RAW print',
                click: async () => {
                    printHandler.printRaw(
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
            }
        ]
    },
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forcereload' },
            { role: 'toggledevtools' },
            { type: 'separator' },
            { role: 'resetzoom' },
            { role: 'zoomin' },
            { role: 'zoomout' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    },
    {
        role: 'help',
        submenu: [
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
    }
];

const menu = Menu.buildFromTemplate(template);
module.exports = menu;