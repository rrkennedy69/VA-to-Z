// VA to Z (all-in-one extension) service worker.
const APP=chrome.runtime.getURL('app.html');
async function openApp(){
  const tabs=await chrome.tabs.query({url:APP+'*'});
  if(tabs.length){await chrome.tabs.update(tabs[0].id,{active:true});await chrome.windows.update(tabs[0].windowId,{focused:true});}
  else await chrome.tabs.create({url:APP});
}
chrome.action.onClicked.addListener(()=>{openApp()});
function waitLoaded(tabId,ms){return new Promise((res,rej)=>{const t=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(f);rej(new Error('VA.gov took too long to load'))},ms);
  function f(id,info){if(id===tabId&&info.status==='complete'){clearTimeout(t);chrome.tabs.onUpdated.removeListener(f);res()}}
  chrome.tabs.onUpdated.addListener(f);chrome.tabs.get(tabId).then(tb=>{if(tb.status==='complete'){clearTimeout(t);chrome.tabs.onUpdated.removeListener(f);res()}}).catch(()=>{})})}
// Reads VA data by running pull.js inside a www.va.gov tab, so requests to api.va.gov carry
// the user's normal VA.gov session exactly like VA.gov's own pages (GET only, read-only).
async function pull(){
  let [tab]=await chrome.tabs.query({url:'https://www.va.gov/*'});let opened=null;
  if(!tab){tab=opened=await chrome.tabs.create({url:'https://www.va.gov/',active:false});}
  try{await waitLoaded(tab.id,30000);
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['pull.js']});
    const [r]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>vatozPull()});
    return r&&r.result||{ok:false,error:'no result'}}
  finally{if(opened)chrome.tabs.remove(opened.id).catch(()=>{})}}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(!m||m.type!=='VATOZ_PULL'||!sender.url||!sender.url.startsWith(APP))return;
  pull().then(reply,e=>reply({ok:false,error:String(e&&e.message||e)}));return true});
