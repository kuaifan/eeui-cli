#!/usr/bin/env node

const yargs = require("yargs");
const path = require("path");
const fse = require("fs-extra");
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const shelljs = require('shelljs');
const decompress = require('decompress');
const config = require('./config');
const logger = require("./lib/utils/logger");
const utils = require("./lib/utils");
const project = require("./lib/utils/project");
const backup = require("./lib/utils/backup");
const runapp = require("./lib/run");
const buildApp = require("./lib/builder/buildApp");
const plugin = require('./lib/plugin');
const create = require('./lib/plugin/create');
const publish = require('./lib/plugin/publish');
const update = require('./lib/utils/update');
const repair = require('./lib/utils/repair');
const tools = require('./lib/utils/tools');
const setting = require('./lib/utils/setting');

const TemplateRelease = require("./template-release");
const templateRelease = new TemplateRelease(config.cacheDirName, config.templateReleaseUrl);
const isWin = /^win/.test(process.platform);

let questions = (inputName, releaseLists) => {
    let applicationid = "";
    return [{
        type: 'input',
        name: 'name',
        default: () => {
            if (typeof inputName !== 'string') inputName = "";
            return inputName.trim() ? inputName.trim() : 'eeui-demo';
        },
        message: "请输入项目名称",
        validate: (value) => {
            let pass = value.match(/^[0-9a-z\-_]+$/i);
            if (!pass) {
                return '输入格式错误，请重新输入。';
            }
            if (fse.existsSync(value)) {
                return '目录[' + value + ']已经存在，请重新输入。';
            }
            return true;
        }
    }, {
        type: 'input',
        name: 'appName',
        default: () => {
            return 'eeui演示';
        },
        message: "请输入App名称",
        validate: (value) => {
            return value !== ''
        }
    }, {
        type: 'input',
        name: 'applicationID',
        default: () => {
            return 'app.eeui.demo';
        },
        message: "请输入Android应用ID",
        validate: (value) => {
            let pass = value.match(/^[a-z][a-z0-9_]+([.][a-z][a-z0-9_]+){2,4}$/i);
            if (pass) {
                applicationid = value;
                return true;
            }
            return '输入格式错误，请重新输入。';
        }
    }, {
        type: 'input',
        name: 'bundleIdentifier',
        default: () => {
            return applicationid;
        },
        message: "请输入iOS应用ID",
        validate: (value) => {
            let pass = value.match(/^[a-z][a-z0-9_]+([.][a-z][a-z0-9_]+){2,4}$/i);
            if (pass) {
                return true;
            }
            return '输入格式错误，请重新输入。';
        }
    }, {
        type: 'list',
        name: 'release',
        message: "请选择框架版本",
        choices: releaseLists
    }, {
        type: 'list',
        name: 'location',
        message: "请选择下载服务器",
        choices: [{
            name: "Github服务器",
            value: "github"
        }, {
            name: "EEUI官网服务器",
            value: "eeui"
        }]
    }];
};

let runQuestions = [{
    type: 'list',
    name: 'platform',
    message: '您可以安装或更新eeui SDK',
    choices: [{
        name: "ios",
        value: "ios"
    }, {
        name: "android",
        value: "android"
    }]
}];

/**
 * 创建 eeui 工程.
 */
