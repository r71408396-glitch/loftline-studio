// Tiny local receiver for preview/poster.html and preview/shots.html: saves a
// posted data URL into theme/assets, data/images (?dir=images) or preview/out (?dir=out).
import http from 'node:http';
import fs from 'node:fs';

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const url = new URL(req.url, 'http://localhost');
    const name = (url.searchParams.get('name') || '').replace(/[^a-z0-9.-]/gi, '');
    const dirs = { images: 'data/images', out: 'preview/out' };
    const dir = dirs[url.searchParams.get('dir')] || 'theme/assets';
    if (req.method !== 'POST' || !name) return res.end('ignored');
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const buffer = Buffer.from(body.split(',')[1], 'base64');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(`${dir}/${name}`, buffer);
      res.end(`saved ${name} ${buffer.length} bytes`);
    });
  })
  .listen(5179, () => console.log('capture server on 5179'));
