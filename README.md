# eeui-cli

> eeui-cli 是 配合 eeui 框架使用的命令行工具

# 命令行使用

## 1、安装

```bash
npm i eeui-cli -g
```

如果出现`permission denied`等相关权限的错误提示，请使用管理员身份或root身份运行，如 mac：`sudo npm i eeui-cli -g`。

## 2、更新

```bash
npm update eeui-cli -g
```

## 3、使用


#### 3-1、创建应用

```bash
eeui create [projectName]
```

- projectName: 工程名称（选题，默认：`eeui-demo`）

#### 3-2、项目主框架升级至最新版本

```bash
eeui update
```

#### 3-3、调试开发

```bash
eeui dev
```

#### 3-4、编译构造

```bash
eeui build
```

#### 3-5、创建vue页面示例模板

```bash
eeui vue <pageName>
```

- pageName: 页面名称

#### 3-6、安装插件

```bash
eeui plugin <command> <pluginName>
```

- command: 命令（安装：`install`，卸载：`uninstall`，创建：`create`，发布：`publish`）
- pluginName: 插件名称（插件列表可以查看[https://eeui.app/markets/](https://eeui.app/markets/)）

#### 3-7、App设置（应用名称、版本等）

```bash
eeui setting
```

#### 3-8、设置App模板（初始化演示模板）

```bash
eeui setdemo
```

#### 3-9、一键云修复文件（热更新）

```bash
eeui repair
```

#### 3-10、登录云中心

```bash
eeui login
```

#### 3-11、登出云中心

```bash
eeui logout
```

#### 3-12、备份项目开发文件

```bash
eeui backup
```

#### 3-13、恢复项目开发文件

```bash
eeui recovery
```

## 4、版本及帮助

```bash
eeui -v    // 查看当前cli版本
eeui -h    // 命令帮助信息
```