function initProject(createName) {
    let spinFetch = ora('正在下载版本列表...');
    spinFetch.start();
    templateRelease.fetchReleaseVersions((err, result) => {
        spinFetch.stop();
        if (err) {
            logger.fatal(err);
            return;
        }
        //
        let lists = [];
        result.some(t => {
            if (!utils.leftExists(t, "2")) {
                return false;
            }
            lists.push({
                name: t,
                value: t
            });
            if (lists.length >= 10) {
                return true;
            }
        });
        //
        if (lists.length === 0) {
            logger.fatal("没有找到可用的版本。");
            return;
        }
        //
        inquirer.prompt(questions(createName, lists)).then((answers) => {
            let _answers = JSON.parse(JSON.stringify(answers));
            let rundir = path.resolve(process.cwd(), _answers.name);

            if (fse.existsSync(_answers.name)) {
                logger.fatal(`目录[${_answers.name}]已经存在。`);
                return;
            }

            let release = _answers.release === 'latest' ? '' : _answers.release;
            templateRelease.fetchRelease(release, _answers.location, (error, releasePath) => {
                if (error) {
                    logger.fatal(error);
                    return;
                }

                let nextStep = (callback) => {
                    logger.info("正在复制模板文件...");

                    fse.copySync(releasePath, _answers.name);
                    project.initConfig(rundir, _answers);
                    changeAppKey(rundir);

                    if (shelljs.which('pod')) {
                        let tempPath = process.cwd();
                        let spinPod = ora('pod install...');
                        spinPod.start();
                        shelljs.cd(rundir + '/platforms/ios/eeuiApp');
                        shelljs.exec('pod install', {silent: true}, (code, stdout, stderr) => {
                            shelljs.cd(tempPath);
                            spinPod.stop();
                            if (code !== 0) {
                                logger.warn("运行pod install错误:" + code + "，请稍后手动运行！");
                            }
                            callback();
                        });
                    } else {
                        if (isWin) {
                            logger.warn('未检测到系统安装pod，请安装pod后手动执行pod install！');
                        }
                        callback();
                    }
                };

                let finalLog = () => {
                    logger.success("创建项目完成。");
                    logger.sep();
                    logger.info("您可以运行一下命令开始。");
                    logger.info(chalk.white(`1. cd ${_answers.name}`));
                    logger.info(chalk.white(`2. npm install`));
                    logger.info(chalk.white(`3. npm run dev`));
                };

                initDemo((error, downFile, info) => {
                    if (error) {
                        logger.warn(error);
                        nextStep(() => {
                            finalLog();
                        });
                        return;
                    }
                    nextStep(() => {
                        let srcDir = rundir + "/src";
                        fse.remove(path.resolve(srcDir), (err) => {
                            if (!err) {
                                decompress(downFile, path.resolve(srcDir)).then(() => {
                                    utils.editConfig(rundir, info.config);
                                });
                            }
                            finalLog();
                        });
                    });
                });
            });
        });
    });
}

/**
 * 初始化演示模板
 */
function initDemo(callback) {
    utils.getOnlineDemoLists((error, demoLists) => {
        if (error) {
            typeof callback === 'function' && callback(error);
            return;
        }
        inquirer.prompt([{
            type: 'list',
            name: 'demoInfo',
            message: "请选择初始化模板",
            choices: demoLists
        }]).then(answers => {
            utils.downOnlineDemo(answers.demoInfo.tree, (error, downFile) => {
                if (error) {
                    typeof callback === 'function' && callback(error);
                    return;
                }
                typeof callback === 'function' && callback('', downFile, answers.demoInfo);
            })
        }).catch(console.error);
    });
}

/**
 * 设置模板
 * @param rundir
 */
function setTemplate(rundir) {
    inquirer.prompt([{
        type: 'confirm',
        message: `此操作将重置src开发目录，是否继续操作？`,
        name: 'ok'
    }]).then(answers => {
        if (answers.ok) {
            initDemo((error, downFile, info) => {
                if (error) {
                    logger.warn(error);
                    return;
                }
                let srcDir = rundir + "/src";
                fse.remove(path.resolve(srcDir), (err) => {
                    if (!err) {
                        decompress(downFile, path.resolve(srcDir)).then(() => {
                            utils.editConfig(rundir, info.config);
                        });
                    }
                    logger.success("【" + info.desc + "】演示模板设置成功。");
                });
            });
        } else {
            logger.fatal(`放弃设置模板操作！`);
        }
    }).catch(console.error);
}

/**
 * 列出可用的模板版本
 */
