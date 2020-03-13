var templateReplace = require('./template-replace');
var REQUIRE_REG = /require\((["'])@weex\-module\/([^\)\1]+)\1\)/g;

module.exports = function (content) {
    this.cacheable && this.cacheable();
    //
    content = templateReplace.eeuiLog(content);
    content = templateReplace.appModule(content);
    //
    return content.replace(REQUIRE_REG, '__weex_require_module__($1$2$1)')
};
