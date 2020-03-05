const fs = require('fs');
const fse = require("fs-extra");
const path = require('path');
const ora = require('ora');
const chalk = require('chalk');
const inquirer = require('inquirer');
const decompress = require('decompress');
const md5File = require('md5-file');
const request = require('request');
const logger = require('./logger');
const config = require("../../config");
const utils = require("./index");

function start() {
    let projectPath = path.resolve(process.cwd());
    let configInfo = require(path.resolve(projectPath, "eeui.config.js"));
    let serviceUrl = utils.getObject(configInfo, "serviceUrl");
    if (utils.count(serviceUrl) > 0) {
        logger.fatal("当前项目已自定义服务端网址（" + serviceUrl + "），自搭建服务端不支持一键云修复文件！");
    }
    //
    let zipPackPath = path.resolve(config.zipPackDir);
    utils.mkdirsSync(zipPackPath);
    let count = utils.count(zipPackPath);
    let lists = utils.fileDirDisplay(zipPackPath, true);
    let files = lists.file.sort().reverse();
    let choices = [];
    for (let index in files) {
        if (!files.hasOwnProperty(index)) continue;
        if (choices.length >= 100) break;
        let tmp = files[index];
        choices.push(tmp.substr(count + 1));
    }
    if (choices.length === 0) {
        logger.fatal(`未找到buildZip文件包！`);
    }
    if (choices.length === 1) {
        logger.fatal(`未找到可对比的buildZip文件包！`);
    }
    //
    let newZip,
        oldZip;
    inquirer.prompt([{
        type: 'list',
        name: 'name',
        message: `请选择修复包（新包）:`,
        choices: choices,
    }]).then(function(newAnswers) {
        newZip = path.join(zipPackPath, newAnswers.name);
        choices.some((item, index) => {
            if (item === newAnswers.name) {
                choices.splice(index, 1);
                return true;
            }
        });
        inquirer.prompt([{
            type: 'list',
            name: 'name',
            message: `请选择被修复包（旧包）:`,
            choices: choices,
        }]).then(function(oldAnswers) {
            oldZip = path.join(zipPackPath, oldAnswers.name);
            let spinFetch = ora('正在生成差异包...');
            spinFetch.start();
            //
            let newPath = utils.rightDelete(newZip, '.zip');
            let oldPath = utils.rightDelete(oldZip, '.zip');
            fse.removeSync(newPath);
            fse.removeSync(oldPath);
            utils.mkdirsSync(newPath);
            utils.mkdirsSync(oldPath);
            decompress(newZip, newPath).then(() => {
                decompress(oldZip, oldPath).then(() => {
                    let newLists = utils.fileDirDisplay(newPath).file;
                    if (newLists.length === 0) {
                        spinFetch.stop();
                        fse.removeSync(newPath);
                        fse.removeSync(oldPath);
                        logger.fatal(`修复包没有任何文件`);
                        return
                    }
                    let fileLists = [];
                    newLists.forEach((newFile) => {
                        let oldFile = newFile.replace(newPath, oldPath);
                        if (!fs.existsSync(oldFile) || md5File.sync(newFile) !== md5File.sync(oldFile)) {
                            fileLists.push(newFile)
                        }
                    });
                    if (fileLists.length === 0) {
                        spinFetch.stop();
                        fse.removeSync(newPath);
                        fse.removeSync(oldPath);
                        logger.fatal(`没有差异的文件`);
                        return
                    }
                    //
                    let diffPackPath = path.resolve(config.diffPackDir);
                    utils.mkdirsSync(diffPackPath);
                    let zipPath = diffPackPath + "/differ-" + utils.rightDelete(utils.leftDelete(newAnswers.name, 'build-'), '.zip') + "-" + utils.rightDelete(utils.leftDelete(oldAnswers.name, 'build-'), '.zip') + ".zip";
                    if (fs.existsSync(zipPath)) {
                        fse.removeSync(zipPath);
                    }
                    let entry = [];
                    fileLists.forEach((tmp) => {
                        entry.push({
                            type: "file",
                            root: newPath,
                            path: tmp,
                        });
                    });
                    utils.zipCompress({
                        output: zipPath,
                        entry: entry
                    }, (output, err) => {
                        spinFetch.stop();
                        fse.removeSync(newPath);
                        fse.removeSync(oldPath);
                        if (err) {
                            logger.fatal(`打包差异文件失败：${err}`);
                        } else {
                            step2(output, fileLists);
                        }
                    });
                });
            });
        });
    });
}

