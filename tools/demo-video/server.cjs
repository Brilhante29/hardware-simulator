// Static server: repo root + /__demo/ -> scratch demo pages
const http=require('http'),fs=require('fs'),path=require('path');
const [root,demo,port]=process.argv.slice(2);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.woff':'font/woff','.png':'image/png','.svg':'image/svg+xml'};
http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]);let base=root;
 if(u.startsWith('/__demo/')){base=demo;u=u.slice(7)} if(u.endsWith('/'))u+='index.html';
 const f=path.join(base,path.normalize(u));if(!f.startsWith(base)){res.writeHead(403);return res.end()}
 fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('nf')}res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(d)})}).listen(+port);
