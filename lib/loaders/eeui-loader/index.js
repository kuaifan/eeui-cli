const eeuiLoader = require('./lib/loader');

function loader(source) {
    return eeuiLoader.call(this, source);
}

module.exports = loader;