#!/usr/bin/env node
/**
 * serve.js — 零依赖静态文件服务器（纯 Node http，无任何第三方包）
 *
 * 用法：
 *   node scripts/serve.js [port]      # 默认 4173，仅服务 dist/
 *   PORT=8080 node scripts/serve.js
 *
 * 特性：
 *   - 正确 MIME 类型（html/css/js/svg/webp/png/jpg/json/woff2…）
 *   - 单页应用回退：未命中的路径回落到 index.html
 *   - 开发友好：no-cache + 目录 / 入口自动定位到 index.html
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || Number(process.argv[2]) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    // 防目录穿越
    const filePath = path.normalize(path.join(DIST, pathname));
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }

    const serveFile = (fp) => {
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(fp).pipe(res);
    };

    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isFile()) return serveFile(filePath);
      // 目录或未命中 -> 回退 index.html（SPA 友好）
      fs.stat(path.join(DIST, 'index.html'), (err2, stat2) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found — 请先运行 npm run build 生成 dist/');
          return;
        }
        serveFile(path.join(DIST, 'index.html'));
      });
    });
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500 Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  \x1b[36mmy-showcase\x1b[0m · 本地预览');
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log('  按 Ctrl+C 停止服务');
  console.log('');
});
