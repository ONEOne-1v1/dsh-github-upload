// 单元测试：**生成的** client.js 工件要能在真实 ModuleLoader 调用约定下装载并挂载。
//
// 为什么必须单独测这个：界面源码（src/client.js）单测通过，不代表**工件**可用 ——
// 两者差了一层装载约定。真实发生过一次完整的"界面消失"故障，根因就在这层：
//   build/bundle.mjs 曾把 src/client.js 内联进 **factory 体**，于是它在 factory 阶段
//   就自执行了一次；等 apply() 里再执行同一个 IIFE 时，开头的重入保护
//   （"已初始化就直接 return"）直接命中，后面的语句被整个跳过 ——
//   插件在管理器里显示 enabled/active，但 shell.overlay 里没有它，界面从不出现，
//   而且不抛任何错误。现在 src/client.js 被包成 mountUi()，只在 apply() 里执行一次。
//
// 本测试同时覆盖：ModuleLoader.load 注册、factory 返回、apply 注册槽位、
// 以及 window.__DSH_GHU_MOUNT__ 真的可调用。
//
// 用法：node scripts/test-artifact.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const artifact = readFileSync(process.env.CLIENT_JS || join(here, '..', 'client.js'), 'utf8')

/* ---------------- 最小 DOM 桩 ---------------- */
function mkEl(tag) {
  return {
    tagName: String(tag || 'div').toUpperCase(),
    style: {}, dataset: {},
    children: [], childNodes: [],
    classList: { add() {}, remove() {}, contains: () => false },
    parentNode: null,
    _text: '',
    setAttribute(k, v) { this[k] = v },
    getAttribute(k) { return this[k] },
    removeAttribute(k) { delete this[k] },
    appendChild(c) { this.children.push(c); this.childNodes.push(c); if (c) c.parentNode = this; return c },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); this.childNodes.splice(i, 1) } return c },
    insertBefore(c) { return this.appendChild(c) },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null }, querySelectorAll() { return [] },
    getBoundingClientRect() { return { left: 0, top: 0, right: 40, bottom: 40, width: 40, height: 40, x: 0, y: 0 } },
    focus() {}, blur() {}, click() {},
    get firstChild() { return this.childNodes[0] || null },
    get textContent() { return this._text },
    set textContent(v) { this._text = String(v) },
    get innerHTML() { return '' },
    set innerHTML(v) { /* ignore */ },
  }
}
const documentStub = {
  head: mkEl('head'), body: mkEl('body'),
  createElement: (t) => mkEl(t),
  createTextNode: (t) => ({ nodeValue: t, parentNode: null }),
  getElementById: () => null,
  addEventListener() {}, removeEventListener() {},
  querySelector() { return null }, querySelectorAll() { return [] },
  documentElement: mkEl('html'),
}
const win = {
  innerWidth: 1400, innerHeight: 900, devicePixelRatio: 1,
  document: documentStub,
  addEventListener() {}, removeEventListener() {},
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { language: 'zh-CN', userAgent: 'node' },
  setTimeout: (f) => { try { f() } catch (e) { /* ignore */ } return 0 },
  clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  requestAnimationFrame: (f) => { try { f() } catch (e) { /* ignore */ } return 0 },
  cancelAnimationFrame() {},
}
globalThis.window = win
globalThis.document = documentStub
// Node 24 的 globalThis.navigator 只有 getter，必须用 defineProperty 覆盖
Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true, writable: true })
globalThis.localStorage = win.localStorage
globalThis.fetch = () => Promise.resolve({ text: () => Promise.resolve('{"ok":true,"data":{}}') })

let failed = 0
const check = (label, fn) => {
  try {
    const detail = fn()
    console.log('ok    ' + label + (detail ? '  (' + detail + ')' : ''))
  } catch (e) {
    failed++
    console.log('FAIL  ' + label + '\n        ' + String(e && e.message ? e.message : e))
  }
}
const checkAsync = async (label, fn) => {
  try {
    const detail = await fn()
    console.log('ok    ' + label + (detail ? '  (' + detail + ')' : ''))
  } catch (e) {
    failed++
    console.log('FAIL  ' + label + '\n        ' + String(e && e.message ? e.message : e))
  }
}

/* ---------------- 1) 装载工件 ---------------- */
const defs = []
win.__ModuleLoader__ = { load: (d) => defs.push(d) }

check('工件执行时向 ModuleLoader 注册了自己', () => {
  // 与 DSH 客户端运行时一致：把工件包进 async 闭包执行
  const closure = new Function('window', 'document', 'return (async () => {\n' + artifact + '\n})()')
  const p = closure(win, documentStub)
  if (defs.length !== 1) throw new Error('ModuleLoader.load 调用次数 = ' + defs.length)
  return p && typeof p.then === 'function' ? 'ModuleLoader.load ×1' : 'ModuleLoader.load ×1'
})

const def = defs[0]
check('工件的 id 等于包名', () => {
  if (!def || def.id !== '@local/dsh-github-upload') throw new Error('id = ' + (def && def.id))
  return def.id
})

