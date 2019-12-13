const WebpackBuilder = require('./webpackBuilder');
const webpack = require('webpack');
const chokidar = require('chokidar');
const notifier = require('node-notifier');
const vueLoaderConfig = require('./vueLoader');
const defaultExt = ['we', 'vue', 'js'];
const fs = require('fs');
const fsEx = require('fs-extra');
const path = require('path');
const utils = require('../utils');
const log = require('../utils/logger');

class eeuiBuilder extends WebpackBuilder {
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
        if (this.options.filename) {
            filename = this.options.filename;
        } else {
            filename = '[name].js';
        }
        if (destExt && this.dest[this.dest.length - 1] !== '/' && sourceExt) {
            dir = path.dirname(this.dest);
            filename = path.basename(this.dest);
        } else {
            dir = this.dest;
        }

        if (this.options.onProgress) {
            plugins.push(new webpack.ProgressPlugin(this.options.onProgress));
        }
        if (this.options.min) {
            plugins.unshift(new webpack.optimize.UglifyJsPlugin({
                minimize: true,
                sourceMap: !!this.options.devtool
            }));
        }
        let babelOptions = {},
            babelrcPath = path.resolve('.babelrc');
        if (fs.existsSync(babelrcPath)) {
            babelOptions = utils.jsonParse(fs.readFileSync(babelrcPath, 'utf8'));
        }
        let settingOptions = {},
            settingPath = path.resolve('.setting');
        if (fs.existsSync(settingPath)) {
            settingOptions = utils.jsonParse(fs.readFileSync(settingPath, 'utf8'));
        }
        const webpackConfig = () => {
            const entrys = {};
            if (typeof this.source.length === "undefined") {
                utils.each(this.source, (fileName, s) => {
                    if (!this.options.web) {
                        s += '?entry=true';
                    }
                    entrys[fileName] = s;
                })
            } else {
                this.source.forEach(s => {
                    let fileName = path.relative(path.resolve(this.base), s).replace(/\.\w+$/, '');
                    if (!this.options.web) {
                        s += '?entry=true';
                    }
                    entrys[fileName] = s;
                });
            }
            const configs = {
                entry: entrys,
                output: {
                    path: dir,
                    filename: filename
                },
                watch: this.options.watch || false,
                devtool: this.options.devtool || false,
                module: {
                    rules: [{
                        test: /\.js$/,
                        use: [{
                            loader: 'babel-loader',
                            options: babelOptions
                        }]
                    }, {
                        test: /\.we$/,
                        use: [{
                            loader: 'weex-loader'
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
            if (this.options.web) {
                configs.module.rules.push({
                    test: /\.vue(\?[^?]+)?$/,
                    use: [{
                        loader: 'vue-loader',
                        options: Object.assign(vueLoaderConfig({useVue: true, usePostCSS: false}), {
                            /**
                             * important! should use postTransformNode to add $processStyle for
                             * inline style prefixing.
                             */
                            optimizeSSR: false,
                            compilerModules: [{
                                postTransformNode: el => {
                                    el.staticStyle = `$processStyle(${el.staticStyle})`;
                                    el.styleBinding = `$processStyle(${el.styleBinding})`;
                                }
                            }]
                        })
                    }]
                });
            } else {
                configs.module.rules.push({
                    test: /\.vue(\?[^?]+)?$/,
                    use: [{
                        loader: settingOptions.loader === 'weex' ? 'weex-loader' : 'eeui-loader',
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
            }
            if (this.options.watch === true) {
                let watchinter = setInterval(() => {
                    if (typeof this.webpackCompiler != "undefined" && typeof this.webpackWatching != "undefined") {
                        clearInterval(watchinter);
                        //监听文件变化
                        let appboardDir = path.resolve(this.options.sourceDir, 'appboard');
                        let sourceDir = this.options.sourceDir;
                        let distDir = this.options.distDir;
                        let sourcePath;
                        let sourceName;
                        let distPath;
                        let fileName;
                        chokidar.watch(sourceDir, {
                            ignored: /[\/\\]\./,
                            persistent: true
                        }).on('all', (e, s) => {
                            if (this.buildCompleted !== true) {
                                return;
                            }
                            sourcePath = path.resolve(s);
                            sourceName = path.relative(path.resolve(sourceDir), s);
                            distPath = path.resolve(distDir + "/" + sourceName);
                            fileName = path.relative(path.resolve(this.base), s).replace(/\.\w+$/, '');
                            if (/^win/.test(process.platform)) {
                                sourceName = sourceName.replace(/\\/g, "/");
                                s = s.replace(/\\/g, "/");
                            }
                            //
                            if (utils.rightExists(s, ".vue")) {
                                if (utils.leftExists(s, "src/pages/")) {
                                    if (e === "add" &&typeof entrys[fileName] == "undefined") {
                                        entrys[fileName] = sourcePath;
                                        this.config.entry = utils.clone(entrys);
                                        this.resetWatch();
                                    } else if (e === "unlink" && typeof entrys[fileName] != "undefined") {
                                        delete entrys[fileName];
                                        this.config.entry = utils.clone(entrys);
                                        this.resetWatch();
                                    }
                                }
                            } else if (utils.execPath(sourcePath)) {
                                if (e === "add" || e === "change") {
                                    let sourceContent = fs.readFileSync(sourcePath, 'utf8');
                                    this.options.onSocketClient(sourceName, sourceContent);
                                    if (utils.leftExists(sourcePath, appboardDir)) {
                                        fsEx.outputFile(distPath, utils.replaceEeuiLog(sourceContent));
                                    }else{
                                        fsEx.copy(sourcePath, distPath);
                                    }
                                    this.resetWatch();
                                } else if (e === "unlink") {
                                    this.options.onSocketClient(sourceName, "");
                                    fsEx.remove(path.resolve(sourceDir + '/../platforms/android/eeuiApp/app/src/main/assets/eeui/' + sourceName));
                                    fsEx.remove(path.resolve(sourceDir + '/../platforms/ios/eeuiApp/bundlejs/eeui/' + sourceName));
                                    fsEx.remove(distPath);
                                    this.resetWatch();
                                }
                            }
                        });
                        chokidar.watch(path.resolve(sourceDir + '/../eeui.config.js'), {
                            ignored: /[\/\\]\./,
                            persistent: true
                        }).on('change', (s) => {
                            if (this.buildCompleted !== true) {
                                return;
                            }
                            notifier.notify({
                                title: 'eeui.config.js',
                                message: "修改的内容需要重编译运行App才生效。",
                                contentImage: path.join(__dirname, 'logo.png')
                            });
                            log.warn("检测到配置文件[eeui.config.js]已变化，修改的内容可能需要重新编译运行App才起效。");
                            console.log();
                            utils.syncConfigToPlatforms();
                        });
                    }
                }, 500);
            }
            return configs;
        };
        this.config = webpackConfig();
    }

    build(callback) {
        return super.build((...value) => {
            this.buildCompleted = true;
            return callback(...value);
        });
    }
}

module.exports = eeuiBuilder;
