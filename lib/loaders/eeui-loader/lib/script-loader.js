var path = require('path');
var utils = require('../../../utils');
var templateReplaceCli = require('./template-replace-cli');
var templateReplaceCompile = require('./template-replace-compile');
var REQUIRE_REG = /require\((["'])@weex\-module\/([^\)\1]+)\1\)/g;

module.exports = function (content) {
    this.cacheable && this.cacheable();
    //
    var templateReplace = utils.strExists(this.resourcePath, path.join('/storage/editor/')) ? templateReplaceCompile : templateReplaceCli;
    var isProduction = this.minimize || process.env.NODE_ENV === 'production';
    if (!isProduction) {
        content = templateReplace.eeuiLog(content);
    }
    content = templateReplace.appModule(content);
    //
    return content.replace(REQUIRE_REG, '__weex_require_module__($1$2$1)')
};
