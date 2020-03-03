const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const utils = require("./index");


const projectUtils = {

    /**
     * 初始化项目设置
     * @param dir
     * @param config
     */
    initConfig(dir, config) {
        //Android id
        this.changeFile(path.resolve(dir, 'platforms/android/eeuiApp/build.gradle'), 'applicationId\\s*=\\s*(["\'])(.+?)\\1', `applicationId = "${config.applicationID}"`);
        let androidManifestPath = path.resolve(dir, 'platforms/android/eeuiApp/app/src/main/AndroidManifest.xml');
        if (fs.existsSync(androidManifestPath)) {
            let originalPackageName = fs.readFileSync(androidManifestPath, 'utf8').match(/package\s*=\s*(["'])(.+?)\1/)[2];
            let newPackageName = config.applicationID;
            if (originalPackageName && originalPackageName != newPackageName) {
                let myAppPath = path.resolve(dir, 'platforms/android/eeuiApp/app/src/main/java', originalPackageName.replace(/\./g, '/'),'MyApplication.java');
                if (!fs.existsSync(myAppPath)) {
                    originalPackageName = 'app.eeui.playground';
                    myAppPath = path.resolve(dir, 'platforms/android/eeuiApp/app/src/main/java', originalPackageName.replace(/\./g, '/'),'MyApplication.java')
                }
                if (fs.existsSync(myAppPath)) {
                    let originalPackagePath = path.resolve(dir, 'platforms/android/eeuiApp/app/src/main/java', originalPackageName.replace(/\./g, '/'));
                    let newPackagePath = path.resolve(dir, 'platforms/android/eeuiApp/app/src/main/java', newPackageName.replace(/\./g, '/'));
                    fse.moveSync(originalPackagePath, newPackagePath, { overwrite: true });
                    utils.fileDirDisplay(newPackagePath).file.forEach((tmpFile) => {
                        this.changeFile(tmpFile, originalPackageName, newPackageName);
                    });
                    utils.moveEmptyDirParent(originalPackagePath);
                    this.changeFile(androidManifestPath, originalPackageName, newPackageName);
                }
            }
        }
        //Android 应用名称
        this.changeFile(path.resolve(dir, 'platforms/android/eeuiApp/app/src/main/res/values/strings.xml'), '<string(.*?)name\\s*=\\s*("|\')app_name\\2(.*?)>(.*?)<\\/string>', `<string name="app_name" translatable="false">${config.appName}</string>`);
        //iOS id
        this.changeFile(path.resolve(dir, 'platforms/ios/eeuiApp/eeuiApp.xcodeproj/project.pbxproj'), 'PRODUCT_BUNDLE_IDENTIFIER\\s*=((?!Tests;).)+;', `PRODUCT_BUNDLE_IDENTIFIER = ${config.bundleIdentifier};`);
        //iOS 应用名称
        this.changeFile(path.resolve(dir, 'platforms/ios/eeuiApp/eeuiApp/Info.plist'), '<key>CFBundleDisplayName<\/key>\\s*\\r*\\n\\s*<string>(.*?)<\/string>', `<key>CFBundleDisplayName</key>\n\t<string>${config.appName}</string>`);
        //iOS URLTypes
        utils.replaceDictString(path.resolve(dir, 'platforms/ios/eeuiApp/eeuiApp/Info.plist'), 'eeuiAppName', 'eeuiApp' + this.replaceUpperCase(config.bundleIdentifier));
        //保存配置到本地
        fse.writeFileSync(path.resolve(dir, '.eeui.release'), JSON.stringify(config, null, "\t"), 'utf8');
    },

    /**
     * 替换字符串
     * @param  {string} filePath 文件路径.
     * @param  {string} oldText
     * @param  {string} newText
     */
    changeFile(filePath, oldText, newText) {
        if (!fse.existsSync(filePath)) {
            return;
        }
        let result = fse.readFileSync(filePath, 'utf8').replace(new RegExp(oldText, "g"), newText);
        if (result) {
            fse.writeFileSync(filePath, result, 'utf8');
        }
    },

    /**
     * 将点及后面的第一个字母换成大写字母，如：aaa.bbb.ccc换成AaaBbbCcc
     * @param string
     * @returns {*}
     */
    replaceUpperCase(string) {
        try {
            return string.replace(/^[a-z]/g, function ($1) {
                return $1.toLocaleUpperCase()
            }).replace(/\.+(\w)/g, function ($1) {
                return $1.toLocaleUpperCase()
            }).replace(/\./g, '');
        } catch (e) {
            return string;
        }
    }
};

module.exports = projectUtils;
