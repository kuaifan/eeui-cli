const android = require('./android');
const ios = require('./ios');
const log = require('../utils/logger');
const utils = require('../utils');
const ora = require('ora');
const inquirer = require('inquirer');
const request = require('request');
const dirCut = /^win/.test(process.platform) ? "\\" : "/";

function add(op) {
    op.baseUrl = utils.apiUrl() + 'plugin/';
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
    let nextCallback = () => {
        if (op.__nameAlso !== "") {
            op.name = op.__nameAlso;
            add(op);
        }
    };
    //
    getInfo(op, (res) => {
        switch (op.platform) {
            case 'all':
                if (res.ios_url !== '' && res.android_url !== '') {
                    op.callback = () => {
                        if (res.ios_url !== '') {
                            op.callbackIos = () => { nextCallback() };
                            ios.add(op)
                        } else {
                            nextCallback();
                        }
                    };
                    android.add(op)
                } else {
                    if (res.ios_url !== '') {
                        log.info('只检测到iOS端插件，开始安装！');
                        op.callbackIos = () => { nextCallback() };
                        ios.add(op)
                    }
                    if (res.android_url !== '') {
                        log.info('只检测到android端插件，开始安装！');
                        op.callback = () => { nextCallback() };
                        android.add(op)
                    }
                }
                break;

            case 'android':
                if (res.android_url !== '') {
                    op.callback = () => { nextCallback() };
                    android.add(op)
                } else {
                    log.fatal('未检测到android端插件，无法安装！')
                }
                break;

            case 'ios':
                if (res.ios_url !== '') {
                    op.callbackIos = () => { nextCallback() };
                    ios.add(op)
                } else {
                    log.fatal('未检测到iOS端插件，无法安装！')
                }
                break;
        }
    });
}

function remove(op) {
    op.baseUrl = utils.apiUrl() + 'plugin/';
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
    let nextCallback = () => {
        if (op.__nameAlso !== "") {
            op.name = op.__nameAlso;
            remove(op);
        }
    };
    //
    let func = () =>{
        switch (op.platform) {
            case 'all':
                op.delCallback = () => {
                    op.delCallbackIos = () => { nextCallback() };
                    ios.remove(op);
                };
                android.remove(op);
                break;

            case 'android':
                op.delCallback = () => { nextCallback() };
                android.remove(op);
                break;

            case 'ios':
                op.delCallbackIos = () => { nextCallback() };
                ios.remove(op);
                break;
        }
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
                log.fatal(`放弃删除${op.name}！`);
            }
        }).catch(console.error);
    }
}

function getInfo(op, callback) {
    let spinFetch = ora('正在获取插件详情...');
    spinFetch.start();
    request(utils.apiUrl() + 'plugin/' + op.name, function (err, res, body) {
        spinFetch.stop();
        let data = utils.jsonParse(body);
        if (data.ret !== 1) {
            log.fatal(`获取插件失败：${data.msg}`);
        }
        let out = Object.assign(op, data.data);
        callback(out)
    });
}

module.exports = {add, remove};
