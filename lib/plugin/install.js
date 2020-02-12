const fs = require('fs');
const fse = require("fs-extra");
const path = require('path');
const utils = require('../utils');
const logger = require('../utils/logger');
const inquirer = require('inquirer');
const rimraf = require('rimraf');
const shelljs = require('shelljs');
const ora = require('ora');
const decompress = require('decompress');
const tmp = require('tmp');
const request = require('request');

/**
 * 添加插件
 * @param op
 */
function add(op) {
    let outputPath = path.resolve(op.rootDir, 'plugins', op.name);
    if (fs.existsSync(outputPath)) {
        inquirer.prompt([{
            type: 'confirm',
            message: `已存在名为${op.name}的插件，是否覆盖安装？`,
            name: 'ok'
        }]).then(answers => {
            if (answers.ok) {
                rimraf(outputPath, () => {
                    logger.info('开始添加插件');
                    download(op)
                })
            } else {
                logger.fatalContinue(`放弃安装${op.name}！`);
                typeof op.callback === 'function' && op.callback(op);
            }
        }).catch(console.error);
    } else {
        logger.info('开始添加插件');
        download(op)
    }
}

/**
 * 移除插件（不删除目录）
 * @param op
 */
function remove(op) {
    changeSetting(op, false);
    changeGradle(op, false);
    cleanIdea(op);
    invokeAndroid(op, () => {
        changeProfile(op, false);
        invokeIos(op, () => {
            utils.pluginsJson(false, op);
            logger.eeuis('插件' + op.name + '移除完毕！');
            typeof op.callback === 'function' && op.callback(op);
            request(op.baseUrl + op.name + '?act=uninstall', () => {});
        });
    });
}

