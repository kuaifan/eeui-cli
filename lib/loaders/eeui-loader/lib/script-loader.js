var fs = require('fs');
var path = require('path');
var templateReplace = require('./template-replace');
var REQUIRE_REG = /require\((["'])@weex\-module\/([^\)\1]+)\1\)/g;

module.exports = function (content) {
    this.cacheable && this.cacheable();
    //
    var entryFile = path.resolve(process.cwd(), 'src/entry.js');
    if (fs.existsSync(entryFile)) {
        content = '//\n//\n//\n//\n//\n//\n//\n//\n//\n//\nimport "' + entryFile + '"\n' + content;
    }
    content = templateReplace.eeuiLog(content);
    content = templateReplace.appModule(content);
    //
    return content.replace(REQUIRE_REG, '__weex_require_module__($1$2$1)')
};
