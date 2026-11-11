import fs from 'node:fs/promises';
const dest=new URL('../dist/',import.meta.url);await fs.mkdir(dest,{recursive:true});
for(const name of ['index.html','app.js','core.js','data.js','style.css','icon.svg'])await fs.copyFile(new URL('../'+name,import.meta.url),new URL(name,dest));
console.log('Static application prepared in dist/');
