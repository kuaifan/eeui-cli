const path = require('path');
const weexLoader = require('weex-loader');
const eeuiLoader = require('./lib/loader');

function loader(source) {
    if (path.extname(this.resourcePath).match(/\.vue/)) {
        return eeuiLoader.call(this, source);
    }
    return weexLoader.call(this, source);
}

module.exports = loader;