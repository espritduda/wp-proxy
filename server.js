const http = require('http');
const https = require('https');
const PORT = process.env.PORT || 3000;
const SECRET = 'canaliz2026xT';
const AUTH = 'Basic ' + Buffer.from('Thibaut:QE7X PggQ Toqh k32M tImY xbLe').toString('base64');
const SITE = 'https://canalizadordelisboa.pt';

function wp(method, path, body, cb) {
  const req = https.request({ hostname: 'canalizadordelisboa.pt', path: '/wp-json/wp/v2' + path, method, headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' } }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{cb(null,res.statusCode,JSON.parse(d))}catch(e){cb(null,res.statusCode,d)} }); });
  req.on('error',e=>cb(e));
  if(body) req.write(JSON.stringify(body));
  req.end();
}

function visit(url,cb){ try{ const u=new URL(url); const r=https.request({hostname:u.hostname,path:u.pathname,method:'GET',headers:{'User-Agent':'Mozilla/5.0'}},res=>{res.resume();res.on('end',()=>cb(res.statusCode))}); r.on('error',()=>cb(0)); r.end(); }catch(e){cb(0);} }

http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(200);res.end('{}');return;}
  if(req.method==='GET'){res.end(JSON.stringify({success:false,message:'POST only'}));return;}
  let body='';
  req.on('data',c=>body+=c);
  req.on('end',()=>{
    let d; try{d=JSON.parse(body)}catch(e){res.end(JSON.stringify({success:false,message:'Invalid JSON'}));return;}
    if(d.secret!==SECRET){res.writeHead(403);res.end(JSON.stringify({success:false,message:'Unauthorized'}));return;}
    if(d.action==='test'){res.end(JSON.stringify({success:true,message:'OK'}));return;}
    if(d.action==='create_page'){
      wp('POST','/pages',{title:d.title,slug:d.slug,content:d.content,status:'publish',meta:{_yoast_wpseo_metadesc:d.meta||''}},(err,code,b)=>{
        if(err||code!==201) res.end(JSON.stringify({success:false,message:(b&&b.message)||'Erreur '+code}));
        else res.end(JSON.stringify({success:true,id:b.id,link:b.link}));
      });return;
    }
    if(d.action==='update_servicos'){
      wp('GET','/pages?slug=servicos&_fields=id,content',null,(err,code,pages)=>{
        if(err||!Array.isArray(pages)||!pages.length){res.end(JSON.stringify({success:false,message:'introuvable'}));return;}
        const p=pages[0]; let c=p.content.rendered;
        const nl='\n<a href="'+SITE+'/'+d.slug+'/">'+d.title+'</a>';
        const anchor='Limpeza do Separador de Gorduras Lisboa</a>';
        c=c.includes(anchor)?c.replace(anchor,anchor+nl):c+nl;
        wp('POST','/pages/'+p.id,{content:c},(e2,c2)=>res.end(JSON.stringify({success:!e2&&c2===200})));
      });return;
    }
    if(d.action==='translate'){
      const langs=['en','fr','it','es','de']; let i=0; const results={};
      function next(){ if(i>=langs.length){res.end(JSON.stringify({success:true,results}));return;} const l=langs[i++]; const url=SITE+'/'+l+'/'+d.slug+'/';
        visit(url,c1=>{setTimeout(()=>{visit(url,c2=>{results[l]={v1:c1,v2:c2};setTimeout(next,1000)});},2000);}); }
      next();return;
    }
    res.end(JSON.stringify({success:false,message:'Action inconnue'}));
  });
}).listen(PORT,'0.0.0.0',()=>console.log('Server OK port '+PORT));
