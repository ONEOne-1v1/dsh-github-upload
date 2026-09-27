// 无头冒烟测试：用一个极简 DOM stub 真正跑一遍 src/client.js 的挂载与渲染路径。
//
// 目的：抓「render() 抛异常」这一类 bug。曾经有过一次 appendChild(null) 把 render 打断，
// 表现是「点扫描没反应」（因为 scanNow 里 render() 排在发请求之前），而且后端完全正常、
// 从 curl 测不出来。这个测试直接点按钮、断言请求发出去了。
//
// 用法：node scripts/test-render.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
// CLIENT_JS 环境变量可以指向别处的副本；NEGATIVE_CONTROL 把已知的那次 bug 注回去，
// 用来证明这个测试真的抓得到它（对照实验）：
//   NEGATIVE_CONTROL=drop-null-guard node scripts/test-render.mjs   ← 必须失败
let source = readFileSync(process.env.CLIENT_JS || join(here, '..', 'src', 'client.js'), 'utf8')
if (process.env.NEGATIVE_CONTROL === 'drop-null-guard') {
  // 把两处修复都改回原样：detectCard 返回 null，且调用方不再判空。
  // 只改一处是抓不到的 —— 两处都是独立生效的防线，这正是它们存在的意义。
  const a = source
  source = source.replace("if (!d || !d.projectRoot) return h('div');", 'if (!d || !d.projectRoot) return null;')
  source = source.replace('var dcard = detectCard();\n      if (dcard) body.appendChild(dcard);', 'body.appendChild(detectCard());')
  if (source === a) throw new Error('negative control: the patterns to break were not found')
  console.log('# negative control active: appendChild(null) is back\n')
}
if (process.env.NEGATIVE_CONTROL === 'raw-localstorage-read') {
  // 回到「boot() 直接读 localStorage 原文」的写法：路径会带上 JSON 的引号。
  const a = source
  source = source.replace("S.dir = cleanDir(readString(LS_DIR, ''));",
    "try { var _rd = localStorage.getItem(LS_DIR); if (_rd) S.dir = _rd; } catch (e) { /* ignore */ }")
  if (source === a) throw new Error('negative control: the pattern to break was not found')
  console.log('# negative control active: raw localStorage read is back\n')
}

/* ---------------- 极简 DOM ---------------- */

class TextNode {
  constructor(text) { this.nodeType = 3; this.textContent = String(text); this.parentNode = null }
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase()
    this.children = []
    this.parentNode = null
    this.listeners = {}
    this.dataset = {}
    this.attrs = {}
    this.style = {}
    this.classList = {
      add: () => {}, remove: () => {}, contains: () => false,
    }
    this._class = ''
    this._text = ''
    this.value = ''
    this.checked = false
    this.disabled = false
    this.indeterminate = false
    this.offsetWidth = 100
    this.offsetHeight = 30
  }
  get className() { return this._class }
  set className(v) { this._class = v === undefined || v === null ? '' : String(v) }
  get textContent() {
    let s = this._text
    for (const c of this.children) s += c.textContent
    return s
  }
  set textContent(v) { this._text = v === undefined || v === null ? '' : String(v); this.children = [] }
  set innerHTML(v) { this.children = []; this._text = '' }
  get innerHTML() { return '' }
  appendChild(child) {
    if (child === null || child === undefined || typeof child !== 'object') {
      // 这就是我们要抓的错误：真实浏览器里 appendChild(null) 会抛 TypeError。
      throw new TypeError('appendChild: parameter 1 is not of type Node (got ' + String(child) + ')')
    }
    child.parentNode = this
    this.children.push(child)
    return child
  }
  removeChild(child) {
    const i = this.children.indexOf(child)
    if (i === -1) throw new Error('removeChild: node is not a child')
    this.children.splice(i, 1)
    child.parentNode = null
    return child
  }
  contains(node) {
    if (node === this) return true
    for (const c of this.children) if (c.contains && c.contains(node)) return true
    return false
  }
  addEventListener(type, fn) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type].push(fn)
  }
  setAttribute(k, v) { this.attrs[k] = String(v) }
  getAttribute(k) { return this.attrs[k] }
  getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 } }
  setPointerCapture() {}
  releasePointerCapture() {}
  querySelectorAll(sel) {
    const want = []
    const m = /^input\[data-([a-z]+)\]$/.exec(sel)
    if (m) want.push(m[1])
    const out = []
    const walk = (n) => {
      if (n.tagName === 'INPUT' && want.some(k => n.dataset[k] !== undefined)) out.push(n)
      if (!Array.isArray(n.children)) return
      for (const c of n.children) walk(c)
    }
    walk(this)
    return out
  }
}

