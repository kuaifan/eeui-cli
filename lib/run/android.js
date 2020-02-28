const path = require('path');
const chalk = require('chalk');
const fs = require('fs');
const child_process = require('child_process');
const inquirer = require('inquirer');
const utils = require('../utils');

function runAndroid(options) {
    utils.buildJS()
        .then(() => { return {options} })
        .then(prepareAndroid)
        .then(findAndroidDevice)
        .then(chooseDevice)
        .then(reverseDevice)
        .then(buildDebugApp)
        .then(installApp)
        .then(runApp)
        .catch((err) => {
            if (err) {
                console.log(chalk.red('Error:', err));
            }
        });
}

function prepareAndroid({options}) {
    return new Promise((resolve, reject) => {
        const rootPath = process.cwd();

        console.log();
        console.log(` => ${chalk.blue.bold('Will start Android app')}`);

        process.chdir(path.join(rootPath, 'platforms/android/eeuiApp'));

        try {
            child_process.execSync(`adb start-server`, {encoding: 'utf8'})
        } catch (e) {
            reject()
        }
        try {
            child_process.execSync(`adb devices`, {encoding: 'utf8'})
        } catch (e) {
            reject()
        }
        resolve({options, rootPath})
    })
}

function findAndroidDevice({options}) {
    return new Promise((resolve, reject) => {
        let devicesInfo = '';
        try {
            devicesInfo = child_process.execSync(`adb devices`, {encoding: 'utf8'})
        } catch (e) {
            console.log(chalk.red(`adb devices failed, please make sure you have adb in your PATH.`));
            console.log(`See ${chalk.cyan('http://stackoverflow.com/questions/27301960/errorunable-to-locate-adb-within-sdk-in-android-studio')}`);
            reject()
        }
        let devicesList = utils.parseDevicesResult(devicesInfo);
        resolve({devicesList, options})
    })
}

function chooseDevice({devicesList, options}) {
    return new Promise((resolve, reject) => {
        if (devicesList && devicesList.length > 1) {
            const listNames = [new inquirer.Separator(' = devices = ')];
            for (const device of devicesList) {
                listNames.push(
                    {
                        name: `${device}`,
                        value: device
                    }
                )
            }
            inquirer.prompt([
                {
                    type: 'list',
                    message: 'Choose one of the following devices',
                    name: 'chooseDevice',
                    choices: listNames
                }
            ]).then((answers) => {
                const device = answers.chooseDevice;
                resolve({device, options})
            })
        } else if (devicesList.length === 1) {
            resolve({device: devicesList[0], options})
        } else {
            reject('No android devices found.')
        }
    });
}

function reverseDevice({device, options}) {
    return new Promise((resolve, reject) => {
        try {
            let s = child_process.execSync(`adb -s ${device} reverse tcp:8080 tcp:8080`, {encoding: 'utf8'})
        } catch (e) {
            console.error('reverse error[ignored]');
            resolve({device, options})
        }

        resolve({device, options})
    })
}

function buildDebugApp({device, options}) {
    return new Promise((resolve, reject) => {
        console.log(` => ${chalk.blue.bold('Building app ...')}`);
        const rootPath = process.cwd();
        console.log('build='+rootPath);
        let clean = options.clean ? ' clean' : '';
        try {
            child_process.execSync(process.platform === 'win32' ? `call gradlew.bat${clean} assembleDebug` : `./gradlew${clean} assembleDebug`, {
                encoding: 'utf8',
                stdio: [0, 1, 2]
            })
        } catch (e) {
            reject()
        }
        resolve({device, options})
    })
}

function installApp({device, options}) {
    return new Promise((resolve, reject) => {
        console.log(` => ${chalk.blue.bold('Install app ...')}`);
        const rootPath = process.cwd();
        const apkName = rootPath + '/app/build/outputs/apk/debug/app-debug.apk';
        console.log(chalk.green('=============================================='));
        console.log(chalk.green('=============================================='));
        console.log(chalk.green("apk输出目录：" + rootPath + '/app/build/outputs/apk'));
        console.log(chalk.green('=============================================='));
        console.log(chalk.green('=============================================='));
        try {
            child_process.execSync(`adb -s ${device} install -r  ${apkName}`, {encoding: 'utf8'})
        } catch (e) {
            reject()
        }
        resolve({device, options})
    })
}

function runApp({device, options}) {
    return new Promise((resolve, reject) => {
        console.log(` => ${chalk.blue.bold('Running app ...')}`);
        const rootPath = process.cwd();
        console.log(rootPath);
        const packageName = fs.readFileSync('build.gradle', 'utf8').match(/applicationId\s*=\s*(["'])(.+?)\1/)[2];
        try {
            child_process.execSync(`adb -s ${device} shell am start -n ${packageName}/${packageName}.WelcomeActivity`, {encoding: 'utf8'})
        } catch (e) {
            reject(e)
        }
        resolve()
    })
}


module.exports = {runAndroid};
