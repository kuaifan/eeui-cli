const fs = require('fs');
const fse = require("fs-extra");
const path = require('path');
const ora = require('ora');
const tmp = require('tmp');
const decompress = require('decompress');
const request = require('request');
const logger = require('./logger');
const config = require("../../config");
const utils = require("./index");

function getInfo(id, callback) {
    let spinFetch = ora('正在获取资源地址...');
    spinFetch.start();
    request(utils.apiUrl() + 'tools/history/?id=' + id + '&token=' + utils.getToken(), function (err, res, body) {
        spinFetch.stop();
        let data = utils.jsonParse(body);
        if (data.ret === -1) {
            logger.warn(data.msg);
            utils.login(() => {
                getInfo(id, callback);
            });
            return;
        }
        if (data.ret !== 1) {
            logger.fatal(`获取插件失败：${data.msg}`);
        }
        callback(data.data)
    });
}

function download(res, callbakc) {
    let outputPath = path.resolve(config.toolsDir, 'icons/' + res.id);
    let downPath = tmp.tmpNameSync({dir: require('os').tmpdir()}) + ".zip";
    let file = fs.createWriteStream(downPath);
    file.on("close", () => {
        decompress(downPath, outputPath).then(() => {
            fs.unlinkSync(downPath);
            utils.removeRubbish(outputPath);
            callbakc(outputPath);
        }).catch((err) => {
            logger.fatal(`资源下载失败: ${err}！`);
        });
    }).on("error", (err) => {
        logger.fatal(`资源下载错误: ${err}！`);
    });
    //
    let receivedBytes = 0;
    let totalBytes = 0;
    let speedBytes = 0;
    let speedPer = "0B/S";
    let speedInt = setInterval(() => {
        speedPer = utils.renderSize(Math.max(0, receivedBytes - speedBytes)) + "/S";
        speedBytes = receivedBytes;
    }, 1000);
    let spinText = '正在下载资源...';
    let spinFetch = ora(spinText);
    spinFetch.start();
    //
    request.get(res.path).on("error", function (err) {
        logger.fatal(`资源下载失败: ${err}！`);
    }).on("response", function (res) {
        if (res.statusCode !== 200) {
            logger.fatal(`资源下载失败: Get zipUrl return a non-200 response！`);
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
    }).pipe(file);
}

function icons(id) {
    if (utils.runNum(id) <= 0) {
        logger.fatal("参数【" + id + "】错误！");
    }
    //
    let dir = path.resolve(path.join(config.toolsDir, 'icons'));
    utils.mkdirsSync(dir);
    getInfo(id, (res) => {
        if (res.type !== 'icons') {
            logger.fatal("资源【" + id + "】不是应用图标！");
        }
        download(res, (dir) => {
            let androidDir = path.join(dir, 'icons', 'android');
            let iosDir = path.join(dir, 'icons', 'ios');
            fse.removeSync(path.join(process.cwd(), 'platforms/ios/eeuiApp/eeuiApp/Assets.xcassets/AppIcon.appiconset'));
            fse.copySync(androidDir, path.join(process.cwd(), 'platforms/android/eeuiApp/app/src/main/res'));
            fse.copySync(iosDir, path.join(process.cwd(), 'platforms/ios/eeuiApp/eeuiApp/Assets.xcassets'));
            logger.success(`应用图片设置成功。`);
            logger.sep();
        });
    });
}

function launchimage(id) {
    if (utils.runNum(id) <= 0) {
        logger.fatal("参数【" + id + "】错误！");
    }
    //
    let dir = path.resolve(path.join(config.toolsDir, 'launchimage'));
    utils.mkdirsSync(dir);
    getInfo(id, (res) => {
        if (res.type !== 'launchimage') {
            logger.fatal("资源【" + id + "】不是启动图片！");
        }
        download(res, (dir) => {
            let androidDir = path.join(dir, 'LaunchImage', 'android');
            let iosDir = path.join(dir, 'LaunchImage', 'ios');
            fse.removeSync(path.join(process.cwd(), 'platforms/ios/eeuiApp/eeuiApp/Assets.xcassets/LaunchImage.launchimage'));
            fse.copySync(androidDir, path.join(process.cwd(), 'platforms/android/eeuiApp/app/src/main/res'));
            fse.copySync(iosDir, path.join(process.cwd(), 'platforms/ios/eeuiApp/eeuiApp/Assets.xcassets'));
            logger.success(`启动图片设置成功。`);
            logger.sep();
        });
    });
}

module.exports = {icons, launchimage};