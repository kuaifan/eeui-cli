const fs = require('fs');
const fse = require("fs-extra");
const path = require("path");
const urls = require("url");
const chalk = require('chalk');
const lodash = require("lodash");
const child_process = require('child_process');
const inquirer = require('inquirer');
const ora = require('ora');
const request = require('request');
const tmp = require('tmp');
const compressing = require('compressing');
const config = require('../../config');
const logger = require('../utils/logger');


const utils = {

    consoleUrl(support) {
        if (support === true) {
            let configFile = path.resolve(process.cwd(), "eeui.config.js");
            if (fs.existsSync(configFile)) {
                let releaseConfig = {};
                try{
                    releaseConfig = require(configFile);
                }catch (e) {
                    //
                }
                if (releaseConfig['consoleUrl'] && this.leftExists(releaseConfig['consoleUrl'], 'http')) {
                    return releaseConfig['consoleUrl'];
                }
            }
        }
        return 'https://console.eeui.app/';
    },

    apiUrl(support) {
        return this.consoleUrl(support) + 'api/';
    },

    buildJS(cmd = 'build') {
        console.log(` => ${chalk.blue.bold('npm install&build')}`);
        return this.exec('npm install', true).then(() => {
            return this.exec('webpack --env.NODE_ENV=' + cmd);
        })
    },

    exec(command, quiet) {
        return new Promise((resolve, reject) => {
            try {
                let child = child_process.exec(command, {encoding: 'utf8'}, () => {
                    resolve();
                });
                if (!quiet) {
                    child.stdout.pipe(process.stdout);
                }
                child.stderr.pipe(process.stderr);
            } catch (e) {
                console.error('execute command failed :', command);
                reject(e);
            }
        })
    },

    parseDevicesResult(result) {
        if (!result) {
            return [];
        }
        const devices = [];
        const lines = result.trim().split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            let words = lines[i].split(/[ ,\t]+/).filter((w) => w !== '');

            if (words[1] === 'device') {
                devices.push(words[0]);
            }
        }
        return devices;
    },

    mkdirsSync(dirname) {
        if (fse.existsSync(dirname)) {
            return true;
        } else {
            if (this.mkdirsSync(path.dirname(dirname))) {
                fse.mkdirSync(dirname);
                return true;
            }
        }
    },

    getMiddle(string, start, end) {
        if (this.isHave(start) && this.strExists(string, start)) {
            string = string.substring(string.indexOf(start) + start.length);
        } else if (start !== null) {
            return "";
        }
        if (this.isHave(end) && this.strExists(string, end)) {
            string = string.substring(0, string.indexOf(end));
        } else if (end !== null) {
            return "";
        }
        return string;
    },

    isHave(set) {
        return !!(set !== null && set !== "null" && set !== undefined && set !== "undefined" && set);
    },

    isNullOrUndefined(obj) {
        return typeof obj === "undefined" || obj === null;
    },

    isObject(obj) {
        return this.isNullOrUndefined(obj) ? false : typeof obj === "object";
    },

    likeArray(obj) {
        return this.isObject(obj) && typeof obj.length === 'number';
    },

    isJson(obj) {
        return this.isObject(obj) && !this.likeArray(obj);
    },

    strExists(string, find, lower) {
        string += "";
        find += "";
        if (lower !== true) {
            string = string.toLowerCase();
            find = find.toLowerCase();
        }
        return (string.indexOf(find) !== -1);
    },

    leftExists(string, find) {
        string += "";
        find += "";
        return (string.substring(0, find.length) === find);
    },

    rightExists(string, find) {
        string += "";
        find += "";
        return (string.substring(string.length - find.length) === find);
    },

    leftDelete(string, find) {
        string += "";
        find += "";
        if (this.leftExists(string, find)) {
            string = string.substring(find.length)
        }
        return string ? string : '';
    },

    rightDelete(string, find) {
        string += "";
        find += "";
        if (this.rightExists(string, find)) {
            string = string.substring(0, string.length - find.length)
        }
        return string ? string : '';
    },

    findIndexOf(str, cha, num) {
        str+= "";
        cha+= "";
        let x = str.indexOf(cha);
        for (let i = 0; i < num; i++) {
            x = str.indexOf(cha, x + 1);
            if (x === -1) {
                break;
            }
        }
        return x;
    },

    clone(myObj) {
        if (typeof(myObj) !== 'object') return myObj;
        if (myObj === null) return myObj;
        //
        if (this.likeArray(myObj)) {
            let [...myNewObj] = myObj;
            return myNewObj;
        } else {
            let {...myNewObj} = myObj;
            return myNewObj;
        }
    },

    count(obj) {
        try {
            if (typeof obj === "undefined") {
                return 0;
            }
            if (typeof obj === "number") {
                obj+= "";
            }
            if (typeof obj.length === 'number') {
                return obj.length;
            } else {
                let i = 0, key;
                for (key in obj) {
                    i++;
                }
                return i;
            }
        }catch (e) {
            return 0;
        }
    },

    each(elements, callback) {
        let i, key;
        if (this.likeArray(elements)) {
            if (typeof elements.length === "number") {
                for (i = 0; i < elements.length; i++) {
                    if (callback.call(elements[i], i, elements[i]) === false) return elements
                }
            }
        } else {
            for (key in elements) {
                if (!elements.hasOwnProperty(key)) continue;
                if (callback.call(elements[key], key, elements[key]) === false) return elements
            }
        }

        return elements
    },

    getObject(obj, keys) {
        let object = obj;
        if (this.count(obj) === 0 || this.count(keys) === 0) {
            return "";
        }
        let arr = keys.replace(/,/g, "|").replace(/\./g, "|").split("|");
        this.each(arr, (index, key) => {
            object = typeof object[key] === "undefined" ? "" : object[key];
        });
        return object;
    },

    moveEmptyDirParent(dirPath) {
        let lists = this.fileDirDisplay(dirPath);
        if (lists.dir.length === 0 && lists.file.length === 0) {
            if (fs.existsSync(dirPath)) {
                fse.removeSync(dirPath);
            }
            this.moveEmptyDirParent(path.resolve(dirPath, '../'));
        }
    },

    fileDirDisplay(dirPath, currentDir) {
        let lists = {
            'dir': [],
            'file': [],
        };
        let stats = this.pathType(dirPath);
        switch (stats) {
            case 1:
                lists.file.push(dirPath);
                return lists;
            case 0:
                return lists;
        }
        let files = fs.readdirSync(dirPath);
        files.some((filename) => {
            let filedir = path.join(dirPath, filename);
            if ([".git", ".DS_Store", "__MACOSX"].indexOf(filename) !== -1) {
                return false;
            }
            if (this.rightExists(filename, ".iml") || this.rightExists(filename, ".xcuserdatad")) {
                return false;
            }
            if (this.rightExists(filedir, path.join("android", "build"))) {
                return false;
            }
            let stats = this.pathType(filedir);
            if (stats === 1) {
                lists.file.push(filedir);
            } else if (stats === 2 && currentDir !== true) {
                lists.dir.push(filedir);
                let tmps = this.fileDirDisplay(filedir);
                lists.dir = lists.dir.concat(tmps.dir);
                lists.file = lists.file.concat(tmps.file);
            }
        });
        return lists;
    },

    replaceDictString(path, key, value) {
        if (!fs.existsSync(path)) {
            return;
        }
        let content = fs.readFileSync(path, 'utf8');
        let matchs = content.match(/<dict>(.*?)<\/dict>/g);
        if (matchs) {
            matchs.forEach((oldText) => {
                oldText = oldText.substring(oldText.lastIndexOf('<dict>'), oldText.length);
                if (this.strExists(oldText, '<string>' + key + '</string>', true)) {
                    let searchValue = this.getMiddle(oldText, '<array>', '</array>');
                    if (searchValue) {
                        searchValue = '<array>' + searchValue + '</array>';
                        let stringValue = '<string>' + this.getMiddle(searchValue, '<string>', '</string>') + '</string>';
                        let replaceValue = searchValue.replace(new RegExp(stringValue, "g"), '<string>' + value + '</string>');
                        let newText = oldText.replace(new RegExp(searchValue, "g"), replaceValue);
                        let result = fs.readFileSync(path, 'utf8').replace(new RegExp(oldText, "g"), newText);
                        if (result) {
                            fs.writeFileSync(path, result, 'utf8');
                        }
                    }
                }
            });
        }
    },

    replaceEeuiLog(source) {
        let rege = new RegExp("((\\s|{|\\[|\\(|,|;)console)\\.(debug|log|info|warn|error)\\((.*?)\\)", "g");
        let result;
        while ((result = rege.exec(source)) != null) {
            let newString = result[0].replace(result[1], result[2] + "eeuiLog");
            source = source.replace(result[0], newString);
        }
        return source;
    },

    replaceModule(source) {
        var rege = new RegExp("\\.(requireModule|isRegisteredModule)\\(([\'\"])(.*?)\\2\\)", "g");
        var result;
        while ((result = rege.exec(source)) != null) {
            var name = result[3];
            if ([
                'websocket',
                'screenshots',
                'citypicker',
                'picture',
                'rongim',
                'umeng',
                'pay',
                'audio',
                'deviceInfo',
                'communication',
                'geolocation',
                'recorder',
                'accelerometer',
                'compass',
                'amap',
                'seekbar',
                'network',
            ].indexOf(name) !== -1) {
                name = 'eeui/' + name;
            }
            if (utils.strExists(name, "/")) {
                var newString = result[0].replace(result[3], utils.spritUpperCase(name));
                source = source.replace(result[0], newString);
            }
        }
        return source;
    },

    getQueryString: (search, name) => {
        let reg = new RegExp("(^|&|\\?)" + name + "=([^&]*)", "i");
        let r = search.match(reg);
        if (r != null) return (r[2]);
        return "";
    },

    removeRubbish(dirPath) {
        let lists = [];
        try {
            let files = fs.readdirSync(dirPath);
            files.some((filename) => {
                let filedir = path.join(dirPath, filename);
                if ([".git", ".DS_Store", "__MACOSX"].indexOf(filename) !== -1) {
                    fse.removeSync(filedir);
                    lists.push(filedir);
                    return false;
                }
                if (this.rightExists(filename, ".iml") || this.rightExists(filename, ".xcuserdatad")) {
                    fse.removeSync(filedir);
                    lists.push(filedir);
                    return false;
                }
                if (this.rightExists(filedir, path.join("android", "build"))) {
                    fse.removeSync(filedir);
                    lists.push(filedir);
                    return false;
                }
                //
                let stats = this.pathType(filedir);
                if (stats === 2) {
                    this.removeRubbish(filedir);
                }
            });
            return lists;
        }catch (e) {
            return lists;
        }
    },

    /**
     * @param str
     * @param defaultVal
     * @returns {Object|*}
     */
    jsonParse(str, defaultVal) {
        try{
            return JSON.parse(str);
        }catch (e) {
            return defaultVal ? defaultVal : {};
        }
    },

    /**
     *
     * @param json
     * @param defaultVal
     * @returns {string|*}
     */
    jsonStringify(json, defaultVal) {
        try{
            return JSON.stringify(json);
        }catch (e) {
            return defaultVal ? defaultVal : "";
        }
    },

    runNum(str, fixed) {
        let _s = Number(str);
        if (_s + "" === "NaN") {
            _s = 0;
        }
        if (/^[0-9]*[1-9][0-9]*$/.test(fixed)) {
            _s = _s.toFixed(fixed);
            let rs = _s.indexOf('.');
            if (rs < 0) {
                _s += ".";
                for (let i = 0; i < fixed; i++) {
                    _s += "0";
                }
            }
        }
        return _s;
    },

    zeroFill(str, length, after) {
        str += "";
        if (str.length >= length) {
            return str;
        }
        let _str = '', _ret = '';
        for (let i = 0; i < length; i++) {
            _str += '0';
        }
        if (after || typeof after === 'undefined') {
            _ret = (_str + "" + str).substr(length * -1);
        } else {
            _ret = (str + "" + _str).substr(0, length);
        }
        return _ret;
    },

    timeStamp() {
        return Math.round(new Date().getTime() / 1000);
    },

    formatDate(format, v) {
        if (format === '') {
            format = 'Y-m-d H:i:s';
        }
        if (typeof v === 'undefined') {
            v = new Date().getTime();
        } else if (/^(-)?\d{1,10}$/.test(v)) {
            v = v * 1000;
        } else if (/^(-)?\d{1,13}$/.test(v)) {
            v = v * 1000;
        } else if (/^(-)?\d{1,14}$/.test(v)) {
            v = v * 100;
        } else if (/^(-)?\d{1,15}$/.test(v)) {
            v = v * 10;
        } else if (/^(-)?\d{1,16}$/.test(v)) {
            v = v * 1;
        } else {
            return v;
        }
        let dateObj = new Date(v);
        if (parseInt(dateObj.getFullYear()) + "" === "NaN") {
            return v;
        }
        //
        format = format.replace(/Y/g, dateObj.getFullYear());
        format = format.replace(/m/g, this.zeroFill(dateObj.getMonth() + 1, 2));
        format = format.replace(/d/g, this.zeroFill(dateObj.getDate(), 2));
        format = format.replace(/H/g, this.zeroFill(dateObj.getHours(), 2));
        format = format.replace(/i/g, this.zeroFill(dateObj.getMinutes(), 2));
        format = format.replace(/s/g, this.zeroFill(dateObj.getSeconds(), 2));
        return format;
    },

    renderSize(value) {
        if (null == value || value === '') {
            return "0B";
        }
        let unitArr = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
        let index,
            srcsize = parseFloat(value);
        index = Math.floor(Math.log(srcsize) / Math.log(1024));
        let size = srcsize / Math.pow(1024, index);
        if (srcsize > 1024 * 1024) {
            size = size.toFixed(2);
        }else{
            size = Math.round(size);
        }
        let ret = (size + unitArr[index]) + "";
        return (ret.indexOf("NaN") !== -1) ? "0B" : ret;
    },

    execPath(originPath) {
        return !/(\.web\.map|\.DS_Store|__MACOSX|Thumbs\.db|\.vue)$/.exec(originPath);
    },

    setToken(token) {
        let cachePath = path.join(require('os').homedir(), '.' + config.cacheDirName, 'token.cache');
        fse.ensureFileSync(cachePath);
        let cache = this.jsonParse(fs.readFileSync(cachePath, 'utf8'));
        cache.token = token;
        fs.writeFileSync(cachePath, this.jsonStringify(cache), 'utf8');
    },

    getToken() {
        let cachePath = path.join(require('os').homedir(), '.' + config.cacheDirName, 'token.cache');
        fse.ensureFileSync(cachePath);
        let cache = this.jsonParse(fs.readFileSync(cachePath, 'utf8'));
        return this.getObject(cache, 'token');
    },

    login(support, callback) {
        if (typeof support === 'function') {
            callback = support;
            support = false;
        }
        logger.warn('请使用' + utils.consoleUrl(support) + '账号登录');
        inquirer.prompt([{
            type: 'input',
            name: 'username',
            message: "请输入用户名：",
        }, {
            type: 'password',
            name: 'userpass',
            message: "请输入登录密码：",
        }]).then((answers) => {
            let spinFetch = ora('正在登录...').start();
            request(utils.apiUrl(support) + 'users/login?username=' + answers.username + "&userpass=" + answers.userpass, (err, res, body) => {
                spinFetch.stop();
                let data = this.jsonParse(body);
                if (data.ret !== 1) {
                    logger.fatal(`登录失败：${data.msg}`);
                }
                this.setToken(data.data.token);
                //
                if (typeof callback === "function") {
                    callback(data.data);
                }
            });
        }).catch(console.error);
    },

    logout(callback) {
        this.setToken("");
        if (typeof callback === "function") {
            callback();
        }
    },

    projectVersion() {
        let file = path.resolve(process.cwd(), "eeui.config.js");
        let pack = path.resolve(process.cwd(), "package.json");
        let vers = "";
        if (fse.existsSync(file) && fse.existsSync(pack)) {
            vers = require(path.resolve(process.cwd(), "package.json")).version;
        }
        return vers;
    },

    versionFunegt(v1, v2) {
        //相等：0，前面大：1，前面小：-1
        v1 = (v1 + "").toLowerCase().replace(/^\s+|\s+$/g, "").replace(/^\.|\.$/g, "").replace(/^\s+|\s+$/g, "");
        v2 = (v2 + "").toLowerCase().replace(/^\s+|\s+$/g, "").replace(/^\.|\.$/g, "").replace(/^\s+|\s+$/g, "");
        if (v1 === v2) {
            return 0;
        }
        if (/^[0-9]+$/.test(v1) && /^[0-9]+$/.test(v2)) {
            v1 = Number(v1);
            v2 = Number(v2);
            if (v1 === v2) {
                return 0;
            }
            return v1 > v2 ? 1 : -1;
        }
        let res;
        let e1 = /^\d+/.exec(v1);
        let e2 = /^\d+/.exec(v2);
        if (e1 == null || e2 == null) {
            res = [v1, v2].sort()[1];
            return res === v1 ? 1 : -1
        }
        res = utils.versionFunegt(e1[0], e2[0]);
        if (res !== 0) {
            return res;
        }
        return utils.versionFunegt(v1.substring(e1[0].length), v2.substring(e2[0].length));
    },

    verifyeeuiProject() {
        //判断是否eeui项目
        let file = path.resolve(process.cwd(), "eeui.config.js");
        if (!fs.existsSync(file)) {
            logger.fatal(`当前目录非eeui项目，无法进行此操作！`);
        }
        //判断eeui-cli版本需求
        file = path.resolve(process.cwd(), "package.json");
        if (fs.existsSync(file)) {
            let packageInfo = utils.jsonParse(fs.readFileSync(file, 'utf8'));
            let current = require('../../package.json').version;
            let eeuiclimin = packageInfo.eeuiclimin;
            if (utils.isHave(eeuiclimin) && utils.versionFunegt(eeuiclimin, current) > 0) {
                logger.fatal(`当前${chalk.underline(`eeui-cli@${current}`)}版本过低，请升级至${chalk.underline(`eeui-cli@${eeuiclimin}`)}或以上！${chalk.underline(`https://www.npmjs.com/package/eeui-cli`)}`);
            }
        }
    },

    verifyeeuiTemplate() {
        //判断是否新eeuiApp模板
        if (utils.versionFunegt("2.0.0", utils.projectVersion()) > 0) {
            logger.fatal(`当前${chalk.underline(`主程序@${utils.projectVersion()}`)}版本过低，请升级主程序！${chalk.underline(`https://eeui.app/guide/update.html`)}`);
        }
    },

    pluginsJson(isInstall, op) {
        let configFile = path.resolve(op.rootDir, "plugins/config.json");
        let configInfo = utils.jsonParse(!fs.existsSync(configFile) ? {} : fs.readFileSync(configFile, 'utf8'));
        if (!utils.isJson(configInfo['dependencies'])) {
            configInfo['dependencies'] = {};
        }
        if (isInstall) {
            if (typeof configInfo['dependencies'][op.name] !== 'object') {
                configInfo['dependencies'][op.name] = {};
            }
            configInfo['dependencies'][op.name]['requireName'] = op.requireName || op.name;
            configInfo['dependencies'][op.name]['name'] = op.name;
            configInfo['dependencies'][op.name]['url'] = op.url || "local";
        } else {
            if (typeof configInfo['dependencies'][op.name] !== "undefined") {
                delete configInfo['dependencies'][op.name];
            }
        }
        fs.writeFileSync(configFile, JSON.stringify(this.sortObject(configInfo), null, "\t"), 'utf8')
    },

    sortObject(obj) {
        return Object.keys(obj).sort().reduce((a, v) => {
            a[v] = obj[v];
            return a;
        }, {});
    },

    sendWebSocket(ws, ver, data) {
        if (data == null || typeof data !== "object") {
            data = {};
        }
        data.version = ver;
        if (ver === 2) {
            ws.send(this.jsonStringify(data));
        }else{
            ws.send(data.type + ':' + data.value);
        }
    },

    getAllAppboards(rundir) {
        let lists = fs.readdirSync(path.resolve(rundir, 'appboard'));
        let array = [];
        lists.forEach((item) => {
            let sourcePath = path.resolve(rundir, 'appboard/' + item);
            let distPath = path.resolve(rundir, '../', config.distDir, 'appboard/' + item);
            if (utils.rightExists(sourcePath, ".js")) {
                let content = fs.readFileSync(fs.existsSync(distPath) ? distPath : sourcePath, 'utf8');
                let sourceName = path.relative(path.resolve(rundir), sourcePath);
                if (/^win/.test(process.platform)) {
                    sourceName = sourceName.replace(/\\/g, "/");
                }
                array.push({
                    path: sourceName,
                    content: this.replaceModule(this.replaceEeuiLog(content)),
                });
            }
        });
        return array;
    },

    /**
     * 获取演示模板列表（在线版）
     * @param callback
     */
    getOnlineDemoLists(callback) {
        let array = [];
        let loading = ora('正在获取演示模板列表...').start();
        try {
            request(utils.apiUrl() + 'editor/case/cli_lists', (err, res, body) => {
                loading.stop();
                let data = utils.jsonParse(body);
                if (data.ret === 1) {
                    data.data.forEach((item) => {
                        array.push({
                            name: item.desc + ' (' + item.release + ')',
                            value: item
                        });
                    });
                    callback('', array);
                }else{
                    callback(data.msg);
                }
            });
        }catch (e) {
            loading.stop();
            callback('获取演示模板失败！');
        }
    },

    /**
     * 下载演示模板-①（在线版）
     * @param tree
     * @param callback
     */
    downOnlineDemo(tree, callback) {
        let loadText = `正在下载演示模板...`;
        let loading = ora(loadText);
        loading.start();
        try {
            request(utils.apiUrl() + 'editor/case/cli_downzip?tree=' + tree, (err, res, body) => {
                loading.stop();
                let data = utils.jsonParse(body);
                if (data.ret === 1) {
                    let savePath = path.join(require('os').homedir(), '.' + config.cacheDirName, 'demo');
                    utils.mkdirsSync(savePath);
                    savePath = path.join(savePath, tree + '.zip');
                    loading.start();
                    utils._downloadOnlineDemo(data.data.zipurl, savePath, (err) => {
                        loading.stop();
                        if (err) {
                            callback(err);
                        }else{
                            callback('', savePath);
                        }
                    }, (res) => {
                        loading.text = loadText + `(${res.progress}, ${res.speed})`;
                    })
                }else{
                    callback(data.msg || '下载演示模板失败！');
                }
            });
        }catch (e) {
            loading.stop();
            callback('下载演示模板错误！');
        }
    },

    /**
     * 下载演示模板-②（在线版）
     * @param url
     * @param savePath
     * @param callback
     * @param progressCall
     */
    _downloadOnlineDemo(url, savePath, callback, progressCall) {
        let file = fs.createWriteStream(savePath);
        file.on("close", () => {
            callback()
        }).on("error", (err) => {
            callback(err)
        });
        //
        let receivedBytes = 0;
        let totalBytes = 0;
        let speedBytes = 0;
        let speedPer = "0B/S";
        let speedInt = setInterval(() => {
            speedPer = utils.renderSize(Math.max(0, receivedBytes - speedBytes)) + "/S";
            speedBytes = receivedBytes;
        }, 1000);
        request.get(url)
            .on("error", function (err) {
                callback(`下载模板错误: ${err}`);
            })
            .on("response", function (res) {
                if (res.statusCode !== 200) {
                    callback("Get zipUrl return a non-200 response.");
                }
                totalBytes = parseInt(res.headers['content-length'], 10);
                if (isNaN(totalBytes)) totalBytes = 0;
            })
            .on('data', (chunk) => {
                receivedBytes += chunk.length;
                let progress = "0%";
                if (totalBytes > 0) {
                    progress = parseFloat(Math.max(0, receivedBytes / totalBytes * 100).toFixed(2)) + "%";
                }else{
                    progress = utils.renderSize(receivedBytes);
                }
                progressCall && progressCall({
                    received: receivedBytes,
                    total: totalBytes,
                    speed: speedPer,
                    progress: progress
                });
            })
            .on("end", function () {
                clearInterval(speedInt);
            })
            .pipe(file);
    },

    /**
     * 压缩目录
     * @param params = {?output:输出压缩包路径, entry:[{type:'dir', path:原文件夹路径, ?root:压缩根路径}, {type:'file', path:原文件路径, ?root:压缩根路径}]}
     * @param callback
     */
    zipCompress(params, callback) {
        let output = this.getObject(params, 'output');  //输出压缩包路径
        let entry = this.getObject(params, 'entry');    //压缩的文件夹路径或文件数组
        if (this.count(output) === 0) {
            output = tmp.tmpNameSync({dir: require('os').tmpdir()}) + ".zip";
        }
        if (typeof entry === "string") {
            entry = [{
                type: 'dir',
                root: entry,
                path: entry
            }];
        }
        if (!this.likeArray(entry)) {
            entry = [entry];
        }
        //
        let tmpPath = tmp.tmpNameSync({dir: require('os').tmpdir()});
        entry.forEach((item) => {
            let filePath = item.path;
            let fileRoot = item.root;
            let leftPath = path.join(path.resolve(fileRoot || filePath), "/");
            switch (item.type) {
                case 'dir':
                    let lists = this.fileDirDisplay(path.resolve(filePath));
                    lists.dir.forEach((tmpItem) => {
                        fse.ensureDirSync(path.resolve(tmpPath, this.leftDelete(tmpItem, leftPath)));
                    });
                    lists.file.forEach((tmpItem) => {
                        fse.copySync(tmpItem, path.resolve(tmpPath, this.leftDelete(tmpItem, leftPath)));
                    });
                    break;

                case 'file':
                    fse.copySync(filePath, path.resolve(tmpPath, this.leftDelete(filePath, leftPath)));
                    break;
            }
        });
        //
        compressing.zip.compressDir(tmpPath, output, {
            ignoreBase: true
        }).then(() => {
            fse.removeSync(tmpPath);
            typeof callback === 'function' && callback(output, null);
        }).catch((err) => {
            fse.removeSync(tmpPath);
            typeof callback === 'function' && callback(null, err);
        });
    },

    /**
     * 深复制修改配置文件
     * @param rundir
     * @param config
     */
    editConfig(rundir, config) {
        if (config === null || typeof config !== 'object') {
            return;
        }
        let configPath = path.resolve(rundir, 'eeui.config.js');
        if (fs.existsSync(configPath)) {
            let newConfig = lodash.merge(require(configPath), config);
            if (newConfig !== null && typeof newConfig === 'object' && typeof newConfig.appKey !== 'undefined') {
                let content = '';
                content += "/**\n * 配置文件\n * 参数详细说明：https://eeui.app/guide/config.html\n */\n";
                content += "module.exports = ";
                content += JSON.stringify(newConfig, null, "\t");
                content += ";";
                fs.writeFileSync(configPath, content, 'utf8');
            }
        }
    },

    /**
     * 斜杠格式化（如：aaa/bbb->aaaBbb、AAa/BbB->AAaBbB）
     * @param string
     * @returns {string|*}
     */
    spritUpperCase(string) {
        try {
            return string.replace(/\/+(\w)/g, function ($1) {
                return $1.toLocaleUpperCase()
            }).replace(/\//g, '');
        } catch (e) {
            return string;
        }
    },

    /**
     * 解析地址
     * @param url
     * @returns {{path: string, protocol: string, port: (*|string), query: string, host: string | * | string, source: *, params, hash: string}}
     */
    parseURL(url) {
        let a = urls.parse(url);
        return {
            source: url,
            protocol: (a.protocol || "").replace(':', ''),
            host: a.hostname || "",
            port: a.port || "",
            query: decodeURIComponent(a.search || ""),
            params: (function() {
                let params = {},
                    seg = (a.search || "").replace(/^\?/, '').split('&'),
                    len = seg.length,
                    p;
                for (let i = 0; i < len; i++) {
                    if (seg[i]) {
                        p = seg[i].split('=');
                        params[p[0]] = decodeURIComponent(p[1]);
                    }
                }
                return params;
            })(),
            hash: (a.hash || "").replace('#', ''),
            path: (a.pathname || "").replace(/^([^\/])/, '/$1')
        };
    },

    /**
     * 同步eeui.config.js到项目
     */
    syncConfigToPlatforms() {
        let file = path.resolve(process.cwd(), "eeui.config.js");
        if (!fs.existsSync(file)) {
            return;
        }
        //
        let eeuiConfig = {};
        try{
            delete require.cache[file];
            eeuiConfig = require(file);
        }catch (e) {
            return;
        }
        //
        let androidFile = path.resolve(process.cwd(), "platforms/android/eeuiApp/app/src/main/assets/eeui/config.json");
        if (fs.existsSync(androidFile)) {
            let tempConfig = lodash.merge(utils.jsonParse(fs.readFileSync(androidFile, 'utf8')), eeuiConfig);
            fs.writeFileSync(androidFile, JSON.stringify(tempConfig, null, "\t"), 'utf8')
        }
        //
        let iosFile = path.resolve(process.cwd(), "platforms/ios/eeuiApp/bundlejs/eeui/config.json");
        if (fs.existsSync(iosFile)) {
            let tempConfig = lodash.merge(utils.jsonParse(fs.readFileSync(iosFile, 'utf8')), eeuiConfig);
            fs.writeFileSync(iosFile, JSON.stringify(tempConfig, null, "\t"), 'utf8')
        }
    },

    /**
     * 路径类型（1:文件，2:目录，0:错误）
     * @param p
     * @returns {number}
     */
    pathType(p) {
        try {
            let s = fs.statSync(p);
            if (s.isFile()) {
                return 1;
            } else if (s.isDirectory()) {
                return 2;
            }
        } catch (e) {
            //
        }
        return 0;
    },

    /**
     * 目录下只有一个目录时把它移动出来
     * @param dirPath
     */
    onlyOneDirMoveToParent(dirPath) {
        let tempArray = fs.readdirSync(dirPath);
        if (utils.count(tempArray) === 1) {
            tempArray.forEach((tempName) => {
                let originalDir = path.join(dirPath, tempName);
                let stats = utils.pathType(originalDir);
                if (stats === 2) {
                    let tempDir = path.resolve(dirPath, "../__temp-" + Math.random().toString(36).substring(2));
                    fse.removeSync(tempDir);
                    fse.moveSync(originalDir, tempDir, {overwrite: true});
                    fse.removeSync(dirPath);
                    fse.moveSync(tempDir, dirPath, {overwrite: true});
                    fse.removeSync(tempDir);
                }
            });
        }
    }
};

module.exports = utils;
