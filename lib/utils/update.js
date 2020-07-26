const fs = require('fs');
const fse = require("fs-extra");
const path = require('path');
const ora = require('ora');
const chalk = require('chalk');
const inquirer = require('inquirer');
const lodash = require("lodash");
const logger = require('./logger');
const config = require("../../config");
const backup = require("./backup");
const utils = require("./index");
const project = require("./project");
const expand = require("./expand");
const plugin = require("../plugin/index");

const TemplateRelease = require("../../template-release");
const templateRelease = new TemplateRelease(config.cacheDirName, config.templateReleaseUrl);

function start() {
    let projectPath = path.resolve(process.cwd());
    let releaseFile = path.resolve(projectPath, ".eeui.release");
    let releaseConfig = utils.jsonParse(!fs.existsSync(releaseFile) ? {} : fs.readFileSync(releaseFile, 'utf8'));
    //
    let projectVersion = utils.projectVersion();
    let newRelease = '';
    let spinFetch = ora('正在获取版本列表...');
    spinFetch.start();
    templateRelease.fetchReleaseVersions((err, result) => {
        spinFetch.stop();
        if (err) {
            logger.fatal(err);
        }
        newRelease = result[0];
        let isLatest = false;
        if (utils.versionFunegt(projectVersion, newRelease) >= 0) {
            logger.success(`当前版本（${projectVersion}）已是最新版本。`);
            isLatest = true;
        }
        //
        let questions = [{
            type: 'confirm',
            message: isLatest ? (`确定重新安装主框架吗？（${newRelease}）`) : (`确定开始升级主框架吗？（${projectVersion} -> ${newRelease}）`),
            name: 'ok',
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
        questions.push({
            type: 'list',
            name: 'location',
            message: "请选择下载服务器",
            choices: [{
                name: "Github服务器",
                value: "github"
            }, {
                name: "EEUI官网服务器",
                value: "eeui"
            }]
        });
        inquirer.prompt(questions).then(answers => {
            if (answers.ok) {
                logger.info(`开始升级至：${newRelease}`);
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
                templateRelease.fetchRelease(newRelease, answers.location, function (error, releasePath) {
                    if (error) {
                        logger.fatal(error);
                    }
                    let releasePackageFile = path.resolve(releasePath, "package.json");
                    if (fs.existsSync(releasePackageFile)) {
                        let releasePackageInfo = utils.jsonParse(fs.readFileSync(releasePackageFile, 'utf8'));
                        let current = require('../../package.json').version;
                        let eeuiclimin = releasePackageInfo.eeuiclimin;
                        if (utils.isHave(eeuiclimin) && utils.versionFunegt(eeuiclimin, current) > 0) {
                            logger.fatal(`当前${chalk.underline(`eeui-cli@${current}`)}版本过低，无法进行升级，请升级至${chalk.underline(`eeui-cli@${eeuiclimin}`)}或以上！${chalk.underline(`https://www.npmjs.com/package/eeui-cli`)}`);
                        }
                    }
                    logger.info(`备份项目开发文件...`);
                    backup.backup((ret, backPath) => {
                        if (!ret) {
                            logger.fatal(`备份失败：${backPath}`);
                        }
                        logger.info(`备份成功`);
                        logger.info(`升级新版本文件...`);
                        backup.updateMainFrame(releasePath, projectPath, projectVersion);
                        logger.info(`升级成功`);
                        logger.info(`恢复项目开发文件...`);
                        backup.recoveryHandler(backPath, (rec, msg) => {
                            if (!rec) {
                                logger.fatal(`恢复失败：${msg}`);
                            }
                            logger.info(`恢复成功`);
                            fse.removeSync(backPath);
                            //
                            releaseConfig.release = newRelease;
                            project.initConfig(projectPath, releaseConfig);
                            expand.androidGradle("versionCode", originalData.android.versionCode);
                            expand.androidGradle("versionName", originalData.android.versionName);
                            expand.iosInfo("CFBundleVersion", originalData.ios.CFBundleVersion);
                            expand.iosInfo("CFBundleShortVersionString", originalData.ios.CFBundleShortVersionString);
                            //
                            plugin.repair(() => {
                                let packageFile = path.resolve(process.cwd(), "package.json");
                                if (fs.existsSync(packageFile)) {
                                    let packageInfo = fs.readFileSync(packageFile, 'utf8');
                                    let releasePackageFile = path.resolve(releasePath, "package.json");
                                    if (fs.existsSync(releasePackageFile)) {
                                        let releasePackageInfo = utils.jsonParse(fs.readFileSync(releasePackageFile, 'utf8'));
                                        let projectPackageInfo = utils.jsonParse(packageInfo);
                                        fs.writeFileSync(packageFile, JSON.stringify(lodash.merge(projectPackageInfo, releasePackageInfo), null, "\t"), 'utf8')
                                    }else{
                                        packageInfo = packageInfo.replace(/"version"\s*:\s*"(.*?)"/g, `"version": "${newRelease}"`);
                                        fs.writeFileSync(packageFile, packageInfo, 'utf8')
                                    }
                                }
                                //
                                logger.success(`主框架升级至最新版本（${newRelease}）成功。`);
                                logger.sep();
                                logger.info("您可以运行一下命令开始。");
                                logger.info(chalk.white(`1. npm install`));
                                logger.info(chalk.white(`2. npm run dev`));
                            });
                        }, ['src']);
                    }, ['src']);
                });
            } else {
                logger.fatal(isLatest ? `放弃操作！` : `放弃升级！`);
            }
        }).catch(console.error);
    });
}

module.exports = {start};
