import {CATEGORY_NAMES as CN,MODES,DEFAULT_WEIGHTS,validWeights,createSession,remaining,answerCount,canSubmit,hasAnswer,answer,pause,resume,submit,grade,snapshot,recover,validateSession} from './core.js';
const bank=window.EXAM_BANK,main=document.querySelector('#main'),dialog=document.querySelector('#dialog'),clockRoot=document.querySelector('#clock-root');
const KEY='shizonghe-exam-studio-v1';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',history:'M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2',book:'M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4V4ZM14 7a3 3 0 0 1 3-3h4v15h-3a4 4 0 0 0-4 2',clock:'M12 7v5l3 2M8 2h8M19 5l2 2M5 5 3 7M21 13a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',arrow:'M5 12h14M13 6l6 6-6 6',left:'M19 12H5M11 6l-6 6 6 6',check:'m5 12 4 4L19 6',info:'M12 10v7M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',pause:'M8 5v14M16 5v14',play:'m8 5 11 7-11 7V5Z',refresh:'M20 8a8 8 0 0 0-14-3L3 8M3 2v6h6M4 16a8 8 0 0 0 14 3l3-3M21 22v-6h-6',save:'M5 3h12l4 4v14H3V3h2ZM7 3v6h10V3M7 21v-8h10v8',download:'M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6',upload:'M12 15V3m-5 5 5-5 5 5M4 15v6h16v-6',flag:'M5 21V3m0 1c6-4 8 4 14 0v10c-6 4-8-4-14 0',brain:'M9 4a3 3 0 0 0-5 2 4 4 0 0 0-1 7 4 4 0 0 0 3 6 3 3 0 0 0 6 0V6a3 3 0 0 0-3-3M15 4a3 3 0 0 1 5 2 4 4 0 0 1 1 7 4 4 0 0 1-3 6 3 3 0 0 1-6 0M7 8l3 2M17 8l-3 2M6 15l3-1M18 15l-3-1',paper:'M5 3h11l3 3v15H5V3ZM15 3v5h4M8 12h8M8 16h5',spark:'m12 3 2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z',chevron:'m6 9 6 6 6-6',close:'m6 6 12 12M18 6 6 18',calendar:'M5 5h14v16H5V5ZM8 2v6M16 2v6M5 11h14',home:'m3 11 9-8 9 8M6 10v11h12V10M10 21v-7h4v7',target:'M12 8v8M8 12h8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'};
const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.paper}"/></svg>`;
const fmt=ms=>{const s=Math.ceil(Math.max(0,ms||0)/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
const dateTime=t=>new Date(t).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
let model={weights:{...DEFAULT_WEIGHTS},includeExtra:true,sessions:{},history:[],used:[],clockHidden:false,alarm:null},view='home',session=null,reveal=false,reviewFilter='all',storageOK=true,lastCheckpoint=0,toastTimer,dialogCallbacks=new Map(),audioContext=null;
try{
 const saved=JSON.parse(localStorage.getItem(KEY)||'null');
 if(saved&&typeof saved==='object'){
  if(validWeights(saved.weights))model.weights=saved.weights;
  model.includeExtra=saved.includeExtra!==false;model.clockHidden=!!saved.clockHidden;model.alarm=Number.isFinite(saved.alarm)?saved.alarm:null;
  model.used=Array.isArray(saved.used)?saved.used.filter(x=>typeof x==='string').slice(-1600):[];
  model.history=Array.isArray(saved.history)?saved.history.filter(s=>s.status==='submitted'&&validateSession(s,bank)).slice(0,5):[];
  for(const [mode,s]of Object.entries(saved.sessions||{})){if(MODES[mode]&&s.mode===mode&&validateSession(s,bank)){const recovered=recover(s);if(recovered.status==='submitted'){if(!model.history.some(x=>x.id===recovered.id))model.history.unshift(recovered);}else model.sessions[mode]=recovered;}}
 }
}catch{storageOK=false;}
function persist(){
 try{const copy={...model,sessions:Object.fromEntries(Object.entries(model.sessions).map(([k,s])=>[k,snapshot(s)])),history:model.history.slice(0,5)};localStorage.setItem(KEY,JSON.stringify(copy));storageOK=true;}catch{storageOK=false;}
 const status=document.querySelector('#save-status');if(status){status.textContent=storageOK?'已自动保存':'保存失败，请导出存档';status.style.color=storageOK?'':'#be5558';}
 document.querySelector('.autosave').innerHTML=`<i style="background:${storageOK?'#60a58c':'#c17b6a'}"></i>${storageOK?'答案自动保存':'请导出存档'}`;
 return storageOK;
}
function toast(text){clearTimeout(toastTimer);const t=document.querySelector('#toast');t.textContent=text;t.classList.add('show');toastTimer=setTimeout(()=>t.classList.remove('show'),3200);}
function showDialog(title,html,buttons=[{text:'知道了',value:'close',primary:true}]){
 if(dialog.open)dialog.close();dialogCallbacks=new Map();
 document.querySelector('#dialog-content').innerHTML=`<h2 id="dialog-title">${E(title)}</h2>${html}<div class="btn-row">${buttons.map((b,i)=>{dialogCallbacks.set(String(i),b.action);return `<button class="btn ${b.primary?'primary':'secondary'}" data-dialog="${i}">${E(b.text)}</button>`;}).join('')}</div>`;
 dialog.showModal();
}
dialog.addEventListener('click',e=>{const b=e.target.closest('[data-dialog]');if(b){const cb=dialogCallbacks.get(b.dataset.dialog);dialog.close();cb?.();}});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
function setNav(){document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===(view==='history'?'history':view==='about'?'about':'home')));}
function heading(title,subtitle,eyebrow='YOUR PRACTICE, YOUR PACE'){return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${subtitle}</p></div><span class="date-chip">${icon('calendar',14)}${new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}</span></div>`;}
function totalCounts(){const done=model.history.filter(x=>x.mode!=='practice');return {exams:done.length,practice:model.history.filter(x=>x.mode==='practice').length,answers:model.history.reduce((n,s)=>n+answerCount(s),0)};}
function renderHome(){
 const c=totalCounts();const cards=[{mode:'exam60',title:'标准模拟',en:'STANDARD EXAM',sub:'专注计分部分，练出考场节奏',count:60,time:'60 分钟',desc:'逻辑、数学、错句、语言，按比例随机抽取60题。整卷作答后统一交卷。',button:'开始标准模拟',icon:'paper',foot:'60题计分 · 到时自动交卷'},{mode:'full',title:'完整模拟',en:'FULL SIMULATION',sub:'从第一题，到最后一题',count:180,time:'75 分钟',desc:'60题计分试题 + 120题心理问卷，体验完整的机考作答流程。',button:'开始完整模拟',icon:'brain',foot:'前60题计分 · 心理问卷不计分'},{mode:'practice',title:'自由练习',en:'DAILY PRACTICE',sub:'不赶时间，把每一道题想明白',count:60,time:'不限时',desc:'每套随机60题，可加入上海行测题。作答后可查看本题解析，随时换一套。',button:'抽取一套练习',icon:'spark',foot:'悬浮时钟 · 随时保存 · 随时重抽'}];
 const saved=Object.values(model.sessions);
 main.innerHTML=heading('把每一次练习，变成进步。','选择今天的练习方式，准备好后再开始。')+
 `<div class="stats-row"><div class="stat-card"><span class="stat-label">模拟可用题库</span><span class="stat-icon">${icon('book',18)}</span><div class="stat-value">${bank.stats.base}<small>题</small></div><div class="stat-foot">4类题型 · 同卷不重复</div></div><div class="stat-card"><span class="stat-label">行测补充题</span><span class="stat-icon">${icon('spark',18)}</span><div class="stat-value">${bank.stats.extra}<small>题</small></div><div class="stat-foot">上海行测 · 练习模式可选</div></div><div class="stat-card"><span class="stat-label">心理问卷原库</span><span class="stat-icon">${icon('brain',18)}</span><div class="stat-value">${bank.stats.psych}<small>题</small></div><div class="stat-foot">完整版每次随机抽120题</div></div><div class="stat-card"><span class="stat-label">近期完成模拟</span><span class="stat-icon">${icon('target',18)}</span><div class="stat-value">${c.exams}<small>次</small></div><div class="stat-foot">保留最近5次交卷记录</div></div></div>`+
 (saved.length?`<div class="saved-stack">${saved.map(s=>`<div class="saved-card"><span class="saved-icon">${icon('save',23)}</span><div class="saved-info"><strong>你有一份未完成的${E(MODES[s.mode].short)}</strong><p>已答 ${answerCount(s)}/${s.questions.length} 题${s.mode==='practice'?' · 不限时':' · 剩余 '+fmt(remaining(s))} · ${dateTime(s.updatedAt)} 保存</p></div><div class="btn-row"><button class="btn secondary" data-action="open" data-mode="${s.mode}">${icon('play',12)} 继续作答</button><button class="btn link" data-action="new" data-mode="${s.mode}">重新开始</button></div></div>`).join('')}</div>`:'')+
 `<div class="section-head"><h2>选择模拟版本</h2><small>每套新卷随机生成 · 已做题目优先错开</small></div><div class="mode-grid">${cards.map(x=>`<article class="mode-card ${x.mode}"><div class="mode-top"><span class="mode-icon">${icon(x.icon,22)}</span><span class="mode-label">${x.en}</span></div><h3>${x.title}</h3><div class="mode-subtitle">${x.sub}</div><div class="question-total"><strong>${x.count}</strong><span>题</span><small>${icon('clock',13)}${x.time}</small></div><p>${x.desc}</p><button class="btn ${x.mode==='exam60'?'primary':''}" data-action="new" data-mode="${x.mode}">${x.button}${icon('arrow',15)}</button><div class="mode-footer">${x.foot}</div></article>`).join('')}</div>`+
 `<div class="notice-strip">${icon('info',16)}<p><strong>交卷后再看结果。</strong> 考试须全部作答才可主动交卷；时间结束将自动交卷。暂停可保存本套试卷、答案和剩余时间，刷新或关闭页面也会自动存档并暂停。</p></div>`+
 `<details class="panel weights-panel"><summary><span>自定义抽题比例</span><span class="summary-meta">模拟比例，可按需要调整 ${icon('chevron',13)}</span></summary><div class="weights-body"><div class="weights-grid">${Object.keys(DEFAULT_WEIGHTS).map(k=>`<label class="weight-label">${CN[k]} <small class="muted">${bank.stats.categories[k]}题</small><span class="weight-input"><input type="number" id="weight-${k}" min="0" max="100" step="1" value="${model.weights[k]}" aria-label="${CN[k]}抽题百分比"><span>%</span></span></label>`).join('')}</div><div class="btn-row"><span class="weights-total" id="weights-total">合计 ${Object.values(model.weights).reduce((a,b)=>a+b,0)}%</span><button class="btn link" data-action="save-weights" style="margin-left:auto">保存比例</button><button class="btn link" data-action="reset-weights">恢复默认</button></div><p class="weights-note">比例合计须为100%。这些是练习用的模拟权重，未采用官方出题概率。每次按权重随机抽题，同卷不重复；某题型可用题数耗尽后，会从其他已选题型补足。</p><div class="switch-row"><label class="switch-label"><input type="checkbox" id="include-extra" ${model.includeExtra?'checked':''}>自由练习加入 ${bank.stats.extra} 道上海行测补充题</label><span class="small muted">考试模式使用原有题库</span></div></div></details>`+
 `<div class="section-grid"><section class="panel"><div class="panel-title"><h2>最近的脚印</h2><button class="btn link" data-nav="history">全部记录 ${icon('arrow',13)}</button></div>${model.history.length?model.history.slice(0,3).map(s=>{const g=grade(s);return `<div class="recent-item"><span class="recent-mark">${icon(s.mode==='practice'?'spark':'paper',16)}</span><div><p>${E(MODES[s.mode].name)}</p><small>${dateTime(s.submittedAt)} · ${s.submitReason==='timeout'?'到时交卷':'完成交卷'}</small></div><span class="recent-score">${g.correct}<small>/60</small></span><button class="btn link" data-action="history-detail" data-id="${E(s.id)}">查看</button></div>`;}).join(''):'<div class="empty-small">你的第一次模拟，将从这里开始。</div>'}</section><section class="panel"><div class="panel-title"><h2>安心作答的小提示</h2><span class="eyebrow">JUST FOCUS</span></div><ul class="quick-note"><li>${icon('check',13)}点选后自动保存，不必逐题确认。</li><li>${icon('check',13)}拿不准的题可以标记，交卷前再回看。</li><li>${icon('check',13)}心理问卷记录选择，不判断对错。</li><li>${icon('check',13)}练习可用1–4选项、方向键切题。</li></ul></section></div>`+
 `<div class="footline"><span>进度保存在当前浏览器 · 换设备可导出并导入存档</span><div class="btn-row"><button class="btn link" data-action="import">${icon('upload',12)} 导入存档</button><button class="btn link" data-nav="about">题库来源与使用说明</button></div></div>`;
 clockRoot.innerHTML='';setNav();
}
function readWeights(silent=false){
 if(!document.querySelector('#weight-logic'))return true;
 const weights=Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map(k=>[k,Number(document.querySelector('#weight-'+k).value)]));
 if(!validWeights(weights)){if(!silent)showDialog('再检查一下抽题比例','<p>四类题型的比例须合计100%，每项为0至100之间的数字。</p>');return false;}
 model.weights=weights;model.includeExtra=document.querySelector('#include-extra').checked;persist();return true;
}
function requestNew(mode){
 if(!MODES[mode]||!readWeights())return;
 if(session?.status==='running'){if(enforceTime())return;pause(session);persist();}
 const existing=model.sessions[mode];const x=MODES[mode];
 showDialog(mode==='practice'?'准备好，开始练习吧。':'准备进入模拟考场',`<p>${existing?'重新开始会替换此模式尚未交卷的进度。你也可以取消，回到首页继续原来的试卷。':'本套试卷将在开始时随机生成，确认后进入作答。'}</p><div class="dialog-meta"><b>${E(x.name)}</b><br>${mode==='full'?'60题计分 + 120题心理问卷':mode==='practice'?'随机60题 · 可逐题查看解析':'60题计分 · 统一交卷后查看解析'}<br>${x.minutes?'考试时间：'+x.minutes+'分钟，到时自动交卷':'不限时，提供悬浮时钟'}<br>抽题比例：逻辑${model.weights.logic}% · 数学${model.weights.math}% · 错句${model.weights.sentence}% · 语言${model.weights.language}%</div>${mode==='full'?'<p>心理问卷从187道原题中抽取120题，按原题顺序呈现。不计分，不生成心理测评报告。</p>':''}`,[{text:'取消'},{text:mode==='practice'?'抽题并开始练习':'开始计时',primary:true,action:()=>startNew(mode)}]);
}
function startNew(mode){
 try{session=createSession(bank,mode,model.weights,model.used,model.includeExtra);model.sessions[mode]=session;model.used=[...model.used,...session.questions.filter(q=>q.category!=='psych').map(q=>q.id)].slice(-1600);reveal=false;view='exam';reviewFilter='all';persist();render();scrollTop();}catch(err){showDialog('这组比例暂时无法组卷',`<p>${E(err.message)}</p>`);}
}
function openSession(mode){session=model.sessions[mode];if(!session)return;view='exam';reveal=false;render();scrollTop();}
function scrollTop(){window.scrollTo({top:0,behavior:'instant'});}
function navigate(to){
 if(session?.status==='running'){if(enforceTime())return;pause(session);persist();}
 session=null;reveal=false;view=to;render();scrollTop();
}
function render(){setNav();if(view==='home')renderHome();else if(view==='history')renderHistory();else if(view==='about')renderAbout();else if(session){if(session.status==='submitted')renderResult();else if(session.status==='paused')renderPaused();else renderExam();}drawClock();}
function examHeading(s){const mode=MODES[s.mode];return `<div class="exam-header"><div><span class="eyebrow">${s.mode==='practice'?'SLOW DOWN · THINK IT THROUGH':'FOCUS MODE · ONE QUESTION AT A TIME'}</span><h1>${E(mode.name)}</h1><div class="exam-meta">${s.mode==='full'?'第1—60题计分 · 第61—180题为心理问卷':'逻辑 · 数学 · 错句 · 语言'} · ${dateTime(s.createdAt)} 抽题</div></div>${mode.minutes?`<div class="timer-box ${remaining(s)<=5*60000?'urgent':''}" id="timer-box">${icon('clock',23)}<div><small>${s.status==='paused'?'计时已暂停':'剩余时间'}</small><div class="timer-display" id="timer-display" aria-label="剩余时间">${fmt(remaining(s))}</div></div></div>`:'<span class="tag orange">自由练习 · 不限时</span>'}</div>`;}
function renderPaused(){
 main.innerHTML=examHeading(session)+`<div class="pause-view"><div class="pause-illustration">${icon('pause',34)}</div><h2>先休息一下，进度已经保存。</h2><p>已完成 ${answerCount(session)}/${session.questions.length} 题。本套试卷和已选答案都会保留，${session.mode==='practice'?'准备好后继续就好。':'暂停期间不扣时间。'}</p>${session.mode!=='practice'?`<div class="pause-time">${fmt(remaining(session))}</div>`:''}<div class="btn-row"><button class="btn primary" data-action="resume">${icon('play',15)} 继续作答</button><button class="btn secondary" data-action="new" data-mode="${session.mode}">${icon('refresh',14)} 重新抽题</button></div><div class="btn-row"><button class="btn link" data-action="export">${icon('download',13)} 导出本套存档</button><button class="btn link" data-nav="home">返回模拟中心</button></div>${!storageOK?'<p style="color:#be5558">当前浏览器未能保存数据，请导出存档以保留进度。</p>':''}</div>`;
}
function numberGrid(s,isReview=false){
 const number=(q,i)=>{const answered=hasAnswer(q,s.answers[q.id]);const correct=q.category!=='psych'&&answered&&s.answers[q.id]===q.answer;return `<button class="number ${i===s.index?'active':''} ${answered?'answered':''} ${s.marks.includes(q.id)?'marked':''} ${isReview&&q.category!=='psych'?(correct?'right':answered?'wrong':'unanswered'):''}" data-action="goto" data-index="${i}" aria-label="第${i+1}题，${answered?'已答':'未答'}${s.marks.includes(q.id)?'，已标记':''}" ${i===s.index?'aria-current="step"':''}>${i+1}</button>`;};
 return `<div class="number-section">计分部分 · 1—60题</div><div class="number-grid">${s.questions.slice(0,60).map((q,i)=>number(q,i)).join('')}</div>${s.mode==='full'?`<div class="number-section">心理问卷 · 61—180题 · 不计分</div><div class="number-grid">${s.questions.slice(60).map((q,i)=>number(q,i+60)).join('')}</div>`:''}`;
}
function renderAnswerPanel(s,isReview=false){return `<aside class="answer-panel" aria-label="答题卡"><div class="answer-title"><h2>答题卡</h2><span class="answer-progress">${answerCount(s)} / ${s.questions.length}</span></div><div class="progress-track"><div class="progress-fill" style="width:${answerCount(s)/s.questions.length*100}%"></div></div><div class="legend"><span><i></i>未答</span><span><i class="done"></i>${isReview?'正确':'已答'}</span><span><i class="flagged"></i>标记</span>${isReview?'<span><i style="background:#efd7d5"></i>错误</span>':''}</div><div class="answer-scroll" id="answer-scroll">${numberGrid(s,isReview)}</div>${isReview?'':`<button class="btn primary wide" data-action="submit" ${canSubmit(s)?'':'disabled'}>${icon('check',14)}${canSubmit(s)?'全部完成，提交答卷':'还差'+(s.questions.length-answerCount(s))+'题可交卷'}</button>${canSubmit(s)?'<p class="submit-note">交卷后显示正确数、错题与解析。</p>':'<button class="btn link wide" data-action="first-unanswered">定位第一道未答题</button>'}`}</aside>`;}
function renderQuestion(s,isReview=false){
 const q=s.questions[s.index],value=s.answers[q.id],showAnalysis=(isReview||s.mode==='practice'&&reveal)&&q.category!=='psych';
 return `<section class="question-card" aria-label="第${s.index+1}题"><div class="question-heading"><span class="question-count">第 ${s.index+1} 题 <span>/ ${s.questions.length}</span></span><span class="tag ${q.category==='psych'?'orange':'blue'}">${E(CN[q.category])}</span>${q.category==='psych'?'<span class="tag">不计分</span>':''}<button class="mark-button ${s.marks.includes(q.id)?'marked':''}" data-action="mark" aria-pressed="${s.marks.includes(q.id)}">${icon('flag',12)}${s.marks.includes(q.id)?'已标记':'标记'}</button></div>${q.material?`<details class="question-material" open><summary>阅读材料</summary>${E(q.material)}</details>`:''}<div class="question-stem">${E(q.stem)}</div>${q.category==='psych'?'<p class="small muted">请根据自己的真实感受选择，不判断对错。</p>':''}<div class="options" role="group" aria-label="答案选项">${q.options.map(o=>{const chosen=value===o.key,correct=showAnalysis&&o.key===q.answer,wrong=showAnalysis&&chosen&&o.key!==q.answer;return `<button class="option ${chosen?'selected':''} ${correct?'correct':''} ${wrong?'incorrect':''}" data-answer="${E(o.key)}" ${isReview?'disabled':''} aria-pressed="${chosen}"><span class="option-letter">${E(o.key)}</span><span class="option-text">${E(o.text)}</span>${showAnalysis&&correct?'<span class="choice-status">正确答案</span>':showAnalysis&&wrong?'<span class="choice-status">你的选择</span>':chosen?`<span class="choice-status">${icon('check',14)}</span>`:''}</button>`;}).join('')}</div>${showAnalysis?`<div class="analysis"><h3>${icon('book',14)} 答案与解析</h3><div class="answer-summary"><span>正确答案：<b>${q.answer}</b></span><span>你的答案：<b class="${value!==q.answer?'bad-answer':''}">${E(value||'未作答')}</b></span></div><p>${E(q.explanation)}</p></div>`:s.mode==='practice'&&hasAnswer(q,value)?'<div style="margin-top:16px"><button class="btn secondary small-btn" data-action="reveal">查看本题解析</button></div>':''}${isReview&&q.category==='psych'?`<div class="psych-record">已记录选择：${E(value||'未作答')}。心理问卷不计分，不提供标准答案或人格结论。</div>`:''}<div class="question-source">${E(q.sourceLabel)}${q.origin==='xingce'?' · 来源：ERRRC/xingcezhenti':''}${isReview||showAnalysis?` · <a href="${E(q.sourceUrl)}" target="_blank" rel="noopener">查看原题库 ↗</a>`:''}</div><div class="question-bottom"><button class="btn secondary" data-action="prev" ${canMove(-1)?'':'disabled'}>${icon('left',13)} 上一题</button>${!isReview?'<button class="btn link" data-action="clear-answer">清除选择</button>':''}<button class="btn primary" data-action="next" ${canMove(1)?'':'disabled'}>下一题 ${icon('arrow',13)}</button></div>${!isReview&&s.index===s.questions.length-1?`<div class="submit-tip">${canSubmit(s)?'本套题目已全部作答，可以点击答题卡中的“提交答卷”。':'已到最后一题。还差'+(s.questions.length-answerCount(s))+'题未答，请通过答题卡补齐。'}</div>`:''}<div class="keyboard-note"><span class="keycap">1–${q.options.length}</span>选择答案 <span class="keycap">← →</span>切换题目 <span class="keycap">空格</span>标记本题</div></section>`;
}
function renderExam(){
 const oldScroll=document.querySelector('#answer-scroll')?.scrollTop||0;
 main.innerHTML=examHeading(session)+`<div class="exam-toolbar"><button class="btn secondary" data-action="pause">${icon('pause',13)} 暂停并存档</button><button class="btn ghost" data-action="export">${icon('download',13)} 导出存档</button><button class="btn ghost" data-nav="home">${icon('home',13)} 返回首页</button><span class="save-status" id="save-status">${storageOK?'已自动保存':'保存失败，请导出存档'}</span></div><div class="exam-layout">${renderQuestion(session)}${renderAnswerPanel(session)}</div>`;
 const scroll=document.querySelector('#answer-scroll');if(scroll)scroll.scrollTop=oldScroll;
}
function reviewIndices(){if(!session)return[];return session.questions.map((q,i)=>({q,i})).filter(({q})=>reviewFilter==='wrong'?q.category!=='psych'&&session.answers[q.id]!==q.answer:reviewFilter==='psych'?q.category==='psych':reviewFilter==='marked'?session.marks.includes(q.id):true).map(x=>x.i);}
function canMove(delta){if(!session)return false;const ids=session.status==='submitted'?reviewIndices():session.questions.map((_,i)=>i);const pos=ids.indexOf(session.index);return pos>=0&&pos+delta>=0&&pos+delta<ids.length;}
function move(delta){const ids=session.status==='submitted'?reviewIndices():session.questions.map((_,i)=>i);const p=ids.indexOf(session.index),next=ids[p+delta];if(next==null)return;session.index=next;reveal=false;persist();render();focusQuestion();}
function goto(index){if(!Number.isInteger(index)||index<0||index>=session.questions.length)return;session.index=index;reveal=false;if(session.status==='submitted'&&!reviewIndices().includes(index))reviewFilter='all';persist();render();focusQuestion();}
function focusQuestion(){if(window.innerWidth<980)document.querySelector('.question-card')?.scrollIntoView({block:'start',behavior:'instant'});}
function renderResult(){
 const s=session,g=grade(s),indices=reviewIndices();const qs=indices.length?renderQuestion(s,true):'<div class="empty"><div>'+icon('check',32)+'</div><h2>'+E(reviewFilter==='wrong'?'没有错题，继续保持。':reviewFilter==='marked'?'本套没有标记的题目。':'此部分没有题目。')+'</h2><p>可切换到“全部题目”继续回看。</p></div>';
 main.innerHTML=heading(s.mode==='practice'?'这一套，练习完成。':'交卷完成，回看才是进步的开始。',`${E(MODES[s.mode].name)} · ${dateTime(s.submittedAt)} · ${s.submitReason==='timeout'?'时间截止，自动交卷':'全部作答后提交'}`,'A MOMENT TO REFLECT')+
 `<div class="result-hero"><div class="score-ring" style="--percent:${g.percent}"><div class="score-ring-inner"><strong>${g.percent}<span style="font-size:13px">%</span></strong><small>计分题正确率</small></div></div><div class="result-main"><h2>答对 ${g.correct} / ${g.total} 题</h2><p>每题按1分统计，满分60分，为练习口径。</p><div class="result-stats"><div class="good"><strong>${g.correct}</strong>正确</div><div class="bad"><strong>${g.wrong}</strong>答错</div><div class="neutral"><strong>${g.unanswered}</strong>未答</div>${g.psychTotal?`<div><strong>${g.psychAnswered}<span style="font-size:12px">/${g.psychTotal}</span></strong>心理问卷 · 不计分</div>`:''}</div></div></div>`+
 `<div class="result-types">${g.categories.map(c=>`<div class="type-stat"><span>${CN[c.key]}</span><b>${c.correct}<span> / ${c.total} 题答对</span></b></div>`).join('')}</div>`+
 `<div class="review-title"><h2>试卷回看</h2><div class="btn-row"><button class="btn small-btn secondary" data-nav="home">返回首页</button><button class="btn small-btn primary" data-action="new" data-mode="${s.mode}">再来一套 ${icon('refresh',12)}</button></div></div><div class="review-filters">${[['all','全部题目'],['wrong',`错题与未答 (${g.incorrect})`],...(s.mode==='full'?[['psych','心理问卷']]:[]),['marked','标记题']].map(([k,t])=>`<button class="filter-btn ${reviewFilter===k?'active':''}" data-action="filter" data-filter="${k}">${t}</button>`).join('')}<span class="small muted" style="margin-left:auto">本次显示 ${indices.length} 题</span></div><div class="exam-layout">${qs}${renderAnswerPanel(s,true)}</div>`;
}
function enforceTime(){if(session?.status==='running'&&MODES[session.mode].minutes&&remaining(session)<=0){finish(true);return true;}return false;}
function finish(timeout=false){
 if(!submit(session,timeout))return false;
 const s=session;model.history=[s,...model.history.filter(x=>x.id!==s.id)].slice(0,5);delete model.sessions[s.mode];reviewFilter='all';reveal=false;persist();render();scrollTop();
 if(timeout){const g=grade(s);showDialog('时间到了，已自动交卷。',`<p>你的答案已保存。计分部分答对 ${g.correct} 题，答错 ${g.wrong} 题，未答 ${g.unanswered} 题。${s.mode==='full'?'心理问卷不计分。':''}<br>现在可以查看逐题答案与解析。</p>`);}
 return true;
}
function requestSubmit(){
 if(enforceTime())return;if(!canSubmit(session)){toast('还没有全部作答，请先补齐未答题。');return;}
 showDialog('全部完成，确认交卷？',`<p>已作答 ${session.questions.length}/${session.questions.length} 题。交卷后将显示计分题的对错与解析，无法继续修改本套答案。${session.mode==='full'?'心理问卷的120题不参与计分。':''}</p>`,[{text:'再检查一下'},{text:'确认交卷',primary:true,action:()=>{if(!enforceTime())finish(false);}}]);
}
function renderHistory(){
 main.innerHTML=heading('走过的每一套，都算数。','保留最近5次交卷的完整试卷和答案，随时回看。','YOUR RECENT JOURNEY')+`<div class="history-list">${model.history.length?model.history.map(s=>{const g=grade(s);return `<article class="history-card"><span class="recent-mark">${icon(s.mode==='practice'?'spark':'paper',20)}</span><div><h3>${E(MODES[s.mode].name)} <span class="tag ${s.mode==='practice'?'orange':'teal'}">${s.submitReason==='timeout'?'到时交卷':'已完成'}</span></h3><p>${dateTime(s.submittedAt)} · 答错 ${g.wrong} 题 · 未答 ${g.unanswered} 题${g.psychTotal?' · 心理问卷 '+g.psychAnswered+'/120':''}</p></div><div class="history-metrics"><b>${g.correct}<span style="font-size:11px;font-weight:400">/60</span></b>计分题答对</div><button class="btn secondary small-btn" data-action="history-detail" data-id="${E(s.id)}">查看解析 ${icon('arrow',12)}</button></article>`;}).join(''):`<div class="empty">${icon('history',35)}<h2>还没有完成的试卷</h2><p>完成一套模拟后，成绩和解析会留在这里。</p><button class="btn primary" data-nav="home">开始第一套模拟</button></div>`}</div><p class="tip-line">未交卷的存档在模拟中心。所有记录保存在当前浏览器，清除网站数据会移除记录。</p>`;
}
function renderAbout(){
 main.innerHTML=heading('关于题库，也关于练习。','知道题目从哪里来，才能把每一次练习用得更好。','A CLEARER PICTURE')+
 `<section class="panel about-copy"><h2>三个版本，一眼看明白</h2><table class="about-table"><thead><tr><th>版本</th><th>题量</th><th>时间</th><th>计分</th></tr></thead><tbody><tr><td>标准模拟</td><td>随机60题</td><td>60分钟</td><td>60题</td></tr><tr><td>完整模拟</td><td>随机60 + 心理120</td><td>75分钟</td><td>前60题</td></tr><tr><td>自由练习</td><td>随机60题</td><td>不限时 · 悬浮时钟</td><td>完成后统计练习结果</td></tr></tbody></table><p>考试作答期间不显示对错和解析，全部作答才可主动交卷。时间归零会直接交卷，未答题按未得分统计。练习模式作答后可逐题查看解析，整套完成后也可提交查看统计。</p><h3>每次如何抽题？</h3><p>以逻辑${model.weights.logic}%、数学${model.weights.math}%、错句${model.weights.sentence}%、语言${model.weights.language}%作为当前模拟权重，每道题先按权重抽取题型，再从该题型中选择题目。可在首页调整比例。<strong>这些比例是模拟设置，不是官方出题概率。</strong>同卷题目不重复，新卷优先选取近期未练题。某类题数不足时，从其余已选题型补足；历史不同试卷可能出现重复题。</p><h3>暂停、继续与换设备</h3><p>点击“暂停并存档”会停止计时，并保存原卷、答案和剩余时间。刷新、关闭页面会自动存档并暂停，下一次打开可继续。切换浏览器标签仍会计时。重新开始会为该模式生成新卷并替换其未完成存档。记录保存在当前浏览器；手机与电脑之间可通过“导出存档 / 导入存档”继续同一套试卷。</p></section>`+
 `<section class="panel about-copy"><h2>题库范围与来源</h2><table class="about-table"><thead><tr><th>计分题型</th><th>原有可用题数</th><th>练习额外行测题</th></tr></thead><tbody>${Object.keys(DEFAULT_WEIGHTS).map(k=>`<tr><td>${CN[k]}</td><td>${bank.stats.categories[k]}</td><td>${bank.questions.filter(q=>q.origin==='xingce'&&q.category===k).length}</td></tr>`).join('')}</tbody></table><p>模拟题合并自你提供的三个 GitHub 题库，按题干与选项去重，筛除已标记缺损、无有效答案以及不符合四选项结构的题目。保留原题与原有解析；原题库的答案仍可能存在疏漏，本站不等同于官方真题或评分标准。</p><div class="source-links"><a href="https://nishiyu0411-alt.github.io/logic-practice/" target="_blank" rel="noopener">逻辑题库 ↗</a><a href="https://nishiyu0411-alt.github.io/math/unified/" target="_blank" rel="noopener">数学与综合题库 ↗</a><a href="https://nishiyu0411-alt.github.io/word/" target="_blank" rel="noopener">词汇与语言题库 ↗</a></div><p>自由练习另含<strong>${bank.stats.extra}道上海2023、2025年行测A类补充题（网友回忆版）</strong>，来自公开整理仓库 <a href="https://github.com/ERRRC/xingcezhenti" target="_blank" rel="noopener">ERRRC/xingcezhenti</a>。选取题面和解析不依赖图片、材料完整且答案可识别的题目。原资料的“官方解析”字样为来源标注，本站未作官方认证。</p><h3>心理问卷为什么从187题中抽120题？</h3><p>你提供的卡特尔题库实际为187题，完整版按本次需要抽取120题，并按原题序排列；每份试卷的心理题在开始后固定。仅记录作答，不计分、不判断对错、不生成16PF人格结论。120题抽样用于模拟作答流程，不是完整的标准化量表施测。</p><p><a href="https://nishiyu0411-alt.github.io/word/cattell/" target="_blank" rel="noopener">卡特尔原题库 ↗</a><br>资料来源：用户提供的《职业素质卡特尔人格》练习表。原表版权标注：本测试仅授权华师优优出售；版权所有：@许翔凯。仅供个人练习。</p></section><section class="panel about-copy"><h2>存档管理</h2><p>可以导入从本网站导出的单套试卷存档。导入后会暂停，确认继续时才重新计时。</p><div class="btn-row"><button class="btn secondary" data-action="import">${icon('upload',14)} 导入试卷存档</button><button class="btn secondary" data-nav="home">返回模拟中心</button></div></section>`;
}
function exportSession(){
 if(!session)return;if(session.status==='running'&&enforceTime())return;
 const data={app:'shizonghe-exam-studio',version:1,exportedAt:Date.now(),session:snapshot(session)};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`市综合-${MODES[session.mode].short}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('存档已导出，可在另一设备导入继续。');
}
document.querySelector('#import-file').addEventListener('change',async e=>{
 const f=e.target.files[0];e.target.value='';if(!f)return;
 try{if(f.size>3000000)throw Error('存档文件过大');const d=JSON.parse(await f.text());if(d.app!=='shizonghe-exam-studio'||d.version!==1||!validateSession(d.session,bank))throw Error('无法识别这份存档，请使用本网站导出的完整存档');const imported=recover(d.session);
  showDialog('找到一份试卷存档',`<p>${E(MODES[imported.mode].name)} · 已答 ${answerCount(imported)}/${imported.questions.length} 题。${imported.mode==='practice'?'':'剩余 '+fmt(remaining(imported))+'。'}<br>${imported.status==='submitted'?'导入后可查看原有结果与解析。':'导入会替换当前同一模式的未交卷存档，随后可以继续作答。'}</p>`,[{text:'取消'},{text:'导入存档',primary:true,action:()=>{if(session?.status==='running')pause(session);session=imported;if(imported.status==='submitted'){model.history=[snapshot(imported),...model.history.filter(s=>s.id!==imported.id)].slice(0,5);}else model.sessions[imported.mode]=imported;reviewFilter='all';view='exam';reveal=false;persist();render();scrollTop();toast('存档已导入。');}}]);
 }catch(err){showDialog('存档没有导入',`<p>${E(err.message)}</p>`);}
});
function drawClock(){
 if(!session||view!=='exam'||session.mode!=='practice'||session.status!=='running'){clockRoot.innerHTML='';return;}
 if(model.clockHidden){clockRoot.innerHTML=`<button class="clock-mini" data-action="clock-show" aria-label="显示悬浮时钟">${icon('clock',21)}</button>`;return;}
 if(clockRoot.querySelector('.clock-float')){updateClock();return;}
 clockRoot.innerHTML=`<aside class="clock-float" aria-label="练习悬浮时钟"><div class="clock-title" id="clock-drag">${icon('clock',12)} 练习时钟<button class="clock-close" data-action="clock-hide" aria-label="收起时钟">${icon('close',12)}</button></div><div class="clock-time" id="clock-time"></div><div class="clock-footer"><span>${model.alarm?'提醒已设置':'本地时间 · 不限时'}</span><button data-action="set-alarm">${model.alarm?'修改提醒':'设置闹钟'}</button></div></aside>`;
 const handle=document.querySelector('#clock-drag');let drag=null;
 handle.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const el=handle.parentElement,r=el.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};handle.setPointerCapture(e.pointerId);});
 handle.addEventListener('pointermove',e=>{if(!drag)return;const el=handle.parentElement;el.style.left=Math.max(8,Math.min(window.innerWidth-el.offsetWidth-8,e.clientX-drag.x))+'px';el.style.top=Math.max(8,Math.min(window.innerHeight-el.offsetHeight-8,e.clientY-drag.y))+'px';el.style.right='auto';el.style.bottom='auto';});
 handle.addEventListener('pointerup',()=>drag=null);handle.addEventListener('pointercancel',()=>drag=null);updateClock();
}
function updateClock(){const c=document.querySelector('#clock-time');if(c)c.textContent=new Date().toLocaleTimeString('zh-CN',{hour12:false});}
function setAlarm(){
 try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();}catch{}
 const initial=new Date(model.alarm||Date.now()+30*60000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
 showDialog('给练习设一个提醒',`<p>选择提醒时间。悬浮时钟仍显示当前时间，练习不限时，也不会自动交卷。提醒需要保持本页面打开。</p><input class="dialog-time" type="time" id="alarm-time" value="${E(initial)}" aria-label="闹钟提醒时间">`,[{text:model.alarm?'取消现有提醒':'取消',action:()=>{if(model.alarm){model.alarm=null;persist();clockRoot.innerHTML='';drawClock();}}},{text:'设置提醒',primary:true,action:()=>{const v=document.querySelector('#alarm-time').value;if(!/^\d\d:\d\d$/.test(v)){toast('请选择有效的提醒时间。');return;}const [h,m]=v.split(':').map(Number),next=new Date();next.setHours(h,m,0,0);if(next.getTime()<=Date.now())next.setDate(next.getDate()+1);model.alarm=next.getTime();persist();clockRoot.innerHTML='';drawClock();toast('已设置 '+dateTime(model.alarm)+' 的提醒。');}}]);
}
function tick(){
 if(enforceTime())return;
 if(session?.status==='running'){
  const time=document.querySelector('#timer-display');if(time){const left=remaining(session);time.textContent=fmt(left);document.querySelector('#timer-box')?.classList.toggle('urgent',left<=300000);}
  if(Date.now()-lastCheckpoint>5000){persist();lastCheckpoint=Date.now();}
 }
 updateClock();
 if(model.alarm&&Date.now()>=model.alarm){model.alarm=null;persist();clockRoot.innerHTML='';drawClock();try{if(audioContext){const o=audioContext.createOscillator(),g=audioContext.createGain();o.connect(g);g.connect(audioContext.destination);o.frequency.value=720;g.gain.setValueAtTime(.08,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+1);o.start();o.stop(audioContext.currentTime+1);}}catch{}showDialog('练习提醒时间到了。','<p>先伸伸肩膀，喝口水吧。练习进度已经保存，你可以继续，或者暂停休息一下。</p>');}
}
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return;}
 const opt=e.target.closest('[data-answer]');if(opt&&session?.status==='running'){if(enforceTime())return;if(answer(session,opt.dataset.answer)){reveal=false;persist();render();}return;}
 const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
 if(['goto','prev','next','mark','clear-answer','reveal','pause','submit'].includes(a)&&session?.status==='running'&&enforceTime())return;
 if(a==='new')requestNew(b.dataset.mode);
 else if(a==='open')openSession(b.dataset.mode);
 else if(a==='pause'){pause(session);persist();render();}
 else if(a==='resume'){resume(session);persist();render();}
 else if(a==='goto')goto(Number(b.dataset.index));
 else if(a==='prev')move(-1);
 else if(a==='next')move(1);
 else if(a==='mark'){const id=session.questions[session.index].id;session.marks=session.marks.includes(id)?session.marks.filter(x=>x!==id):[...session.marks,id];persist();render();}
 else if(a==='clear-answer'&&session.status==='running'){delete session.answers[session.questions[session.index].id];reveal=false;persist();render();}
 else if(a==='reveal'){reveal=true;render();}
 else if(a==='submit')requestSubmit();
 else if(a==='first-unanswered'){const i=session.questions.findIndex(q=>!hasAnswer(q,session.answers[q.id]));if(i>=0)goto(i);}
 else if(a==='save-weights'){if(readWeights())toast('抽题比例已保存，新试卷将使用这个比例。');}
 else if(a==='reset-weights'){model.weights={...DEFAULT_WEIGHTS};persist();renderHome();document.querySelector('.weights-panel').open=true;toast('已恢复默认模拟比例。');}
 else if(a==='export')exportSession();
 else if(a==='import')document.querySelector('#import-file').click();
 else if(a==='filter'){reviewFilter=b.dataset.filter;const ids=reviewIndices();if(ids.length&&!ids.includes(session.index))session.index=ids[0];render();}
 else if(a==='history-detail'){const found=model.history.find(x=>x.id===b.dataset.id);if(found){session=found;view='exam';reviewFilter='all';reveal=false;render();scrollTop();}}
 else if(a==='clock-hide'){model.clockHidden=true;persist();drawClock();}
 else if(a==='clock-show'){model.clockHidden=false;persist();drawClock();}
 else if(a==='set-alarm')setAlarm();
});
document.addEventListener('input',e=>{if(e.target.id.startsWith('weight-')){const n=Object.keys(DEFAULT_WEIGHTS).reduce((s,k)=>s+Number(document.querySelector('#weight-'+k).value),0);const t=document.querySelector('#weights-total');t.textContent='合计 '+n+'%';t.style.color=n===100?'':'#b47c63';}});
document.addEventListener('change',e=>{if(e.target.id==='include-extra'){model.includeExtra=e.target.checked;persist();}});
document.addEventListener('keydown',e=>{
 if(!session||view!=='exam'||session.status==='paused'||dialog.open||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,summary'))return;
 if(session.status==='running'&&enforceTime())return;
 if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}
 else if(/^[1-4a-dA-D]$/.test(e.key)&&session.status==='running'){const letter=/^[1-4]$/.test(e.key)?'ABCD'[Number(e.key)-1]:e.key.toUpperCase();e.preventDefault();if(answer(session,letter)){reveal=false;persist();render();}}
 else if(e.code==='Space'&&!e.target.closest('button,a')){e.preventDefault();document.querySelector('[data-action="mark"]')?.click();}
});
function leaving(){if(session?.status==='running'){pause(session);persist();}}
window.addEventListener('pagehide',leaving);window.addEventListener('beforeunload',leaving);window.addEventListener('pageshow',e=>{if(e.persisted&&session){render();}});
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();navigate('home');});
document.querySelector('#nav-home-icon').innerHTML=icon('grid',17);document.querySelector('#nav-history-icon').innerHTML=icon('history',17);document.querySelector('#nav-about-icon').innerHTML=icon('book',17);
window.__EXAM_READY__=true;persist();render();setInterval(tick,250);
