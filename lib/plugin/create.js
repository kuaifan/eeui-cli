const android = require('./android');
const ios = require('./ios');
const log = require('../utils/logger');
const utils = require("../utils");
const fs = require("fs");
const fse = require("fs-extra");
const inquirer = require('inquirer');
const dirCut = /^win/.test(process.platform) ? "\\" : "/";
const regFun = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

function create(op) {
    inquirer.prompt([{
        type: 'input',
        name: 'name',
        default: function () {
            if (typeof op.name !== 'string') op.name = "";
            return op.name.trim() ? op.name.trim() : 'plugin-demo';
        },
        message: "请输入新建插件名称",
        validate: function (value) {
            let pass = value.match(/^[0-9a-z\-_]+$/i);
            if (pass) {
                return true;
            }
            return '输入格式错误，请重新输入。';
        }
    }]).then(answers => {
        op.name = answers.name;
        let androidPath = op.rootDir + dirCut + "plugins" + dirCut + "android" + dirCut + op.name;
        let iosPath = op.rootDir + dirCut + "plugins" + dirCut + "ios" + dirCut + op.name;
        if (fse.pathExistsSync(androidPath)) {
            log.fatal('android插件目录' + op.name + '已存在！');
        }
        if (fse.pathExistsSync(iosPath)) {
            log.fatal('iOS插件目录' + op.name + '已存在！');
        }
        //添加android
        createProject('android', op.name, androidPath);
        android.addSetting(op);
        android.addGradle(op);
        android.invokeScript(op, true, (exec) => {
            log.eeuis('插件' + op.name + ' android端添加' + (exec ? '完成' : '成功') + '!');
            //添加iOS
            createProject('ios', op.name, iosPath);
            ios.invokeScript(op, true, () => {
                ios.changeProfile(op, true);
            });
        });
    }).catch(console.error);
}

function createProject(projectType, projectName, projectPath) {
    let demoName = "PluginDemo";
    let demoPath;
    if (projectType === "android") {
        demoPath = __dirname + dirCut + "template" + dirCut + "android" + dirCut + "PluginDemo";
    } else if (projectType === "ios") {
        demoPath = __dirname + dirCut + "template" + dirCut + "ios" + dirCut + "PluginDemo";
    } else {
        return;
    }
    if (!fse.pathExistsSync(demoPath)) {
        log.fatal('模板文件不存在！');
    }
    let lists = utils.fileDirDisplay(demoPath);
    //复制目录
    for (let index in lists.dir) {
        if (!lists.dir.hasOwnProperty(index)) continue;
        let oldPath = lists.dir[index];
        let newPath = oldPath.replace(new RegExp(regFun(demoPath), "g"), projectPath);
        newPath = newPath.replace(new RegExp(regFun(demoName), "g"), projectName);
        fse.ensureDirSync(newPath);
    }
    //复制文件
    for (let index in lists.file) {
        if (!lists.file.hasOwnProperty(index)) continue;
        let oldPath = lists.file[index];
        let newPath = oldPath.replace(new RegExp(regFun(demoPath), "g"), projectPath);
        newPath = newPath.replace(new RegExp(regFun(demoName), "g"), projectName);
        fse.ensureFileSync(newPath);
        let result = fs.readFileSync(oldPath, 'utf8').replace(new RegExp(regFun(demoName), "gm"), projectName);
        if (result) {
            fs.writeFileSync(newPath, result, 'utf8');
        }else{
            fse.copySync(oldPath, newPath);
        }
    }
}

module.exports = {create};
