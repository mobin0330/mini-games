'use strict';
const canvas=document.querySelector('#canvas');
const stage=document.querySelector('#stage');
const start=document.querySelector('#start');
const status=document.querySelector('#status');
const progress=document.querySelector('#progress');
const loading=document.querySelector('#loading');
const sizeCanvas=()=>{const rect=stage.getBoundingClientRect();canvas.width=Math.max(1,Math.floor(rect.width));canvas.height=Math.max(1,Math.floor(rect.height));};
new ResizeObserver(sizeCanvas).observe(stage);sizeCanvas();
document.querySelector('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();canvas.focus();}catch{status.textContent='浏览器未允许全屏；仍可在当前窗口游玩。';}});
start.addEventListener('click',async()=>{
  start.disabled=true;progress.hidden=false;status.textContent='正在加载引擎与游戏素材…';
  try{
    const missing=Engine.getMissingFeatures({threads:false});
    if(missing.length)throw Error('当前浏览器缺少 '+missing.join('、')+'。请使用较新的桌面浏览器。');
    const engine=new Engine({executable:'index',canvas,canvasResizePolicy:0,focusCanvas:true,ensureCrossOriginIsolationHeaders:false,gdextensionLibs:[],args:[]});
    await engine.startGame({onProgress:(current,total)=>{if(total){progress.value=current/total*100;status.textContent='加载中 '+Math.round(current/total*100)+'%';}}});
    loading.hidden=true;canvas.focus();
  }catch(error){status.textContent='加载未完成：'+error.message+' 请刷新重试；登录过期时先返回小游戏重新登录。';start.disabled=false;start.textContent='重新加载';}
});
