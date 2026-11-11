import fs from 'node:fs/promises';
const base='https://raw.githubusercontent.com/';
const sources=[['logic-q.js','nishiyu0411-alt/logic-practice/main/github-pages-questions.js'],['math-q.js','nishiyu0411-alt/math/main/unified/questions.js'],['word-html.html','nishiyu0411-alt/word/main/index.html'],['cattell-q.js','nishiyu0411-alt/word/main/cattell/data.js']];
for(const year of ['2023','2025'])for(const mod of ['03-言语理解与表达','04-数量关系','05-判断推理'])sources.push([`xc-${year}-${mod.slice(0,2)}.md`,`ERRRC/xingcezhenti/main/${mod}/${year}年上海市公务员录用考试《行测》题（A类）（网友回忆版）.md`]);
const directory=new URL('../sources/',import.meta.url);await fs.mkdir(directory,{recursive:true});
for(const [name,path]of sources){const r=await fetch(base+path.split('/').map(encodeURIComponent).join('/'));if(!r.ok)throw Error(name+': HTTP '+r.status);const text=await r.text();await fs.writeFile(new URL(name,directory),text);console.log('Retrieved '+name);}
