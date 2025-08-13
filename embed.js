(function(){
  try {
    var s = document.currentScript || (function(){var a=document.getElementsByTagName("script");return a[a.length-1];})();
    var origin = new URL(s.src).origin.replace(/\/$/,"");
    if (!window.API_BASE) window.API_BASE = origin;
  } catch (_) {
    if (!window.API_BASE) window.API_BASE = "";
  }
})();
