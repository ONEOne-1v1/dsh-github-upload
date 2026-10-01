// 预览用的极小静态服务器：无头浏览器对 file:// 的安全策略比较难缠，
// 直接走 http://127.0.0.1:<port>/ 更省事。用法：node scripts/preview-serve.mjs [port]
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.argv[2] || 8791)
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' }

createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  let rel = decodeURIComponent(url.pathname)
  if (rel === '/') rel = '/preview.html'
  const file = join(ROOT, normalize(rel).replace(/^([/\\])+/, ''))
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found: ' + rel)
    return
  }
  const ext = file.slice(file.lastIndexOf('.'))
  res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-store' })
  res.end(readFileSync(file))
}).listen(port, '127.0.0.1', () => {
  console.log('preview server on http://127.0.0.1:' + port + '/preview.html')
})
