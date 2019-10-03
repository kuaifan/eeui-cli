const fs = require('fs');
const fse = require("fs-extra");
const path = require('path');
const inquirer = require('inquirer');
const archiver = require("archiver");
const unzip2 = require("unzip2");
const lodash = require("lodash");
const utils = require('../utils');
const config = require('../../config');
const log = require('../utils/logger');

const backupMethod = {
    backup(callback) {
        let startBack = () => {
            let backupPath = path.resolve(config.backupDir);
            utils.mkdirsSync(backupPath);
            let zipPath = backupPath + "/" + utils.formatDate("YmdHis") + ".zip";
            let output = fs.createWriteStream(zipPath);
            let count = utils.count(process.cwd());
            let archive = archiver('zip', null);
            //备份文件
            let dirName = "eeuiApp";
            let dirLists = [
                "/src",

                "/platforms/android/" + dirName + "/app/src/main/res/mipmap-hdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/mipmap-ldpi",
                "/platforms/android/" + dirName + "/app/src/main/res/mipmap-mdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/mipmap-xhdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/mipmap-xxhdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/mipmap-xxxhdpi",

                "/platforms/android/" + dirName + "/app/src/main/res/drawable",
                "/platforms/android/" + dirName + "/app/src/main/res/drawable-land-hdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/drawable-land-ldpi",
                "/platforms/android/" + dirName + "/app/src/main/res/drawable-land-mdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/drawable-land-xhdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/drawable-land-xxhdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/drawable-land-xxxhdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/drawable-port-hdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/drawable-port-ldpi",
                "/platforms/android/" + dirName + "/app/src/main/res/drawable-port-mdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/drawable-port-xhdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/drawable-port-xxhdpi",
                "/platforms/android/" + dirName + "/app/src/main/res/drawable-port-xxxhdpi",

                "/platforms/ios/" + dirName + "/" + dirName + "/Assets.xcassets/AppIcon.appiconset",
                "/platforms/ios/" + dirName + "/" + dirName + "/Assets.xcassets/LaunchImage.launchimage",

            ];
            for (let i = 0; i < dirLists.length; i++) {
                let lists = utils.fileDirDisplay(process.cwd() + dirLists[i]);
                for (let index in lists.dir) {
                    if (!lists.dir.hasOwnProperty(index)) continue;
                    let tmp = lists.dir[index];
                    let saveName = tmp.substr(count).replace(new RegExp(dirName, "g"), "eeuiApp");
                    archive.directory(tmp, saveName, null);
                }
                for (let index in lists.file) {
                    if (!lists.file.hasOwnProperty(index)) continue;
                    let tmp = lists.file[index];
                    let saveName = tmp.substr(count).replace(new RegExp(dirName, "g"), "eeuiApp");
                    archive.file(tmp, {name: saveName});
                }
            }
            archive.file(process.cwd() + "/eeui.config.js", {name: "eeui.config.bak"});
            //完成备份
            output.on('close', () => {
                if (typeof callback === "function") {
                    callback(true, zipPath);
                }else{
                    log.eeuis(`备份成功：${zipPath}`);
                }
            });
            archive.on('error', (err) => {
                if (typeof callback === "function") {
                    callback(false, err);
                }else{
                    log.fatal(`备份失败：${err}`);
                }
            });
            archive.pipe(output);
            archive.finalize();
        };
        if (typeof callback === "function") {
            startBack();
        } else {
            inquirer.prompt([{
                type: 'confirm',
                message: `确定备份项目开发文件吗？（含：页面、图标、启动页、eeui.config.js）`,
                name: 'ok',
            }]).then(answers => {
                if (answers.ok) {
                    startBack();
                } else {
                    log.fatal(`放弃备份！`);
                }
            }).catch(console.error);
        }
    },

    recovery() {
        let backupPath = path.resolve(config.backupDir);
        utils.mkdirsSync(backupPath);
        let count = utils.count(backupPath);
        let lists = utils.fileDirDisplay(backupPath, true);
        let choices = [];
        for (let index in lists.file) {
            if (!lists.file.hasOwnProperty(index)) continue;
            let tmp = lists.file[index];
            choices.push(tmp.substr(count + 1));
        }
        if (choices.length === 0) {
            log.fatal(`未找到备份文件！`);
        }
        let array = [{
            type: 'list',
            name: 'bakname',
            message: `请选择要恢复的备份文件：`,
            choices: choices.reverse()
        }];
        inquirer.prompt(array).then(function(answers) {
            inquirer.prompt([{
                type: 'confirm',
                message: `您确定恢复备份文件 ${answers.bakname} 吗？（注意：恢复备份可能会覆盖现有的文件）`,
                name: 'ok',
            }]).then(confirm => {
                if (confirm.ok) {
                    let zipFile = backupPath + "/" + answers.bakname;
                    if (!fs.existsSync(zipFile)) {
                        log.fatal(`恢复失败：备份文件 ${answers.bakname} 不存在！`);
                    }
                    backupMethod.recoveryHandler(zipFile, (res, msg) => {
                        if (res) {
                            log.eeuis(`恢复成功：${answers.bakname}`);
                        }else{
                            log.fatal(`恢复失败：${answers.bakname}！`);
                        }
                    });
                }
            }).catch(console.error);
        });
    },

    recoveryHandler(zipFile, callback) {
        fs.createReadStream(zipFile).pipe(unzip2.Extract({path: process.cwd()})).on('error', (err) => {
            callback(false, err)
        }).on('finish', () => {
            let configPath = process.cwd() + '/eeui.config.js';
            let configBakPath = process.cwd() + '/eeui.config.bak';
            let intervalNum = 0;
            let intervalEvent = setInterval(() => {
                intervalNum++;
                if (intervalNum > 10) {
                    clearInterval(intervalEvent);
                }
                if (fs.existsSync(configBakPath)) {
                    clearInterval(intervalEvent);
                    let config = lodash.merge(require(configPath), require(configBakPath));
                    if (config !== null && typeof config === 'object' && typeof config.appKey !== 'undefined') {
                        let content = '';
                        content += "/**\n * 配置文件\n * 参数详细说明：https://eeui.app/guide/config.html\n */\n";
                        content += "module.exports = ";
                        content += JSON.stringify(config, null, "\t");
                        content += ";";
                        fs.writeFileSync(configPath, content, 'utf8');
                    }
                    fse.removeSync(configBakPath);
                }
                callback(true, null);
            }, 200);
        });
    },
};

module.exports = backupMethod;
