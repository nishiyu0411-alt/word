(function(){
'use strict';
const D=window.CATTELL_DATA,C=window.CattellCore;
if(!D||!C){document.getElementById('saveStatus').textContent='题库未能加载，请刷新页面。';return;}
const KEY='shiyu-cattell-16pf-v1',CODE_KEY=KEY+'-sync-code';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
let state=C.fresh(),view='practice',reportSource='practice',toastTimer,nextTimer,timerMark=Date.now(),confirmResolve=null,syncTimer,syncBusy=false,syncAgain=false,connectedCode='',syncError=false,storageOK=true,syncGeneration=0;
let code='';
try{const saved=localStorage.getItem(KEY);if(saved)state=C.clean(JSON.parse(saved));code=localStorage.getItem(CODE_KEY)||'';}catch(e){storageOK=false;}
const time=()=>Date.now();
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function persist(schedule=true){
  state.updatedAt=time();
  try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch(e){storageOK=false;}
  $('#saveStatus').textContent=storageOK?'已自动保存到本机 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'本机存储不可用，请导出进度备份';
  $('.saved-dot').style.background=storageOK?'#8db5a7':'#d7ac78';
  $('#overallDone').textContent=C.answered(state.practice.answers);
  if(schedule&&connectedCode){clearTimeout(syncTimer);syncTimer=setTimeout(()=>synchronize(),1500);}
}
function writeRaw(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){storageOK=false;}}
function confirmAction(title,message,accept='确定'){
  return new Promise(resolve=>{
    $('#confirmTitle').textContent=title;$('#confirmText').textContent=message;$('#confirmAccept').textContent=accept;confirmResolve=resolve;$('#confirmDialog').showModal();
  });
}
function finishConfirm(value){if(!confirmResolve)return;const resolve=confirmResolve;confirmResolve=null;$('#confirmDialog').close();resolve(value);}
$('#confirmAccept').onclick=()=>finishConfirm(true);$('#confirmCancel').onclick=()=>finishConfirm(false);
$('#confirmDialog').addEventListener('cancel',e=>{e.preventDefault();finishConfirm(false);});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){if(d.id==='confirmDialog')finishConfirm(false);else d.close();}}}));
function favorite(id){return state.favorites[id]?.value===true;}
function starIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>';}
const checkIcon='<svg class="option-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
function rangeIds(range){
  if(range==='unanswered')return C.ids.filter(id=>!C.answerValue(state.practice.answers,id));
  if(range==='favorites')return C.ids.filter(favorite);
  if(range==='objective')return D.questions.filter(q=>q.factor==='B').map(q=>q.id);
  if(range==='wrong')return C.wrongIds(D,state.practice.answers);
  if(range==='review')return D.questions.filter(q=>q.note).map(q=>q.id);
  return [...C.ids];
}
const ranges=[['all','全部题目','▦'],['unanswered','尚未作答','◷'],['favorites','我的收藏','☆'],['objective','聪慧性题','◇'],['wrong','错题回练','↺'],['review','计分待核对','!']];
function buildSession(range=state.practice.session.range,factor=state.practice.session.factor,shuffle=false){
  let ids=rangeIds(range).filter(id=>factor==='all'||D.questions[id-1].factor===factor);
  if(shuffle)for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  state.practice.session={ids,index:0,range,factor,retry:range==='wrong',responses:{}};state.practice.modifiedAt=time();persist();renderPractice();
}
$('#factorSelect').innerHTML+='<option value="none">作答确认（不计分）</option>'+D.factors.map(f=>`<option value="${f.code}">${f.code} · ${esc(f.name)}</option>`).join('');
$('#factorSelect').onchange=e=>{const factor=e.target.value;if(factor==='none'){const ids=D.questions.filter(q=>!q.factor).map(q=>q.id);state.practice.session={ids,index:0,range:'all',factor:'none',retry:false,responses:{}};state.practice.modifiedAt=time();persist();renderPractice();}else buildSession(state.practice.session.range,factor);};
$('#rangeButtons').onclick=e=>{const button=e.target.closest('[data-range]');if(button)buildSession(button.dataset.range,'all');};
$('#shuffleButton').onclick=()=>{const s=state.practice.session;if(s.factor==='none'){s.ids.sort(()=>Math.random()-.5);s.index=0;state.practice.modifiedAt=time();persist();renderPractice();}else buildSession(s.range,s.factor,true);toast('已随机排列，原题号保持不变');};
$('#sequenceButton').onclick=()=>{const s=state.practice.session;s.ids.sort((a,b)=>a-b);s.index=0;state.practice.modifiedAt=time();persist();renderPractice();toast('已按原表题号排序');};
function questionHTML(q,index,total,answers,exam=false,retry=false){
  const selected=C.answerValue(answers,q.id),f=D.factors.find(x=>x.code===q.factor);
  const reveal=!exam&&selected&&state.settings.showScoring;
  const label=q.factor?(q.factor==='B'?'聪慧性题':f.name):'作答确认';
  const progress=total?Math.round((index+1)/total*100):0;
  let feedback='';
  if(selected&&!exam){
    if(!q.factor)feedback='<div class="feedback"><strong>已记录你的选择。</strong>本题不计入人格因素得分。</div>';
    else if(reveal&&q.note)feedback=`<div class="feedback warn"><strong>本题计分待核对</strong><p>${esc(q.note)}</p><p>你的选择：${selected} · 按原表公式计 ${q.scores[selected]} 分。</p></div>`;
    else if(reveal&&q.factor==='B')feedback=`<div class="feedback ${selected===q.sourceAnswer?'good':'error'}"><strong>${selected===q.sourceAnswer?'与你的选择一致':'已按原表核对'}</strong><p>原表计分答案：${q.sourceAnswer} · 你的选择：${selected} · 本题 ${q.scores[selected]} 分。</p></div>`;
    else if(reveal)feedback=`<div class="feedback"><strong>已记录：${selected} · ${esc(f.name)} ${q.scores[selected]} 分</strong><p>本题属于人格自述题，分值表示该因素的计分方向。</p>${q.scoringNote?`<p>${esc(q.scoringNote)}</p>`:''}</div>`;
    else feedback='<div class="feedback"><strong>选择已保存。</strong>可以继续下一题，或在设置中打开选项计分。</div>';
  }
  return `<div class="question-top"><span class="badge">${exam?'完整测验':retry?'错题回练':'日常练习'}</span><span class="badge ${q.factor==='B'?'blue':'pink'}">${esc(label)}</span><span class="question-progress">${index+1} / ${total}</span></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><div class="stem-row"><span class="question-number">${String(q.id).padStart(2,'0')}.</span><h2 class="question-stem">${esc(q.stem)}</h2><button class="favorite-button ${favorite(q.id)?'active':''}" data-favorite="${q.id}" aria-label="${favorite(q.id)?'取消收藏':'收藏本题'}" aria-pressed="${favorite(q.id)}">${starIcon()}</button></div><p class="question-subtitle">${exam?'请选择一个选项，交卷前可随时修改。':q.factor==='B'?'根据题意选择；答案核对以所给练习表为准。':q.factor?'选择最符合你平时真实情况的一项。':'按你的实际情况选择。'}</p><div class="options" role="group" aria-label="选项">${['A','B','C'].map((key,i)=>`<button class="option ${selected===key?'selected':''}" data-answer="${key}" aria-pressed="${selected===key}" aria-label="${key} ${esc(q.options[key])}"><span class="option-letter">${key}</span><span class="option-text">${esc(q.options[key])}</span>${reveal&&q.scores?`<span class="option-score">${q.scores[key]} 分</span>`:''}${selected===key?checkIcon:''}</button>`).join('')}</div>${feedback}<div class="question-footer"><button class="secondary" data-move="-1" ${index===0?'disabled':''}>上一题</button><button class="text-link" data-clear-answer ${!selected?'disabled':''}>清除此题选择</button><span class="shortcuts"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>作答 · 空格收藏</span><button class="primary" data-move="1" ${index===total-1?'disabled':''}>下一题 <span aria-hidden="true">→</span></button></div>`;
}
function paletteHTML(ids,index,answers){return ids.map((id,i)=>`<button class="palette-button ${C.answerValue(answers,id)?'answered':''} ${i===index?'current':''} ${favorite(id)?'starred':''}" data-index="${i}" aria-label="第${id}题${C.answerValue(answers,id)?'，已作答':''}${favorite(id)?'，已收藏':''}" ${i===index?'aria-current="true"':''}>${id}</button>`).join('');}
function renderRanges(){
  $('#rangeButtons').innerHTML=ranges.map(([id,name,symbol])=>`<button class="range-button ${state.practice.session.range===id?'active':''}" data-range="${id}" aria-pressed="${state.practice.session.range===id}"><span class="range-symbol" aria-hidden="true">${symbol}</span>${name}<span class="count">${rangeIds(id).length}</span></button>`).join('');
  $('#factorSelect').value=state.practice.session.factor;
}
function practiceAnswers(){const s=state.practice.session;return s.retry?s.responses:state.practice.answers;}
function renderPractice(){
  renderRanges();const s=state.practice.session;const id=s.ids[s.index];const q=D.questions[id-1];
  if(q)$('#practiceCard').innerHTML=questionHTML(q,s.index,s.ids.length,practiceAnswers(),false,s.retry);
  else $('#practiceCard').innerHTML=`<div class="empty-state"><div class="empty-symbol" aria-hidden="true">◇</div><h2>这里暂时没有题目</h2><p>${s.range==='wrong'?'错题回练仅收录已核对的聪慧性题。人格自述题与待核对题不判错。':'换一个范围，或先收藏几道想复习的题。'}</p><button class="primary" data-show-all>回到全部题目</button></div>`;
  $('#practicePalette').innerHTML=paletteHTML(s.ids,s.index,practiceAnswers());
  $('#poolDescription').textContent=s.retry?`本轮 ${s.ids.length} 道题 · 回练时隐藏上次选择`:`本轮 ${s.ids.length} 道题 · 保留原表题号`;
  $('#overallDone').textContent=C.answered(state.practice.answers);
}
function toggleFavorite(id){state.favorites[id]={value:!favorite(id),at:time()};persist();if(view==='exam')renderExam();else if(view==='practice')renderPractice();toast(favorite(id)?'已加入收藏':'已取消收藏');}
function selectAnswer(value){
  clearTimeout(nextTimer);
  if(view==='exam'){
    if(!state.exam||state.exam.completedAt)return;const id=state.exam.index+1;state.exam.answers[id]={value,at:time()};state.exam.modifiedAt=time();persist();renderExam();return;
  }
  if(view!=='practice')return;const s=state.practice.session,id=s.ids[s.index];if(!id)return;
  state.practice.answers[id]={value,at:time()};if(s.retry)s.responses[id]={value,at:time()};state.practice.modifiedAt=time();persist();renderPractice();
  if(state.settings.autoNext&&s.index<s.ids.length-1)nextTimer=setTimeout(()=>moveQuestion(1),state.settings.showScoring?850:250);
}
function clearAnswer(){
  if(view==='practice'){
    const s=state.practice.session,id=s.ids[s.index];if(!id)return;state.practice.answers[id]={value:null,at:time()};s.responses[id]={value:null,at:time()};state.practice.modifiedAt=time();persist();renderPractice();
  }else if(view==='exam'&&state.exam&&!state.exam.completedAt){state.exam.answers[state.exam.index+1]={value:null,at:time()};state.exam.modifiedAt=time();persist();renderExam();}
}
function moveQuestion(delta){
  clearTimeout(nextTimer);
  if(view==='practice'){const s=state.practice.session;s.index=Math.max(0,Math.min(s.ids.length-1,s.index+delta));state.practice.modifiedAt=time();persist();renderPractice();}
  else if(view==='exam'&&state.exam&&!state.exam.completedAt){state.exam.index=Math.max(0,Math.min(186,state.exam.index+delta));state.exam.modifiedAt=time();persist();renderExam();}
}
function jumpQuestion(index){clearTimeout(nextTimer);if(view==='practice'){state.practice.session.index=index;state.practice.modifiedAt=time();persist();renderPractice();}else if(view==='exam'&&state.exam&&!state.exam.completedAt){state.exam.index=index;state.exam.modifiedAt=time();persist();renderExam();}const card=view==='exam'?$('#examQuestion'):$('#practiceCard');if(window.innerWidth<741)card?.scrollIntoView({behavior:'smooth',block:'start'});}
function elapsedLabel(ms){const seconds=Math.floor(ms/1000),m=Math.floor(seconds/60),s=seconds%60;return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
function tickExam(){const now=time();if(view==='exam'&&state.exam&&!state.exam.completedAt&&!document.hidden){state.exam.elapsed+=Math.max(0,now-timerMark);const node=$('#examTimer');if(node)node.textContent=elapsedLabel(state.exam.elapsed);}timerMark=now;}
function renderExam(){
  const e=state.exam;
  if(!e||e.completedAt){$('#examView').innerHTML=`<section class="panel exam-start"><span class="badge blue">完整测验</span><h2>${e?'上一轮已完成，开启新一轮':'用一轮完整作答，熟悉整套题'}</h2><p>按照原表顺序完成 187 题，作答过程中隐藏因素计分。可以暂时离开并在下次继续；计时只累计本页前台作答时间。</p><div class="exam-features"><div><strong>187</strong>原表顺序出题</div><div><strong>自动保存</strong>每一题记录进度</div><div><strong>16 项</strong>交卷后查看报告</div></div><div class="settings-row"><button class="primary" data-start-exam>${e?'开始新一轮':'开始完整测验'}</button>${e?'<button class="secondary" data-exam-report>查看上轮报告</button>':''}</div><p class="muted">完整测验与日常练习分别保存，不会覆盖你的练习选择。</p></section>`;return;}
  const done=C.answered(e.answers);
  $('#examView').innerHTML=`<section class="panel exam-toolbar"><div><h2>完整测验进行中</h2><p>已完成 ${done} / 187 题 · 切换页面时暂停计时</p></div><div class="timer" id="examTimer" aria-label="累计作答时间">${elapsedLabel(e.elapsed)}</div><button class="primary" data-submit-exam>交卷</button></section><div class="exam-grid"><section id="examQuestion" class="panel question-card">${questionHTML(D.questions[e.index],e.index,187,e.answers,true)}</section><section class="panel palette-panel"><div class="palette-heading"><div><h2>测验答题卡</h2><p>点击题号检查或补答</p></div><div class="legend"><span><i class="answered"></i>已作答</span></div></div><div class="palette" aria-label="测验题号">${paletteHTML(C.ids,e.index,e.answers)}</div><button class="text-link" data-first-missing style="margin-top:16px">跳到首道未答题</button></section></div>`;
}
async function startExam(){
  if(state.exam&&!await confirmAction('开始新一轮测验','上一轮测验记录将被替换。日常练习与收藏保留。','开始新一轮'))return;
  state.exam={answers:{},startedAt:time(),elapsed:0,index:0,completedAt:null,modifiedAt:time()};timerMark=time();persist();renderExam();
}
async function submitExam(){
  const e=state.exam;if(!e||e.completedAt)return;const missing=C.ids.filter(id=>!C.answerValue(e.answers,id));
  if(missing.length){toast(`还有 ${missing.length} 题未作答，已跳到第 ${missing[0]} 题`);jumpQuestion(missing[0]-1);return;}
  if(!await confirmAction('提交本轮测验','187 题均已作答。交卷后生成各因素报告，本轮选择将保留用于查阅。','确认交卷'))return;
  tickExam();e.completedAt=time();e.modifiedAt=time();persist();reportSource='exam';setView('report');
}
const summaries={A:['偏向独处，做事更关注事物','热情乐群，愿意与人合作'],B:['原表计分较低','原表计分较高'],C:['情绪较易受到环境影响','情绪较稳定，沉着应对困难'],E:['谦逊顺从，较愿意通融','独立积极，主见较强'],F:['严肃审慎，偏向内省','轻松活泼，善于表达'],G:['行为较灵活随性','做事尽职，有恒负责'],H:['交往较谨慎，倾向观望','敢于尝试，较少畏缩'],I:['偏向理智，重视现实','感受细腻，较易受感动'],L:['信赖随和，易与人合作','对他人较谨慎，容易怀疑'],M:['重视实际条件，注重可行性','重视想象，主观兴趣较强'],N:['坦白直率，表达直接','处世老练，注意表达分寸'],O:['沉着自信，较有安全感','较多忧虑，容易自我担心'],Q1:['重视传统，偏好熟悉方式','愿意探索，尝试新的思路'],Q2:['倾向共同工作，重视支持','倾向独立作主，自行完成工作'],Q3:['行为约束较少，重视随性','自律严谨，注意言行一致'],Q4:['较为放松，内心平和','较易紧张，感到催促与不安']};
function issueHTML(){return `<p>第 1、2、187 题不计分，其余 184 题按原表实际 Excel 公式汇总。这里不计算“招录合格分”。</p><p>第 127、153 题原表计分键存在疑点，已标记待核对，不收入错题回练。</p><p>第 ${D.scoreConflicts.map(x=>x.id).join('、')} 题的 A 选项，在原表公式中计 1 分，在分值表中计 0 分。本页面沿用公式计分。</p><p>男性忧虑性（O）常模未覆盖原始分 19 分，遇到该分数显示“原表未给出”。低、中、高评级单独沿用报告页公式，可能与常模分段不完全一致。</p>`;}
function renderReport(){
  const exam=reportSource==='exam';const answers=exam?(state.exam?.answers||{}):state.practice.answers;
  const count=C.answered(answers),finished=count===187,sex=state.settings.sex;const rows=C.report(D,answers,sex);
  const note=!finished?`已作答 ${count} / 187 题。完成整套作答后，再按所选常模换算标准分与评级。未答题不会按 0 分生成结论。`:!sex?'已完成整套作答。选择“男常模”或“女常模”，查看原表标准分与评级。':'已按所选原表常模换算。标准分反映该因素的相对位置，各因素高低没有统一的优劣次序。';
  $('#reportView').innerHTML=`<div class="report-heading"><div><h2>${exam?'完整测验报告':'日常练习报告'}</h2><p>${exam&&state.exam?`累计作答 ${elapsedLabel(state.exam.elapsed)} · `:''}依照所给练习表记录与换算</p></div><div class="report-controls"><select id="reportSource" aria-label="报告数据来源"><option value="practice" ${!exam?'selected':''}>日常练习记录</option><option value="exam" ${exam?'selected':''} ${!state.exam?'disabled':''}>完整测验记录</option></select><select id="normSex" aria-label="选择原表常模"><option value="">选择原表常模</option><option value="female" ${sex==='female'?'selected':''}>女常模</option><option value="male" ${sex==='male'?'selected':''}>男常模</option></select><button class="secondary" id="downloadReport">导出报告</button></div></div><div class="report-note">${esc(note)}</div><div class="report-summary"><div class="summary-chip"><strong>${count} / 187</strong>已作答</div><div class="summary-chip"><strong>${rows.filter(x=>x.complete).length} / 16</strong>因素题目已齐</div><div class="summary-chip"><strong>${D.questions.filter(q=>q.note&&C.answerValue(answers,q.id)).length}</strong>道计分待核对题</div></div><div class="factor-grid">${rows.map(r=>`<section class="panel factor-card"><div class="factor-heading"><span class="factor-code">${r.code}</span><div><h3>${esc(r.name)}</h3><small>已作答 ${r.done} / ${r.total} 题</small></div><div class="factor-score"><strong>${r.raw}</strong><small> / ${r.max}</small></div></div><div class="factor-bar" role="img" aria-label="${esc(r.name)}${r.standard?'标准分'+r.standard+'，满刻度10':'原始累计分'+r.raw+'，本维度满分'+r.max}"><span style="width:${r.standard?r.standard*10:r.raw/r.max*100}%"></span></div><div class="factor-detail"><span>原始${finished?'分':'累计分'} ${r.raw} / ${r.max}</span><span>${r.canRate?(r.normGap?'标准分：原表未给出':'标准分 '+r.standard+' / 10')+' · 原表评级 '+r.level:finished?'选择常模后换算':'整套完成后换算'}</span></div><p class="factor-description"><strong>原表两端含义</strong><br>低分端：${summaries[r.code][0]}<br>高分端：${summaries[r.code][1]}</p></section>`).join('')}</div><details class="panel report-issues"><summary>查看原表计分差异与资料说明</summary>${issueHTML()}<p>本页用于练习所给题型。表内描述与常模不作为心理诊断，也不代表上海考试官方评分标准。</p></details>`;
  $('#reportSource').onchange=e=>{reportSource=e.target.value;renderReport();};
  $('#normSex').onchange=e=>{state.settings.sex=e.target.value;state.settingsAt=time();persist();renderReport();};
  $('#downloadReport').onclick=downloadReport;
}
function setView(next){
  clearTimeout(nextTimer);tickExam();view=next;timerMark=time();
  for(const name of ['practice','exam','report'])$('#'+name+'View').hidden=name!==view;
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
  if(view==='practice')renderPractice();else if(view==='exam')renderExam();else renderReport();
  writeRaw();
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.addEventListener('click',e=>{
  const target=e.target.closest('button');if(!target||target.disabled)return;
  if(target.dataset.favorite)toggleFavorite(Number(target.dataset.favorite));
  else if(target.dataset.answer)selectAnswer(target.dataset.answer);
  else if(target.dataset.move)moveQuestion(Number(target.dataset.move));
  else if(target.dataset.index!==undefined)jumpQuestion(Number(target.dataset.index));
  else if(target.hasAttribute('data-clear-answer'))clearAnswer();
  else if(target.hasAttribute('data-show-all'))buildSession('all','all');
  else if(target.hasAttribute('data-start-exam'))startExam();
  else if(target.hasAttribute('data-submit-exam'))submitExam();
  else if(target.hasAttribute('data-exam-report')){reportSource='exam';setView('report');}
  else if(target.hasAttribute('data-first-missing')){const id=C.ids.find(id=>!C.answerValue(state.exam?.answers,id));if(id)jumpQuestion(id-1);else toast('全部题目都已作答');}
});
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target.closest('input,select,textarea,[contenteditable="true"]'))return;
  if(!['practice','exam'].includes(view))return;
  if(view==='exam'&&(!state.exam||state.exam.completedAt))return;
  const key=e.key.toUpperCase();const val={'1':'A','2':'B','3':'C',A:'A',B:'B',C:'C'}[key];
  if(val){e.preventDefault();selectAnswer(val);}else if(e.key==='ArrowRight'){e.preventDefault();moveQuestion(1);}else if(e.key==='ArrowLeft'){e.preventDefault();moveQuestion(-1);}else if(e.code==='Space'&&!e.target.closest('button,a')){e.preventDefault();const id=view==='exam'?state.exam.index+1:state.practice.session.ids[state.practice.session.index];if(id)toggleFavorite(id);}
});
$('#resumeButton').onclick=()=>{setView('practice');toast('已回到上次练习位置');};
$('#settingsButton').onclick=()=>{$('#showScoring').checked=state.settings.showScoring;$('#autoNext').checked=state.settings.autoNext;$('#syncCode').value=code;$('#settingsDialog').showModal();};
$('#showScoring').onchange=e=>{state.settings.showScoring=e.target.checked;state.settingsAt=time();persist();if(view==='practice')renderPractice();};
$('#autoNext').onchange=e=>{state.settings.autoNext=e.target.checked;state.settingsAt=time();persist();};
function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#exportButton').onclick=()=>{tickExam();persist(false);download('卡特尔人格练习_进度_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2));toast('进度文件已导出');};
$('#importButton').onclick=()=>$('#importFile').click();
$('#importFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>3*1024*1024)throw new Error('进度文件超过 3 MB');const imported=C.clean(JSON.parse(await file.text()));state=C.merge(state,imported);persist();setView(view);toast('进度已合并导入');}catch(error){toast(error.message==='请选择本应用导出的进度文件'?error.message:'无法导入，请选择本应用导出的有效 JSON 进度文件');}};
$('#clearButton').onclick=async()=>{
  if(!await confirmAction('清空本机全部记录','本机作答、收藏和完整测验记录将被删除，并断开同步。云端备份保留，可先导出本机进度。','清空本机记录'))return;
  clearTimeout(syncTimer);clearTimeout(nextTimer);syncGeneration++;connectedCode='';code='';state=C.fresh();try{localStorage.removeItem(KEY);localStorage.removeItem(CODE_KEY);}catch(e){}$('#syncCode').value='';$('#syncStatus').textContent='已清空本机记录，并断开同步。';$('#settingsDialog').close();setView('practice');$('#saveStatus').textContent='本机记录已清空';toast('已清空本机全部记录');
};
function downloadReport(){
  const answers=reportSource==='exam'?(state.exam?.answers||{}):state.practice.answers;const rows=C.report(D,answers,state.settings.sex);
  const lines=['卡特尔16PF人格练习报告','来源：'+(reportSource==='exam'?'完整测验':'日常练习'),'已作答：'+C.answered(answers)+'/187','常模：'+({female:'女',male:'男'}[state.settings.sex]||'未选择'),'计分：原表 Excel 实际公式',''];
  for(const r of rows)lines.push(`${r.code} ${r.name}｜原始累计分 ${r.raw}/${r.max}｜已答 ${r.done}/${r.total}｜标准分 ${r.canRate?(r.standard??'原表未给出'):'待整套完成并选择常模'}｜评级 ${r.level??'待换算'}`);
  lines.push('','资料差异：第127、153题计分待核对；12题公式与分值表不一致，沿用公式；男性O原始分19无对应标准分。','本页用于练习所给题型，不设招录合格分，不作为心理诊断。');
  download('卡特尔人格练习_报告.txt','\uFEFF'+lines.join('\n'),'text/plain;charset=utf-8');
}
$('#sourceContent').innerHTML=`<section><h3>题库内容</h3><p>共 187 题、16 个人格因素，保留上传文件的题目、选项、原题号与计分方向。人格自述题按真实情况选择；聪慧性题目的核对依据是原表计分键。</p><p>这份页面是所给练习资料的网页化版本，不代表上海考试官方题库或评分标准。</p></section><section><h3>原表差异已保留并标记</h3>${issueHTML()}</section><section><h3>原表来源</h3><p class="filename">${esc(D.source.filename)}</p>${D.source.attribution.map(s=>`<p>${esc(s)}</p>`).join('')}</section>`;
$('#sourceButton').onclick=()=>$('#sourceDialog').showModal();
const encoder=new TextEncoder(),decoder=new TextDecoder();
const b64=bytes=>btoa(String.fromCharCode(...bytes));
const from64=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
async function cloudId(secret){const digest=await crypto.subtle.digest('SHA-256',encoder.encode('cattell-16pf:v1:'+secret));return 'cattell:v1:'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
async function cryptoKey(secret,salt){const material=await crypto.subtle.importKey('raw',encoder.encode(secret),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function encryptState(secret,payload){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const key=await cryptoKey(secret,salt);const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(payload)));return {app:C.APP,encrypted:1,salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))};}
async function decryptState(secret,envelope){if(envelope?.app!==C.APP||envelope.encrypted!==1)throw new Error('同步记录格式无法识别');const salt=from64(envelope.salt),iv=from64(envelope.iv);if(salt.length!==16||iv.length!==12||envelope.ciphertext.length>4000000)throw new Error('同步记录格式无法识别');const key=await cryptoKey(secret,salt);const result=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,from64(envelope.ciphertext));return C.clean(JSON.parse(decoder.decode(result)));}
function cloudHeaders(){const config=window.CATTELL_SYNC_CONFIG;return {'apikey':config.key,...(config.key.startsWith('sb_publishable_')?{}:{'Authorization':'Bearer '+config.key}),'Content-Type':'application/json'};}
async function cloudFetch(url,options={}){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),14000);try{const r=await fetch(url,{...options,signal:controller.signal});if(!r.ok)throw new Error('同步服务暂不可用（'+r.status+'）');return r;}finally{clearTimeout(timeout);}}
async function synchronize(secret=connectedCode,manual=false){
  if(!secret)return false;
  if(syncBusy){syncAgain=true;return false;}
  if(!crypto.subtle||!window.CATTELL_SYNC_CONFIG?.url){$('#syncStatus').textContent='当前环境无法连接同步，请使用进度导入导出。';return false;}
  const generation=syncGeneration;syncBusy=true;$('#syncStatus').textContent='正在合并两端进度…';$('#syncConnect').disabled=true;
  try{
    const id=await cloudId(secret),base=window.CATTELL_SYNC_CONFIG.url+'/rest/v1/quiz_sync';
    const read=await cloudFetch(base+'?sync_code=eq.'+encodeURIComponent(id)+'&select=state,updated_at&limit=1',{headers:cloudHeaders()});const rows=await read.json();
    if(generation!==syncGeneration)return false;
    if(rows.length){const remote=await decryptState(secret,rows[0].state);if(generation!==syncGeneration)return false;state=C.merge(state,remote);writeRaw();}
    const payload=await encryptState(secret,state);
    if(generation!==syncGeneration)return false;
    await cloudFetch(base+'?on_conflict=sync_code',{method:'POST',headers:{...cloudHeaders(),Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({sync_code:id,state:payload,updated_at:new Date().toISOString()})});
    if(generation!==syncGeneration)return false;
    connectedCode=secret;code=secret;try{localStorage.setItem(CODE_KEY,secret);}catch(e){}syncError=false;
    $('#syncStatus').textContent='已同步 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})+' · 记录已加密';
    $('#saveStatus').textContent='本机已保存 · 跨设备同步已连接';
    $('#overallDone').textContent=C.answered(state.practice.answers);if(view==='practice')renderPractice();else if(view==='report')renderReport();else renderExam();
    if(manual)toast('两端进度已合并同步');return true;
  }catch(error){syncError=true;$('#syncStatus').textContent='同步未完成，本机记录已保留。'+(error.name==='OperationError'?'记录无法解密，请核对同步码或使用备份。':'请稍后重试或使用导出进度。');if(manual)toast('同步未完成，本机进度仍已保存');return false;
  }finally{syncBusy=false;$('#syncConnect').disabled=false;if(syncAgain){syncAgain=false;clearTimeout(syncTimer);syncTimer=setTimeout(()=>synchronize(),1500);}}
}
$('#syncForm').onsubmit=async e=>{e.preventDefault();const secret=$('#syncCode').value.trim();if(secret.length<8){toast('同步码至少需要 8 位');return;}await synchronize(secret,true);};
$('#syncNow').onclick=()=>{if(!connectedCode){toast('请先输入同步码并连接');return;}synchronize(connectedCode,true);};
$('#disconnectSync').onclick=()=>{clearTimeout(syncTimer);syncGeneration++;connectedCode='';code='';try{localStorage.removeItem(CODE_KEY);}catch(e){}$('#syncCode').value='';$('#syncStatus').textContent='已断开本机同步，现有本机记录保留。';toast('已断开本机同步');};
document.addEventListener('visibilitychange',()=>{tickExam();writeRaw();if(!document.hidden&&connectedCode)synchronize();});
window.addEventListener('pagehide',()=>{tickExam();writeRaw();});
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){try{state=C.merge(state,C.clean(JSON.parse(e.newValue)));if(view==='practice')renderPractice();else if(view==='report')renderReport();}catch(error){}}});
setInterval(()=>{tickExam();if(view==='exam'&&state.exam&&!state.exam.completedAt)writeRaw();},1000);
setView('practice');$('#overallDone').textContent=C.answered(state.practice.answers);
if(!storageOK)$('#saveStatus').textContent='本机存储不可用，请导出进度备份';
if(code)synchronize(code);
})();
