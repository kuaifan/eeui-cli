var fs = require('fs');
var path = require('path');
var utils = require('../../../index');
var config = {
    sourceDir: path.join('/storage/editor/'),
    rootDir: 'root://compile/editor/',
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
                var newString = result[0].replace(name, utils.spritUpperCase(name));
                source = source.replace(result[0], newString);
            }
        }
        return source;
    },

    image: function(source) {
        var findIndex = utils.findIndexOf(this.context, config.sourceDir);
        if (findIndex > -1) {
            var srcDir = path.resolve(this.context.substring(0, findIndex) + config.sourceDir);
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
                    if (fs.existsSync(imageSrc)) {
                        var newUrl = utils.leftDelete(imageSrc, path.join(srcDir, "/"));
                        if (/^win/.test(process.platform)) {
                            newUrl = newUrl.replace(/\\/g, "/");
                        }
                        newUrl = config.rootDir + newUrl;
                        source = source.replace(result[0], "<image" + result[1] + "src=" + result[2] + newUrl + result[2]);
                    }
                }
            }
        }
        return source;
    }
};
