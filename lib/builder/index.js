const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fsEx = require('fs-extra');
const uuid = require('uuid');
const ip = require('internal-ip').v4.sync();
const net = require('net');
const chalk = require('chalk');
const Gauge = require('gauge');
const archiver = require("archiver");
const notifier = require('node-notifier');
const child_process = require('child_process');
const eeuiBuilder = require('./eeuiBuilder');
const ansiHtml = require('./ansiHtml');
const config = require('../../config');
const utils = require('../utils');
const mine = require('../utils/mine').types;
const dirCut = /^win/.test(process.platform) ? "\\" : "/";

let socketAlready = false;
let socketTimeout = null;
let socketClients = [];
let fileMd5Lists = {};

module.exports = {
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

    getHostIndexUrl(dirName) {
        let indexName = 'index.js';
        let homePage = utils.getObject(require(path.resolve('eeui.config')), 'homePage').trim();
        if (utils.count(homePage) > 0) {
            if (utils.leftExists(homePage, "http://") || utils.leftExists(homePage, "https://") || utils.leftExists(homePage, "ftp://") || utils.leftExists(homePage, "file://")) {
                return homePage;
            }
            let lastUrl = homePage.substring(homePage.lastIndexOf("/"), homePage.length);
            if (!utils.strExists(lastUrl, ".")) {
                homePage+= ".js";
            }
            indexName = homePage;
        }
        return dirName + "/" + indexName;
    },

    createServer(contentBase, port) {
        http.createServer((req, res) => {
            let url = req.url;
            let file = contentBase + url.split('?').shift();
            let suffixName = file.split('.').pop();
            try {
                let stats = fs.statSync(file);
                if (typeof stats === 'object') {
                    if (stats.isFile()) {
                        res.writeHeader(200, {'content-type': (mine[suffixName] || "text/plain")});
                        fs.createReadStream(file).pipe(res);
                    } else if (stats.isDirectory()) {
                        this.errorServer(res, 405);
                    }
                    return;
                }
            } catch (e) {
                //
            }
            this.errorServer(res, 404);
        }).listen(port);
    },

    errorServer(res, errorCode, errorMsg) {
        if (res === true) {
            let data = fs.readFileSync(__dirname + '/error.js', 'utf8');
            data += "";
            if (errorCode) {
                data = data.replace('你访问的页面出错了！', '你访问的页面出错了！ (' + errorCode + ')')
            }
            if (errorMsg) {
                data = data.replace('var errorMsg=decodeURIComponent("");', 'var errorMsg=decodeURIComponent("' + encodeURIComponent(errorMsg.replace(new RegExp(path.join(__dirname, '../../'), 'g'), '')) + '");')
            }
            return data;
        }
        fs.readFile(__dirname + '/error.js', (err, data) => {
            if (err) {
                res.writeHeader(404, { 'content-type': 'text/html' });
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
                res.writeHeader(200, { 'content-type': 'application/javascript' });
                res.write(data);
                res.end();
            }
        });
    },

    copySrcToDist() {
        let _copyEvent = (originDir, newDir) => {
            let lists = fs.readdirSync(originDir);
            let appboardDir = path.resolve(config.sourceDir, 'appboard');
            lists.forEach((item) => {
                let originPath = originDir + "/" + item;
                let newPath = newDir + "/" + item;
                try {
                    let stats = fs.statSync(originPath);
                    if (typeof stats === 'object') {
                        if (stats.isFile()) {
                            if (utils.execPath(originPath) && !fs.existsSync(newPath)) {
                                if (utils.leftExists(originPath, appboardDir)) {
                                    let originContent = fs.readFileSync(originPath, 'utf8');
                                    fsEx.outputFileSync(newPath, utils.replaceEeuiLog(originContent));
                                }else{
                                    fsEx.copySync(originPath, newPath);
                                }
                            }
                        } else if (stats.isDirectory()) {
                            _copyEvent(originPath, newPath)
                        }
                    }
                }catch (e) {
                    //
                }
            });
        };
        _copyEvent(path.resolve(config.sourceDir), path.resolve(config.distDir));
    },

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
                fsEx.copy(originPath, newPath, callback);
            }
        });
    },

    syncFolderEvent(host, port, socketPort, removeBundlejs) {
        let isSocket = !!(host && socketPort);
        let hostUrl = 'http://' + host + ':' + port + "/";
        //
        let jsonData = require(path.resolve('eeui.config'));
        jsonData.socketHost = host ? host : '';
        jsonData.socketPort = socketPort ? socketPort : '';
        jsonData.socketHome = isSocket ? this.getHostIndexUrl(hostUrl + config.sourcePagesDir) : '';
        jsonData.wxpay.appid = utils.getObject(jsonData, 'wxpay.appid');
        //
        let random = Math.random();
        let deviceIds = {};
        //
        let copyJsEvent = (originDir, newDir, rootDir) => {
            let lists = fs.readdirSync(originDir);
            lists.forEach((item) => {
                let originPath = originDir + "/" + item;
                let newPath = newDir + "/" + item;
                if (utils.execPath(originPath)) {
                    fs.stat(originPath, (err, stats) => {
                        if (typeof stats === 'object') {
                            if (stats.isFile()) {
                                this.copyFileMd5(originPath, newPath, (err) => {
                                    //!err && console.log(newPath);
                                    if (!err && socketAlready) {
                                        socketClients.map((client) => {
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
                                    }
                                });
                            } else if (stats.isDirectory()) {
                                copyJsEvent(originPath, newPath, (rootDir || "") + item + "/")
                            }
                        }
                    });
                }
            });
        };
        //syncFile Android
        fs.stat(path.resolve('platforms/android'), (err, stats) => {
            if (typeof stats === 'object' && stats.isDirectory()) {
                let androidLists = fs.readdirSync(path.resolve('platforms/android'));
                androidLists.forEach((item) => {
                    let mainPath = 'platforms/android/' + item + '/app/src/main';
                    let assetsPath = mainPath + '/assets/eeui';
                    fs.stat(path.resolve(mainPath), (err, stats) => {
                        if (typeof stats === 'object' && stats.isDirectory()) {
                            if (removeBundlejs) {
                                fsEx.remove(path.resolve(assetsPath), (err) => {
                                    if (err) throw err;
                                    fsEx.outputFile(path.resolve(assetsPath + '/config.json'), JSON.stringify(jsonData));
                                    copyJsEvent(path.resolve(config.distDir), path.resolve(assetsPath));
                                });
                            }else{
                                copyJsEvent(path.resolve(config.distDir), path.resolve(assetsPath));
                            }
                        }
                    });
                });
            }
        });
        //syncFile iOS
        fs.stat(path.resolve('platforms/ios'), (err, stats) => {
            if (typeof stats === 'object' && stats.isDirectory()) {
                let iosLists = fs.readdirSync(path.resolve('platforms/ios'));
                iosLists.forEach((item) => {
                    let mainPath = 'platforms/ios/' + item;
                    let bundlejsPath = mainPath + '/bundlejs/eeui';
                    fs.stat(path.resolve(mainPath), (err, stats) => {
                        if (typeof stats === 'object' && stats.isDirectory()) {
                            if (removeBundlejs) {
                                fsEx.remove(path.resolve(bundlejsPath), (err) => {
                                    if (err) throw err;
                                    fsEx.outputFile(path.resolve(bundlejsPath + '/config.json'), JSON.stringify(jsonData));
                                    copyJsEvent(path.resolve(config.distDir), path.resolve(bundlejsPath));
                                });
                            }else{
                                copyJsEvent(path.resolve(config.distDir), path.resolve(bundlejsPath));
                            }
                        }
                    });
                    let plistPath = 'platforms/ios/' + item + '/eeuiApp/Info.plist';
                    utils.replaceDictString(path.resolve(plistPath), 'eeuiAppWxappid', jsonData.wxpay.appid);
                });
            }
        });
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
            }, 100);
        } else {
            child_process.fork(path.join(__dirname, 'buildNotify.js'));
        }
    },

    dev() {
        let gauge = new Gauge();
        let maxProgress = 0;
        let options = {
            watch: true,
            ext: 'vue',
            web: false,
            min: false,
            devtool: undefined,
            config: undefined,
            base: undefined,
            sourceDir: config.sourceDir,
            distDir: config.distDir,
            onSocketClient: (path, content) => {
                if (utils.leftExists(path, "appboard/") && utils.rightExists(path, ".js") && socketAlready) {
                    content = utils.replaceEeuiLog(content);
                    socketClients.map((client) => {
                        if (client.ws.readyState !== 2) {
                            utils.sendWebSocket(client.ws, client.version, client.version === 2 ? {
                                type: "REFRESH",
                                appboards: [{
                                    path: path,
                                    content: content,
                                }],
                            } : {
                                type: "APPBOARDCONTENT",
                                value: path + '::' + content,
                            });
                        }
                    });
                }
            },
            onProgress: (complete, action) => {
                if (complete > maxProgress) {
                    maxProgress = complete;
                } else {
                    complete = maxProgress;
                }
                gauge.show(action, complete);
            }
        };
        fsEx.removeSync(path.resolve(config.distDir));
        //
        let serverStatus = 0;
        let socketPort = config.port;
        let serverPort = config.port_socket;
        let callback = (error, output, info) => {
            gauge.hide();
            if (error) {
                console.log(chalk.red('Build Failed!'));
                utils.each(typeof error == 'object' ? error : [error], (index, item) => { console.error(item); });
                utils.each(info.assetsByChunkName, (key, value) => {
                    fs.writeFileSync(path.join(path.resolve(config.distDir), config.sourcePagesDir, value), this.errorServer(true, 500, ansiHtml.toHtml(error)));
                });
            } else {
                console.log('Build completed!');
                console.log(output.toString());
                //
                if (serverStatus === 0) {
                    serverStatus = 1;
                    this.portIsOccupied(serverPort, (err, port) => {
                        if (err) throw err;
                        this.portIsOccupied(socketPort, (err, sPort) => {
                            if (err) throw err;
                            serverStatus = 200;
                            serverPort = port;
                            socketPort = sPort;
                            this.createServer(path.resolve(config.distDir), serverPort);
                            this.copySrcToDist();
                            this.syncFolderEvent(ip, serverPort, socketPort, true);
                        });
                    });
                }
            }
            if (serverStatus === 200) {
                this.copySrcToDist();
                this.syncFolderEvent(ip, serverPort, socketPort, false);
            }
        };
        return new eeuiBuilder(`${config.sourceDir}/${config.sourcePagesDir}`, `${config.distDir}/${config.sourcePagesDir}`, options).build(callback);
    },

    build(noZip) {
        let gauge = new Gauge();
        let maxProgress = 0;
        let options = {
            watch: false,
            ext: 'vue',
            web: false,
            min: true,
            devtool: undefined,
            config: undefined,
            base: undefined,
            sourceDir: config.sourceDir,
            distDir: config.distDir,
            onSocketClient: (name, content) => {
                //
            },
            onProgress: (complete, action) => {
                if (complete > maxProgress) {
                    maxProgress = complete;
                } else {
                    complete = maxProgress;
                }
                gauge.show(action, complete);
            }
        };
        fsEx.removeSync(path.resolve(config.distDir));
        //
        let callback = (error, output) => {
            gauge.hide();
            if (error) {
                console.log(chalk.red('Build Failed!'));
                utils.each(typeof error == 'object' ? error : [error], (index, item) => { console.error(item); });
            } else {
                console.log('Build completed!');
                console.log(output.toString());
                this.copySrcToDist();
                if (noZip !== true) {
                    this.buildZipPack();
                }
                this.syncFolderEvent(null, null, null, true);
            }
        };
        return new eeuiBuilder(`${config.sourceDir}/${config.sourcePagesDir}`, `${config.distDir}/${config.sourcePagesDir}`, options).build(callback);
    },

    buildZipPack() {
        let zipPackPath = path.resolve(config.zipPackDir); utils.mkdirsSync(zipPackPath);
        let zipPath = zipPackPath + "/build-" + utils.formatDate("YmdHis") + ".zip";
        let zipOut = fs.createWriteStream(zipPath);
        let archive = archiver('zip', null);
        let distDir = path.resolve(config.distDir) + dirCut;
        let lists = utils.fileDirDisplay(distDir);
        for (let index in lists.dir) {
            if (!lists.dir.hasOwnProperty(index)) continue;
            let tmp = lists.dir[index];
            archive.directory(tmp, utils.leftDelete(tmp, distDir), null);
        }
        for (let index in lists.file) {
            if (!lists.file.hasOwnProperty(index)) continue;
            let tmp = lists.file[index];
            archive.file(tmp, {name: utils.leftDelete(tmp, distDir)});
        }
        archive.pipe(zipOut);
        archive.finalize();
    }
};
