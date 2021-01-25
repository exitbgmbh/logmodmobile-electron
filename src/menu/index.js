const { Menu, shell } = require('electron');
const scaleHandler = require('./../scale');
const menuEventEmitter = require('./eventEmitter');

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
        label: 'Test',
        submenu: [
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
                label: 'Test release downloaded',
                click: async () => {
                    menuEventEmitter.emit('testNewReleaseDownloaded');
                }
            },
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