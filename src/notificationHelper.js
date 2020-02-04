const Notification = require('electron').Notification;

const showNotification = (message) => {
    const notificationConfig = {
        body: message,
        icon: __dirname + "/../static/assets/logmodmobile-32.png"
    };

    new Notification(notificationConfig).show();
};

module.exports = showNotification;