const APP_URLS=['https://rrkennedy69.github.io/VA-to-Z/*','file:///*'];
const $=id=>document.getElementById(id);let last=null;
function say(h,cls){$('msg').innerHTML='<p class="'+(cls||'')+'">'+h+'</p>'}
async function vaTab(){const [act]=await chrome.tabs.query({active:true,currentWindow:true});
  if(act&&/^https:\/\/www\.va\.gov\//.test(act.url||''))return act;
  const t=await chrome.tabs.query({url:'https://www.va.gov/*'});return t[0]||null}
async function sendToApp(data){let tabs=[];try{tabs=await chrome.tabs.query({url:APP_URLS})}catch(e){}
  let n=0;for(const t of tabs){try{const r=await chrome.tabs.sendMessage(t.id,{type:'VATOZ_VA_DATA',data});if(r&&r.ok)n++}catch(e){}}return n}
function summary(d){const p=d.profile||{};return [(p.first||p.last)?'Name: '+[p.first,p.last].join(' '):'',d.ratings&&d.ratings.combined!=null?'Combined rating: '+d.ratings.combined+'%':'',
  (d.ratings&&d.ratings.conditions||[]).length+' rated condition(s)',(d.claims||[]).length+' claim(s)',(d.service||[]).length+' service period(s)'].filter(Boolean).join('<br>')}
$('pull').onclick=async()=>{$('pull').disabled=true;say('Reading from VA.gov…');
  try{const t=await vaTab();if(!t){say('Open <b>www.va.gov</b> in a tab and log in first, then press the button again.','err');return}
    const [res]=await chrome.scripting.executeScript({target:{tabId:t.id},files:['pull.js']}).then(()=>chrome.scripting.executeScript({target:{tabId:t.id},func:()=>vatozPull()}));
    const r=res&&res.result;
    if(!r||!r.ok){say(r&&r.error==='not-logged-in'?'You don\'t seem to be logged in to VA.gov. Log in there, then try again.':'Could not read your VA.gov info. Make sure you are logged in, then try again.','err');return}
    last=r.data;await chrome.storage.local.set({vatozLast:last});
    const n=await sendToApp(last);
    say('<span class="ok">✓ Got your VA data.</span><br>'+summary(last)+'<br><br>'+(n?'Sent to the VA to Z app ('+n+' tab'+(n>1?'s':'')+'). Switch to it to review and apply.':'No VA to Z tab is open. Open the app and it will pick this up, or download the file and use <b>Import VA data file</b>.'));
    $('dl').style.display='block'}
  catch(e){say('Something went wrong: '+(e&&e.message||e),'err')}finally{$('pull').disabled=false}};
$('dl').onclick=()=>{if(!last)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(last,null,2)],{type:'application/json'}));
  a.download='va-data-'+last.pulledAt.slice(0,10)+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)};
chrome.storage.local.get('vatozLast').then(o=>{if(o.vatozLast){last=o.vatozLast;$('dl').style.display='block';say('Last pull: '+new Date(last.pulledAt).toLocaleString())}});
