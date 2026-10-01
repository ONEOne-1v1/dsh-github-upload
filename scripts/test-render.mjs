// 无头冒烟测试：用一个极简 DOM stub 真正跑一遍 src/client.js 的挂载与渲染路径。
// 目的：抓「render() 抛异常」这一类 bug —— 它会让界面毫无反应，而后端完全正常、从 HTTP 测不出来；
// 本测试直接点按钮并断言请求确实发出去了。
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
// CSS 里也有必须守住的约束（面板不能贴到窗口右上角），所以两个文件都要看。
// 先**剥掉注释**：注释里会提到 `#dsh-ghu-fab` 这类选择器名，用正则按 `选择器{...}` 抓规则时
// 会被它们污染（曾经因此把 .ghu-acct img 的规则误判成 FAB 状态规则）。
let css = readFileSync(process.env.CLIENT_CSS || join(here, '..', 'src', 'client.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
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
if (process.env.NEGATIVE_CONTROL === 'close-in-header') {
  // 把底部控制条改名伪装成头部：断言必须发现「没有底部控制条」。
  const a = source
  source = source.replace("class: 'ghu-panelctl'", "class: 'ghu-head'")
  if (source === a) throw new Error('negative control: the pattern to break was not found')
  console.log('# negative control active: control bar renamed away\n')
}
if (process.env.NEGATIVE_CONTROL === 'docked-panel') {
  // 回到「整块贴边抽屉」的几何：右上角又会被窗口关闭键压住 —— 必须失败。
  // 只锚定 `position:fixed;` 之后到换行为止，不写死 14px / var(--ghu-r) 这些会变的值，
  // 否则 CSS 一改模式串就失配，对照实验会变成"抛错"而不是"测试失败"（曾经就是这样）。
  const a = css
  css = css.replace(/position:fixed;top:var\(--ghu-top\);right:[^;\n]+;bottom:[^;\n]+;/,
    'position:fixed;top:0;right:0;bottom:0;')
  if (css === a) throw new Error('negative control: the panel geometry pattern was not found')
  console.log('# negative control active: panel is docked to the window edge again\n')
}
if (process.env.NEGATIVE_CONTROL === 'fab-unclamped') {
  // 去掉落点夹取：按钮可以停在标题栏那一条上 —— 必须失败。
  const a = source
  source = source.replace('var safe = clampFabPos(r.left, r.top);', 'var safe = { x: r.left, y: r.top };')
  if (source === a) throw new Error('negative control: the clamp call was not found')
  console.log('# negative control active: FAB position is no longer clamped\n')
}
if (process.env.NEGATIVE_CONTROL === 'no-corner-shape') {
  // 去掉 corner-shape:round：DSH 主题的全局超椭圆规则会把正圆压成圆角方块 —— 必须失败。
  const a = css
  css = css.replace(/corner-shape:round;?/g, '')
  if (css === a) throw new Error('negative control: corner-shape:round was not found')
  console.log('# negative control active: corner-shape:round removed (theme squircle will win)\n')
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
      // 真实浏览器里 appendChild(null) 会抛 TypeError —— 这正是本测试要抓的错误。
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
const requestBodies = []
function reply(op) {
  const data = {
    hello: { projectRoot: 'D:/proj', workspaceRoot: 'D:/proj', nodePath: 'node', assetDir: 'D:/a', picker: { kind: 'native' }, sessionQuery: true },
    'auth-status': { bound: true, user: { login: 'tester', name: 'T', avatar: '', url: '' }, persisted: true, token: { kind: 'classic', scopes: 'repo' }, hint: '' },
    'list-repos': {
      // 至少给一个仓库：设置页要求已选仓库，可见性选择器的断言依赖它
      repos: [{
        name: 'r', fullName: 'o/r', owner: 'o', private: false, archived: false,
        fork: false, description: '', homepage: '', defaultBranch: 'main',
        url: 'https://github.com/o/r', updatedAt: '', pushedAt: '',
        hasIssues: true, hasWiki: false, topics: [],
      }],
      total: 1, diag: [], token: { kind: 'classic', scopes: 'repo' }, hint: '',
    },
    'list-branches': { branches: ['main'] },
    'session-files': {
      projectRoot: 'D:/proj', rootSource: 'files',
      session: { id: 's1', title: 'T', chosenBy: 'live' },
      counts: { written: 1, edited: 0, read: 0, searched: 0 },
      inside: 1, outside: 0, files: [{ path: 'a.txt', action: 'written' }],
    },
    // 「未上传的改动」：与远程按内容比对的结果
    'pending-files': {
      repo: 'o/r', branch: 'main', remoteOk: true, remoteReason: '',
      remoteFiles: 3, localFiles: 20, unchanged: 17, hashed: 2, pending: 1,
      files: [{ path: 'a.txt', state: 'modified', size: 1, ignored: false, reason: '' }],
    },
    scan: {
      root: 'D:/proj', totalSize: 1, truncated: false, gitignore: 0, prunedDirs: [], prunedCount: 0,
      files: [{ path: 'a.txt', size: 1, ignored: false, reason: '' }],
    },
    ping: { status: 200, zen: 'ok', node: 'node' },
    // 设置页会先拉一次仓库详情，拿到之后才渲染表单（含可见性选择器）
    'get-repo': {
      repo: {
        name: 'r', fullName: 'o/r', description: '', homepage: '', private: false,
        archived: false, hasIssues: true, hasWiki: false, topics: [],
        url: 'https://github.com/o/r',
      },
    },
    'list-dirs': { path: 'D:/', home: 'D:/', crumbs: [], entries: [], roots: [], canCreate: false },
  }[op]
  if (data === undefined) return { ok: false, error: 'unexpected op in smoke test: ' + op }
  return { ok: true, data }
}

function installFetch() {
  globalThis.fetch = (url, init) => {
    let op = ''
    let body = null
    try { body = JSON.parse(init.body); op = body.op } catch (e) { /* ignore */ }
    requests.push({ op, url })
    // 顺带留下请求体：有些断言关心"发出去了什么"（例如比对有没有带上 owner/repo/dir）
    if (body) requestBodies.push(body)
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
// 必须用 JSON.stringify 写入 —— keep() 就是这么写的；直读原文会把 JSON 引号一起读成路径的一部分。
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
/**
 * 让已排队的 promise 回调跑几轮。
 *
 * 宿主响应都是 `Promise.resolve(...)`，其 `.then` 在微任务里执行；顶层 `await settle()`
 * 就能让这些回调推进到位。
 *
 * ⚠️ 只能用在**顶层** `await`：不要写成 `step('x', async () => { ... await settle() ... })`
 * 然后在后面紧跟同步断言 —— 顶层不会等那个 promise，后面的步骤会在数据到位前就跑，
 * 而那些断言看起来"失败"其实只是跑早了。需要中间态的界面（例如设置页先拉一次仓库详情）
 * 建议抽成独立单测，别塞进这条同步链路。
 */
const settle = async (rounds = 4) => { for (let i = 0; i < rounds; i++) await new Promise((r) => setImmediate(r)) }
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

/**
 * 跑一条断言。
 *
 * 同步步骤立即执行；**异步步骤返回一个 promise**，必须由调用处 `await`。
 * 不要改成"登记起来最后统一跑"：那样会打乱步骤顺序（测试之间共享界面状态）。
 * 这里显式支持 async，是因为曾经漏掉过：同步版 `try { fn() }` 会在第一个 await 处
 * 悄悄断掉后续断言，而该步骤照样打印 ok —— 一个会骗人的测试。
 */
const step = (name, fn) => {
  if (fn.constructor && fn.constructor.name === 'AsyncFunction') {
    const before = failures.length
    return Promise.resolve()
      .then(fn)
      .catch((e) => { failures.push(`${name}: ${e && e.message}`) })
      .then(() => {
        console.log(`${failures.length === before ? 'ok  ' : 'FAIL'}  ${name}`)
      })
  }
  const before = failures.length
  try { fn() } catch (e) { failures.push(`${name}: ${e && e.message}`) }
  console.log(`${failures.length === before ? 'ok  ' : 'FAIL'}  ${name}`)
}

// 1) 挂载：客户端脚本只暴露 window.__DSH_GHU_MOUNT__，由槽位组件把容器交进来；这里模拟槽位组件。
await step('mount the panel', () => {
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

// 桌面端窗口的关闭/退出键在窗口右上角，所以面板头部不能放任何可点的东西，
// 面板本身也不能贴到窗口右边缘/顶边缘。
await step('no interactive control sits in the panel top-right corner', () => {
  const head = find(body, n => n.className === 'ghu-head')
  const ctl = find(body, n => n.className === 'ghu-panelctl')
  const close = byId('ghu-close')
  const lang = byId('ghu-lang')
  if (!head) throw new Error('panel header not found')
  if (!ctl) throw new Error('bottom control bar (.ghu-panelctl) not found')
  if (!close) throw new Error('close button not found')
  if (head.contains(close)) throw new Error('close button is back in the header — desktop window controls would cover it')
  if (!ctl.contains(close)) throw new Error('close button is not inside the bottom control bar')
  if (lang && head.contains(lang)) throw new Error('language switch is back in the header')
  if (lang && !ctl.contains(lang)) throw new Error('language switch is not inside the bottom control bar')
})

await step('panel geometry keeps the window corner clear (CSS)', () => {
  const m = /#dsh-ghu-panel\{([^}]*)\}/.exec(css)
  if (!m) throw new Error('#dsh-ghu-panel rule not found in src/client.css')
  const rule = m[1]
  const grab = (prop) => {
    const r = new RegExp(prop + ':([^;]+);').exec(rule)
    return r ? r[1].trim() : ''
  }
  if (!/top:var\(--ghu-top\)/.test(rule)) {
    throw new Error('panel must keep a top inset (--ghu-top); got top:' + grab('top'))
  }
  // 顶部让位量必须有具体值，不能是空变量（那样 top 会解析成无效值、面板贴到窗口顶边）
  const topVar = /--ghu-top:\s*(\d+)px/.exec(rule)
  if (!topVar || Number(topVar[1]) < 32) {
    throw new Error('--ghu-top must be a concrete inset of at least 32px; got ' + grab('--ghu-top'))
  }
  // 右/下也必须是「变量 + 有具体值」或字面量，且不能为 0（贴边就等于压住窗口角）
  const right = grab('right')
  const rightVar = /var\(--ghu-r\)/.test(right) ? /--ghu-r:\s*(\d+)px/.exec(rule) : null
  const rightPx = rightVar ? Number(rightVar[1]) : (/^(\d+)px$/.test(right) ? Number(right.replace('px', '')) : NaN)
  if (!isFinite(rightPx) || rightPx < 8) {
    throw new Error('panel right inset is not a concrete >=8px gap; got right:' + right)
  }
  if (/right:0(?![.\d])/.test(rule)) {
    throw new Error('panel is docked to the window right edge again — it would cover the desktop exit button')
  }
  // 浮层卡片要有圆角 + 主题阴影；关着的时候必须不可见且不拦点击
  if (!/border-radius:1[0-9]px/.test(rule)) throw new Error('panel is not a rounded floating card; got ' + grab('border-radius'))
  if (!/box-shadow:var\(--dsw-elevation/.test(rule)) {
    throw new Error('panel should use a DSH elevation token for its shadow; got ' + grab('box-shadow'))
  }
  if (!/opacity:0/.test(rule) || !/pointer-events:none/.test(rule)) {
    throw new Error('closed panel must be invisible and click-through')
  }
  const openRule = /#dsh-ghu-panel\.ghu-open\{([^}]*)\}/.exec(css)
  if (!openRule || !/opacity:1/.test(openRule[1]) || !/pointer-events:auto/.test(openRule[1])) {
    throw new Error('.ghu-open must restore opacity and pointer events')
  }
})

await step('the entry button is a logo-only fixed-size circle (CSS contract)', () => {
  // 防的回归：按钮尺寸一旦随状态变化（按文案自适应宽度 / hover 展开成胶囊），拖到界面边上就会
  // 「超出视口 → 被夹回 → 指针脱离 → 收起」来回抖 —— 所以尺寸必须恒定、全圆角、只有 logo。
  const cab = /#dsh-ghu-fab\{([^}]*)\}/.exec(css)
  if (!cab) throw new Error('#dsh-ghu-fab rule not found')
  const rule = cab[1]
  const px = (prop) => {
    const m = new RegExp(prop + ':(\\d+)px').exec(rule)
    return m ? Number(m[1]) : NaN
  }
  if (px('width') > 56 || px('height') > 56) {
    throw new Error('the FAB must stay a compact circle (<=56px); got width:' + px('width') + ' height:' + px('height'))
  }
  if (px('width') !== px('height')) {
    throw new Error('the FAB must be square (a circle); got ' + px('width') + 'x' + px('height'))
  }
  if (!/border-radius:(999px|50%)/.test(rule)) {
    throw new Error('the FAB must be fully round (border-radius:999px or 50%); got ' + (rule.match(/border-radius:[^;]+/) || [])[0])
  }
  // 外观必须「长在 DSH 里」：表面用主题分层底色 + elevation 阴影 + 细描边，图标用主题前景色 ——
  // GitHub 官网那种深色丸子是别的产品的外观，贴在 DSH 浅色界面旁会像一张外来贴纸。
  if (!/background:var\(--dsw-alias-bg-layer-2/.test(rule)) {
    throw new Error('the FAB surface must use the DSH layer background token, not a hardcoded brand fill')
  }
  if (!/color:var\(--dsw-alias-label-primary/.test(rule)) {
    throw new Error('the FAB icon must use the DSH foreground token')
  }
  if (!/box-shadow:var\(--dsw-elevation/.test(rule)) {
    throw new Error('the FAB must use a DSH elevation token for its shadow')
  }
  if (!/border:1px solid var\(--dsw-alias-border-l2/.test(rule)) {
    throw new Error('the FAB needs a hairline stroke, or it can disappear on a same-coloured page')
  }
  // ⚠️ 必须显式写 corner-shape:round。DSH 主题有一条全局规则：
  //   @supports (corner-shape:superellipse(1.5)){ *,:before,:after{corner-shape:var(--dsw-corner-shape)} }
  // 它把所有圆角都改成「超椭圆」；对卡片是好设计，但 border-radius:50% 的按钮会被压成圆角方块。
  // 只有支持该属性的浏览器（Chrome/Edge 139+）才会这样，老浏览器反而正常，所以极易漏掉。
  if (!/corner-shape:round/.test(rule)) {
    throw new Error('the FAB must pin corner-shape:round, or the theme squircle rule turns the circle into a rounded square')
  }
  // 状态点必须存在，且不能被圆边裁掉：按钮不能有 overflow:hidden，
  // 点要压在圆的边缘上、外面描一圈底色环，才像正经徽标。
  if (!/ghu-dot/.test(source)) throw new Error('the bound status dot is missing from the FAB')
  if (/overflow:hidden/.test(rule)) {
    throw new Error('the FAB must not clip (overflow:hidden), or the status dot on the rim gets cut')
  }
  const dot = /\.ghu-dot\{([^}]*)\}/.exec(css)
  if (!dot) throw new Error('.ghu-dot rule not found')
  if (!/position:absolute/.test(dot[1])) throw new Error('the status dot must be positioned on the rim')
  if (!/border-radius:50%/.test(dot[1])) throw new Error('the status dot must be round')
  if (!/corner-shape:round/.test(dot[1])) {
    throw new Error('the status dot also needs corner-shape:round, or it becomes a rounded square')
  }
  if (!/box-shadow:0 0 0 (1(\.\d)?|2)px/.test(dot[1])) {
    throw new Error('the status dot needs a background-coloured ring so it reads as a badge')
  }
  if (!/@media|body\[data-ds-dark-theme\]/.test(css)) {
    throw new Error('theme-specific overrides are missing')
  }
  // 任何状态（hover / active / focus / 拖动 / 面板打开）都不许改变宽高
  const stateRules = css.match(/#dsh-ghu-fab[^{]*\{[^}]*\}/g) || []
  for (const r of stateRules) {
    if (/^\s*#dsh-ghu-fab\s*\{/.test(r)) continue
    if (/(?<!max-)\bwidth:\s*(?!100%)\S/.test(r) || /\bheight:\s*\S/.test(r)) {
      throw new Error('a FAB state rule changes its size, which can cause edge jitter: ' + r.replace(/\s+/g, ' '))
    }
  }
  // 里面不能有可见文字：只允许图标与状态点
  if (/ghu-fab-label/.test(source)) {
    throw new Error('the FAB must not render a text label; the wording belongs in title / aria-label')
  }
  if (!/class: 'ghu-fab-icon'/.test(source)) throw new Error('the FAB is missing its logo span')
  if (!/aria-label/.test(source)) throw new Error('a logo-only button still needs an accessible name (aria-label)')
  if (!/\.ghu-fab-icon\{[^}]*width:3\dpx/.test(css)) {
    throw new Error('the logo should be sized to read clearly (~30-39px)')
  }
  // logo 与按钮的比例：太小会「外圈太粗」，太大标记下缘会顶到圆边。
  // viewBox 已收紧到实测墨迹范围，所以宽度可以直接拿来算比例。
  const iconW = /\.ghu-fab-icon\{[^}]*width:(\d+)px/.exec(css)
  if (!iconW) throw new Error('.ghu-fab-icon width not found')
  const ratio = px('width') / Number(iconW[1])
  if (ratio < 1.15 || ratio > 1.7) {
    throw new Error('logo/button ratio should sit between 1.15:1 and 1.7:1 (button ' +
      px('width') + 'px / logo ' + iconW[1] + 'px = ' + ratio.toFixed(2) + ':1)')
  }
  // 留白不能薄到顶边：按钮半径必须明显大于 logo 的半高
  const btnR = px('width') / 2
  const logoHalfH = Number(iconW[1]) * (23.41 / 24) / 2
  if (btnR - Math.hypot(0, logoHalfH) < 2) {
    throw new Error('the logo would touch the circle edge (clearance ' + (btnR - logoHalfH).toFixed(1) + 'px)')
  }
})

// 让 boot()/hello 的 promise 链跑完
await new Promise(r => process.nextTick(r))
await new Promise(r => setImmediate(r))

await step('open the panel (FAB pointerdown + pointerup)', () => {
  const fab = byId('dsh-ghu-fab')
  fire(fab, 'pointerdown', { button: 0 })
  fire(fab, 'pointerup', { button: 0 })
})

await step('boot finished (hello + auth-status + list-repos issued)', () => {
  const ops = requests.map(r => r.op)
  for (const need of ['hello', 'auth-status', 'list-repos']) {
    if (!ops.includes(need)) throw new Error(`no ${need} request; got: ${ops.join(',')}`)
  }
})

// 注意顺序：这两条会消耗一次「拖动」和一次「收起」，必须排在面板已经打开之后，
// 否则后面的用例看到的是一个被拖走 / 被收起的按钮。
await step('the FAB cannot be parked in the title-bar strip', () => {
  // 入口按钮可拖动：不论拖到哪、或上一次存了什么坐标，落点都必须回到下半屏。
  const fab = byId('dsh-ghu-fab')
  fire(fab, 'pointerdown', { button: 0, clientX: 1200, clientY: 850, pointerId: 1 })
  fire(fab, 'pointermove', { clientX: 1400, clientY: 4, pointerId: 1 })
  fire(fab, 'pointerup', { clientX: 1400, clientY: 4, pointerId: 1 })
  const y = parseInt(String(fab.style.top), 10)
  if (!isFinite(y)) throw new Error('FAB was not positioned absolutely after dragging: top=' + fab.style.top)
  const floor = Math.round((windowStub.innerHeight || 900) * 0.42)
  if (y < floor) throw new Error(`FAB landed in the title-bar strip: top=${y} < ${floor}`)
  const x = parseInt(String(fab.style.left), 10)
  if (!isFinite(x) || x > (windowStub.innerWidth || 1400)) {
    throw new Error('FAB x is outside the viewport: ' + fab.style.left)
  }
  const stored = JSON.parse(storage.get('dsh.ghu.pos') || 'null')
  if (!stored || typeof stored.y !== 'number' || stored.y < floor) {
    throw new Error('saved FAB position is not clamped: ' + JSON.stringify(stored))
  }
})

await step('the minimize control collapses and the FAB reopens', () => {
  const min = byId('ghu-min')
  if (!min) throw new Error('minimize button not found')
  const head = find(body, n => n.className === 'ghu-head')
  if (!head || !head.contains(min)) throw new Error('minimize button is not in the header')
  if (String(min.textContent).indexOf('×') !== -1) {
    throw new Error('minimize button uses the same glyph as close — confusing')
  }
  if (byId('dsh-ghu-panel').className.indexOf('ghu-open') === -1) {
    throw new Error('panel should be open before minimizing')
  }
  // 面板打开时入口按钮只「淡化」，尺寸不变（尺寸一变，贴边时就会抖）
  if (byId('dsh-ghu-fab').className.indexOf('ghu-fab-expand') !== -1) {
    throw new Error('panel state must not resize the FAB')
  }
  if (byId('dsh-ghu-fab').className.indexOf('ghu-dim') === -1) {
    throw new Error('open panel should dim the FAB')
  }
  fire(min, 'click')
  if (byId('dsh-ghu-panel').className.indexOf('ghu-open') !== -1) {
    throw new Error('minimize did not collapse the panel')
  }
  const fab = byId('dsh-ghu-fab')
  if (fab.className.indexOf('ghu-dim') !== -1) throw new Error('FAB stayed dimmed after the panel closed')
  fire(fab, 'pointerdown', { button: 0, clientX: 1252, clientY: 800, pointerId: 1 })
  fire(fab, 'pointerup', { clientX: 1252, clientY: 800, pointerId: 1 })
  if (byId('dsh-ghu-panel').className.indexOf('ghu-open') === -1) {
    throw new Error('the FAB no longer reopens the panel')
  }
  if (byId('dsh-ghu-fab').className.indexOf('ghu-dim') === -1) {
    throw new Error('FAB should dim while the panel is open')
  }
})

await step('switch to the Upload tab', () => {
  const tab = byText('上传')
  if (!tab) throw new Error('upload tab button not found')
  fire(tab, 'click')
})

await step('the default directory carries no JSON quotes (localStorage round-trip)', () => {
  const input = find(body, n => n.tagName === 'INPUT' && n.attrs && n.attrs.placeholder === '项目目录绝对路径')
  if (!input) throw new Error('directory input not found')
  if (String(input.value).indexOf('"') !== -1) {
    throw new Error('directory input contains quotes: ' + JSON.stringify(input.value))
  }
  if (input.value !== 'D:/proj') throw new Error('unexpected default directory: ' + JSON.stringify(input.value))
})

await step('the saved language was actually applied', () => {
  if (!byText('账号')) throw new Error('Chinese tab labels missing — saved lang was not read back')
})

await step('render the upload tab before detection resolves (the regression)', () => {
  // 再渲染一次：此时 detect 还没回来，detectCard() 会走到「没有检测结果」的分支。
  const tab = byText('上传')
  fire(tab, 'click')
  if (failures.length) throw new Error(failures.join('; '))
})

await new Promise(r => setImmediate(r))

await step('click Scan → a scan request must actually be sent', () => {
  const before = requests.filter(r => r.op === 'scan').length
  const btn = byText('扫描')
  if (!btn) throw new Error('scan button not found')
  fire(btn, 'click')
  const after = requests.filter(r => r.op === 'scan').length
  if (after === before) throw new Error('scan button did not issue a request (render() likely threw first)')
})

await new Promise(r => setImmediate(r))

await step('scan result rendered without throwing', () => {
  if (!byText('全选')) throw new Error('post-scan selection row not rendered')
})

await step('click "未上传的改动" after scanning', () => {
  const btn = byText('未上传的改动')
  if (!btn) throw new Error('pending-changes button not found')
  fire(btn, 'click')
})

await new Promise(r => setImmediate(r))

await step('the pending-changes comparison was requested (content-based, not session-based)', () => {
  const req = requests.filter(r => r.op === 'pending-files')
  if (!req.length) throw new Error('no pending-files request')
})

await new Promise(r => setImmediate(r))

await step('the comparison carries the target repo, branch and directory', () => {
  // 比对必须带上目标与分支，否则宿主只能猜（这是把"选仓库/选分支"和"比对"接起来的断言）
  const bodies = requestBodies.filter(b => b.op === 'pending-files')
  const last = bodies[bodies.length - 1]
  if (!last) throw new Error('no captured pending-files body')
  for (const k of ['owner', 'repo', 'dir', 'branch']) {
    if (!last[k]) throw new Error('pending-files must carry ' + k + ': ' + JSON.stringify(last))
  }
})

// 6) 有宿主客户端服务（uiWorkspace）时，选择器里必须有「系统对话框」入口，
//    且它真的调用 pickDirectory —— 原生选择器能去任何位置，是本插件自己列举的兜底。
await step('with the host service available, the picker offers the native system dialog', async () => {
  let picked = 0
  globalThis.window.__DSH_GHU_HOST__ = {
    pickDirectory: () => { picked++; return Promise.resolve('D:/proj/src') },
    listDirectory: (p) => Promise.resolve({ path: p || 'D:/proj', home: 'D:/proj', crumbs: [], entries: [], truncated: false }),
    createDirectory: (p) => Promise.resolve(p + '/new'),
  }
  const openBtn = byText('选择文件夹')
  if (!openBtn) throw new Error('"选择文件夹" button not found')
  fire(openBtn, 'click')
  await new Promise(r => setImmediate(r))
  const nativeBtn = byText('系统对话框')
  if (!nativeBtn) throw new Error('picker does not offer the "系统对话框" entry')
  fire(nativeBtn, 'click')
  await new Promise(r => setImmediate(r))
  await new Promise(r => setImmediate(r))
  if (picked !== 1) throw new Error('pickDirectory was not called (picked=' + picked + ')')
  const scans = requestBodies.filter(b => b.op === 'scan')
  const lastScan = scans[scans.length - 1]
  if (!lastScan || !String(lastScan.dir || '').includes('proj')) {
    throw new Error('picked directory was not scanned: ' + JSON.stringify(lastScan))
  }
  delete globalThis.window.__DSH_GHU_HOST__
})

// 7) 宿主只在 native 后端下工作时（`listDirectory` 会拒绝并说明缺少 browse 能力），
//    「选择文件夹」必须**直接用系统对话框**，而不是把一个列不出任何东西的空浏览器丢给用户。
//    这是真实发生过的故障：宿主只服务 native，内置浏览器里什么都选不了。
await step('a native-only host goes straight to the system dialog', async () => {
  let picked = 0
  let listed = 0
  globalThis.window.__DSH_GHU_HOST__ = {
    pickDirectory: () => { picked++; return Promise.resolve('D:/proj/native') },
    listDirectory: () => {
      listed++
      return Promise.reject(new Error(
        'directory browse failed: directory-picker/unavailable: directoryPicker.list needs the browse capability; the composed picker serves "native"'))
    },
    createDirectory: () => Promise.reject(new Error('unavailable')),
  }
  const openBtn = byText('选择文件夹')
  if (!openBtn) throw new Error('"选择文件夹" button not found')
  fire(openBtn, 'click')
  for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r))
  if (picked !== 1) throw new Error('native fallback did not call pickDirectory (picked=' + picked + ')')
  if (!listed) throw new Error('the browse capability was never probed')
  // 选中的目录必须被扫描
  const scans = requestBodies.filter(b => b.op === 'scan')
  const lastScan = scans[scans.length - 1]
  if (!lastScan || !String(lastScan.dir || '').includes('native')) {
    throw new Error('picked directory was not scanned: ' + JSON.stringify(lastScan))
  }
  // 不能把用户留在一个空的浏览器里
  if (byText('系统对话框')) throw new Error('the built-in browser stayed open on a native-only host')
  delete globalThis.window.__DSH_GHU_HOST__
})

await step('every border-radius:50% circle pins corner-shape:round (CSS invariant)', () => {
  /* 全局不变量，比逐个元素加断言可靠：DSH 主题有一条全局规则把所有圆角变成超椭圆，
   * 会把 50% 的正圆压成圆角方块；只有 Chrome/Edge 139+ 才触发，所以极易漏掉。
   * 已经漏过三次（FAB、状态点、头像），因此这里对**整张样式表**做检查：
   * 任何一条用了 border-radius:50% 的规则，都必须同时写 corner-shape:round。 */
  const rules = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(css))) rules.push({ body: m[2] })
  const circles = rules.filter((r) => /border-radius:\s*50%/.test(r.body))
  if (circles.length < 3) {
    throw new Error('expected at least 3 circular rules in the stylesheet, found ' + circles.length)
  }
  for (const r of circles) {
    if (!/corner-shape:\s*round/.test(r.body)) {
      throw new Error('a border-radius:50% rule is missing corner-shape:round: ' + r.body.slice(0, 80))
    }
  }
  return circles.length + ' circle rules all pinned'
})

console.log('')
if (failures.length) {
  console.log(`${failures.length} failure(s):`)
  for (const f of failures) console.log('  - ' + f)
  process.exit(1)
}
console.log(`all steps pass  (requests: ${requests.map(r => r.op).join(', ')})`)
