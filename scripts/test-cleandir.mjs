// 单元测试：从 src/client.js 里抽出 cleanDir 并验证边界情况。
// 用法：node scripts/test-cleandir.mjs
//
// 夹具故意用一个**含空格**的路径，因为"路径里有空格"正是这里最容易出错的地方
// （资源管理器「复制为路径」会连引号一起复制，引号必须被剥掉）。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'src', 'client.js'), 'utf8')

const start = src.indexOf('function cleanDir(raw) {')
if (start === -1) throw new Error('cleanDir not found')
// 从函数头开始做花括号配对，避免误截到内部代码块
let depth = 0
let end = -1
for (let i = src.indexOf('{', start); i < src.length; i++) {
  const ch = src[i]
  if (ch === '{') depth++
  else if (ch === '}') {
    depth--
    if (depth === 0) { end = i + 1; break }
  }
}
if (end === -1) throw new Error('cleanDir body not closed')
const source = src.slice(start, end)

// eslint-disable-next-line no-new-func
const cleanDir = new Function(source + '\nreturn cleanDir')()

const P = 'C:\\my projects\\sample app'
const cases = [
  [P, 'plain'],
  [`"${P}"`, 'quoted (Copy as path)'],
  [`'${P}'`, 'single-quoted'],
  [`\u201C${P}\u201D`, 'full-width quoted'],
  ['C:\\\\my projects\\\\sample app', 'doubled separators'],
  ['C:/my projects/sample app/', 'forward slashes + trailing'],
  [`  ${P}  `, 'padded spaces'],
  ['C:\\', 'drive root'],
  ['/', 'posix root'],
  ['\\\\server\\share\\proj', 'UNC'],
  ['', 'empty'],
  ['   ', 'blank'],
  [`"${P}\\"`, 'quoted + inner trailing slash'],
  [`"  ${P}  "`, 'quoted with padding'],
]

let failed = 0
for (const [input, label] of cases) {
  const got = cleanDir(input)
  const expect = {
    plain: P,
    'quoted (Copy as path)': P,
    'single-quoted': P,
    'full-width quoted': P,
    'doubled separators': P,
    'forward slashes + trailing': 'C:/my projects/sample app',
    'padded spaces': P,
    'drive root': 'C:\\',
    'posix root': '/',
    UNC: '\\\\server\\share\\proj',
    empty: '',
    blank: '',
    'quoted + inner trailing slash': P,
    'quoted with padding': P,
  }[label]
  const ok = got === expect
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(30)} out=${JSON.stringify(got)}${ok ? '' : '  expected=' + JSON.stringify(expect)}`)
}
console.log(failed ? `\n${failed} case(s) failed` : '\nall cases pass')
process.exit(failed ? 1 : 0)
