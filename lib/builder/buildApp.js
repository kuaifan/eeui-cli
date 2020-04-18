const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const http = require('http');
const net = require('net');
const ora = require('ora');
const uuid = require('uuid');
const chalk = require('chalk');
const Gauge = require('gauge');
const crypto = require('crypto');
const chokidar = require('chokidar');
const notifier = require('node-notifier');
const ipv4 = require('internal-ip').v4.sync();
const child_process = require('child_process');
const utils = require('../utils');
const logger = require('../utils/logger');
const builder = require('./builder');
const config = require('../../config');
const ansiHtml = require('./ansiHtml');
const mine = require('../utils/mine').types;

let socketAlready = false;
let socketTimeout = null;
let socketClients = [];
let fileMd5Lists = {};

module.exports = {
    /**
     * 获取未使用接口
     * @param port
     * @param callback
     */
    portIsOccupied(port, callback) {
        const server = net.createServer().listen(port);
        server.on('listening', () => {
            server.close();
            callback(null, port);
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                this.portIsOccupied(port + 1, callback);
            } else {
                callback(err)
            }
        });
    },

    /**
     * 获取首页url
     * @param dirName
     * @returns {string}
     */
    getHostIndexUrl(dirName) {
        let indexName = 'index.js';
        let homePage = utils.getObject(require(path.resolve('eeui.config')), 'homePage').trim();
        if (utils.count(homePage) > 0) {
            if (utils.leftExists(homePage, "http://") || utils.leftExists(homePage, "https://") || utils.leftExists(homePage, "ftp://") || utils.leftExists(homePage, "file://")) {
                return homePage;
            }
            let lastUrl = homePage.substring(homePage.lastIndexOf("/"), homePage.length);
            if (!utils.strExists(lastUrl, ".")) {
                homePage += ".js";
            }
            indexName = homePage;
        }
        return dirName + "/" + indexName;
    },

    /**
     * 格式化url参数
     * @param url
     * @returns {{}}
     */
    urlParamets(url) {
        let arr;
        if (utils.strExists(url, "?")) {
            arr = utils.getMiddle(url, "?", null).split("&");
        }else{
            arr = utils.getMiddle(url, "#", null).split("&");
        }
        let params = {};
        for (let i = 0; i < arr.length; i++) {
            let data = arr[i].split("=");
            if (data.length === 2) {
                params[data[0]] = data[1];
            }
        }
        return params;
    },

    /**
     * 创建网络访问服务
     * @param contentBase
     * @param port
     */
    createServer(contentBase, port) {
        http.createServer((req, res) => {
            let url = req.url;
            let file = contentBase + url.split('?').shift();
            let params = this.urlParamets(url);
            let suffixName = file.split('.').pop();
            let stats = utils.pathType(file);
            switch (stats) {
                case 1:
                    res.writeHead(200, {'content-type': (mine[suffixName] || "text/plain; charset=utf-8")});
                    if (params.preload === 'preload') {
                        res.write(JSON.stringify({
                            appboards: utils.getAllAppboards(config.sourceDir),
                            body: fs.readFileSync(file, 'utf8'),
                        }));
                        res.end();
                    } else {
                        fs.createReadStream(file).pipe(res);
                    }
                    break;

                case 2:
                    this.errorServer(res, 405);
                    break;

                default:
                    this.errorServer(res, 404);
                    break;
            }
        }).listen(port);
    },

    /**
     * 生成错误js
     * @param res
     * @param errorCode
     * @param errorMsg
     * @returns {string}
     */
    errorServer(res, errorCode, errorMsg) {
        if (res === true) {
            let data = fs.readFileSync(path.resolve(__dirname, 'error.js'), 'utf8');
            data += "";
            if (errorCode) {
                data = data.replace('你访问的页面出错了！', '你访问的页面出错了！ (' + errorCode + ')')
            }
            if (errorMsg) {
                data = data.replace('var errorMsg=decodeURIComponent("");', 'var errorMsg=decodeURIComponent("' + encodeURIComponent(errorMsg.replace(new RegExp(path.resolve(__dirname, '../../'), 'g'), '')) + '");')
            }
            return data;
        }
        fs.readFile(path.resolve(__dirname, 'error.js'), (err, data) => {
            if (err) {
                res.writeHead(404, { 'content-type': 'text/html' });
                res.write('<h1>404错误</h1><p>你要找的页面不存在</p>');
                res.end();
            } else {
                data += "";
                if (errorCode) {
                    data = data.replace('你访问的页面出错了！', '你访问的页面出错了！ (' + errorCode + ')')
                }
                if (errorMsg) {
                    data = data.replace('var errorMsg=decodeURIComponent("");', 'var errorMsg=decodeURIComponent("' + encodeURIComponent(errorMsg.replace(new RegExp(path.resolve(__dirname, '../../'), 'g'), '')) + '");')
                }
                res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
                res.write(data);
                res.end();
            }
        });
    },

    /**
     * 完整代码
     * @param assetsByChunkName
     */
    completeCode(assetsByChunkName) {
        utils.each(assetsByChunkName, (key, value) => {
            let assetPath = path.resolve(config.distDir, config.sourcePagesDir, value);
            let assetContent = fs.readFileSync(assetPath, 'utf8');
            let isEdit = false;
            if (!/^\/\/\s*{\s*"framework"\s*:\s*"Vue"\s*}/.exec(assetContent)) {
                assetContent = `// { "framework": "Vue"} \n` + assetContent;
                isEdit = true;
            }
            if (/((\s|{|\[|\(|,|;)console)\.(debug|log|info|warn|error)\((.*?)\)/.exec(assetContent)) {
                assetContent = utils.replaceEeuiLog(assetContent);
                isEdit = true;
            }
            if (/\.(requireModule|isRegisteredModule)\((['"])(eeui\/.*)\2\)/.exec(assetContent)) {
                assetContent = utils.replaceModule(assetContent);
                isEdit = true;
            }
            if (isEdit) {
                fs.writeFileSync(assetPath, assetContent);
            }
        });
    },

    /**
     * 复制其他文件
     * @param originDir
     * @param newDir
     * @param containAppboardDir
     */
    copyOtherFile(originDir, newDir, containAppboardDir) {
        let lists = fs.readdirSync(originDir);
        let appboardDir = path.resolve(config.sourceDir, 'appboard');
        lists.some((item) => {
            if (!utils.execPath(item)) {
                return false;
            }
            let originPath = path.resolve(originDir, item);
            let newPath = path.resolve(newDir, item);
            let stats = utils.pathType(originPath);
            if (stats === 1) {
                if (utils.leftExists(originPath, appboardDir)) {
                    if (containAppboardDir === true) {
                        let originContent = fs.readFileSync(originPath, 'utf8');
                        fse.outputFileSync(newPath, utils.replaceModule(utils.replaceEeuiLog(originContent)));
                    }
                } else {
                    fse.copySync(originPath, newPath);
                }
            } else if (stats === 2) {
                this.copyOtherFile(originPath, newPath, containAppboardDir)
            }
        });
    },

    /**
     * 复制文件（md5判断文件不一致才复制）
     * @param originPath
     * @param newPath
     * @param callback
     */
    copyFileMd5(originPath, newPath, callback) {
        let stream = fs.createReadStream(originPath);
        let md5sum = crypto.createHash('md5');
        stream.on('data', (chunk) => {
            md5sum.update(chunk);
        });
        stream.on('end', () => {
            let str = md5sum.digest("hex").toUpperCase();
            if (fileMd5Lists[newPath] !== str) {
                fileMd5Lists[newPath] = str;
                fse.copy(originPath, newPath, callback);
            }
        });
    },

    /**
     * babel处理appboard内文件
     * @param task
     */
    appboardGulpBabel(task) {
        let gulpBin = path.resolve('node_modules/gulp/bin/gulp.js');
        let gulpFile = path.resolve('gulpfile.js');
        if (!fs.existsSync(gulpBin) || !fs.existsSync(gulpFile)) {
            return false;
        }
        //
        let spinFetch = ora('babel appboard...');
        spinFetch.start();
        try {
            child_process.execSync("node " + gulpBin + " --gulpfile " + gulpFile + " " + (task || "default"), {encoding: 'utf8'});
            spinFetch.stop();
            return true;
        } catch (e) {
            spinFetch.stop();
            return false;
        }
    },

    /**
     * 复制编译文件至app资源目录
     * @param host
     * @param port
     * @param socketPort
     * @param removeBundlejs
     */
    syncFolderAndWebSocket(host, port, socketPort, removeBundlejs) {
        let isSocket = !!(host && socketPort);
        let hostUrl = 'http://' + host + ':' + port + "/";
        //
        let jsonData = require(path.resolve('eeui.config'));
        jsonData.socketHost = host ? host : '';
        jsonData.socketPort = socketPort ? socketPort : '';
        jsonData.socketHome = isSocket ? this.getHostIndexUrl(hostUrl + config.sourcePagesDir) : '';
        //
        let random = Math.random();
        let deviceIds = {};
        //
        let copyJsEvent = (originDir, newDir, rootDir) => {
            let lists = fs.readdirSync(originDir);
            lists.some((item) => {
                if (!utils.execPath(item)) {
                    return false;
                }
                let originPath = path.resolve(originDir, item);
                let newPath = path.resolve(newDir, item);
                let stats = utils.pathType(originPath);
                if (stats === 1) {
                    this.copyFileMd5(originPath, newPath, (err) => {
                        if (err || !socketAlready) {
                            return;
                        }
                        socketClients.some((client) => {
                            let deviceKey = client.deviceId + hostUrl + rootDir + item;
                            if (client.ws.readyState !== 2 && deviceIds[deviceKey] !== random) {
                                deviceIds[deviceKey] = random;
                                setTimeout(() => {
                                    utils.sendWebSocket(client.ws, client.version, {
                                        type: "RELOADPAGE",
                                        value: hostUrl + rootDir + item,
                                    });
                                }, 300);
                            }
                        });
                    });
                } else if (stats === 2) {
                    copyJsEvent(originPath, newPath, (rootDir || "") + item + "/")
                }
            });
        };
        //syncFiles
        let mainPath = path.resolve('platforms/android/eeuiApp/app/src/main/assets/eeui');
        let bundlejsPath = path.resolve('platforms/ios/eeuiApp/bundlejs/eeui');
        if (removeBundlejs) {
            fse.removeSync(mainPath);
            fse.removeSync(bundlejsPath);
            fse.outputFile(path.resolve(mainPath, 'config.json'), JSON.stringify(jsonData, null, "\t"));
            fse.outputFile(path.resolve(bundlejsPath, 'config.json'), JSON.stringify(jsonData, null, "\t"));
        }
        copyJsEvent(path.resolve(config.distDir), mainPath);
        copyJsEvent(path.resolve(config.distDir), bundlejsPath);
        //WebSocket
        if (isSocket) {
            if (socketAlready === false) {
                socketAlready = true;
                let WebSocketServer = require('ws').Server,
                    wss = new WebSocketServer({port: socketPort});
                wss.on('connection', (ws, info) => {
                    let deviceId = uuid.v4();
                    let mode = utils.getQueryString(info.url, "mode");
                    let version = utils.runNum(utils.getQueryString(info.url, "version"));
                    socketClients.push({deviceId, ws, version});
                    ws.on('close', () => {
                        socketClients.some((socketItem, i) => {
                            if (socketItem.deviceId === deviceId) {
                                socketClients.splice(i, 1);
                                return true;
                            }
                        });
                    });
                    //
                    switch (mode) {
                        case "initialize":
                            utils.sendWebSocket(ws, version, {
                                type: "HOMEPAGE",
                                value: this.getHostIndexUrl(hostUrl + config.sourcePagesDir),
                                appboards: utils.getAllAppboards(config.sourceDir)
                            });
                            break;

                        case "back":
                            utils.sendWebSocket(ws, version, {
                                type: "HOMEPAGEBACK",
                                value: this.getHostIndexUrl(hostUrl + config.sourcePagesDir),
                                appboards: utils.getAllAppboards(config.sourceDir)
                            });
                            break;

                        case "reconnect":
                            utils.sendWebSocket(ws, version, {
                                type: "RECONNECT",
                                value: this.getHostIndexUrl(hostUrl + config.sourcePagesDir),
                                appboards: utils.getAllAppboards(config.sourceDir)
                            });
                            break;
                    }
                });
            }
            notifier.notify({
                title: 'WiFi真机同步',
                message: jsonData.socketHost + ':' + jsonData.socketPort,
                contentImage: path.join(__dirname, 'logo.png')
            });
            socketTimeout && clearInterval(socketTimeout);
            socketTimeout = setTimeout(() => {
                let msg = '';
                msg+= chalk.bgGreen.bold.black(`【WiFI真机同步】`);
                msg+= chalk.bgGreen.black(`IP地址: `);
                msg+= chalk.bgGreen.bold.black.underline(`${jsonData.socketHost}`);
                msg+= chalk.bgGreen.black(`、端口号: `);
                msg+= chalk.bgGreen.bold.black.underline(`${jsonData.socketPort}`);
                console.log(); console.log(msg); console.log();
            }, 200);
        } else {
            child_process.fork(path.join(__dirname, 'buildNotify.js'));
        }
    },

    /**
     * 打包build目录
     */
    compressBuildDir() {
        let zipName = "build-" + utils.formatDate("YmdHis");
        let expand = require("../utils/expand");
        if (expand.androidGradle("versionName")) {
            zipName += "-";
            zipName += expand.androidGradle("versionName");
            if (expand.androidGradle("versionCode")) {
                zipName += "-";
                zipName += expand.androidGradle("versionCode");
            }
        }
        let zipPackPath = path.resolve(config.zipPackDir);
        utils.mkdirsSync(zipPackPath);
        utils.zipCompress({
            output: zipPackPath + "/" + zipName + ".zip",
            entry: [{
                type: 'dir',
                path: path.resolve(config.distDir)
            }]
        });
    },

    /**
     * 开发模式
     * @param isOnce
     * @returns {*}
     */
    dev(isOnce) {
        let gauge = new Gauge();
        let progress = 0;
        let options = {
            ext: 'vue',
            watch: !isOnce,
            minimize: false,
            devtool: false,
            mode: 'development',
            onProgress: (complete, action) => {
                if (complete > progress) {
                    progress = complete;
                } else {
                    complete = progress;
                }
                gauge.show(action, complete);
            }
        };
        if (fs.existsSync(path.resolve('babel.config.js'))) {
            options.babelOptions = require(path.resolve('babel.config.js'));
        } else if (fs.existsSync(path.resolve('.babelrc'))) {
            options.babelOptions = utils.jsonParse(fs.readFileSync(path.resolve('.babelrc'), 'utf8'));
        }
        //
        let serverStatus = 0;
        let socketPort = config.port;
        let serverPort = config.port_socket;
        let buildSuccess = [];
        let buildCallback = (error, output, info) => {
            gauge.hide();
            if (error) {
                console.log(chalk.red('Build Failed!'));
                utils.each(typeof error == 'object' ? error : [error], (index, item) => {
                    console.error(item);
                });
                utils.each(info.assetsByChunkName, (key, value) => {
                    fs.writeFileSync(path.resolve(config.distDir, config.sourcePagesDir, value), this.errorServer(true, 500, ansiHtml.toHtml(error)));
                });
            } else {
                console.log('Build completed!');
                console.log(output.toString());
                //
                this.completeCode(info.assetsByChunkName);
                if (options.watch) {
                    if (serverStatus === 0) {
                        serverStatus = 1;
                        this.portIsOccupied(serverPort, (err, port) => {
                            if (err) throw err;
                            this.portIsOccupied(socketPort, (err, sPort) => {
                                if (err) throw err;
                                serverPort = port;
                                socketPort = sPort;
                                this.createServer(path.resolve(config.distDir), serverPort);
                                this.copyOtherFile(path.resolve(config.sourceDir), path.resolve(config.distDir), true);
                                this.appboardGulpBabel('appboard-dev');
                                this.syncFolderAndWebSocket(ipv4, serverPort, socketPort, true);
                                serverStatus = 200;
                            });
                        });
                    }
                } else {
                    this.copyOtherFile(path.resolve(config.sourceDir), path.resolve(config.distDir), true);
                    this.appboardGulpBabel('appboard-dev');
                    this.syncFolderAndWebSocket(null, null, null, true);
                }
                //
                buildSuccess.forEach((tmpCallback) => { typeof tmpCallback === "function" && tmpCallback(); });
                buildSuccess = [];
            }
            if (serverStatus === 200) {
                this.copyOtherFile(path.resolve(config.sourceDir), path.resolve(config.distDir), false);
                this.syncFolderAndWebSocket(ipv4, serverPort, socketPort, false);
            }
        };
        //
        fse.removeSync(path.resolve(config.distDir));
        let mBuilder = new builder(`${config.sourceDir}/${config.sourcePagesDir}`, `${config.distDir}/${config.sourcePagesDir}`, options).build(buildCallback);
        //
        if (options.watch) {
            //监听appboard文件变化
            let watchListener = (filePath, content) => {
                if (utils.leftExists(filePath, "appboard/") && utils.rightExists(filePath, ".js") && socketAlready) {
                    content = utils.replaceModule(utils.replaceEeuiLog(content));
                    socketClients.some((client) => {
                        if (client.ws.readyState !== 2) {
                            utils.sendWebSocket(client.ws, client.version, {
                                type: "REFRESH",
                                appboards: [{
                                    path: filePath,
                                    content: content,
                                }],
                            });
                        }
                    });
                }
            };
            //监听文件变化
            (() => {
                let appboardDir = path.resolve(config.sourceDir, 'appboard'),
                    sourceDir = config.sourceDir,
                    distDir = config.distDir,
                    sourcePath,
                    sourceName;
                chokidar.watch(config.sourceDir, {
                    ignored: /[\/\\]\./,
                    persistent: true
                }).on('all', (event, filePath) => {
                    if (serverStatus !== 200) {
                        return;
                    }
                    sourcePath = path.resolve(filePath);
                    sourceName = path.relative(path.resolve(sourceDir), filePath);
                    if (/^win/.test(process.platform)) {
                        filePath = filePath.replace(/\\/g, "/");
                        sourceName = sourceName.replace(/\\/g, "/");
                    }
                    //
                    if (utils.rightExists(filePath, ".vue")) {
                        if (utils.leftExists(filePath, "src/pages/")) {
                            let fileName = path.relative(path.resolve("src/pages/"), filePath).replace(/\.\w+$/, '');
                            if (event === "add") {
                                mBuilder.insertEntry({
                                    fileName: fileName,
                                    sourcePath: sourcePath + "?entry=true"
                                });
                            } else if (event === "unlink") {
                                mBuilder.removeEntry({
                                    fileName: fileName
                                });
                            }
                        }
                    } else if (utils.execPath(sourcePath)) {
                        let distPath = path.resolve(distDir, sourceName);
                        if (sourceName == "entry.js") {
                            notifier.notify({
                                title: 'entry.js',
                                message: "修改的内容需要重编译才生效。",
                                contentImage: path.join(__dirname, 'logo.png')
                            });
                            logger.warn("检测到入口文件[entry.js]已变化，修改的内容需要重新编译才生效。");
                            return;
                        }
                        if (["add", "change"].indexOf(event) !== -1) {
                            let sourceContent = fs.readFileSync(sourcePath, 'utf8');
                            if (utils.leftExists(sourcePath, appboardDir)) {
                                fse.outputFileSync(distPath, utils.replaceModule(utils.replaceEeuiLog(sourceContent)));
                                this.appboardGulpBabel('appboard-dev --filePath ' + distPath);
                                if (fs.existsSync(distPath)) {
                                    sourceContent = fs.readFileSync(distPath, 'utf8');
                                }
                            } else {
                                fse.copySync(sourcePath, distPath);
                            }
                            buildSuccess.push(() => { watchListener(sourceName, sourceContent); });
                            mBuilder.webpackInvalidate();
                        } else if (["unlink"].indexOf(event) !== -1) {
                            fse.removeSync(path.resolve(sourceDir, '../platforms/android/eeuiApp/app/src/main/assets/eeui', sourceName));
                            fse.removeSync(path.resolve(sourceDir, '../platforms/ios/eeuiApp/bundlejs/eeui', sourceName));
                            fse.removeSync(distPath);
                            buildSuccess.push(() => { watchListener(sourceName, ""); });
                            mBuilder.webpackInvalidate();
                        }
                    }
                });
                //监听eeui.config配置文件
                chokidar.watch(path.resolve(sourceDir, '../eeui.config.js'), {
                    ignored: /[\/\\]\./,
                    persistent: true
                }).on('change', (s) => {
                    if (serverStatus !== 200) {
                        return;
                    }
                    notifier.notify({
                        title: 'eeui.config.js',
                        message: "修改的内容需要重编译运行App才生效。",
                        contentImage: path.join(__dirname, 'logo.png')
                    });
                    logger.warn("检测到配置文件[eeui.config.js]已变化，修改的内容可能需要重新编译运行App才起效。");
                    logger.sep();
                    utils.syncConfigToPlatforms();
                });
            })();
        }
        //
        return mBuilder;
    },

    /**
     * 编译模式
     * @param noZip
     */
    build(noZip) {
        let gauge = new Gauge();
        let progress = 0;
        let options = {
            ext: 'vue',
            watch: false,
            minimize: true,
            devtool: false,
            mode: 'production',
            onProgress: (complete, action) => {
                if (complete > progress) {
                    progress = complete;
                } else {
                    complete = progress;
                }
                gauge.show(action, complete);
            }
        };
        if (fs.existsSync(path.resolve('babel.config.js'))) {
            options.babelOptions = require(path.resolve('babel.config.js'));
        } else if (fs.existsSync(path.resolve('.babelrc'))) {
            options.babelOptions = utils.jsonParse(fs.readFileSync(path.resolve('.babelrc'), 'utf8'));
        }
        //
        let buildCallback = (error, output, info) => {
            gauge.hide();
            if (error) {
                console.log(chalk.red('Build Failed!'));
                utils.each(typeof error == 'object' ? error : [error], (index, item) => {
                    console.error(item);
                });
            } else {
                console.log('Build completed!');
                console.log(output.toString());
                //
                this.completeCode(info.assetsByChunkName);
                this.copyOtherFile(path.resolve(config.sourceDir), path.resolve(config.distDir), true);
                this.appboardGulpBabel('appboard-build');
                this.syncFolderAndWebSocket(null, null, null, true);
                if (noZip !== true) {
                    this.compressBuildDir();
                }
            }
        };
        fse.removeSync(path.resolve(config.distDir));
        return new builder(`${config.sourceDir}/${config.sourcePagesDir}`, `${config.distDir}/${config.sourcePagesDir}`, options).build(buildCallback);
    }
};