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
const dirCut = /^win/.test(process.platform) ? "\\" : "/";

function add(op) {
    let path = op.rootDir + dirCut + 'plugins' + dirCut + 'android' + dirCut + op.name;
    if (checkModuleExist(op)) {
        inquirer.prompt([{
            type: 'confirm',
            message: `android端已存在名为${op.name}的插件，是否覆盖安装？`,
            name: 'ok'
        }]).then(answers => {
            if (answers.ok) {
                rimraf(path, () => {
                    log.info('开始添加android端插件');
                    download(op)
                })
            } else {
                log.fatalContinue(`android端放弃安装${op.name}！`);
                typeof op.callback === 'function' && op.callback(op);
            }
        }).catch(console.error);
    } else {
        log.info('开始添加android端插件');
        download(op)
    }
}

function remove(op) {
    changeSetting(op, false);
    changeGradle(op, false);
    invokeScript(op, false, () => {
        removePorject(op);
    });
}

function removePorject(op) {
    let path = op.rootDir + dirCut + 'plugins' + dirCut + 'android' + dirCut + op.name;
    rimraf(path, () => {
        log.info('插件' + op.name + ' android端清理完成!');
        log.eeuis('android端插件移除完毕！');
        typeof op.delCallback === 'function' && op.delCallback();
        request(op.baseUrl + op.name + '?act=uninstall&platform=android');
        utils.pluginsJson(false, "android", op.name, op.rootDir);
    });
}

