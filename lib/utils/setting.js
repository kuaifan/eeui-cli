const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const lodash = require("lodash");
const logger = require('./logger');
const utils = require("./index");
const project = require("./project");
const expand = require("./expand");

function start() {
    let projectPath = path.resolve(process.cwd());
    let releaseFile = path.resolve(projectPath, ".eeui.release");
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
            let pass = value.match(/^[a-z][a-z0-9_]+([.][a-z][a-z0-9_]+){2,4}$/i);
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
            let pass = value.match(/^[a-z][a-z0-9_]+([.][a-z][a-z0-9_]+){2,4}$/i);
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

        logger.success(`Android设置成功`);
        logger.success(`iOS设置成功`);

    }).catch(console.error);
}

module.exports = {start};
