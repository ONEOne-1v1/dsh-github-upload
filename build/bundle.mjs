/**
 * 组装可安装的 bundle
 *
 * 源文件是 src/host.js（宿主半边，真正的 ES 模块）和
 * src/client.js + src/client.css（浏览器半边，纯脚本 + 样式）。
 * 本脚本把客户端两半拼成包根的 client.js —— 一个 ModuleLoader 工件，
 * 它把界面注册到 shell.overlay 槽位；宿主半边由 index.js 直接再导出，不需要打包。
 *
 * 用法：npm run build
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PKG_NAME = '@local/dsh-github-upload'
// 界面落在这个槽位：root 作用域的框架级浮层，不需要会话就存在，replaceRisk 为 none。
const SLOT = 'shell.overlay'
const SLOT_ID = 'dsh-github-upload'

function read(rel) {
  const p = join(ROOT, rel)
  if (!existsSync(p)) throw new Error('缺少文件：' + rel)
  return readFileSync(p, 'utf8')
}

const hostSrc = read('src/host.js')
const ui = read('src/client.js')
const css = read('src/client.css')

// 客户端工件的指纹：写进 client.js，并在面板「本机环境」里显示。
// DSH 给客户端模块发的是 `cache-control: public, max-age=31536000, immutable`，
// 而模块 URL 里的 rev 只由 HMR 重算。HMR 没重算时，刷新页面拿到的还是同一个 URL，
// 浏览器就直接用那份旧缓存 —— 表现就是「重新构建了、也刷新了，界面还是旧的」。
// 面板上直接显示版本号，一眼就能分辨跑的是哪一版。
const pkg = JSON.parse(read('package.json'))
const artifactRev = createHash('sha1').update(ui).update(css).digest('hex').slice(0, 8)
const VERSION = String(pkg.version || '0.0.0') + '+' + artifactRev

// ── 预检 ────────────────────────────────────────────────────────────
if (!/\bexport function apply\b/.test(hostSrc)) {
  throw new Error('src/host.js 缺少 export function apply')
}
if (!/\bexport const inject\b/.test(hostSrc)) {
  throw new Error('src/host.js 缺少 export const inject')
}
// 客户端半边是纯脚本：用 Function 构造器只解析、不执行。
try {
  new Function(ui)
} catch (e) {
  throw new Error('src/client.js 语法错误：' + (e && e.message))
}
if (!/window\.__DSH_GHU_MOUNT__\s*=/.test(ui)) {
  throw new Error('src/client.js 没有暴露 window.__DSH_GHU_MOUNT__（槽位组件靠它挂载）')
}
if (/\bdocument\.body\.appendChild\(root\)/.test(ui)) {
  throw new Error('src/client.js 仍在往 document.body 上挂根节点 —— 必须改用槽位容器')
}

// ── 生成包根 client.js ──────────────────────────────────────────────
const out = `/* 自动生成，请勿直接编辑 / generated — do not edit directly
 * 源文件：src/client.js + src/client.css，由 build/bundle.mjs 拼装。
 * 改完源文件执行 \`npm run build\`。
 *
 * 这是个 ModuleLoader 工件：id 等于包名，factory 里返回一个只依赖 'react'
 * （来自浏览器模块表）的 Client 插件，它把界面注册到 ${SLOT}。
 */