function download(op) {
    let outputPath = path.resolve(op.rootDir, 'plugins', op.name);
    let downPath = tmp.tmpNameSync({dir: require('os').tmpdir()}) + ".zip";
    let downUrl = null;
    let file = fs.createWriteStream(downPath);
    file.on("close", () => {
        decompress(downPath, outputPath).then(() => {
            fs.unlinkSync(downPath);
            utils.removeRubbish(outputPath);
            //
            let tempArray = fs.readdirSync(outputPath);
            if (utils.count(tempArray) === 1) {
                tempArray.forEach((tempName) => {
                    let tempDir = path.join(outputPath, tempName);
                    let stats = fs.statSync(tempDir);
                    if (stats.isDirectory()) {
                        fse.moveSync(tempDir, outputPath);
                    }
                });
            }
            //
            changeSetting(op, true);
            changeGradle(op, true);
            cleanIdea(op);
            invokeAndroid(op, () => {
                changeProfile(op, true);
                invokeIos(op, () => {
                    let configFile = path.resolve(outputPath, 'config.json');
                    let configInfo = utils.jsonParse(!fs.existsSync(configFile) ? {} : fs.readFileSync(configFile, 'utf8'));
                    op.requireName = configInfo.requireName;
                    op.url = downUrl;
                    utils.pluginsJson(true, op);
                    logger.eeuis('插件' + op.name + '添加成功!');
                    typeof op.callback === 'function' && op.callback(op);
                    request(op.baseUrl + op.name + '?act=install', () => {});
                });
            });
        })
    }).on("error", (err) => {
        logger.fatal(`插件${op.name}下载失败: ${err}！`);
    });
    //
    let startDownload = () => {
        let receivedBytes = 0;
        let totalBytes = 0;
        let speedBytes = 0;
        let speedPer = "0B/S";
        let speedInt = setInterval(() => {
            speedPer = utils.renderSize(Math.max(0, receivedBytes - speedBytes)) + "/S";
            speedBytes = receivedBytes;
        }, 1000);
        let spinText = '插件' + op.name + '正在下载...';
        let spinFetch = ora(spinText);
        spinFetch.start();
        request.get(downUrl).on("error", function (err) {
            logger.fatal(`插件${op.name}下载失败: ${err}！`);
        }).on("response", function (res) {
            if (res.statusCode !== 200) {
                logger.fatal(`插件${op.name}下载失败: Get zipUrl return a non-200 response！`);
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
            logger.info('插件' + op.name + '下载成功，开始添加...');
        }).pipe(file);
    };
    //
    if (utils.count(op.fileinfo) <= 0) {
        logger.fatal(`插件${op.name}没有下载地址！`);
    }
    if (utils.count(op.fileinfo) === 1 || op.simple === true) {
        downUrl = op.fileinfo[0]['path'];
        startDownload();
        return;
    }
    let lists = [];
    op.fileinfo.forEach(t => {
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
        message: `选择插件${op.name}版本：`,
        choices: lists
    }];
    inquirer.prompt(array).then(function(answers) {
        downUrl = answers.release;
        startDownload();
    });
}

function changeSetting(op, isInstall) {
    let gradleName = findGradleName(op);
    if (utils.count(gradleName) === 0) {
        return;
    }
    let tmpPath = path.resolve(op.rootDir, 'platforms/android/eeuiApp/settings.gradle');
    let result = fs.readFileSync(tmpPath, 'utf8');
    let temp = result.split('\n');
    if (new RegExp("include\\s*('|\"):" + utils.spritUpperCase(op.name) + "\\1", "g").test(temp[0])) {
        logger.fatal(utils.spritUpperCase(op.name) + '与项目同名，无法安装！');
    }
    let out = [];
    for (let t in temp) {
        if (temp.hasOwnProperty(t)) {
            if (temp[t].indexOf(`":${utils.spritUpperCase(op.name)}"`) === -1 && temp[t]) {
                if (temp[t].indexOf('include ') === 0) {
                    out.push('');
                }
                out.push(temp[t])
            }
        }
    }
    if (isInstall) {
        out.push('');
        out.push(`include ":${utils.spritUpperCase(op.name)}"`);
        out.push(`project (":${utils.spritUpperCase(op.name)}").projectDir = new File("../../../plugins/${op.name}/android")`);
    }
    let s = '';
    out.forEach((item) => {
        s += item + '\n'
    });
    fs.writeFileSync(tmpPath, s.replace(/^\n+|\n+$/g, ""), 'utf8')
}

function changeGradle(op, isInstall) {
    let gradleName = findGradleName(op);
    if (utils.count(gradleName) === 0) {
        return;
    }
    let tmpPath = path.resolve(op.rootDir, 'platforms/android/eeuiApp/app/build.gradle');
    let result = fs.readFileSync(tmpPath, 'utf8');
    let res = result.substr(result.indexOf('dependencies'), result.length);
    let temp = res.split('\n');
    let out = [];
    temp.forEach((item) => {
        if (!(item.indexOf('implementation') !== -1 &&
            (item.indexOf(`":${utils.spritUpperCase(op.name)}"`) !== -1))) {
            out.push(item)
        }
    });
    if (isInstall) {
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
        temp.splice(pos, 0, `    implementation project(":${utils.spritUpperCase(op.name)}")`);
        out = temp;
    }
    let string = '';
    out.forEach((item) => { string += item + '\n' });
    result = result.replace(res, string);
    fs.writeFileSync(tmpPath, result.replace(/^\n+|\n+$/g, ""), 'utf8');
}

function cleanIdea(op) {
    let eeuiPath = path.resolve(op.rootDir, 'platforms/android/eeuiApp');
    let ideGradlePath = path.resolve(eeuiPath, '.idea/gradle.xml');
    if (fs.existsSync(ideGradlePath)) {
        let ideGradleResult = fs.readFileSync(ideGradlePath, 'utf8');
        let ideGradleRege = new RegExp("<option value=\"(.*?)/plugins/" + op.name + "/android\"+\\s*/>", "g");
        ideGradleResult = ideGradleResult.replace(ideGradleRege, "");
        fs.writeFileSync(ideGradlePath, ideGradleResult, 'utf8');
    }
    //
    let ideModulesPath = path.resolve(eeuiPath, '.idea/modules.xml');
    if (fs.existsSync(ideModulesPath)) {
        let ideModulesResult = fs.readFileSync(ideModulesPath, 'utf8');
        let ideModulesRege = new RegExp("<module fileurl=\"(.*?)/plugins/" + op.name + "/android/(.*?).iml\" filepath=\"(.*?)/plugins/" + op.name + "/android/(.*?).iml\"+\\s*/>", "g");
        ideModulesResult = ideModulesResult.replace(ideModulesRege, "");
        fs.writeFileSync(ideModulesPath, ideModulesResult, 'utf8');
    }
}

function changeProfile(op, isInstall) {
    let xcodeprojName = findXcodeprojName(op);
    if (utils.count(xcodeprojName) === 0) {
        return;
    }
    let eeuiPath = path.resolve(op.rootDir, 'platforms/ios/eeuiApp');
    let podPath = path.resolve(eeuiPath, 'Podfile');
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
            if (item.indexOf('\'' + xcodeprojName + '\'') === -1) {
                out.push(item)
            }
        } else {
            weg.push(item)
        }
    });
    if (isInstall) {
        out.push('    pod \'' + xcodeprojName + '\', :path => \'../../../plugins/' + op.name + '/ios\'');
    }
    weg.forEach((item) => {
        out.push(item)
    });
    let px = '';
    out.forEach((item) => {
        px += item + '\n'
    });
    fs.writeFileSync(podPath, px.replace(/^\n+|\n+$/g, ""), 'utf8');
}

