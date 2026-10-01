// 宿主纯函数的单元测试：用花括号配对从 src/host.js 抽出关键纯函数，独立验证。
//
// 覆盖手写 base64 编码器（分块边界）、ref / 内容路径编码、.gitignore 匹配、项目根推断 ——
// 这些纯函数最容易悄悄写错，又不依赖 Harness 运行时，抽出来就能直接断言。
//
// 用法：node scripts/test-internals.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'src', 'host.js'), 'utf8')

function grab(header, extra) {
  const start = src.indexOf(header)
  if (start === -1) throw new Error('not found: ' + header)
  let depth = 0, end = -1
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break } }
  }
  if (end === -1) throw new Error('unclosed: ' + header)
  return src.slice(start, end)
}

/** 抽一整行 const 声明（这些声明都是单行的；花括号配对法会被字符类里的 [ 骗到）。 */
function grabConst(header) {
  const start = src.indexOf(header)
  if (start === -1) throw new Error('not found: ' + header)
  const end = src.indexOf('\n', start)
  return src.slice(start, end === -1 ? src.length : end)
}

const consts = grabConst('const B64CHARS =')
const BS = String.fromCharCode(92)
// 取值直接用源码里的 tr 实现（下面 parts 之外单独注入）
const trSrc = grab('function tr(lang, key, a, b, c)')
const REGEX = [
  'const BS = String.fromCharCode(92)',
  'const CR = String.fromCharCode(13)',
  "const REGEX_SPECIAL = '.+^$()[]{}|' + BS",
  '',
].join('\n')

const parts = [
  consts,
  REGEX,
  grab('function bytesToBase64(bytes)'),
  grab('function looksText(bytes)'),
  grab('function refPath(branch)'),
  grab('function contentPath(path)'),
  grab('function pathSegments(p)'),
  grab('function looksAbsolute(p)'),
  grab('function commonDirOf(paths)'),
  grab('function globToRegExp(pattern)'),
  grab('function parseGitignore(text)'),
  grab('function matchRule(relPath, rules)'),
  grab('function dirDecision(relPath, name, rules, lang)'),
  grab('function fileDecision(relPath, name, rules, lang)'),
  // 忽略规则四个常量在源码里是连续的一段，整段截取最稳（多行数组，不能按行取）
  src.slice(src.indexOf('const HARD_IGNORED_DIRS ='), src.indexOf('function globToRegExp(pattern)')),
]
// 每个 const 声明要补一个分号，否则拼起来的代码不是合法语句序列
const code = parts
  .map((p) => (/^const\s/.test(p) && !/;\s*$/.test(p) ? p + ';' : p))
  .join('\n')
  + '\nconst M = new Proxy({}, { get: (t, k) => [String(k), String(k)] }); // 文案表桩\n' + trSrc

const api = new Function(code + '\nreturn { bytesToBase64, looksText, refPath, contentPath, commonDirOf, globToRegExp, parseGitignore, matchRule, dirDecision, fileDecision };')()
const { bytesToBase64, looksText, refPath, contentPath, commonDirOf, globToRegExp, parseGitignore, matchRule, dirDecision, fileDecision } = api

let fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`)
}

/* ---- base64：分块边界（24576 字符 = 8192*3 字节的整倍数） ---- */
console.log('== bytesToBase64 ==')
for (const n of [0, 1, 2, 3, 4, 5, 6, 100, 8191, 8192, 8193, 16384, 24575, 24576, 24577, 30000, 65536]) {
  const b = Buffer.alloc(n)
  for (let i = 0; i < n; i++) b[i] = (i * 37 + 11) & 255
  eq(`len=${n}`, bytesToBase64(b), b.toString('base64'))
}
eq('all 0xFF x1000', bytesToBase64(Buffer.alloc(1000, 0xff)), Buffer.alloc(1000, 0xff).toString('base64'))
eq('utf8 中文', bytesToBase64(Buffer.from('中文测试 🚀', 'utf8')), Buffer.from('中文测试 🚀', 'utf8').toString('base64'))
eq('24KB 边界随机', (() => {
  const b = Buffer.alloc(24577); for (let i = 0; i < b.length; i++) b[i] = (i * 131 + 7) & 255
  return bytesToBase64(b) === b.toString('base64')
})(), true)

/* ---- looksText ---- */
console.log('== looksText ==')
eq('ascii', looksText(Buffer.from('hello world')), true)
eq('utf8 中文', looksText(Buffer.from('中文', 'utf8')), true)
eq('NUL 二进制', looksText(Buffer.from([1, 2, 0, 3])), false)
eq('非法 UTF-8 (0xC3 0x28)', looksText(Buffer.from([0xc3, 0x28])), false)
eq('GBK「中文」应判二进制', looksText(Buffer.from([0xd6, 0xd0, 0xce, 0xc4])), false)
eq('BOM', looksText(Buffer.from([0xef, 0xbb, 0xbf, 0x61])), true)

/* ---- refPath / contentPath ---- */
console.log('== refPath / contentPath ==')
eq('refPath main', refPath('main'), 'main')
eq('refPath feat/x', refPath('feat/x'), 'feat/x')
eq('refPath feat/a/b', refPath('feat/a/b'), 'feat/a/b')
eq('refPath 中文分支', refPath('发布/1.0'), encodeURIComponent('发布') + '/1.0')
eq('refPath 空格', refPath('my branch'), 'my%20branch')
eq('refPath #号', refPath('a#b'), 'a%23b')
eq('contentPath 普通', contentPath('src/a.js'), 'src/a.js')
eq('contentPath 空格+#', contentPath('my dir/a#b.txt'), 'my%20dir/a%23b.txt')
eq('contentPath 中文', contentPath('文档/说明.md'), encodeURIComponent('文档') + '/' + encodeURIComponent('说明.md'))

/* ---- commonDirOf：返回「包含这些文件的目录」，也就是项目根 ---- */
console.log('== commonDirOf ==')
eq('同目录两文件', commonDirOf(['D:\\a\\proj\\src\\x.js', 'D:\\a\\proj\\src\\y.js']), 'D:\\a\\proj\\src')
eq('同目录但不同子目录', commonDirOf(['D:\\a\\proj\\src\\x.js', 'D:\\a\\proj\\docs\\y.md']), 'D:\\a\\proj')
eq('一文件退一层', commonDirOf(['D:\\a\\proj\\src\\x.js']), 'D:\\a\\proj\\src')
eq('完全相同', commonDirOf(['D:\\a\\proj\\x.js', 'D:\\a\\proj\\x.js']), 'D:\\a\\proj')
eq('跨盘返回空', commonDirOf(['D:\\a\\x.js', 'C:\\b\\y.js']), '')
eq('同盘只到根返回空', commonDirOf(['D:\\x.js', 'D:\\y.js']), '')
eq('大小写不敏感', commonDirOf(['D:\\A\\P\\x.js', 'd:\\a\\p\\y.js']), 'D:\\A\\P')
eq('空数组', commonDirOf([]), '')
eq('相对路径返回空（不会污染项目根推断）', commonDirOf(['src/a.js', 'src/b.js']), '')

/* ---- globToRegExp / gitignore ---- */
console.log('== gitignore ==')
const mk = (lines) => parseGitignore(lines.join('\n'))
const hit = (pat, p) => matchRule(p, mk([pat])) !== null
eq('node_modules 目录', hit('node_modules', 'node_modules/x'), true)
eq('*.log', hit('*.log', 'a/b/x.log'), true)
eq('*.log 不匹配目录名', hit('*.log', 'logs'), false)
eq('src/*.js 只一层', hit('src/*.js', 'src/a.js'), true)
eq('/root.txt 锚定', hit('/root.txt', 'a/root.txt'), false)
eq('/root.txt 命中根', hit('/root.txt', 'root.txt'), true)
eq('**/dist', hit('**/dist', 'a/b/dist/f.js'), true)
eq('a/**/b', hit('a/**/b', 'a/x/y/b/c'), true)
eq('取反规则命中', (() => { const r = mk(['*.log', '!keep.log']); const m = matchRule('keep.log', r); return m !== null && m.negate })(), true)
eq('后者覆盖前者', (() => { const r = mk(['!a.txt', 'a.txt']); return matchRule('a.txt', r).negate })(), false)
eq('注释被忽略', mk(['# x', 'a.txt']).length, 1)
eq('尾随 / 目录规则', hit('build/', 'build/x.js'), true)
eq('转义字符 (a+b)', hit('a+b', 'a+b'), true)
eq('转义字符不误命中 (a+b vs aab)', hit('a+b', 'aab'), false)
eq('方括号字符类被当字面量', hit('[abc].txt', '[abc].txt'), true)

/* ---- dirDecision / fileDecision 细节 ---- */
console.log('== dir/file decision ==')
eq('HARD 目录 prune', dirDecision('node_modules', 'node_modules', [], 'en').prune, true)
eq('SOFT 目录不 prune 但 ignored', (() => { const d = dirDecision('dist', 'dist', [], 'en'); return [d.prune, d.ignored] })(), [false, true])
eq('默认忽略扩展名 .log', fileDecision('a.log', 'a.log', [], 'en').ignored, true)
eq('嵌套同名 SOFT 目录', dirDecision('sub/dist', 'dist', [], 'en').ignored, true)

console.log('')
console.log(fail ? `${fail} assertion(s) failed` : 'all internal assertions pass')
process.exit(fail ? 1 : 0)
