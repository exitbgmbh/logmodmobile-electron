const chalk = require('chalk');

const logDebug = (className, methodName, message) => {
    console.log(chalk.blue(className) + '::' + chalk.blue(methodName) + '::' + chalk.blueBright(message));
};

const logInfo = (className, methodName, message) => {
    console.log(chalk.green(className) + '::' + chalk.green(methodName) + '::' + chalk.greenBright(message));
};

const logWarning = (className, methodName, message) => {
    console.log(chalk.yellow(className) + '::' + chalk.yellow(methodName) + '::' + chalk.yellowBright(message));
};

module.exports = {
    logDebug, logInfo, logWarning
};