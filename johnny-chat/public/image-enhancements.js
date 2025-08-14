(function(){
  function getHost(selector){
    var el = document.querySelector(selector);
    if(el) return el;
    return document.body;
  }
  function buildOverlay(){
    var overlay = document.createElement("div");
    overlay.className = "jj-imggen-overlay";
    overlay.innerHTML = [
      '<div class="jj-card">',
        '<div class="jj-orb orb-1"></div>',
        '<div class="jj-orb orb-2"></div>',
        '<div class="jj-orb orb-3"></div>',
        '<div class="jj-center">',
          '<div>',
            '<div class="jj-spinner"></div>',
            '<div class="jj-text">Crafting your image…</div>',
            '<div class="jj-sub">High quality rendering in progress</div>',
          '</div>',
        '</div>',
      '</div>'
    ].join("");
    return overlay;
  }
  function showOverlay(selector){
    var host = getHost(selector || "#image-generate-panel");
    if(host.querySelector(".jj-imggen-overlay")) return;
    var ov = buildOverlay();
    if(host === document.body){ ov.style.position = "fixed"; ov.style.inset = "0"; }
    host.appendChild(ov);
  }
  function hideOverlay(selector){
    var host = getHost(selector || "#image-generate-panel");
    var ov = host.querySelector(".jj-imggen-overlay");
    if(ov) ov.remove();
  }
  function injectFinalNotes(){
    var modal = document.querySelector("#imageBuilderModal");
    if(!modal) return;
    if(modal.querySelector("#image-builder-final-notes")) return;
    var container = modal.querySelector(".builder-notes-slot") || modal;
    var label = document.createElement("label");
    label.className = "jj-notes-label";
    label.textContent = "Final changes / comments";
    var ta = document.createElement("textarea");
    ta.id = "image-builder-final-notes";
    ta.placeholder = "Optional tweaks to apply at the end";
    container.appendChild(label);
    container.appendChild(ta);
  }
  function onApplyFromBuilder(e){
    var t = e.target;
    if(!t.closest) return;
    var inModal = t.closest("#imageBuilderModal");
    if(!inModal) return;
    var text = (t.textContent || "").toLowerCase().trim();
    if(text !== "apply" && text !== "apply to prompt") return;
    var notes = document.querySelector("#image-builder-final-notes");
    if(!notes) return;
    var v = (notes.value || "").trim();
    if(!v) return;
    var p = document.querySelector("#imgPrompt,[data-img-prompt],#imagePanel textarea,#imagePanel input[type='text']");
    if(!p) return;
    var base = (p.value || "").trim();
    p.value = base ? base + ". " + v : v;
  }
  function patchFetch(){
    if(window.__jjFetchPatched) return;
    var orig = window.fetch.bind(window);
    window.fetch = async function(i,init){
      try{
        var url = typeof i==="string" ? i : (i && i.url) ? i.url : "";
        var isImg = /\/generate-image(?:-edit)?\b/.test(url);
        if(isImg){ showOverlay("#image-generate-panel"); }
        var r = await orig(i,init);
        if(isImg){ hideOverlay("#image-generate-panel"); }
        return r;
      }catch(err){
        hideOverlay("#image-generate-panel");
        throw err;
      }
    };
    window.__jjFetchPatched = true;
  }
  function ready(fn){
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",fn);
    else fn();
  }
  ready(function(){
    patchFetch();
    injectFinalNotes();
    var mo = new MutationObserver(injectFinalNotes);
    mo.observe(document.body,{childList:true,subtree:true});
    document.addEventListener("click", onApplyFromBuilder, true);
    window.ImageEnhancements = { showOverlay:showOverlay, hideOverlay:hideOverlay };
  });
})();
