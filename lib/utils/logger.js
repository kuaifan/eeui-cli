const chalk = require('chalk');
const format = require('util').format;
const eeuiLabel = chalk.inverse("EEUI");

module.exports = {
    info(msg) {
        console.log(`[${chalk.green(eeuiLabel)}] ${msg}`);
    },

    success(msg) {
        console.log(chalk.green(`[${eeuiLabel}] ${msg}`));
    },

    warn(msg) {
        console.log(chalk.yellow(`[${eeuiLabel}] ${msg}`));
    },

    error(...args) {
        if (args[0] instanceof Error) args[0] = args[0].message.trim();
        const msg = format.apply(format, args);
        console.log(chalk.red(`[${eeuiLabel}] ${msg}`));
    },

    fatal(...args) {
        if (args[0] instanceof Error) args[0] = args[0].message.trim();
        const msg = format.apply(format, args);
        console.log(chalk.red(`[${eeuiLabel}] ${msg}`));
        console.log();
        process.exit()
    },

    sep() {
        console.log();
    }
};
