const fs = require('fs');
const path = require('path');
const android = require('./android');
const ios = require('./ios');
const log = require('../utils/logger');
const utils = require('../utils');
const ora = require('ora');
const inquirer = require('inquirer');
const request = require('request');
const shelljs = require('shelljs');
const androidPlugin = require("./android");
const isoPlugin = require("./ios");
const isWin = /^win/.test(process.platform);
const dirCut = isWin ? "\\" : "/";

function add(op) {
    op.baseUrl = utils.apiUrl() + 'plugin/';
    //
    if (typeof op.__nameBak === 'undefined') {
        op.__nameBak = op.name;
    }
    op.__nameAlso = "";
    if (utils.strExists(op.name, ',')) {
        op.__nameAlso = utils.getMiddle(op.name, ',', null);
        op.name = utils.getMiddle(op.name, null, ',').trim();
    }
    if (utils.strExists(op.__nameBak, ',')) {
        op.simple = op.__nameAlso !== "";
    }
    //
    let nextCallback = () => {
        if (op.__nameAlso !== "") {
            op.name = op.__nameAlso;
            add(op);
        }
    };
    //
    getInfo(op, (res) => {
        switch (op.platform) {
            case 'all':
                if (res.ios_url !== '' && res.android_url !== '') {
                    op.callback = () => {
                        if (res.ios_url !== '') {
                            op.callbackIos = () => { nextCallback() };
                            ios.add(op)
                        } else {
                            nextCallback();
                        }
                    };
                    android.add(op)
                } else {
                    if (res.ios_url !== '') {
                        log.info('只检测到iOS端插件，开始安装！');
                        op.callbackIos = () => { nextCallback() };
                        ios.add(op)
                    }
                    if (res.android_url !== '') {
                        log.info('只检测到android端插件，开始安装！');
                        op.callback = () => { nextCallback() };
                        android.add(op)
                    }
                }
                break;

            case 'android':
                if (res.android_url !== '') {
                    op.callback = () => { nextCallback() };
                    android.add(op)
                } else {
                    log.fatal('未检测到android端插件，无法安装！')
                }
                break;

            case 'ios':
                if (res.ios_url !== '') {
                    op.callbackIos = () => { nextCallback() };
                    ios.add(op)
                } else {
                    log.fatal('未检测到iOS端插件，无法安装！')
                }
                break;
        }
    });
}

function remove(op) {
    op.baseUrl = utils.apiUrl() + 'plugin/';
    //
    if (typeof op.__nameBak === 'undefined') {
        op.__nameBak = op.name;
    }
    op.__nameAlso = "";
    if (utils.strExists(op.name, ',')) {
        op.__nameAlso = utils.getMiddle(op.name, ',', null);
        op.name = utils.getMiddle(op.name, null, ',').trim();
    }
    if (utils.strExists(op.__nameBak, ',')) {
        op.simple = op.__nameAlso !== "";
    }
    //
    let nextCallback = () => {
        if (op.__nameAlso !== "") {
            op.name = op.__nameAlso;
            remove(op);
        }
    };
    //
    let func = () =>{
        switch (op.platform) {
            case 'all':
                op.delCallback = () => {
                    op.delCallbackIos = () => { nextCallback() };
                    ios.remove(op);
                };
                android.remove(op);
                break;

            case 'android':
                op.delCallback = () => { nextCallback() };
                android.remove(op);
                break;

            case 'ios':
                op.delCallbackIos = () => { nextCallback() };
                ios.remove(op);
                break;
        }
    };
    if (op.simple === true || utils.strExists(op.__nameBak, ',')) {
        func();
    }else{
        inquirer.prompt([{
            type: 'confirm',
            message: `即将删除插件${op.name}，是否确定删除？`,
            name: 'ok',
        }]).then(answers => {
            if (answers.ok) {
                func();
            } else {
                log.fatal(`放弃删除${op.name}！`);
            }
        }).catch(console.error);
    }
}