function download(op) {
    let outputPath = op.rootDir + dirCut + 'plugins' + dirCut + 'android' + dirCut + op.name;
    //
    let downPath = tmp.tmpNameSync({dir: require('os').tmpdir()}) + ".zip";
    let file = fs.createWriteStream(downPath);
    file.on("close", () => {
        decompress(downPath, outputPath).then(() => {
            fs.unlinkSync(downPath);
            utils.removeRubbish(outputPath);
            addSetting(op);
            addGradle(op);
            invokeScript(op, true, (exec) => {
                log.eeuis('插件' + op.name + ' android端添加' + (exec ? '完成' : '成功') + '!');
                typeof op.callback === 'function' && op.callback(op);
                request(op.baseUrl + op.name + '?act=install&platform=android');
                utils.pluginsJson(true, "android", op.name, op.rootDir);
            });
        })
    }).on("error", (err) => {
        log.fatal(`插件${op.name} android端下载失败: ${err}！`);
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
        let spinText = '插件' + op.name + ' android端正在下载...';
        let spinFetch = ora(spinText);
        spinFetch.start();
        request.get(downUrl).on("error", function (err) {
            log.fatal(`插件${op.name} android端下载失败: ${err}！`);
        }).on("response", function (res) {
            if (res.statusCode !== 200) {
                log.fatal(`插件${op.name} android端下载失败: Get zipUrl return a non-200 response！`);
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
            log.info('插件' + op.name + ' android端下载完毕，开始安装！');
        }).pipe(file);
    };
    //
    if (utils.count(op.android_lists) <= 1 || op.simple === true) {
        startDownload(op.android_url);
        return;
    }
    let lists = [];
    op.android_lists.forEach(t => {
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
        message: `选择插件${op.name} android端版本：`,
        choices: lists
    }];
    inquirer.prompt(array).then(function(answers) {
        startDownload(answers.release);
    });
}

function checkModuleExist(op) {
    let path = op.rootDir + dirCut + 'plugins' + dirCut + 'android' + dirCut + op.name;
    return fs.existsSync(path)
}

function addGradle(op) {
    changeGradle(op, true)
}

function addSetting(op) {
    changeSetting(op, true)
}

function changeSetting(op, add) {
    let path = op.rootDir + dirCut + 'platforms' + dirCut + 'android' + dirCut + 'eeuiApp' + dirCut + 'settings.gradle';
    let result = fs.readFileSync(path, 'utf8');
    let temp = result.split('\n');
    if (temp[0].indexOf("eeui_" + op.name) !== -1) {
        log.fatal('项目下存在同名module，请先删除!');
        return
    }
    let out = [];
    for (let t in temp) {
        if (temp.hasOwnProperty(t)) {
            if (temp[t].indexOf('":eeui_' + op.name + '"') === -1) {
                out.push(temp[t])
            }
        }
    }
    if (add) {
        out.push('');
        out.push('include ":eeui_' + op.name + '"');
        out.push('project (":eeui_' + op.name + '").projectDir = new File("../../../plugins/android/' + op.name + '")');
    }
    let s = '';
    out.forEach((item) => {
        s += item + '\n'
    });
    fs.writeFileSync(path, s.replace(/^\n+|\n+$/g, ""), {encode: 'utf-8'})
}

function changeGradle(op, add) {
    let path = op.rootDir + dirCut + 'platforms' + dirCut + 'android' + dirCut + 'eeuiApp' + dirCut + 'app' + dirCut + 'build.gradle';
    let result = fs.readFileSync(path, 'utf8');
    let res = result.substr(result.indexOf('dependencies'), result.length);
    let temp = res.split('\n');
    let out = [];
    temp.forEach((item) => {
        if (!(item.indexOf('implementation') !== -1 &&
            (item.indexOf('":eeui_' + op.name + '"') !== -1 || item.indexOf("':eeui_" + op.name + "'") !== -1))) {
            out.push(item)
        }
    });
    if (add) {
        let temp = [];
        let pos = 0;
        let i = 0;
        out.forEach((item) => {
            i++;
            temp.push(item);
            if (item.indexOf("implementation") !== -1) {
                pos = i;
            }
        });
        temp.splice(pos, 0, '    implementation project(":eeui_' + op.name + '")');
        out = temp;
    }
    let string = '';
    out.forEach((item) => { string += item + '\n' });
    result = result.replace(res, string);
    fs.writeFileSync(path, result.replace(/^\n+|\n+$/g, ""), {encode: 'utf-8'});
}

function invokeScript(op, isInstall, callback) {
    let eeuiPath = op.rootDir + dirCut + 'platforms' + dirCut + 'android' + dirCut + 'eeuiApp' + dirCut;
    //
    let ideGradlePath = eeuiPath + '.idea' + dirCut + 'gradle.xml';
    let ideGradleResult = fs.readFileSync(ideGradlePath, 'utf8');
    let ideGradleRege = new RegExp("<option value=\"(.*?)/plugins/android/" + op.name + "\"+\\s*/>", "g");
    ideGradleResult = ideGradleResult.replace(ideGradleRege, "");
    fs.writeFileSync(ideGradlePath, ideGradleResult, {encode: 'utf-8'});
    //
    let ideModulesPath = eeuiPath + '.idea' + dirCut + 'modules.xml';
    let ideModulesResult = fs.readFileSync(ideModulesPath, 'utf8');
    let ideModulesRege = new RegExp("<module fileurl=\"(.*?)/plugins/android/" + op.name + "/(.*?).iml\" filepath=\"(.*?)/plugins/android/" + op.name + "/(.*?).iml\"+\\s*/>", "g");
    ideModulesResult = ideModulesResult.replace(ideModulesRege, "");
    fs.writeFileSync(ideModulesPath, ideModulesResult, {encode: 'utf-8'});
    //
    let nextFunc = (res) => {
        if (op.simple === true) {
            typeof callback === 'function' && callback(res);
        } else {
            let spinPod = ora('开始执行gradlew clean...');
            spinPod.start();
            try {
                shelljs.cd(eeuiPath);
                shelljs.exec('./gradlew clean', {silent: true}, () => {
                    spinPod.stop();
                    typeof callback === 'function' && callback(res);
                });
            } catch (e) {
                spinPod.stop();
                typeof callback === 'function' && callback(res);
            }
        }
    };
    let path = op.rootDir + dirCut + 'plugins' + dirCut + 'android' + dirCut + op.name;
    let jsPath = '';
    if (isInstall) {
        jsPath = path + dirCut + '.eeuiScript' + dirCut + 'install.js';
    } else {
        jsPath = path + dirCut + '.eeuiScript' + dirCut + 'uninstall.js'
    }
    if (!fs.existsSync(jsPath)) {
        nextFunc(false);
    } else {
        utils.exec('node ' + jsPath).then(() => {
            nextFunc(true);
        });
    }
}

module.exports = {add, checkModuleExist, addSetting, addGradle, changeSetting, changeGradle, download, remove, invokeScript};




