// 渲染预览：把真实界面灌上假数据渲染出来，用无头浏览器截图。
//
// 目的：改样式时没有视觉反馈就只能猜。这里把 DSH 主题包里的真实 CSS 变量、
// 以及编译出来的 client.js（含新样式与真实 DOM 结构）拼成一个自包含 HTML，
// 再让 Edge/Chrome 以 --headless --screenshot 出图，肉眼就能验收。
//
// 生成的 preview.html 以 <script src> 引入 scripts/preview-host.js 与
// scripts/preview-boot.js（同目录，file:// 可直接加载），所以本文件里没有嵌套转义。
//
// 用法：
//   node scripts/preview.mjs
//   node scripts/preview.mjs --shots        # 顺带用 Edge 出全部场景的截图
//
// 本文件只是开发辅助，不参与 npm run check。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')

// 主题包位置随安装方式而变，所以按「环境变量 → 几个常见安装位置」依次探测，不写死任何一台机器。
const THEME_PKG = process.env.DSH_THEME_CSS || (() => {
  const home = homedir()
  const candidates = [
    join(home, 'AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js'),
    join(home, 'AppData/Local/pnpm/global/5/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js'),
    '/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js',
    '/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js',
  ]
  for (const p of candidates) if (existsSync(p)) return p
  return candidates[0]
})()

/** 从主题包里抽出浅色与深色两套变量，**保留它们真正的选择器**。
 *  主题包用 `body{...}`（浅色）与 `body[data-ds-dark-theme]{...}`（深色）承载变量，
 *  早先这里把选择器丢了、还按 `.dark` 猜深色类名，结果深色预览根本没生效（两个截图一模一样）。 */
function themeCss() {
  if (!existsSync(THEME_PKG)) {
    console.warn('[preview] theme package not found, using CSS fallbacks: ' + THEME_PKG)
    return ''
  }
  const t = readFileSync(THEME_PKG, 'utf8')
  // 同一个选择器在主题包里被切成好几段（还夹着别的规则），真正的变量定义是最大那一段，
  // 所以按选择器取「最长的匹配」。之前取第一段，拿到的是 2.4KB 的碎片，深色就没生效。
  const bySelector = new Map()
  for (const m of t.matchAll(/([^{}\n]{1,160})\{([^{}]*--dsw-[a-z0-9-]+:[^{}]*)\}/g)) {
    const sel = m[1].trim()
    // 变量定义块一定挂在 body / :root 这类宿主选择器上；排除掉别的组件规则
    if (!/^(body|html|:root)(\[[^\]]+\])?$/.test(sel)) continue
    const cur = bySelector.get(sel)
    if (!cur || m[2].length > cur.length) bySelector.set(sel, m[2])
  }
  if (!bySelector.size) console.warn('[preview] no theme variable blocks found in ' + THEME_PKG)
  const blocks = [...bySelector.entries()].map(([sel, body]) => ({ sel, body }))
  // 顺序很关键：通用规则（body / :root）必须排在带属性的深色覆盖规则之前，
  // 否则后来居上的浅色块会把深色覆盖掉 —— 深色预览就是这么「看起来没生效」的。
  blocks.sort((a, b) => (a.sel.length - b.sel.length))
  for (const b of blocks) {
    console.log('[preview] theme block ' + b.sel + ' (' + b.body.length + ' bytes)')
  }
  return blocks.map((b) => b.sel + '{' + b.body + '}').join('\n')
}

const client = readFileSync(join(ROOT, 'client.js'), 'utf8')
const theme = themeCss()

// 复现 DSH 主题里的全局「超椭圆」规则：
//   @supports (corner-shape:superellipse(1.5)){ *,:before,:after{corner-shape:var(--dsw-corner-shape)} }
// 它会把 border-radius:50% 的按钮压成圆角方块。无头 Edge 的老版本不支持该属性，
// 所以之前的预览一直是正圆、真机上却不是 —— 这里手工加上，让预览能复现真机。
// PREVIEW_NO_SQUIRCLE=1 可关掉，用来对比「修好之后」的样子。
const squircle = process.env.PREVIEW_NO_SQUIRCLE === '1' ? ''
  : '@supports (corner-shape:superellipse(1.5)){:root{--dsw-corner-shape:superellipse(1.5)}*,:before,:after{corner-shape:var(--dsw-corner-shape)}}\n'
console.log('[preview] squircle emulation: ' + (squircle ? 'ON (matches real DSH)' : 'OFF'))

