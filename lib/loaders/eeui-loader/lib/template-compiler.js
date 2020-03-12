var compiler = require('weex-template-compiler');
var transpile = require('vue-template-es2015-compiler');
var loaderUtils = require('loader-utils');
var beautify = require('js-beautify').js_beautify;
var path = require('path');
var utils = require('../../../utils');
var templateReplace = require('./template-replace');

module.exports = function (html) {
    this.cacheable();
    var isProduction = this.minimize || process.env.NODE_ENV === 'production';
    var query = loaderUtils.getOptions(this) || {};
    var vueOptions = (this.options || this._compiler.options).__vueOptions__;

    var compiled;
    if (process.env.__LOADER_TYPE == "compile") {
        compiled = compiler.compile(templateReplace.imageCompile.call(this, html), {
            recyclable: query.recyclable
        });
    } else {
        //html = templateReplace.firstTag.call(this, html);
        compiled = compiler.compile(templateReplace.imageCli.call(this, html), {
            recyclable: query.recyclable
        });
    }

    var code;
    if (compiled.errors.length) {
        var self = this;
        compiled.errors.forEach(function (err) {
            self.emitError('template syntax error ' + err)
        });
        code = 'module.exports={render:function(){},staticRenderFns:[]}'
    } else {
        var bubleOptions = vueOptions.buble;
        code = transpile('module.exports={' +
            'render:' + toFunction(compiled.render) + ',' +
            (compiled['@render'] ? ('"@render":' + toFunction(compiled['@render']) + ',') : '') +
            'staticRenderFns: [' + compiled.staticRenderFns.map(toFunction).join(',') + ']' +
            '}', bubleOptions);
        // mark with stripped (this enables Vue to use correct runtime proxy detection)
        if (!isProduction && (
            !bubleOptions ||
            !bubleOptions.transforms ||
            bubleOptions.transforms.stripWith !== false
        )) {
            code += `\nmodule.exports.render._withStripped = true`
        }
    }
    return code
};

function toFunction(code) {
    return 'function (){' + beautify(code, {indent_size: 2}) + '}'
}
