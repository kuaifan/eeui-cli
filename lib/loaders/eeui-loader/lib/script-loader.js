var fs = require('fs');
var path = require('path');
var templateReplace = require('./template-replace');
var REQUIRE_REG = /require\((["'])@weex\-module\/([^\)\1]+)\1\)/g;

module.exports = function (content) {
    this.cacheable && this.cacheable();
    //
    var conPath = path.resolve(this.context);
    var srcPath = path.resolve(process.cwd(), 'src');
    var floorPath = "";
    while (conPath && conPath != srcPath) {
        if (conPath == path.resolve(conPath, "../")) {
            break;
        }
        conPath = path.resolve(conPath, "../");
        floorPath += "../"
    }
    var entryFile = floorPath + 'entry.js';
    if (fs.existsSync(path.resolve(this.context, entryFile))) {
        content = '//\n//\n//\n//\n//\n//\n//\n//\n//\n//\nimport "' + entryFile + '"\n' + content;
    }
    //
    content = templateReplace.eeuiLog(content);
    content = templateReplace.appModule(content);
    //
    return content.replace(REQUIRE_REG, '__weex_require_module__($1$2$1)')
};
