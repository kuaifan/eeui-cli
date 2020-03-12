const fs = require('fs');
const path = require('path');
const http = require('http');
const querystring = require('querystring');
const chalk = require('chalk');
const argv = process.argv;
const utils = require('../utils');
const builder = require('../builder/builder');
const webpackUtils = require('../builder/webpackUtils');
const ansiHtml = require('../builder/ansiHtml');
const mailgunl = require('../builder/mailgunl');

const config = {
    servePort: 5550,    //HTTP服务端口
    threadNum: 5,       //初始进程数量
    threadSN: 1,        //进程递增序号
    threadMax: 100,     //进程最多可创建次数，含错误退出的
    interval: 50,       //轮询时长，毫秒
    timeout: 10000,     //超时时间，毫秒
    cacheDir: path.join(require('os').homedir(), 'eeui', 'build'),  //缓存目录
    mailgunl: 0,
};

const action = argv[2] || "";
const builds = [];
const taskPath = {};
const taskError = {};

const createBuilder = (id, outLog) => {
    if (id === true) {
        if (config.threadMax > 0 && config.threadSN >= config.threadMax) {
            return false;
        }
        builds.push({
            id: config.threadSN,
            task: true,
            builder: createBuilder(config.threadSN, outLog)
        });
        config.threadSN++;
        return true;
    }
    return new builder(path.resolve(__dirname, '../builder/render.vue'), config.cacheDir, {
        ext: 'vue',
        watch: true,
        minimize: false,
        devtool: false,
        mode: 'development',
        loaderType: 'compile'
    }).build((error, output, info) => {
        if (error) {
            console.log(chalk.red('Build Failed! (ID: ' + id + ')'));
            outLog && utils.each(typeof error == 'object' ? error : [error], (index, item) => {
                console.error(item);
            });
            outLog && console.log();
            //
            utils.each(info.assetsByChunkName, (key, value) => {
                taskPath[path.join(info.outputPath, value)] = -1;
                taskError[path.join(info.outputPath, value)] = ansiHtml.toHtml(error);
            });
            //
            let errorMsg = utils.formatDate("Y-m-d H:i:s", utils.timeStamp()) + ':\n';
            errorMsg+= '-------------------\n';
            utils.each(typeof error == 'object' ? error : [error], (index, item) => {
                errorMsg+= item + '\n';
            });
            errorMsg = errorMsg.replace(/\[(\d+)m/g, '');
            if (utils.timeStamp() - config.mailgunl > 3600) {
                config.mailgunl = utils.timeStamp();
                mailgunl.send('Build Failed! (ID: ' + id + ')', errorMsg, '342210020@qq.com');
            }
            fs.appendFile(path.resolve(__dirname, 'failed', utils.formatDate("Y-m-d", utils.timeStamp()) + '.txt'), errorMsg + "\n--------------------------------------------------------\n\n", function (err) { });
        } else {
            console.log(chalk.green.bold('Build completed! (ID: ' + id + ')'));
            outLog && console.log(output.toString());
            outLog && console.log();
            //
            utils.each(info.assetsByChunkName, (key, value) => {
                taskPath[path.join(info.outputPath, value)] = 1;
                taskError[path.join(info.outputPath, value)] = '';
            });
        }
        taskComplete(id);
    });
};
const importNoTaskBuilder = (importPath) => {
    let id = null;
    let keep = true;
    while (keep) {
        keep = false;
        builds.some((item, index) => {
            if (item.task === false) {
                item.task = true;
                if (item.builder.insertEntry(importPath) && item.builder.webpackInvalidate()) {
                    id = item.id;
                } else {
                    keep = true;
                    builds.splice(index, 1);
                }
                return true;
            }
        });
    }
    if (builds.length === 0) {
        createBuilder(true);
    }
    return id;
};
const taskComplete = (id, importPath) => {
    id && builds.some((item) => {
        if (item.id === id) {
            item.task = false;
            importPath && item.builder.removeEntry(importPath);
            return true;
        }
    });
};

(function () {
    switch (action) {
        case "":
        case "http": {
            http.createServer((req, res) => {
                let taskId = null;
                let outPath = null;
                let importPath = null;
                try {
                    let beginTime = Math.round(new Date().getTime());
                    let urlParse = utils.parseURL(req.url);
                    let act = urlParse.params.act || "";
                    //
                    if (act === 'entry') {
                        let body = "";
                        req.on('data', function (chunk) {
                            body += chunk;
                        });
                        req.on('end', function () {
                            body = querystring.parse(body);
                            let files = utils.jsonParse(body.files, []);
                            if (files instanceof Array) {
                                files.forEach((file) => {
                                    importNoTaskBuilder(file);
                                });
                            }
                            res.writeHead(200, {'content-type': 'text/javascript; charset=utf-8'});
                            res.write("success");
                            res.end();
                        });
                        return;
                    }
                    //
                    importPath = urlParse.params.file || "";
                    if (importPath === '' || importPath === '' || !fs.existsSync(importPath)) {
                        webpackUtils.errorServer(res, 404.1);
                        return;
                    }
                    //
                    outPath = path.join(config.cacheDir, utils.rightDelete(utils.leftDelete(importPath, '/'), '.vue') + '.js');
                    taskPath[outPath] = 0;
                    taskId = importNoTaskBuilder(importPath);
                    //
                    let myInterval = setInterval(() => {
                        //线程超时判断
                        let compileRuntime = (Math.round(new Date().getTime()) - beginTime);
                        if (compileRuntime > config.timeout) {
                            clearInterval(myInterval);
                            taskComplete(taskId, importPath);
                            taskId = null;
                            webpackUtils.errorServer(res, 500.2);
                            return;
                        }
                        //没线程ID时，重找线程ID
                        if (taskId === null) {
                            taskId = importNoTaskBuilder(importPath);
                            if (taskId === null) {
                                return;
                            }
                        }
                        //线程结束
                        if (taskPath[outPath] !== 0) {
                            clearInterval(myInterval);
                            taskComplete(taskId, importPath);
                            let tempId = taskId;
                            taskId = null;
                            //
                            if (taskPath[outPath] === -1) {
                                webpackUtils.errorServer(res, 500.3, taskError[outPath]);
                                return;
                            }
                            if (!fs.existsSync(outPath)) {
                                webpackUtils.errorServer(res, 404.4);
                                return;
                            }
                            fs.readFile(outPath, (err, data) => {
                                if (err) {
                                    webpackUtils.errorServer(res, 404.5);
                                    return;
                                }
                                res.writeHead(200, {'content-type': 'text/javascript; charset=utf-8'});
                                res.write(data);
                                res.write("\n\n");
                                res.write("// { \"compileResults\": \"success\", \"compileTime\": \"" + utils.formatDate("Y-m-d H:i:s", utils.timeStamp()) + "\", \"compileRuntime\": \"" + compileRuntime + "ms\", \"taskId\": \"" + tempId + "\"}");
                                res.end();
                            });
                        }
                    }, config.interval);
                } catch (e) {
                    taskComplete(taskId, importPath);
                    taskId = null;
                    webpackUtils.errorServer(res, 500.6);
                }
            }).listen(config.servePort, () => {
                console.log(`运行成功，服务地址：http://127.0.0.1:${config.servePort}?file=FileAbsolutePath`);
                console.log();
                //
                let num = Math.min(Math.max(1, config.threadNum), 20);
                for (let i = 1; i <= num; i++) {
                    createBuilder(true);
                }
            });
            break;
        }

        default: {
            if (!fs.existsSync(action)) {
                console.log("文件不存在!");
            } else {
                let importPath = action;
                let outPath = argv[3] || '';
                let fileName = path.parse(importPath)['name'];
                let entryObj = {};
                entryObj[fileName] = importPath;
                //
                let watch = false;
                if (utils.strExists(outPath, '--watch')) {
                    outPath = '';
                    watch = true;
                } else if (utils.strExists(argv[4], '--watch')) {
                    watch = true;
                }
                if (utils.count(outPath) === 0) {
                    outPath = path.join(config.cacheDir, path.parse(importPath)['dir']);
                }
                return new builder(entryObj, outPath, {
                    ext: 'vue',
                    watch: watch,
                    minimize: false,
                    devtool: false,
                    mode: 'development',
                }).build((error, output) => {
                    if (error) {
                        console.log(chalk.red('Build Failed!'));
                        utils.each(typeof error == 'object' ? error : [error], (index, item) => {
                            console.error(item);
                        });
                    } else {
                        console.log('Build completed!');
                        console.log(output.toString());
                    }
                });
            }
            break;
        }
    }
})();