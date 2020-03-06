const jsonfile = require('jsonfile');
const fs = require("fs-extra");
const path = require("path");
const ora = require('ora');
const decompress = require('decompress');
const tmp = require('tmp');
const request = require('request').defaults({
    headers: {
        'User-Agent': 'request'
    }
});

const utils = require('./lib/utils');
const logger = require("./lib/utils/logger");

class TemplateRelease {
    /**
     * 构造函数，必须传入以下参数
     * @param  {String} name       项目的名称，将用于在家目录创建形如 .eeui 的缓存目录
     * @param  {String} releaseUrl 形如 https://api.github.com/repos/kuaifan/eeui-template/releases
     * @return {TemplateRelease}
     */
    constructor (name, releaseUrl) {
        if (!name || !releaseUrl) {
            throw new Error('Invalid argument');
        }
        this.name = name;
        this.releaseUrl = releaseUrl;
        this.CACHE_DIR_NAME = '.' + name;
        this.CACHE_DIR_PATH = path.join(require('os').homedir(), this.CACHE_DIR_NAME);
        this.CACHE_TEMPLATE_PATH = path.join(this.CACHE_DIR_PATH, "template");
        this.RELEASES_JSON_PATH = path.join(this.CACHE_TEMPLATE_PATH, "release.json");
    }

    /**
     * 获取所有 release 的版本。只获取版本，不会下载到缓存区。
     * @param  {Function} cb 接受参数 error 以及无错时的版本数组 []string
     */
    fetchReleaseVersions(cb) {
        request.get(this.releaseUrl, function(err, res, body){
            if (err) {
                cb && cb(err);
                return;
            }
            if (res.statusCode !== 200) {
                cb && cb(`获取信息失败 - ${res.statusCode}: ${res.body}`);
                return;
            }
            let tags = JSON.parse(body).map(function(e){return e["tag_name"]});
            cb && cb(null, tags);
        });
    }

    /**
     * 获取指定版本的 release，首先尝试缓存（CACHE_TEMPLATE_PATH），如果未缓存，再尝试下载并缓存
     * @param {string} release 指定版本，如果为空，表示最新版本
     * @param {string} location 下载服务器
     * @param {Function} cb 通过该回调返回错误 error，以及无错时的 release 的路径，一般形如 ~/.eeui/template/0.1.0
     */
    fetchRelease(release, location, cb) {
        let releasesInfo = this._readReleaseJSON();
        if (release) {
            let info = releasesInfo[release];
            if (info) {
                cb(null, path.join(this.CACHE_TEMPLATE_PATH, info.path));
                return;
            }
        }

        let url = this._getReleaseUrl(release);
        if (location === 'eeui') {
            url = url.replace('https://api.github.com/repos/', utils.apiUrl() + 'releases/')
        }
        let spinText = `正在下载模板版本: ${release ? release : "latest"}...`;
        let spinDown = ora(spinText);
        spinDown.start();
        request(url, (err, res, body) => {
            spinDown.stop();
            if (err || res.statusCode !== 200) {
                let errorInfo = err ? err : `${res.statusCode}: ${res.body}`;
                logger.info(`未能下载 ${url} - ${errorInfo}`);
                logger.info('正在清除缓存...');
                if (!release) {
                    let latestRleaseInfo = this.getCachedReleaseInfo();
                    if (latestRleaseInfo) {
                        logger.info(`在缓存中找到最新版本: ${latestRleaseInfo.tag}.`);
                        cb(null, path.join(this.CACHE_TEMPLATE_PATH, latestRleaseInfo.path));
                        return;
                    }
                }
                cb(`未能获取版本 ${release ? release : "latest"}: ${errorInfo}`);
                return;
            }
            //
            let info = JSON.parse(body);
            if (location === 'eeui') {
                if (info.ret !== 1) {
                    logger.fatal(info.msg || "未知错误，请选择其他下载服务器！");
                }
                info = info['data'];
            }
            let newInfo = {};
            let tag = newInfo.tag = info["tag_name"];
            newInfo.time = info["published_at"];
            newInfo.path = newInfo.tag;
            let targetPath = path.join(this.CACHE_TEMPLATE_PATH, newInfo.path);
            if (fs.pathExistsSync(targetPath)) {
                logger.info(`已经缓存的版本。`);
                cb(null, targetPath);
                return;
            }
            spinDown.start();
            this._downloadAndUnzip(info["zipball_url"], targetPath, (err) => {
                spinDown.stop();
                if (err) {
                    cb && cb(err);
                    return;
                }
                releasesInfo[tag] = newInfo;
                jsonfile.writeFileSync(this.RELEASES_JSON_PATH, releasesInfo, {spaces: 2});
                cb(null, targetPath);
            }, (res) => {
                spinDown.text = spinText + `(${res.progress}, ${res.speed})`;
            });
        });
    }

