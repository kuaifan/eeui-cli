const fs = require('fs');
const utils = require('../utils');
const log = require('../utils/logger');
const inquirer = require('inquirer');
const rimraf = require('rimraf');
const shelljs = require('shelljs');
const ora = require('ora');
const decompress = require('decompress');
const tmp = require('tmp');
const request = require('request');
const isWin = /^win/.test(process.platform);
const dirCut = isWin ? "\\" : "/";

function add(op) {
    let path = op.rootDir + dirCut + 'plugins' + dirCut + 'ios' + dirCut;
    utils.mkdirsSync(path);
    path += op.name;
    if (checkModuleExist(op)) {
        inquirer.prompt([{
            type: 'confirm',
            message: `iOS端已存在名为${op.name}的插件，是否覆盖安装？`,
            name: 'ok'
        }]).then(answers => {
            if (answers.ok) {
                rimraf(path, () => {
                    log.info('开始添加iOS端插件');
                    op.isCover = true;
                    download(op)
                })
            } else {
                log.fatalContinue(`iOS端放弃安装${op.name}！`);
                typeof op.callbackIos === 'function' && op.callbackIos(op);
            }
        }).catch(console.error);
    } else {
        log.info('开始添加iOS端插件');
        download(op)
    }
}

function checkModuleExist(op) {
    let path = op.rootDir + dirCut + 'plugins' + dirCut + 'ios' + dirCut + op.name;
    return fs.existsSync(path)
}

function remove(op) {
    op.changeCallback = () => {
        invokeScript(op, false, () => {
            removePorject(op)
        });
    };
    changeProfile(op, false);
}

function removePorject(op) {
    let path = op.rootDir + dirCut + 'plugins' + dirCut + 'ios' + dirCut + op.name;
    rimraf(path, () => {
        utils.pluginsJson(false, "ios", op.name, op.rootDir);
        log.eeuis('iOS端插件移除完毕！');
        typeof op.delCallbackIos === 'function' && op.delCallbackIos();
        request(op.baseUrl + op.name + '?act=uninstall&platform=ios');
    })
}

function download(op) {
    let outputPath = op.rootDir + dirCut + 'plugins' + dirCut + 'ios' + dirCut + op.name;
    //
    let downPath = tmp.tmpNameSync({dir: require('os').tmpdir()}) + ".zip";
    let file = fs.createWriteStream(downPath);
    file.on("close", () => {
        decompress(downPath, outputPath).then(() => {
            fs.unlinkSync(downPath);
            utils.removeRubbish(outputPath);
            invokeScript(op, true, () => {
                utils.pluginsJson(true, "ios", op.name, op.rootDir);
                op.changeCallback = () => {
                    typeof op.callbackIos === 'function' && op.callbackIos(op);
                };
                changeProfile(op, true);
                request(op.baseUrl + op.name + '?act=install&platform=ios');
            });
        })
    }).on("error", (err) => {
        log.fatal(`插件${op.name} iOS端下载失败: ${err}！`);
    });
    //
    let startDownload = (downUrl) => {
        let receivedBytes = 0;
        let totalBytes = 0;
        let speedBytes = 0;
        let speedPer = "0B/S";
        let speedInt = setInterval(() => {
            speedPer = utils.renderSize(Math.max(0, receivedBytes - speedBytes)) + "/S";
            speedBytes = receivedBytes;
        }, 1000);
        let spinText = '插件' + op.name + ' iOS端正在下载...';
        let spinFetch = ora(spinText);
        spinFetch.start();
        request.get(downUrl).on("error", function (err) {
            log.fatal(`插件${op.name} iOS端下载失败: ${err}！`);
        }).on("response", function (res) {
            if (res.statusCode !== 200) {
                log.fatal(`插件${op.name} iOS端下载失败: Get zipUrl return a non-200 response！`);
            }
            totalBytes = parseInt(res.headers['content-length'], 10);
            if (isNaN(totalBytes)) totalBytes = 0;
        }).on('data', (chunk) => {
            receivedBytes += chunk.length;
            let progress = "0%";
            if (totalBytes > 0) {
                progress = parseFloat(Math.max(0, receivedBytes / totalBytes * 100).toFixed(2)) + "%";
            } else {
                progress = utils.renderSize(receivedBytes);
            }
            spinFetch.text = spinText + `(${progress}, ${speedPer})`;
        }).on("end", function () {
            clearInterval(speedInt);
            spinFetch.stop();
            log.info('插件' + op.name + ' iOS端下载完毕，开始安装！');
        }).pipe(file);
    };
    //
    if (utils.count(op.ios_lists) <= 1 || op.simple === true) {
        startDownload(op.ios_url);
        return;
    }
    let lists = [];
    op.ios_lists.forEach(t => {
        let name = t.name;
        if (name.substr(-4, 4) === '.zip') name = name.substr(0, name.length - 4);
        lists.push({
            name: (lists.length + 1) + ". " + name + (t.desc ? " (" + t.desc + ")" : ""),
            value: t.path
        });
    });
    let array = [{
        type: 'list',
        name: 'release',
        message: `选择插件${op.name} iOS端版本：`,
        choices: lists
    }];
    inquirer.prompt(array).then(function(answers) {
        startDownload(answers.release);
    });

}

