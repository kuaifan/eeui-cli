const fs = require('fs');
const path = require('path');
const _sizeUnits = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

let eeuiConfig = {};
if (fs.existsSync(path.resolve(process.cwd(), 'eeui.config.js'))) {
    eeuiConfig = require(path.resolve(process.cwd(), 'eeui.config.js'));
}

const resolveSizeUnit = (size, i = 0) => {
    if (isNaN(size)) {
        return '';
    }
    if (size < 1000) {
        return size.toFixed(2).replace(/\.?0+$/, '') + _sizeUnits[i];
    } else {
        return resolveSizeUnit(size / 1024, i + 1);
    }
};

const loadModulePath = (moduleName, extra) => {
    try {
        const localPath = require.resolve(path.join(process.cwd(), 'node_modules', moduleName, extra || ''));
        return localPath.slice(0, localPath.lastIndexOf(moduleName) + moduleName.length);
    } catch (e) {
        try {
            const localPath = require.resolve(path.join(__dirname, '../../node_modules', moduleName, extra || ''));
            return localPath.slice(0, localPath.lastIndexOf(moduleName) + moduleName.length);
        } catch (e) {
            return moduleName;
        }
    }
};

const cssLoaders = (options) => {
    options = options || {};

    const cssLoader = {
        loader: loadModulePath('css-loader'),
        options: {
            sourceMap: options.sourceMap
        }
    };

    const postcssLoader = {
        loader: loadModulePath('postcss-loader'),
        options: {
            sourceMap: options.sourceMap
        }
    };

    const generateLoaders = (loader, loaderOptions) => {
        const loaders = options.useVue ? [cssLoader] : [];
        if (options.usePostCSS) {
            loaders.push(postcssLoader);
        }
        if (loader) {
            loaders.push({
                loader: loadModulePath(loader + '-loader'),
                options: Object.assign({}, loaderOptions, {
                    sourceMap: !!options.sourceMap
                })
            });

            if (eeuiConfig.styleResources) {
                let styleResource = eeuiConfig.styleResources[loader];
                if (styleResource) {
                    loaders.push({
                        loader: loadModulePath('style-resources-loader'),
                        options: {
                            patterns: toString.call(styleResource) === "[object String]" ? [styleResource] : styleResource
                        }
                    });
                }
            }
        }
        if (options.useVue) {
            return [loadModulePath('vue-style-loader')].concat(loaders);
        } else {
            return loaders;
        }
    };

    return {
        less: generateLoaders('less'),
        sass: generateLoaders('sass', {indentedSyntax: true}),
        scss: generateLoaders('sass'),
        stylus: generateLoaders('stylus'),
        styl: generateLoaders('stylus')
    };
};

const accessSync = (path) => {
    try {
        fs.accessSync(path, fs.F_OK);
    } catch (e) {
        return false;
    }
    return true;
};

const errorServer = (res, errorCode, errorMsg) => {
    fs.readFile(__dirname + '/error.js', (err, data) => {
        if (err) {
            res.writeHead(404, {'content-type': 'text/html; charset=utf-8'});
            res.write('<h1>404错误</h1><p>你要找的页面不存在</p>');
            res.end();
        } else {
            data += "";
            if (errorCode) {
                data = data.replace('你访问的页面出错了！', '你访问的页面出错了！ (' + errorCode + ')')
            }
            if (errorMsg) {
                data = data.replace('var errorMsg=decodeURIComponent("");', 'var errorMsg=decodeURIComponent("' + encodeURIComponent(errorMsg.replace(new RegExp(path.join(__dirname, '../../'), 'g'), '')) + '");')
            }
            res.writeHead(200, {'content-type': 'text/javascript; charset=utf-8'});
            res.write(data);
            res.end();
        }
    });
};

module.exports = {resolveSizeUnit, loadModulePath, cssLoaders, accessSync, errorServer};
