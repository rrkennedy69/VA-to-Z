// VA to Z Sync: service worker. Fetches ONE claim's details for the VA to Z app (read-only GET),
// by running pull.js inside a www.va.gov tab so it uses the user's normal VA.gov session.
function waitLoaded(tabId,ms){return new Promise((res,rej)=>{const t=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(f);rej(new Error('VA.gov took too long to load'))},ms);
  function f(id,info){if(id===tabId&&info.status==='complete'){clearTimeout(t);chrome.tabs.onUpdated.removeListener(f);res()}}
  chrome.tabs.onUpdated.addListener(f);chrome.tabs.get(tabId).then(tb=>{if(tb.status==='complete'){clearTimeout(t);chrome.tabs.onUpdated.removeListener(f);res()}}).catch(()=>{})})}
async function runInVA(fn,args){let [tab]=await chrome.tabs.query({url:'https://www.va.gov/*'});let opened=null;
  if(!tab)tab=opened=await chrome.tabs.create({url:'https://www.va.gov/',active:false});
  try{await waitLoaded(tab.id,30000);await chrome.scripting.executeScript({target:{tabId:tab.id},files:['pull.js']});
    const [r]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:(n,a)=>self[n](...a),args:[fn,args||[]]});return r&&r.result||{ok:false,error:'no result'}}
  finally{if(opened)chrome.tabs.remove(opened.id).catch(()=>{})}}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(!m||m.type!=='VATOZ_PULL_CLAIM'||!sender.tab)return;
  runInVA('vatozPullClaim',[String(m.id||'')]).then(reply,e=>reply({ok:false,error:String(e&&e.message||e)}));return true});
