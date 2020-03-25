const path = require('path');
const sourcer = require('sourcer');
const webpack = require('webpack');
const webpackMerge = require('webpack-merge');
const webpackUtils = require('./webpackUtils');
const utils = require('../utils');

module.exports = class webpackBuilder {
    constructor(source, dest, options = {}) {
        const root = options.root || process.cwd();
        if (typeof source === "object" && typeof source.length === "undefined") {
            this.sourceDef = ".vue";
            this.source = source;
            this.base = options.base || '';
        } else {
            const ext = path.extname(source);
            this.sourceDef = source;
            if (ext) {
                this.source = [path.resolve(source)];
                this.base = options.base || sourcer.base(source);
            } else {
                this.source = sourcer.find(root, source, {
                    recursive: true
                });
                this.base = sourcer.base(source);
                if (options.ext) {
                    const reg = new RegExp('\\.(' + options.ext + ')$');
                    this.source = this.source.filter(s => reg.test(path.extname(s)));
                }
            }
        }
        if (!utils.isJson(options.babelOptions)) {
            options.babelOptions = {};
        }
        this.dest = path.resolve(dest);
        this.options = options;
    }

    build(callback) {
        this.mergeConfig = {};
        if (this.source.length === 0) {
            return callback('no ' + (this.options.ext || '') + ' files found in source "' + this.sourceDef + '"');
        }
        if (this.options.config && webpackUtils.accessSync(this.options.config)) {
            this.mergeConfig = require(path.resolve(this.options.config));
        }
        this.webpackCompiler = webpack(webpackMerge(this.config, this.mergeConfig));
        this.webpackFormatResult = (err, stats) => {
            const result = {
                toString: () => stats.toString({
                    warnings: false,
                    version: false,
                    hash: false,
                    assets: true,
                    modules: false,
                    chunkModules: false,
                    chunkOrigins: false,
                    entrypoints: false,
                    children: false,
                    chunks: false,
                    colors: true
                })
            };
            if (err) {
                console.error(err.stack || err);
                if (err.details) {
                    console.error(err.details);
                }
                return callback && callback(err);
            }

            const info = stats.toJson();
            if (stats.hasErrors()) {
                return callback && callback(info.errors, result, info);
            }
            callback && callback(err, result, info);
        };
        if (this.config.watch) {
            this.webpackWatching = this.webpackCompiler.watch({
                aggregateTimeout: 300,
                ignored: /node_modules/,
                poll: false,
            }, this.webpackFormatResult);
        } else {
            this.webpackCompiler.run(this.webpackFormatResult);
        }
        return this;
    }
};
