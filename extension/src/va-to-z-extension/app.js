var IS_EXT=!!(window.VATOZ_EXT);if(IS_EXT)document.documentElement.classList.add("isext");var IS_POPUP=IS_EXT&&/[?&]popup=1/.test(location.search);if(IS_POPUP)document.documentElement.classList.add("ispopup");
/*CALC_START*/
// OFFICIAL method = 38 CFR 4.25 Table I: arrange in order of severity; combine two at a time; each result is
// the whole number shown in Table I (= a + b*(100-a)/100 rounded half up; verified against all 684 entries
// of Table I from eCFR); the final combined value is converted to the nearest 10 (5 rounds up).
// Bilateral factor (38 CFR 4.26): combine the paired-extremity ratings "as usual" (Table I), add 10% of that
// value (not combined), rounded to the nearest whole number as in the 4.26 example (19 + 1.9 = 21), and treat
// it as one disability. 4.26(b): all four extremities go into one factor. 4.26(c): needs a compensable rating on
// each side of the pair. 4.26(d): if leaving some bilateral ratings out of the factor gives a higher result,
// they are left out (most favorable to the veteran).
// EXACT method (informational only): same order, full precision, no intermediate rounding.
function fix(x){return Math.round(x*1e9)/1e9}
function h2(x){return (Math.round(fix(x)*100)/100).toFixed(2)}
function tableCombine(a,b){return Math.floor((100*a+b*(100-a)+50)/100)} // Table I cell (integers)
function sortDesc(l){return l.filter(function(x){return x>0}).slice().sort(function(x,y){return y-x})}
function combineTable(list,steps,label){var a=sortDesc(list),c=0;for(var i=0;i<a.length;i++){var p=c;c=i===0?a[0]:tableCombine(c,a[i]);if(c>100)c=100;if(steps)steps.push((label||'')+(i===0?'Start with '+a[0]+'%':'Table I: '+p+' and '+a[i]+' combine to '+c+'%'))}return c}
function combineExact(list){var a=sortDesc(list),c=0;for(var i=0;i<a.length;i++)c=fix(c+a[i]*(100-c)/100);return c}
function combineValues(list){return combineTable(list)}
function toTen(v){return Math.min(100,Math.floor(v/10+0.5)*10)}
function bilGroup(e){return e.limb?(e.part==='arm'||e.part==='leg'?e.part:'limb'):''}
function pairOK(list){var q={};list.forEach(function(e){var gg=bilGroup(e);q[gg]=q[gg]||{L:0,R:0};if(e.side==='L'||e.side==='B')q[gg].L=1;if(e.side==='R'||e.side==='B')q[gg].R=1});
  var ok={};for(var k in q)ok[k]=!!(q[k].L&&q[k].R);return ok}
// evaluate one choice of which limb entries go into the bilateral factor
function evalChoice(all,inSet,steps){
  var bil=[],others=[];all.forEach(function(e,i){if(inSet[i])bil.push(e.pct);else others.push(e.pct)});
  var r={bilCombined:0,bilFactor:0,bilValue:0,exBilValue:0};
  if(bil.length){r.bilCombined=combineTable(bil,steps,'Bilateral: ');r.bilFactor=r.bilCombined/10;r.bilValue=Math.floor(r.bilCombined*1.1+0.5+1e-9);
    if(steps)steps.push('Bilateral factor: '+r.bilCombined+'% + 10% of it ('+h2(r.bilFactor)+') = '+h2(r.bilCombined+r.bilFactor)+'%, rounded to '+r.bilValue+'% and used as one rating');
    r.exBilValue=fix(combineExact(bil)*1.1);}
  var offList=others.concat(bil.length?[r.bilValue]:[]);
  r.whole=combineTable(offList,steps,bil.length?'All: ':'');
  r.exact=combineExact(others.concat(bil.length?[r.exBilValue]:[]));
  return r;
}
// entries: [{pct, side:'L'|'R'|'B'|'', limb:bool, part:'arm'|'leg'|''}]
function vaCombined(entries){
  var all=entries.filter(function(e){return e.pct>0});
  var limbIdx=[];all.forEach(function(e,i){if(bilGroup(e))limbIdx.push(i)});
  // a set qualifies if, for every group it uses, it has both a left and a right side (4.26(c))
  function qualifies(set){var used=all.filter(function(e,i){return set[i]});if(!used.length)return true;var ok=pairOK(used);for(var k in ok)if(!ok[k])return false;return true}
  var full={},okAll=pairOK(limbIdx.map(function(i){return all[i]}));limbIdx.forEach(function(i){if(okAll[bilGroup(all[i])])full[i]=true});
  var best=full,bestR=evalChoice(all,full),n=limbIdx.length;
  if(n&&n<=12){for(var m=0;m<(1<<n);m++){var set={};for(var j=0;j<n;j++)if(m&(1<<j))set[limbIdx[j]]=true;if(!qualifies(set))continue;var r=evalChoice(all,set);if(r.whole>bestR.whole){best=set;bestR=r}}}
  var steps=[];var R=evalChoice(all,best,steps);
  var inBil=Object.keys(best).length,excluded=Object.keys(full).filter(function(i){return !best[i]}).length;
  var rounded=toTen(R.whole);var exactRounded=toTen(Math.floor(R.exact+0.5));
  steps.push('Combined value '+R.whole+'% → official rating '+rounded+'% (nearest 10, 5 rounds up)');
  var pairs=Object.keys(pairOK(all.filter(function(e,i){return best[i]})))
  return {whole:R.whole,rounded:rounded,exact:R.exact,exactStr:h2(R.exact),exactRounded:exactRounded,differs:exactRounded!==rounded,
    bilateral:inBil>0,bilCombined:R.bilCombined,bilFactor:R.bilFactor,bilValue:R.bilValue,bilCombinedStr:String(R.bilCombined),bilFactorStr:h2(R.bilFactor),bilValueStr:String(R.bilValue),
    excludedFromBilateral:excluded,steps:steps,pairs:inBil?pairs:[]};
}
// Monthly compensation estimate from embedded VA rate tables (basic + optional SMC).
// smc = {level:''|'S'|'L'|'L½'|'M'|'M½'|'N'|'N½'|'O/P'|'R.1'|'R.2'|'T', k:0..3}
// SMC levels replace the basic rate (VA SMC tables, which include dependents). SMC-K is added to the basic
// rate (any rating 0-100%) and to all SMC rates except O/P and R (va.gov), 1 to 3 awards. 38 U.S.C. 1114(k)
// caps: basic (or S) + K may not exceed the SMC-L rate; L through N (incl. half-steps) + K may not exceed the
// SMC-O/P rate. Caps are applied to the Veteran-alone amounts; dependent amounts are added on top.
function depIdx(d){var sp=d.spouse?1:0,par=Math.min(2,d.parents|0);return sp?(par===0?1:par===1?2:3):(par===0?0:par===1?4:5)}
function vaPay(R,rating,d,smc){
  d=d||{};smc=smc||{};var level=smc.level||'',k=Math.max(0,Math.min(3,smc.k|0));
  var kids=Math.max(0,d.kids|0),sch=Math.max(0,d.school|0),idx=depIdx(d),lines=[],total=0,alone=0,depPart=0,K=R.smc?R.smc.k:0;
  function m(x){return '$'+x.toFixed(2)}
  if(level){
    var T=R.smc,col=level==='R.2'||level==='T'?'R.2/T':level,tb=(kids+sch>0)?T.child:T.noChild;
    var base=tb[col][idx];alone=T.noChild[col][0];
    lines.push('SMC-'+level+' basic rate'+(kids+sch>0?' (includes 1 child)':'')+': '+m(base));
    depPart=base-alone;
    if(kids+sch>0){var addK=kids>0?kids-1:0,addS=kids>0?sch:sch-1;
      if(kids===0){var df=T.addSchool-T.addU18;depPart+=df;lines.push('First child is in school (school rate minus under-18 rate): +'+m(df)+' (estimate)')}
      if(addK>0){depPart+=addK*T.addU18;lines.push(addK+' more child(ren) under 18 × '+m(T.addU18))}
      if(addS>0){depPart+=addS*T.addSchool;lines.push(addS+' more child(ren) in school × '+m(T.addSchool))}}
    if(d.spouse&&d.aa){depPart+=T.spouseAA;lines.push('Spouse Aid & Attendance: +'+m(T.spouseAA))}
    var kOK=!(level==='O/P'||level.charAt(0)==='R'||level==='T');
    if(k&&kOK){var cap=(level==='S')?T.noChild.L[0]:T.noChild['O/P'][0],want=alone+k*K,got=Math.min(want,cap);
      lines.push('SMC-K × '+k+': +'+m(k*K)+(got<want?' (limited by the 38 U.S.C. 1114(k) cap: Veteran-alone amount can’t go over '+m(cap)+'; −'+m(want-got)+')':''));alone=got}
    else if(k&&!kOK)lines.push('SMC-K is not added to SMC-'+level+' (VA rule)');
    total=alone+depPart;
  } else {
    if(rating<10&&!k)return {total:0,lines:['0% ratings do not pay monthly compensation.']};
    var r=String(rating);
    if(rating<10){alone=0;lines.push('Basic rate at 0%: $0.00')}
    else if(rating<30){alone=R.flat[r];lines.push('Basic rate at '+r+'% (dependents do not change pay below 30%): '+m(alone))}
    else{var tb2=(kids+sch>0)?R.child:R.noChild,b2=tb2[r][idx];alone=R.noChild[r][0];depPart=b2-alone;lines.push('Basic rate'+(kids+sch>0?' (includes 1 child)':'')+': '+m(b2));
      if(kids+sch>0){var aK=kids>0?kids-1:0,aS=kids>0?sch:sch-1;
        if(kids===0){var df2=R.addSchool[r]-R.addU18[r];depPart+=df2;lines.push('First child is in school (school rate minus under-18 rate): +'+m(df2)+' (estimate)')}
        if(aK>0){depPart+=aK*R.addU18[r];lines.push(aK+' more child(ren) under 18 × '+m(R.addU18[r]))}
        if(aS>0){depPart+=aS*R.addSchool[r];lines.push(aS+' more child(ren) in school × '+m(R.addSchool[r]))}}
      if(d.spouse&&d.aa){depPart+=R.spouseAA[r];lines.push('Spouse Aid & Attendance: +'+m(R.spouseAA[r]))}}
    if(k&&R.smc){var cap2=R.smc.noChild.L[0],w2=alone+k*K,g2=Math.min(w2,cap2);lines.push('SMC-K × '+k+': +'+m(k*K)+(g2<w2?' (limited by the 38 U.S.C. 1114(k) cap: Veteran-alone amount can’t go over '+m(cap2)+'; −'+m(w2-g2)+')':''));alone=g2}
    total=alone+depPart;
  }
  return {total:Math.round(total*100)/100,lines:lines};
}
/*CALC_END*/