function invokeAndroid(op, callback) {
    if (op.simple === true) {
        typeof callback === 'function' && callback();
        return;
    }
    let eeuiPath = path.resolve(op.rootDir, 'platforms/android/eeuiApp');
    let tempPath = process.cwd();
    let spinPod = ora('gradlew clean...');
    spinPod.start();
    try {
        shelljs.cd(eeuiPath);
        shelljs.exec('./gradlew clean', {silent: true}, () => {
            shelljs.cd(tempPath);
            spinPod.stop();
            typeof callback === 'function' && callback();
        });
    } catch (e) {
        shelljs.cd(tempPath);
        spinPod.stop();
        typeof callback === 'function' && callback();
    }
}

function invokeIos(op, callback) {
    if (op.simple === true) {
        typeof callback === 'function' && callback();
        return;
    }
    if (!shelljs.which('pod')) {
        if (!isWin) {
            logger.info('未检测到系统安装CocoaPods，请安装后手动执行pod install！');
        }
        typeof callback === 'function' && callback();
        return;
    }
    let eeuiPath = path.resolve(op.rootDir, 'platforms/ios/eeuiApp');
    let tempPath = process.cwd();
    let spinPod = ora('pod install...');
    spinPod.start();
    try {
        shelljs.cd(eeuiPath);
        shelljs.exec('pod install', {silent: true}, () => {
            shelljs.cd(tempPath);
            spinPod.stop();
            typeof callback === 'function' && callback();
        });
    } catch (e) {
        shelljs.cd(tempPath);
        spinPod.stop();
        typeof callback === 'function' && callback();
    }
}

function findXcodeprojName(op) {
    let dirPath = path.resolve(op.rootDir, 'plugins', op.name, 'ios');
    if (!fs.existsSync(dirPath)) {
        return "";
    }
    let files = fs.readdirSync(dirPath);
    let name = "";
    files.some((filename) => {
        let stats = fs.statSync(path.join(dirPath, filename));
        if (stats.isDirectory()) {
            if (utils.rightExists(filename, ".xcodeproj")) {
                name = utils.rightDelete(filename, ".xcodeproj");
                return true;
            }
        }
    });
    return name;
}

function findGradleName(op) {
    let dirPath = path.resolve(op.rootDir, 'plugins', op.name, 'android');
    if (!fs.existsSync(dirPath)) {
        return "";
    }
    let files = fs.readdirSync(dirPath);
    let name = "";
    files.some((filename) => {
        let stats = fs.statSync(path.join(dirPath, filename));
        if (stats.isFile()) {
            if (utils.rightExists(filename, ".gradle")) {
                name = utils.rightDelete(filename, ".gradle");
                return true;
            }
        }
    });
    return name;
}

module.exports = {add, remove, changeSetting, changeGradle, cleanIdea, changeProfile, invokeAndroid, invokeIos};




