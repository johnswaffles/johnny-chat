(function(){
  var selectors=["#image-generate-panel","#imagePanel","[data-image-panel]",".image-panel","#image-panel"];
  function findPanel(sel){
    if(sel){var e=document.querySelector(sel);if(e) return e;}
    for(var i=0;i<selectors.length;i++){var el=document.querySelector(selectors[i]);if(el) return el;}
    return null;
  }
  function ensurePositioned(el){
    var cs=getComputedStyle(el);
    if(cs.position==="static"){el.dataset.jjPosWasStatic="1";el.style.position="relative";}
  }
  function restorePosition(el){
    if(el && el.dataset && el.dataset.jjPosWasStatic==="1"){el.style.position="";delete el.dataset.jjPosWasStatic;}
  }
  function buildOverlay(){
    var ov=document.createElement("div");
    ov.className="jj-imggen-overlay";
    ov.innerHTML=[
      '<div class="jj-neo">',
      '  <div style="position:relative;display:grid;place-items:center;">',
      '    <div class="jj-ring"></div>',
      '    <div class="jj-pulse"></div>',
      '  </div>',
      '  <div class="jj-title">Synthesizing image…</div>',
      '  <div class="jj-sub">Neural renderer online. Please wait.</div>',
      '  <div class="jj-progress"><div class="bar"></div></div>',
      '</div>'
    ].join("");
    return ov;
  }
  function showOverlay(selector){
    var host=findPanel(selector);
    if(!host) return;
    ensurePositioned(host);
    if(host.querySelector(".jj-imggen-overlay")) return;
    host.setAttribute("aria-busy","true");
    host.style.touchAction="none";
    var ov=buildOverlay();
    host.appendChild(ov);
  }
  function hideOverlay(selector){
    var host=findPanel(selector);
    if(!host) return;
    var ov=host.querySelector(".jj-imggen-overlay");
    if(ov) ov.remove();
    host.removeAttribute("aria-busy");
    host.style.touchAction="";
    restorePosition(host);
  }
  function patchFetch(){
    if(window.__jjFetchPatched) return;
    var orig=window.fetch.bind(window);
    window.fetch=async function(i,init){
      var url="";
      try{url=typeof i==="string"?i:(i&&i.url)?i.url:"";}catch(_){}
      var isImg=/\/generate-image(?:-edit)?\b/.test(url);
      if(isImg) showOverlay();
      try{
        var r=await orig(i,init);
        if(isImg) hideOverlay();
        return r;
      }catch(e){
        if(isImg) hideOverlay();
        throw e;
      }
    };
    window.__jjFetchPatched=true;
  }
  function ready(fn){
    if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",fn);}
    else{fn();}
  }
  ready(function(){
    patchFetch();
    window.ImageEnhancements={showOverlay:showOverlay,hideOverlay:hideOverlay};
  });
})();