var CFR=JSON.parse(document.getElementById('cfr').textContent);
var RATES=JSON.parse(document.getElementById('rates').textContent);
var BYDC={};CFR.forEach(function(e){BYDC[e.c]=e});
var KEY='vaHelper.v1';
var S={apiKey:'',model:'grok-4.7',calc:{entries:[],deps:{spouse:0,aa:0,parents:0,kids:0,school:0}},claims:{},order:[],current:null,tab:'setup'};
var storageOK=true;
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
/* ---------- storage: IndexedDB (primary) + localStorage mirror ---------- */
var DB=null,DBERR='',BOOTED=false;
function idbOpen(){return new Promise(function(res){try{if(!window.indexedDB){DBERR='IndexedDB is not available in this browser';return res(null)}
  var r=indexedDB.open('vaToZ',1);r.onupgradeneeded=function(){var d=r.result;if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv');if(!d.objectStoreNames.contains('files'))d.createObjectStore('files')};
  r.onsuccess=function(){res(r.result)};r.onerror=function(){DBERR=String((r.error&&r.error.message)||'could not open');res(null)};r.onblocked=function(){DBERR='database blocked';res(null)}}catch(e){DBERR=e.message;res(null)}})}
function idb(store,mode,fn){return new Promise(function(res,rej){if(!DB)return rej(new Error(DBERR||'No database'));try{var tx=DB.transaction(store,mode),r=fn(tx.objectStore(store)),out;if(r)r.onsuccess=function(){out=r.result};tx.oncomplete=function(){res(out)};tx.onerror=tx.onabort=function(){rej(tx.error||new Error('Storage error'))}}catch(e){rej(e)}})}
function idbGet(s,k){return idb(s,'readonly',function(st){return st.get(k)})}
function idbPut(s,k,v){return idb(s,'readwrite',function(st){return st.put(v,k)})}
function idbDel(s,k){return idb(s,'readwrite',function(st){return st.delete(k)})}
function idbClear(s){return idb(s,'readwrite',function(st){return st.clear()})}
var saveT=null;
function setInd(m){var i=$('saveInd');if(i)i.textContent=m}
function savedOK(where){storageOK=true;var t=new Date(S._savedAt);$('saveStatus').textContent='Saved on this device'+(where?' ('+where+')':'')+' at '+t.toLocaleTimeString();setInd('All changes saved')}
function saveFail(e){storageOK=false;$('saveStatus').innerHTML='<span class="err">Could not save in this browser ('+esc(e&&e.message||'storage blocked')+'). Use <a href="#" data-go="tool-backup">Download Backup in Tools</a> to keep your work.</span>';$('saveInd').innerHTML='<a href="#" data-go="tool-backup" style="color:#ffc72c">⚠ Not saved · Back up</a>'}
function saveNow(){clearTimeout(saveT);if(!BOOTED)return;S._savedAt=new Date().toISOString();var json=JSON.stringify(S),okLS=false;
  try{localStorage.setItem(KEY,json);okLS=true}catch(e){}
  if(DB){idbPut('kv','state',json).then(function(){savedOK()},function(e){if(okLS)savedOK('backup copy only');else saveFail(e)})}
  else if(okLS)savedOK('basic storage');else saveFail(new Error(DBERR||'storage blocked'));
  scheduleMirror();renderRemind()}
function save(){clearTimeout(saveT);setInd('Saving…');saveT=setTimeout(saveNow,IS_POPUP?60:250)}
async function boot(){DB=await idbOpen();var a=null,b=null;
  if(DB){try{var j=await idbGet('kv','state');if(j)a=JSON.parse(j)}catch(e){}}
  try{var l=localStorage.getItem(KEY);if(l)b=JSON.parse(l)}catch(e){}
  var pick=(a&&b)?(((b._savedAt||'')>(a._savedAt||''))?b:a):(a||b);
  if(pick)for(var k in pick)S[k]=pick[k];
  BOOTED=true;init();if(DB&&!a&&b)saveNow(); // one-time migration from localStorage
  requestPersist();await dirBoot();renderRemind();document.body.setAttribute('data-ready','1');try{applyIntent()}catch(e){}}
/* persistent storage */
async function requestPersist(){var el=$('storageInfo');if(!el)return;var h='';
  try{if(navigator.storage&&navigator.storage.persist){var p=await navigator.storage.persisted();if(!p)p=await navigator.storage.persist();
      h+=p?'<b class="ok">✓ Storage protected.</b> Your browser has agreed not to erase this app\'s data when space runs low.':'<b class="err">Storage not protected.</b> The browser may erase this app\'s data if the device runs low on space or you clear browsing data. Keep backups.'}
    else h+='This browser can\'t protect storage from cleanup. Keep backups.';
    if(navigator.storage&&navigator.storage.estimate){var e=await navigator.storage.estimate();h+='<br>Using '+fmtSize(e.usage||0)+(e.quota?' of about '+fmtSize(e.quota)+' available':'')+'.'}}catch(x){h+='Storage status unavailable.'}
  if(!DB)h+='<br><span class="err">Document storage (IndexedDB) is not available here: '+esc(DBERR)+'. Settings still save, but documents can\'t be stored.</span>';
  if(IS_SAFARI_FILE)h+='<br><span class="err">Safari note:</span> Safari limits storage for pages opened as a file. Data may not be kept or may be erased after 7 days without use. Make backups often.';
  el.innerHTML=h}
var IS_SAFARI_FILE=location.protocol==='file:'&&/Safari\//.test(navigator.userAgent)&&!/Chrome|Chromium|CriOS|Edg|Android/.test(navigator.userAgent);
function fmtSize(n){n=+n||0;return n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':n<1073741824?(n/1048576).toFixed(1)+' MB':(n/1073741824).toFixed(2)+' GB'}
/* files: gzip when it helps, SHA-256 integrity */
var CAN_GZ=typeof CompressionStream==='function'&&typeof DecompressionStream==='function';
async function sha(buf){if(!(window.crypto&&crypto.subtle))return '';var h=await crypto.subtle.digest('SHA-256',buf);return Array.prototype.map.call(new Uint8Array(h),function(x){return x.toString(16).padStart(2,'0')}).join('')}
async function gzip(buf,compress){var s=new Blob([buf]).stream().pipeThrough(compress?new CompressionStream('gzip'):new DecompressionStream('gzip'));return await new Response(s).arrayBuffer()}
async function storeFile(id,buf,type,expectHash){var hash=await sha(buf);if(expectHash&&hash&&hash!==expectHash)throw new Error('Integrity check failed');var data=buf,gz=false;
  if(CAN_GZ){try{var c=await gzip(buf,true);if(c.byteLength<buf.byteLength*0.97){data=c;gz=true}}catch(e){}}
  await idbPut('files',id,{data:data,gz:gz,type:type||'',hash:hash});
  var back=await readFile(id); if(back.buf.byteLength!==buf.byteLength)throw new Error('Saved copy did not match');
  return {gz:gz,stored:data.byteLength,hash:hash}}
async function readFile(id){var r=await idbGet('files',id);if(!r)throw new Error('File is missing from storage');var buf=r.data instanceof ArrayBuffer?r.data:await new Blob([r.data]).arrayBuffer();
  if(r.gz)buf=await gzip(buf,false);if(r.hash){var h=await sha(buf);if(h&&h!==r.hash)throw new Error('Integrity check failed: this file is damaged')}return {buf:buf,type:r.type}}
function b64(buf){return new Promise(function(res){var fr=new FileReader();fr.onload=function(){res(String(fr.result).split(',')[1]||'')};fr.readAsDataURL(new Blob([buf]))})}
function unb64(s){var bin=atob(s),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u.buffer}
document.addEventListener('input',function(e){if(e.target.id!=='q'&&e.target.id!=='imp'&&e.target.id!=='imp2'&&e.target.id!=='cMsg')save()},true);
document.addEventListener('change',function(e){if(e.target.id!=='imp'&&e.target.id!=='imp2'&&!e.target.dataset.up)save()},true);
var sbT;$('saveBtn').onclick=function(){saveNow();var b=$('saveBtn');b.textContent='Saved ✓';setInd('Saved at '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'}));clearTimeout(sbT);sbT=setTimeout(function(){b.textContent='Save'},2500)};
window.addEventListener('beforeunload',saveNow);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')saveNow()});
window.addEventListener('pagehide',saveNow);

/* ---------- tabs ---------- */
function tab(t){if(t==='calc'||t==='data')t='tools';S.tab=t;document.querySelectorAll('section').forEach(function(s){s.classList.toggle('on',s.id===t)});document.querySelectorAll('#nav button').forEach(function(b){b.classList.toggle('on',b.dataset.t===t)});if(t==='claims')renderClaims();save();window.scrollTo(0,0)}
$('nav').addEventListener('click',function(e){if(e.target.dataset.t)tab(e.target.dataset.t)});
function goTool(id){if(S.tab!=='tools')tab('tools');var el=$(id);if(!el)return;if(el.tagName==='DETAILS')el.open=true;setTimeout(function(){var y=el.getBoundingClientRect().top+window.scrollY-150;window.scrollTo({top:y,behavior:'smooth'});var s=el.querySelector('summary');if(s)s.focus({preventScroll:true})},30)}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-go]');if(b){e.preventDefault();goTool(b.dataset.go)}});
function toolSums(){try{renderSyncLast();}catch(e){}try{var r=vaCombined(S.calc.entries),sm=S.calc.smc||{},p=vaPay(RATES,r.rounded,S.calc.deps,sm);
  $('sum-calc').textContent=(S.calc.entries.length||sm.level||sm.k)?('Official rating '+r.rounded+'% · '+money(p.total)+'/mo'+(sm.level||sm.k?' · SMC':'')):'Combine your ratings and estimate monthly pay';}catch(x){}
  $('sum-backup').textContent=(S.lastBackup?'Last backup: '+new Date(S.lastBackup).toLocaleDateString():'No backup saved yet — tap to make one')+(DIRSTATE==='ok'?' · Save folder on':DIRSTATE==='needs'?' · Save folder needs reconnect':'');
  $('sum-clear').textContent='Erase everything on this device';
  $('sum-about').textContent=CFR.length+' diagnostic codes · '+RATES.year}

/* ---------- setup ---------- */
$('saveKey').onclick=function(){S.apiKey=$('apikey').value.trim();S.model=$('model').value.trim()||'grok-4.7';saveNow();$('testOut').innerHTML='<span class="ok">Saved.</span>'};
$('apikey').addEventListener('input',function(){S.apiKey=this.value.trim();save()});
$('model').addEventListener('input',function(){S.model=this.value.trim()||'grok-4.7';save()});
$('showKey').onclick=function(){var i=$('apikey');i.type=i.type==='password'?'text':'password'};
async function callGrok(messages){
  if(!S.apiKey)throw new Error('No API key yet. Add one on the Setup tab.');
  var r=await fetch('https://api.x.ai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+S.apiKey},body:JSON.stringify({model:S.model||'grok-4.7',messages:messages})});
  var j=null;try{j=await r.json()}catch(e){}
  if(!r.ok){var m=(j&&(j.error&&(j.error.message||j.error)||j.message))||('HTTP '+r.status);throw new Error(typeof m==='string'?m:JSON.stringify(m))}
  return j.choices[0].message.content;
}
$('testKey').onclick=async function(){S.apiKey=$('apikey').value.trim();S.model=$('model').value.trim()||'grok-4.7';save();$('testOut').textContent='Testing...';
  try{var a=await callGrok([{role:'user',content:'Reply with exactly: Connection OK'}]);$('testOut').innerHTML='<span class="ok">Works!</span> Model '+esc(S.model)+' replied: '+esc(a)}
  catch(e){$('testOut').innerHTML='<span class="err">Test failed:</span> '+esc(e.message)+'<br><span class="muted">Check the key, the model name, your xAI credits, and your internet connection.</span>'}};

/* ---------- calculator ---------- */
var EXT=null; // 'arm:L' etc
function migrateCalc(){var c=S.calc||(S.calc={});c.entries=(c.entries||[]).map(function(e){var o={name:e.name||'',pct:+e.pct||0,side:e.side||'',limb:!!e.limb,part:e.part||''};if(e.va)o.va=e.va;return o});var d=c.deps||(c.deps={});['spouse','aa','parents','kids','school'].forEach(function(k){d[k]=Math.max(0,+d[k]||0)});if(d.parents>2)d.parents=2;if(!d.spouse)d.aa=0;var sm=c.smc||(c.smc={level:'',k:0});sm.level=sm.level||'';sm.k=Math.max(0,Math.min(3,+sm.k||0))}
(function(){var h='';for(var p=10;p<=100;p+=10)h+='<button type="button" data-pct="'+p+'">'+p+'%</button>';$('pctBtns').innerHTML=h})();
$('extBtns').addEventListener('click',function(e){var b=e.target.closest('[data-ext]');if(!b)return;EXT=(EXT===b.dataset.ext)?null:b.dataset.ext;showExt()});
function showExt(){document.querySelectorAll('#extBtns button').forEach(function(b){var on=b.dataset.ext===EXT;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
  $('extHint').textContent=EXT?'Next rating goes on: '+extName(EXT.split(':')[0],EXT.split(':')[1])+'. Tap it again to cancel.':'No body part chosen: next rating is added as "other" (not an arm or leg).'}
function extName(part,side){return (side==='L'?'Left ':side==='R'?'Right ':side==='B'?'Both ':'')+(part==='arm'?'Arm':part==='leg'?'Leg':'Limb')}
$('pctBtns').addEventListener('click',function(e){var b=e.target.closest('[data-pct]');if(!b)return;var en={name:'',pct:+b.dataset.pct,side:'',limb:false,part:''};
  if(EXT){var x=EXT.split(':');en.part=x[0];en.side=x[1];en.limb=true}
  S.calc.entries.push(en);EXT=null;showExt();renderCalc();save()});
function money(n){return '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function renderCalc(){
  migrateCalc();var E=S.calc.entries,d=S.calc.deps;
  $('cList').innerHTML=E.length?E.map(function(e,i){var lbl=e.limb?extName(e.part,e.side):'Other';return '<span class="rchip'+(e.limb?' limb':'')+'">'+(e.name?esc(e.name)+' · ':'')+esc(lbl)+' <b>'+e.pct+'%</b><button type="button" data-del="'+i+'" aria-label="Remove '+esc(lbl)+' '+e.pct+'%">✕</button></span>'}).join(''):'<span class="muted">No ratings yet. Tap a percent above.</span>';
  var r=vaCombined(E);
  var h='<div class="resrow"><div><div class="lbl">Official combined rating</div><div class="big">'+r.rounded+'%</div></div><div class="small">VA Combined Ratings Table value <b id="wholeVal">'+r.whole+'%</b>, rounded to the nearest 10: <b>'+r.rounded+'%</b>.<br>Exact math (for info only, no rounding between steps): <b id="exactVal">'+r.exactStr+'%</b></div></div>';
  if(r.differs)h+='<p class="muted" id="diffNote">Note: exact math alone would round to '+r.exactRounded+'%, but VA uses its table (which rounds at each step), so the official rating is '+r.rounded+'%.</p>';
  if(r.excludedFromBilateral)h+='<p class="muted">'+r.excludedFromBilateral+' limb rating(s) were left out of the bilateral factor because that gives you a higher result (38 CFR 4.26(d)).</p>';
  if(r.bilateral)h+='<p class="muted">Bilateral factor applied ('+r.pairs.map(function(p){return p==='arm'?'both arms':p==='leg'?'both legs':'both sides'}).join(' and ')+'): those ratings combine to '+r.bilCombinedStr+'%, plus 10% of that ('+r.bilFactorStr+'), rounded = '+r.bilValueStr+'%, then combined with the rest.</p>';
  else if(E.some(function(e){return e.limb}))h+='<p class="muted">No bilateral factor yet: it needs ratings on both arms, or on both legs.</p>';
  if(E.length)h+='<details class="howc"><summary>How we got this</summary><ol>'+r.steps.map(function(s){return '<li>'+esc(s)+'</li>'}).join('')+'</ol></details>';
  $('cResult').innerHTML=h;renderRing($('ringBox'),r.rounded,E.length?r.exactStr:null,'Total Rating');renderCalcVA();if($('sum-calc'))setTimeout(toolSums,0);
  document.querySelectorAll('#mar button').forEach(function(b){var v=+b.dataset.mar,on=(v===0&&!d.spouse)||(v===1&&d.spouse&&!d.aa)||(v===2&&d.spouse&&d.aa);b.classList.toggle('on',on);b.setAttribute('aria-checked',on);b.setAttribute('role','radio')});
  ['kids','school','parents'].forEach(function(k){$('v_'+k).textContent=d[k]});
  var sm=S.calc.smc;$('v_smck').textContent=sm.k;document.querySelectorAll('input[name=smclvl]').forEach(function(i){i.checked=i.value===sm.level});
  var p=vaPay(RATES,r.rounded,d,sm);
  var sumTxt=sm.level||sm.k?((sm.level?'SMC-'+sm.level:'')+(sm.level&&sm.k?' + ':'')+(sm.k?sm.k+'K':'')+' selected'):'None selected';$('smcSum').textContent=sumTxt;$('smcSum').classList.toggle('on',!!(sm.level||sm.k));
  var warnS=(sm.level==='S'&&r.rounded<100)?'<p class="muted">Note: SMC-S requires a single disability rated 100% (or TDIU based on one disability). Your combined rating here is '+r.rounded+'%.</p>':'';
  $('payOut').innerHTML='<div class="lbl">Estimated monthly payment</div><div class="big">'+money(p.total)+'</div><div class="small">'+(sm.level?'SMC-'+esc(sm.level)+' rate (replaces the '+r.rounded+'% rate)':'at '+r.rounded+'%')+(sm.k?' + SMC-K ×'+sm.k:'')+' · VA '+esc(RATES.year)+'</div>'+warnS+'<details><summary>How we got this</summary><ul>'+p.lines.map(function(l){return '<li>'+esc(l)+'</li>'}).join('')+'</ul></details>';
}
$('cList').addEventListener('click',function(e){var i=e.target.dataset.del;if(i!=null){S.calc.entries.splice(+i,1);renderCalc();save()}});
$('mar').addEventListener('click',function(e){var b=e.target.closest('[data-mar]');if(!b)return;var v=+b.dataset.mar,d=S.calc.deps;d.spouse=v>0?1:0;d.aa=v===2?1:0;renderCalc();save()});
document.querySelector('.steps2').addEventListener('click',function(e){var b=e.target.closest('[data-st]');if(!b)return;var k=b.dataset.st,d=S.calc.deps;d[k]=Math.max(0,Math.min(k==='parents'?2:20,(d[k]||0)+(+b.dataset.d)));renderCalc();save()});
$('cReset').onclick=function(){if(!S.calc.entries.length&&!S.calc.smc.level&&!S.calc.smc.k&&!S.calc.deps.spouse&&!S.calc.deps.kids&&!S.calc.deps.school&&!S.calc.deps.parents)return;if(!confirm('Clear the calculator? This removes all ratings and dependents shown here so you can start fresh.'+(S.vaData?'\n\nYour imported VA.gov data is kept. Use "Reload my VA ratings" to load it again.':'')))return;S.calc={entries:[],deps:{spouse:0,aa:0,parents:0,kids:0,school:0},smc:{level:'',k:0},vaOff:!!S.vaData,vaSeen:{}};EXT=null;showExt();renderCalc();saveNow()};

/* ---------- Total Rating ring + VA preload ---------- */
function renderRing(box,pct,exact,label,small){if(!box)return;pct=Math.max(0,Math.min(100,+pct||0));var R=52,C=2*Math.PI*R,off=C*(1-pct/100);
  var aria=label+': '+pct+' percent'+(exact?' (exact combined value '+exact+' percent)':'');
  if(!box.querySelector('svg')){box.innerHTML='<div class="ring'+(small?' sm':'')+'" role="img"><svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle cx="60" cy="60" r="'+R+'" class="rtrack"/><circle cx="60" cy="60" r="'+R+'" class="rarc" transform="rotate(-90 60 60)" stroke-dasharray="'+C.toFixed(2)+'" stroke-dashoffset="'+C.toFixed(2)+'"/></svg><div class="rmid"><div class="rpct"></div><div class="rlbl"></div></div></div><div class="rexact"></div>'}
  var ring=box.querySelector('.ring');ring.setAttribute('aria-label',aria);box.querySelector('.rpct').textContent=pct+'%';box.querySelector('.rlbl').textContent=label;
  box.querySelector('.rexact').innerHTML=exact?'Exact combined value: <b>'+esc(exact)+'%</b>':'';
  var arc=box.querySelector('.rarc');requestAnimationFrame(function(){arc.style.strokeDashoffset=off.toFixed(2)});box.dataset.pct=pct}
var ARM_RE=/\b(arm|shoulder|elbow|wrist|hand|finger|thumb|forearm|humerus|ulnar|radial|median|upper extremity|carpal)\b/i,LEG_RE=/\b(leg|hip|knee|ankle|foot|feet|toe|thigh|femur|tibia|fibula|sciatic|lower extremity|plantar|achilles|hallux|pes planus|flatfoot)\b/i;
function vaPart(c){var n=c.name||'',dc=+c.dc||0,side=/\bleft\b|\blt\b/i.test(n)?'L':/\bright\b|\brt\b/i.test(n)?'R':'';
  var part=ARM_RE.test(n)?'arm':LEG_RE.test(n)?'leg':(dc>=5200&&dc<=5230)||(dc>=5300&&dc<=5309)?'arm':(dc>=5250&&dc<=5284)||(dc>=5310&&dc<=5312)?'leg':'';
  return part&&side?{part:part,side:side}:null}
function vaKey(c){return (c.dc||'')+'|'+(c.name||'').toLowerCase()}
function preloadCalc(force){var v=S.vaData;if(!v)return 0;migrateCalc();var cs=S.calc;if(cs.vaOff&&!force)return 0;cs.vaOff=false;
  var have={};cs.entries.forEach(function(e){if(e.va)have[e.va]=1});cs.vaSeen=cs.vaSeen||{};if(!force)Object.keys(cs.vaSeen).forEach(function(k){have[k]=1});var n=0;
  (v.conditions||[]).forEach(function(c){if(c.percent===null||c.percent===undefined||+c.percent<=0)return;var k=vaKey(c);if(have[k])return;
    var pt=vaPart(c),e={name:c.name||(BYDC[c.dc]?BYDC[c.dc].n:''),pct:Math.min(100,Math.round(+c.percent/10)*10)||10,side:pt?pt.side:'',limb:!!pt,part:pt?pt.part:'',va:k};cs.entries.push(e);have[k]=1;cs.vaSeen[k]=1;n++});
  var d=cs.deps,p=ensureProfile();if(n&&!d.spouse&&!d.kids&&!d.school&&!d.parents){if(p.f.marital==='Married')d.spouse=1;
    (p.l.children||[]).forEach(function(ch){if(ch.status==='Under 18'||ch.status==='Stepchild'||ch.status==='Adopted')d.kids++;else if(ch.status==='18–23 and in school')d.school++})}
  if(n)cs.vaLoaded=v.pulledAt||'';return n}
function renderCalcVA(){var b=$('calcVA');if(!b)return;var v=S.vaData;if(!v){b.innerHTML='';return}
  var when=v.pulledAt?new Date(v.pulledAt).toLocaleDateString():'';var loaded=S.calc.entries.some(function(e){return e.va});
  b.innerHTML='<div class="vanote">'+(loaded?'Loaded from your VA.gov data (pulled '+esc(when)+'). Check arm/leg sides for the bilateral factor; change anything that looks off.':'You have imported VA.gov ratings (pulled '+esc(when)+').')+' <button type="button" class="b alt sm" id="calcVAReload">Reload my VA ratings</button></div>'}
document.addEventListener('click',function(e){if(e.target.id==='calcVAReload'){var n=preloadCalc(true);renderCalc();saveNow();$('calcVA').insertAdjacentHTML('beforeend','<p class="muted" id="calcVAMsg">'+(n?n+' VA rating'+(n>1?'s':'')+' added.':'Your VA ratings are already in the calculator.')+'</p>')}});
function renderVARings(){[['ringProfile','profile'],['ringClaims','claims']].forEach(function(x){var b=$(x[0]);if(!b)return;var v=S.vaData;if(!v||v.combined===null||v.combined===undefined){b.innerHTML='';b.style.display='none';return}
  b.style.display='';renderRing(b,v.combined,null,'VA rating',true);var m=b.querySelector('.rexact');m.textContent='From VA.gov, '+(v.pulledAt?new Date(v.pulledAt).toLocaleDateString():'')})}
/* SMC UI */
var SMC_INFO=[['','None','No SMC level other than K.'],
['S','SMC-S (housebound)','You have one service-connected disability rated 100%, and either other service-connected disabilities rated 60% or more, or you are permanently housebound (substantially confined to your home) because of service-connected disability.'],
['L','SMC-L','Loss or loss of use of both feet, or of one hand and one foot; blindness in both eyes (5/200 or less); permanently bedridden; or needing regular aid and attendance.'],
['L½','SMC-L½ (intermediate)','Between L and M. For example: one foot plus the other knee lost (or loss of use), or an L-level condition plus another permanent disability rated 50% or more.'],
['M','SMC-M','Loss or loss of use of both hands; both legs at or above the knee (no natural knee action with prostheses); one arm and one leg (no natural elbow and knee action); blindness in both eyes with only light perception; or blindness in both eyes and needing aid and attendance.'],
['M½','SMC-M½ (intermediate)','Between M and N. For example: one knee plus one leg lost so close to the hip that a prosthesis can’t be worn, or one hand plus one elbow.'],
['N','SMC-N','Loss or loss of use of both arms (no natural elbow action with prostheses); both legs lost so close to the hip that prostheses can’t be used; one arm and one leg lost so high that prostheses can’t be used; or loss of both eyes / total blindness without light perception.'],
['N½','SMC-N½ (intermediate)','Between N and O. For example: an N-level condition plus another permanent disability rated 50% or more.'],
['O/P','SMC-O / P (maximum)','Two or more separate conditions that each qualify for L through N; both arms lost so close to the shoulder that prostheses can’t be used; paralysis of both legs with loss of bowel and bladder control; or certain combinations of blindness and deafness.'],
['R.1','SMC-R.1 (aid and attendance)','You already qualify for the O/P rate (or N½ plus K) and need regular aid and attendance from another person for daily needs.'],
['R.2','SMC-R.2 (higher level of care)','Like R.1, but you need a higher level of care: daily personal health-care services at home by or under a licensed professional, and without it you would need a hospital or nursing home.'],
['T','SMC-T (TBI aid and attendance)','You need regular aid and attendance for residuals of traumatic brain injury, would otherwise need hospital or nursing-home care, and don’t qualify for R.2. Paid at the R.2 rate.']];
(function(){$('smcYear').textContent=RATES.smc.year+' (source: va.gov special monthly compensation rates)';
  $('smcLevels').innerHTML=SMC_INFO.map(function(x){return '<label class="smcopt"><input type="radio" name="smclvl" value="'+esc(x[0])+'"><span><b>'+esc(x[1])+'</b>'+(x[0]?' <small class="muted">'+(x[0]==='T'?esc(money(RATES.smc.noChild['R.2/T'][0])):esc(money(RATES.smc.noChild[x[0]==='R.2'?'R.2/T':x[0]][0])))+'/mo alone</small>':'')+'<br><small>'+esc(x[2])+'</small></span></label>'}).join('')})();
$('smcLevels').addEventListener('change',function(e){if(e.target.name==='smclvl'){S.calc.smc.level=e.target.value;renderCalc();save()}});
document.querySelector('[data-smck="1"]').parentNode.addEventListener('click',function(e){var b=e.target.closest('[data-smck]');if(!b)return;S.calc.smc.k=Math.max(0,Math.min(3,(S.calc.smc.k|0)+(+b.dataset.smck)));renderCalc();save()});
$('rateLabel').textContent='Payment rates: VA '+RATES.year+'. Source: '+RATES.source+'.';

/* ---------- profile ---------- */
var BRANCHES=['Army','Navy','Air Force','Marine Corps','Space Force','Coast Guard','NOAA Commissioned Corps','U.S. Public Health Service'];
var PSCHEMA=[
 {id:'personal',t:'Personal information',f:[['first','First name'],['middle','Middle name'],['last','Last name'],['suffix','Suffix','select',['','Jr.','Sr.','II','III','IV']],['otherNames','Other names used (e.g., maiden name)'],['dob','Date of birth','date'],['pob','Place of birth (city, state, country)'],['sex','Sex','select',['','Male','Female']],['ssn','Social Security number','secret'],['vaFile','VA file number (if different from SSN)'],['phone','Main phone','tel'],['phone2','Other phone','tel'],['email','Email','email'],['contactMethod','Best way to reach you','select',['','Phone','Text','Email','Mail']],['contactTime','Best time to reach you','select',['','Morning','Afternoon','Evening','Any time']]]},
 {id:'address',t:'Address',f:[['mStreet','Mailing street address'],['mApt','Apt/Unit'],['mCity','City'],['mState','State'],['mZip','ZIP code'],['mCountry','Country'],['sameAddr','My home (physical) address is the same as my mailing address','check'],['pStreet','Home street address','text',null,'phys'],['pApt','Apt/Unit','text',null,'phys'],['pCity','City','text',null,'phys'],['pState','State','text',null,'phys'],['pZip','ZIP code','text',null,'phys'],['homeless','Are you homeless or at risk of becoming homeless?','select',['','No','Yes, I am homeless','Yes, I am at risk of becoming homeless']],['homelessDetail','If yes, describe your living situation and a contact person','textarea']]},
 {id:'service',t:'Military service',f:[['branch','Branch','select',['']. concat(BRANCHES)],['component','Component','select',['','Active duty','Reserve','National Guard']],['serviceNum','Service number (if different from SSN)'],['rank','Rank / pay grade at separation'],['mos','Job: MOS / rating / AFSC'],['units','Units and duty stations','textarea'],['pow','Were you ever a prisoner of war (POW)?','select',['','No','Yes']],['powDates','If POW: dates and place'],['exposures','Exposures (check all that apply)','checks',['Burn pits / airborne hazards (PACT Act)','Agent Orange / herbicides','Gulf War illness / Southwest Asia','Radiation','Camp Lejeune contaminated water','Military sexual trauma (MST)','Other toxic exposure']],['exposureDetail','Exposure details (where, when)','textarea']],
  l:[{k:'periods',t:'Service periods',add:'+ Add another service period',f:[['branch','Branch','select',['']. concat(BRANCHES)],['component','Component','select',['','Active duty','Reserve','National Guard']],['entry','Entry date','date'],['sep','Separation date','date'],['discharge','Character of discharge','select',['','Honorable','General (under honorable conditions)','Other than honorable','Bad conduct','Dishonorable','Uncharacterized','Still serving']],['sepType','Separation type / reason','select',['','Completion of service (ETS)','Retirement','Medical separation','Medical retirement','Early release','Still serving','Other']]]},
     {k:'deployments',t:'Deployments / combat zones',add:'+ Add a deployment',f:[['place','Location / operation'],['from','From','date'],['to','To','date'],['combat','Combat zone?','select',['','Yes','No']]]}]},
 {id:'vastatus',t:'Current VA status',f:[['rating','Current VA combined rating','select',['','None / not rated','0%','10%','20%','30%','40%','50%','60%','70%','80%','90%','100%','100% (TDIU)']],['claims','Existing claims and claim numbers','textarea'],['retPay','Receiving military retired pay?','select',['','No','Yes']],['sepPay','Received separation, severance, or disability severance pay?','select',['','No','Yes']],['sepPayDetail','If yes: type, amount, date'],['vha','Enrolled in VA health care?','select',['','No','Yes','Applied / pending']],['vaFacility','VA medical center / clinic you use']]},
 {id:'dependents',t:'Dependents',f:[['marital','Marital status','select',['','Never married','Married','Separated','Divorced','Widowed']],['spFirst','Spouse first name'],['spLast','Spouse last name'],['spDob','Spouse date of birth','date'],['spSsn','Spouse SSN','secret'],['marDate','Date of marriage','date'],['marPlace','Place of marriage (city, state)'],['spVet','Is your spouse a Veteran?','select',['','No','Yes']],['parents','Dependent parents (names, how you support them)','textarea']],
  l:[{k:'children',t:'Children',add:'+ Add a child',f:[['name','Full name'],['dob','Date of birth','date'],['ssn','SSN','secret'],['status','Status','select',['','Under 18','18–23 and in school','Seriously disabled before 18 (helpless child)','Stepchild','Adopted']],['school','School name (if 18–23)']]}]},
 {id:'employment',t:'Employment',f:[['employer','Current employer'],['jobTitle','Job title'],['hours','Hours per week','number'],['employedSince','Working there since','date'],['missedWork','Work missed because of your conditions (days, reasons, accommodations)','textarea'],['lastWorked','If not working: date you last worked full time','date']]},
 {id:'providers',t:'Medical providers',f:[],l:[{k:'providers',t:'Doctors, clinics, and hospitals (VA and private)',add:'+ Add a provider',f:[['name','Name of doctor or facility'],['address','Address'],['phone','Phone','tel'],['from','Treatment from','date'],['to','Treatment to (leave blank if ongoing)','date'],['conditions','Conditions treated','textarea']]}]},
 {id:'rep',t:'Representative',f:[['repType','Do you have a representative?','select',['','No','Veterans Service Organization (VSO)','Attorney','Claims agent']],['repName','Representative name / organization'],['repPhone','Representative phone','tel'],['poa','Power of attorney filed (VA Form 21-22 or 21-22a)?','select',['','No','Yes','Not sure']],['poaCode','POA code (if known)']]}
];
var BANK_KEYS=['bankName','acctType','routing','acct']; // removed feature: purged from saved data on load
function ensureProfile(){var p=S.profile||(S.profile={});p.f=p.f||{};p.l=p.l||{};['periods','deployments','children','providers'].forEach(function(k){if(!Array.isArray(p.l[k]))p.l[k]=[]});if(!p.l.periods.length)p.l.periods.push({});BANK_KEYS.forEach(function(k){delete p.f[k]});p.ai=!!p.ai;p.aiSSN=!!p.aiSSN;return p}
function fieldHTML(f,val,attr,idp){var k=f[0],lab=f[1],ty=f[2]||'text',opts=f[3],id=idp+k,cls=f[4]?' class="'+f[4]+'"':'';
  if(ty==='check')return '<div class="pf full"'+cls+'><label class="chk"><input type="checkbox" '+attr+(val?' checked':'')+'> <span>'+esc(lab)+'</span></label></div>';
  if(ty==='checks'){var arr=Array.isArray(val)?val:[];return '<div class="pf full"><span class="plab">'+esc(lab)+'</span><div class="pchecks">'+opts.map(function(o){return '<label class="chk"><input type="checkbox" '+attr+' data-opt="'+esc(o)+'"'+(arr.indexOf(o)>=0?' checked':'')+'> <span>'+esc(o)+'</span></label>'}).join('')+'</div></div>'}
  var input;
  if(ty==='select')input='<select id="'+id+'" '+attr+'>'+opts.map(function(o){return '<option value="'+esc(o)+'"'+(o===(val||'')?' selected':'')+'>'+esc(o||'— choose —')+'</option>'}).join('')+'</select>';
  else if(ty==='textarea')input='<textarea id="'+id+'" '+attr+' rows="3">'+esc(val||'')+'</textarea>';
  else if(ty==='secret')input='<div class="secret"><input id="'+id+'" type="password" autocomplete="off" inputmode="numeric" '+attr+' value="'+esc(val||'')+'"><button type="button" class="b alt sm" data-show="'+id+'" aria-label="Show or hide '+esc(lab)+'">Show</button></div>';
  else input='<input id="'+id+'" type="'+ty+'" '+attr+' value="'+esc(val||'')+'"'+(ty==='tel'?' autocomplete="tel"':'')+'>';
  return '<div class="pf'+(ty==='textarea'?' full':'')+(f[4]?' '+f[4]:'')+'"><label for="'+id+'">'+esc(lab)+'</label>'+input+'</div>'}
function renderProfile(){var p=ensureProfile(),h='';
  PSCHEMA.forEach(function(sec){h+='<details class="card pcard" data-sec="'+sec.id+'"><summary><span>'+esc(sec.t)+'</span><span class="chev" aria-hidden="true">▾</span></summary><div class="pbody">'+(sec.note?'<p class="muted">'+esc(sec.note)+'</p>':'')+'<div class="pgrid">'+
    sec.f.map(function(f){return fieldHTML(f,p.f[f[0]],'data-pk="'+f[0]+'"','pf_')}).join('')+'</div>';
    (sec.l||[]).forEach(function(L){h+='<h3>'+esc(L.t)+'</h3>'+p.l[L.k].map(function(it,i){return '<div class="pitem"><div class="pgrid">'+L.f.map(function(f){return fieldHTML(f,it[f[0]],'data-lk="'+L.k+'" data-li="'+i+'" data-lf="'+f[0]+'"','pl_'+L.k+i+'_')}).join('')+'</div><button type="button" class="b alt sm" data-ldel="'+L.k+'" data-li="'+i+'">Remove</button></div>'}).join('')+'<button type="button" class="b alt sm" data-ladd="'+L.k+'">'+esc(L.add)+'</button>'});
    h+='</div></details>'});
  $('profForm').innerHTML=h;$('profAI').checked=p.ai;$('profSSN').checked=p.aiSSN;$('profSSN').disabled=!p.ai;syncPhys()}
function syncPhys(){var same=!!S.profile.f.sameAddr;document.querySelectorAll('#profForm .phys').forEach(function(el){el.style.display=same?'none':''})}
$('profForm').addEventListener('input',onProf);$('profForm').addEventListener('change',onProf);
function onProf(e){var t=e.target,p=S.profile,v=t.type==='checkbox'?t.checked:t.value;
  if(t.dataset.pk){var k=t.dataset.pk;if(t.dataset.opt){var arr=Array.isArray(p.f[k])?p.f[k]:[];var o=t.dataset.opt;arr=arr.filter(function(x){return x!==o});if(t.checked)arr.push(o);p.f[k]=arr}else p.f[k]=v;if(k==='sameAddr')syncPhys()}
  else if(t.dataset.lk){p.l[t.dataset.lk][+t.dataset.li][t.dataset.lf]=v}
  else return;save()}
$('profForm').addEventListener('click',function(e){var t=e.target,p=S.profile;
  if(t.dataset.show){var i=$(t.dataset.show);i.type=i.type==='password'?'text':'password';t.textContent=i.type==='password'?'Show':'Hide';return}
  if(t.dataset.ladd){p.l[t.dataset.ladd].push({});keepOpen(function(){renderProfile()});save();return}
  if(t.dataset.ldel){if(!confirm('Remove this entry?'))return;p.l[t.dataset.ldel].splice(+t.dataset.li,1);keepOpen(function(){renderProfile()});save()}});
function keepOpen(fn){var open=[].map.call(document.querySelectorAll('#profForm details[open]'),function(d){return d.dataset.sec});var y=window.scrollY;fn();open.forEach(function(s){var d=document.querySelector('#profForm details[data-sec="'+s+'"]');if(d)d.open=true});window.scrollTo(0,y)}
$('profAI').addEventListener('change',function(){S.profile.ai=this.checked;if(!this.checked){S.profile.aiSSN=false;$('profSSN').checked=false}$('profSSN').disabled=!this.checked;save()});
$('profSSN').addEventListener('change',function(){S.profile.aiSSN=this.checked&&S.profile.ai;save()});
// Text of the profile for the AI. SSNs only if aiSSN.
function profileForAI(){var p=ensureProfile();if(!p.ai)return '';var out=[];
  function fmt(v){return Array.isArray(v)?v.join(', '):String(v===true?'yes':v)}
  PSCHEMA.forEach(function(sec){
    var lines=[];sec.f.forEach(function(f){var k=f[0],v=p.f[k];if((k==='ssn'||k==='spSsn')&&!p.aiSSN)return;if(v===''||v==null||v===false||(Array.isArray(v)&&!v.length))return;lines.push(f[1]+': '+fmt(v))});
    (sec.l||[]).forEach(function(L){p.l[L.k].forEach(function(it,i){var parts=[];L.f.forEach(function(f){var v=it[f[0]];if(f[0]==='ssn'&&!p.aiSSN)return;if(v)parts.push(f[1]+': '+v)});if(parts.length)lines.push(L.t+' #'+(i+1)+': '+parts.join('; '))})});
    if(lines.length)out.push('['+sec.t+']\n'+lines.join('\n'))});
  return out.length?'\n\n=== Veteran profile (shared by the veteran for this chat; SSN '+(p.aiSSN?'included at the veteran\'s request':'withheld')+') ===\n'+out.join('\n\n'):''}

/* ---------- documents ---------- */
var CATS=[['decision','Decision Letters'],['codesheet','Rating Code Sheets'],['buddy','Buddy/Lay Statements (21-10210)'],['personal','Personal Statements (21-4138)'],['vamed','Medical Records (VA)'],['privmed','Private Medical Records'],['nexus','Nexus Letters / IMOs'],['dbq','DBQs'],['str','Service Treatment Records'],['dd214','DD-214 & Service Records'],['cfile','C-File'],['appeal','Hearing / Appeal Documents'],['other','Other']];
function catName(id){for(var i=0;i<CATS.length;i++)if(CATS[i][0]===id)return CATS[i][1];return 'Other'}
function catFolder(id){return catName(id).replace(/[\\/:*?"<>|]/g,'-')}
function ensureDocs(){if(!Array.isArray(S.docs))S.docs=[];if(!Array.isArray(S.mirrorTrash))S.mirrorTrash=[];S.docAI=!!S.docAI}
function uid(){return 'd'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function renderDocs(){ensureDocs();var open=[].map.call(document.querySelectorAll('#docList details[open]'),function(d){return d.dataset.cat});
  var claimOpts=function(sel){return '<option value="">— not linked —</option>'+S.order.map(function(id){var c=S.claims[id];return c?'<option value="'+id+'"'+(id===sel?' selected':'')+'>'+esc(c.dc+' '+c.name.slice(0,40))+'</option>':''}).join('')};
  $('docList').innerHTML=CATS.map(function(c){var L=S.docs.filter(function(d){return d.cat===c[0]});
    return '<details class="card tcard" data-cat="'+c[0]+'"><summary><span class="smct">'+esc(c[1])+'<span class="tsum">'+(L.length?L.length+' document'+(L.length>1?'s':''):'No documents yet')+'</span></span><span class="chev" aria-hidden="true">▾</span></summary><div class="pbody">'+
    '<div class="row" style="align-items:center"><label class="b" style="flex:0 0 auto;cursor:pointer;font-weight:700">📎 Add files<input type="file" multiple data-up="'+c[0]+'" accept="application/pdf,image/*,.pdf,.doc,.docx,.txt,.rtf,.odt,.heic,.heif" class="hidefile"></label><label class="b alt" style="flex:0 0 auto;cursor:pointer;font-weight:700">📷 Take photo<input type="file" accept="image/*" capture="environment" data-up="'+c[0]+'" class="hidefile"></label></div>'+
    '<div class="muted" data-upmsg="'+c[0]+'" aria-live="polite"></div>'+
    L.map(function(d){return '<div class="docitem" data-doc="'+d.id+'"><div class="docname">'+esc(d.name)+'</div><div class="muted">Added '+esc(new Date(d.added).toLocaleString())+' · '+fmtSize(d.orig)+' (stored '+fmtSize(d.stored)+(d.gz?', compressed':'')+')</div>'+
      '<div class="row"><div><label>Note</label><input type="text" data-dnote="'+d.id+'" value="'+esc(d.note||'')+'" placeholder="Optional note"></div><div><label>Linked claim</label><select data-dclaim="'+d.id+'">'+claimOpts(d.claim)+'</select></div></div>'+
      '<div><button class="b sm" data-dact="open" data-id="'+d.id+'">Open</button><button class="b alt sm" data-dact="dl" data-id="'+d.id+'">Download</button><button class="b alt sm" data-dact="ren" data-id="'+d.id+'">Rename</button><button class="b red sm" data-dact="del" data-id="'+d.id+'">Delete</button></div></div>'}).join('')+'</div></details>'}).join('');
  open.forEach(function(k){var d=document.querySelector('#docList details[data-cat="'+k+'"]');if(d)d.open=true});
  $('docAI').checked=S.docAI;var n=S.docs.length;$('docTotal').textContent=n?n+' document'+(n>1?'s':'')+' · '+fmtSize(S.docs.reduce(function(a,d){return a+d.orig},0))+' (stored '+fmtSize(S.docs.reduce(function(a,d){return a+d.stored},0))+')':'No documents yet.';
  if(!DB)$('docWarn').innerHTML='<div class="warn">Documents can\'t be stored in this browser ('+esc(DBERR)+'). Try Chrome, Edge, or Safari, or open the app from a website instead of a file.</div>'}
$('docList').addEventListener('change',async function(e){var t=e.target;
  if(t.dataset.up){var files=[].slice.call(t.files||[]);t.value='';if(!files.length)return;var msg=document.querySelector('[data-upmsg="'+t.dataset.up+'"]'),ok=0;
    for(var i=0;i<files.length;i++){var f=files[i];msg.textContent='Saving '+f.name+' ('+(i+1)+' of '+files.length+')…';
      try{var id=uid(),buf=await f.arrayBuffer(),r=await storeFile(id,buf,f.type);S.docs.push({id:id,cat:t.dataset.up,name:f.name||('photo-'+new Date().toISOString().slice(0,19).replace(/:/g,'')+'.jpg'),type:f.type,added:new Date().toISOString(),orig:buf.byteLength,stored:r.stored,gz:r.gz,hash:r.hash,note:'',claim:''});ok++}
      catch(err){msg.innerHTML='<span class="err">Could not save '+esc(f.name)+': '+esc(err.message)+'</span>';}}
    saveNow();renderDocs();var m2=document.querySelector('[data-upmsg="'+t.dataset.up+'"]');if(m2&&ok)m2.innerHTML='<span class="ok">✓ Saved '+ok+' file'+(ok>1?'s':'')+'. Integrity checked.</span>';return}
  if(t.dataset.dclaim){var d=docById(t.dataset.dclaim);if(d){d.claim=t.value;save()}}});
$('docList').addEventListener('input',function(e){var t=e.target;if(t.dataset.dnote){var d=docById(t.dataset.dnote);if(d){d.note=t.value;save()}}});
function docById(id){for(var i=0;i<S.docs.length;i++)if(S.docs[i].id===id)return S.docs[i];return null}
$('docList').addEventListener('click',async function(e){var b=e.target.closest('[data-dact]');if(!b)return;var d=docById(b.dataset.id);if(!d)return;var act=b.dataset.dact;
  try{if(act==='open'||act==='dl'){var r=await readFile(d.id),url=URL.createObjectURL(new Blob([r.buf],{type:r.type||d.type||'application/octet-stream'}));
      if(act==='open'){var w=window.open(url,'_blank');if(!w){var a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove()}}
      else{var a2=document.createElement('a');a2.href=url;a2.download=d.name;document.body.appendChild(a2);a2.click();a2.remove()}setTimeout(function(){URL.revokeObjectURL(url)},60000)}
    else if(act==='ren'){var nn=prompt('New name for this document:',d.name);if(nn&&nn.trim()&&nn.trim()!==d.name){var ext=(d.name.match(/\.[A-Za-z0-9]{1,5}$/)||[''])[0];nn=nn.trim();if(ext&&!/\.[A-Za-z0-9]{1,5}$/.test(nn))nn+=ext;d.name=nn;saveNow();renderDocs()}}
    else if(act==='del'){if(!confirm('Delete "'+d.name+'"? This removes it from this device'+(DIRSTATE==='ok'?' and your save folder':'')+'. It cannot be undone unless you have a backup.'))return;
      await idbDel('files',d.id).catch(function(){});if(d.mpath)S.mirrorTrash.push(d.mpath);S.docs=S.docs.filter(function(x){return x.id!==d.id});saveNow();renderDocs()}}
  catch(err){alert('Sorry: '+err.message)}});
$('docAI').addEventListener('change',function(){S.docAI=this.checked;save()});
function docsForAI(c){ensureDocs();if(!S.docAI)return '';var L=S.docs.filter(function(d){return d.claim===c.id});if(!L.length)return '';
  return '\n\n=== Documents the veteran has for this claim (names and notes only; the AI cannot see file contents) ===\n'+L.map(function(d){return '- ['+catName(d.cat)+'] '+d.name+' (added '+d.added.slice(0,10)+')'+(d.note?' — note: '+d.note:'')}).join('\n')}
/* reminder banner */
function renderRemind(){var el=$('remind');if(!el||!BOOTED)return;ensureDocs();var now=Date.now(),lb=S.lastBackup?Date.parse(S.lastBackup):0,has=S.docs.length||S.order.length;
  var newDocs=S.docs.some(function(d){return Date.parse(d.added)>lb}),old=!lb||now-lb>14*864e5,snooze=S.remindUntil&&Date.parse(S.remindUntil)>now;
  if(!has||snooze||(DIRSTATE==='ok')||(!old&&!newDocs)){el.innerHTML='';return}
  el.innerHTML='<div class="warn remind"><b>Time for a backup?</b> '+(newDocs?'You added documents since your last backup.':(lb?'It\'s been over 14 days since your last backup.':'You haven\'t made a backup yet.'))+' A backup keeps your work safe if this browser loses its data. <button class="b sm" data-go="tool-backup">Back up now</button><button class="b alt sm" id="remindLater">Remind me later</button></div>'}
document.addEventListener('click',function(e){if(e.target.id==='remindLater'){S.remindUntil=new Date(Date.now()+3*864e5).toISOString();save();renderRemind()}});
/* ---------- desktop save folder (File System Access API) ---------- */
var DIR=null,DIRSTATE='none',FS_OK=typeof window.showDirectoryPicker==='function',mirT=null,mirBusy=false;
function safeName(n){return String(n||'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/^\.+/,'_').slice(0,180)||'file'}
async function dirBoot(){renderDir();if(!FS_OK||!DB)return;var h=null;try{h=window.__vatozTestDir||await idbGet('kv','dir')}catch(e){}
  if(!h){if(!S.dirAsked&&window.matchMedia&&matchMedia('(pointer:fine)').matches)$('dirFirst').style.display='';return}
  DIR=h;var p='prompt';try{p=await h.queryPermission({mode:'readwrite'})}catch(e){}
  DIRSTATE=p==='granted'?'ok':'needs';renderDir();if(DIRSTATE==='ok')mirrorAll(true)}
function renderDir(){var st=$('dirStatus'),bn=$('dirBanner');if(!st)return;var h='';
  if(!FS_OK)h='<p class="muted">Your browser can\'t save to a folder on this device (this works in Chrome or Edge on a Windows or Mac computer). Use <b>Download Backup</b> above instead, and save the file somewhere safe.</p>';
  else if(DIRSTATE==='ok')h='<p class="ok">✓ Saving to folder: <b>'+esc(DIR&&DIR.name||S.dirName||'')+'</b>'+(S.dirLast?' · last saved '+esc(new Date(S.dirLast).toLocaleTimeString()):'')+'</p>';
  else if(DIRSTATE==='needs')h='<p class="err">Save folder "'+esc(DIR&&DIR.name||S.dirName||'')+'" needs your OK again.</p><button class="b" id="dirReconnect2">Reconnect save folder</button>';
  else if(DIRSTATE==='error')h='<p class="err">Could not use the save folder: '+esc(S.dirErr||'')+'</p>';
  else h='<p class="muted">Not set up yet.</p>';
  st.innerHTML=h;$('dirChoose').style.display=FS_OK?'':'none';$('dirChoose').textContent=DIRSTATE==='ok'||DIRSTATE==='needs'?'Change save folder':'Choose save folder';
  $('dirRestore').style.display=FS_OK?'':'none';$('dirForget').style.display=DIR?'':'none';
  bn.innerHTML=DIRSTATE==='needs'?'<div class="dirbar">Your save folder is disconnected. <button class="b sm" id="dirReconnect">Reconnect save folder</button></div>':'';
  if(typeof toolSums==='function')setTimeout(toolSums,0)}
function dirHint(msg){var h='<div class="warn" id="dirHintBox" role="alert"><b>'+msg+'</b><br>Try again: in the folder window open <b>Documents</b>, make (or find) a folder named <b>VAtoZ</b>, <b>double-click VAtoZ to go inside it</b>, then click <b>Select Folder</b>. Picking Documents itself, Desktop, Downloads, or a drive like C:\\ is blocked by the browser.</div>';
  ['dirHint','dirFirstHint'].forEach(function(id){if($(id))$(id).innerHTML=h})}
async function pickDir(){var o={id:'vatoz',mode:'readwrite'};try{return await window.showDirectoryPicker(Object.assign({startIn:'documents'},o))}catch(e){if(e&&e.name==='TypeError')return await window.showDirectoryPicker(o);throw e}}
async function chooseFolder(){['dirHint','dirFirstHint'].forEach(function(id){if($(id))$(id).innerHTML=''});
  var h;try{h=await pickDir()}catch(e){if(e&&e.name==='AbortError')dirHint('No folder was picked.');else dirHint('That folder can\'t be used ('+esc(e&&e.message||e&&e.name||'error')+').');return}
  try{DIR=h;DIRSTATE='ok';S.dirName=h.name;S.dirAsked=true;$('dirFirst').style.display='none';
    try{await idbPut('kv','dir',h)}catch(e){} // keep in memory if this browser can't store handles
    S.docs.forEach(function(d){d.mpath=''});await mirrorAll(true);saveNow();renderDir()}
  catch(e){if(e&&e.name==='AbortError')return;DIRSTATE=DIR?DIRSTATE:'error';S.dirErr=(e&&e.name==='SecurityError'?'your browser blocked folder access for this page. ':'')+(e&&e.message||e);renderDir()}}
async function reconnect(){if(!DIR)return;try{var p=await DIR.requestPermission({mode:'readwrite'});if(p==='granted'){DIRSTATE='ok';renderDir();await mirrorAll(true);renderRemind()}}catch(e){S.dirErr=e.message;DIRSTATE='error';renderDir()}}
document.addEventListener('click',function(e){var id=e.target.id;if(id==='dirChoose'||id==='dirFirstGo')chooseFolder();else if(id==='dirReconnect'||id==='dirReconnect2')reconnect();else if(id==='dirFirstLater'){S.dirAsked=true;$('dirFirst').style.display='none';save()}
  else if(id==='dirForget'){if(confirm('Stop saving to this folder? Files already in the folder stay there.')){DIR=null;DIRSTATE='none';idbDel('kv','dir').catch(function(){});S.dirName='';renderDir();save()}}
  else if(id==='dirRestore')restoreFromFolder()});
function scheduleMirror(){if(DIRSTATE!=='ok')return;clearTimeout(mirT);mirT=setTimeout(function(){mirrorAll(false)},1200)}
async function getPath(root,parts,create){var d=root;for(var i=0;i<parts.length-1;i++)d=await d.getDirectoryHandle(parts[i],{create:create});return {dir:d,name:parts[parts.length-1]}}
async function writeTo(root,path,data){var p=await getPath(root,path.split('/'),true);var fh=await p.dir.getFileHandle(p.name,{create:true});var w=await fh.createWritable();await w.write(data);await w.close()}
async function removeAt(root,path){try{var p=await getPath(root,path.split('/'),false);await p.dir.removeEntry(p.name)}catch(e){}}
async function existsAt(root,path){try{var p=await getPath(root,path.split('/'),false);await p.dir.getFileHandle(p.name);return true}catch(e){return false}}
function mirrorJSON(){var copy=JSON.parse(JSON.stringify(S));delete copy.mirrorTrash;return JSON.stringify({app:'VA to Z',version:2,savedAt:new Date().toISOString(),readme:'VA to Z data (all app data; documents are in the Documents folder next to this file). You can restore it from Tools > Backup and Restore > Restore from save folder.',data:copy},null,2)}
async function mirrorAll(full){if(DIRSTATE!=='ok'||!DIR)return;if(mirBusy){scheduleMirror();return}mirBusy=true;
  try{ensureDocs();while(S.mirrorTrash.length){await removeAt(DIR,S.mirrorTrash.shift())}
    var used={};S.docs.forEach(function(d){if(d.mpath&&d.mpath.indexOf('Documents/'+catFolder(d.cat)+'/')===0)used[d.mpath.toLowerCase()]=d.id});
    for(var i=0;i<S.docs.length;i++){var d=S.docs[i],base=safeName(d.name),m=base.match(/^(.*?)(\.[^.]*)?$/),n=1,want='Documents/'+catFolder(d.cat)+'/'+base;
      while(used[want.toLowerCase()]&&used[want.toLowerCase()]!==d.id){n++;want='Documents/'+catFolder(d.cat)+'/'+m[1]+' ('+n+')'+(m[2]||'')}
      if(d.mpath!==want||(full&&!(await existsAt(DIR,want)))){var r=await readFile(d.id);await writeTo(DIR,want,r.buf);if(d.mpath&&d.mpath!==want){delete used[d.mpath.toLowerCase()];await removeAt(DIR,d.mpath)}d.mpath=want;used[want.toLowerCase()]=d.id}}
    await writeTo(DIR,'va-to-z-data.json',mirrorJSON());S.dirLast=new Date().toISOString();
    try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}if(DB)idbPut('kv','state',JSON.stringify(S)).catch(function(){})}
  catch(e){if(e&&(e.name==='NotAllowedError'||e.name==='SecurityError')){DIRSTATE='needs'}else{S.dirErr=e.message||String(e);DIRSTATE='error'}}
  mirBusy=false;renderDir()}
async function restoreFromFolder(){var msg=$('restoreMsg');try{var root=DIR;if(!root||DIRSTATE!=='ok'){root=await window.showDirectoryPicker({id:'vatoz',startIn:'documents',mode:'read'})}
    var fh=await root.getFileHandle('va-to-z-data.json');var o=JSON.parse(await (await fh.getFile()).text());var d=o.data;if(!d||!d.claims||!d.calc)throw new Error('va-to-z-data.json is not VA to Z data.');
    var docs=Array.isArray(d.docs)?d.docs:[];if(!confirm('Restore from the save folder ('+Object.keys(d.claims).length+' claims, '+docs.length+' documents)?\n\nThis REPLACES everything in the app on this device now.'))return;
    msg.textContent='Restoring…';var bad=[],files=[];
    for(var i=0;i<docs.length;i++){var x=docs[i];try{var p=await getPath(root,(x.mpath||'').split('/'),false);var f=await (await p.dir.getFileHandle(p.name)).getFile();var buf=await f.arrayBuffer();if(x.hash){var h=await sha(buf);if(h&&h!==x.hash)throw new Error('hash mismatch')}files.push([x,buf])}catch(e){bad.push(x.name)}}
    await idbClear('files').catch(function(){});for(var j=0;j<files.length;j++){var r=await storeFile(files[j][0].id,files[j][1],files[j][0].type);files[j][0].stored=r.stored;files[j][0].gz=r.gz}
    d.docs=docs.filter(function(x){return bad.indexOf(x.name)<0});S=Object.assign(blankState(),d);S.tab='tools';saveNow();init();
    $('restoreMsg').innerHTML='<div class="okbox">✓ Restored from save folder: '+Object.keys(S.claims).length+' claims, '+S.docs.length+' documents.'+(bad.length?' Could not restore: '+esc(bad.join(', ')):'')+'</div>'}
  catch(e){if(e&&e.name==='AbortError')return;msg.innerHTML='<span class="err">Restore from folder failed: '+esc(e.message||e)+'</span>'}}

/* ---------- Sync VA Data (from the VA to Z Sync extension) ---------- */
var SYNC=null;
function sStr(v,n){return (typeof v==='string'||typeof v==='number')?String(v).slice(0,n||300).trim():''}
function cleanVA(o){
  if(!o||typeof o!=='object'||o.source!=='va.gov'||!o.profile||typeof o.profile!=='object')throw new Error('This is not a VA to Z Sync data file.');
  var p=o.profile,ad=function(a){a=a&&typeof a==='object'?a:{};return {line1:sStr(a.line1),line2:sStr(a.line2),city:sStr(a.city,80),state:sStr(a.state,40),zip:sStr(a.zip,20),country:sStr(a.country,60)}};
  var r=o.ratings&&typeof o.ratings==='object'?o.ratings:{};
  var arr=function(x){return Array.isArray(x)?x.slice(0,200):[]};
  var comb=r.combined===null||r.combined===undefined||r.combined===''?null:+r.combined;if(!(comb>=0&&comb<=100))comb=null;
  return {pulledAt:sStr(o.pulledAt,40),
    profile:{first:tc(sStr(p.first,60)),middle:tc(sStr(p.middle,60)),last:tc(sStr(p.last,60)),suffix:sStr(p.suffix,10),dob:sStr(p.dob,10),gender:sStr(p.gender,10),email:sStr(p.email,120),phone:sStr(p.phone,40),mail:ad(p.mailingAddress),home:ad(p.homeAddress)},
    combined:comb,
    conditions:arr(r.conditions).map(function(c){c=c||{};var pc=c.percent===null||c.percent===undefined||c.percent===''?null:+c.percent;return {name:sStr(c.name,200),dc:sStr(c.dc,10).replace(/\D/g,''),percent:pc>=0&&pc<=100?pc:null,effective:sStr(c.effective,10),decision:sStr(c.decision,60)}}).filter(function(c){return c.name||c.dc}),
    claims:arr(o.claims).map(function(c){c=c||{};return {id:sStr(c.id,40),type:sStr(c.type,120),date:sStr(c.date,10),status:sStr(c.status,60),closed:sStr(c.closed,10)}}),
    service:arr(o.service).map(function(s){s=s||{};return {branch:sStr(s.branch,60),component:sStr(s.component,20),begin:sStr(s.begin,10),end:sStr(s.end,10),discharge:sStr(s.discharge,60)}})}}
function tc(s){return s&&s===s.toUpperCase()?s.toLowerCase().replace(/(^|[\s'-])([a-z])/g,function(m,a,b){return a+b.toUpperCase()}):s}
function isoDate(s){return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):''}
function mapBranch(b){b=(b||'').toLowerCase();for(var i=0;i<BRANCHES.length;i++)if(BRANCHES[i].toLowerCase()===b||b.indexOf(BRANCHES[i].toLowerCase())>=0)return BRANCHES[i];return ''}
function mapComp(c){c=(c||'').toUpperCase();return c==='A'||/ACTIVE/.test(c)?'Active duty':c==='V'||c==='R'||/RESERVE/.test(c)?'Reserve':c==='N'||/GUARD/.test(c)?'National Guard':''}
function mapDis(d){var t=(d||'').toLowerCase();if(/dishonorable/.test(t))return 'Dishonorable';if(/other than/.test(t))return 'Other than honorable';if(/general|under honorable/.test(t))return 'General (under honorable conditions)';if(/bad conduct/.test(t))return 'Bad conduct';if(/uncharacterized/.test(t))return 'Uncharacterized';if(/^honorable$/.test(t))return 'Honorable';return ''}
function syncItems(v){var p=ensureProfile(),f=p.f,it=[],P=v.profile;
  function add(k,label,val){if(!val)return;var cur=f[k]||'';if(cur===val)return;it.push({g:'Profile',kind:'f',k:k,label:label,val:val,cur:cur,on:!cur})}
  add('first','First name',P.first);add('middle','Middle name',P.middle);add('last','Last name',P.last);
  if(['Jr.','Sr.','II','III','IV','V'].indexOf(P.suffix)>=0)add('suffix','Suffix',P.suffix);
  add('dob','Date of birth',isoDate(P.dob));add('sex','Sex',{M:'Male',F:'Female',MALE:'Male',FEMALE:'Female'}[(P.gender||'').toUpperCase()]||'');
  add('email','Email',P.email);add('phone','Main phone',P.phone);
  var m=P.mail;add('mStreet','Mailing street address',m.line1);add('mApt','Mailing Apt/Unit',m.line2);add('mCity','Mailing city',m.city);add('mState','Mailing state',m.state);add('mZip','Mailing ZIP code',m.zip);
  if(m.country&&!/^(USA|United States)/i.test(m.country))add('mCountry','Mailing country',m.country);
  var h=P.home;add('pStreet','Home street address',h.line1);add('pApt','Home Apt/Unit',h.line2);add('pCity','Home city',h.city);add('pState','Home state',h.state);add('pZip','Home ZIP code',h.zip);
  if(v.combined!==null)add('rating','Current VA combined rating',v.combined+'%');
  v.service.forEach(function(s,i){var row={branch:mapBranch(s.branch),component:mapComp(s.component),entry:isoDate(s.begin),sep:isoDate(s.end),discharge:mapDis(s.discharge)};
    var dup=p.l.periods.some(function(x){return x.entry&&x.entry===row.entry&&(!row.branch||x.branch===row.branch)});if(dup)return;
    it.push({g:'Service history',kind:'per',row:row,label:[s.branch||'Service',row.entry&&('from '+row.entry),row.sep&&('to '+row.sep),s.discharge&&('discharge: '+s.discharge)].filter(Boolean).join(' '),on:true})});
  var have={};S.order.forEach(function(id){var c=S.claims[id];if(c){if(c.dc)have['dc'+c.dc]=1;if(c.vaId)have['va'+c.vaId]=1}});
  v.conditions.forEach(function(c){if(c.dc&&have['dc'+c.dc])return;var known=c.dc&&BYDC[c.dc];
    it.push({g:'Rated conditions → My Claims',kind:'cond',c:c,label:(c.name||(known?known.n:'Condition'))+(c.dc?' (DC '+c.dc+')':'')+(c.percent!==null?' — '+c.percent+'%':'')+(c.effective?' since '+isoDate(c.effective):''),on:true})});
  var rated=v.conditions.filter(function(c){return c.percent!==null});
  if(rated.length)it.push({g:'Calculator',kind:'calc',label:'Load these '+rated.length+' VA rating'+(rated.length>1?'s':'')+' into the Calculator (no duplicates; your own entries stay)',on:true});
  v.claims.forEach(function(c){if(c.id&&have['va'+c.id])return;it.push({g:'VA claims → My Claims',kind:'claim',c:c,label:(c.type||'VA claim')+(c.date?' filed '+isoDate(c.date):'')+(c.status?' — '+c.status:''),on:true})});
  return it}
function fmtWhen(s){var d=new Date(s);return isNaN(d)?'':d.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}
function renderSyncLast(){var e=$('syncLast');if(!e)return;e.textContent=S.vaSyncedAt?'Last synced: '+fmtWhen(S.vaSyncedAt)+(S.vaData&&S.vaData.pulledAt?' (VA.gov data pulled '+fmtWhen(S.vaData.pulledAt)+')':''):'Never synced';
  if($('sum-sync'))$('sum-sync').textContent=S.vaSyncedAt?'Last synced: '+fmtWhen(S.vaSyncedAt):'Never synced · copy your info from VA.gov'}
function renderSync(){renderSyncLast();var R=$('syncReview');if(!SYNC){R.innerHTML='';return}
  var it=SYNC.items,h='<div class="sub" style="border:2px solid #162e51;border-radius:10px;padding:12px"><h3 style="margin-top:0">Review your VA.gov info</h3><p class="muted">Pulled '+esc(SYNC.v.pulledAt?new Date(SYNC.v.pulledAt).toLocaleString():'')+'. Checked items will be added. Items that would <b>replace</b> something you already typed are unchecked; check them only if VA.gov is right.</p>';
  if(!it.length)h+='<p><b>Nothing new.</b> Everything from VA.gov already matches what\'s in the app.</p>';
  var g='';it.forEach(function(x,i){if(x.g!==g){g=x.g;h+='<h4 style="margin:12px 0 4px">'+esc(g)+'</h4>'}
    h+='<label class="chk"><input type="checkbox" data-sy="'+i+'"'+(x.on?' checked':'')+'> <span><b>'+esc(x.label)+'</b>'+(x.kind==='f'?': '+esc(x.val)+(x.cur?' <span class="err">(replaces "'+esc(x.cur)+'")</span>':''):'')+'</span></label>'});
  h+='<button class="b" id="syncApply"'+(it.length?'':' disabled')+'>Apply checked items</button><button class="b alt" id="syncCancel">Cancel</button></div>';R.innerHTML=h}
function startSync(raw,how){var v=cleanVA(raw);SYNC={v:v,items:syncItems(v)};var d=$('tool-sync');if(d)d.open=true;tab('tools');renderSync();
  $('syncMsg').innerHTML='<div class="okbox">✓ VA.gov info received'+(how?' '+how:'')+'. Review it below.</div>';setTimeout(function(){try{$('syncReview').scrollIntoView({behavior:'smooth',block:'start'})}catch(e){}},50)}
function applySync(){var p=ensureProfile(),n=0,nc=0,wantCalc=false;S.vaData=SYNC.v;S.vaSyncedAt=new Date().toISOString();document.querySelectorAll('[data-sy]').forEach(function(b){SYNC.items[+b.dataset.sy].on=b.checked});
  SYNC.items.forEach(function(x){if(!x.on)return;
    if(x.kind==='f'){p.f[x.k]=x.val;n++}
    else if(x.kind==='per'){var empty=p.l.periods.filter(function(r){return !Object.keys(r).some(function(k){return r[k]})})[0];if(empty)Object.assign(empty,x.row);else p.l.periods.push(Object.assign({},x.row));n++}
    else if(x.kind==='calc'){wantCalc=true}
    else if(x.kind==='cond'||x.kind==='claim'){var c=x.c,id='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),e=x.kind==='cond'&&c.dc?BYDC[c.dc]:null;
      S.claims[id]=x.kind==='cond'?{id:id,dc:c.dc||'',name:c.name||(e?e.n:'Rated condition'),status:'Granted',created:new Date().toISOString(),checklist:e?checklistFor(e):[],notes:'From VA.gov: rated '+(c.percent!==null?c.percent+'%':'(percent not shown)')+(c.effective?', effective '+isoDate(c.effective):'')+(c.decision?' ('+c.decision+')':'')+'.',evidence:'',chat:[],prevDenied:false,fromVA:true}
        :{id:id,dc:'',name:(c.type||'VA claim')+(c.date?' ('+isoDate(c.date)+')':''),status:/^(complete|closed|canceled|cancelled)/i.test(c.status)||c.closed?'Decision received':'Filed',created:new Date().toISOString(),checklist:[],notes:'From VA.gov: claim '+(c.id?'#'+c.id+' ':'')+(c.date?'filed '+isoDate(c.date)+', ':'')+'status '+(c.status||'unknown')+(c.closed?', closed '+isoDate(c.closed):'')+'.',evidence:'',chat:[],prevDenied:false,vaId:c.id,fromVA:true};
      S.order.push(id);nc++}});
  var nCalc=0;if(wantCalc)nCalc=preloadCalc(true);n+=nCalc;
  SYNC=null;saveNow();renderProfile();renderCalc();renderVARings();renderClaims();renderSync();toolSums();
  $('syncMsg').innerHTML='<div class="okbox">✓ Applied: '+n+' profile/calculator item'+(n===1?'':'s')+' and '+nc+' claim'+(nc===1?'':'s')+' added.<br><b>Next:</b> make a backup (Tools → Backup and Restore) to save it and to move it to your phone.</div>'}
document.addEventListener('click',function(e){var t=e.target;if(t.id==='syncApply')applySync();else if(t.id==='syncCancel'){SYNC=null;renderSync();$('syncMsg').innerHTML=''}else if(t.id==='syncAsk')window.postMessage({type:'VATOZ_REQUEST'},'*')});
if($('extPull'))$('extPull').onclick=function(){if(!IS_EXT||!window.chrome||!chrome.runtime||!chrome.runtime.sendMessage)return;var b=this;b.disabled=true;$('syncMsg').innerHTML='<p class="muted">Reading from VA.gov… (a VA.gov tab may open briefly)</p>';
  chrome.runtime.sendMessage({type:'VATOZ_PULL'}).then(function(r){if(!r||!r.ok){$('syncMsg').innerHTML='<span class="err">'+esc(r&&r.error==='not-logged-in'?'You don\'t seem to be signed in to VA.gov. Sign in at VA.gov in this browser, then press Pull again.':'Could not read your VA.gov info'+(r&&r.error?' ('+r.error+')':'')+'. Make sure you are signed in to VA.gov, then try again.')+'</span>';return}
    startSync(r.data,'from VA.gov')}).catch(function(e){$('syncMsg').innerHTML='<span class="err">Pull failed: '+esc(e.message)+'</span>'}).finally(function(){b.disabled=false})};
$('syncImp').onchange=function(){var f=this.files[0];if(!f)return;this.value='';f.text().then(function(t){startSync(JSON.parse(t),'from file')}).catch(function(e){$('syncMsg').innerHTML='<span class="err">Import failed: '+esc(e.message)+'</span>'})};
window.addEventListener('message',function(e){if(e.source!==window||!e.data||e.data.source!=='vatoz-sync-ext')return;
  if(e.data.type==='VATOZ_EXT_READY'){$('syncExt').innerHTML='✓ VA to Z Sync extension detected. <button class="b alt sm" id="syncAsk">Get my last pull</button>'}
  else if(e.data.type==='VATOZ_VA_DATA'){try{startSync(e.data.data,'from the extension')}catch(x){$('syncMsg').innerHTML='<span class="err">'+esc(x.message)+'</span>'}}});

/* ---------- extension popup → window handoff ---------- */
var HANDOFF={imp:['tools','tool-backup','Restore from Backup'],imp2:['setup','','Restore from Backup'],syncImp:['tools','tool-sync','Import VA data file'],
  dirChoose:['tools','tool-backup','Choose save folder'],dirFirstGo:['tools','tool-backup','Choose save folder'],dirRestore:['tools','tool-backup','Restore from save folder'],
  dirReconnect:['tools','tool-backup','Reconnect save folder'],dirReconnect2:['tools','tool-backup','Reconnect save folder'],exp:['tools','tool-backup','Download Backup']};
function openWindow(intent){saveNow();var go=function(){try{chrome.runtime.sendMessage({type:'VATOZ_OPEN_WINDOW',intent:intent||null}).then(function(){window.close()},function(){window.close()})}catch(e){}};
  if(DB)idbPut('kv','state',JSON.stringify(S)).then(go,go);else go()}
if(IS_POPUP){$('openWin').onclick=function(){openWindow(null)};
  document.addEventListener('click',function(e){var el=e.target.closest('input[type=file],label,button');if(!el)return;
    var inp=el.matches('input[type=file]')?el:el.querySelector&&el.querySelector('input[type=file]');var id=(inp||el).id,h=HANDOFF[id];
    if(!h&&inp&&inp.dataset.up)h=['docs','','Add files / Take photo in "'+catName(inp.dataset.up)+'"'];
    if(!h)return;e.preventDefault();e.stopImmediatePropagation();openWindow({tab:h[0],open:h[1],hl:id,label:h[2]})},true)}
function applyIntent(){var m=/[#&]intent=([^&]+)/.exec(location.hash);if(!m)return;var it;try{it=JSON.parse(decodeURIComponent(m[1]))}catch(e){return}history.replaceState(null,'',location.pathname+location.search);
  tab(it.tab||'tools');if(it.open&&$(it.open))$(it.open).open=true;var el=it.hl&&$(it.hl);var tgt=el?(el.closest('label')||el):null;if(el&&el.dataset.up)tgt=el.closest('details');if(tgt&&tgt.tagName==='DETAILS')tgt.open=true;
  var old=$('handoffMsg');if(old)old.remove();document.querySelectorAll('.hl-flash').forEach(function(x){x.classList.remove('hl-flash')});
  var main=document.querySelector('main');main.insertAdjacentHTML('afterbegin','<div class="handoff" id="handoffMsg">Continue here: click <u>'+esc(it.label||'the highlighted button')+'</u>. (File and folder windows only work in the full window.)</div>');
  if(tgt){tgt.classList.add('hl-flash');setTimeout(function(){tgt.scrollIntoView({block:'center'})},60)}}
window.addEventListener('hashchange',function(){try{applyIntent()}catch(e){}});
// keep popup and window in step: if the other one saved newer data, load it
window.addEventListener('storage',function(e){if(e.key!==KEY||!e.newValue)return;try{var d=JSON.parse(e.newValue);if(d._savedAt&&(!S._savedAt||d._savedAt>S._savedAt)){var tb=S.tab;S=Object.assign(blankState(),d);S.tab=tb;init()}}catch(x){}});

/* ---------- lookup ---------- */
var COMMON=[['6260','Tinnitus'],['6100','Hearing loss'],['9411','PTSD'],['9434','Depression'],['9400','Anxiety'],['8100','Migraines'],['5237','Back/neck strain'],['5242','Spine arthritis/DDD'],['5243','Disc (IVDS)'],['5260','Knee flexion'],['5261','Knee extension'],['5257','Knee instability'],['5201','Shoulder'],['8520','Sciatic (leg) nerve'],['8515','Median nerve (wrist)'],['6847','Sleep apnea'],['6522','Allergic rhinitis'],['6602','Asthma'],['7101','Hypertension'],['7346','Hiatal hernia/GERD'],['7319','IBS'],['7913','Diabetes'],['5276','Flat feet'],['5271','Ankle'],['5252','Hip flexion'],['7806','Dermatitis/eczema'],['7522','Erectile dysfunction'],['8045','TBI']];
var ABR=[['6260','Tinnitus (ringing in the ears)'],['5260','Knee: limited bending (flexion)'],['8520','Sciatic nerve (leg nerve, sciatica)'],['5237','Back or neck strain'],['9411','PTSD'],['6100','Hearing loss'],['5201','Shoulder/arm: limited motion'],['7802','Scars, burns (2nd degree)'],['8100','Migraine headaches'],['5271','Ankle: limited motion']];
$('common').innerHTML=ABR.filter(function(c){return BYDC[c[0]]}).map(function(c,i){return '<button class="cc" data-cc="'+c[0]+'"><span class="rk">#'+(i+1)+'</span><span>'+esc(c[1])+'<small>DC '+c[0]+(c[0]==='7802'?' (or 7801 if deep)':'')+'</small></span></button>'}).join('');
$('common').addEventListener('click',function(e){var b=e.target.closest('[data-cc]');if(!b)return;$('q').value=b.dataset.cc;doSearch();pick(b.dataset.cc);if(window.innerWidth<760)$('detail').scrollIntoView({behavior:'smooth',block:'start'})});
var hits=[],shown=0;
var SYN={ptsd:'posttraumatic',back:'spine lumbosacral',neck:'cervical',gerd:'reflux hiatal',ed:'erectile',tbi:'traumatic brain',ibs:'irritable',depression:'depressive',apnea:'sleep apnea',sciatica:'sciatic',carpal:'median nerve',flatfoot:'flatfoot',ringing:'tinnitus'};
function srch(e){return (e._s||(e._s=(e.c+' '+e.n+' '+e.h+' '+e.t+' '+e.x.join(' ')).toLowerCase()))}
function doSearch(){
  var q=$('q').value.trim().toLowerCase();
  if(!q){hits=ABR.map(function(c){return BYDC[c[0]]}).filter(Boolean);}
  else{var terms=q.split(/\s+/).map(function(t){return SYN[t]||t});
    hits=CFR.map(function(e){var s=srch(e),nm=(e.c+' '+e.n).toLowerCase(),sc=0;
      for(var i=0;i<terms.length;i++){var alt=terms[i].split(' '),m=false;for(var j=0;j<alt.length;j++){if(nm.indexOf(alt[j])>=0){sc+=10;m=true}else if(s.indexOf(alt[j])>=0){sc+=1;m=true}}if(!m)return null}
      if(e.c===q)sc+=100;return [sc,e]}).filter(Boolean).sort(function(a,b){return b[0]-a[0]}).map(function(x){return x[1]});}
  shown=0;$('results').innerHTML='';$('qCount').textContent=q?hits.length+' match(es) out of '+CFR.length+' diagnostic codes.':'Showing Common Claims. '+CFR.length+' diagnostic codes available—type to search all.';
  showMore();
}
function regHTML(e){
  var h='<div class="muted">'+esc(e.h)+(e.t?' — '+esc(e.t):'')+(e.k?' <span class="pill">Columns: '+esc(e.k)+'</span>':'')+'</div>';
  h+='<div><b>'+esc(e.c+' '+e.n)+'</b></div>';
  function ln(l){var m=l.match(/^(.*) — ([\d ]+)$/);return m?'<div><span class="pct">'+esc(m[2])+'%</span>'+esc(m[1])+'</div>':'<div>'+esc(l)+'</div>'}
  h+=e.x.map(ln).join('');
  if(e.f){h+='<div style="margin-top:8px"><b>Applies to this code: '+esc(e.f[0])+'</b></div>'+e.f[1].map(ln).join('')}
  if(!e.x.length&&!e.f)h+='<div class="muted">No separate criteria listed under this code. It is rated by analogy or under another code/formula in '+esc(e.h)+'. See the full section on eCFR.</div>';
  return h;
}
function regText(e){var t=e.h+(e.t?' — '+e.t:'')+(e.k?' (columns: '+e.k+')':'')+'\nDC '+e.c+' '+e.n+'\n'+e.x.join('\n');if(e.f)t+='\n\n'+e.f[0]+':\n'+e.f[1].join('\n');return t}
function systemOf(e){var s=e.s;return s==='4.71a'?'musculoskeletal':s==='4.73'?'muscle':s.indexOf('4.79')===0||s==='4.84a'?'eye':s==='4.85'||s==='4.87'?'ear':s==='4.88b'?'infectious':s==='4.97'?'respiratory':s==='4.104'?'cardio':s==='4.114'?'digestive':s==='4.115b'?'genitourinary':s==='4.116'?'gyn':s==='4.117'?'blood':s==='4.118'?'skin':s==='4.119'?'endocrine':s==='4.124a'?'neuro':s==='4.130'?'mental':s==='4.150'?'dental':'other'}
var HOW={musculoskeletal:'Ask your doctor or the VA exam to measure range of motion with a goniometer, including pain on motion, repeated use, and flare-ups. Describe in your statement what you can\'t do on bad days.',ear:'Get a hearing test (audiogram) by a licensed audiologist. VA uses the Maryland CNC speech test plus puretone results. Tie it to noise exposure from your job (MOS/rating) in service.',mental:'You need a mental health diagnosis. For PTSD, describe the stressor (what happened, where, when, unit). Show how symptoms affect work, family, and social life.',neuro:'For nerve conditions, EMG/nerve conduction studies help. For migraines, keep a headache log showing how often attacks make you stop and lie down (prostrating).',respiratory:'Get the right test: a sleep study for sleep apnea, or pulmonary function tests (PFTs) for lung conditions. Keep proof of CPAP or inhaler prescriptions.',cardio:'Gather blood pressure readings over time and any heart tests (echo, stress test, METs).',digestive:'Gather records of symptoms, treatments, and any scopes or imaging. A symptom diary helps.',skin:'Take dated photos during flare-ups and note how much of your body is affected and what treatments you use.',endocrine:'Gather lab results and medication records showing how the condition is controlled.',eye:'Get an eye exam showing visual acuity and visual fields.',genitourinary:'Gather urology records, test results, and treatment history.'};
function howHTML(e){var sys=systemOf(e);return '<h3>How to claim this (plain language)</h3><p>To win service connection, VA generally needs three things:</p><ol><li><b>A current diagnosis</b> from a doctor (VA or private).</li><li><b>Something in service</b>: an injury, event, exposure, or symptoms (service records, treatment records, or statements).</li><li><b>A link ("nexus")</b>: a medical opinion that it is "at least as likely as not" (50% or more) caused or made worse by service—or by another service-connected condition (secondary).</li></ol>'+(HOW[sys]?'<p><b>Tip for this condition:</b> '+esc(HOW[sys])+'</p>':'')+'<p><b>Forms:</b> New claim: VA Form 21-526EZ. Denied before? File a Supplemental Claim, VA Form 21-0995, with new and relevant evidence. Your own or a buddy\'s statement: VA Form 21-10210 (Lay/Witness Statement). Your doctor can fill out a Disability Benefits Questionnaire (DBQ) for this condition. Private records: VA Forms 21-4142 and 21-4142a.</p><p class="muted">Rating levels come from the official text above. The examiner\'s findings decide which level fits.</p>'}
var selDC=null;
function resHTML(e){return '<button class="res'+(e.c===selDC?' sel':'')+'" role="option" aria-selected="'+(e.c===selDC)+'" data-pick="'+esc(e.c)+'"><span class="dc">'+esc(e.c)+'</span><span>'+esc(e.n)+'</span></button>'}
function pick(dc){var e=BYDC[dc];if(!e)return;selDC=dc;document.querySelectorAll('.cc').forEach(function(b){b.classList.toggle('sel',b.dataset.cc===dc)});document.querySelectorAll('.res').forEach(function(b){var on=b.dataset.pick===dc;b.classList.toggle('sel',on);b.setAttribute('aria-selected',on)});
  $('detail').innerHTML='<h3 style="margin-top:14px"><span class="dc">'+esc(e.c)+'</span> '+esc(e.n)+'</h3><div class="reg">'+regHTML(e)+'</div><div class="howto">'+howHTML(e)+'<a class="muted" href="https://www.ecfr.gov/current/title-38/section-'+esc(e.s)+'" target="_blank" rel="noopener">Read § '+esc(e.s)+' on eCFR</a></div>';
  $('selInfo').innerHTML='Chosen: <b>'+esc(e.c+' '+e.n)+'</b>';$('fileBtn').disabled=false;$('fileBtn').textContent="Let's File It: "+e.c;}
$('fileBtn').onclick=function(){if(selDC)fileIt(selDC)};
function condHTML(e){return '<details class="cond"><summary><span class="dc">'+esc(e.c)+'</span><span>'+esc(e.n)+'</span></summary><div class="reg">'+regHTML(e)+'</div><div class="howto">'+howHTML(e)+'<button class="b" data-file="'+esc(e.c)+'">Let\'s File It</button> <a class="muted" href="https://www.ecfr.gov/current/title-38/section-'+esc(e.s)+'" target="_blank" rel="noopener">Read § '+esc(e.s)+' on eCFR</a></div></details>'}
function showMore(){var n=hits.slice(shown,shown+40);shown+=n.length;$('results').insertAdjacentHTML('beforeend',n.map(resHTML).join(''));$('more').style.display=shown<hits.length?'':'none'}
$('more').onclick=showMore;
var qT;$('q').addEventListener('input',function(){clearTimeout(qT);qT=setTimeout(doSearch,200)});
$('results').addEventListener('click',function(e){var b=e.target.closest('[data-pick]');if(b){pick(b.dataset.pick);if(window.innerWidth<760)$('detail').scrollIntoView({behavior:'smooth',block:'start'})}});

/* ---------- claims ---------- */
function checklistFor(e){
  var sys=systemOf(e),n=(e.n||'').toLowerCase(),L=[
  'Current diagnosis from a doctor (VA or private medical records)',
  'Service treatment records (STRs) showing the injury, event, or symptoms in service',
  'Service personnel records / DD-214 (job, deployments, duty history)',
  'Nexus opinion: doctor letter saying it is "at least as likely as not" related to service (or to a service-connected condition)',
  'Your personal statement (VA Form 21-10210 or 21-4138): when it started, what happened, how it affects you now',
  'Buddy/family statement(s) (VA Form 21-10210)',
  'Disability Benefits Questionnaire (DBQ) for this condition, filled out by your doctor (optional but helpful)',
  'Private records release if needed (VA Forms 21-4142 and 21-4142a)',
  'VA Form 21-526EZ (new claim), or 21-0995 Supplemental Claim if denied before'];
  var X={musculoskeletal:['Range-of-motion measurements (including pain, repeated use, flare-ups)','X-ray or MRI results','Notes on flare-ups: how often, how long, what you can\'t do'],
  ear:['Audiogram with Maryland CNC speech test and puretone thresholds','Proof of noise exposure (MOS/rating, weapons, aircraft, engines)'],
  mental:['Mental health treatment records (therapy, medications)','Notes on how symptoms affect work and relationships'],
  neuro:['Neurology records','EMG / nerve conduction study (for nerve conditions)'],
  respiratory:['Pulmonary function tests (PFT) or chest imaging'],cardio:['Blood pressure log or readings over time','Heart test results (EKG, echo, stress test/METs)'],
  digestive:['GI records, scope or imaging results','Symptom diary'],skin:['Dated photos of flare-ups','List of treatments (creams, pills, how often)'],
  endocrine:['Lab results (e.g., A1C)','Medication and diet/activity restriction records'],eye:['Eye exam: visual acuity and visual field results'],genitourinary:['Urology records and test results']}[sys]||[];
  L=L.concat(X);
  if(/ptsd|posttraumatic/.test(n)||e.c==='9411')L.push('Stressor details (VA Form 21-0781): what happened, date range, location, unit');
  if(/sleep apnea/.test(n))L.push('Sleep study (polysomnography) confirming the diagnosis','CPAP/breathing device prescription');
  if(/migraine/.test(n))L.push('Headache log: dates, how long, whether you had to stop and lie down');
  if(/tinnitus/.test(n))L.push('Statement describing when the ringing started and noise exposure');
  if(e.s==='4.88b'||/agent orange|herbicide|burn pit/.test(n))L.push('Exposure info (deployment locations/dates); check PACT Act presumptives on va.gov');
  return L.map(function(t){return {t:t,d:false}});
}
function fileIt(dc){
  var e=BYDC[dc];if(!e)return;
  var id='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  S.claims[id]={id:id,dc:dc,name:e.n,status:'Gathering evidence',created:new Date().toISOString(),checklist:checklistFor(e),notes:'',evidence:'',chat:[],prevDenied:false};
  S.order.unshift(id);S.current=id;saveNow();tab('claims');
}
var STAT=['Gathering evidence','Ready to file','Filed','Exam scheduled','Decision received','Appeal / Supplemental','Granted','Closed'];
function renderClaims(){
  var L=$('claimList');
  L.innerHTML=S.order.length?S.order.map(function(id){var c=S.claims[id];if(!c)return '';var done=c.checklist.filter(function(x){return x.d}).length;return '<button class="b '+(id===S.current?'':'alt')+'" data-cl="'+id+'"><b>'+esc(c.dc)+'</b> '+esc(c.name.slice(0,48))+'<br><small>'+esc(c.status)+' · '+done+'/'+c.checklist.length+' docs</small></button>'}).join(''):'<p class="muted">No claims yet.</p>';
  renderClaim();
}
$('claimList').addEventListener('click',function(e){var b=e.target.closest('[data-cl]');if(b){S.current=b.dataset.cl;save();renderClaims()}});
function renderClaim(){
  var c=S.claims[S.current],V=$('claimView');
  if(!c){V.innerHTML='<div class="card"><p>Pick a claim on the left, or go to <b>Lookup</b> and press <b>Let\'s File It</b> on a condition.</p></div>';return}
  var e=BYDC[c.dc];
  V.innerHTML='<div class="card"><h2><span class="dc">'+esc(c.dc)+'</span> '+esc(c.name)+'</h2>'+
  '<div class="row"><div><label for="cStat">Status</label><select id="cStat">'+STAT.map(function(s){return '<option'+(s===c.status?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div><div><label for="cDen">Denied before?</label><select id="cDen"><option value="0">No / first time</option><option value="1"'+(c.prevDenied?' selected':'')+'>Yes (use 21-0995 Supplemental)</option></select></div></div>'+
  '<details style="margin-top:10px"><summary><b>Official rating text (38 CFR)</b></summary><div class="reg">'+(e?regHTML(e):'')+'</div></details></div>'+
  '<div class="card"><h3>Document checklist</h3><div id="chk">'+c.checklist.map(function(x,i){return '<div class="chk"><input type="checkbox" data-ci="'+i+'"'+(x.d?' checked':'')+' aria-label="done"><textarea rows="2" data-ct="'+i+'">'+esc(x.t)+'</textarea><button class="b alt sm" data-cx="'+i+'" aria-label="remove">✕</button></div>'}).join('')+'</div><button class="b alt sm" id="chkAdd">+ Add item</button></div>'+
  '<div class="card"><h3>My notes</h3><p class="muted">Timeline, symptoms, how it affects work and daily life, doctors seen.</p><textarea id="cNotes">'+esc(c.notes)+'</textarea>'+
  '<h3>Evidence log</h3><p class="muted">No uploads here. Write down what you have and where it is (e.g., "MRI 2024 – in VA Blue Button download", "Buddy statement from Sgt. Lee – requested 10/1").</p><textarea id="cEvid">'+esc(c.evidence)+'</textarea></div>'+
  '<div class="card"><h3>AI claim helper</h3><p class="muted">Grok gets this condition\'s 38 CFR text, your notes, evidence log, and checklist. Uses your xAI key (billed by xAI). Double-check everything; AI can make mistakes. Your profile is sent only if you turn on AI access in the Profile tab.</p>'+
  '<div class="chips"><span class="chip" data-p="List the documents and evidence I still need for this claim, based on my notes and checklist.">What docs do I need?</span><span class="chip" data-p="Help me draft my personal statement (VA Form 21-10210) using my notes. Ask me questions about anything missing.">Draft my statement</span><span class="chip" data-p="Draft a buddy statement template a fellow service member or family member could fill in for this condition.">Buddy statement</span><span class="chip" data-p="Draft a polite letter asking my doctor for a nexus opinion, including what the opinion should address and the at least as likely as not standard.">Nexus letter request</span><span class="chip" data-p="Explain in plain language which rating level might fit my symptoms based on the regulation text, and what the examiner will look for.">Which rating level?</span></div>'+
  '<div class="chat" id="chat">'+(c.chat.length?c.chat.map(function(m){return '<div class="msg '+m.role+'">'+esc(m.content)+'</div>'}).join(''):'<p class="muted">No messages yet.</p>')+'</div>'+
  '<textarea id="cMsg" style="min-height:70px;margin-top:8px" placeholder="Ask a question..."></textarea><button class="b" id="cSend">Send</button><button class="b alt sm" id="cClearChat">Clear chat</button><span id="cBusy" class="muted"></span></div>'+
  '<div class="card"><button class="b red sm" id="cDel">Delete this claim</button></div>';
  var ch=$('chat');ch.scrollTop=ch.scrollHeight;
}
$('claimView').addEventListener('input',function(ev){var c=S.claims[S.current];if(!c)return;var t=ev.target;
  if(t.id==='cNotes')c.notes=t.value;else if(t.id==='cEvid')c.evidence=t.value;else if(t.id==='cStat'){c.status=t.value;renderClaimsListOnly()}else if(t.id==='cDen')c.prevDenied=t.value==='1';
  else if(t.dataset.ci!=null){c.checklist[+t.dataset.ci].d=t.checked;renderClaimsListOnly()}else if(t.dataset.ct!=null)c.checklist[+t.dataset.ct].t=t.value;
  save()});
$('claimView').addEventListener('change',function(ev){if(ev.target.dataset.ci!=null||ev.target.id==='cStat'||ev.target.id==='cDen')ev.target.dispatchEvent(new Event('input',{bubbles:true}))});
function renderClaimsListOnly(){var y=window.scrollY;var L=$('claimList');L.innerHTML=S.order.map(function(id){var c=S.claims[id];if(!c)return '';var done=c.checklist.filter(function(x){return x.d}).length;return '<button class="b '+(id===S.current?'':'alt')+'" data-cl="'+id+'"><b>'+esc(c.dc)+'</b> '+esc(c.name.slice(0,48))+'<br><small>'+esc(c.status)+' · '+done+'/'+c.checklist.length+' docs</small></button>'}).join('');window.scrollTo(0,y)}
$('claimView').addEventListener('click',function(ev){var c=S.claims[S.current];if(!c)return;var t=ev.target;
  if(t.dataset.cx!=null){c.checklist.splice(+t.dataset.cx,1);save();renderClaims()}
  else if(t.id==='chkAdd'){c.checklist.push({t:'',d:false});save();renderClaims();var ins=document.querySelectorAll('#chk textarea');if(ins.length)ins[ins.length-1].focus()}
  else if(t.dataset.p){$('cMsg').value=t.dataset.p;sendChat()}
  else if(t.id==='cSend')sendChat();
  else if(t.id==='cClearChat'){if(confirm('Clear the chat history for this claim?')){c.chat=[];saveNow();renderClaim()}}
  else if(t.id==='cDel'){if(confirm('Delete this claim and its notes and chat? This cannot be undone (unless you have a backup).')){(S.docs||[]).forEach(function(x){if(x.claim===c.id)x.claim=''});delete S.claims[c.id];S.order=S.order.filter(function(x){return x!==c.id});S.current=S.order[0]||null;saveNow();renderClaims()}}
});
function sysPrompt(c){var e=BYDC[c.dc];return 'You are the AI claim helper inside the VA to Z app, a friendly helper for a U.S. military veteran preparing a VA disability compensation claim. Use plain language and short paragraphs. You are not a lawyer or VA employee; do not promise outcomes; suggest accredited VSOs for free help when useful. Never invent regulation text: rely on the 38 CFR text below, and say when something is outside it. Relevant forms: VA Form 21-526EZ (new claim), 21-0995 (Supplemental Claim with new and relevant evidence), 21-10210 (lay/witness statement), 21-4138 (statement in support), 21-0781 (PTSD stressor), 21-4142/4142a (private records), DBQs. Service connection generally needs: current diagnosis, in-service event/injury/exposure, and a nexus opinion (at least as likely as not). When drafting statements or letters, use the veteran\'s own details and leave [brackets] for missing facts; do not make up facts. Do not ask for SSN.\n\n=== 38 CFR Part 4 text for this condition ===\n'+(e?regText(e):'DC '+c.dc)+'\n\n=== Veteran\'s claim workspace ===\nStatus: '+c.status+'\nPreviously denied: '+(c.prevDenied?'yes':'no')+'\nChecklist:\n'+c.checklist.map(function(x){return (x.d?'[x] ':'[ ] ')+x.t}).join('\n')+'\n\nNotes:\n'+(c.notes||'(none)')+'\n\nEvidence log:\n'+(c.evidence||'(none)')+docsForAI(c)+profileForAI()}
var busy=false;
async function sendChat(){var c=S.claims[S.current];if(!c||busy)return;var t=$('cMsg').value.trim();if(!t)return;
  c.chat.push({role:'user',content:t});saveNow();renderClaim();busy=true;$('cBusy').textContent=' Thinking...';$('cSend').disabled=true;
  try{var a=await callGrok([{role:'system',content:sysPrompt(c)}].concat(c.chat.slice(-30)));c.chat.push({role:'assistant',content:a})}
  catch(e){c.chat.push({role:'assistant',content:'⚠️ Could not reach Grok: '+e.message})}
  busy=false;saveNow();if(S.claims[S.current]===c)renderClaim();}
$('claimView').addEventListener('keydown',function(e){if(e.target.id==='cMsg'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();sendChat()}});

/* ---------- backup ---------- */
function blankState(){return {apiKey:'',model:'grok-4.7',calc:{entries:[],deps:{spouse:0,aa:0,parents:0,kids:0,school:0},smc:{level:'',k:0}},claims:{},order:[],current:null,tab:'setup',docs:[],mirrorTrash:[]}}
function buildBackup(){return JSON.stringify({app:'VA to Z',version:1,exported:new Date().toISOString(),data:S},null,2)} // settings-only JSON (legacy format)
async function buildFullBackup(){ensureDocs();var files=[];for(var i=0;i<S.docs.length;i++){var d=S.docs[i],r=await readFile(d.id);files.push({id:d.id,hash:d.hash||await sha(r.buf),type:r.type,b64:await b64(r.buf)})}
  var dataStr=JSON.stringify(S),payload=JSON.stringify({app:'VA to Z',version:2,exported:new Date().toISOString(),dataHash:await sha(new TextEncoder().encode(dataStr)),data:S,files:files});
  if(CAN_GZ){var g=await gzip(new TextEncoder().encode(payload),true);return {blob:new Blob([g],{type:'application/gzip'}),ext:'.vaz',type:'application/gzip',bytes:g.byteLength,raw:payload.length}}
  return {blob:new Blob([payload],{type:'application/json'}),ext:'.json',type:'application/json',bytes:payload.length,raw:payload.length}}
function showLastBackup(){setTimeout(toolSums,0);$('lastBackup').innerHTML=S.lastBackup?'Last backup saved: <b>'+esc(new Date(S.lastBackup).toLocaleString())+'</b>':'No backup saved yet on this device.'}
function backupDone(how){S.lastBackup=new Date().toISOString();saveNow();showLastBackup();renderRemind();$('expMsg').innerHTML='<div class="okbox">✓ Backup '+how+'.</div>'}
function plainDownload(name,blob,note){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500);
  backupDone('downloaded to your Downloads folder');if(note)$('expMsg').insertAdjacentHTML('beforeend','<p class="muted">'+esc(note)+'</p>')}
function isAbort(e){return e&&(e.name==='AbortError')}
$('exp').onclick=async function(){
  $('expMsg').innerHTML='<p class="muted">Preparing backup…</p>';var bk;try{bk=await buildFullBackup()}catch(e){$('expMsg').innerHTML='<span class="err">Could not build the backup: '+esc(e.message)+'</span>';return}
  $('expMsg').innerHTML='';var name='va-to-z-backup-'+new Date().toISOString().slice(0,10)+bk.ext,note='';
  try{if(navigator.canShare&&navigator.share&&typeof File==='function'){var types=[bk.type,'application/octet-stream','text/plain'],f=null;
      for(var i=0;i<types.length&&!f;i++){var tf=new File([bk.blob],name,{type:types[i]});if(navigator.canShare({files:[tf]}))f=tf}
      if(f){try{await navigator.share({files:[f],title:'VA to Z backup'});backupDone('shared/saved');return}
        catch(e){if(isAbort(e)){$('expMsg').innerHTML='<p class="muted">Backup canceled. Nothing was saved.</p>';return}note='Your browser could not open the share menu here ('+(e.name||'error')+'), so the backup was downloaded instead.'}}}}
  catch(e){note='Share menu not available here, so the backup was downloaded instead.'}
  if(window.showSaveFilePicker){try{var acc={};acc[bk.type]=[bk.ext];var h=await window.showSaveFilePicker({suggestedName:name,types:[{description:'VA to Z backup',accept:acc}]});var w=await h.createWritable();await w.write(bk.blob);await w.close();backupDone('saved as '+(h.name||name));return}
    catch(e){if(isAbort(e)){$('expMsg').innerHTML='<p class="muted">Backup canceled. Nothing was saved.</p>';return}note='Your browser blocked the "Save As" window on this page ('+(e.name||'error')+'), so the backup was downloaded instead.'}}
  plainDownload(name,bk.blob,note)};
async function restoreFrom(text,msgId,tabAfter){msgId=msgId||'restoreMsg';var o=JSON.parse(text);var d=o.data||o;if(!d||!d.claims||!d.calc)throw new Error('This file is not a VA to Z backup.');
  var files=Array.isArray(o.files)?o.files:[],docs=Array.isArray(d.docs)?d.docs:[];
  if(o.version>=2){if(o.dataHash){var dh=await sha(new TextEncoder().encode(JSON.stringify(d)));if(dh&&dh!==o.dataHash)throw new Error('Backup is damaged (data check failed).')}
    var bufs={};for(var i=0;i<files.length;i++){var fb=unb64(files[i].b64),hh=await sha(fb);if(files[i].hash&&hh&&hh!==files[i].hash)throw new Error('Backup is damaged (file check failed).');bufs[files[i].id]=[fb,files[i].type]}
    docs.forEach(function(x){if(!bufs[x.id])throw new Error('Backup is missing the file for "'+x.name+'".')})}
  else docs=[];
  var n=Object.keys(d.claims).length,when=o.exported?new Date(o.exported).toLocaleString():'unknown date';
  if(!confirm('Restore this backup from '+when+' ('+n+' claim'+(n===1?'':'s')+(docs.length?', '+docs.length+' document'+(docs.length===1?'':'s'):'')+')?\n\nThis REPLACES everything on this device now.'))return false;
  if(DB){await idbClear('files').catch(function(){});for(var j=0;j<docs.length;j++){var x=docs[j],r=await storeFile(x.id,bufs[x.id][0],bufs[x.id][1]||x.type,x.hash);x.stored=r.stored;x.gz=r.gz;x.mpath=''}}
  var lb=S.lastBackup;d.docs=docs;S=Object.assign(blankState(),d);S.tab=tabAfter||'tools';if(!S.lastBackup)S.lastBackup=lb;S.mirrorTrash=[];saveNow();init();if(DIRSTATE==='ok')mirrorAll(true);
  $('restoreMsg').innerHTML=$('restoreMsg2').innerHTML='';$(msgId).innerHTML='<div class="okbox">✓ Backup restored. '+n+' claim'+(n===1?'':'s')+(docs.length?' and '+docs.length+' document'+(docs.length===1?'':'s'):'')+' loaded (backup from '+esc(when)+'). All integrity checks passed.</div>';return true}
function wireRestore(inputId,msgId,tabAfter){$(inputId).onchange=function(){var f=this.files[0];if(!f)return;this.value='';$(msgId).innerHTML='<p class="muted">Checking backup…</p>';
  f.arrayBuffer().then(async function(buf){var u=new Uint8Array(buf),text;
    if(u[0]===0x1f&&u[1]===0x8b){if(!CAN_GZ)throw new Error('This browser can\'t open compressed (.vaz) backups. Try Chrome, Edge, or a current Safari.');text=new TextDecoder().decode(await gzip(buf,false))}else text=new TextDecoder().decode(buf);
    var r=await restoreFrom(text,msgId,tabAfter);if(r===false)$(msgId).innerHTML=''}).catch(function(e){$(msgId).innerHTML='<span class="err">Restore failed: '+esc(e.message)+'</span>'})}}
wireRestore('imp','restoreMsg','tools');wireRestore('imp2','restoreMsg2','setup');
$('clr').onclick=async function(){if(!confirm('Erase ALL data from this device: API key, profile, calculator, claims, notes, chats, and documents?\n\nThis cannot be undone. Download a backup first if you want to keep it. (Files already in a save folder on your computer are not deleted.)'))return;
  try{localStorage.removeItem(KEY)}catch(e){}if(DB){await idbClear('files').catch(function(){});await idbClear('kv').catch(function(){})}DIR=null;DIRSTATE='none';
  S=blankState();S.tab='tools';init();saveNow();renderDir();alert('All data cleared.')};
$('about').textContent='Regulation text: '+CFR.length+' diagnostic codes from 38 CFR Part 4 (eCFR, current as of October 19, 2026 (last amended August 27, 2026)), embedded word-for-word. Rating tables in the VA Disability Calculator (Tools): VA '+RATES.year+'. Some codes are rated under a shared formula, which is shown with the code. Hearing loss (6100) shows the § 4.85 text; the audiometric tables are on eCFR.';

function init(){ensureProfile();ensureDocs();renderProfile();renderDocs();$('apikey').value=S.apiKey||'';$('model').value=S.model||'grok-4.7';migrateCalc();preloadCalc(false);renderCalc();renderVARings();renderSyncLast();doSearch();renderClaims();showLastBackup();tab(S.tab||'setup');if(!storageOK)$('saveStatus').innerHTML='<span class="err">This browser is blocking local storage. Use <a href="#" data-go="tool-backup">Download Backup in Tools</a> to save your work.</span>';$('saveInd').innerHTML='<a href="#" data-go="tool-backup" style="color:#ffc72c">⚠ Not saved · Back up</a>'}
boot();