const body = new El('body')
const documentStub = {
  body,
  createElement: (tag) => new El(tag),
  createTextNode: (s) => new TextNode(s),
  getElementById(id) {
    let found = null
    const walk = (n) => {
      if (found) return
      if (n.attrs && n.attrs.id === id) { found = n; return }
      if (!Array.isArray(n.children)) return
      for (const c of n.children) walk(c)
    }
    walk(body)
    return found
  },
  addEventListener: () => {},
  documentElement: new El('html'),
}

const storage = new Map()
const windowStub = {
  innerWidth: 1400, innerHeight: 900,
  open: () => {},
  addEventListener: () => {},
}

/* ---------------- fetch / 计时器 ---------------- */

const requests = []
function reply(op) {
  const data = {
    hello: { projectRoot: 'D:/proj', workspaceRoot: 'D:/proj', nodePath: 'node', assetDir: 'D:/a', picker: { kind: 'native' }, sessionQuery: true },
    'auth-status': { bound: true, user: { login: 'tester', name: 'T', avatar: '', url: '' }, persisted: true, token: { kind: 'classic', scopes: 'repo' }, hint: '' },
    'list-repos': { repos: [], total: 0, diag: [], token: { kind: 'classic', scopes: 'repo' }, hint: '' },
    'list-branches': { branches: ['main'] },
    'session-files': {
      projectRoot: 'D:/proj', rootSource: 'files',
      session: { id: 's1', title: 'T', chosenBy: 'live' },
      counts: { written: 1, edited: 0, read: 0, searched: 0 },
      inside: 1, outside: 0, files: [{ path: 'a.txt', action: 'written' }],
    },
    scan: {
      root: 'D:/proj', totalSize: 1, truncated: false, gitignore: 0, prunedDirs: [], prunedCount: 0,
      files: [{ path: 'a.txt', size: 1, ignored: false, reason: '' }],
    },
    ping: { status: 200, zen: 'ok', node: 'node' },
    'list-dirs': { path: 'D:/', home: 'D:/', crumbs: [], entries: [], roots: [], canCreate: false },
  }[op]
  if (data === undefined) return { ok: false, error: 'unexpected op in smoke test: ' + op }
  return { ok: true, data }
}

function installFetch() {
  globalThis.fetch = (url, init) => {
    let op = ''
    try { op = JSON.parse(init.body).op } catch (e) { /* ignore */ }
    requests.push({ op, url })
    return Promise.resolve({ text: () => Promise.resolve(JSON.stringify(reply(op))) })
  }
}

/* ---------------- 执行客户端 ---------------- */

installFetch()
globalThis.window = windowStub
globalThis.document = documentStub
// Node 24 的 globalThis.navigator 只有 getter，得用 defineProperty 覆盖。
Object.defineProperty(globalThis, 'navigator', { value: { language: 'zh-CN' }, configurable: true, writable: true })
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
}
globalThis.setTimeout = () => 0
globalThis.setInterval = () => 0
globalThis.clearTimeout = () => {}
globalThis.clearInterval = () => {}

// 预置「已选仓库 / 已选目录」：scanNow 会先要求选中仓库才会发请求。
// 注意用 JSON.stringify 写入 —— keep() 就是这么写的；以前 boot() 直读原文，
// 于是把 JSON 的引号一起读成了路径的一部分（默认目录带引号的 bug）。
storage.set('dsh.ghu.repo', JSON.stringify({ owner: 'o', name: 'r', fullName: 'o/r', defaultBranch: 'main' }))
storage.set('dsh.ghu.dir', JSON.stringify('D:/proj'))
storage.set('dsh.ghu.token', JSON.stringify('ghp_smoke'))
storage.set('dsh.ghu.lang', JSON.stringify('zh'))

const failures = []
// render() 也会在 promise 回调里被调用（boot / loadRepos / scan 的 then），
// 那里抛出的异常不会经过 fire()，必须靠这个兜住，否则进程直接崩、看不到汇总。
process.on('unhandledRejection', (e) => {
  failures.push('unhandled rejection: ' + (e && e.message ? e.message : e))
})