function changeProfile(op, add) {
    let eeuiPath = op.rootDir + dirCut + 'platforms' + dirCut + 'ios' + dirCut + 'eeuiApp' + dirCut;
    let podPath = eeuiPath + 'Podfile';
    let result = fs.readFileSync(podPath, 'utf8');
    let temp = result.split('\n');
    let out = [];
    let weg = [];
    let hasEnd = false;
    temp.forEach((item) => {
        if (item.trim() === 'end') {
            hasEnd = true
        }
        if (!hasEnd) {
            if (item.indexOf('\'' + op.name + '\'') === -1) {
                out.push(item)
            }
        } else {
            weg.push(item)
        }
    });
    if (add) {
        out.push('    pod \'' + op.name + '\', :path => \'../../../plugins/ios/' + op.name + '\'');
    }
    weg.forEach((item) => {
        out.push(item)
    });
    let px = '';
    out.forEach((item) => {
        px += item + '\n'
    });
    fs.writeFileSync(podPath, px.replace(/^\n+|\n+$/g, ""), {encode: 'utf-8'});
    if (op.simple === true) {
        if (add) {
            log.eeuis('插件' + op.name + ' iOS端添加完成!');
        } else {
            log.info('插件' + op.name + ' iOS端清理完成!')
        }
        typeof op.changeCallback === 'function' && op.changeCallback();
    }else if (shelljs.which('pod')) {
        let spinPod = ora('pod install...');
        spinPod.start();
        shelljs.cd(eeuiPath);
        shelljs.exec('pod install', {silent: true}, function(){
            spinPod.stop();
            if (add) {
                log.eeuis('插件' + op.name + ' iOS端添加完成!');
            } else {
                log.info('插件' + op.name + ' iOS端清理完成!')
            }
            typeof op.changeCallback === 'function' && op.changeCallback();
        });
    }else{
        if (add) {
            log.eeuis('插件' + op.name + ' iOS端添加完成!');
        } else {
            log.info('插件' + op.name + ' iOS端清理完成!')
        }
        if (!isWin) {
            log.info('未检测到系统安装pod，请安装pod后手动执行pod install！');
        }
        typeof op.changeCallback === 'function' && op.changeCallback();
    }
}

function invokeScript(op, isInstall, callback) {
    let path = op.rootDir + dirCut + 'plugins' + dirCut + 'ios' + dirCut + op.name;
    let jsPath = '';
    if (isInstall) {
        jsPath = path + dirCut + '.eeuiScript' + dirCut + 'install.js';
    }else{
        jsPath = path + dirCut + '.eeuiScript' + dirCut + 'uninstall.js'
    }
    if (!fs.existsSync(jsPath)) {
        typeof callback === 'function' && callback(false);
    }else{
        utils.exec('node ' + jsPath).then(() => {
            typeof callback === 'function' && callback(true);
        });
    }
}

module.exports = {add, remove, invokeScript, changeProfile};
