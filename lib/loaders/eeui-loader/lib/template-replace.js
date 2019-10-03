var fse = require('fs-extra');
var path = require('path');
var utils = require('../../../utils');
var config = require('../../../../config');
var dirCut = /^win/.test(process.platform) ? "\\" : "/";

module.exports = {
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
                    srcUrl.substring(0, 6) === "ftp://" ||
                    srcUrl.substring(0, 1) === "/") {
                    continue;
                }
                if (srcUrl) {
                    var imageSrc = path.resolve(this.context, srcUrl);
                    if (fse.pathExistsSync(imageSrc)) {
                        var newUrl = 'root://' + utils.leftDelete(imageSrc, srcDir + dirCut);
                        source = source.replace(result[0], "<image" + result[1] + "src=" + result[2] + newUrl + result[2]);
                    }
                }
            }
        }
        return source;
    }
};