window.__ModuleLoader__.load({
  id: '${PKG_NAME}',
  factory(require) {
    const React = require('react');
    const CSS = ${JSON.stringify(css)};
    // 工件版本：面板「本机环境」里显示，用来分辨「刷新后跑的是哪一版」
    window.__DSH_GHU_VERSION__ = ${JSON.stringify(VERSION)};

    // 槽位组件只提供一个容器；真正的界面由 src/client.js 挂进来（原生 DOM），
    // 这样已经调好的 UI 不用改写，也不会往 document.body 上塞第二个应用。
    function GithubUpload() {
      const ref = React.useRef(null);
      React.useEffect(function () {
        if (ref.current && window.__DSH_GHU_MOUNT__) window.__DSH_GHU_MOUNT__(ref.current);
      }, []);
      return React.createElement('div', { ref: ref, className: 'ghu-slot-host' });
    }

    /* ── src/client.js 原文（纯浏览器脚本，不 import 任何 Harness 包）──
     * 包成函数，由 apply() 调用；不能在 factory 阶段直接执行（见 apply 里的说明）。 */
    function mountUi() {
${ui}
    }

    return {
      /* uiWorkspace 是**必需**依赖，必须走 inject。
       *
       * 教训：它曾被从 inject 里去掉、改成 ctx.get('uiWorkspace')，结果适配器永远拿到 null，
       * 目录选择器一路报 unavailable，最后只剩"手动粘贴路径"。原因是客户端的 ctx.get()
       * 拿不到这个服务 —— 只有 inject 才能让 Cordis 把它准备好并挂到 ctx 上。
       * （当初去掉它，是因为"加了 inject 后插件整体加载失败"；但那次的真正原因是界面代码
       *   在 factory 阶段被重复执行、命中了重入保护，与这个依赖无关。修好执行时机后应还原。） */
      inject: ['slots', 'uiWorkspace'],
      apply(ctx) {
        /* ── 先装载界面脚本 ──
         * 必须在 apply() 里执行，不能放进 factory 体：
         * src/client.js 是一个自执行 IIFE，开头有“已经初始化过就直接 return”的重入保护。
         * 若它在 factory 阶段就跑过一次，apply() 里再跑只会命中那句 return ——
         * 后面的语句会被整个跳过，插件表面"已激活"但界面从不出现。 */
        try {
          mountUi()
        } catch (e) {
          console.error('[dsh-github-upload] 界面脚本装载失败：', e)
        }

        /* 把客户端服务交给 src/client.js（纯浏览器脚本，只能通过全局拿服务）。
         * 三个方法都**在调用时惰性解析**，优先用 inject 注入的 ctx.uiWorkspace：
         * 早期版本在 apply 时抓一次引用，服务未就绪就会永久拿到 undefined。 */
        function ws() {
          try { return ctx.uiWorkspace || ctx.get('uiWorkspace') || null } catch (e) { return null }
        }
        window.__DSH_GHU_HOST__ = {
          pickDirectory: function () {
            const s = ws()
            if (!s || typeof s.pickDirectory !== 'function') {
              return Promise.reject(new Error('uiWorkspace.pickDirectory is unavailable on this host'))
            }
            return s.pickDirectory()
          },
          listDirectory: function (p, signal) {
            const s = ws()
            if (!s || typeof s.listDirectory !== 'function') {
              return Promise.reject(new Error('uiWorkspace.listDirectory is unavailable on this host'))
            }
            return s.listDirectory(p, signal)
          },
          createDirectory: function (p, n) {
            const s = ws()
            if (!s || typeof s.createDirectory !== 'function') {
              return Promise.reject(new Error('uiWorkspace.createDirectory is unavailable on this host'))
            }
            return s.createDirectory(p, n)
          },
        }
        // ── src/client.css ──
        ctx.effect(function () {
          const el = document.createElement('style');
          el.setAttribute('data-plugin', '${SLOT_ID}');
          el.textContent = CSS;
          document.head.appendChild(el);
          return function () { if (el.parentNode) el.parentNode.removeChild(el); };
        });

        ctx.slots.inject('${SLOT}', function () {
          return ctx.slots.register({ name: '${SLOT}', id: '${SLOT_ID}', order: 20 }, GithubUpload);
        });
      },
    };
  },
});
`

// 生成结果是模块里的一个表达式，同样只解析不执行。
try {
  new Function(out)
} catch (e) {
  throw new Error('生成的 client.js 语法错误（这通常是拼接边界的问题）：' + (e && e.message))
}

writeFileSync(join(ROOT, 'client.js'), out, 'utf8')

const kb = (s) => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1) + ' KB'
console.log('[build] 构建完成 / build complete')
console.log('        版本 / version  ' + VERSION)
console.log('        client.js      ' + kb(out) + '  (ModuleLoader 工件，注册到 ' + SLOT + ')')
console.log('        index.js       ' + kb(read('index.js')) + '  (再导出 src/host.js)')
console.log('        src/host.js    ' + kb(hostSrc))
console.log('        src/client.js  ' + kb(ui))
console.log('        src/client.css ' + kb(css))
