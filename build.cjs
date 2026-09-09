const fs=require('node:fs');
fs.mkdirSync('dist',{recursive:true});
for(const p of ['index.html','mobile.css','hall-core.js','camera.js','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png','vendor'])fs.cpSync(p,'dist/'+p,{recursive:true});
console.log('Static app ready in dist.');