function fire(el, type, event = {}) {
  const list = el.listeners[type] || []
  for (const fn of list) {
    try { fn(Object.assign({ target: el, preventDefault() {}, pointerId: 1 }, event)) }
    catch (e) { failures.push(`${type} on <${el.tagName}> threw: ${e && e.message}`) }
  }
}
function find(root, predicate) {
  if (predicate(root)) return root
  if (!Array.isArray(root.children)) return null
  for (const c of root.children) {
    const hit = find(c, predicate)
    if (hit) return hit
  }
  return null
}
const byId = (id) => find(body, (n) => n.attrs && n.attrs.id === id)
const byText = (text) => find(body, (n) => n.tagName === 'BUTTON' && n.textContent === text)

const step = (name, fn) => {
  const before = failures.length
  try { fn() } catch (e) { failures.push(`${name}: ${e && e.message}`) }
  const ok = failures.length === before
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`)
}

// 1) 挂载。客户端脚本不再自己往 document.body 上挂：它只暴露
//    window.__DSH_GHU_MOUNT__，由槽位组件把容器交进来。这里模拟槽位组件。
step('mount the panel', () => {
  // eslint-disable-next-line no-new-func
  new Function(source)()
  if (typeof windowStub.__DSH_GHU_MOUNT__ !== 'function') {
    throw new Error('客户端没有暴露 window.__DSH_GHU_MOUNT__')
  }
  const host = new El('div')          // 模拟 shell.overlay 提供的容器
  body.appendChild(host)
  windowStub.__DSH_GHU_MOUNT__(host)
  if (!byId('dsh-ghu-fab')) throw new Error('FAB was not mounted')
  if (!byId('dsh-ghu-panel')) throw new Error('panel was not mounted')
  if (!host.contains(byId('dsh-ghu-root'))) {
    throw new Error('UI was not mounted into the slot container')
  }
})

// 让 boot()/hello 的 promise 链跑完
await new Promise(r => process.nextTick(r))
await new Promise(r => setImmediate(r))

step('open the panel (FAB pointerdown + pointerup)', () => {
  const fab = byId('dsh-ghu-fab')
  fire(fab, 'pointerdown', { button: 0 })
  fire(fab, 'pointerup', { button: 0 })
})

step('boot finished (hello + auth-status + list-repos issued)', () => {
  const ops = requests.map(r => r.op)
  for (const need of ['hello', 'auth-status', 'list-repos']) {
    if (!ops.includes(need)) throw new Error(`no ${need} request; got: ${ops.join(',')}`)
  }
})

step('switch to the Upload tab', () => {
  const tab = byText('上传')
  if (!tab) throw new Error('upload tab button not found')
  fire(tab, 'click')
})

step('the default directory carries no JSON quotes (localStorage round-trip)', () => {
  const input = find(body, n => n.tagName === 'INPUT' && n.attrs && n.attrs.placeholder === '项目目录绝对路径')
  if (!input) throw new Error('directory input not found')
  if (String(input.value).indexOf('"') !== -1) {
    throw new Error('directory input contains quotes: ' + JSON.stringify(input.value))
  }
  if (input.value !== 'D:/proj') throw new Error('unexpected default directory: ' + JSON.stringify(input.value))
})

step('the saved language was actually applied', () => {
  if (!byText('账号')) throw new Error('Chinese tab labels missing — saved lang was not read back')
})

step('render the upload tab before detection resolves (the regression)', () => {
  // 再渲染一次：此时 detect 还没回来，detectCard() 会走到「没有检测结果」的分支。
  const tab = byText('上传')
  fire(tab, 'click')
  if (failures.length) throw new Error(failures.join('; '))
})

await new Promise(r => setImmediate(r))

step('click Scan → a scan request must actually be sent', () => {
  const before = requests.filter(r => r.op === 'scan').length
  const btn = byText('扫描')
  if (!btn) throw new Error('scan button not found')
  fire(btn, 'click')
  const after = requests.filter(r => r.op === 'scan').length
  if (after === before) throw new Error('scan button did not issue a request (render() likely threw first)')
})

await new Promise(r => setImmediate(r))

step('scan result rendered without throwing', () => {
  if (!byText('全选')) throw new Error('post-scan selection row not rendered')
})

step('click "本聊天改动的文件" after scanning', () => {
  const btn = byText('本聊天改动的文件')
  if (!btn) throw new Error('session-files button not found')
  fire(btn, 'click')
})

await new Promise(r => setImmediate(r))

step('session-files request was issued', () => {
  if (!requests.some(r => r.op === 'session-files')) throw new Error('no session-files request')
})

console.log('')
if (failures.length) {
  console.log(`${failures.length} failure(s):`)
  for (const f of failures) console.log('  - ' + f)
  process.exit(1)
}
console.log(`all steps pass  (requests: ${requests.map(r => r.op).join(', ')})`)
