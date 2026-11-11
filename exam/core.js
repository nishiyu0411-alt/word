export const CATEGORY_NAMES={logic:'逻辑推理',math:'数学运算',sentence:'错句判断',language:'语言理解',psych:'心理问卷'};
export const MODES={exam60:{name:'60题模拟考试',short:'标准模拟',count:60,minutes:60},full:{name:'180题完整模拟',short:'完整模拟',count:180,minutes:75},practice:{name:'随机60题练习',short:'自由练习',count:60,minutes:0}};
export const DEFAULT_WEIGHTS={logic:30,math:30,sentence:15,language:25};
export function random(){if(globalThis.crypto?.getRandomValues){const a=new Uint32Array(1);globalThis.crypto.getRandomValues(a);return a[0]/4294967296;}return Math.random();}
export function shuffle(items,rng=random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function validWeights(w){return Object.keys(DEFAULT_WEIGHTS).every(k=>Number.isFinite(w[k])&&w[k]>=0&&w[k]<=100)&&Object.values(w).reduce((s,n)=>s+n,0)===100;}
export function buildPaper(bank,mode,weights=DEFAULT_WEIGHTS,used=[],includeExtra=true,rng=random){
 if(!MODES[mode]||!validWeights(weights))throw Error('抽题比例合计须为100%');
 const old=new Set(used),pools={};
 for(const k of Object.keys(DEFAULT_WEIGHTS)){
  const candidates=bank.questions.filter(q=>q.category===k&&(mode==='practice'&&includeExtra||q.origin==='existing'));
  pools[k]=[...shuffle(candidates.filter(q=>!old.has(q.id)),rng),...shuffle(candidates.filter(q=>old.has(q.id)),rng)];
 }
 const picked=[],fingerprints=new Set();
 while(picked.length<60){
  const available=Object.keys(pools).filter(k=>pools[k].length&&weights[k]>0),sum=available.reduce((s,k)=>s+weights[k],0);
  if(!sum)throw Error('所选题型的可用题目不足60题，请增加其他题型比例');
  let draw=rng()*sum,category=available.at(-1);for(const k of available){draw-=weights[k];if(draw<0){category=k;break;}}
  const q=pools[category].shift();const fingerprint=q.fingerprint||q.id;if(fingerprints.has(fingerprint))continue;fingerprints.add(fingerprint);picked.push(q);
 }
 if(mode==='full')picked.push(...shuffle(bank.personality,rng).slice(0,120).sort((a,b)=>a.originalNumber-b.originalNumber));
 return picked;
}
export function createSession(bank,mode,weights,used,extra){
 const questions=buildPaper(bank,mode,weights,used,extra);
 const now=Date.now();return {version:1,id:'paper-'+now+'-'+Math.floor(random()*1e8).toString(36),mode,questions,answers:{},marks:[],index:0,status:'running',remainingMs:MODES[mode].minutes*60000,deadline:MODES[mode].minutes?now+MODES[mode].minutes*60000:null,createdAt:now,updatedAt:now,weights:{...weights},includeExtra:mode==='practice'&&extra,submittedAt:null,submitReason:null};
}
export function remaining(session,now=Date.now()){
 if(!MODES[session.mode].minutes)return null;
 return Math.max(0,session.status==='running'&&session.deadline!=null?session.deadline-now:session.remainingMs);
}
export function hasAnswer(q,value){return typeof value==='string'&&q.options.some(o=>o.key===value);}
export function answerCount(s){return s.questions.reduce((n,q)=>n+Number(hasAnswer(q,s.answers[q.id])),0);}
export function canSubmit(s){return answerCount(s)===s.questions.length;}
export function answer(s,value){if(s.status!=='running')return false;const q=s.questions[s.index];if(!hasAnswer(q,value))return false;s.answers[q.id]=value;s.updatedAt=Date.now();return true;}
export function pause(s,now=Date.now()){
 if(s.status!=='running')return false;
 const left=remaining(s,now);if(left!==null&&left<=0){submit(s,true,now);return false;}
 s.remainingMs=left??0;s.deadline=null;s.status='paused';s.updatedAt=now;return true;
}
export function resume(s,now=Date.now()){if(s.status!=='paused')return false;s.status='running';s.deadline=MODES[s.mode].minutes?now+s.remainingMs:null;s.updatedAt=now;return true;}
export function submit(s,timeout=false,now=Date.now()){
 if(s.status!=='running'||(!timeout&&!canSubmit(s)))return false;
 if(timeout&&(remaining(s,now)===null||remaining(s,now)>0))return false;
 s.remainingMs=remaining(s,now)??0;s.deadline=null;s.status='submitted';s.submittedAt=now;s.updatedAt=now;s.submitReason=timeout?'timeout':'complete';return true;
}
export function grade(s){
 const scored=s.questions.filter(q=>q.category!=='psych');const correct=scored.filter(q=>hasAnswer(q,s.answers[q.id])&&s.answers[q.id]===q.answer).length;
 const unanswered=scored.filter(q=>!hasAnswer(q,s.answers[q.id])).length;const wrong=scored.length-correct-unanswered;
 const categories=Object.keys(DEFAULT_WEIGHTS).map(key=>{const qs=scored.filter(q=>q.category===key);return {key,total:qs.length,correct:qs.filter(q=>s.answers[q.id]===q.answer).length};});
 return {total:scored.length,correct,wrong,unanswered,incorrect:wrong+unanswered,percent:Math.round(correct/scored.length*100),psychAnswered:s.questions.filter(q=>q.category==='psych'&&hasAnswer(q,s.answers[q.id])).length,psychTotal:s.questions.filter(q=>q.category==='psych').length,categories};
}
export function snapshot(s,now=Date.now()){const result=JSON.parse(JSON.stringify(s));if(s.status==='running')result.remainingMs=remaining(s,now)??0;result.updatedAt=now;return result;}
export function recover(saved){const s=JSON.parse(JSON.stringify(saved));if(s.status==='running'){if(MODES[s.mode].minutes&&s.remainingMs<=0){s.deadline=Date.now();submit(s,true);}else{s.status='paused';s.deadline=null;}}return s;}
export function validateSession(s,bank){
 if(!s||s.version!==1||!MODES[s.mode]||typeof s.id!=='string'||s.id.length>120||!Array.isArray(s.questions)||s.questions.length!==MODES[s.mode].count||!s.answers||typeof s.answers!=='object'||!['running','paused','submitted'].includes(s.status)||!Number.isFinite(s.remainingMs)||s.remainingMs<0||s.remainingMs>MODES[s.mode].minutes*60000||!Number.isInteger(s.index)||s.index<0||s.index>=s.questions.length)return false;
 const catalog=new Map([...bank.questions,...bank.personality].map(q=>[q.id,q]));const ids=new Set();
 for(let i=0;i<s.questions.length;i++){const q=s.questions[i],trusted=catalog.get(q?.id);if(!trusted||ids.has(q.id)||JSON.stringify(q)!==JSON.stringify(trusted))return false;if((i<60&&q.category==='psych')||(i>=60&&q.category!=='psych'))return false;if(s.answers[q.id]!=null&&!hasAnswer(q,s.answers[q.id]))return false;ids.add(q.id);}
 if(!Array.isArray(s.marks)||s.marks.some(id=>!ids.has(id))||Object.keys(s.answers).some(id=>!ids.has(id)))return false;
 return true;
}
