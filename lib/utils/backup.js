const fs = require('fs');
const fse = require("fs-extra");
const path = require('path');
const inquirer = require('inquirer');
const archiver = require("archiver");
const unzipper = require("unzipper");
const utils = require('../utils');
const config = require('../../config');
const log = require('../utils/logger');

const backupMethod = {
    backDirs() {
        return [
            "src",

            "platforms/android/eeuiApp/app/src/main/assets/eeui",
            "platforms/ios/eeuiApp/bundlejs/eeui",

            "platforms/android/eeuiApp/app/src/main/res/mipmap-hdpi",
            "platforms/android/eeuiApp/app/src/main/res/mipmap-ldpi",
            "platforms/android/eeuiApp/app/src/main/res/mipmap-mdpi",
            "platforms/android/eeuiApp/app/src/main/res/mipmap-xhdpi",
            "platforms/android/eeuiApp/app/src/main/res/mipmap-xxhdpi",
            "platforms/android/eeuiApp/app/src/main/res/mipmap-xxxhdpi",

            "platforms/android/eeuiApp/app/src/main/res/drawable",
            "platforms/android/eeuiApp/app/src/main/res/drawable-land-hdpi",
            "platforms/android/eeuiApp/app/src/main/res/drawable-land-ldpi",
            "platforms/android/eeuiApp/app/src/main/res/drawable-land-mdpi",
            "platforms/android/eeuiApp/app/src/main/res/drawable-land-xhdpi",
            "platforms/android/eeuiApp/app/src/main/res/drawable-land-xxhdpi",
            "platforms/android/eeuiApp/app/src/main/res/drawable-land-xxxhdpi",
            "platforms/android/eeuiApp/app/src/main/res/drawable-port-hdpi",
            "platforms/android/eeuiApp/app/src/main/res/drawable-port-ldpi",
            "platforms/android/eeuiApp/app/src/main/res/drawable-port-mdpi",
            "platforms/android/eeuiApp/app/src/main/res/drawable-port-xhdpi",
            "platforms/android/eeuiApp/app/src/main/res/drawable-port-xxhdpi",
            "platforms/android/eeuiApp/app/src/main/res/drawable-port-xxxhdpi",

            "platforms/android/eeuiApp/android.jks",
            "platforms/android/eeuiApp/gradle.properties",
            "platforms/ios/eeuiApp/eeuiApp/Info.plist",

            "platforms/ios/eeuiApp/eeuiApp/Assets.xcassets/AppIcon.appiconset",
            "platforms/ios/eeuiApp/eeuiApp/Assets.xcassets/LaunchImage.launchimage",
        ];
    },

    backup(callback) {
        let startBack = () => {
            let backupPath = path.resolve(config.backupDir);
            utils.mkdirsSync(backupPath);
            let zipPath = path.join(backupPath, utils.formatDate("YmdHis") + ".zip");
            let output = fs.createWriteStream(zipPath);
            let count = utils.count(process.cwd());
            let archive = archiver('zip', null);
            //备份文件
            let dirLists = this.backDirs();
            for (let i = 0; i < dirLists.length; i++) {
                let lists = utils.fileDirDisplay(path.join(process.cwd(), dirLists[i]));
                for (let index in lists.dir) {
                    if (!lists.dir.hasOwnProperty(index)) continue;
                    let tmp = lists.dir[index];
                    let saveName = tmp.substr(count);
                    archive.directory(tmp, saveName, null);
                }
                for (let index in lists.file) {
                    if (!lists.file.hasOwnProperty(index)) continue;
                    let tmp = lists.file[index];
                    let saveName = tmp.substr(count);
                    archive.file(tmp, {name: saveName});
                }
            }
            archive.file(path.join(process.cwd(), "eeui.config.js"), {name: "eeui.config.js"});
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
                message: `您确定恢复备份文件 ${answers.bakname} 吗？（注意：此操作不可撤销）`,
                name: 'ok',
            }]).then(confirm => {
                if (confirm.ok) {
                    let zipFile = path.join(backupPath, answers.bakname);
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
        let dirLists = this.backDirs();
        dirLists.forEach((dir) => {
            fse.removeSync(path.join(process.cwd(), dir));
        });
        //
        fs.createReadStream(zipFile).pipe(unzipper.Extract({path: process.cwd()})).on('error', (err) => {
            callback(false, err)
        }).on('finish', () => {
            callback(true, null);
        });
    },

    updateMainFrame(releasePath, projectPath) {
        let dirLists = [
            'platforms/android',
            'platforms/ios',
            'plugins/android/eeui',
            'plugins/ios/eeui',
            'plugins/ios/WeexSDK',
        ];
        let fileLists = [
            "platforms/android/eeuiApp/local.properties",
        ];
        let fileContent = [];
        //
        try {
            fileLists.forEach((file) => {
                let projectFile = path.join(projectPath, file);
                if (fs.existsSync(projectFile)) {
                    fileContent.push({
                        "file": projectFile,
                        "content": fs.readFileSync(projectFile, 'utf8')
                    })
                }
            });
            dirLists.forEach((dir) => {
                let releaseDir = path.join(releasePath, dir);
                let projectDir = path.join(projectPath, dir);
                fse.removeSync(projectDir);
                fse.copySync(releaseDir, projectDir);
            });
            fileContent.forEach((item) => {
                utils.mkdirsSync(path.dirname(item.file));
                fs.writeFileSync(item.file, item.content, 'utf8');
            });
        } catch (err) {
            log.fatal(`升级新版本文件失败：${err}`);
        }
    },
};

module.exports = backupMethod;