function step2(zipPath, fileLists) {
    logger.sep();
    logger.success(`找到修复文件${fileLists.length}个。`);
    logger.sep();
    //
    let spinFetch = ora('正在获取应用版本...');
    spinFetch.start();
    request(utils.apiUrl(true) + 'apps/update?act=applists&token=' + utils.getToken(), (err, res, body) => {
        spinFetch.stop();
        let data = utils.jsonParse(body);
        if (data.ret === -1) {
            logger.warn('请先登录后再继续！');
            utils.login(true, () => {
                step2(zipPath, fileLists);
            });
            return;
        }
        if (data.ret !== 1) {
            logger.fatal(data.msg || '系统繁忙，请稍后再试！');
        }
        if (data.data.length === 0) {
            logger.fatal('没有找到应用，请先到控制台添加吧。');
        }
        //
        let choices = [];
        data.data.forEach((item) => {
            choices.push({
                name: item.title + '（ID:' + item.id + '）',
                value: item.id
            })
        });
        inquirer.prompt([{
            type: 'list',
            name: 'appid',
            message: `请选择修复的应用:`,
            choices: choices,
        }, {
            type: 'input',
            name: 'version',
            message: "请输入修复的应用版本号（多个半角逗号分隔）:",
            validate: function (value) {
                let array = (value + "").split(",");
                if (array.length === 0) {
                    return '请输入要修复的版本号。';
                }
                let error = false;
                array.some((val) => {
                    if (!(Math.ceil(val) === Math.floor(val) && Math.ceil(val) > 0)) {
                        return error = true;
                    }
                });
                if (error) {
                    return '输入格式错误，版本号应为整数（多个半角逗号分隔）。';
                }
                return true;
            }
        }, {
            type: 'list',
            name: 'platform',
            message: '请选择修复的应用平台:',
            choices: [{
                name: '修复 Android、iOS',
                value: 'android,ios'
            }, {
                name: '仅修复 Android',
                value: 'android'
            }, {
                name: '仅修复 iOS',
                value: 'ios'
            }]
        }, {
            type: 'list',
            name: 'debug',
            message: '选择是否修复DEBUG版本:',
            choices: [{
                name: '排除DEBUG版本',
                value: 0
            }, {
                name: '包含DEBUG版本',
                value: 1
            }, {
                name: '仅DEBUG版本',
                value: 2
            }]
        }, {
            type: 'list',
            name: 'update_mode',
            message: '选择更新模式:',
            choices: [{
                name: '启动时触发更新',
                value: 0
            }, {
                name: '客户手动触发更新',
                value: 1
            }]
        }, {
            type: 'list',
            name: 'reboot',
            message: '选择修复完成后行为事件:',
            choices: [{
                name: '提示重启',
                value: 2
            }, {
                name: '静默',
                value: 0
            }, {
                name: '自动重启',
                value: 1
            }]
        }, {
            type: 'list',
            name: 'clear_cache',
            message: '选择修复完成后缓存管理:',
            choices: [{
                name: '保留缓存',
                value: 0
            }, {
                name: '清除缓存',
                value: 1
            }]
        }, {
            type: 'input',
            name: 'title',
            default: () => {
                return '一键修复包';
            },
            message: "请输入修复备注:",
            validate: (value) => {
                return value !== ''
            }
        }]).then(function(answers) {
            answers.zipPath = zipPath;
            step3(answers, fileLists);
        });
    });
}

function step3(answers, fileLists) {
    let spinFetch = ora('正在上传差异包...').start();
    request.post({
        url: utils.apiUrl(true) + 'apps/update',
        formData: {
            act: 'upload',
            token: utils.getToken(),
            zipfile: fs.createReadStream(answers.zipPath),
        }
    }, (error, response, body) => {
        spinFetch.stop();
        let data = utils.jsonParse(body);
        if (data.ret === -1) {
            logger.warn('请先登录后再继续！');
            utils.login(true, () => {
                step3(answers, fileLists);
            });
            return;
        }
        if (data.ret !== 1) {
            logger.fatal(data.msg || '系统繁忙，请稍后再试！');
        }
        answers.title = answers.title || "一键修复包";
        answers.valid = 1;
        answers.fileinfo = data.data;
        step4(answers, fileLists);
    });
}

function step4(answers, fileLists) {
    let spinFetch = ora('正在添加修复包...').start();
    request.post({
        url: utils.apiUrl(true) + 'apps/update',
        formData: {
            act: 'add-from-cli',
            token: utils.getToken(),
            D: JSON.stringify(answers),
        }
    }, (error, response, body) => {
        spinFetch.stop();
        let data = utils.jsonParse(body);
        if (data.ret === -1) {
            logger.warn('请先登录后再继续！');
            utils.login(true, () => {
                step4(answers, fileLists);
            });
            return;
        }
        if (data.ret !== 1) {
            logger.fatal(data.msg || '系统繁忙，请稍后再试！');
        }
        logger.sep();
        logger.success(`添加修复包成功（共${fileLists.length}个文件）。`);
        logger.info('更多详细设置可登录控制台 ' + chalk.underline(utils.consoleUrl(true)) + ' 查看。');
        logger.sep();
    });
}

module.exports = {start};
