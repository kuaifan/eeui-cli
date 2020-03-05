const fs = require('fs');
const path = require("path");
const inquirer = require('inquirer');
const logger = require('../utils/logger');
const utils = require("./index");

let packageFile             = path.resolve(process.cwd(), "package.json");
let templateDir             = path.resolve(process.cwd(), "../eeui-template");
let templatePackageFile     = path.resolve(process.cwd(), "../eeui-template/package.json");
let iosVersionFile          = path.resolve(process.cwd(), "../eeui-template/plugins/eeui/framework/ios/eeui/eeuiVersion.m");
let iosPodspecFile          = path.resolve(process.cwd(), "../eeui-template/plugins/eeui/framework/ios/eeui.podspec");
if (!fs.existsSync(templatePackageFile)) {
    logger.fatal(`error dir`);
}

let androidGradle = function(name, newValue) {
    let file = templateDir + '/platforms/android/eeuiApp/build.gradle';
    if (!fs.existsSync(file)) {
        return "";
    }
    //
    let value = "";
    let result = fs.readFileSync(file, 'utf8');
    let reg = new RegExp(`${name}\\s*=\\s*("*|'*)(.+?)\\1\\r*\\n`);
    let match = result.match(reg);
    if (utils.count(match) > 2) {
        value = match[2].trim();
        if (typeof newValue !== "undefined") {
            let newResult = result.replace(new RegExp(match[0], "g"), `${name} = ${match[1]}${newValue}${match[1]}\n`);
            fs.writeFileSync(file, newResult, 'utf8');
            value = newValue;
        }
    }
    return value;
};

inquirer.prompt([{
    type: 'input',
    name: 'eeuiVersionCode',
    message: "请输入版本号",
    default: function () {
        return androidGradle("eeuiVersionCode") || 1;
    },
    validate: function (value) {
        if (Math.ceil(value) === Math.floor(value) && Math.ceil(value) > 0) {
            return true;
        }
        return '输入格式错误，版本号应为整数。';
    }
}, {
    type: 'input',
    name: 'eeuiVersionName',
    message: "请输入版本名称",
    default: function () {
        return androidGradle("eeuiVersionName") || "1.0.0";
    },
    validate: function (value) {
        return value !== ''
    }
}, {
    type: 'confirm',
    message: "是否要求脚手架版本与框架版本一致？",
    name: 'cliEqual',
}]).then(answers => {
    //修改eeui-cli版本
    let newResult = fs.readFileSync(packageFile, 'utf8').replace(/"version":\s*"(.*?)"/, `"version": "${answers.eeuiVersionName}"`);
    fs.writeFileSync(packageFile, newResult, 'utf8');
    //修改eeui-template版本
    newResult = fs.readFileSync(templatePackageFile, 'utf8').replace(/"version":\s*"(.*?)"/, `"version": "${answers.eeuiVersionName}"`);
    if (answers.cliEqual === true) {
        newResult = newResult.replace(/"eeuiclimin":\s*"(.*?)"/, `"eeuiclimin": "${answers.eeuiVersionName}"`);
    }
    fs.writeFileSync(templatePackageFile, newResult, 'utf8');
    //修改Android版本
    androidGradle("eeuiVersionCode", answers.eeuiVersionCode);
    androidGradle("eeuiVersionName", answers.eeuiVersionName);
    //修改iOS版本
    newResult = fs.readFileSync(iosVersionFile, 'utf8').replace(/return @"(.*?)";\s*\/\/versionCode/, `return @"${answers.eeuiVersionCode}";    //versionCode`);
    newResult = newResult.replace(/return @"(.*?)";\s*\/\/versionName/, `return @"${answers.eeuiVersionName}";    //versionName`);
    fs.writeFileSync(iosVersionFile, newResult, 'utf8');
    newResult = fs.readFileSync(iosPodspecFile, 'utf8').replace(/s.version(\s*)=(\s*)"(.*?)"/, `s.version$1=$2"${answers.eeuiVersionName}"`);
    fs.writeFileSync(iosPodspecFile, newResult, 'utf8');
    //修改完成
    console.log();
    console.log("操作成功！");
}).catch(console.error);
