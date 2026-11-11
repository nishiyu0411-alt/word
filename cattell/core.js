(function(root){
  'use strict';
  const APP='cattell-16pf';
  const ids=Array.from({length:187},(_,i)=>i+1);
  const validId=x=>Number.isInteger(Number(x))&&Number(x)>=1&&Number(x)<=187;
  const validAnswer=x=>['A','B','C'].includes(x);
  function fresh(){return {app:APP,version:1,practice:{answers:{},session:{ids:[...ids],index:0,range:'all',factor:'all',retry:false,responses:{}},modifiedAt:0},favorites:{},exam:null,settings:{showScoring:true,autoNext:false,sex:''},settingsAt:0,updatedAt:0};}
  function records(value,type='answer'){
    const out={};if(!value||typeof value!=='object'||Array.isArray(value))return out;
    for(const [id,r] of Object.entries(value)){
      if(!validId(id)||!r||typeof r!=='object'||!Number.isFinite(r.at)||r.at<0)continue;
      if(type==='favorite'?typeof r.value==='boolean':(validAnswer(r.value)||r.value===null))out[Number(id)]={value:r.value,at:r.at};
    }return out;
  }
  function clean(value){
    if(!value||value.app!==APP||value.version!==1)throw new Error('请选择本应用导出的进度文件');
    const out=fresh();out.practice.answers=records(value.practice?.answers);out.favorites=records(value.favorites,'favorite');
    const session=value.practice?.session;
    if(session&&Array.isArray(session.ids)){
      const cleaned=[...new Set(session.ids.filter(validId).map(Number))];
      out.practice.session={ids:cleaned,index:Math.min(Math.max(0,Math.floor(Number(session.index)||0)),Math.max(0,cleaned.length-1)),range:['all','unanswered','favorites','objective','wrong','review'].includes(session.range)?session.range:'all',factor:typeof session.factor==='string'?session.factor.slice(0,5):'all',retry:session.range==='wrong',responses:records(session.responses)};
    }
    out.practice.modifiedAt=Number.isFinite(value.practice?.modifiedAt)?value.practice.modifiedAt:0;
    if(value.exam&&typeof value.exam==='object'&&Number.isFinite(value.exam.startedAt)){
      const e=value.exam;out.exam={answers:records(e.answers),startedAt:e.startedAt,elapsed:Math.max(0,Number(e.elapsed)||0),index:Math.min(186,Math.max(0,Math.floor(Number(e.index)||0))),completedAt:Number.isFinite(e.completedAt)?e.completedAt:null,modifiedAt:Number.isFinite(e.modifiedAt)?e.modifiedAt:0};
    }
    const s=value.settings||{};out.settings={showScoring:s.showScoring!==false,autoNext:s.autoNext===true,sex:['male','female'].includes(s.sex)?s.sex:''};
    out.settingsAt=Number.isFinite(value.settingsAt)?value.settingsAt:0;out.updatedAt=Number.isFinite(value.updatedAt)?value.updatedAt:0;return out;
  }
  function mergeRecords(a,b){const out={...a};for(const [id,r] of Object.entries(b||{}))if(!out[id]||r.at>out[id].at)out[id]=r;return out;}
  function merge(first,second){
    const a=clean(first),b=clean(second);const newer=b.updatedAt>a.updatedAt?b:a;const out=clean(newer);
    out.practice={...(b.practice.modifiedAt>a.practice.modifiedAt?b.practice:a.practice),answers:mergeRecords(a.practice.answers,b.practice.answers)};
    out.favorites=mergeRecords(a.favorites,b.favorites);
    if(a.exam&&b.exam&&a.exam.startedAt===b.exam.startedAt){
      const latest=(b.exam.modifiedAt||0)>(a.exam.modifiedAt||0)?b.exam:a.exam;
      out.exam={...latest,answers:mergeRecords(a.exam.answers,b.exam.answers),elapsed:Math.max(a.exam.elapsed,b.exam.elapsed),completedAt:Math.max(a.exam.completedAt||0,b.exam.completedAt||0)||null};
    }else out.exam=(b.exam?.startedAt||0)>(a.exam?.startedAt||0)?b.exam:a.exam;
    const settings=b.settingsAt>a.settingsAt?b:a;out.settings=settings.settings;out.settingsAt=settings.settingsAt;out.updatedAt=Math.max(a.updatedAt,b.updatedAt);return clean(out);
  }
  function answerValue(answers,id){return validAnswer(answers?.[id]?.value)?answers[id].value:null;}
  function answered(answers){return Object.values(records(answers)).filter(x=>validAnswer(x.value)).length;}
  function report(data,answers,sex){
    const complete=answered(answers)===data.questionCount;
    return data.factors.map(f=>{
      const done=f.questionIds.filter(id=>answerValue(answers,id));
      const raw=done.reduce((n,id)=>n+data.questions[id-1].scores[answerValue(answers,id)],0);
      const canRate=complete&&['male','female'].includes(sex);
      const band=canRate?data.norms[sex][f.code].find(x=>raw>=x.min&&raw<=x.max):null;
      const boundaries=f.bands[sex];
      const level=canRate?(raw<boundaries[0]?'低':raw<boundaries[1]?'中':'高'):null;
      return {code:f.code,name:f.name,raw,max:f.max,done:done.length,total:f.questionIds.length,complete:done.length===f.questionIds.length,canRate,standard:band?.standard??null,level,normGap:canRate&&!band};
    });
  }
  function wrongIds(data,answers){return data.questions.filter(q=>q.factor==='B'&&!q.note&&answerValue(answers,q.id)&&answerValue(answers,q.id)!==q.sourceAnswer).map(q=>q.id);}
  const api={APP,ids,fresh,clean,merge,mergeRecords,answerValue,answered,report,wrongIds};
  root.CattellCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