/* ---------------- 2) factory ---------------- */
const React = {
  createElement: (t) => mkEl(t),
  useRef: (v) => ({ current: v === undefined ? null : v }),
  useEffect: () => {}, useState: (v) => [v, () => {}],
}
let mod = null
check('factory 返回一个 Client 插件（含 inject + apply）', () => {
  mod = def.factory((n) => (n === 'react' ? React : {}))
  if (!mod || typeof mod.apply !== 'function') throw new Error('apply 不是函数')
  if (!Array.isArray(mod.inject)) throw new Error('inject 不是数组')
  /* uiWorkspace 必须走 inject：目录选择全靠它（ctx.uiWorkspace.pickDirectory）。
   * 实测过 ctx.get('uiWorkspace') 在客户端拿不到它 —— 一旦漏掉这个依赖，
   * 目录选择器就只剩"手动粘贴路径"这一条路，而且不报错。 */
  if (!mod.inject.includes('uiWorkspace')) {
    throw new Error('uiWorkspace 必须在 inject 里（ctx.get 拿不到它）: ' + JSON.stringify(mod.inject))
  }
  if (!mod.inject.includes('slots')) throw new Error('slots 必须在 inject 里')
  return 'inject = ' + JSON.stringify(mod.inject)
})

/* ---------------- 3) apply ---------------- */
let registered = 0
let styled = 0
const handles = []
// 模拟宿主客户端服务：记录被调用的方法与参数
const wsCalls = []
const uiWorkspaceStub = {
  pickDirectory() { wsCalls.push('pickDirectory'); return Promise.resolve('D:/picked') },
  listDirectory(p) { wsCalls.push('listDirectory:' + (p || '')); return Promise.resolve({ path: p || 'D:/', home: 'D:/', crumbs: [], entries: [], truncated: false }) },
  createDirectory(p, n) { wsCalls.push('createDirectory'); return Promise.resolve(p + '/' + n) },
}
check('apply(ctx) 不抛错，并注册 shell.overlay + 注入样式', () => {
  const ctx = {
    uiWorkspace: uiWorkspaceStub,
    get: (k) => (k === 'uiWorkspace' ? uiWorkspaceStub : undefined),
    effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {} },
    slots: {
      inject(_k, cb) { const e = cb(); return typeof e === 'function' ? e : () => {} },
      register() { registered++; const h = () => {}; handles.push(h); return h },
    },
  }
  // 统计样式注入：document.head.appendChild 会被 ctx.effect 调用
  const origAppend = documentStub.head.appendChild
  documentStub.head.appendChild = function (el) { styled++; return origAppend.call(this, el) }
  try { mod.apply(ctx) } finally { documentStub.head.appendChild = origAppend }

  if (registered !== 1) throw new Error('槽位注册次数 = ' + registered + '（应为 1）')
  if (styled !== 1) throw new Error('样式注入次数 = ' + styled + '（应为 1）')
  return 'register ×1, style ×1'
})

/* ---------------- 4) 挂载入口 ---------------- */
check('window.__DSH_GHU_MOUNT__ 已暴露且可调用', () => {
  // 这一条正是那次"界面消失"的直接症状：入口没被设置，槽位组件那边只是静默跳过
  if (typeof win.__DSH_GHU_MOUNT__ !== 'function') {
    throw new Error('__DSH_GHU_MOUNT__ = ' + typeof win.__DSH_GHU_MOUNT__)
  }
  win.__DSH_GHU_MOUNT__(mkEl('div'))
  return 'typeof = function'
})

/* ---------------- 5) 宿主服务接线 ---------------- */
await checkAsync('宿主目录服务接线把 uiWorkspace 真正接上了', async () => {
  const h = win.__DSH_GHU_HOST__
  if (!h) throw new Error('__DSH_GHU_HOST__ 未设置')
  for (const k of ['pickDirectory', 'listDirectory', 'createDirectory']) {
    if (typeof h[k] !== 'function') throw new Error(k + ' 不是函数')
  }
  /* 这一条是那次"只能手动粘贴路径"的直接症状：适配器拿到了 ctx.uiWorkspace 却没用上，
   * 于是三个方法全部 reject(unavailable)。所以这里必须验证调用真的穿透到服务上。 */
  const picked = await h.pickDirectory()
  if (!wsCalls.includes('pickDirectory')) {
    throw new Error('pickDirectory 没有穿透到 uiWorkspace（适配器没接上服务）')
  }
  if (picked !== 'D:/picked') throw new Error('pickDirectory 返回值不对: ' + picked)

  await h.listDirectory('D:/x')
  if (!wsCalls.some((c) => c === 'listDirectory:D:/x')) {
    throw new Error('listDirectory 没有穿透到 uiWorkspace: ' + JSON.stringify(wsCalls))
  }
  await h.createDirectory('D:/x', 'y')
  if (!wsCalls.includes('createDirectory')) throw new Error('createDirectory 没有穿透到 uiWorkspace')
  return '三个方法都穿透到 uiWorkspace'
})

console.log('')
if (failed) {
  console.log(failed + ' 项失败')
  process.exit(1)
}
console.log('全部通过')
// 界面代码在挂载时会起轮询/定时器（真实环境里由插件生命周期回收）。
// 本测试只验证工件可装载，不需要等它们，显式退出以免 Node 因为悬挂的定时器不结束。
process.exit(0)
