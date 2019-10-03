const utils = require('./utils');

module.exports = (options) => {
    return {
        loaders: utils.cssLoaders({
            sourceMap: options && options.sourceMapEnabled,
            useVue: options && options.useVue,
            usePostCSS: options && options.usePostCSS
        })
    };
};
