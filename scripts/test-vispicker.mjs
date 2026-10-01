// 单元测试：可见性选择器必须是「两个选项都摆出来 + 当前项高亮」的分段控件。
//
// 为什么单独测它：可见性原来是**单选 checkbox** —— 勾选态与"公开/私密"语义对不上
// （不勾选时显示"公开"、勾选后显示"私密"），用户必须先读旁边那行文字才知道当前状态。
// 现在改成二选一的分段控件：两个选项都可见、当前项带高亮。
// 这条断言守住它不再退回勾选框。
//
// 为什么不用 scripts/test-render.mjs 测：那条路要先让设置页完成一次异步的 get-repo
// 渲染，测试时序很脆；而这里只关心选择器本身的语义，抽出函数直接测更稳。
//
// 用法：node scripts/test-vispicker.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'src', 'client.js'), 'utf8')

/* ---- 抽出需要的函数（花括号配对，避免误截到内部代码块）---- */
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

/* ---- 最小 DOM 桩 ---- */
function mkEl(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [], attrs: {}, listeners: {}, className: '', _text: '',
    setAttribute(k, v) { this.attrs[k] = String(v) },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn) },
    appendChild(c) { this.children.push(c); return c },
    get textContent() { return this._text },
    set textContent(v) { this._text = String(v) },
  }
  return el
}
const documentStub = { createElement: (t) => mkEl(t), createTextNode: (t) => ({ textContent: String(t) }) }

// 文案表：只取用到的两条
const M = {
  repoVisibility: ['可见性', 'Visibility'],
  repoPublic: ['公开', 'Public'],
  repoPrivate: ['私有', 'Private'],
  repoPublicHint: ['任何人都能看到这个仓库', 'Anyone can see this repository'],
  repoPrivateHint: ['只有你能看到这个仓库', 'Only you can see this repository'],
}
const t = (k) => (M[k] ? M[k][0] : k)

const code = [
  grab(src, 'function h(tag, props, kids)'),
  grab(src, 'function visPicker(current, onPick)'),
  grab(src, 'function visRow(current, onPick)'),
].join('\n')

const build = new Function('document', 't', code + '\nreturn { visPicker, visRow, h };')(documentStub, t)

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

const segsOf = (row) => {
  const box = row.children[0]
  return box.children
}

check('两个选项同时可见（公开 / 私有）', () => {
  const row = build.visRow(false, () => {})
  const segs = segsOf(row)
  if (segs.length !== 2) throw new Error('选项数 = ' + segs.length)
  const texts = segs.map((s) => s.textContent)
  if (texts.join(',') !== '公开,私有') throw new Error('选项文字 = ' + JSON.stringify(texts))
  return texts.join(' / ')
})

check('当前状态由高亮表达：private=false 时"公开"高亮', () => {
  const segs = segsOf(build.visRow(false, () => {}))
  const on = segs.filter((s) => /\bghu-seg-on\b/.test(s.className))
  if (on.length !== 1) throw new Error('高亮项数 = ' + on.length + '（应恰好 1）')
  if (on[0].textContent !== '公开') throw new Error('高亮的是 ' + on[0].textContent)
  return '高亮：公开'
})

check('private=true 时"私有"高亮（且仍然两个都可见）', () => {
  const segs = segsOf(build.visRow(true, () => {}))
  if (segs.length !== 2) throw new Error('选项数 = ' + segs.length + '（两个选项必须始终可见）')
  const on = segs.filter((s) => /\bghu-seg-on\b/.test(s.className))
  if (on.length !== 1 || on[0].textContent !== '私有') {
    throw new Error('高亮错误: ' + JSON.stringify(on.map((o) => o.textContent)))
  }
  return '高亮：私有'
})

check('无障碍状态与视觉状态一致（aria-checked）', () => {
  const segs = segsOf(build.visRow(true, () => {}))
  const checked = segs.filter((s) => s.attrs['aria-checked'] === 'true')
  if (checked.length !== 1) throw new Error('aria-checked=true 的数量 = ' + checked.length)
  if (checked[0].textContent !== '私有') throw new Error('aria 状态与视觉状态不一致')
  if (segs.some((s) => s.attrs.role !== 'radio')) throw new Error('选项缺少 role=radio')
  const box = build.visRow(false, () => {}).children[0]
  if (box.attrs.role !== 'radiogroup') throw new Error('容器缺少 role=radiogroup')
  return 'radiogroup + radio + aria-checked'
})

check('点击另一个选项会回调新值（并带上正确的布尔值）', () => {
  const picked = []
  const segs = segsOf(build.visRow(false, (v) => picked.push(v)))
  // 点"私有"
  segs[1].listeners.click[0]({})
  if (picked.length !== 1 || picked[0] !== true) throw new Error('回调收到 ' + JSON.stringify(picked))
  // 点已经选中的"公开"不该重复回调
  segs[0].listeners.click[0]({})
  if (picked.length !== 1) throw new Error('点击已选中项仍触发回调')
  return 'private → true，重复点击无副作用'
})

check('没有用到 checkbox（杜绝退回旧交互）', () => {
  const row = build.visRow(false, () => {})
  const stack = [row]
  while (stack.length) {
    const n = stack.pop()
    if (n.tagName === 'INPUT') throw new Error('可见性里出现了 INPUT：' + JSON.stringify(n.attrs))
    for (const c of n.children || []) stack.push(c)
  }
  return '无 INPUT 元素'
})

console.log('')
if (failed) {
  console.log(failed + ' 项失败')
  process.exit(1)
}
console.log('全部通过')
