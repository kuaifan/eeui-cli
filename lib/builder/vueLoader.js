const webpackUtils = require('./webpackUtils');

module.exports = (options) => {
    return {
        loaders: webpackUtils.cssLoaders({
            sourceMap: options && options.sourceMapEnabled,
            useVue: options && options.useVue,
            usePostCSS: options && options.usePostCSS
        })
    };
};
