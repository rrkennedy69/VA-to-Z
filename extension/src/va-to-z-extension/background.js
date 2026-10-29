// VA to Z (all-in-one extension) service worker.
const APP=chrome.runtime.getURL('app.html');
// Toolbar icon opens the app in its own app-style popup window (one window, reused).
const SES=chrome.storage.session||chrome.storage.local;
async function openApp(intent){const url=APP+(intent?'#intent='+encodeURIComponent(JSON.stringify(intent)):'');
  const {appWin}=await SES.get('appWin');
  if(appWin){try{const w=await chrome.windows.get(appWin,{populate:true});
      if(w&&w.tabs&&w.tabs.some(t=>(t.url||t.pendingUrl||'').startsWith(APP))){const tb=w.tabs.find(t=>(t.url||t.pendingUrl||'').startsWith(APP));if(intent)await chrome.tabs.update(tb.id,{url});
        await chrome.windows.update(w.id,Object.assign({focused:true},w.state==='minimized'?{state:'normal'}:{}));return w.id}}catch(e){}
    await SES.remove('appWin')}
  const {appBounds}=await chrome.storage.local.get('appBounds');
  let o={type:'popup',url,width:1200,height:850,focused:true};
  if(appBounds&&appBounds.width>=400&&appBounds.height>=300)Object.assign(o,appBounds);
  else{try{const f=await chrome.windows.getLastFocused();if(f&&f.width){o.width=Math.min(1200,f.width);o.height=Math.min(850,f.height);o.left=Math.max(0,Math.round(f.left+(f.width-o.width)/2));o.top=Math.max(0,Math.round(f.top+(f.height-o.height)/2))}}catch(e){}}
  let w;try{w=await chrome.windows.create(o)}catch(e){delete o.left;delete o.top;w=await chrome.windows.create(o)}
  await SES.set({appWin:w.id});return w.id}
chrome.windows.onRemoved.addListener(async id=>{const {appWin}=await SES.get('appWin');if(appWin===id)await SES.remove('appWin')});
if(chrome.windows.onBoundsChanged)chrome.windows.onBoundsChanged.addListener(async w=>{const {appWin}=await SES.get('appWin');
  if(w.id===appWin&&w.state==='normal')chrome.storage.local.set({appBounds:{left:w.left,top:w.top,width:w.width,height:w.height}})});
// Toolbar icon shows the popup (action.default_popup); the popup asks for the window via a message.
function waitLoaded(tabId,ms){return new Promise((res,rej)=>{const t=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(f);rej(new Error('VA.gov took too long to load'))},ms);
  function f(id,info){if(id===tabId&&info.status==='complete'){clearTimeout(t);chrome.tabs.onUpdated.removeListener(f);res()}}
  chrome.tabs.onUpdated.addListener(f);chrome.tabs.get(tabId).then(tb=>{if(tb.status==='complete'){clearTimeout(t);chrome.tabs.onUpdated.removeListener(f);res()}}).catch(()=>{})})}
// Reads VA data by running pull.js inside a www.va.gov tab, so requests to api.va.gov carry
// the user's normal VA.gov session exactly like VA.gov's own pages (GET only, read-only).
async function runInVA(fn,args,refocus){
  let [tab]=await chrome.tabs.query({url:'https://www.va.gov/*'});let opened=null;
  let openedWin=null;
  if(!tab){const normal=(await chrome.windows.getAll({windowTypes:['normal']}))[0];
    if(normal)tab=opened=await chrome.tabs.create({url:'https://www.va.gov/',active:false,windowId:normal.id});
    else{const w=await chrome.windows.create({url:'https://www.va.gov/',focused:false,state:'minimized'});openedWin=w.id;tab=w.tabs[0]}}
  try{await waitLoaded(tab.id,30000);
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['pull.js']});
    const [r]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:(n,a)=>self[n](...a),args:[fn,args||[]]});
    return r&&r.result||{ok:false,error:'no result'}}
  finally{if(opened)chrome.tabs.remove(opened.id).catch(()=>{});if(openedWin)chrome.windows.remove(openedWin).catch(()=>{});
    const {appWin}=await SES.get('appWin');if(appWin&&refocus)chrome.windows.update(appWin,{focused:true}).catch(()=>{})}}
function pull(refocus){return runInVA('vatozPull',[],refocus)}

// One-click VA sync: try silently; if not signed in, open a small VA.gov window, wait for sign-in, pull, close.
const MYVA='https://www.va.gov/my-va/';
async function loginSync(refocus){
  try{const r=await runInVA('vatozPull',[],false);if(r&&r.ok)return r;if(!r||r.error!=='not-logged-in')return r}catch(e){}
  const w=await chrome.windows.create({type:'popup',url:MYVA,width:480,height:720,focused:true});const tabId=w.tabs[0].id;
  return await new Promise(res=>{let busy=false,done=false;
    const fin=v=>{if(done)return;done=true;clearInterval(iv);clearTimeout(to);chrome.windows.onRemoved.removeListener(onRm);chrome.tabs.onUpdated.removeListener(onUp);
      if(v.ok)chrome.windows.remove(w.id).catch(()=>{});
      SES.get('appWin').then(({appWin})=>{if(appWin&&refocus)chrome.windows.update(appWin,{focused:true}).catch(()=>{})});res(v)};
    const onRm=id=>{if(id===w.id)fin({ok:false,error:'canceled'})};
    const tryPull=async()=>{if(busy||done)return;busy=true;try{const tb=await chrome.tabs.get(tabId);
        if(tb.status==='complete'&&/^https:\/\/www\.va\.gov\//.test(tb.url||'')){
          await chrome.scripting.executeScript({target:{tabId},files:['pull.js']});
          const [x]=await chrome.scripting.executeScript({target:{tabId},func:()=>self.vatozPull()});
          if(x&&x.result&&x.result.ok)fin(x.result)}}catch(e){}busy=false};
    const onUp=(id,info)=>{if(id===tabId&&info.status==='complete')tryPull()};
    chrome.windows.onRemoved.addListener(onRm);chrome.tabs.onUpdated.addListener(onUp);
    const iv=setInterval(tryPull,4000);const to=setTimeout(()=>{chrome.windows.remove(w.id).catch(()=>{});fin({ok:false,error:'timed out waiting for VA.gov sign-in'})},15*60000);tryPull()})}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m&&m.type==='VATOZ_LOGIN_SYNC'&&sender.url&&sender.url.startsWith(APP)){loginSync(!/[?&]popup=1/.test(sender.url)).then(reply,e=>reply({ok:false,error:String(e&&e.message||e)}));return true}
  if(!m||!sender.url||!sender.url.startsWith(APP))return;
  if(m.type==='VATOZ_OPEN_WINDOW'){openApp(m.intent||null).then(id=>reply({ok:true,id}),e=>reply({ok:false,error:String(e)}));return true}
  if(m.type==='VATOZ_PULL_CLAIM'){runInVA('vatozPullClaim',[String(m.id||'')],!/[?&]popup=1/.test(sender.url)).then(reply,e=>reply({ok:false,error:String(e&&e.message||e)}));return true}
  if(m.type!=='VATOZ_PULL')return;
  pull(!/[?&]popup=1/.test(sender.url)).then(reply,e=>reply({ok:false,error:String(e&&e.message||e)}));return true});
