const fs=require('node:fs'),path=require('node:path');
const root=__dirname,out=path.resolve(root,'dist');
if(out!==path.join(root,'dist'))throw new Error('Invalid output directory');
fs.rmSync(out,{force:true,recursive:true});fs.mkdirSync(out+'/server',{recursive:true});
const files=['index.html','mobile.css','hall-core.js','camera.js','roster-core.js','roster.js','auth-client.js','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png','vendor/zxing-browser.min.js','vendor/ZXING-BROWSER-LICENSE','vendor/ZXING-LIBRARY-LICENSE'];
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png'};
const assets={};for(const file of files){if(!fs.existsSync(path.join(root,file)))continue;const binary=file.endsWith('.png');assets['/'+file]={type:types[path.extname(file)]||'text/plain',base64:binary,data:fs.readFileSync(path.join(root,file),binary?'base64':'utf8')};}
fs.writeFileSync(root+'/server/assets.generated.mjs','export default '+JSON.stringify(assets)+';\n');
fs.mkdirSync(out+'/.openai',{recursive:true});fs.copyFileSync(root+'/.openai/hosting.json',out+'/.openai/hosting.json');fs.cpSync(root+'/drizzle',out+'/.openai/drizzle',{recursive:true});
if(!process.argv.includes('--prepare-only'))require('esbuild').buildSync({entryPoints:[root+'/server/worker.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:out+'/server/index.js'});
console.log('Worker assets and schema prepared.');
