// 单元测试：目录列举的两层容错。
//
// 为什么必须两层：选定含受限目录（如 Windows 的 "System Volume Information"）的盘根时，
// 宿主的 directoryPicker（browse 后端）会直接抛错 → 退回 fs 列举；fs 列举内部要逐项探测，
// 读不了的标记 unreadable 而不是抛错。
//
// 用法：node scripts/test-picker.mjs
import { readFileSync } from 'node:fs'

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

const code = [
  'const BS = String.fromCharCode(92)',
  grab(host, 'function toSlashes(p)'),
  grab(host, 'function alternateRootForm(p)'),
  grab(host, 'function splitPath(p)'),
  grab(host, 'function trimListing(l)'),
  grab(host, 'async function fsListing(pathArg, lang)'),
  grab(host, 'async function listDirectories(pathArg, lang)'),
].join('\n')

const tr = (lang, key, a) => key + (a === undefined ? '' : ' [' + a + ']')
const baseCwd = async () => 'D:/'

/** 造一套 fs 服务桩：指定名字的目录会 permission denied。 */
function makeFsx(denyNames, listDirImpl) {
  return {
    resolve: async (p) => (typeof p === 'string' ? { p } : p),
    stat: async (t) => {
      const path = typeof t === 'string' ? t : (t && t.p) || ''
      if (denyNames.some((n) => path.includes(n))) throw new Error('permission denied')
      return { type: 'directory' }
    },
    processPath: (t) => (typeof t === 'string' ? t : (t && t.p) || ''),
    listDir: listDirImpl || (async () => [
      { name: 'System Volume Information', type: 'directory' },
      { name: 'dsh plugins', type: 'directory' },
    ]),
  }
}

function build(fsx, cap, diagImpl) {
  // diag（同步写文件的诊断函数）与 pickerKind（由 pickerCapability() 赋值）都来自宿主闭包，
  // 抽出来的代码引用了它们，喂不全就会报 "xxx is not defined" —— 那是桩不全，不是被测代码有问题。
  const diag = diagImpl || (() => {})
  const state = { pickerKind: 'none' }
  const capability = () => {
    state.pickerKind = cap ? cap.kind : 'none'
    return cap
  }
  const api = new Function('fsx', 'baseCwd', 'tr', 'pickerCapability', 'diag', 'pickerKind',
    code + '\nreturn { listDirectories };')(fsx, baseCwd, tr, capability, diag, 'none')
  return api
}

let failed = 0
const check = async (label, fn) => {
  try {
    const detail = await fn()
    console.log('ok    ' + label + (detail ? '  (' + detail + ')' : ''))
  } catch (e) {
    failed++
    console.log('FAIL  ' + label + '\n        ' + String(e && e.message ? e.message : e))
  }
}

// 1) 宿主选择器抛错 → 必须退回 fs 列举，并标记受限目录
await check('directoryPicker 抛错时退回 fs 列举', async () => {
  const api = build(makeFsx(['System Volume Information']), {
    kind: 'browse',
    list: async () => { throw new Error('cannot list "D:\\System Volume Information": permission denied') },
  })
  const r = await api.listDirectories('D:/', 'zh')
  if (!r || !Array.isArray(r.entries) || !r.entries.length) throw new Error('没有返回条目')
  const blocked = r.entries.filter((e) => e.unreadable)
  if (blocked.length !== 1 || blocked[0].name !== 'System Volume Information') {
    throw new Error('受限目录没有被正确标记: ' + JSON.stringify(r.entries))
  }
  if (r.fallbackFrom !== 'directoryPicker') throw new Error('没有记录兜底来源')
  return '受限 1 个，列表 ' + r.entries.length + ' 项'
})

// 2) 宿主选择器正常 → 直接用它的结果，并且补上 unreadable 标记
await check('directoryPicker 正常时采用其结果', async () => {
  const api = build(makeFsx([]), {
    kind: 'browse',
    list: async () => ({
      path: 'D:/', home: 'D:/', crumbs: [],
      entries: [{ name: 'a', path: 'D:/a', hidden: false }],
    }),
  })
  const r = await api.listDirectories('D:/', 'zh')
  if (r.entries.length !== 1) throw new Error('条目数不对')
  if (r.entries[0].unreadable !== false) throw new Error('没有补上 unreadable=false 标记')
  if (r.fallbackFrom) throw new Error('不该走兜底')
  return '宿主结果直通'
})

// 3) 没有 browse 后端 → 走本插件自己的 fs 列举，同样逐项容错
await check('无 directoryPicker 时用自己的 fs 列举', async () => {
  const api = build(makeFsx(['System Volume Information']), false)
  const r = await api.listDirectories('D:/', 'zh')
  if (r.entries.filter((e) => e.unreadable).length !== 1) throw new Error('受限目录没被标记')
  return '受限 1 个'
})

// 4) 这一层自己都读不了 → 必须抛出可读错误（那才是真的进不去）
await check('当前层不可读时抛出可读错误', async () => {
  const fsx = makeFsx([], async () => { throw new Error('access denied') })
  fsx.resolve = async () => { throw new Error('access denied') }
  const api = build(fsx, { kind: 'browse', list: async () => { throw new Error('denied') } })
  try {
    await api.listDirectories('D:/System Volume Information', 'zh')
  } catch (e) {
    if (!/dirUnreadable/.test(String(e.message))) throw new Error('错误文案不对: ' + e.message)
    return String(e.message).slice(0, 50)
  }
  throw new Error('本该抛错却成功返回了')
})

// 5) 真实语义：宿主 fs 服务连父目录 D:/ 都拒绝列（报的正是 System Volume Information 那句）
//    —— 这时应当抛出可读错误，且**两个原因都要写清楚**（宿主选择器 + 本机文件系统）
await check('父目录本身列不动时，错误里带上两层原因', async () => {
  const fsx = makeFsx([], async () => {
    throw new Error('cannot list "D:\\System Volume Information": permission denied')
  })
  const api = build(fsx, { kind: 'browse', list: async () => { throw new Error('picker denied') } })
  try {
    await api.listDirectories('D:/', 'zh')
  } catch (e) {
    const m = String(e.message)
    if (!/dirUnreadable/.test(m)) throw new Error('文案不对: ' + m)
    if (!/宿主选择器/.test(m)) throw new Error('没写宿主侧原因: ' + m)
    if (!/本机文件系统/.test(m)) throw new Error('没写 fs 侧原因: ' + m)
    return '两层原因都在'
  }
  throw new Error('本该抛错却成功返回了')
})

console.log('')
if (failed) {
  console.log(failed + ' 项失败')
  process.exit(1)
}
console.log('全部通过')
