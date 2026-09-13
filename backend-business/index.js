'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleApiRequest } = require('./routes');

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

/**
 * In production the panel is a separate distribution per tenant subdomain.
 * Here the business backend serves it so the whole thing comes up with one
 * command.
 */
function serveFrontend(req, res) {
  const requested = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(FRONTEND_DIR, requested);
  if (!file.startsWith(FRONTEND_DIR) || !fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain' });
  return fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/internal/')) return handleApiRequest(req, res);
  return serveFrontend(req, res);
});

server.listen(PORT, () => {
  console.log(`[business] API + panel on http://localhost:${PORT}`);
});

module.exports = server;
