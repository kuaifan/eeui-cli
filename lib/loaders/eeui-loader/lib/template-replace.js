var fse = require('fs-extra');
var path = require('path');
var utils = require('../../../utils');
var config = require('../../../../config');

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
            if (utils.strExists(result[3], "/")) {
                var newString = result[0].replace(result[3], utils.spritUpperCase(result[3]));
                source = source.replace(result[0], newString);
            }
        }
        return source;
    },

    image: function(source) {
        let settingOptions = {},
            settingPath = path.resolve('.setting');
        if (fse.pathExistsSync(settingPath)) {
            settingOptions = utils.jsonParse(fse.readFileSync(settingPath, 'utf8'));
        }
        if (settingOptions.disabled !== true) {
            var runDir = process.cwd();
            var srcDir = path.resolve(runDir, config.sourceDir);
            //
            var rege = new RegExp("<image(.*?)src=(['\"])(.*\.(png|jpe?g|gif))\\2", "g");
            var result;
            while ((result = rege.exec(source)) != null) {
                let srcUrl = result[3];
                if (srcUrl.substring(0, 2) === "//" ||
                    srcUrl.substring(0, 7) === "http://" ||
                    srcUrl.substring(0, 8) === "https://" ||
                    srcUrl.substring(0, 6) === "ftp://") {
                    continue;
                }
                if (srcUrl) {
                    var imageSrc = path.resolve(this.context, srcUrl);
                    if (srcUrl.substring(0, 1) === "/") {
                        imageSrc = path.resolve(srcDir, srcUrl.substring(1));
                    }
                    if (fse.pathExistsSync(imageSrc)) {
                        var newUrl = utils.leftDelete(imageSrc, path.join(srcDir, "/"));
                        if (/^win/.test(process.platform)) {
                            newUrl = newUrl.replace(/\\/g, "/");
                        }
                        newUrl = 'root://' + newUrl;
                        source = source.replace(result[0], "<image" + result[1] + "src=" + result[2] + newUrl + result[2]);
                    }
                }
            }
        }
        return source;
    }
};
