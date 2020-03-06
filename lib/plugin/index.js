const fs = require('fs');
const fse = require("fs-extra");
const path = require('path');
const logger = require('../utils/logger');
const utils = require('../utils');
const ora = require('ora');
const inquirer = require('inquirer');
const request = require('request');
const rimraf = require('rimraf');
const install = require("./install");

function add(op) {
    if (typeof op.name !== 'string') op.name = "";
    op.name = op.name.trim();
    if (utils.count(op.name) === 0) {
        logger.fatal(`请输入要添加的插件名称！`);
        return;
    }
    op.baseUrl = utils.apiUrl() + 'plugins/client/';
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
    let tmpMatch = (op.name + "").match(/^https:\/\/github.com\/([^/]+)\/([^/]+)\/*$/);
    if (tmpMatch) {
        op.name = tmpMatch[1] + "/" + tmpMatch[2];
        op.isGithub = true;
    } else {
        op.isGithub = false;
    }
    //
    let nextCallback = () => {
        if (op.__nameAlso !== "") {
            op.name = op.__nameAlso;
            add(op);
        } else if (op.__endExit === true) {
            process.exit();
        }
    };
    //
    getInfo(op, (op) => {
        op.callback = () => {
            eeuiScript(op.name, true, () => {
                nextCallback();
            });
        };
        install.add(op);
    });
}

function remove(op) {
    if (typeof op.name !== 'string') op.name = "";
    op.name = op.name.trim();
    if (utils.count(op.name) === 0) {
        selectRemove(op);
        return;
    }
    op.baseUrl = utils.apiUrl() + 'plugins/client/';
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
    let tmpMatch = (op.name + "").match(/^https:\/\/github.com\/([^/]+)\/([^/]+)\/*$/);
    if (tmpMatch) {
        op.name = tmpMatch[1] + "/" + tmpMatch[2];
        op.isGithub = true;
    } else {
        op.isGithub = false;
    }
    //
    let nextCallback = () => {
        if (op.__nameAlso !== "") {
            op.name = op.__nameAlso;
            remove(op);
        }
    };
    //
    let func = () => {
        op.callback = () => {
            eeuiScript(op.name, false, () => {
                let tmpPath = path.resolve(op.rootDir, "plugins", op.name);
                rimraf(tmpPath, () => {
                    tmpPath = path.resolve(tmpPath, "../");
                    if (tmpPath !== path.resolve(op.rootDir, "plugins")) {
                        let files = fs.readdirSync(tmpPath);
                        if (files.length === 0) {
                            fse.removeSync(tmpPath);
                        }
                    }
                    nextCallback();
                });
            });
        };
        install.remove(op);
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
                logger.fatal(`放弃删除${op.name}！`);
            }
        }).catch(console.error);
    }
}

function selectRemove(op) {
    let getDir = (dirPath, first) => {
        let array = [];
        let lists = fs.readdirSync(dirPath);
        lists.forEach((filename) => {
            let filedir = path.join(dirPath, filename);
            let stats = utils.pathType(filedir);
            if (stats === 2) {
                if (typeof first === "undefined") {
                    array = array.concat(getDir(filedir, filename));
                } else {
                    filename = first + "/" + filename;
                    if (["eeui/framework", "eeui/WeexSDK"].indexOf(filename) === -1) {
                        array.push({
                            name: (array.length + 1) + '.' + filename,
                            value: filename,
                        });
                    }
                }
            }
        });
        return array;
    };
    let choices = getDir(path.resolve(process.cwd(), 'plugins'));
    if (choices.length === 0) {
        logger.fatal(`没有找到可删除的插件！`);
    }
    inquirer.prompt([{
        type: 'list',
        name: 'name',
        message: '请选择要删除的插件:',
        choices: choices
    }]).then(answers => {
        op.name = answers.name;
        remove(op);
    });
}

function repair(callback) {
    let rootDir = process.cwd();
    let configFile = path.resolve(rootDir, "plugins/config.json");
    let configInfo = utils.jsonParse(!fs.existsSync(configFile) ? {} : fs.readFileSync(configFile, 'utf8'));
    //
    let dependencies = utils.getObject(configInfo, 'dependencies');
    if (!utils.isJson(dependencies) || utils.count(dependencies) === 0) {
        callback();
        return;
    }
    //
    let func = () => {
        utils.each(dependencies, (name, op) => {
            delete dependencies[name];
            op.rootDir = rootDir;
            op.simple = utils.count(dependencies) > 0;
            //
            install.changeSetting(op, true);
            install.changeGradle(op, true);
            install.cleanIdea(op);
            install.invokeAndroid(op, () => {
                install.changeProfile(op, true);
                install.invokeIos(op, () => {
                    logger.success('插件' + op.name + '添加成功!');
                    if (op.simple) {
                        func();
                    } else {
                        eeuiScript(null, true, () => {
                            if (typeof callback == "function") {
                                callback();
                            } else {
                                logger.success(`插件修复完成。`);
                            }
                        });
                    }
                });
            });
            return false;
        });
    };
    func();
}

function eeuiScript(assignName, isInstall, callback) {
    let rootDir = process.cwd();
    let jsArray = [];
    //
    if (typeof assignName === "string" && utils.count(assignName) > 0) {
        let jsPath = path.resolve(rootDir, `plugins/${assignName}/script/${isInstall ? 'install' : 'uninstall'}.js`);
        if (fs.existsSync(jsPath)) {
            jsArray.push("node " + jsPath);
        }
    } else {
        let configFile = path.resolve(rootDir, "plugins/config.json");
        let configInfo = utils.jsonParse(!fs.existsSync(configFile) ? {} : fs.readFileSync(configFile, 'utf8'));
        utils.each(utils.getObject(configInfo, 'dependencies'), (name) => {
            let jsPath = path.resolve(rootDir, `plugins/${name}/script/${isInstall ? 'install' : 'uninstall'}.js`);
            if (fs.existsSync(jsPath)) {
                jsArray.push("node " + jsPath);
            }
        });
    }
    //
    if (jsArray.length === 0) {
        typeof callback === 'function' && callback();
    } else {
        let spinFetch = ora('run nodejs...');
        let timeout = setTimeout(() => {
            spinFetch.start();
        }, 500);
        utils.exec(jsArray.join(" && "), false).then(() => {
            clearTimeout(timeout);
            spinFetch.stop();
            typeof callback === 'function' && callback();
        });
    }
}

function getInfo(op, callback) {
    let spinFetch = ora('正在获取插件详情...');
    spinFetch.start();
    let reqGithub = () => {
        request("https://api.github.com/repos/" + op.name, {
            headers: {
                'User-Agent': 'request'
            }
        }, (err, res, body) => {
            spinFetch.stop();
            let data = utils.jsonParse(body);
            if (utils.runNum(data.id) === 0) {
                logger.fatal(`获取插件失败：找不到相关插件！`);
            }
            op.isGithub = true;
            callback(Object.assign(op, {
                name: op.name,
                fileinfo: [{
                    path: `https://github.com/${op.name}/archive/${data.default_branch || 'master'}.zip`
                }]
            }));
        });
    };
    if (op.isGithub === true) {
        reqGithub();
        return;
    }
    //
    request(utils.apiUrl() + 'plugins/client/' + op.name + '?version=' + utils.projectVersion(), (err, res, body) => {
        let data = utils.jsonParse(body);
        if (data.ret !== 1) {
            reqGithub();
        } else {
            spinFetch.stop();
            callback(Object.assign(op, data.data, {name: op.name}));
        }
    });
}

module.exports = {add, remove, repair, eeuiScript};
