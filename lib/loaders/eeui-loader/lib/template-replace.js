var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var utils = require('../../../utils');

var config = {
    cli: require('../../../../config'),
    compile: {
        sourceDir: path.join('/storage/editor/'),
        rootDir: 'root://compile/editor/',
    }
};

module.exports = {
    eeuiLog: function(source) {
        var rege = new RegExp("((\\s|\\{|\\[|\\(|,|;)console)\\.(debug|log|info|warn|error)\\((.*?)\\)", "g");
        var result;
        while ((result = rege.exec(source)) != null) {
            var newString = result[0].replace(result[1], result[2] + "eeuiLog");
            source = source.replace(result[0], newString);
        }
        return source;
    },

    appModule: function(source) {
        var rege = new RegExp("\\.(requireModule|isRegisteredModule)\\(('|\")(.*?)\\2\\)", "g");
        var result;
        while ((result = rege.exec(source)) != null) {
            var name = result[3];
            if ([
                'websocket',
                'screenshots',
                'citypicker',
                'picture',
                'rongim',
                'umeng',
                'pay',
                'audio',
                'deviceInfo',
                'communication',
                'geolocation',
                'recorder',
                'accelerometer',
                'compass',
                'amap',
                'seekbar',
                'network',
            ].indexOf(name) !== -1) {
                name = 'eeui/' + name;
            }
            if (utils.strExists(name, "/")) {
                var newString = result[0].replace(result[3], utils.spritUpperCase(name));
                source = source.replace(result[0], newString);
            }
        }
        return source;
    },

    firstTag: function(source) {
        try {
            var srcDir = path.resolve(process.cwd(), config.cli.sourceDir);
            var curDir = path.resolve(this.context);
            var relativePath = utils.leftDelete(curDir, srcDir);
            if (/^win/.test(process.platform)) {
                relativePath = relativePath.replace(/\\/g, "/");
            }
            return source.replace(/<(.*?['"]\s*)>/, function ($1, $2) {
                return '<' + $2 + ' _____EEUI_RELATIVE_PATH="' + relativePath + '">';
            });
        } catch (e) {
            return source;
        }
    },

    imageCli: function(source) {
        let settingOptions = {},
            settingPath = path.resolve('.setting');
        if (fs.existsSync(settingPath)) {
            settingOptions = utils.jsonParse(fs.readFileSync(settingPath, 'utf8'));
        }
        if (settingOptions.disabled !== true) {
            var runDir = process.cwd();
            var srcDir = path.resolve(runDir, config.cli.sourceDir);
            //
            var rege = new RegExp("<image(.*?)[^:]src=(['\"])([^\'\"]*)\\2", "g");
            var result;
            var errorPath = [];
            while ((result = rege.exec(source)) != null) {
                let srcUrl = result[3];
                if (srcUrl.substring(0, 2) === "//" ||
                    srcUrl.substring(0, 7) === "http://" ||
                    srcUrl.substring(0, 8) === "https://" ||
                    srcUrl.substring(0, 6) === "ftp://" ||
                    srcUrl.substring(0, 5) === "root:") {
                    continue;
                }
                if (srcUrl) {
                    var imageSrc = path.resolve(this.context, srcUrl);
                    if (srcUrl.substring(0, 1) === "/") {
                        imageSrc = path.resolve(srcDir, srcUrl.substring(1));
                    }
                    if (fs.existsSync(imageSrc)) {
                        var newUrl = utils.leftDelete(imageSrc, path.join(srcDir, "/"));
                        if (/^win/.test(process.platform)) {
                            newUrl = newUrl.replace(/\\/g, "/");
                        }
                        newUrl = 'root://' + newUrl;
                        source = source.replace(result[0], "<image" + result[1] + "src=" + result[2] + newUrl + result[2]);
                    } else {
                        errorPath.push(result[3]);
                    }
                }
            }
            if (errorPath.length > 0) {
                console.log();
                console.log(chalk.red("Error File: " + chalk.underline(this.resourcePath)));
                errorPath.forEach((errorInfo) => {
                    console.log(chalk.red(" Not Found: " + chalk.underline(errorInfo)));
                });
            }
        }
        return source;
    },

    imageCompile: function(source) {
        var findIndex = utils.findIndexOf(this.context, config.compile.sourceDir);
        if (findIndex > -1) {
            var srcDir = path.resolve(this.context.substring(0, findIndex) + config.compile.sourceDir);
            var rege = new RegExp("<image(.*?)[^:]src=(['\"])([^\'\"]*)\\2", "g");
            var result;
            while ((result = rege.exec(source)) != null) {
                let srcUrl = result[3];
                if (srcUrl.substring(0, 2) === "//" ||
                    srcUrl.substring(0, 7) === "http://" ||
                    srcUrl.substring(0, 8) === "https://" ||
                    srcUrl.substring(0, 6) === "ftp://" ||
                    srcUrl.substring(0, 5) === "root:") {
                    continue;
                }
                if (srcUrl) {
                    var imageSrc = path.resolve(this.context, srcUrl);
                    if (srcUrl.substring(0, 1) === "/") {
                        imageSrc = path.resolve(srcDir, srcUrl.substring(1));
                    }
                    if (fs.existsSync(imageSrc)) {
                        var newUrl = utils.leftDelete(imageSrc, path.join(srcDir, "/"));
                        if (/^win/.test(process.platform)) {
                            newUrl = newUrl.replace(/\\/g, "/");
                        }
                        newUrl = config.compile.rootDir + newUrl;
                        source = source.replace(result[0], "<image" + result[1] + "src=" + result[2] + newUrl + result[2]);
                    }
                }
            }
        }
        return source;
    }
};