    /**
     * 返回缓存里的 release 信息
     * @param {string} [release] 指定版本，不指定则返回最新
     * @return {Object} release 信息
     */
    getCachedReleaseInfo(release) {
        let releasesInfo = this._readReleaseJSON();
        if (release) {
            return releasesInfo[release];
        }
        let latestRleaseInfo = null;
        for (let tag in releasesInfo) {
            let info = releasesInfo[tag];
            if (!latestRleaseInfo) {
                latestRleaseInfo = info;
            } else {
                if (Date.parse(info.time) > Date.parse(latestRleaseInfo.time)) latestRleaseInfo = info;
            }
        }
        return latestRleaseInfo;
    }

    _readReleaseJSON() {
        fs.ensureFileSync(this.RELEASES_JSON_PATH);
        try {
            return jsonfile.readFileSync(this.RELEASES_JSON_PATH);
        } catch (e) {
            return {};
        }
    }

    _getReleaseUrl(tag) {
        return this.releaseUrl + "/" + (tag ?  `tags/${tag}` : "latest");
    }

    /**
     * 把 url (zipball_url) 的内容下载并解压到 savePath
     * @param {string} url
     * @param {string} savePath
     * @param {Function} cb 接收参数 error
     * @param {Function} progressCall 接收进度
     */
    _downloadAndUnzip(url, savePath, cb, progressCall) {
        let TMP_DOWNLOAD_PATH = tmp.tmpNameSync({dir: require('os').tmpdir()}) + ".zip";
        let file = fs.createWriteStream(TMP_DOWNLOAD_PATH);
        file.on("close", () => {
            decompress(TMP_DOWNLOAD_PATH, this.CACHE_TEMPLATE_PATH).then(() => {
                let origPath = this._getLastReleasePath();
                fs.moveSync(origPath, savePath);    // 重命名为指定名
                fs.unlinkSync(TMP_DOWNLOAD_PATH);   // 删除下载的压缩包
                cb && cb();
            }).catch((err) => {
                cb && cb(`下载版本失败: ${err}`);
            });
        }).on("error", (err) => {
            cb && cb(err)
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
                cb && cb(`下载版本错误: ${err}`);
            })
            .on("response", function (res) {
                if (res.statusCode !== 200) {
                    cb && cb("Get zipUrl return a non-200 response.");
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
    }

    /**
     * 获取刚下载解压的 release 的路径
     * TODO: 目前无法准确获取 release 解压之后的目录名称，只能根据某种模式推断
     */
    _getLastReleasePath() {
        let files = fs.readdirSync(this.CACHE_TEMPLATE_PATH);
        let part = this.releaseUrl.split('/');
        const pattern = part[part.length - 2];
        for (let f of files) {
            if (f.indexOf(pattern) !== -1) {
                return path.join( this.CACHE_TEMPLATE_PATH, f);
            }
        }
        return null;
    }
}

module.exports = TemplateRelease;
