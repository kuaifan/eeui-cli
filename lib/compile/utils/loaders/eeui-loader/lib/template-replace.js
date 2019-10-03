var fs = require('fs');
var path = require('path');
var utils = require('../../../index');
var dirCut = /^win/.test(process.platform) ? "\\" : "/";
var config = {
    sourceDir: dirCut + 'storage' + dirCut + 'editor' + dirCut,
    rootDir: 'root://compile/editor/',
};

module.exports = {
    image: function(source) {
        var findIndex = utils.findIndexOf(this.context, config.sourceDir);
        if (findIndex > -1) {
            var srcDir = this.context.substring(0, findIndex) + config.sourceDir;
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
                    if (fs.existsSync(imageSrc)) {
                        var newUrl = config.rootDir + utils.leftDelete(imageSrc, srcDir);
                        source = source.replace(result[0], "<image" + result[1] + "src=" + result[2] + newUrl + result[2]);
                    }
                }
            }
        }
        return source;
    }
};