function displayReleases() {
    let spinPod = ora('正在获取版本信息...');
    spinPod.start();
    templateRelease.fetchReleaseVersions((err, result) => {
        spinPod.stop();
        if (err) {
            logger.fatal(err);
            return;
        }
        let array = [];
        result.some(t => {
            if (!utils.leftExists(t, "2")) {
                return false;
            }
            array.push(t);
            if (array.length >= 10) {
                return true;
            }
        });
        if (array.length === 0) {
            logger.fatal("无可用版本！");
        } else {
            console.log("可用的版本:");
            array.forEach((t) => {
                console.log(chalk.green.underline(t));
            })
        }
    });
}

/**
 * 生成appKey
 * @param  {string} path 文件路径.
 */
function changeAppKey(path) {
    let configPath = path + "/eeui.config.js";
    if (!fse.existsSync(configPath)) {
        return;
    }
    let config = require(configPath);
    let content = '';
    if (config === null || typeof config !== 'object') {
        return;
    }
    if (typeof config.appKey === 'undefined') {
        return;
    }
    let createRand = (len) => {
        len = len || 32;
        let $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678oOLl9gqVvUuI1';
        let maxPos = $chars.length;
        let pwd = '';
        for (let i = 0; i < len; i++) {
            pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
        }
        return pwd;
    };
    logger.info("正在创建appKey...");
    config.appKey = createRand(32);
    content += "/**\n * 配置文件\n * 参数详细说明：https://eeui.app/guide/config.html\n */\n";
    content += "module.exports = ";
    content += JSON.stringify(config, null, "\t");
    content += ";";
    fse.writeFileSync(configPath, content, 'utf8');
    //
    let androidPath = path + "/platforms/android/eeuiApp/app/src/main/assets/eeui/config.json";
    if (fse.existsSync(androidPath)) {
        fse.writeFileSync(androidPath, JSON.stringify(config), 'utf8');
    }
    let iosPath = path + "/platforms/ios/eeuiApp/bundlejs/eeui/config.json";
    if (fse.existsSync(androidPath)) {
        fse.writeFileSync(iosPath, JSON.stringify(config), 'utf8');
    }
}

