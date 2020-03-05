const fs = require("fs");
const path = require('path');
const fse = require("fs-extra");
const chalk = require('chalk');
const logger = require('../utils/logger');
const utils = require("../utils");
const inquirer = require('inquirer');
const ora = require('ora');
const request = require('request');

/**
 * 上传程序
 * @param op
 */
function publish(op) {
    if (utils.count(op.name) === 0) {
        logger.fatal('请输入要上传的插件名称！');
    }
    op.pluginPath = path.resolve(op.rootDir, 'plugins', op.name);
    if (!fse.pathExistsSync(op.pluginPath)) {
        logger.fatal(op.name + '插件目录不存在！');
    }
    op.pluginZipPath = path.resolve(op.pluginPath, utils.spritUpperCase(op.name) + '.zip');
    if (fs.existsSync(op.pluginZipPath)) {
        fse.removeSync(op.pluginZipPath);
    }
    let configFile = path.resolve(op.pluginPath, 'config.json');
    let configInfo = utils.jsonParse(!fs.existsSync(configFile) ? {} : fs.readFileSync(configFile, 'utf8'));
    //
    inquirer.prompt([{
        type: 'input',
        name: 'desc',
        message: '请输入' + op.name + '插件描述:',
        validate: (value) => {
            if (utils.count(value) === 0) {
                return "请输入插件描述";
            }
            configInfo['desc'] = value;
            return true;
        },
        default: () => {
            return configInfo['desc'] || null;
        },
    }, {
        type: 'list',
        name: 'device',
        message: '请选择' + op.name + '插件支持的平台:',
        choices: [{
            name: '支持 Android、iOS',
            value: 'android,ios'
        }, {
            name: '仅支持 Android',
            value: 'android'
        }, {
            name: '仅支持 iOS',
            value: 'ios'
        }]
    }, {
        type: 'input',
        name: 'zipdesc',
        message: '请输入' + utils.spritUpperCase(op.name) + '.zip插件包描述（选填）:',
    }]).then(answers => {
        fs.writeFileSync(configFile, JSON.stringify(utils.sortObject(configInfo), null, "\t"), 'utf8');
        op.android = answers.device.indexOf("android") !== -1;
        op.ios = answers.device.indexOf("ios") !== -1;
        op.desc = answers.desc;
        op.zipdesc = answers.zipdesc;
        op.token = utils.getToken();
        let loading = ora('正在准备插件...').start();
        request(utils.apiUrl() + 'users/info?token=' + op.token, (err, res, body) => {
            loading.stop();
            let data = utils.jsonParse(body);
            if (data.ret === -1) {
                logger.warn('请先登录后上传！');
                utils.login(() => {
                    op.token = utils.getToken();
                    compress(op);
                });
                return;
            }
            if (data.ret !== 1) {
                logger.fatal(`验证身份失败：${data.msg}`);
            }
            compress(op);
        });
    }).catch(console.error);
}

/**
 * 开始压缩
 */
function compress(op) {
    let loading = ora('正在打包插件...').start();
    utils.zipCompress({
        output: op.pluginZipPath,
        entry: [{
            type: 'dir',
            path: op.pluginPath
        }]
    }, (output, err) => {
        loading.stop();
        if (err) {
            throw err;
        }
        uploadFileZip(op);
    });
}

/**
 * 开始上传
 * @param op
 */
function uploadFileZip(op) {
    op.fileinfo = [];
    let loading = ora('正在上传插件...').start();
    request.post({
        url: utils.apiUrl() + 'plugins/lists',
        formData: {
            act: 'upload',
            token: op.token,
            zipfile: fs.createReadStream(op.pluginZipPath),
        }
    }, (error, response, body) => {
        loading.stop();
        let data = utils.jsonParse(body);
        if (data.ret !== 1) {
            fse.removeSync(op.pluginZipPath);
            logger.fatal(`上传插件失败：${data.msg}`);
        }
        data.data['desc'] = op.zipdesc;
        op.fileinfo.push(data.data);
        launch(op);
    });
}

/**
 * 开始上传
 * @param op
 */
function launch(op) {
    let loading = ora('开始上传插件...').start();
    let configFile = path.resolve(op.pluginPath, 'config.json');
    if (fs.existsSync(configFile)) {
        let configInfo = utils.jsonParse(fs.readFileSync(configFile, 'utf8'));
        op.requireName = configInfo.requireName || '';
    }
    let D = utils.clone(op);
    D.name = op.name.substring(op.name.lastIndexOf("/") + 1);
    request.post({
        url: utils.apiUrl() + 'plugins/lists',
        formData: {
            act: 'add',
            publish: 'cli',
            token: op.token,
            D: utils.jsonStringify(D)
        }
    }, (error, response, body) => {
        loading.stop();
        let data = utils.jsonParse(body);
        if (data.ret !== 1) {
            logger.fatal(`上传插件失败：${data.msg}`);
        }
        let pathName = utils.getObject(data, 'data.pathName');
        let fileSize = utils.runNum(utils.getObject(data, 'data.fileSize'));
        let formatSize = utils.getObject(data, 'data.formatSize');
        logger.success(`插件${op.name}上传成功！${fileSize > 0 ? `（${formatSize}）` : ``}`);
        logger.success('开发者可通过 ' + chalk.underline(`eeui plugin install ${pathName}`) + ' 命令添加此插件。');
        logger.info('更多详细设置可登录控制台 ' + chalk.underline(utils.consoleUrl(true)) + ' 查看。');
        //
        fse.removeSync(op.pluginZipPath);
    });
}

module.exports = {publish};
