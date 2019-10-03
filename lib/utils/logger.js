const chalk = require('chalk');

const infoLabel = chalk.inverse.green("INFO");
const eeuiLabel = chalk.inverse.green("EEUI");
const eeuisLabel = chalk.inverse("EEUI");
const successLabel = chalk.inverse("SUCCESS");
const warningLabel = chalk.inverse("WARN");
const errorLabel = chalk.inverse("ERROR");
const format = require('util').format;


exports.log = function(msg) {
    console.log(`[${infoLabel}] ${msg}`);
};

exports.info = function(msg) {
    console.log(`[${eeuiLabel}] ${msg}`);
};

exports.eeui = function(msg) {
    console.log(`[${eeuiLabel}] ${msg}`);
};

exports.eeuis = function(msg) {
    console.log(chalk.green(`[${eeuisLabel}] ${msg}`));
};

exports.success = function(msg) {
    console.log(chalk.green(`[${successLabel}] ${msg}`));
};

exports.warn = function(msg) {
    console.log(chalk.yellow(`[${warningLabel}] ${msg}`));
};

exports.error = function(msg) {
    console.log(chalk.red(`[${errorLabel}] ${msg}`));
    console.log();
    process.exit();
};

exports.fatalContinue = function(...args) {
    if (args[0] instanceof Error) args[0] = args[0].message.trim();
    const msg = format.apply(format, args);
    console.log('[' + chalk.blue(eeuiLabel) + ']', chalk.red(msg));
};

exports.fatal = function(...args) {
    if (args[0] instanceof Error) args[0] = args[0].message.trim();
    const msg = format.apply(format, args);
    console.log('[' + chalk.blue(eeuiLabel) + ']', chalk.red(msg));
    console.log();
    process.exit()
};

exports.sep = function() {
    console.log();
};