let args = yargs
    .command({
        command: "create [name]",
        desc: "创建一个eeui项目",
        handler: (argv) => {
            if (typeof argv.name === "string") {
                if (fse.existsSync(argv.name)) {
                    logger.fatal(`目录“${argv.name}”已经存在。`);
                    return;
                }
            }
            initProject(argv.name);
        }
    })
    .command({
        command: "lists",
        desc: "列出创建可用模板版本",
        handler: () => {
            displayReleases();
        }
    })
    .command({
        command: "setting",
        desc: "项目App设置（应用名称、版本等）",
        handler: () => {
            utils.verifyeeuiProject();
            setting.start();
        }
    })
    .command({
        command: "template",
        desc: "设置App模板（初始化演示模板）",
        handler: () => {
            utils.verifyeeuiProject();
            setTemplate(path.resolve(process.cwd()));
        }
    })
    .command({
        command: "update",
        desc: "项目主框架升级至最新版本",
        handler: () => {
            utils.verifyeeuiProject();
            utils.verifyeeuiTemplate();
            update.start();
        }
    })
    .command({
        command: "vue [pageName]",
        desc: "创建vue页面示例模板",
        handler: (argv) => {
            utils.verifyeeuiProject();
            utils.verifyeeuiTemplate();
            let pageName = utils.rightDelete(argv.pageName, ".vue").trim();
            if (pageName) {
                let dir = path.resolve(process.cwd(), "src");
                if (!fse.existsSync(dir)) {
                    logger.fatal(`目录“src”不存在，当前目录非eeui项目。`);
                    return;
                }
                let filePath = dir + "/pages/" + pageName + ".vue";
                if (fse.existsSync(filePath)) {
                    logger.fatal(`文件“${pageName}.vue”已经存在。`);
                    return;
                }
                let tmlPath = __dirname + "/lib/template/_template.vue";
                if (!fse.existsSync(tmlPath)) {
                    logger.fatal(`模板文件不存在。`);
                    return;
                }
                fse.copySync(tmlPath, filePath);
                logger.success(`模板文件“${pageName}.vue”成功创建。`);
            } else {
                logger.fatal(`请输入要创建的文件名称。`);
            }
        }
    })
    .command({
        command: "plugin [command] [name]",
        desc: "添加、删除、创建或发布插件",
        handler: (argv) => {
            utils.verifyeeuiProject();
            utils.verifyeeuiTemplate();
            let op = {};
            op.name = argv.name;
            op.rootDir = process.cwd();
            op.dir = path.basename(process.cwd());
            op.simple = argv.s === true;
            switch (argv.command) {
                case 'add':
                case 'install':
                case 'i':
                    plugin.add(op);
                    break;
                case 'del':
                case 'remove':
                case 'uninstall':
                case 'u':
                    plugin.remove(op);
                    break;
                case 'repair':
                case 'r':
                    plugin.repair(op);
                    break;
                case 'script':
                    plugin.eeuiScript(argv.name, true);
                    break;
                case 'unscript':
                    plugin.eeuiScript(argv.name, false);
                    break;
                case 'create':
                case 'c':
                    create.create(op);
                    break;
                case 'publish':
                case 'upload':
                case 'p':
                    publish.publish(op);
                    break;
            }
        }
    })
    .command({
        command: "repair",
        desc: "一键云修复文件（热更新）",
        handler: () => {
            utils.verifyeeuiProject();
            repair.start();
        }
    })
    .command({
        command: "icons [id]",
        desc: "一键设置图标资源",
        handler: (argv) => {
            utils.verifyeeuiProject();
            tools.icons(argv.id);
        }
    })
    .command({
        command: "launchimage [id]",
        desc: "一键设置启动图资源",
        handler: (argv) => {
            utils.verifyeeuiProject();
            tools.launchimage(argv.id);
        }
    })
    .command({
        command: "login",
        desc: "登录云中心",
        handler: () => {
            utils.login((data) => {
                logger.success(data.username + ' 登录成功！');
            });
        }
    })
    .command({
        command: "logout",
        desc: "登出云中心",
        handler: () => {
            utils.logout(() => {
                logger.success('退出成功！');
            });
        }
    })
    .command({
        command: "backup",
        desc: "备份项目开发文件",
        handler: () => {
            utils.verifyeeuiProject();
            backup.backup();
        }
    })
    .command({
        command: "recovery",
        desc: "恢复项目备份文件",
        handler: () => {
            utils.verifyeeuiProject();
            utils.verifyeeuiTemplate();
            backup.recovery();
        }
    })
    .command({
        command: "dev",
        desc: "编译构造",
        handler: (argv) => {
            utils.verifyeeuiProject();
            utils.verifyeeuiTemplate();
            plugin.eeuiScript(null, true, () => {
                buildApp.dev(argv.s === true);
            });
        }
    })
    .command({
        command: "build",
        desc: "编译构造并最小化输出结果",
        handler: (argv) => {
            utils.verifyeeuiProject();
            utils.verifyeeuiTemplate();
            plugin.eeuiScript(null, true, () => {
                buildApp.build(argv.s === true);
            });
        }
    })
    .command({
        command: "run [platform]",
        desc: "在你的设备上运行app (实验功能)",
        handler: (argv) => {
            utils.verifyeeuiProject();
            utils.verifyeeuiTemplate();
            let dir = path.basename(process.cwd());
            if (argv.platform === "ios") {
                runapp.runIOS({dir});
            } else if (argv.platform === "android") {
                runapp.runAndroid({dir});
            } else {
                inquirer.prompt(runQuestions).then((answers) => {
                    let platform = JSON.parse(JSON.stringify(answers)).platform;
                    if (platform === 'ios') {
                        runapp.runIOS({dir});
                    } else if (platform === 'android') {
                        runapp.runAndroid({dir});
                    }
                });
            }
        }
    })
    .version(() => {
        let text = "eeui-cli: " + chalk.underline(require('./package.json').version);
        if (utils.projectVersion()) {
            text += "\neeui-template: " + chalk.underline(utils.projectVersion());
        }
        return text;
    })
    .help()
    .alias({
        "h": "help",
        "v": "version",
        "s": "simple"
    })
    .strict(true)
    .argv;

//发布模块: npm publish
