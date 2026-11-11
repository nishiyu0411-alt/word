import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root = process.env.EXAM_SOURCE_DIRECTORY || fileURLToPath(new URL('../sources/',import.meta.url));
const out = new URL('../', import.meta.url);
const load = (name, key) => { const c={window:{}}; vm.runInNewContext(fs.readFileSync(root+name,'utf8'),c,{timeout:1000}); return JSON.parse(JSON.stringify(c.window[key])); };
const word=JSON.parse(fs.readFileSync(root+'word-html.html','utf8').match(/const QUESTIONS = (\[[\s\S]*?\]);/)[1]);
const unified=load('math-q.js','UNIFIED_QUESTIONS');
const logic=load('logic-q.js','LOGIC_QUESTIONS');
const psych=load('cattell-q.js','CATTELL_DATA');
const languageTypes=/字音|易错字|词语|语境|成语|关联词|虚词|实词|歧义|句式|语句|语言理解|语言运用|语言逻辑|阅读理解|说明文阅读|标点/;
const seen=new Map(), rejected=[], conflicts=[], referenceQuestions=[];
const norm=s=>String(s||'').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
function add(q){
 if(!q.stem?.trim()||q.options.length<2||q.options.length>8||q.options.some(o=>!o.text?.trim())||!/^[A-H]$/.test(q.answer)||!q.options.some(o=>o.key===q.answer)||!q.explanation?.trim()) {rejected.push(q.id);q.scoreEligible=false;q.reviewStatus=/^[A-H]$/.test(q.answer)?'incomplete':'disputed';q.notice=q.reviewStatus==='disputed'?'原库答案带有争议说明，保留原题、原答案和解析供辨析，不自动判分。':'原题内容或选项缺损，保留现有内容供核对，不自动判分。';referenceQuestions.push(q);return;}
 const sig=norm(q.stem)+'|'+q.options.map(o=>norm(o.text)).join('|');
 if(seen.has(sig)){const old=seen.get(sig);if(old.answer!==q.answer){conflicts.push([old.id,q.id]);old.conflict=true;}q.duplicateOf=old.id;q.scoreEligible=false;q.reviewStatus='duplicate';referenceQuestions.push(q);return;}
 q.fingerprint=crypto.createHash('sha256').update(sig).digest('hex').slice(0,20);seen.set(sig,q);
}
function convert(q, prefix, cat, url){
 return {id:prefix+q.id,category:cat,subtype:q.category||q.minor||'逻辑推理',stem:q.stem||q.question||q.prompt,options:(q.options||[]).map(o=>({key:o.key||o.label,text:o.text})),answer:q.answer,explanation:q.explanation||q.analysis,origin:'existing',sourceLabel:(prefix==='logic-'?'逻辑题库':'词汇与综合题库')+' · '+(q.sourceNumber||q.source||'#'+q.id),sourceUrl:url,sourceBank:prefix.replace(/-$/,''),originalNumber:q.id,scoreEligible:true,reviewStatus:'scored'};
}
// Prefer the current individual repositories; their incomplete flags override old unified copies.
for(const q of word){const cat=/病句/.test(q.category)?'sentence':languageTypes.test(q.category)?'language':'general';const x=convert(q,'word-',cat,'https://nishiyu0411-alt.github.io/word/');if(q.incomplete){x.scoreEligible=false;x.reviewStatus='incomplete';x.notice='原题扫描内容不完整，已保留原题与现有选项，待核验，不自动判分。';referenceQuestions.push(x);}else add(x);}
for(const q of logic){const x=convert(q,'logic-','logic','https://nishiyu0411-alt.github.io/logic-practice/');if(q.kind!=='choice'||!q.answer){x.scoreEligible=false;x.reviewStatus='open';x.notice='原题为开放作答、选项缺损或含争议口径，保留原参考答案和解析，供独立练习，不自动判分。';referenceQuestions.push(x);}else add(x);}
for(const q of unified){if(q.bad||q.major!=='数学题')continue;const x=convert(q,'math-','math','https://nishiyu0411-alt.github.io/math/unified/');x.sourceLabel='数学题库 · '+q.minor+' · '+q.source;add(x);}
function plain(s){return String(s||'').replace(/<\/?p\b[^>]*>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\*\*/g,'').replace(/✅/g,'').trim();}
const materialEnd={'2023-03':9,'2025-03':7,'2023-04':11,'2025-04':14,'2023-05':2,'2025-05':2};
const xcStats={};
for(const file of fs.readdirSync(root).filter(x=>/^xc.*\.md$/.test(x))){
 const code=file.slice(3,-3),mod=code.slice(-2),year=code.slice(0,4),md=fs.readFileSync(root+file,'utf8');
 const title=md.match(/^试卷: "(.*)"/m)[1];const originalPath=({'03':'03-言语理解与表达','04':'04-数量关系','05':'05-判断推理'}[mod])+'/'+title+'.md';
 let material='',collect=false,mat=[],current=null,raw=[];
 const flush=()=>{if(!current)return;let phase=0,body=[],opts=[],exp=[],answer='';for(const line of current.lines){let a=line.match(/^\*\*答案\*\*[：:]\s*(.*)/);if(a){answer=a[1].trim();phase=2;continue;}if(/^\*\*(官方)?解析\*\*/.test(line)){phase=3;continue;}if(/^---\s*$/.test(line))continue;if(phase===3){exp.push(line);continue;}if(phase===2)continue;let m=line.match(/^\s*[-*]?\s*\*\*([A-D])\*\*[.．、]\s*(.*)/);if(m){opts.push({key:m[1],text:m[2].replace(/✅/g,'').trim()});phase=1;}else if(phase===1&&line.trim()&&opts.length)opts.at(-1).text+='\n'+line;else if(phase===0)body.push(line);}
 raw.push({...current,body:body.join('\n').trim(),opts,exp:exp.join('\n').trim(),answer,material:current.num<=materialEnd[code]?material:''});current=null;};
 for(const line of md.split(/\r?\n/)){if(/^## 材料/.test(line)){flush();collect=true;mat=[];continue;}const m=line.match(/^### 第 (\d+) 题.*qid (\d+) · ([^<]+)/);if(m){if(collect){material=mat.join('\n').trim();collect=false;}flush();current={num:+m[1],qid:m[2],tag:m[3].trim(),lines:[]};continue;}if(collect)mat.push(line);else if(current)current.lines.push(line);}flush();
 let count=0;
 for(const q of raw){if(/<img|!\[|\[\[.*\.(png|jpg)|依照上题|由上一题|同上题|由上题/.test(q.material+q.body+q.opts.map(o=>o.text).join('')+q.exp)||!/^[ABCD]$/.test(q.answer))continue;
 const x={id:'xingce-'+q.qid,category:mod==='03'?(/语病|病句/.test(q.body)?'sentence':'language'):mod==='04'?'math':'logic',subtype:q.tag,stem:plain(q.body),material:plain(q.material),options:q.opts.map(o=>({key:o.key,text:plain(o.text)})),answer:q.answer,explanation:plain(q.exp),origin:'xingce',sourceLabel:year+'上海行测A类（网友回忆版） · 第'+q.num+'题 · '+q.tag,sourceUrl:'https://github.com/ERRRC/xingcezhenti/blob/main/'+originalPath.split('/').map(encodeURIComponent).join('/'),sourceBank:'xingce',originalNumber:q.num,scoreEligible:true,reviewStatus:'scored'};
 const before=seen.size;add(x);if(seen.size>before)count++;
 }xcStats[file]={parsed:raw.length,accepted:count};
}
const questions=[...seen.values()].filter(q=>!q.conflict);
const personality=psych.questions.map(q=>({id:'psych-'+q.id,originalNumber:q.id,category:'psych',subtype:'卡特尔人格问卷',stem:q.stem,options:Object.entries(q.options).map(([key,text])=>({key,text})),origin:'cattell',sourceLabel:'卡特尔原题 · 第'+q.id+'题',sourceUrl:'https://nishiyu0411-alt.github.io/word/cattell/',sourceBank:'psych',scoreEligible:false,reviewStatus:'psych'}));
const all=[...questions,...referenceQuestions];
const sourceCounts=Object.fromEntries(['logic','word','math'].map(k=>{const qs=all.filter(q=>q.sourceBank===k);return [k,{total:qs.length,scored:qs.filter(q=>q.scoreEligible).length,open:qs.filter(q=>q.reviewStatus==='open').length,disputed:qs.filter(q=>q.reviewStatus==='disputed').length,incomplete:qs.filter(q=>q.reviewStatus==='incomplete').length,duplicates:qs.filter(q=>q.duplicateOf).length}];}));
const stats={updated:'2026-11-11',base:questions.filter(q=>q.origin==='existing').length,extra:questions.filter(q=>q.origin==='xingce').length,categories:Object.fromEntries(['logic','math','sentence','language','general'].map(c=>[c,questions.filter(q=>q.category===c&&q.origin==='existing').length])),sourceCounts,referenceCount:referenceQuestions.length,catalogCount:all.length+personality.length,psych:personality.length,rejected:rejected.length,conflicts,xcStats};
for(const [key,expected]of [['logic',logic.length],['word',word.length]])if(sourceCounts[key].total!==expected)throw Error(key+' source coverage mismatch');
fs.writeFileSync(new URL('data.js',out),'window.EXAM_BANK = '+JSON.stringify({version:2,stats,questions,referenceQuestions,personality})+';\n');
fs.writeFileSync(new URL('../tools/bank-report.json',import.meta.url),JSON.stringify(stats,null,2));
console.log(JSON.stringify(stats,null,2));
