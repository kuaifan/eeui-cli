const fs = require('fs');
const fse = require("fs-extra");
const path = require('path');
const ora = require('ora');
const inquirer = require('inquirer');
const unzipper = require("unzipper");
const utils = require('../utils');
const config = require('../../config');
const logger = require('../utils/logger');

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

    backup(callback, ignore) {
        let startBack = () => {
            let backupPath = path.resolve(config.backupDir);
            utils.mkdirsSync(backupPath);
            //
            let dirLists = this.backDirs();
            if (ignore instanceof Array) {
                ignore.forEach((item) => {
                    dirLists.some((dir, index) => {
                        if (item === dir) {
                            dirLists.splice(index, 1);
                            return true;
                        }
                    });
                })
            }
            let entry = [];
            dirLists.forEach((item) => {
                entry.push({
                    type: "dir",
                    root: process.cwd(),
                    path: path.join(process.cwd(), item)
                });
            });
            entry.push({
                type: "file",
                root: process.cwd(),
                path: path.join(process.cwd(), "eeui.config.js"),
            });
            //
            let loading = ora('正在备份...').start();
            utils.zipCompress({
                output: path.join(backupPath, utils.formatDate("YmdHis") + ".zip"),
                entry: entry
            }, (output, err) => {
                loading.stop();
                if (err) {
                    if (typeof callback === "function") {
                        callback(false, err);
                    } else {
                        logger.fatal(`备份失败：${err}`);
                    }
                } else {
                    if (typeof callback === "function") {
                        callback(true, output);
                    } else {
                        logger.success(`备份成功：${output}`);
                    }
                }
            });
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
                    logger.fatal(`放弃备份！`);
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
            logger.fatal(`未找到备份文件！`);
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
                        logger.fatal(`恢复失败：备份文件 ${answers.bakname} 不存在！`);
                    }
                    backupMethod.recoveryHandler(zipFile, (res, msg) => {
                        if (res) {
                            logger.success(`恢复成功：${answers.bakname}`);
                        }else{
                            logger.fatal(`恢复失败：${answers.bakname}！`);
                        }
                    });
                }
            }).catch(console.error);
        });
    },

    recoveryHandler(zipFile, callback, ignore) {
        let dirLists = this.backDirs();
        if (ignore instanceof Array) {
            ignore.forEach((item) => {
                dirLists.some((dir, index) => {
                    if (item === dir) {
                        dirLists.splice(index, 1);
                        return true;
                    }
                });
            })
        }
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

    updateMainFrame(releasePath, projectPath, projectVersion) {
        let updatePathLists = [
            'platforms/android',
            'platforms/ios',
            'plugins/eeui/framework',
            'plugins/eeui/WeexSDK',
        ];
        if (utils.versionFunegt(projectVersion, "2.3.0") < 0) {
            updatePathLists.push('babel.config.js');
            updatePathLists.push('gulpfile.js');
            updatePathLists.push('webpack.config.js');
        }
        if (utils.versionFunegt(projectVersion, "2.3.3") < 0) {
            updatePathLists.push('src/entry.js');
        }
        let filterFileLists = [
            "platforms/android/eeuiApp/local.properties",
        ];
        let filterFileContent = [];
        //
        try {
            filterFileLists.forEach((file) => {
                let projectFile = path.join(projectPath, file);
                if (fs.existsSync(projectFile)) {
                    filterFileContent.push({
                        "file": projectFile,
                        "content": fs.readFileSync(projectFile, 'utf8')
                    })
                }
            });
            updatePathLists.forEach((dir) => {
                let releaseDir = path.join(releasePath, dir);
                if (fs.existsSync(releaseDir)) {
                    let projectDir = path.join(projectPath, dir);
                    fse.removeSync(projectDir);
                    fse.copySync(releaseDir, projectDir);
                }
            });
            filterFileContent.forEach((item) => {
                utils.mkdirsSync(path.dirname(item.file));
                fs.writeFileSync(item.file, item.content, 'utf8');
            });
        } catch (err) {
            logger.fatal(`升级新版本文件失败：${err}`);
        }
    },
};

module.exports = backupMethod;
