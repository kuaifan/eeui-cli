const fs = require('fs');
const fse = require("fs-extra");
const path = require('path');
const ora = require('ora');
const chalk = require('chalk');
const shelljs = require('shelljs');
const inquirer = require('inquirer');
const lodash = require("lodash");
const log = require('./logger');
const config = require("../../config");
const backup = require("./backup");
const utils = require("./index");
const project = require("./project");
const expand = require("./expand");
const androidPlugin = require("../plugin/android");
const isoPlugin = require("../plugin/ios");

const TemplateRelease = require("../../template-release");
const templateRelease = new TemplateRelease(config.cacheDirName, config.templateReleaseUrl);
const isWin = /^win/.test(process.platform);
const dirCut = isWin ? "\\" : "/";

function start() {
    let projectPath = path.resolve(process.cwd());
    let configFile = projectPath + dirCut + "eeui.config.js";
    if (!fs.existsSync(configFile)) {
        log.fatal("当前目录非eeui项目，无法进行升级操作！");
    }
    let releaseFile = projectPath + dirCut + ".eeui.release";
    let releaseConfig = utils.jsonParse(!fs.existsSync(releaseFile) ? {} : fs.readFileSync(releaseFile, 'utf8'));
    //
    let appRelease = releaseConfig.release;
    let newRelease = '';
    let spinFetch = ora('正在获取版本列表...');
    spinFetch.start();
    templateRelease.fetchReleaseVersions((err, result) => {
        spinFetch.stop();
        if (err) {
            log.fatal(err);
        }
        newRelease = result[0];
        let isLatest = false;
        if (!utils.versionFunegt(newRelease, appRelease)) {
            log.eeuis(`当前版本（${appRelease}）已是最新版本。`);
            isLatest = true;
        }
        //
        let questions = [{
            type: 'confirm',
            message: isLatest ? (`确定重新安装主框架吗？（${newRelease}）`) : (`确定开始升级主框架吗？（${appRelease} -> ${newRelease}）`),
            name: 'ok',
            default: !isLatest,
        }];
        if (!utils.isHave(releaseConfig.appName)) {
            let applicationid = "";
            questions.push({
                type: 'input',
                name: 'appName',
                default: function () {
                    return 'eeui演示';
                },
                message: "请输入App名称",
                validate: function (value) {
                    return value !== ''
                }
            }, {
                type: 'input',
                name: 'applicationID',
                default: function () {
                    return releaseConfig.applicationID || 'app.eeui.simple';
                },
                message: "请输入Android应用ID",
                validate: function (value) {
                    let pass = value.match(/^[a-zA-Z_][a-zA-Z0-9_]*[.][a-zA-Z_][a-zA-Z0-9_]*[.][a-zA-Z_][a-zA-Z0-9_]+$/);
                    if (pass) {
                        applicationid = value;
                        return true;
                    }
                    return '输入格式错误，请重新输入。';
                }
            }, {
                type: 'input',
                name: 'bundleIdentifier',
                default: function () {
                    return releaseConfig.bundleIdentifier || applicationid;
                },
                message: "请输入iOS应用ID",
                validate: function (value) {
                    let pass = value.match(/^[a-zA-Z_][a-zA-Z0-9_]*[.][a-zA-Z_][a-zA-Z0-9_]*[.][a-zA-Z_][a-zA-Z0-9_]+$/);
                    if (pass) {
                        return true;
                    }
                    return '输入格式错误，请重新输入。';
                }
            });
        }
        inquirer.prompt(questions).then(answers => {
            if (answers.ok) {
                log.eeui(`开始升级至：${newRelease}`);
                let originalData = {
                    android: {
                        versionCode: expand.androidGradle("versionCode"),
                        versionName: expand.androidGradle("versionName"),
                    },
                    ios: {
                        CFBundleVersion: expand.iosInfo("CFBundleVersion"),
                        CFBundleShortVersionString: expand.iosInfo("CFBundleShortVersionString"),
                    }
                };
                if (!utils.isHave(releaseConfig.release)) {
                    releaseConfig = lodash.merge(releaseConfig, answers);
                }
                templateRelease.fetchRelease(newRelease, function (error, releasePath) {
                    if (error) {
                        log.fatal(error);
                    }
                    log.eeui(`备份项目开发文件...`);
                    backup.backup((ret, backPath) => {
                        if (!ret) {
                            log.fatal(`备份失败：${backPath}`);
                        }
                        log.eeui(`备份成功`);
                        log.eeui(`升级新版本文件...`);
                        fse.copy(releasePath, projectPath).then(() => {
                            log.eeui(`升级成功`);
                            log.eeui(`恢复项目开发文件...`);
                            backup.recoveryHandler(backPath, (rec, msg) => {
                                if (!rec) {
                                    log.fatal(`恢复失败：${msg}`);
                                }
                                log.eeui(`恢复成功`);
                                //
                                releaseConfig.release = newRelease;
                                project.initConfig(projectPath, releaseConfig);
                                expand.androidGradle("versionCode", originalData.android.versionCode);
                                expand.androidGradle("versionName", originalData.android.versionName);
                                expand.iosInfo("CFBundleVersion", originalData.ios.CFBundleVersion);
                                expand.iosInfo("CFBundleShortVersionString", originalData.ios.CFBundleShortVersionString);
                                //
                                let rootDir = process.cwd();
                                let configFile = path.resolve(rootDir, "plugins/config.json");
                                let configInfo = utils.jsonParse(!fs.existsSync(configFile) ? {} : fs.readFileSync(configFile, 'utf8'));
                                let androidNum = utils.count(utils.getObject(configInfo, 'android'));
                                let iosNum = utils.count(utils.getObject(configInfo, 'ios'));
                                //
                                let finalLog = () => {
                                    log.eeuis(`主框架升级至最新版本（${newRelease}）成功。`);
                                    log.sep();
                                    log.eeui("您可以运行一下命令开始。");
                                    log.eeui(chalk.white(`1. npm install`));
                                    log.eeui(chalk.white(`2. npm run dev`));
                                };
                                let runPod = (isRun) => {
                                    if (!isRun) {
                                        return;
                                    }
                                    if (shelljs.which('pod')) {
                                        let tempPath = process.cwd();
                                        let spinPod = ora('pod install...');
                                        spinPod.start();
                                        shelljs.cd(projectPath + '/platforms/ios/eeuiApp');
                                        shelljs.exec('pod install', {silent: true}, function (code, stdout, stderr) {
                                            shelljs.cd(tempPath);
                                            spinPod.stop();
                                            if (code !== 0) {
                                                log.warn("运行pod install错误：" + code + "，请稍后手动运行！");
                                            }
                                            finalLog();
                                        });
                                    } else {
                                        if (isWin) {
                                            log.warn('未检测到系统安装pod，请安装pod后手动执行pod install！');
                                        }
                                        finalLog();
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
                                                    runPod(iosNum-- && iosNum === 0);
                                                }
                                            };
                                            isoPlugin.invokeScript(op, true, () => {
                                                utils.pluginsJson(true, "ios", op.name, op.rootDir);
                                                isoPlugin.changeProfile(op, true);
                                            });
                                        }else{
                                            runPod(iosNum-- && iosNum === 0);
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
                                        }else{
                                            runIos(androidNum-- && androidNum === 0);
                                        }
                                    });
                                };
                                //
                                if (androidNum > 0) {
                                    runAndroid(true);
                                }else if (iosNum > 0){
                                    runIos(true);
                                }else{
                                    runPod(true);
                                }
                            });
                        }).catch(err => {
                            log.fatal(`升级新版本文件失败：${err}`);
                        });
                    });
                });
            } else {
                log.fatal(isLatest ? `放弃操作！` : `放弃升级！`);
            }
        }).catch(console.error);
    });
}

module.exports = {start};
