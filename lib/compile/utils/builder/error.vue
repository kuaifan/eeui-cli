<template>
    <web-view class="app" :content="errorMsg" :progressbarVisibility="false"></web-view>
</template>

<style scoped>
    .app {
        flex: 1;
    }
</style>
<script>
    export default {
        data() {
            return {
                errorMsg: `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>Title<\/title><meta http-equiv="X-UA-Compatible"content="IE=edge,chrome=1"\/><meta name="viewport"content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0"><style type="text\/css">.app{position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center}.text{color:#3DB4FF;text-align:center;font-size:1.3rem}.error{position:fixed;left:0;top:0;right:0;bottom:0;width:100%;height:100%;z-index:1;border:none;box-sizing:border-box;background-color:rgba(0,0,0,0.85);color:rgb(232,232,232);display:none;flex-direction:column}.error-code{flex:1;font-family:Menlo,Consolas,monospace;font-size:14px;text-align:left;white-space:pre;word-spacing:normal;word-break:normal;word-wrap:normal;tab-size:4;padding:24px;margin:0;border:none;line-height:20px;overflow:auto;hyphens:none;-webkit-overflow-scrolling:touch}.error-close{position:relative;width:2.6rem;height:2.6rem;border-radius:50%;margin:2.3rem auto;background-color:#6D7891}.error-close:after,.error-close:before{content:'';position:absolute;top:50%;left:50%;width:1.2rem;height:2px;border-radius:1px;background-color:#ffffff;transform:translate(-50%,-50%)rotate(45deg)}.error-close:after{transform:translate(-50%,-50%)rotate(-45deg)}<\/style><\/head><body><div class="app"><div class="text"onclick="showPre()">你访问的页面出错了！<\/div><div class="error"><pre class="error-code"><\/pre><div class="error-close"onclick="hiddenPre()"><\/div><\/div><\/div><script type="text\/javascript">var errorMsg=decodeURIComponent("");function showPre(){if(errorMsg==""){return}document.querySelector(".error").style.display="flex"}function hiddenPre(){document.querySelector(".error").style.display="none"}if(errorMsg!=""){document.querySelector(".error-code").innerHTML=errorMsg;showPre()}<\/script><\/body><\/html>`,
            }
        }
    };
</script>