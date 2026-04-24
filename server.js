const https = require('https');

const PORT = process.env.PORT || 3000;
const WP_USER = 'Thibaut';
const WP_PASS = 'QE7X PggQ Toqh k32M tImY xbLe';
const WP_BASE = 'https://canalizadordelisboa.pt/wp-json/wp/v2';
const SITE = 'https://canalizadordelisboa.pt';
const SECRET = 'canaliz2026xT';
const AUTH = 'Basic ' + Buffer.from(WP_USER + ':' + WP_PASS).toString('base64');

function wpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(WP_BASE + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': AUTH,
        'Content-Type': 'application/json',
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ code: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ code: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function visitUrl(url) {
  return new Promise(resolve => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WP-Publisher/1.0)' }
    }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', () => resolve(0));
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

require('http').createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end(JSON.stringify({ success: false, message: 'POST only' })); return; }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);

      if (data.secret !== SECRET) {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
        return;
      }

      const action = data.action;

      // ── TEST ─────────────────────────────────────────────────────
      if (action === 'test') {
        res.end(JSON.stringify({ success: true, message: 'Proxy Railway opérationnel !' }));
        return;
      }

      // ── CREATE PAGE ──────────────────────────────────────────────
      if (action === 'create_page') {
        const result = await wpRequest('POST', '/pages', {
          title: data.title,
          slug: data.slug,
          content: data.content,
          status: 'publish',
          meta: { _yoast_wpseo_metadesc: data.meta || '' }
        });
        if (result.code === 201) {
          res.end(JSON.stringify({ success: true, id: result.body.id, link: result.body.link }));
        } else {
          res.end(JSON.stringify({ success: false, message: result.body.message || 'Erreur ' + result.code }));
        }
        return;
      }

      // ── UPDATE SERVICOS ──────────────────────────────────────────
      if (action === 'update_servicos') {
        const find = await wpRequest('GET', '/pages?slug=servicos&_fields=id,content');
        if (!find.body.length) { res.end(JSON.stringify({ success: false, message: 'Page servicos introuvable' })); return; }
        const page = find.body[0];
        let content = page.content.rendered;
        const newLink = '\n<a href="' + SITE + '/' + data.slug + '/">' + data.title + '</a>';
        const anchor = 'Limpeza do Separador de Gorduras Lisboa</a>';
        content = content.includes(anchor) ? content.replace(anchor, anchor + newLink) : content + newLink;
        const upd = await wpRequest('POST', '/pages/' + page.id, { content });
        res.end(JSON.stringify({ success: upd.code === 200 }));
        return;
      }

      // ── TRANSLATE ────────────────────────────────────────────────
      if (action === 'translate') {
        const langs = ['en', 'fr', 'it', 'es', 'de'];
        const results = {};
        for (const lang of langs) {
          const url = SITE + '/' + lang + '/' + data.slug + '/';
          const c1 = await visitUrl(url);
          await sleep(2000);
          const c2 = await visitUrl(url);
          results[lang] = { visit1: c1, visit2: c2 };
        }
        res.end(JSON.stringify({ success: true, results }));
        return;
      }

      res.end(JSON.stringify({ success: false, message: 'Action inconnue: ' + action }));

    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, message: e.message }));
    }
  });
}).listen(PORT, () => console.log('Proxy running on port ' + PORT));
