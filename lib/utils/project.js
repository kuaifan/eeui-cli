const fse = require("fs-extra");
const utils = require("./index");


const projectUtils = {

    /**
     * 初始化项目设置
     * @param dir
     * @param config
     */
    initConfig(dir, config) {
        //Android id
        this.changeFile(dir + '/platforms/android/eeuiApp/build.gradle', 'applicationId\\s*=(.*?)\\r*\\n', `applicationId = "${config.applicationID}"\n`);
        //Android 应用名称
        this.changeFile(dir + '/platforms/android/eeuiApp/app/src/main/res/values/strings.xml', '<string(.*?)name\\s*=\\s*("|\')app_name\\2(.*?)>(.*?)<\\/string>', `<string name="app_name" translatable="false">${config.appName}</string>`);
        //iOS id
        this.changeFile(dir + '/platforms/ios/eeuiApp/eeuiApp.xcodeproj/project.pbxproj', 'PRODUCT_BUNDLE_IDENTIFIER\\s*=((?!Tests;).)+;', `PRODUCT_BUNDLE_IDENTIFIER = ${config.bundleIdentifier};`);
        //iOS 应用名称
        this.changeFile(dir + '/platforms/ios/eeuiApp/eeuiApp/Info.plist', '<key>CFBundleDisplayName<\/key>\\s*\\r*\\n\\s*<string>(.*?)<\/string>', `<key>CFBundleDisplayName</key>\n\t<string>${config.appName}</string>`);
        //iOS URLTypes
        utils.replaceDictString(dir + '/platforms/ios/eeuiApp/eeuiApp/Info.plist', 'eeuiAppName', 'eeuiApp' + this.replaceUpperCase(config.bundleIdentifier));
        //保存配置到本地
        fse.writeFileSync(dir + "/.eeui.release", JSON.stringify(config, null, "\t"), 'utf8');
    },

    /**
     * 替换字符串
     * @param  {string} path 文件路径.
     * @param  {string} oldText
     * @param  {string} newText
     */
    changeFile(path, oldText, newText) {
        if (!fse.existsSync(path)) {
            return;
        }
        let result = fse.readFileSync(path, 'utf8').replace(new RegExp(oldText, "g"), newText);
        if (result) {
            fse.writeFileSync(path, result, 'utf8');
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
