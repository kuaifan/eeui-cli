const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const defaultExt = ['we', 'vue', 'js'];
const webpackBuilder = require('./webpackBuilder');
const vueLoaderConfig = require('./vueLoader');
const utils = require('../index');
const entrys = {};

class builder extends webpackBuilder {
    constructor(source, dest, options = {}) {
        if (!(options.ext && typeof options.ext === 'string')) {
            options.ext = defaultExt.join('|');
        }
        super(source, dest, options);
    }

    initConfig() {
        const destExt = path.extname(this.dest);
        const sourceExt = path.extname(this.sourceDef);
        let dir;
        let filename;
        let banner = `// { "framework": "${sourceExt === '.we' ? 'Weex' : 'Vue'}"} \nif(typeof app=="undefined"){app=weex}`;
        let eeuiLog = ``;
        if (this.options.min) {
            eeuiLog = fs.readFileSync(path.join(__dirname, 'eeuiLogProd.js'), 'utf8');
        }else{
            eeuiLog = fs.readFileSync(path.join(__dirname, 'eeuiLog.js'), 'utf8');
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
        const webpackConfig = () => {
            if (typeof this.source.length === "undefined") {
                utils.each(this.source, (fileName, s) => {
                    entrys[fileName] = s + '?entry=true';
                })
            } else {
                this.source.forEach(s => {
                    let fileName = path.relative(path.resolve(this.base), s).replace(/\.\w+$/, '');
                    entrys[fileName] = s + '?entry=true';
                });
            }
            const configs = {
                entry: () => { return entrys },
                output: {
                    path: dir,
                    filename: filename
                },
                optimization: {
                    minimize: this.options.minimize || false
                },
                mode: 'development',
                watch: this.options.watch || false,
                devtool: this.options.devtool || false,
                module: {
                    rules: [{
                        test: /\.js$/,
                        use: [{
                            loader: 'babel-loader',
                            options: {
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
                },
                resolveLoader: {
                    modules: [path.join(__dirname, '../loaders'), path.resolve('node_modules')],
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
            return configs;
        };
        this.config = webpackConfig();
    }

    insertEntry(files) {
        if (typeof files !== 'string' && !Array.isArray(files)) {
            return;
        }
        if (!Array.isArray(files)) {
            files = [files];
        }
        files.forEach((file) => {
            let fileName = utils.rightDelete(utils.leftDelete(file, '/'), '.vue');
            entrys[fileName] = file + '?entry=true';
        });
        try {
            this.webpackWatching.invalidate();
            return true;
        }catch (e) {
            return false;
        }
    }

    removeEntry(files) {
        if (typeof files !== 'string' && !Array.isArray(files)) {
            return;
        }
        if (!Array.isArray(files)) {
            files = [files];
        }
        files.forEach((file) => {
            let fileName = utils.rightDelete(utils.leftDelete(file, '/'), '.vue');
            if (typeof entrys[fileName] !== 'undefined') {
                delete entrys[fileName];
            }
        });
    }

    build(callback) {
        this.initConfig();
        return super.build((...value) => {
            return callback(...value);
        });
    }
}

module.exports = builder;