function repair(callback) {
    let rootDir = process.cwd();
    let configFile = path.resolve(rootDir, "plugins/config.json");
    let configInfo = utils.jsonParse(!fs.existsSync(configFile) ? {} : fs.readFileSync(configFile, 'utf8'));
    let androidNum = utils.count(utils.getObject(configInfo, 'android'));
    let iosNum = utils.count(utils.getObject(configInfo, 'ios'));
    let runPod = (isRun) => {
        if (!isRun) {
            return;
        }
        if (shelljs.which('pod')) {
            let tempPath = process.cwd();
            let spinPod = ora('pod install...');
            spinPod.start();
            shelljs.cd(path.resolve(rootDir, "platforms/ios/eeuiApp"));
            shelljs.exec('pod install', {silent: true}, function (code, stdout, stderr) {
                shelljs.cd(tempPath);
                spinPod.stop();
                if (code !== 0) {
                    log.warn("运行pod install错误：" + code + "，请稍后手动运行！");
                }
                if (typeof callback == "function") {
                    callback();
                }else{
                    log.eeuis(`插件修复完成。`);
                    log.sep();
                }
            });
        } else {
            if (isWin) {
                log.warn('未检测到系统安装pod，请安装pod后手动执行pod install！');
            }
            if (typeof callback == "function") {
                callback();
            }else{
                log.eeuis(`插件修复完成。`);
                log.sep();
            }
        }
    };
    let runGradlew = (isRun) => {
        if (!isRun) {
            return;
        }
        let tempPath = process.cwd();
        let spinPod = ora('gradlew clean...');
        spinPod.start();
        try {
            shelljs.cd(path.resolve(rootDir, "platforms/android/eeuiApp"));
            shelljs.exec('./gradlew clean', {silent: true}, () => {
                shelljs.cd(tempPath);
                spinPod.stop();
                runPod(true);
            });
        } catch (e) {
            shelljs.cd(tempPath);
            spinPod.stop();
            runPod(true);
        }
    };
    let runIos = (isRun) => {
        if (!isRun) {
            return;
        }
        utils.each(utils.getObject(configInfo, 'ios'), (name, item) => {
            let itemFile = `${rootDir}/plugins/ios/${name}/${name}.podspec`;
            if (item.install === true && fs.existsSync(itemFile)) {
                let op = {
                    rootDir: rootDir,
                    name: name,
                    simple: true,
                    changeCallback: () => {
                        runGradlew(iosNum-- && iosNum === 0);
                    }
                };
                isoPlugin.invokeScript(op, true, () => {
                    utils.pluginsJson(true, "ios", op.name, op.rootDir);
                    isoPlugin.changeProfile(op, true);
                });
            } else {
                runGradlew(iosNum-- && iosNum === 0);
            }
        });
    };
    let runAndroid = (isRun) => {
        if (!isRun) {
            return;
        }
        utils.each(utils.getObject(configInfo, 'android'), (name, item) => {
            let itemFile = `${rootDir}/plugins/android/${name}/build.gradle`;
            if (item.install === true && fs.existsSync(itemFile)) {
                let op = {
                    rootDir: rootDir,
                    name: name,
                    simple: true,
                };
                androidPlugin.addSetting(op);
                androidPlugin.addGradle(op);
                androidPlugin.invokeScript(op, true, (exec) => {
                    utils.pluginsJson(true, "android", op.name, op.rootDir);
                    log.eeuis('插件' + op.name + ' android端添加' + (exec ? '完成' : '成功') + '!');
                    runIos(androidNum-- && androidNum === 0);
                });
            } else {
                runIos(androidNum-- && androidNum === 0);
            }
        });
    };
    //
    if (androidNum > 0) {
        runAndroid(true);
    } else if (iosNum > 0) {
        runIos(true);
    } else {
        runGradlew(true);
    }
}

function getInfo(op, callback) {
    let spinFetch = ora('正在获取插件详情...');
    spinFetch.start();
    request(utils.apiUrl() + 'plugin/' + op.name, function (err, res, body) {
        spinFetch.stop();
        let data = utils.jsonParse(body);
        if (data.ret !== 1) {
            log.fatal(`获取插件失败：${data.msg}`);
        }
        let out = Object.assign(op, data.data);
        callback(out)
    });
}

module.exports = {add, remove, repair};
