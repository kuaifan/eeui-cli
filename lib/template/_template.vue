<template>

    <div class="app" @lifecycle="lifecycle">

        <!-- 顶部导航 -->
        <div class="nav">
            <text class="nav-title">{{title}}</text>
            <icon class="nav-back" @click="goBack"></icon>
        </div>

        <!-- 页面内容 -->
        <scroller class="app">

        </scroller>

    </div>

</template>

<style scoped>
    .app {
        flex: 1;
    }
    .nav {
        width: 750px;
        height: 96px;
        display: flex;
        background-color: #3EB4FF;
    }
    .nav-back {
        position: absolute;
        left: 0;
        top: 0;
        width: 96px;
        height: 96px;
        line-height: 96px;
        text-align: center;
        font-size: 38px;
        color: #ffffff;
        content: 'tb-back';
    }
    .nav-title {
        flex: 1;
        color: #ffffff;
        text-align: center;
        line-height: 96px;
        font-size: 32px;
        font-weight: 300;
    }
</style>
<script>
    const eeui = app.requireModule('eeui');

    export default {
        data() {
            return {
                title: '空白模板'
            }
        },

        mounted() {
            //页面挂载
        },

        methods: {
            /**
             * 生命周期
             * @param res
             */
            lifecycle(res) {
                switch (res.status) {
                    case "ready":
                        //页面挂载(初始化)
                        break;

                    case "resume":
                        //页面激活(恢复)
                        break;

                    case "pause":
                        //页面失活(暂停)
                        break;

                    case "destroy":
                        //页面停止(销毁)
                        break;
                }
            },

            /**
             * 打开新页面
             * @param url           (String)页面地址
             * @param params        (Object)传递参数
             * @param replace       (Boolean)打开新页面后关闭当前页面
             */
            goForward(url, params, replace) {
                let pageName = null;
                if (replace === true) {
                    let pageInfo = eeui.getPageInfo();
                    pageName = pageInfo['pageName'];
                }
                //
                eeui.openPage({
                    url: url,
                    pageType: "app",
                    statusBarColor: "#3EB4FF",
                    params: params ? params : {}
                }, (res) => {
                    if (replace === true && res.status === 'create') {
                        eeui.closePage(pageName);
                    }
                });
            },

            /**
             * 返回上一页(关闭当前页)
             */
            goBack() {
                eeui.closePage();
            },
        }
    }
</script>
