const fs = require("fs");
const fse = require("fs-extra");
const chalk = require('chalk');
const log = require('../utils/logger');
const utils = require("../utils");
const inquirer = require('inquirer');
const archiver = require("archiver");
const ora = require('ora');
const request = require('request');
const dirCut = /^win/.test(process.platform) ? "\\" : "/";

/**
 * 上传程序
 * @param op
 */
function publish(op) {
    op.androidPath = op.rootDir + dirCut + 'plugins' + dirCut + 'android' + dirCut + op.name;
    op.iosPath = op.rootDir + dirCut + 'plugins' + dirCut + 'ios' + dirCut + op.name;
    if (!fse.pathExistsSync(op.androidPath)) {
        log.fatal(op.name + '插件android版不存在！');
    }
    if (!fse.pathExistsSync(op.iosPath)) {
        log.fatal(op.name + '插件iOS版不存在！');
    }
    op.androidZipPath = op.androidPath + dirCut + op.name + '_android.zip';
    op.iosZipPath = op.iosPath + dirCut + op.name + '_ios.zip';
    //
    let title = "";
    inquirer.prompt([{
        type: 'input',
        name: 'title',
        message: '请输入' + op.name + '插件中文名称:',
        validate: (value) => {
            title = value;
            return true;
        }
    }, {
        type: 'input',
        name: 'desc',
        message: '请输入' + op.name + '插件描述:',
        default: () => {
            return title;
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
    }]).then(answers => {
        op.android = answers.device.indexOf("android") !== -1;
        op.ios = answers.device.indexOf("ios") !== -1;
        op.title = answers.title;
        op.desc = answers.desc;
        op.token = utils.getToken();
        let loading = ora('正在准备插件...').start();
        request(utils.apiUrl() + 'users/info?token=' + op.token, (err, res, body) => {
            loading.stop();
            let data = utils.jsonParse(body);
            if (data.ret === -1) {
                log.warn('请先登录后发布！');
                utils.login(() => {
                    op.token = utils.getToken();
                    compress(op);
                });
                return;
            }
            if (data.ret !== 1) {
                log.fatal(`验证身份失败：${data.msg}`);
            }
            compress(op);
        });
    }).catch(console.error);
}

/**
 * 开始压缩
 */
function compress(op) {
    let loading = ora('正在打包android插件...').start();
    extraCompress(op, 'android', (res, err) => {
        loading.stop();
        if (res === -1) {
            throw err;
        }
        //
        loading = ora('正在打包iOS插件...').start();
        extraCompress(op, 'ios', (res, err) => {
            loading.stop();
            if (res === -1) {
                throw err;
            }
            uploadFileZip(op);
        });
    });
}

/**
 * 开始上传
 * @param op
 */
function uploadFileZip(op) {
    op.androidfileinfo = [];
    op.iosfileinfo = [];
    let loading = ora('正在上传android插件...').start();
    request.post({
        url: utils.apiUrl() + 'plugins/lists',
        formData: {
            act: 'upload',
            token: op.token,
            zipfile: fs.createReadStream(op.androidZipPath),
        }
    }, (error, response, body) => {
        loading.stop();
        let data = utils.jsonParse(body);
        if (data.ret !== 1) {
            log.fatal(`上传android插件失败：${data.msg}`);
        }
        //
        loading = ora('正在上传iOS插件...').start();
        request.post({
            url: utils.apiUrl() + 'plugins/lists',
            formData: {
                act: 'upload',
                token: op.token,
                zipfile: fs.createReadStream(op.iosZipPath),
            }
        }, (error, response, body) => {
            loading.stop();
            let iosData = utils.jsonParse(body);
            if (iosData.ret !== 1) {
                log.fatal(`上传iOS插件失败：${iosData.msg}`);
            }
            op.androidfileinfo.push(data.data);
            op.iosfileinfo.push(iosData.data);
            launch(op);
        });
    });
}

/**
 * 开始发布
 * @param op
 */
function launch(op) {
    let loading = ora('开始发布插件...').start();
    request.post({
        url: utils.apiUrl() + 'plugins/lists',
        formData: {
            act: 'add',
            publish: 'cli',
            token: op.token,
            D: utils.jsonStringify(op)
        }
    }, (error, response, body) => {
        loading.stop();
        let iosData = utils.jsonParse(body);
        if (iosData.ret !== 1) {
            log.fatal(`发布插件失败：${iosData.msg}`);
        }
        log.eeuis('插件' + op.name + '发布成功！');
        log.eeui('开发者可通过 ' + chalk.white(`eeui plugin install ${op.name}`) + ' 命令添加此插件。');
        //
        fse.removeSync(op.androidZipPath);
        fse.removeSync(op.iosZipPath);
    });
}

/**
 * 压缩程序
 * @param op
 * @param type
 * @param callback
 */
function extraCompress(op, type, callback) {
    let count, lists, output, archive;
    if (type === 'android') {
        count = utils.count(op.androidPath);
        lists = utils.fileDirDisplay(op.androidPath);
        output = fs.createWriteStream(op.androidZipPath);
        archive = archiver('zip', null);
        for (let index in lists.dir) {
            let tmp = lists.dir[index];
            archive.directory(tmp, tmp.substr(count), null);
        }
        for (let index in lists.file) {
            let tmp = lists.file[index];
            archive.file(tmp, {name: tmp.substr(count)});
        }
        output.on('close', () => {
            typeof callback === 'function' && callback(archive.pointer(), null);
        });
        archive.on('error', (err) => {
            typeof callback === 'function' && callback(-1, err);
        });
        archive.pipe(output);
        archive.finalize();
    } else if (type === 'ios') {
        count = utils.count(op.iosPath);
        lists = utils.fileDirDisplay(op.iosPath);
        output = fs.createWriteStream(op.iosZipPath);
        archive = archiver('zip', null);
        for (let index in lists.dir) {
            let tmp = lists.dir[index];
            archive.directory(tmp, tmp.substr(count), null);
        }
        for (let index in lists.file) {
            let tmp = lists.file[index];
            archive.file(tmp, {name: tmp.substr(count)});
        }
        output.on('close', () => {
            typeof callback === 'function' && callback(archive.pointer(), null);
        });
        archive.on('error', (err) => {
            typeof callback === 'function' && callback(-1, err);
        });
        archive.pipe(output);
        archive.finalize();
    }
}

module.exports = {publish};