const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>dsh-github-upload preview</title>
<style>
${theme}
${squircle}
/* 模拟 Harness 的窗口：一条标题栏 + 右上角的窗口按钮，用来验证面板有没有让开那一角 */
html,body{margin:0;height:100%;background:var(--dsw-alias-bg-base,#fff);}
.ghu-fake-app{position:fixed;inset:0;display:flex;flex-direction:column;font:13px/1.6 var(--dsw-font-family,sans-serif);color:var(--dsw-alias-label-primary,#111);}
.ghu-fake-bar{flex:0 0 auto;height:40px;display:flex;align-items:center;gap:10px;padding:0 12px;background:var(--dsw-specific-sidebar-fill,#f4f5f6);border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));}
.ghu-fake-win{margin-left:auto;display:flex;gap:6px;}
.ghu-fake-win i{width:26px;height:22px;border-radius:5px;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.07));display:block;}
.ghu-fake-win i.x{background:var(--dsw-static-red-500,#ef4444);}
.ghu-fake-body{flex:1 1 auto;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#999);}
#ghu-boot-error{position:fixed;left:0;bottom:0;max-width:60vw;max-height:40vh;overflow:auto;margin:0;padding:8px;background:#fee2e2;color:#7f1d1d;font:11px/1.5 monospace;white-space:pre-wrap;z-index:9;}
</style>
</head>
<body>
<script>document.documentElement.setAttribute('data-probe0','ran-at-top');</script>
<div class="ghu-fake-app">
  <div class="ghu-fake-bar"><b>DSH</b>
    <span style="opacity:.6">（背景是模拟的 Harness 窗口，右上角方块 = 窗口按钮）</span>
    <span class="ghu-fake-win"><i></i><i></i><i class="x"></i></span>
  </div>
  <div class="ghu-fake-body">页面内容</div>
</div>
// 预览的辅助脚本放在 scripts/ 下；生成的 preview.html 在仓库根，所以 src 要带 scripts/ 前缀
// （file:// 或 http:// 都按相对路径解析，两边都能加载）。
<script src="./scripts/preview-host.js"></script>
<script src="./scripts/preview-env.js"></script>
<script>
/* 内联探针：外部脚本是否加载、以及 bundle 是否跑过 —— 都直接反映到 body 前部 */
(function () {
  var d = document.createElement('pre');
  d.id = 'ghu-probe';
  d.style.cssText = 'position:fixed;left:0;top:0;z-index:99;margin:0;padding:2px 6px;font:11px monospace;background:#fde68a;color:#78350f;';
  d.textContent = 'probe1 hostScript=' + (typeof window.__GHU_PREVIEW_SCENARIO__) +
    ' loaderStub=' + (typeof window.__ModuleLoader__);
  document.body.appendChild(d);
})();
</script>
<script>
${client}
</script>
<script>
(function () {
  var d = document.getElementById('ghu-probe');
  if (d) d.textContent += ' | bundleRan=' + (typeof window.__DSH_GHU_MOUNT__) +
    ' fab=' + !!document.getElementById('dsh-ghu-fab');
})();
</script>
<script src="./scripts/preview-boot.js"></script>
</body>
</html>
`

const out = join(ROOT, 'preview.html')
writeFileSync(out, html, 'utf8')
console.log('[preview] wrote ' + out + ' (' + (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KB)')
console.log('[preview] scenarios: account | repo | upload | settings | picker | tree | running')

if (process.argv.includes('--shots')) {
  // 浏览器位置按平台常见路径探测，可用 EDGE / CHROME 环境变量覆盖。
  const known = process.platform === 'win32'
    ? [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    ]
    : [
      '/usr/bin/microsoft-edge', '/usr/bin/google-chrome',
      '/usr/bin/chromium', '/usr/bin/chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ]
  const explicit = process.env.EDGE || process.env.CHROME || ''
  const found = explicit && existsSync(explicit) ? explicit : known.find((p) => existsSync(p))
  const browser = found || ''
  if (!browser) {
    console.warn('[preview] no headless browser found; skipping shots')
  } else {
    const shots = join(ROOT, 'shots')
    mkdirSync(shots, { recursive: true })
    const url = 'file:///' + out.replace(/\\/g, '/').replace(/ /g, '%20')
    for (const s of ['upload', 'account', 'repo', 'settings', 'picker']) {
      const png = join(shots, s + '.png')
      execFileSync(browser, [
        '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
        '--window-size=1440,900', '--screenshot=' + png, '--virtual-time-budget=4000',
        url + '?s=' + s,
      ], { stdio: 'ignore' })
      console.log('[preview] shot ' + png)
    }
  }
}
