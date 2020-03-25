const fs = require('fs');
const path = require('path');
const lodash = require("lodash");
const webpack = require('webpack');
const defaultExt = ['we', 'vue', 'js'];
const webpackBuilder = require('./webpackBuilder');
const vueLoaderConfig = require('./vueLoader');
const utils = require('../utils');
const webpackEntrys = {};

class builder extends webpackBuilder {

    /**
     * 构造函数
     * @param source
     * @param dest
     * @param options
     */
    constructor(source, dest, options = {}) {
        if (!(options.ext && typeof options.ext === 'string')) {
            options.ext = defaultExt.join('|');
        }
        super(source, dest, options);
    }

    /**
     * 初始化参数
     */
    initConfig() {
        process.env.__LOADER_TYPE = this.options.loaderType || "";
        const destExt = path.extname(this.dest);
        const sourceExt = path.extname(this.sourceDef);
        let dir;
        let filename;
        let banner = `// { "framework": "Vue"} \nif(typeof app=="undefined"){app=weex}`;
        let eeuiLog;
        if (this.options.min) {
            eeuiLog = fs.readFileSync(path.resolve(__dirname, 'eeuiLogProd.js'), 'utf8');
        } else {
            eeuiLog = fs.readFileSync(path.resolve(__dirname, 'eeuiLog.js'), 'utf8');
        }
        const plugins = [
            new webpack.BannerPlugin({
                banner: banner + `\n` + eeuiLog,
                raw: true,
                exclude: 'Vue'
            })
        ];
        filename = '[name].js';
        if (destExt && this.dest[this.dest.length - 1] !== '/' && sourceExt) {
            dir = path.dirname(this.dest);
            filename = path.basename(this.dest);
        } else {
            dir = this.dest;
        }
        if (this.options.onProgress) {
            plugins.push(new webpack.ProgressPlugin(this.options.onProgress));
        }
        const webpackConfig = () => {
            if (typeof this.source.length === "undefined") {
                utils.each(this.source, (fileName, s) => {
                    webpackEntrys[fileName] = s + '?entry=true';
                })
            } else {
                this.source.forEach(s => {
                    let fileName = path.relative(path.resolve(this.base), s).replace(/\.\w+$/, '');
                    webpackEntrys[fileName] = s + '?entry=true';
                });
            }
            const configs = {
                entry: () => {
                    return webpackEntrys
                },
                output: {
                    path: dir,
                    filename: filename
                },
                optimization: {
                    minimize: this.options.minimize || false
                },
                mode: this.options.mode || 'development',
                watch: this.options.watch || false,
                devtool: this.options.devtool || false,
                module: {
                    rules: [{
                        test: /\.js$/,
                        use: [{
                            loader: 'babel-loader',
                            options: this.options.babelOptions || {
                                "presets": [
                                    "@babel/react",
                                    "@babel/env"
                                ]
                            }
                        }]
                    }]
                },
                resolve: {
                    extensions: ['.js', '.json', '.vue'],
                    alias: {
                        '@': path.resolve('src')
                    }
                },
                resolveLoader: {
                    modules: [path.resolve(__dirname, '../loaders'), path.resolve(__dirname, '../../node_modules'), path.resolve(process.cwd(), 'node_modules')],
                    extensions: ['.js', '.json', '.vue'],
                    mainFields: ['loader', 'main'],
                    moduleExtensions: ['-loader']
                },
                plugins: plugins
            };
            configs.module.rules.push({
                test: /\.vue(\?[^?]+)?$/,
                use: [{
                    loader: 'eeui-loader',
                    options: vueLoaderConfig({useVue: false})
                }]
            });
            configs.node = {
                setImmediate: false,
                dgram: 'empty',
                fs: 'empty',
                net: 'empty',
                tls: 'empty',
                child_process: 'empty'
            };
            if (fs.existsSync(path.resolve('webpack.config.js'))) {
                return lodash.merge(configs, require(path.resolve('webpack.config.js')));
            } else {
                return configs;
            }
        };
        this.config = webpackConfig();
    }

    /**
     * 添加入口文件
     * @param array
     * @returns {boolean}
     */
    insertEntry(array) {
        if (!utils.likeArray(array)) {
            array = [array];
        }
        let isAdd = false;
        array.forEach((item) => {
            let fileName,
                sourcePath;
            if (typeof item === "string") {
                fileName = utils.rightDelete(utils.leftDelete(item, '/'), '.vue');
                sourcePath = item + '?entry=true';
            } else if (utils.isJson(item)) {
                fileName = item.fileName;
                sourcePath = item.sourcePath;
            }
            if (fileName && sourcePath) {
                if (typeof webpackEntrys[fileName] === "undefined" || webpackEntrys[fileName] !== sourcePath) {
                    webpackEntrys[fileName] = sourcePath;
                    isAdd = true;
                }
            }
        });
        return isAdd ? this.webpackInvalidate() : true;
    }

    /**
     * 移除入口文件
     * @param array
     * @returns {boolean}
     */
    removeEntry(array) {
        if (!utils.likeArray(array)) {
            array = [array];
        }
        let isDel = false;
        array.forEach((item) => {
            let fileName;
            if (typeof item === "string") {
                fileName = utils.rightDelete(utils.leftDelete(item, '/'), '.vue');
            } else if (utils.isJson(item)) {
                fileName = item.fileName;
            }
            if (fileName) {
                if (typeof webpackEntrys[fileName] !== 'undefined') {
                    delete webpackEntrys[fileName];
                    isDel = true;
                }
            }
        });
        return isDel;
    }

    /**
     * 作废当前编译循环
     * @returns {boolean}
     */
    webpackInvalidate() {
        try {
            this.webpackWatching.invalidate();
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 编译
     * @param callback
     * @returns {webpackBuilder}
     */
    build(callback) {
        this.initConfig();
        return super.build(callback);
    }
}

module.exports = builder;