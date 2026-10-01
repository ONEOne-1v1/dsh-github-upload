// 单元测试：src/host.js 里的 gitBlobSha 必须与 git 自身的算法完全一致。
//
// 这是「哪些文件还没上传」判定的正确性基础：GitHub 的 tree 接口直接给出每个 blob 的 sha，
// 本地算出同一个 sha 就能不发额外请求地判断内容变没变；算错一位，整个功能会静默地
// 把「已改」当成「没改」（或反过来），两种错都不报错、只会给出错误的选择。
//
// 用法：node scripts/test-blobsha.mjs
// 需要系统里有 `git`（只用来做对照，不依赖仓库）。
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = readFileSync('src/host.js', 'utf8')

function grab(src, header) {
  const s = src.indexOf(header)
  if (s < 0) throw new Error('not found: ' + header)
  let d = 0, e = -1
  for (let i = src.indexOf('{', s); i < src.length; i++) {
    if (src[i] === '{') d++
    else if (src[i] === '}') { d--; if (d === 0) { e = i + 1; break } }
  }
  return src.slice(s, e)
}

const code = grab(host, 'function gitBlobSha(bytes)')
const gitBlobSha = new Function('createHash', code + '\nreturn gitBlobSha')(createHash)

const cases = [
  ['空文件', Buffer.alloc(0)],
  ['单字节', Buffer.from('a')],
  ['中文', Buffer.from('中文内容\n', 'utf8')],
  ['含 NUL 的二进制', Buffer.from([0, 1, 2, 255, 0, 7])],
  ['稍大', Buffer.from(Array.from({ length: 5000 }, (_, i) => 'line ' + i).join('\n'), 'utf8')],
]

let ok = true
// 写在系统临时目录：仓库里没有 `git` 也不能依赖 `shots/` 这类被 gitignore 的目录
const p = join(tmpdir(), 'dsh-ghu-blobtest.bin')
for (const [label, buf] of cases) {
  writeFileSync(p, buf)
  const mine = gitBlobSha(new Uint8Array(buf))
  const theirs = execFileSync('git', ['hash-object', p], { encoding: 'utf8' }).trim()
  const same = mine === theirs
  if (!same) ok = false
  console.log(`${same ? 'ok  ' : 'FAIL'}  ${label.padEnd(14)} mine=${mine.slice(0, 12)}  git=${theirs.slice(0, 12)}`)
}
try { unlinkSync(p) } catch (e) { /* ignore */ }
console.log('')
console.log(ok ? '全部一致 → 可以与 GitHub tree 里的 sha 直接比较' : '不一致 → 判定会出错')
process.exit(ok ? 0 : 1)
