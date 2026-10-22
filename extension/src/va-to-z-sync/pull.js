// Injected into a www.va.gov tab. Runs only GET requests against api.va.gov with the
// user's existing VA.gov session (credentials: include). Reads data only; never sends,
// changes, or reads any password or login form.
async function vatozPull(){
  const API='https://api.va.gov';
  const H={'X-Key-Inflection':'camel','Source-App-Name':'va-to-z-sync','Content-Type':'application/json'};
  const log={};
  async function get(path){
    try{const r=await fetch(API+path,{credentials:'include',headers:H});
      log[path]=r.status;if(!r.ok)return null;return await r.json()}
    catch(e){log[path]='error: '+(e&&e.message||e);return null}}
  const pick=(...v)=>{for(const x of v)if(x!==undefined&&x!==null&&x!=='')return x;return ''};
  const g=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
  const user=await get('/v0/user');
  if(!user||!g(user,'data.attributes')){return {ok:false,error:log['/v0/user']===401?'not-logged-in':'user-failed',log}}
  const ua=user.data.attributes,prof=ua.profile||{},ci=ua.vet360ContactInformation||ua.vaProfile&&ua.vaProfile.contactInformation||{};
  const [fullName,personal,svc,rated,rated2,ratingInfo,claims]=await Promise.all([
    get('/v0/profile/full_name'),get('/v0/profile/personal_information'),get('/v0/profile/service_history'),
    get('/v0/rated_disabilities'),get('/v0/disability_compensation_form/rated_disabilities'),
    get('/v0/disability_compensation_form/rating_info'),get('/v0/benefits_claims')]);
  const fn=g(fullName,'data.attributes')||{},pi=g(personal,'data.attributes')||{};
  const addr=a=>a?{line1:pick(a.addressLine1),line2:[a.addressLine2,a.addressLine3].filter(Boolean).join(' '),city:pick(a.city),state:pick(a.stateCode,a.province),zip:pick(a.zipCode,a.internationalPostalCode),country:pick(a.countryName,a.countryCodeIso3)}:null;
  const ph=p=>p&&p.phoneNumber?((p.areaCode?p.areaCode:'')+p.phoneNumber).replace(/^(\d{3})(\d{3})(\d{4})$/,'($1) $2-$3')+(p.extension?' x'+p.extension:''):'';
  const profile={first:pick(fn.first,prof.firstName),middle:pick(fn.middle,prof.middleName),last:pick(fn.last,prof.lastName),suffix:pick(fn.suffix),
    dob:pick(pi.birthDate,prof.birthDate),gender:pick(pi.gender,prof.gender),
    email:pick(g(ci,'email.emailAddress'),prof.email),
    phone:ph(ci.mobilePhone)||ph(ci.homePhone),homePhone:ph(ci.homePhone),mobilePhone:ph(ci.mobilePhone),workPhone:ph(ci.workPhone),
    mailingAddress:addr(ci.mailingAddress),homeAddress:addr(ci.residentialAddress)};
  // ratings: prefer Lighthouse-backed /v0/rated_disabilities, fall back to the 526 endpoints
  let combined=null,conditions=[];
  const ra=g(rated,'data.attributes');
  if(ra){combined=pick(ra.combinedDisabilityRating,null);
    conditions=(ra.individualRatings||[]).map(x=>({name:pick(x.diagnosticText,x.diagnosticTypeName,x.name),dc:String(pick(x.diagnosticTypeCode,x.diagnosticCode,'')),percent:pick(x.ratingPercentage,x.ratingPercent,null),effective:pick(x.effectiveDate,''),decision:pick(x.decision,'')}))}
  const ra2=g(rated2,'data.attributes');
  if(!conditions.length&&ra2)conditions=(ra2.ratedDisabilities||[]).map(x=>({name:pick(x.name),dc:String(pick(x.diagnosticCode,'')),percent:pick(x.ratingPercentage,null),effective:pick(x.effectiveDate,''),decision:pick(x.decisionText,x.decisionCode,'')}));
  if(combined===null){const ri=g(ratingInfo,'data.attributes');if(ri)combined=pick(ri.userPercentOfDisability,null)}
  const claimsArr=(g(claims,'data')||[]).map(c=>{const a=c.attributes||{};return {id:String(c.id||''),type:pick(a.claimType,a.claimTypeCode),date:pick(a.claimDate,''),status:pick(a.status,a.claimPhaseDates&&a.claimPhaseDates.phaseType,''),closed:pick(a.closeDate,''),decisionLetterSent:!!a.decisionLetterSent}});
  const service=(g(svc,'data.attributes.serviceHistory')||[]).map(s=>({branch:pick(s.branchOfService),component:pick(s.personnelCategoryTypeCode),begin:pick(s.beginDate),end:pick(s.endDate),discharge:pick(s.characterOfDischargeCode),periodType:pick(s.periodOfServiceTypeText,s.serviceType)}));
  return {ok:true,data:{source:'va.gov',pulledAt:new Date().toISOString(),profile,ratings:{combined,conditions},claims:claimsArr,service,_endpoints:log}};
}
