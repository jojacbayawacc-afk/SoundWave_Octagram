// Zero-dependency static server so SoundWave runs on http://localhost:3000
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = Number(process.env.PORT) || 3000, ROOT = __dirname;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || /(^|[\\/])(sql|supabase|node_modules|\.git)([\\/]|$)/.test(path.relative(ROOT, file))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`SoundWave running at http://localhost:${PORT}`));
