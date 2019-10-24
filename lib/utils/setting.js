const fs = require('fs');
const path = require('path');
const ora = require('ora');
const shelljs = require('shelljs');
const inquirer = require('inquirer');
const lodash = require("lodash");
const log = require('./logger');
const utils = require("./index");
const project = require("./project");
const expand = require("./expand");

const isWin = /^win/.test(process.platform);
const dirCut = isWin ? "\\" : "/";

function start() {
    let projectPath = path.resolve(process.cwd());
    let configFile = projectPath + dirCut + "eeui.config.js";
    if (!fs.existsSync(configFile)) {
        log.fatal("当前目录非eeui项目，无法进行此操作！");
    }
    let releaseFile = projectPath + dirCut + ".eeui.release";
    let releaseConfig = utils.jsonParse(!fs.existsSync(releaseFile) ? {} : fs.readFileSync(releaseFile, 'utf8'));
    //
    let applicationid = "";
    let questions = [{
        type: 'input',
        name: 'appName',
        default: function () {
            return releaseConfig.appName || 'eeui演示';
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
        name: 'versionCode',
        default: function () {
            return expand.androidGradle("versionCode") || 1;
        },
        message: "请输入Android应用版本号",
        validate: function (value) {
            if (Math.ceil(value) === Math.floor(value) && Math.ceil(value) > 0) {
                return true;
            }
            return '输入格式错误，版本号应为整数。';
        }
    }, {
        type: 'input',
        name: 'versionName',
        default: function () {
            return expand.androidGradle("versionName") || "1.0.0";
        },
        message: "请输入Android应用版本名称",
        validate: function (value) {
            return value !== ''
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
    }, {
        type: 'input',
        name: 'CFBundleVersion',
        default: function () {
            return expand.iosInfo("CFBundleVersion") || 1;
        },
        message: "请输入iOS应用版本号",
        validate: function (value) {
            if (Math.ceil(value) === Math.floor(value) && Math.ceil(value) > 0) {
                return true;
            }
            return '输入格式错误，版本号应为整数。';
        }
    }, {
        type: 'input',
        name: 'CFBundleShortVersionString',
        default: function () {
            return expand.iosInfo("CFBundleShortVersionString") || "1.0.0";
        },
        message: "请输入iOS应用版本名称",
        validate: function (value) {
            return value !== ''
        }
    }];

    inquirer.prompt(questions).then(answers => {

        releaseConfig = lodash.merge(releaseConfig, answers);
        project.initConfig(projectPath, releaseConfig);

        expand.androidGradle("versionCode", answers.versionCode);
        expand.androidGradle("versionName", answers.versionName);
        expand.iosInfo("CFBundleVersion", answers.CFBundleVersion);
        expand.iosInfo("CFBundleShortVersionString", answers.CFBundleShortVersionString);

        log.eeuis(`Android设置成功`);
        log.eeuis(`iOS设置成功`);

    }).catch(console.error);
}

module.exports = {start};
