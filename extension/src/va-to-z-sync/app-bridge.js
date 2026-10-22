// Runs on the VA to Z app page only (checked by a marker the app puts in its <head>).
(function(){
  if(!document.querySelector('meta[name="vatoz-app"]'))return;
  function post(data){window.postMessage({type:'VATOZ_VA_DATA',source:'vatoz-sync-ext',data:data},'*')}
  chrome.runtime.onMessage.addListener(function(m,_s,reply){if(m&&m.type==='VATOZ_VA_DATA'&&m.data){post(m.data);reply({ok:true})}});
  // The app can ask for the most recent pull (e.g. it was opened after pulling).
  window.addEventListener('message',function(e){if(e.source!==window||!e.data||e.data.type!=='VATOZ_REQUEST')return;
    chrome.storage.local.get('vatozLast').then(function(o){if(o.vatozLast)post(o.vatozLast)})});
  window.postMessage({type:'VATOZ_EXT_READY',source:'vatoz-sync-ext'},'*');
})();
