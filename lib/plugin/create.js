const fs = require("fs");
const path = require('path');
const install = require('./install');
const plugin = require('./index');
const logger = require('../utils/logger');
const utils = require("../utils");
const fse = require("fs-extra");
const inquirer = require('inquirer');
const regFun = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

function create(op) {
    inquirer.prompt([{
        type: 'input',
        name: 'name',
        default: () => {
            if (typeof op.name !== 'string') op.name = "";
            return op.name.trim() ? op.name.trim() : 'demo/sample';
        },
        message: "请输入插件仓库名称:",
        validate: (value) => {
            let pass = value.match(/^[a-z][a-z0-9\-_@]+\/[a-z][a-z0-9\-_@]+$/i);
            if (pass) {
                return true;
            }
            return '输入格式错误！（格式：username/pluginname）';
        }
    }, {
        type: 'input',
        name: 'desc',
        message: '请输入插件描述（选填）:'
    }]).then(answers => {
        op.name = answers.name.trim();
        let newPath = path.resolve(op.rootDir, "plugins", op.name);
        if (fse.pathExistsSync(newPath)) {
            let lists = utils.fileDirDisplay(newPath);
            if (lists.file.length > 0) {
                logger.fatal('插件目录' + op.name + '已存在！');
            }
        }
        //添加android
        createProject(op.name, newPath);
        fs.writeFileSync(path.resolve(newPath, "config.json"), JSON.stringify(utils.sortObject({
            "desc": answers.desc,
            "requireFormatName": utils.spritUpperCase(answers.name),
            "requireName": answers.name,
        }), null, "\t"), 'utf8');
        //
        install.changeSetting(op, true);
        install.changeGradle(op, true);
        install.cleanIdea(op);
        install.invokeAndroid(op, () => {
            install.changeProfile(op, true);
            install.invokeIos(op, () => {
                utils.pluginsJson(true, op);
                plugin.eeuiScript(op.name, true, () => {
                    logger.success('插件' + op.name + '添加成功!');
                });
            });
        });
    }).catch(console.error);
}

function createProject(projectName, projectPath) {
    let demoName = "PluginDemo";
    let demoPath = path.resolve(__dirname, "template");
    if (!fse.pathExistsSync(demoPath)) {
        logger.fatal('模板文件不存在！');
    }
    let lists = utils.fileDirDisplay(demoPath);
    //复制目录
    for (let index in lists.dir) {
        if (!lists.dir.hasOwnProperty(index)) continue;
        let oldPath = lists.dir[index];
        let newPath = oldPath.replace(new RegExp(regFun(demoPath), "g"), projectPath);
        newPath = newPath.replace(new RegExp(regFun(demoName), "g"), utils.spritUpperCase(projectName));
        fse.ensureDirSync(newPath);
    }
    //复制文件
    for (let index in lists.file) {
        if (!lists.file.hasOwnProperty(index)) continue;
        let oldPath = lists.file[index];
        let newPath = oldPath.replace(new RegExp(regFun(demoPath), "g"), projectPath);
        newPath = newPath.replace(new RegExp(regFun(demoName), "g"), utils.spritUpperCase(projectName));
        fse.ensureFileSync(newPath);
        //
        let result = fs.readFileSync(oldPath, 'utf8');
        result = result.replace(new RegExp(regFun(demoName), "gm"), utils.spritUpperCase(projectName));
        if (result) {
            fs.writeFileSync(newPath, result, 'utf8');
        } else {
            fse.copySync(oldPath, newPath);
        }
    }
    //创建.gitignore文件
    fs.writeFileSync(path.join(projectPath, '.gitignore'), `android/build\nios/*.xcuserdatad\n__MACOSX\n.DS_Store\n*.iml`, 'utf8');
}

module.exports = {create};
