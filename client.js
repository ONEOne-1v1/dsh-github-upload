/* 自动生成，请勿直接编辑 / generated — do not edit directly
 * 源文件：src/client.js + src/client.css，由 build/bundle.mjs 拼装。
 * 改完源文件执行 `npm run build`。
 *
 * 这是个 ModuleLoader 工件：id 等于包名，factory 里返回一个只依赖 'react'
 * （来自浏览器模块表）的 Client 插件，它把界面注册到 shell.overlay。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-github-upload',
  factory(require) {
    const React = require('react');
    const CSS = "/* dsh-github-upload — 面板样式\n *\n * 设计原则：颜色、阴影、圆角、字号一律走 DSH 的主题变量，因此自动跟随浅色/深色主题，\n * 看上去和 Harness 自己的界面是同一套语言。用的都是**真实存在**的 token\n * （可用 cordis_inspect_query platform=client provider=Theme 复核）：\n *   表面 --dsw-alias-bg-base / -bg-layer-1..3 / -bg-overlay；文字 --dsw-alias-label-primary / -secondary / -tertiary / -dimmed / -primary-foreground\n *   描边 --dsw-alias-border-l1..l3；交互 --dsw-alias-interactive-bg-hover / -solid / -active / -hover-accent / -hover-danger\n *   语义 --dsw-alias-brand-primary / -state-error-primary / -state-success-primary / -state-warn-primary\n *   阴影 --dsw-elevation-panel / -prominent / -soft（自带描边，所以边框可以省略）；字体 --dsw-font-family、--dsw-font-mono\n * 取不到变量时（单独打开本文件调试）才回退到后面的字面量。\n */\n\n/* ---------- 挂载与指针事件 ----------\n * shell.overlay 整层是 click-through 的，条目必须自己把可点区域收回来：\n * 容器与根节点穿透，只有真正的交互元素 auto。 */\n.ghu-slot-host{position:fixed;inset:0;pointer-events:none;}\n#dsh-ghu-root{pointer-events:none;}\n#dsh-ghu-fab,#dsh-ghu-panel,.ghu-toast,.ghu-backdrop{pointer-events:auto;}\n#dsh-ghu-root,#dsh-ghu-root *{box-sizing:border-box;}\n#dsh-ghu-root *::-webkit-scrollbar{width:9px;height:9px;}\n#dsh-ghu-root *::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2,rgba(0,0,0,.22));border-radius:999px;border:2px solid transparent;background-clip:padding-box;}\n#dsh-ghu-root *::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l2,rgba(0,0,0,.36));background-clip:padding-box;}\n#dsh-ghu-root *::-webkit-scrollbar-track{background:transparent;}\n\n/* ---------- 入口按钮 ----------\n *\n * 一枚正圆按钮：里面只有 GitHub logo + 一枚「已绑定」状态点，没有任何文字。\n *\n * **为什么不像 GitHub 官网那样做深色丸子**：那是 GitHub 的品牌语言；而 DSH 通篇是浅色、\n * 超椭圆、0.5px 描边、淡阴影。所以这里改用 **DSH 自己的语言**：\n *   · 表面 = bg-layer-2 + elevation token（和面板、卡片同一套阴影与描边），\n *   · 图标 = label-primary（和正文同一个前景色），\n *   · hover = interactive-bg-hover-solid，和 DSH 其它按钮的反馈一致。\n * 它是「DSH 里的一枚浮层按钮」，恰好印着 GitHub 的标记，而不是「GitHub 的按钮」。\n *\n * 形态约束：\n *   · 正圆 + 尺寸恒定 —— 按钮能拖到界面最边上，只要 hover 会变形，贴边时就会\n *     「超出视口 → 被夹回 → 指针脱离 → 收起」来回抖，拖不动也点不准；\n *   · `overflow` 保持 visible —— 右下角的状态点压在圆的边缘上，外面描一圈底色环，\n *     像正经通知徽标；裁掉它就会显得脏；\n *   · logo 占按钮直径约 2/3，避免「外圈太粗、里面 logo 显小」。\n * 「上传到 GitHub」的完整说明在 title / aria-label 里，不进 DOM。\n *\n * ⚠️ 必须显式写 `corner-shape:round`。DSH 主题里有一条全局规则\n *   （dsh-client-ui-theme → corner-shape.css）：\n *   @supports (corner-shape:superellipse(1.5)){ *,:before,:after{corner-shape:var(--dsw-corner-shape)} }\n * 它把所有圆角都变成「超椭圆（squircle）」。对卡片是好设计，但会把 border-radius:50%\n * 的正圆压成**圆角方块** —— 只有支持该属性的浏览器（Chrome/Edge 139+）才会这样，\n * 所以老浏览器反而正常，极易漏掉。圆点（.ghu-dot）同理。 */\n#dsh-ghu-fab{\n  position:fixed;z-index:2147483000;display:inline-flex;align-items:center;justify-content:center;\n  width:46px;height:46px;padding:0;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));border-radius:50%;\n  corner-shape:round;\n  background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,#fff));\n  color:var(--dsw-alias-label-primary,#111);\n  cursor:grab;\n  box-shadow:var(--dsw-elevation-prominent,0 1px 2px rgba(0,0,0,.14),0 6px 18px rgba(0,0,0,.16));\n  user-select:none;-webkit-user-select:none;\n  transition:transform .16s cubic-bezier(.4,0,.2,1),box-shadow .16s ease,background .16s ease,opacity .16s ease;\n}\n#dsh-ghu-fab:hover{\n  background:var(--dsw-alias-interactive-bg-hover-solid,var(--dsw-alias-bg-layer-3,#f1f3f5));\n  transform:translateY(-1px);\n}\n#dsh-ghu-fab:active{transform:translateY(0) scale(.97);}\n#dsh-ghu-fab.ghu-dragging{cursor:grabbing;transform:scale(1.05);}\n#dsh-ghu-fab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:3px;}\n\n/* 图标容器：relative，作为状态点的定位基准（状态点要压在圆的右下边缘上）。 */\n.ghu-fab-wrap{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;color:inherit;}\n\n/* GitHub logo：按钮 46px、图标 30px —— 图标的 width **等于可见标记的宽度**\n * （`GH_ICON` 的 viewBox 已收紧到 getBBox 实测墨迹范围 0,0.5,24,23.41），所以留白可以直接算：\n *   横向留白 = (46 − 30) / 2 = 8px；纵向墨迹高 30 × 23.41/24 ≈ 29.3px，留白 ≈ 8.3px。\n *   而 46px 圆的半径 23px 对 30px 宽的标记有 0.5·√(46² − 30²) ≈ 17.4px 的纵向可用量，\n *   29.3px 完全放得下，不会顶边。\n * ⚠️ 约束来自横向：字形横向占满 viewBox，所以先到界的是左右两侧，不是内接正方形。 */\n.ghu-fab-icon{display:block;width:30px;height:30px;color:inherit;}\n.ghu-fab-icon svg{display:block;width:100%;height:100%;fill:currentColor;}\n\n/* 「已绑定」状态点：直径 9px、环 1.5px —— 尺寸和描边都收一点，避免那枚绿点在\n * 浅色按钮上喧宾夺主。圆心落在圆的 45° 边缘上：\n * 环外沿不越出按钮太多，正好压在轮廓线上。 */\n.ghu-dot{\n  position:absolute;right:-11px;bottom:-11px;width:9px;height:9px;border-radius:50%;\n  corner-shape:round;\n  background:var(--dsw-alias-state-success-primary,#22c55e);\n  box-shadow:0 0 0 1.5px var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,#fff)),0 1px 2px rgba(0,0,0,.18);\n  display:none;\n}\n#dsh-ghu-fab.ghu-bound .ghu-dot{display:block;}\nbody[data-ds-dark-theme] .ghu-dot{box-shadow:0 0 0 1.5px var(--dsw-alias-bg-layer-2,#1b1b1c),0 1px 2px rgba(0,0,0,.35);}\n\n/* 面板打开时入口按钮淡出但仍可点（再点一次收起面板）；只改透明度，不改尺寸 */\n#dsh-ghu-fab.ghu-dim{opacity:.5;}\n#dsh-ghu-fab.ghu-dim:hover{opacity:1;}\n\n/* ---------- 浮层面板 ----------\n * 桌面端窗口的关闭/最小化/退出键在窗口右上角，所以面板四边都留空隙、顶部让出标题栏\n * （--ghu-top），关闭键放在面板右下角 —— 窗口那一角永远不被覆盖。 */\n#dsh-ghu-panel{\n  --ghu-top:52px;\n  --ghu-r:14px;\n  position:fixed;top:var(--ghu-top);right:var(--ghu-r);bottom:var(--ghu-r);\n  width:min(520px,calc(100vw - 28px));\n  max-height:calc(100vh - var(--ghu-top) - var(--ghu-r));\n  z-index:2147483001;display:flex;flex-direction:column;\n  border-radius:16px;overflow:hidden;\n  background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#111);\n  box-shadow:var(--dsw-elevation-panel,0 18px 50px rgba(0,0,0,.28));\n  font:400 13px/1.6 var(--dsw-font-family,-apple-system,'Segoe UI',sans-serif);\n  opacity:0;pointer-events:none;transform:translateY(10px) scale(.985);\n  transition:opacity .16s ease,transform .16s cubic-bezier(.4,0,.2,1);\n}\n#dsh-ghu-panel.ghu-open{opacity:1;pointer-events:auto;transform:none;}\n\n/* 窄窗口：让出侧边空隙，面板铺满可用宽度 */\n@media (max-width:560px){\n  #dsh-ghu-panel{--ghu-r:8px;width:calc(100vw - 16px);}\n}\n\n/* ---------- 头部 ---------- */\n.ghu-head{\n  position:relative;flex:0 0 auto;display:flex;align-items:center;gap:8px;\n  padding:11px 14px;\n  background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base,#fafafa));\n  border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.07));\n}\n.ghu-head .ghu-ttl{\n  flex:1;min-width:0;font:600 14px/1.3 var(--dsw-font-family,inherit);\n  letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\n}\n.ghu-sub{flex:0 0 auto;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a);letter-spacing:.02em;}\n\n/* 收起键在最左侧（远离窗口右上角）。可点区域只限它自己的盒子 ——\n * 否则整条标题栏会变成一块挡住下层界面的热区。 */\n.ghu-minbtn{\n  flex:0 0 auto;width:26px;height:26px;padding:0;border:0;border-radius:8px;background:transparent;\n  color:var(--dsw-alias-label-secondary,#555);font:600 14px/1 inherit;cursor:pointer;\n  display:inline-flex;align-items:center;justify-content:center;pointer-events:auto;\n  transition:background .15s ease,color .15s ease;\n}\n.ghu-minbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.07));color:var(--dsw-alias-label-primary,#111);}\n.ghu-minbtn:active{background:var(--dsw-alias-interactive-bg-active,rgba(0,0,0,.11));}\n.ghu-minbtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:1px;}\n\n/* ---------- 标签页 ---------- */\n.ghu-tabs{\n  flex:0 0 auto;display:flex;gap:2px;padding:8px 10px;\n  background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base,#fafafa));\n  border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.07));\n}\n.ghu-tab{\n  flex:1 1 0;min-width:0;border:0;background:transparent;border-radius:8px;\n  color:var(--dsw-alias-label-secondary,#5b5b5b);\n  font:500 13px/1 var(--dsw-font-family,inherit);\n  padding:7px 4px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\n  transition:background .15s ease,color .15s ease;\n}\n.ghu-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#111);}\n.ghu-tab.ghu-on{background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#111);box-shadow:var(--dsw-elevation-soft,0 1px 2px rgba(0,0,0,.1));}\n.ghu-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:-2px;}\n\n/* ---------- 主体滚动区 + 分节 ---------- */\n.ghu-body{flex:1 1 auto;overflow:auto;padding:14px;scrollbar-gutter:stable;}\n.ghu-body > *:first-child{margin-top:0;}\n\n.ghu-sec{\n  margin:0 0 12px;padding:12px 13px;border-radius:12px;\n  background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base,#fafafa));\n  border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.07));\n}\n.ghu-sec > h4{\n  margin:0 0 10px;padding-bottom:7px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));\n  font:600 11px/1.2 var(--dsw-font-family,inherit);color:var(--dsw-alias-label-tertiary,#8a8a8a);\n  text-transform:uppercase;letter-spacing:.07em;\n}\n.ghu-sec > h4:only-child{margin-bottom:0;border-bottom:0;padding-bottom:0;}\n.ghu-sec > *:last-child{margin-bottom:0;}\n\n/* ---------- 表单控件 ---------- */\n.ghu-input,.ghu-textarea{\n  width:100%;padding:8px 10px;border-radius:9px;\n  border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.14));\n  background:var(--dsw-alias-bg-base,var(--dsw-specific-input-major,#fff));\n  color:var(--dsw-alias-label-primary,#111);\n  font:13px/1.4 var(--dsw-font-family,inherit);outline:none;\n  transition:border-color .15s ease,box-shadow .15s ease,background .15s ease;\n}\n.ghu-input::placeholder,.ghu-textarea::placeholder{color:var(--dsw-alias-label-dimmed,#a0a0a0);}\n.ghu-input:hover,.ghu-textarea:hover{border-color:var(--dsw-alias-border-l3,rgba(0,0,0,.2));}\n.ghu-input:focus,.ghu-textarea:focus{\n  border-color:var(--dsw-alias-brand-primary,#2563eb);\n  box-shadow:0 0 0 3px var(--dsw-alias-interactive-bg-hover-accent,rgba(37,99,235,.14));\n}\n.ghu-input[disabled],.ghu-textarea[disabled]{opacity:.6;cursor:not-allowed;}\n.ghu-textarea{min-height:64px;resize:vertical;}\n\n.ghu-lbl{display:block;font:500 12px/1.3 var(--dsw-font-family,inherit);color:var(--dsw-alias-label-secondary,#5b5b5b);margin:12px 0 5px;}\n.ghu-sec > .ghu-lbl:first-of-type{margin-top:0;}\n\n/* ---------- 按钮 ---------- */\n.ghu-btn{\n  display:inline-flex;align-items:center;justify-content:center;gap:6px;\n  height:31px;padding:0 12px;border-radius:9px;\n  border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.14));background:transparent;\n  color:var(--dsw-alias-label-primary,#111);font:500 12.5px/1 var(--dsw-font-family,inherit);\n  cursor:pointer;white-space:nowrap;\n  transition:background .15s ease,border-color .15s ease,opacity .15s ease,transform .1s ease;\n}\n.ghu-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));border-color:var(--dsw-alias-border-l3,rgba(0,0,0,.2));}\n.ghu-btn:active{background:var(--dsw-alias-interactive-bg-active,rgba(0,0,0,.1));transform:translateY(.5px);}\n.ghu-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:1px;}\n\n.ghu-btn.ghu-primary{\n  background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#2563eb));\n  border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff);\n  box-shadow:var(--dsw-elevation-soft,0 1px 2px rgba(0,0,0,.12));\n}\n.ghu-btn.ghu-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#1d4ed8));opacity:1;}\n.ghu-btn.ghu-danger{color:var(--dsw-alias-state-error-primary,#c00);border-color:var(--dsw-alias-state-error-primary,rgba(204,0,0,.5));}\n.ghu-btn.ghu-danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger,rgba(204,0,0,.08));border-color:var(--dsw-alias-state-error-primary,#c00);}\n.ghu-btn[disabled]{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none;}\n.ghu-btn[disabled]:hover{background:transparent;border-color:var(--dsw-alias-border-l2,rgba(0,0,0,.14));}\n.ghu-btn.ghu-primary[disabled]:hover{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#2563eb));}\n\n.ghu-iconbtn{\n  border:0;background:transparent;color:var(--dsw-alias-label-secondary,#5b5b5b);\n  width:28px;height:28px;border-radius:8px;font-size:17px;line-height:1;cursor:pointer;\n  display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;\n  transition:background .15s ease,color .15s ease;\n}\n.ghu-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-primary,#111);}\n.ghu-iconbtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:1px;}\n\n/* ---------- 排版与语义色 ---------- */\n.ghu-row{display:flex;gap:8px;align-items:center;}\n.ghu-row + .ghu-row{margin-top:8px;}\n.ghu-grow{flex:1 1 auto;min-width:0;}\n.ghu-muted{color:var(--dsw-alias-label-secondary,#5b5b5b);font-size:12px;}\n.ghu-ok{color:var(--dsw-alias-state-success-primary,#16a34a);font-size:12px;}\n.ghu-link{color:var(--dsw-alias-link,var(--dsw-alias-state-business-primary,#2563eb));word-break:break-all;text-decoration:none;}\n.ghu-link:hover{text-decoration:underline;}\n\n.ghu-err{\n  color:var(--dsw-alias-state-error-primary,#c00);\n  background:var(--dsw-alias-state-error-tertiary,rgba(220,0,0,.08));\n  border-radius:10px;padding:9px 11px;margin-bottom:10px;font-size:12px;line-height:1.6;word-break:break-word;\n}\n.ghu-warn{\n  color:var(--dsw-alias-label-primary,#111);background:var(--dsw-alias-state-warn-tertiary,rgba(245,158,11,.1));\n  border:1px solid var(--dsw-alias-state-warn-primary,rgba(245,158,11,.4));\n  border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:12px;line-height:1.65;\n}\n.ghu-warn b{color:var(--dsw-alias-label-primary,#111);}\n.ghu-warn ul{margin:6px 0 0;padding-left:18px;}\n.ghu-warn li{margin:3px 0;}\n\n.ghu-diag{\n  font:400 11.5px/1.65 var(--dsw-font-mono,var(--dsw-font-family,ui-monospace,Consolas,monospace));\n  color:var(--dsw-alias-label-tertiary,#8a8a8a);margin-top:8px;white-space:pre-wrap;word-break:break-word;\n}\n\n/* ---------- 卡片与列表 ---------- */\n.ghu-card{\n  border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:11px;\n  padding:10px 12px;margin-bottom:8px;cursor:pointer;\n  background:var(--dsw-alias-bg-base,#fff);\n  transition:background .15s ease,border-color .15s ease,box-shadow .15s ease;\n}\n.ghu-card:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));border-color:var(--dsw-alias-border-l2,rgba(0,0,0,.18));}\n.ghu-card.ghu-on{\n  border-color:var(--dsw-alias-brand-primary,#2563eb);\n  box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary,#2563eb);\n  background:var(--dsw-alias-interactive-bg-hover-accent,rgba(37,99,235,.06));\n}\n\n.ghu-repolist{\n  max-height:320px;overflow:auto;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));\n  border-radius:12px;padding:6px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base,#fafafa));\n}\n.ghu-repolist .ghu-card:last-child{margin-bottom:0;}\n\n.ghu-tag{\n  display:inline-block;font:500 11px/1.7 var(--dsw-font-family,inherit);\n  padding:0 8px;border-radius:999px;margin-left:6px;\n  background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06)));\n  color:var(--dsw-alias-label-secondary,#5b5b5b);\n  border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));\n}\n.ghu-acct{display:flex;align-items:center;gap:10px;}\n.ghu-acct img{width:36px;height:36px;border-radius:50%;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));}\n\n.ghu-kv{display:flex;justify-content:space-between;gap:12px;font-size:12px;padding:3px 0;}\n.ghu-kv > span:first-child{color:var(--dsw-alias-label-secondary,#5b5b5b);}\n.ghu-switch{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,#5b5b5b);cursor:pointer;user-select:none;}\n.ghu-switch:hover{color:var(--dsw-alias-label-primary,#111);}\n\n/* ---------- 文件树 ---------- */\n.ghu-tree{\n  border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:12px;\n  max-height:286px;overflow:auto;padding:5px;\n  background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base,#fafafa));\n  font:400 12px/1.5 var(--dsw-font-mono,var(--dsw-font-family,ui-monospace,Consolas,monospace));\n}\n.ghu-frow{display:flex;align-items:center;gap:6px;padding:2px 6px;border-radius:7px;white-space:nowrap;}\n.ghu-frow:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));}\n.ghu-fname{overflow:hidden;text-overflow:ellipsis;}\n.ghu-fsize{margin-left:auto;color:var(--dsw-alias-label-tertiary,#8a8a8a);font-size:11px;padding-left:8px;font-variant-numeric:tabular-nums;}\n.ghu-drow .ghu-fname{font-weight:600;}\n.ghu-ignored .ghu-fname{color:var(--dsw-alias-label-dimmed,#a8a8a8);text-decoration:line-through;}\n.ghu-caret{\n  cursor:pointer;flex:0 0 auto;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;\n  color:var(--dsw-alias-label-secondary,#6b6b6b);border-radius:5px;transition:background .15s ease,color .15s ease;\n}\n.ghu-caret:hover{background:var(--dsw-alias-interactive-bg-hover-solid,rgba(0,0,0,.08));color:var(--dsw-alias-label-primary,#111);}\n.ghu-caret svg{display:block;width:9px;height:9px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}\n.ghu-cb{flex:0 0 auto;margin:0;width:14px;height:14px;accent-color:var(--dsw-alias-brand-primary,#2563eb);cursor:pointer;}\n#dsh-ghu-root .ghu-cb:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:2px;}\n\n/* 会话标记：本聊天里动过的文件 */\n.ghu-mark{flex:0 0 auto;width:7px;height:7px;border-radius:50%;display:inline-block;}\n.ghu-mark-written{background:var(--dsw-alias-state-success-primary,#22c55e);}\n.ghu-mark-edited{background:var(--dsw-alias-state-business-primary,#2563eb);}\n.ghu-mark-read{background:var(--dsw-alias-label-tertiary,#999);opacity:.55;}\n.ghu-mark-searched{background:var(--dsw-alias-label-dimmed,#ccc);}\n\n/* ---------- 上传进度 ---------- */\n.ghu-bar{height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.1)));overflow:hidden;margin:8px 0;}\n.ghu-bar > i{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary,#2563eb);transition:width .25s ease;}\n.ghu-log{\n  font:400 11px/1.6 var(--dsw-font-mono,var(--dsw-font-family,ui-monospace,Consolas,monospace));\n  white-space:pre-wrap;max-height:158px;overflow:auto;\n  background:var(--dsw-alias-markdown-code-block,#f5f5f5);border-radius:10px;padding:9px 10px;margin-top:9px;\n  color:var(--dsw-alias-label-secondary,#4a4a4a);\n}\n\n/* ---------- 提示条 ---------- */\n.ghu-toast{\n  position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:2147483002;\n  background:var(--dsw-alias-toast-bg,#2b2b2b);color:var(--dsw-alias-label-primary-foreground,#fff);\n  padding:10px 16px;border-radius:11px;\n  font:400 13px/1.45 var(--dsw-font-family,inherit);\n  box-shadow:var(--dsw-elevation-prominent,0 8px 26px rgba(0,0,0,.3));\n  max-width:70vw;\n  animation:ghu-rise .18s cubic-bezier(.4,0,.2,1);\n}\n@keyframes ghu-rise{from{opacity:0;transform:translate(-50%,8px);}to{opacity:1;transform:translate(-50%,0);}}\n\n/* ---------- 底部页脚 + 控制条 ---------- */\n.ghu-foot{\n  flex:0 0 auto;display:flex;gap:8px;align-items:center;padding:10px 14px;\n  border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.07));\n  background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base,#fafafa));\n}\n.ghu-foot:empty{display:none;}\n\n/* 语言开关与关闭键统一放在右下角 —— 那里不会被任何窗口装饰遮挡 */\n.ghu-panelctl{\n  flex:0 0 auto;display:flex;align-items:center;justify-content:flex-end;gap:8px;\n  padding:9px 14px calc(9px + env(safe-area-inset-bottom,0px));\n  border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.07));\n  background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base,#fafafa));\n}\n.ghu-panelctl::before{\n  content:'GitHub';flex:1 1 auto;min-width:0;\n  font:600 10.5px/1 var(--dsw-font-family,inherit);letter-spacing:.09em;text-transform:uppercase;\n  color:var(--dsw-alias-label-dimmed,#b0b0b0);\n}\n.ghu-closebtn{min-width:76px;justify-content:center;}\n\n/* ---------- 文件夹浏览器（内置） ---------- */\n.ghu-backdrop{\n  position:fixed;inset:0;z-index:2147483010;display:flex;align-items:center;justify-content:center;\n  background:var(--dsw-alias-bg-mask-3,rgba(0,0,0,.48));\n  animation:ghu-fade .14s ease;\n}\n@keyframes ghu-fade{from{opacity:0;}to{opacity:1;}}\n.ghu-modal{\n  width:680px;max-width:94vw;max-height:84vh;display:flex;flex-direction:column;overflow:hidden;\n  background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base,#fff));color:var(--dsw-alias-label-primary,#111);\n  border-radius:14px;box-shadow:var(--dsw-elevation-prominent,0 24px 60px rgba(0,0,0,.35));\n  font:400 13px/1.55 var(--dsw-font-family,-apple-system,'Segoe UI',sans-serif);\n}\n.ghu-modal-head{\n  flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:12px 14px;\n  border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.07));\n}\n.ghu-modal-head .ghu-ttl{flex:1;font:600 14px/1.3 var(--dsw-font-family,inherit);}\n.ghu-modal-tools{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px 0;}\n.ghu-chip{height:26px;padding:0 10px;border-radius:999px;font-size:12px;}\n.ghu-crumbs{\n  flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:1px;padding:9px 14px 0;\n  font:400 12px/1.5 var(--dsw-font-mono,var(--dsw-font-family,ui-monospace,Consolas,monospace));\n}\n.ghu-crumb{cursor:pointer;color:var(--dsw-alias-link,var(--dsw-alias-state-business-primary,#2563eb));padding:1px 4px;border-radius:6px;}\n.ghu-crumb:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));text-decoration:underline;}\n.ghu-crumb-sep{color:var(--dsw-alias-label-dimmed,#b0b0b0);}\n.ghu-pathbar{\n  flex:0 0 auto;margin:8px 14px 0;padding:7px 10px;border-radius:9px;\n  background:var(--dsw-alias-markdown-code-block,#f5f5f5);\n  font:400 12px/1.5 var(--dsw-font-mono,var(--dsw-font-family,ui-monospace,Consolas,monospace));\n  word-break:break-all;color:var(--dsw-alias-label-secondary,#4a4a4a);\n}\n.ghu-modal-list{\n  flex:1 1 auto;overflow:auto;margin:10px 14px;min-height:180px;\n  border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:11px;padding:4px;\n  background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base,#fafafa));\n}\n.ghu-dirrow{\n  display:flex;align-items:center;gap:9px;padding:6px 9px;border-radius:8px;cursor:pointer;margin:1px 0;\n  transition:background .15s ease;\n}\n.ghu-dirrow:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));}\n.ghu-diricon{flex:0 0 auto;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#8a8a8a);}\n.ghu-diricon svg{display:block;width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}\n.ghu-hiddenrow{opacity:.55;}\n/* 受限目录（Windows 的 System Volume Information / WindowsApps 等）：可见但不可进入。\n * 宿主侧已逐项探测并标了 unreadable，所以它不会让整个列表失败。 */\n.ghu-blockedrow{opacity:.5;cursor:not-allowed;}\n.ghu-blockedrow:hover{background:transparent;}\n.ghu-blockedrow .ghu-diricon{color:var(--dsw-alias-state-warn-primary,#b45309);}\n.ghu-modal-foot{\n  flex:0 0 auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:11px 14px;\n  border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.07));\n}\n\n/* ---------- 语言开关 ---------- */\n.ghu-lang{\n  display:inline-flex;flex:0 0 auto;padding:2px;gap:2px;border-radius:999px;\n  background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06)));\n  border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));\n}\n.ghu-langbtn{\n  border:0;background:transparent;border-radius:999px;\n  color:var(--dsw-alias-label-secondary,#5b5b5b);\n  font:500 11px/1 var(--dsw-font-family,inherit);padding:5px 10px;cursor:pointer;\n  transition:background .15s ease,color .15s ease;\n}\n.ghu-langbtn:hover{color:var(--dsw-alias-label-primary,#111);}\n.ghu-langbtn.ghu-on{\n  background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#111);\n  box-shadow:var(--dsw-elevation-soft,0 1px 2px rgba(0,0,0,.12));\n}\n.ghu-langbtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#2563eb);outline-offset:1px;}\n";
    // 工件版本：面板「本机环境」里显示，用来分辨「刷新后跑的是哪一版」
    window.__DSH_GHU_VERSION__ = "1.0.1+b9bd75bd";

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
/* dsh-github-upload — 浏览器端 UI
 *
 * 纯浏览器脚本：不 import 任何 Harness 包，只用原生 DOM。
 * build/bundle.mjs 把它连同 src/client.css 内联进包根的 client.js（ModuleLoader 工件），
 * 由页面注册到 shell.overlay 槽位。
 *
 * 挂载约定：不自己往 document.body 上挂，而是暴露
 * window.__DSH_GHU_MOUNT__(containerEl)，由槽位组件把容器交进来。
 *
 * 文案与语言：面向用户的文案都在下面的 M 表里，每条 [中文, English]；
 * 语言存在 localStorage（dsh.ghu.lang），首次按浏览器语言猜，
 * 每次 api() 都会带上 lang，宿主用自己的文案表回话。
 *
 * 与宿主通信：fetch('/dsh-gh/api', {op, lang, ...}) -> {ok, data|error}
 */
(function () {
  if (window.__DSH_GHU__) return;
  window.__DSH_GHU__ = true;

  // 槽位容器。为空时退回 document.body，方便单独打开本文件调试。
  var MOUNT_HOST = null;

  var API = '/dsh-gh/api';

  /**
   * 宿主的目录能力。由 build/bundle.mjs 从客户端的 `uiWorkspace` 服务取来：
   *   pickDirectory()          → 打开宿主**原生**目录选择器（系统文件夹对话框）
   *   listDirectory(path)      → 列一层目录（**需要宿主的 browse 能力**）
   *   createDirectory(path, n) → 新建子目录（同样需要 browse 能力）
   *
   * 关键约束：宿主可能只装了 **native** 后端，此时 `listDirectory` / `createDirectory` 一律
   * 拒绝（`directory-picker/unavailable: … needs the browse capability; the composed picker serves "native"`），
   * 只有 `pickDirectory()` 可用。所以内置浏览器只在 browse 可用时才有意义，
   * 判定方式见 browseUnavailable()：**用真实报错判定，不靠猜能力字段**。
   */
  function hostApi() {
    return (typeof window !== 'undefined' && window.__DSH_GHU_HOST__) || null;
  }
  /** 原生系统对话框是否可用（宿主服务接上了就有）。 */
  function hasNativePicker() {
    var h = hostApi();
    return !!(h && typeof h.pickDirectory === 'function');
  }
  /** 列目录是否可用。未知时返回 null，由 browseUnavailable() 用一次真实调用判定。 */
  var browseUsable = null;
  function markBrowseUnusable() { browseUsable = false; }
  function browseUnavailable() { return browseUsable === false; }
  /** 宿主是否只在 native 后端下工作（此时界面上只保留系统对话框入口）。 */
  function nativeOnly() {
    if (!hasNativePicker()) return false;
    if (browseUsable === true) return false;
    return browseUsable === false;
  }
  var LS_TOKEN = 'dsh.ghu.token';
  var LS_REPO = 'dsh.ghu.repo';
  var LS_DIR = 'dsh.ghu.dir';
  var LS_POS = 'dsh.ghu.pos';
  var LS_LANG = 'dsh.ghu.lang';
  var MAX_ROWS = 6000;
  var TOKEN_URL_CLASSIC = 'https://github.com/settings/tokens/new?scopes=repo&description=dsh-github-upload';
  var TOKEN_URL_FINE = 'https://github.com/settings/personal-access-tokens/new';
  // GitHub 标志。viewBox 用 getBBox 实测的**墨迹范围**（横向 0→24 占满、纵向 0.5→23.91），
  // 而不是原始的 `0 0 24 24` —— 这样图标的 width 就等于可见标记的宽度，留白可以直接算，
  // 不会再出现「设了 28px，却因为字形不吃满 viewBox 而少掉一截」这种意外。
  var GH_ICON = '<svg viewBox="0 0.5 24 23.41" aria-hidden="true"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z"/></svg>';
  // 目录与折叠箭头（用描边图标，避免依赖字体里的 ▸ / 📁 字形）
  var FOLDER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A2 2 0 0 1 5 5.5h3.6a2 2 0 0 1 1.5.7l1 1.2H19a2 2 0 0 1 2 2v7.1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  // 受限目录用一把小锁表示（读不了、进不去，但列表照常显示）
  var LOCK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';

  /* ---------- 文案表 ---------- */

  var M = {
    // 入口与面板
    fabLabel: ['上传到 GitHub', 'Upload'],
    fabTitle: ['上传项目到 GitHub（可拖动移动）', 'Upload this project to GitHub (drag to move)'],
    fabOpenTip: ['收起面板', 'Minimize the panel'],
    panelTitle: ['GitHub 上传', 'GitHub Upload'],
    panelSub: ['推送到仓库', 'push to repo'],
    treeExpand: ['展开', 'Expand'],
    treeCollapse: ['收起', 'Collapse'],
    close: ['关闭', 'Close'],
    min: ['收起', 'Minimize'],
    minTip: ['收起面板（面板只占窗口一块浮层，点面板以外或按 Esc 也会收起）',
      'Minimize the panel (it is a floating card; clicking outside or pressing Esc also dismisses it)'],
    closeTip: ['关闭面板（也可以按 Esc，或再点一次右下角按钮）',
      'Close the panel (or press Esc, or click the corner button again)'],
    tabAccount: ['账号', 'Account'],
    tabRepo: ['仓库', 'Repositories'],
    tabUpload: ['上传', 'Upload'],
    tabSettings: ['仓库信息', 'Repository settings'],

    // 账号页
    acctHeading: ['GitHub 账号绑定', 'GitHub account'],
    acctProfile: ['主页', 'Profile'],
    acctBound: ['已绑定。所有 GitHub 请求都由本机后台完成，不再消耗模型 Token。',
      'Bound. Every GitHub call runs in the local background and consumes no model tokens.'],
    acctUnbind: ['解除绑定', 'Unbind'],
    acctNext: ['下一步：选仓库', 'Next: pick a repository'],
    acctIntro: ['填入 GitHub Personal Access Token。令牌只存在本机（宿主内存 + 浏览器 localStorage），不会发送给模型。',
      'Paste a GitHub Personal Access Token. It stays on this machine (host memory + browser localStorage) and is never sent to the model.'],
    acctDiffTitle: ['两种令牌的差别（决定你能看到哪些仓库）',
      'How the two token types differ (this decides which repositories you can see)'],
    acctClassicLi: ['Classic：必须勾选 {1} 才能看到并写入私有仓库。',
      'Classic: you must tick {1} to see and write private repositories.'],
    acctClassicLink: ['一键创建 classic 令牌', 'Create a classic token'],
    acctFineLi: ['Fine-grained：默认只能看到被显式授权的仓库；若要看到全部仓库，请选「All repositories」并授予 Contents / Administration / Metadata 读写。',
      'Fine-grained: by default it only sees explicitly granted repositories; pick "All repositories" and grant Contents / Administration / Metadata read-write to see everything.'],
    acctFineLink: ['创建 fine-grained 令牌', 'Create a fine-grained token'],
    acctRemember: ['在这台机器上记住令牌（浏览器 localStorage）',
      'Remember the token on this machine (browser localStorage)'],
    acctPersistOn: ['令牌已写入宿主的凭据库：插件重启、页面刷新后都会自动恢复，不需要重新绑定。',
      'Token saved to the host credential store: it is restored automatically after a plugin restart or page reload — no re-binding needed.'],
    // 被只读来源遮蔽：令牌其实**已经**在凭据库里，只是有一个环境变量（或 .env）解析优先级更高。
    acctPersistShadowed: ['ℹ️ 宿主凭据库里已有令牌，但有一个只读来源（环境变量或 .env）解析优先级更高，所以每次都用它。令牌不会因此丢失，重启后也不需要重新绑定。',
      'ℹ️ A token is stored in the host credential store, but a read-only source (an environment variable or .env) takes precedence, so that value is used. Nothing is lost and you do not need to re-bind after a restart.'],
    acctPersistOff: ['⚠️ 令牌既没进凭据库、也没能留在浏览器里，插件重启后需要重新绑定。',
      '⚠️ The token could not be stored in the credential store or kept in the browser, so you will need to re-bind after a plugin restart.'],
    acctBind: ['校验并绑定', 'Verify and bind'],
    acctBinding: ['校验中…', 'Verifying…'],
    acctTokenEmpty: ['请先填入令牌', 'Paste a token first.'],
    acctBindOk: ['绑定成功：@{1}', 'Bound: @{1}'],
    acctKindClassic: ['令牌类型：classic（权限：{1}）', 'Token type: classic (scopes: {1})'],
    acctKindClassicNone: ['令牌类型：classic（无任何 scope）', 'Token type: classic (no scopes)'],
    acctKindFine: ['令牌类型：fine-grained（只能访问创建时授权的仓库）',
      'Token type: fine-grained (only repositories granted at creation)'],
    acctExpires: ['过期时间：{1}', 'Expires: {1}'],

    // 本机环境
    envHeading: ['本机环境', 'Local environment'],
    envDefaultDir: ['默认目录', 'Default directory'],
    envNode: ['Node 运行时', 'Node runtime'],
    envAssets: ['前端资源目录', 'UI assets directory'],
    envPicker: ['文件夹选择后端', 'Folder-picker backend'],
    envVersion: ['界面版本', 'UI build'],

    // 接口层报错：区分「路由不存在 / 未授权 / 宿主内部错误」，不要笼统地报 no response
    apiNoRoute: ['宿主接口不存在（HTTP {1}）：插件那半边没注册成功，请重启 DSH；若重启后仍然如此，日志里会有 [dsh-github-upload] 开头的错误。',
      'The host endpoint does not exist (HTTP {1}): the host half failed to register its route. Restart DSH; if it persists, look for a "[dsh-github-upload]" error in the log.'],
    apiUnauthorized: ['宿主拒绝了这次请求（HTTP {1}）：浏览器没有通过 DSH 的登录态，请重新打开界面再试。',
      'The host rejected this request (HTTP {1}): the browser is not authenticated with DSH. Reopen the UI and try again.'],
    apiServerError: ['宿主内部错误（HTTP {1}）：{2}', 'Host internal error (HTTP {1}): {2}'],
    apiNotJson: ['宿主返回了非 JSON 内容（HTTP {1}）：{2}', 'The host returned a non-JSON response (HTTP {1}): {2}'],
    envSelfTest: ['运行自检', 'Run self-test'],
    envTesting: ['自检中…', 'Testing…'],
    envOk: ['OK · GitHub 返回 {1}：{2}', 'OK · GitHub replied {1}: {2}'],
    envFail: ['失败：{1}', 'Failed: {1}'],

    // 仓库页
    needBind: ['请先在「账号」标签页绑定 GitHub 账号。', 'Bind a GitHub account on the Account tab first.'],
    needRepo: ['请先在「仓库」标签页选择或新建一个仓库。',
      'Pick or create a repository on the Repositories tab first.'],
    repoSearchPh: ['在已加载的仓库里搜索…', 'Filter the loaded repositories…'],
    repoRefresh: ['刷新', 'Refresh'],
    repoLoading: ['加载中…', 'Loading…'],
    repoCount: ['已加载 {1} 个仓库', '{1} repositories loaded'],
    repoNew: ['＋ 新建仓库', '+ New repository'],
    repoCollapse: ['收起新建', 'Cancel'],
    repoNamePh: ['仓库名，例如 my-project', 'Repository name, e.g. my-project'],
    repoDescPh: ['描述（可选）', 'Description (optional)'],
    repoPrivateNew: ['创建为私有仓库', 'Create as a private repository'],
    repoCreate: ['创建仓库', 'Create repository'],
    repoCreating: ['创建中…', 'Creating…'],
    repoCreated: ['仓库已创建：{1}', 'Repository created: {1}'],
    repoNone: ['没有找到任何仓库。', 'No repositories found.'],
    repoSelected: ['已选：{1}', 'Selected: {1}'],
    repoGoUpload: ['去上传 →', 'Go to upload →'],
    repoNoDesc: ['无描述', 'No description'],
    repoDefaultBranch: ['默认分支 {1}', 'default branch {1}'],
    repoEmptyRepo: ['空仓库', 'empty'],
    tagPrivate: ['私有', 'private'],
    tagPublic: ['公开', 'public'],
    tagArchived: ['已归档', 'archived'],
    repoManualTitle: ['直接指定仓库（列表找不到时用）',
      'Point at a repository directly (use this when the list is empty)'],
    repoManualPh: ['owner/repo，例如 octocat/Hello-World', 'owner/repo, e.g. octocat/Hello-World'],
    repoManualUse: ['使用', 'Use'],
    repoManualBad: ['请填写 owner/repo 形式，例如 octocat/Hello-World',
      'Use the owner/repo form, e.g. octocat/Hello-World'],
    repoManualOk: ['已选择 {1}', 'Selected {1}'],

    // 空列表排障
    guidTitle: ['接口调用成功，但这个令牌看不到任何仓库',
      'The API call succeeded, but this token cannot see any repository'],
    guidLead: ['账号 @{1} 已通过校验，说明令牌本身有效。以下是按可能性排序的原因：',
      'Account @{1} passed verification, so the token itself is valid. Likely reasons, most likely first:'],
    guidFine: ['Fine-grained 令牌只被授权访问部分仓库 —— 请改为 All repositories，或补授权限。',
      'The fine-grained token was only granted some repositories — switch it to All repositories, or add grants.'],
    guidRegenFine: ['重新生成', 'Regenerate'],
    guidClassic1: ['Classic 令牌没有勾选 {1} scope（当前权限：{2}）。',
      'The classic token is missing the {1} scope (current scopes: {2}).'],
    guidRegenClassic: ['重新生成', 'Regenerate'],
    guidNone: ['该账号名下确实还没有任何仓库 —— 用上面的「＋ 新建仓库」建一个即可。',
      'The account really has no repositories yet — create one with "+ New repository" above.'],
    guidManual: ['也可以用下面的「直接指定仓库」跳过列表，手动填写 owner/repo。',
      'You can also skip the list entirely and type owner/repo under "Point at a repository directly" below.'],

    // 上传页
    upTarget: ['目标仓库', 'Target repository'],
    upDirHeading: ['项目目录', 'Project directory'],
    upDirPh: ['项目目录绝对路径', 'Absolute path to the project directory'],
    upChoose: ['选择文件夹', 'Choose folder'],
    upChoosing: ['等待系统对话框…', 'Waiting for the system dialog…'],
    /* 优先走宿主原生选择器（系统对话框）—— 那是 DSH 自己的入口，不受目录列举问题影响。
     * 拿不到该服务时才退回内置浏览器，此时文案也跟着换。 */
    upChooseTip: ['打开系统的「选择文件夹」对话框，选完立刻开始扫描',
      'Open the system folder dialog; scanning starts as soon as you pick'],
    upChooseTipBrowse: ['打开内置文件浏览器选择项目文件夹（宿主原生选择器不可用时才会用到）',
      'Open the built-in file browser to pick the project folder (used only when the host-native picker is unavailable)'],
    upChooseTipNative: ['这个宿主只提供系统「选择文件夹」对话框，点它会直接弹出对话框',
      'This host only serves the system folder dialog; clicking opens it directly'],
    upScan: ['扫描', 'Scan'],
    upScanning: ['扫描中…', 'Scanning…'],
    upScanHint: ['点「扫描」列出目录内容，然后勾选本次要上传的文件。',
      'Press Scan to list the directory, then tick the files you want to upload.'],
    upSummary: ['已选 {1} / {2} 个文件 · {3}', '{1} / {2} files selected · {3}'],
    upAll: ['全选', 'All'],
    upNone: ['清空', 'None'],
    upReset: ['恢复默认', 'Defaults'],
    upPickSession: ['未上传的改动', 'Unpushed changes'],
    upPickSessionTip: ['用内容与远程分支比对，勾选所有「还没上传、或上传后又被改过」的文件 —— 跨多轮对话累计，不限于当前这一次会话',
      'Compare contents against the remote branch and tick everything not uploaded yet (or changed since) — accumulated across conversations, not just this one'],
    upPickSessionHint: ['与远程分支逐一比对内容，挑出还没上传的改动（跨会话累计）',
      'Compare contents against the remote branch and pick what is not uploaded yet (accumulated)'],
    upSessionPicking: ['正在与远程分支比对…', 'Comparing with the remote branch…'],
    noteSession: ['来源会话《{1}》 · 本会话写入/修改 {2} 个文件，其中 {3} 个在项目目录内',
      'Source session "{1}" · this session wrote or edited {2} file(s), {3} inside the project'],
    noteSessionOutside: ['（另有 {1} 个改动文件在项目目录之外）', ' ({1} touched file(s) lie outside the project)'],
    markWritten: ['本会话写入', 'written in this session'],
    markEdited: ['本会话修改', 'edited in this session'],
    markRead: ['本会话读取', 'read in this session'],
    markSearched: ['本会话检索', 'searched in this session'],
    dirCleaned: ['已自动去掉路径两端的引号 / 多余分隔符（资源管理器「复制为路径」会带引号）',
      'Stripped the surrounding quotes / extra separators from the path (Explorer\'s "Copy as path" adds quotes)'],

    // 项目目录识别
    detectBusy: ['正在从本次聊天识别项目目录…', 'Detecting the project directory from this chat…'],
    detectFound: ['本次聊天的项目目录', 'Project directory from this chat'],
    detectNote: ['来自会话《{1}》 · 本会话写入/修改 {2} 个文件',
      'From session "{1}" · this session wrote or edited {2} file(s)'],
    detectUse: ['使用并扫描', 'Use and scan'],
    detectScan: ['扫描这个目录', 'Scan this directory'],
    detectIgnore: ['忽略', 'Dismiss'],
    detectOther: ['（已自动填入，可手动改）', ' (filled in automatically; you can edit it)'],
    detectFailed: ['没有从本次聊天识别到项目目录：{1}', 'Could not detect a project directory from this chat: {1}'],
    upSelectionNote: ['勾选的会在 GitHub 上新增或覆盖；未勾选的保持原样（除非打开下面那个「完全同步」，它才会删掉远程多余文件）。想直接推整个项目就点「全选」。',
      'Ticked files are added or overwritten on GitHub; unticked files stay as they are (unless you enable exact sync below, which deletes remote extras). To push the whole project, just press All.'],
    upPickPending: ['正在与远程分支比对…', 'Comparing with the remote branch…'],
    upPickPendingOk: ['有 {1} 个文件与远程不一致，已全部勾选（本会话改动 {2} 个）',
      '{1} file(s) differ from the remote and are all ticked ({2} from this chat)'],
    upPickPendingNone: ['扫描到的文件与远程分支完全一致，没有需要上传的改动',
      'Every scanned file matches the remote branch — nothing to upload'],
    upPickPendingNew: ['远程分支 {1} 还不存在，扫描到的 {2} 个文件都会作为新增上传',
      'Remote branch {1} does not exist yet, so all {2} scanned file(s) will be uploaded as new'],
    upPickPendingDeep: ['深度比对（同大小的文件也比内容，较慢但最准）',
      'Deep compare (also compares content when sizes match — slower, most accurate)'],
    upPickPendingStat: ['远程 {1} 个文件 · 本地 {2} 个 · 未变 {3} 个 · 逐字节比对 {4} 个',
      'remote {1} · local {2} · unchanged {3} · byte-compared {4}'],
    upFilterPh: ['按路径过滤，例如 src/', 'Filter by path, e.g. src/'],
    upShowIgnored: ['显示被忽略', 'Show ignored'],
    upCommit: ['提交信息', 'Commit message'],
    upBranch: ['目标分支', 'Target branch'],
    upPrune: ['删除远程分支上未被选中的文件（完全同步）',
      'Delete remote files that are not selected (exact sync)'],
    upStart: ['开始上传', 'Start upload'],
    upUploading: ['上传中…', 'Uploading…'],
    upPickOne: ['请至少选择一个文件', 'Select at least one file.'],
    upProgress: ['上传中：{1}', 'Uploading: {1}'],
    upDone: ['上传完成', 'Upload complete'],
    upFailed: ['上传失败', 'Upload failed'],
    upCommitted: ['已提交 {1}，共 {2} 个文件', 'Committed {1} with {2} file(s)'],
    upOpenRepo: ['打开仓库 {1}', 'Open repository {1}'],
    notePruned: ['已整棵跳过 {1} 个依赖/缓存目录（{2}{3}），其中的文件不会出现在上面的列表里。',
      'Skipped {1} dependency/cache director(ies) entirely ({2}{3}); their files are not listed above.'],
    notePrunedMore: [' 等', ' …'],
    noteTruncated: ['文件数超过 20000 上限，本次扫描已被截断。',
      'The file count exceeded the 20,000 cap, so this scan was truncated.'],
    noteGitignore: ['已应用 {1} 条 .gitignore 规则（规则命中的文件默认不勾，可手动勾选上传）。',
      'Applied {1} .gitignore rule(s); matched files start unticked but can be ticked manually.'],

    // 仓库信息页
    setLoading: ['加载仓库信息…', 'Loading repository settings…'],
    setOpen: ['打开仓库页面', 'Open repository page'],
    setName: ['仓库名（可重命名）', 'Repository name (rename)'],
    setDesc: ['描述', 'Description'],
    setHomepage: ['主页 URL', 'Homepage URL'],
    setTopics: ['话题标签（逗号分隔）', 'Topics (comma separated)'],
    setVisibility: ['可见性与开关', 'Visibility and switches'],
    setPrivate: ['私有仓库（仅自己和协作者可见）', 'Private repository (only you and collaborators)'],
    setPublic: ['公开仓库（任何人可见）', 'Public repository (anyone can see it)'],
    setIssues: ['启用 Issues', 'Enable Issues'],
    setWiki: ['启用 Wiki', 'Enable Wiki'],
    setArchive: ['归档仓库（归档后只读）', 'Archive repository (read-only afterwards)'],
    setDanger: ['危险操作', 'Danger zone'],
    setDeletePh: ['输入完整仓库名 {1} 以确认删除', 'Type the full name {1} to confirm deletion'],
    setDelete: ['删除仓库', 'Delete repository'],
    setDeleteNeedName: ['请先输入完整仓库名以确认删除',
      'Type the full repository name first to confirm deletion.'],
    setDeleted: ['仓库已删除', 'Repository deleted'],
    setReload: ['重新加载', 'Reload'],
    setSave: ['保存修改', 'Save changes'],
    setSaving: ['保存中…', 'Saving…'],
    setSaved: ['仓库信息已更新', 'Repository settings updated'],

    // 文件夹浏览器
    pkTitle: ['选择项目文件夹', 'Choose the project folder'],
    pkHome: ['主目录', 'Home'],
    pkLoading: ['读取中…', 'Reading…'],
    pkEmptyHidden: ['没有可见的子文件夹（可勾选「显示隐藏项」）',
      'No visible subfolders (tick "Show hidden" to reveal them)'],
    pkEmpty: ['这个文件夹里没有子文件夹', 'This folder has no subfolders'],
    pkTruncated: ['目录过多，列表已被宿主截断', 'Too many entries; the host truncated this listing'],
    // 受限目录（Windows 的 System Volume Information / WindowsApps 等）
    pkBlocked: ['受限', 'restricted'],
    pkBlockedTip: ['这个目录当前账户没有访问权限，所以无法进入（列表里的其它目录不受影响）。',
      'The current account cannot access this directory, so it cannot be opened (the rest of the listing is unaffected).'],
    pkBlockedNote: ['已跳过 {1} 个无权限的目录：{2}', 'Skipped {1} restricted director(ies): {2}'],
    pkShowHidden: ['显示隐藏项', 'Show hidden'],
    pkNewPh: ['新建文件夹名', 'New folder name'],
    pkCreate: ['新建', 'Create'],
    pkCancel: ['取消', 'Cancel'],
    pkChoose: ['选择此文件夹', 'Use this folder'],
    pkCancelled: ['已取消选择', 'Selection cancelled'],
    pkChosen: ['已选择：{1}', 'Selected: {1}'],
    pkNativeFail: ['系统文件夹对话框打开失败：{1}（已切换为内置文件浏览器）',
      'The system folder dialog failed to open: {1} (switched to the built-in browser)'],
    pkTryNative: ['试试系统对话框', 'Try the system dialog'],
    pkOpenNative: ['系统对话框', 'System dialog'],
    pkOpenNativeTip: ['改用系统的「选择文件夹」对话框（能去任何位置，但看不到目录内容）',
      'Switch to the system folder dialog (reaches anywhere, but does not show directory contents)'],
    pkNativeOnly: ['这个宿主只提供系统对话框（没有内置浏览能力），已改用系统对话框',
      'This host only serves the system dialog (no built-in browsing), so the system dialog was used'],
    pkNoPicker: ['这台宿主没有可用的文件夹选择器（原生对话框与浏览能力都不可用）。请直接把项目目录的完整路径粘贴到上面的输入框，再点「扫描」。\n原因：{1}',
      'This host exposes no usable folder picker (neither the native dialog nor the browse capability). Paste the full project directory into the field above and press Scan.\nReason: {1}'],
    // 这一层列不动时的解释与出口（例如 DSH 的 fs 服务拒绝列 D:\ 根目录）；
    // 上面的盘符 / 项目目录按钮仍然可用，另有回到起始目录 / 项目目录 / 系统对话框三个出口。
    pkListFailedHint: ['这个位置列不出来（通常是系统级的受限目录）。上面的盘符 / 项目目录按钮仍然可用，换一个位置即可继续。',
      'This location cannot be listed (usually a system-restricted directory). The drive / project buttons above still work — just pick another location.'],
    pkGoHome: ['回到起始目录', 'Go to the start folder'],
    pkGoProject: ['回到项目目录', 'Go to the project folder'],
    pickTimeout: ['系统对话框 25 秒内没有响应（本机的原生选择器可能不可用），已放弃等待 —— 请用「选择文件夹」的内置浏览器。',
      'The system dialog did not respond within 25 seconds (the native picker may be unavailable here); stopped waiting — use the built-in browser behind "Choose folder".'],

    // 其他
    scanDone: ['扫描完成：{1} 个文件', 'Scan finished: {1} file(s)'],
    scanDonePruned: ['扫描完成：{1} 个文件，跳过 {2} 个依赖目录',
      'Scan finished: {1} file(s), {2} dependency director(ies) skipped'],
    uploadOk: ['上传成功：{1}', 'Upload succeeded: {1}'],
    pickerNone: ['未提供', 'unavailable'],
    treeEmpty: ['没有匹配的文件', 'No matching files'],
    treeCapped: ['仅显示前 6000 项，请用过滤框缩小范围',
      'Only the first 6,000 rows are shown; narrow it down with the filter'],
  };

  /** 取一条文案并替换 {1} / {2} / {3}。 */
  function t(key, a, b, c) {
    var row = M[key];
    var s = row ? (S.lang === 'en' ? row[1] : row[0]) : key;
    if (a !== undefined) s = s.split('{1}').join(String(a));
    if (b !== undefined) s = s.split('{2}').join(String(b));
    if (c !== undefined) s = s.split('{3}').join(String(c));
    return s;
  }

  /* ---------- 状态 ---------- */

  var S = {
    lang: 'zh',
    open: false, tab: 'account',
    token: '', bound: false, user: null, remember: true,
    tokenMeta: null, hint: '', diag: [], persisted: null, persist: null,
    repos: [], repoFilter: '', repo: null, repoBusy: false,
    newOpen: false, newName: '', newPrivate: true, newDesc: '',
    manual: '',
    dir: '', scan: null, picked: {}, collapsed: {}, fileFilter: '', showIgnored: false,
    sessionFiles: {}, sessionInfo: null, sessionBusy: false,
    sessionRoot: '', pendingSessionPick: false, pendingInfo: null, deepCompare: false,
    detect: null, detectBusy: false, detectError: '', detectFiles: {}, detectFilled: false,
    stats: {}, totalFiles: 0, selFiles: 0, selBytes: 0,
    branch: '', branches: [], message: '', prune: false,
    job: null, poll: null, edit: null, error: '', check: '', env: null,
    picker: null, picking: false, scanBusy: false,
    delConfirm: ''
  };

  /* ---------- DOM 辅助 ---------- */

  function h(tag, props, kids) {
    var e = document.createElement(tag);
    if (props) {
      for (var k in props) {
        var v = props[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k === 'value') e.value = v;
        else if (k === 'checked') e.checked = !!v;
        else if (k === 'disabled') e.disabled = !!v;
        else if (k.length > 2 && k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
      }
    }
    if (kids) {
      if (!(kids instanceof Array)) kids = [kids];
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        if (c === null || c === undefined || c === false) continue;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return e;
  }

  function link(href, text) {
    return h('a', { class: 'ghu-link', href: href, target: '_blank', rel: 'noreferrer', text: text });
  }

  function api(op, extra) {
    var payload = extra || {};
    payload.op = op;
    payload.lang = S.lang;
    return fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) {
        return r.text().then(function (txt) { return { status: r.status, txt: txt }; });
      })
      .then(function (res) {
        var j = null;
        try { j = JSON.parse(res.txt); } catch (e) { j = null; }
        // 解析不出 JSON 时按 HTTP 状态分类，避免把「路由不存在」「未授权」「宿主内部错误」
        // 一起报成笼统的 "no response"。
        if (!j) {
          if (res.status === 401 || res.status === 403) {
            throw new Error(t('apiUnauthorized', res.status));
          }
          if (res.status === 404 || res.status === 405) {
            throw new Error(t('apiNoRoute', res.status));
          }
          if (!res.status || res.status >= 500) {
            throw new Error(t('apiServerError', res.status, String(res.txt || '').slice(0, 120)));
          }
          throw new Error(t('apiNotJson', res.status, String(res.txt || '').slice(0, 120)));
        }
        if (!j.ok) throw new Error(j.error || 'request failed');
        return j.data;
      });
  }

  function baseName(p) { var i = p.lastIndexOf('/'); return i === -1 ? p : p.slice(i + 1); }

  /** 宿主回报的插件目录是 URL 形式（/D:/x%20y/z/），显示前先解码并去掉前导斜杠。 */
  function prettyPath(p) {
    var s = String(p === null || p === undefined ? '' : p);
    try { s = decodeURIComponent(s); } catch (e) { /* 解码失败就原样显示 */ }
    if (s.length > 2 && s.charAt(0) === '/' && s.charAt(2) === ':') s = s.slice(1);
    return s;
  }

  /**
   * 清洗用户输入的目录路径。手动输入路径最容易踩的三个坑：
   *   1. Windows 资源管理器「复制为路径」会给路径套一层引号（"D:\a\b"）；
   *   2. 从别处复制时可能带上重复分隔符（D:\\a\\b）；
   *   3. 首尾空格 / 尾随分隔符。
   * 这些都会让 fs 直接报「目录不存在」，所以进任何接口前先归一化。
   */
  function cleanDir(raw) {
    var s = String(raw === null || raw === undefined ? '' : raw).trim();
    // 剥掉整层包裹的引号（半角与全角，成对才剥），最多两层
    for (var i = 0; i < 2; i++) {
      if (s.length < 2) break;
      var a = s.charAt(0);
      var b = s.charAt(s.length - 1);
      var pair = (a === '"' && b === '"') || (a === "'" && b === "'")
        || (a === '\u201C' && b === '\u201D') || (a === '\u2018' && b === '\u2019');
      if (!pair) break;
      s = s.slice(1, -1).trim();
    }
    if (!s) return '';
    // UNC 前缀（\\server\share）保留开头的双分隔符
    var prefix = '';
    if (s.length > 1
      && (s.charAt(0) === '\\' || s.charAt(0) === '/')
      && (s.charAt(1) === '\\' || s.charAt(1) === '/')) {
      prefix = s.slice(0, 2);
      s = s.slice(2);
    }
    var out = '';
    var prevSep = false;
    for (var j = 0; j < s.length; j++) {
      var ch = s.charAt(j);
      if (ch === '\\' || ch === '/') {
        if (prevSep) continue;
        prevSep = true;
        out += ch;
      } else {
        prevSep = false;
        out += ch;
      }
    }
    var full = prefix + out;
    // 去掉尾随分隔符，但保留根（C:\ 或 /）
    while (full.length > 1) {
      var last = full.charAt(full.length - 1);
      if (last !== '\\' && last !== '/') break;
      var stem = full.slice(0, -1);
      if (stem === '' || stem === '\\' || stem === '/') break;
      if (stem.length === 2 && stem.charAt(1) === ':') break;
      full = stem;
    }
    return full;
  }

  function fmtSize(n) {
    if (!n) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function toast(msg, ms) {
    var old = document.getElementById('ghu-toast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = h('div', { class: 'ghu-toast', id: 'ghu-toast', text: msg });
    (MOUNT_HOST || document.body).appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, ms || 3200);
  }
  function guard(promise, okMsg) {
    S.error = '';
    return promise.then(function (d) { if (okMsg) toast(okMsg); return d; })
      .catch(function (e) {
        S.error = String((e && e.message) || e);
        render();
      });
  }

  function applyAuth(r) {
    S.bound = true;
    S.user = r.user;
    if (r.token) S.tokenMeta = r.token;
    if (r.hint) S.hint = r.hint;
    if (typeof r.persisted === 'boolean') S.persisted = r.persisted;
    if (r.persist) S.persist = r.persist;
  }

  var root, fab, panel;
  var pickerEl = null;

  /* ---------- 挂载 ---------- */

  function mount() {
    root = h('div', { id: 'dsh-ghu-root' });
    // 入口按钮只有 GitHub logo：「上传到 GitHub」的说明放在 title（悬停提示）与 aria-label（无障碍）里。
    fab = h('div', {
      id: 'dsh-ghu-fab', title: t('fabTitle'),
      role: 'button', tabindex: '0', 'aria-label': t('fabLabel')
    }, [
      h('span', { class: 'ghu-fab-wrap' }, [
        h('span', { class: 'ghu-fab-icon', html: GH_ICON }),
        // 已绑定的状态点：落在圆的右下边缘上（没有它就分不清账号有没有绑好）
        h('span', { class: 'ghu-dot' })
      ])
    ]);
    panel = h('div', { id: 'dsh-ghu-panel' }, [
      // 头部只放「收起」+ 标题：桌面端窗口的关闭键压在右上角，那里不能放任何可点的东西。
      h('div', { class: 'ghu-head' }, [
        h('button', {
          class: 'ghu-minbtn', id: 'ghu-min', type: 'button',
          title: t('minTip'), text: '\u2013',
          onclick: function () { S.open = false; render(); }
        }),
        h('span', { class: 'ghu-ttl', id: 'ghu-title', text: t('panelTitle') }),
        h('span', { class: 'ghu-sub', id: 'ghu-sub', text: t('panelSub') })
      ]),
      h('div', { class: 'ghu-tabs', id: 'ghu-tabs' }),
      h('div', { class: 'ghu-body', id: 'ghu-body' }),
      h('div', { class: 'ghu-foot', id: 'ghu-foot' }),
      // 语言开关与关闭键统一放在底部右侧 —— 右下角不会被任何窗口装饰遮挡。
      h('div', { class: 'ghu-panelctl' }, [
        h('div', { class: 'ghu-lang', id: 'ghu-lang' }),
        h('button', {
          class: 'ghu-btn ghu-closebtn', id: 'ghu-close',
          title: t('closeTip'), text: t('close'),
          onclick: function () { setOpen(false); }
        })
      ])
    ]);
    root.appendChild(fab);
    root.appendChild(panel);
    (MOUNT_HOST || document.body).appendChild(root);
    setupFab(after(LS_POS, {}));
    applyFabState();
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (S.picker && S.picker.open) closePicker();
        else if (S.open) setOpen(false);
      }
    });
    // 点面板以外的地方就收起：面板是浮层而不是抽屉，遮住的那块区域要能立刻还回去。
    document.addEventListener('pointerdown', function (e) {
      if (!S.open) return;
      if (panel.contains(e.target) || fab.contains(e.target)) return;
      if (S.picker && S.picker.open) return;
      if (pickerEl && pickerEl.contains(e.target)) return;
      setOpen(false);
    }, true);
    setInterval(keepAlive, 1500);
    boot();
  }

  function keepAlive() {
    // 槽位容器可能被 React 重渲染换掉，挂丢了就重新挂回去。
    var host = MOUNT_HOST || document.body;
    if (root && root.parentNode !== host) host.appendChild(root);
  }

  function after(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function keep(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* ignore */ }
  }

  /**
   * 读取一个字符串型偏好。
   *
   * `keep()` 写入的是 `JSON.stringify(value)`，所以存储里的文本本身带引号、反斜杠也转义了
   * （`"D:\\a"`）；直接 getItem 读出来的字符串**字面上就带引号**，必须 JSON.parse。
   * 这里统一解析，并容忍历史上可能被二次编码的值。
   */
  function readString(key, fallback) {
    var v = null;
    try { v = localStorage.getItem(key); } catch (e) { return fallback; }
    if (v === null || v === '') return fallback;
    for (var i = 0; i < 3; i++) {
      if (typeof v !== 'string') break;
      var next = null;
      try { next = JSON.parse(v); } catch (e2) { break; }
      if (typeof next !== 'string' || next === v) break;
      v = next;
    }
    return typeof v === 'string' ? v : fallback;
  }

  /** 入口按钮的外观：绑定了就在右下角亮起状态点，面板开着就淡化。尺寸永不改变。 */
  function applyFabState() {
    if (!fab) return;
    fab.className = (S.bound ? 'ghu-bound' : '') + (S.open ? ' ghu-dim' : '');
  }

  /**
   * 把入口按钮夹回可视区域。
   *
   * 尺寸是恒定的 40×40，所以边界就用它自己量出来的宽高 —— 4px 余量，可以贴到最边上。
   * 纵向只允许停在下半屏（顶部 42% 是禁区）：桌面端窗口的关闭/退出键在右上角，
   * 按钮不该被拖到那一条上。
   */
  function clampFabPos(x, y) {
    var vw = window.innerWidth || 1200;
    var vh = window.innerHeight || 800;
    var w = fab.offsetWidth || 40;
    var h = fab.offsetHeight || 40;
    var maxX = Math.max(4, vw - w - 4);
    var minY = Math.round(vh * 0.42);
    var maxY = Math.max(minY, vh - h - 4);
    return {
      x: Math.max(4, Math.min(maxX, Math.round(x))),
      y: Math.max(minY, Math.min(maxY, Math.round(y)))
    };
  }

  function setupFab(pos) {
    var x = typeof pos.x === 'number' ? pos.x : null;
    var y = typeof pos.y === 'number' ? pos.y : null;
    if (x === null) {
      fab.style.right = '18px'; fab.style.bottom = '92px';
    } else {
      // 存下来的坐标可能落在禁区里，读出来先夹回安全区域。
      var safe = clampFabPos(x, y);
      fab.style.right = 'auto'; fab.style.bottom = 'auto';
      fab.style.left = safe.x + 'px'; fab.style.top = safe.y + 'px';
    }
    var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    fab.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var r = fab.getBoundingClientRect();
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      fab.classList.add('ghu-dragging');
      try { fab.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    fab.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      moved = true;
      // 2px 余量：可以贴到界面最边上（尺寸恒定，贴边也不会因为展开而抖动）
      var nx = Math.max(2, Math.min(window.innerWidth - fab.offsetWidth - 2, ox + dx));
      var ny = Math.max(2, Math.min(window.innerHeight - fab.offsetHeight - 2, oy + dy));
      fab.style.right = 'auto'; fab.style.bottom = 'auto';
      fab.style.left = nx + 'px'; fab.style.top = ny + 'px';
    });
    fab.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      fab.classList.remove('ghu-dragging');
      try { fab.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (moved) {
        // 落点先夹回安全区域再存：下一次启动也是安全的。
        var r = fab.getBoundingClientRect();
        var safe = clampFabPos(r.left, r.top);
        fab.style.left = safe.x + 'px'; fab.style.top = safe.y + 'px';
        keep(LS_POS, { x: safe.x, y: safe.y });
      } else {
        togglePanel();
      }
    });
    // 键盘可达：它是 role=button，Enter / Space 要和点击等价。
    fab.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      togglePanel();
    });
  }

  /** 打开 / 收起面板（入口按钮、Esc、点面板外、收起键都走这里）。 */
  function setOpen(open) {
    if (S.open === open) return;
    S.open = open;
    render();
    if (open && S.bound && !S.repos.length) loadRepos();
    // 打开面板时如果正好停在上传页，顺手把项目目录识别出来（不用先选文件夹）。
    if (open && S.tab === 'upload') detectProject();
  }

  function togglePanel() { setOpen(!S.open); }

  /* ---------- 语言 ---------- */

  function initLang() {
    var saved = readString(LS_LANG, '');
    if (saved === 'zh' || saved === 'en') { S.lang = saved; return; }
    var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    S.lang = nav.indexOf('zh') === 0 ? 'zh' : 'en';
  }

  function setLang(lang) {
    if (lang !== 'zh' && lang !== 'en') return;
    if (S.lang === lang) return;
    S.lang = lang;
    keep(LS_LANG, lang);
    // 宿主已经下发的文案（扫描忽略原因、旧错误）是上一轮语言，清掉以免中英混排。
    S.error = '';
    S.job = null;
    if (S.scan) S.scan = null;
    render();
    renderPicker();
    if (S.bound) loadRepos();
  }

  /* ---------- 启动 ---------- */

  function boot() {
    initLang();
    // 全部走 readString：本地存储里的值带 JSON 引号，直接读会把引号一起读进来。
    S.token = readString(LS_TOKEN, '');
    S.dir = cleanDir(readString(LS_DIR, ''));
    // 自愈：把历史遗留的编码值改写成规范形式，避免下次又读出一堆引号。
    try {
      if (S.token && localStorage.getItem(LS_TOKEN) !== JSON.stringify(S.token)) keep(LS_TOKEN, S.token);
      if (S.dir && localStorage.getItem(LS_DIR) !== JSON.stringify(S.dir)) keep(LS_DIR, S.dir);
      if (S.lang && localStorage.getItem(LS_LANG) !== JSON.stringify(S.lang)) keep(LS_LANG, S.lang);
    } catch (e) { /* ignore */ }
    var savedRepo = after(LS_REPO, null);
    if (savedRepo && savedRepo.owner) {
      S.repo = savedRepo;
      S.branch = savedRepo.defaultBranch || 'main';
    }
    api('hello').then(function (d) {
      S.env = d;
      if (!S.dir && d && (d.projectRoot || d.workspaceRoot)) S.dir = cleanDir(d.projectRoot || d.workspaceRoot);
      render();
      // 先问宿主：令牌可能已经在凭据库里（插件重启后会自动恢复），
      // 这样即使浏览器没有存过令牌也不用重新绑定。
      api('auth-status').then(function (st) {
        if (st && st.bound) {
          applyAuth(st);
          render();
          loadRepos();
          return;
        }
        if (typeof st.persisted === 'boolean') S.persisted = st.persisted;
        if (st.persist) S.persist = st.persist;
        if (!S.token) return;
        api('auth-set', { token: S.token }).then(function (r) {
          applyAuth(r);
          render();
          loadRepos();
        }).catch(function () { S.bound = false; render(); });
      }).catch(function () { render(); });
    }).catch(function () { render(); });
  }

  function loadRepos() {
    if (!S.bound) return;
    S.repoBusy = true; render();
    guard(api('list-repos', { query: S.repoFilter }).then(function (d) {
      S.repos = d.repos || [];
      S.diag = d.diag || [];
      if (d.token) S.tokenMeta = d.token;
      if (d.hint) S.hint = d.hint;
      S.repoBusy = false;
      render();
    }));
  }

  function loadBranches() {
    if (!S.repo) return;
    api('list-branches', { owner: S.repo.owner, repo: S.repo.name })
      .then(function (d) { S.branches = d.branches || []; render(); })
      .catch(function () { /* 空仓库或权限不足，忽略 */ });
  }

  function selectRepo(r) {
    S.repo = {
      owner: r.owner, name: r.name, fullName: r.fullName,
      private: r.private, url: r.url, defaultBranch: r.defaultBranch
    };
    keep(LS_REPO, S.repo);
    S.branch = r.defaultBranch || 'main';
    S.branches = [];
    S.edit = null;
    S.job = null;
    S.error = '';
    render();
    loadBranches();
  }

  /* ---------- 本机文件夹选择 ---------- */

  /**
   * 「选择文件夹」主入口。
   *
   * 这里刻意**不**根据能力探测结果去挑入口。原因是本插件的服务探测可能失败
   * （宿主组合方式不同，`directoryPicker` 未必对插件可见），而 `pickNative()` 自身
   * 有一条不依赖该探测的兜底（走宿主 HTTP 路由弹系统对话框）。
   * 所以流程是"先用最好的，再逐级退"：
   *
   *   1. browse 已证明可用（之前列出过目录）→ 内置浏览器（更好看、能看清结构）；
   *   2. 否则真试一次列目录：
   *      · 成功 → 记住 browse 可用，打开浏览器；
   *      · 失败 → 弹系统对话框（并**不把探测错误显示出来**，避免看起来像操作失败）；
   *   3. 系统对话框也失败 → 明确提示手动粘贴路径。
   */
  function pickFolder() {
    if (browseUsable === true) { openPicker(''); return; }

    // 未证明可用：真试一次列目录。空路径让宿主用它的默认起点。
    if (hostApi() && typeof hostApi().listDirectory === 'function') {
      var probe;
      try { probe = hostApi().listDirectory(S.dir && S.dir.trim() ? S.dir.trim() : ''); }
      catch (e) { probe = Promise.reject(e); }
      Promise.resolve(probe).then(function () {
        browseUsable = true;
        openPicker('');
      }, function () {
        // 列不出来（无论哪种原因）→ 走系统对话框。不显示探测错误：那是内部试探，不是用户操作失败。
        markBrowseUnusable();
        pickNative();
      });
      return;
    }

    // 没有列目录服务：直接走系统对话框（它自带 HTTP 兜底）
    pickNative();
  }

  /**
   * 备选：宿主的原生选择器。它在宿主侧会同步等到用户操作完为止，
   * 所以这里加一个 25 秒的客户端超时 —— 万一对话框没弹出来，界面不会永久卡住
   * （那个请求留在后台，超时后不再等它）。
   */
  function pickNative() {
    if (S.picking) return;
    S.picking = true;
    S.error = '';
    render();

    /* 首选：客户端的 uiWorkspace.pickDirectory() —— 直接驱动宿主的原生 OS 对话框。
     * 它不经本插件的 HTTP 路由、不依赖宿主 fs 服务的目录列举，所以不会撞上受限目录问题。 */
    var h = hostApi();
    if (h && typeof h.pickDirectory === 'function') {
      h.pickDirectory().then(function (picked) {
        S.picking = false;
        if (picked) {
          S.dir = cleanDir(String(picked));
          keep(LS_DIR, S.dir);
          closePicker();       // 从选择器里点进来的，选完把选择器收掉
          render();
          toast(t('pkChosen', S.dir));
          scanNow();
        } else {
          render();
          toast(t('pkCancelled'));
        }
      }, function (e) {
        S.picking = false;
        var msg = String((e && e.message) || e);
        /* 原生对话框也失败了 → 这台宿主没有可用拾取器。除了提示手动输入，
         * 还要把**底层原因**一起显示：只给一句笼统文案的话，下次排障又得从头猜。 */
        S.error = t('pkNoPicker', msg.slice(0, 200));
        render();
      });
      return;
    }

    // 兜底：宿主的 HTTP 路由（旧宿主 / 服务不可用时）。宿主侧同样会同步等到用户操作完，
    // 所以这里同样加 25 秒客户端超时，超时后不再等它。
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      S.picking = false;
      S.error = t('pickTimeout');
      render();
    }, 25000);
    api('pick-folder').then(function (d) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      S.picking = false;
      if (d.mode === 'native') {
        render();
        if (d.path) {
          S.dir = cleanDir(d.path);
          keep(LS_DIR, S.dir);
          toast(t('pkChosen', S.dir));
          scanNow();
        } else {
          toast(t('pkCancelled'));
        }
        return;
      }
      render();
      openPicker(d.message || '');
    }).catch(function (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      S.picking = false;
      S.error = t('pkNativeFail', String((e && e.message) || e));
      render();
      openPicker('');
    });
  }

  function openPicker(note) {
    S.picker = {
      open: true, loading: true, path: '', home: '', crumbs: [], entries: [], roots: [],
      canCreate: false, canRetryNative: false, truncated: false, error: '', note: note || '',
      blockedCount: 0, blockedNames: [], fallbackNote: '',
      showHidden: false, newName: ''
    };
    renderPicker();
    // 起点：项目目录（它一定存在，通常也能列）。带上 landing=1 + hint：
    // 万一它列不出来（例如 DSH 的 fs 服务拒绝列某个根目录），宿主会自动改到能列的目录，
    // 而不是让用户面对一张"目录不可读"的死页。
    browseTo(S.dir && S.dir.trim() ? S.dir.trim() : '', true);
  }

  function browseTo(path, landing) {
    if (!S.picker) return;
    S.picker.loading = true;
    S.picker.error = '';
    renderPicker();

    /* 优先用 DSH 自己的 listDirectory：它就是产品界面的「选择工作区」用的那套，
     * 不会像本插件的 fs 列举那样在某个根目录上整体失败。
     * 走不通（或服务不可用）时退回宿主的 HTTP 路由。 */
    var h = hostApi();
    var viaService = !!(h && typeof h.listDirectory === 'function');
    var req = viaService
      ? h.listDirectory(path || '').then(function (l) { return normalizeListing(l); })
      : api('list-dirs', (function () {
        var payload = { path: path || '' };
        if (landing) {
          payload.landing = true;
          payload.hint = S.dir && S.dir.trim() ? S.dir.trim() : '';
        }
        return payload;
      })());

    req.then(function (d) {
      if (!S.picker) return;
      S.picker.loading = false;
      S.picker.path = d.path;
      S.picker.home = d.home || '';
      S.picker.crumbs = d.crumbs || [];
      S.picker.entries = d.entries || [];
      S.picker.roots = d.roots || [];
      S.picker.canCreate = d.canCreate === true;
      S.picker.canRetryNative = d.canRetryNative === true;
      S.picker.truncated = d.truncated === true;
      S.picker.blockedCount = d.blockedCount || 0;
      S.picker.blockedNames = d.blockedNames || [];
      // 宿主在"起点列不出来、自动换到别处"时会带这句话（正常情况没有）
      S.picker.fallbackNote = typeof d.fallbackNote === 'string' ? d.fallbackNote : '';
      /* ⚠️ 宿主把「这一层列不出来」放在 d.error 里返回，不抛错（为的是让界面保留导航出口）。
       * 客户端必须读它，否则会把"列不出来"误显示成"这个文件夹里没有子文件夹"。 */
      S.picker.error = typeof d.error === 'string' ? d.error : '';
      renderPicker();
    }).catch(function (e) {
      var msg = String((e && e.message) || e);
      /* 宿主只有 native 能力时，列目录会抛 `…needs the browse capability; the composed picker
       * serves "native"`。这时内置浏览器**根本没得用** —— 把选择器收掉、弹系统对话框，
       * 并顺手记住 browse 不可用，下次点按钮就直接进对话框，不再走这个失败的中间态。 */
      if (/browse capability|directory-picker\/unavailable|not supported/i.test(msg)) {
        var wasOpen = !!S.picker;
        markBrowseUnusable();
        closePicker();
        render();
        if (wasOpen) toast(t('pkNativeOnly'));
        pickNative();
        return;
      }
      if (!S.picker) return;
      S.picker.loading = false;
      S.picker.error = msg;
      renderPicker();
    });
  }

  /**
   * 把 `uiWorkspace.listDirectory()` 的返回整理成界面要的形状。
   *
   * 它的 `DirectoryListing` 是 `{path, home, crumbs, entries, truncated}`，与宿主路由的返回一致；
   * 但字段可能缺失，而且它的 `entries` 只有 `{name, path, hidden}`（没有 `unreadable`），
   * 所以这里一律补齐，并顺带算出根目录按钮（各盘符）与 `canCreate`。
   */
  function normalizeListing(l) {
    var out = {
      path: String((l && l.path) || ''),
      home: String((l && l.home) || ''),
      crumbs: Array.isArray(l && l.crumbs) ? l.crumbs : [],
      entries: [],
      truncated: !!(l && l.truncated),
      error: '',
      canCreate: true,
      roots: []
    };
    var src = Array.isArray(l && l.entries) ? l.entries : [];
    for (var i = 0; i < src.length; i++) {
      var e = src[i] || {};
      out.entries.push({
        name: String(e.name || ''),
        path: String(e.path || ''),
        hidden: e.hidden === true,
        unreadable: e.unreadable === true,
        reason: e.reason || ''
      });
    }
    // 盘符按钮：从当前路径推（`D:/x/y` → `D:`），Windows 风格；POSIX 下给 `/`
    var m = /^([A-Za-z]):[\\/]/.exec(out.path);
    if (m) out.roots = [{ name: m[1] + ':', path: m[1] + ':/' }];
    else if (out.path.charAt(0) === '/') out.roots = [{ name: '/', path: '/' }];
    return out;
  }

  function closePicker() {
    S.picker = null;
    renderPicker();
  }

  function chooseFolder() {
    if (!S.picker || !S.picker.path) return;
    S.dir = cleanDir(S.picker.path);
    keep(LS_DIR, S.dir);
    closePicker();
    render();
    toast(t('pkChosen', S.dir));
    scanNow();
  }

  function makeFolder() {
    if (!S.picker) return;
    var name = (S.picker.newName || '').trim();
    if (!name) return;
    // 优先走 uiWorkspace.createDirectory（DSH 自己的实现），拿不到时才用宿主路由
    var h = hostApi();
    var req = (h && typeof h.createDirectory === 'function')
      ? h.createDirectory(S.picker.path, name).then(function (p) { return { path: String(p) }; })
      : api('mkdir-dir', { parent: S.picker.path, name: name });
    guard(req.then(function (d) {
      S.picker.creating = false;
      S.picker.newName = '';
      browseTo(d.path);
    }));
  }

  function renderPicker() {
    if (!S.picker || !S.picker.open) {
      if (pickerEl && pickerEl.parentNode) pickerEl.parentNode.removeChild(pickerEl);
      pickerEl = null;
      return;
    }
    if (!pickerEl) {
      pickerEl = h('div', { class: 'ghu-backdrop', id: 'ghu-picker' });
      pickerEl.addEventListener('click', function (e) { if (e.target === pickerEl) closePicker(); });
      root.appendChild(pickerEl);
    }
    var p = S.picker;
    pickerEl.innerHTML = '';

    var card = h('div', { class: 'ghu-modal' });
    card.appendChild(h('div', { class: 'ghu-modal-head' }, [
      h('span', { class: 'ghu-ttl', text: t('pkTitle') }),
      h('button', { class: 'ghu-iconbtn', title: t('close'), text: '\u00D7', onclick: closePicker })
    ]));

    var tools = h('div', { class: 'ghu-modal-tools' });
    for (var r = 0; r < p.roots.length; r++) {
      (function (rt) {
        tools.appendChild(h('button', {
          class: 'ghu-btn ghu-chip', text: rt.name, title: rt.path,
          onclick: function () { browseTo(rt.path); }
        }));
      })(p.roots[r]);
    }
    if (p.home) {
      tools.appendChild(h('button', {
        class: 'ghu-btn ghu-chip', text: t('pkHome'), title: p.home,
        onclick: function () { browseTo(p.home); }
      }));
    }
    card.appendChild(tools);

    var crumbs = h('div', { class: 'ghu-crumbs' });
    for (var c = 0; c < p.crumbs.length; c++) {
      (function (crumb) {
        crumbs.appendChild(h('span', {
          class: 'ghu-crumb', text: crumb.name, title: crumb.path,
          onclick: function () { browseTo(crumb.path); }
        }));
        crumbs.appendChild(h('span', { class: 'ghu-crumb-sep', text: '/' }));
      })(p.crumbs[c]);
    }
    card.appendChild(crumbs);
    card.appendChild(h('div', { class: 'ghu-pathbar', text: p.path || '/' }));
    // 起点被自动换过位置时说明一下（否则用户会疑惑为什么不是自己选的那个目录）
    if (p.fallbackNote) {
      card.appendChild(h('div', { class: 'ghu-diag', style: 'margin:6px 14px 0;', text: p.fallbackNote }));
    }

    var listBox = h('div', { class: 'ghu-modal-list' });
    if (p.loading) {
      listBox.appendChild(h('div', { class: 'ghu-muted', style: 'padding:10px;', text: t('pkLoading') }));
    } else if (p.error) {
      /* 这一层列不动（例如 DSH 的 fs 服务拒绝列 D:\ 根目录）：不要只丢一个红字就走人，
       * 再补一句"为什么"和"可以怎么办" —— 否则界面看起来是死的。 */
      listBox.appendChild(h('div', { class: 'ghu-err', style: 'margin:8px;', text: p.error }));
      listBox.appendChild(h('div', {
        class: 'ghu-muted', style: 'margin:8px;line-height:1.7;',
        text: t('pkListFailedHint')
      }));
      var esc = h('div', { class: 'ghu-row', style: 'margin:8px;flex-wrap:wrap;' });
      if (p.home) {
        esc.appendChild(h('button', {
          class: 'ghu-btn', text: t('pkGoHome'),
          onclick: function () { browseTo(p.home); }
        }));
      }
      var dirNow = S.dir || '';
      if (dirNow && !samePath(dirNow, p.path)) {
        esc.appendChild(h('button', {
          class: 'ghu-btn', text: t('pkGoProject'),
          title: dirNow,
          onclick: function () { browseTo(dirNow); }
        }));
      }
      if (p.canRetryNative) {
        esc.appendChild(h('button', {
          class: 'ghu-btn', text: t('pkTryNative'),
          onclick: function () { pickNative(); }
        }));
      }
      if (esc.children.length) listBox.appendChild(esc);
    } else {
      var shown = 0;
      for (var e = 0; e < p.entries.length; e++) {
        var ent = p.entries[e];
        if (ent.hidden && !p.showHidden) continue;
        shown++;
        (function (entry) {
          // 受限目录（System Volume Information、WindowsApps…）：显示为不可进入，点了也不跳，
          // 而不是让整个列表失败 —— 宿主侧已经逐项探测并标了 unreadable。
          var blocked = entry.unreadable === true;
          listBox.appendChild(h('div', {
            class: 'ghu-dirrow' + (entry.hidden ? ' ghu-hiddenrow' : '') + (blocked ? ' ghu-blockedrow' : ''),
            title: blocked ? (entry.path + '\n' + t('pkBlockedTip')) : entry.path,
            onclick: function () { if (blocked) { toast(t('pkBlockedTip')); return; } browseTo(entry.path); }
          }, [
            h('span', { class: 'ghu-diricon', html: blocked ? LOCK_ICON : FOLDER_ICON }),
            h('span', { class: 'ghu-grow', text: entry.name }),
            blocked ? h('span', { class: 'ghu-muted', text: t('pkBlocked') }) : null
          ]));
        })(ent);
      }
      if (!shown) {
        listBox.appendChild(h('div', {
          class: 'ghu-muted', style: 'padding:10px;',
          text: p.showHidden ? t('pkEmpty') : t('pkEmptyHidden')
        }));
      }
      if (p.truncated) {
        listBox.appendChild(h('div', { class: 'ghu-muted', style: 'padding:6px 10px;', text: t('pkTruncated') }));
      }
      if (p.blockedCount) {
        listBox.appendChild(h('div', {
          class: 'ghu-muted', style: 'padding:6px 10px;',
          text: t('pkBlockedNote', p.blockedCount, (p.blockedNames || []).join('、'))
        }));
      }
    }
    card.appendChild(listBox);

    var foot = h('div', { class: 'ghu-modal-foot' });
    var hid = h('input', { class: 'ghu-cb', type: 'checkbox', checked: p.showHidden });
    hid.addEventListener('change', function () { p.showHidden = hid.checked; renderPicker(); });
    foot.appendChild(h('label', { class: 'ghu-switch' }, [hid, t('pkShowHidden')]));

    if (p.canCreate) {
      var nm = h('input', { class: 'ghu-input', style: 'max-width:160px;', placeholder: t('pkNewPh'), value: p.newName });
      nm.addEventListener('input', function () { p.newName = nm.value; });
      nm.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') makeFolder(); });
      foot.appendChild(nm);
      foot.appendChild(h('button', {
        class: 'ghu-btn', text: t('pkCreate'),
        disabled: !(p.newName || '').trim(),
        onclick: makeFolder
      }));
    }

    foot.appendChild(h('span', { class: 'ghu-grow' }));
    // 系统对话框入口：原生选择器能去任何位置（本插件的目录列举在某些根目录上会失败），
    // 内置浏览器更直观、能一眼看清目录结构。两个都留着，按场景选。
    foot.appendChild(h('button', {
      class: 'ghu-btn', text: t('pkOpenNative'),
      title: t('pkOpenNativeTip'),
      disabled: S.picking,
      onclick: pickNative
    }));
    foot.appendChild(h('button', { class: 'ghu-btn', text: t('pkCancel'), onclick: closePicker }));
    foot.appendChild(h('button', {
      class: 'ghu-btn ghu-primary', text: t('pkChoose'),
      disabled: !p.path || p.loading,
      onclick: chooseFolder
    }));
    card.appendChild(foot);

    if (p.note) card.appendChild(h('div', { class: 'ghu-diag', style: 'padding:0 14px 10px;', text: p.note }));
    pickerEl.appendChild(card);
  }

  /** 扫描当前 S.dir；按钮和「选完文件夹自动扫描」都走这里。 */
  function scanNow() {
    if (S.scanBusy) return;
    if (!S.bound) { S.error = t('needBind'); S.tab = 'account'; render(); return; }
    if (!S.repo) { S.error = t('needRepo'); S.tab = 'repo'; render(); return; }
    // 归一化后再用：粘贴来的路径可能带引号 / 重复分隔符 / 尾随分隔符。
    var cleaned = cleanDir(S.dir);
    if (cleaned !== S.dir) {
      S.dir = cleaned;
      toast(t('dirCleaned'));
    }
    S.scanBusy = true;
    S.error = '';
    render();
    keep(LS_DIR, S.dir);
    api('scan', { dir: S.dir, useGitignore: true }).then(function (d) {
      S.scanBusy = false;
      S.scan = d;
      S.fileFilter = '';
      S.collapsed = {};
      applyDefaults();
      if (!S.message) S.message = 'update ' + (S.repo.fullName || '') + ' @ ' + new Date().toLocaleString();
      S.tab = 'upload';
      render();
      toast(d.prunedCount ? t('scanDonePruned', d.files.length, d.prunedCount) : t('scanDone', d.files.length));
      // 用户是先点了「本聊天改动的文件」才触发这次扫描的：扫完接着把选择做掉。
      if (S.pendingSessionPick) {
        S.pendingSessionPick = false;
        applySessionPick();
      }
    }).catch(function (e) {
      S.scanBusy = false;
      S.pendingSessionPick = false;
      S.error = String((e && e.message) || e);
      render();
    });
  }

  /* ---------- 按会话自动勾选 ---------- */

  /* 会话里每个文件的状态 → 文案 key */
  var MARK_KEY = {
    written: 'markWritten', edited: 'markEdited',
    read: 'markRead', searched: 'markSearched'
  };

  function sessionLabel(session) {
    if (!session) return '';
    return session.title || session.id || '';
  }

  /** 两个路径是不是同一个目录（大小写与分隔符都不敏感）。 */
  function samePath(a, b) {
    var na = cleanDir(String(a || '')).replace(/\\/g, '/').toLowerCase();
    var nb = cleanDir(String(b || '')).replace(/\\/g, '/').toLowerCase();
    return na !== '' && na === nb;
  }

  /** 文件树上的会话标记；只有当标记所依据的根和当前扫描的根一致时才可信。 */
  function sessionMark(path) {
    if (!S.scan || !S.sessionRoot) return undefined;
    if (!samePath(S.scan.root, S.sessionRoot)) return undefined;
    return S.sessionFiles[path];
  }

  /**
   * 不需要先选文件夹：直接问宿主「这次聊天在哪个目录里干了活」。
   * 宿主会按「活着的会话优先」挑会话，再用被写入/修改文件的最深公共目录推断项目根。
   */
  function detectProject(force) {
    if (S.detectBusy) return;
    if (S.detect && !force) return;
    S.detectBusy = true;
    render();
    api('session-files', {}).then(function (d) {
      S.detectBusy = false;
      S.detect = d;
      // 同一份返回也用于「来源会话」那一行说明
      S.sessionInfo = d;
      if (d && d.projectRoot) {
        S.sessionRoot = d.projectRoot;
        var indexRoot = {};
        var list = d.files || [];
        // 这里的相对路径是相对 projectRoot 的；和扫描结果的真实大小写对不上就先留着，
        // 等真正按扫描根重取时再映射（applySessionPick 会做）。
        for (var i = 0; i < list.length; i++) indexRoot[String(list[i].path).toLowerCase()] = list[i];
        S.detectFiles = indexRoot;
        // 只在输入框还空着的时候自动填 —— 不覆盖用户自己选的目录。
        if (!S.dir) { S.dir = cleanDir(d.projectRoot); S.detectFilled = true; }
      }
      render();
    }).catch(function (e) {
      S.detectBusy = false;
      S.detectError = String((e && e.message) || e);
      render();
    });
  }

  /**
   * 点「未上传的改动」：还没扫描就先扫描，扫完再比对。
   *
   * 语义是**跨会话累计**的「还没上传的改动」—— 用内容与远程分支比对，而不是只看当前这一轮
   * 会话日志。这样上一轮改了但没上传的文件也会被带出来，更接近「把该传的传上去」的直觉。
   * 会话标记（文件树上的小圆点）仍然保留，用来提示"这一轮动过哪些"。
   */
  function pickSessionFiles() {
    if (S.sessionBusy) return;
    if (!S.dir) {
      S.error = t('upPickSessionHint');
      render();
      detectProject(true);
      return;
    }
    if (!S.scan || !samePath(S.scan.root, S.dir)) {
      S.pendingSessionPick = true;
      scanNow();
      return;
    }
    applySessionPick();
  }

  function applySessionPick() {
    if (S.sessionBusy) return;
    if (!S.scan) return;
    if (!S.repo) { S.error = t('needRepo'); render(); return; }
    S.sessionBusy = true;
    S.error = '';
    render();
    api('pending-files', {
      owner: S.repo.owner, repo: S.repo.name,
      dir: S.scan.root, branch: S.branch || S.repo.defaultBranch || 'main',
      deep: S.deepCompare === true
    }).then(function (d) {
      S.sessionBusy = false;
      S.pendingInfo = d;
      S.sessionRoot = S.scan.root;
      // 映射回本次扫描到的真实路径（大小写不敏感），顺带丢掉不在项目里的
      var index = {};
      for (var q = 0; q < S.scan.files.length; q++) {
        index[S.scan.files[q].path.toLowerCase()] = S.scan.files[q].path;
      }
      var picked = {};
      var n = 0;
      var list = d.files || [];
      for (var i = 0; i < list.length; i++) {
        var real = index[String(list[i].path).toLowerCase()];
        if (real) { picked[real] = true; n++; }
      }
      S.picked = picked;
      computeStats();
      render();
      // 顺带说一句「这一轮会话动过几个」，方便判断是不是全都被带出来了
      var sessionCount = 0;
      for (var k in S.sessionFiles) sessionCount++;
      if (!d.remoteOk) toast(t('upPickPendingNew', d.branch, d.localFiles));
      else if (n) toast(t('upPickPendingOk', n, sessionCount));
      else toast(t('upPickPendingNone'));
    }).catch(function (e) {
      S.sessionBusy = false;
      S.error = String((e && e.message) || e);
      render();
    });
  }

  /**
   * 还没扫描时显示的那张卡：先把「本次聊天的项目目录」摆出来，
   * 用户不用先去资源管理器里翻文件夹。
   */
  function detectCard() {
    if (S.detectBusy) {
      return h('div', { class: 'ghu-muted', style: 'margin-top:10px;', text: t('detectBusy') });
    }
    if (S.detectError) {
      return h('div', { class: 'ghu-diag', style: 'margin-top:10px;', text: t('detectFailed', S.detectError) });
    }
    var d = S.detect;
    // 绝不返回 null：调用方会直接 appendChild，null 会抛 TypeError 打断整个 render。
    if (!d || !d.projectRoot) return h('div');
    var same = samePath(d.projectRoot, S.dir);
    var wrote = d.counts ? (d.counts.written || 0) + (d.counts.edited || 0) : 0;
    return h('div', { class: 'ghu-card', style: 'cursor:default;margin-top:10px;' }, [
      h('div', { style: 'font-size:12px;font-weight:600;', text: t('detectFound') }),
      h('div', { class: 'ghu-pathbar', style: 'margin:6px 0 0;', text: d.projectRoot + (same && S.detectFilled ? t('detectOther') : '') }),
      h('div', { class: 'ghu-muted', style: 'margin-top:6px;', text: t('detectNote', sessionLabel(d.session), wrote) }),
      h('div', { class: 'ghu-row', style: 'margin-top:8px;' }, [
        h('button', {
          class: 'ghu-btn ghu-primary',
          text: same ? t('detectScan') : t('detectUse'),
          disabled: S.scanBusy,
          onclick: function () {
            S.dir = cleanDir(d.projectRoot);
            S.detectFilled = false;
            keep(LS_DIR, S.dir);
            scanNow();
          }
        }),
        same ? null : h('button', {
          class: 'ghu-btn', text: t('detectIgnore'),
          onclick: function () { S.detect = null; S.detectError = ''; render(); }
        })
      ])
    ]);
  }

  /* ---------- 渲染 ---------- */

  function render() {
    if (!panel) return;
    panel.className = S.open ? 'ghu-open' : '';
    applyFabState();
    fab.title = S.open ? t('fabOpenTip') : t('fabTitle');
    fab.setAttribute('aria-label', t('fabLabel'));
    var titleEl = document.getElementById('ghu-title');
    if (titleEl) titleEl.textContent = t('panelTitle');
    var subEl = document.getElementById('ghu-sub');
    if (subEl) subEl.textContent = t('panelSub');
    var closeEl = document.getElementById('ghu-close');
    if (closeEl) { closeEl.title = t('closeTip'); closeEl.textContent = t('close'); }
    var minEl = document.getElementById('ghu-min');
    if (minEl) { minEl.title = t('minTip'); minEl.setAttribute('aria-label', t('min')); }

    var langBox = document.getElementById('ghu-lang');
    if (langBox) {
      langBox.innerHTML = '';
      var pairs = [['zh', '中文'], ['en', 'EN']];
      for (var i = 0; i < pairs.length; i++) {
        (function (code, label) {
          langBox.appendChild(h('button', {
            class: 'ghu-langbtn' + (S.lang === code ? ' ghu-on' : ''),
            text: label,
            onclick: function () { setLang(code); }
          }));
        })(pairs[i][0], pairs[i][1]);
      }
    }

    var tabs = document.getElementById('ghu-tabs');
    var body = document.getElementById('ghu-body');
    var foot = document.getElementById('ghu-foot');
    if (!tabs || !body || !foot) return;
    tabs.innerHTML = '';
    body.innerHTML = '';
    foot.innerHTML = '';

    var defs = [['account', t('tabAccount')], ['repo', t('tabRepo')], ['upload', t('tabUpload')], ['settings', t('tabSettings')]];
    for (var d = 0; d < defs.length; d++) {
      (function (id, label) {
        tabs.appendChild(h('button', {
          class: 'ghu-tab' + (S.tab === id ? ' ghu-on' : ''),
          text: label,
          onclick: function () { S.tab = id; S.error = ''; render(); if (id === 'repo' && S.bound && !S.repos.length) loadRepos(); if (id === 'upload') detectProject(); }
        }));
      })(defs[d][0], defs[d][1]);
    }

    if (S.error) body.appendChild(h('div', { class: 'ghu-err', text: S.error }));

    if (S.tab === 'account') renderAccount(body, foot);
    else if (S.tab === 'repo') renderRepo(body, foot);
    else if (S.tab === 'upload') renderUpload(body, foot);
    else renderSettings(body, foot);
  }

  function renderAccount(body, foot) {
    var card = h('div', { class: 'ghu-sec' });
    card.appendChild(h('h4', { text: t('acctHeading') }));

    if (S.bound && S.user) {
      var av = S.user.avatar
        ? h('img', { src: S.user.avatar, alt: '' })
        : h('div', { style: 'width:34px;height:34px;border-radius:50%;background:#888;' });
      card.appendChild(h('div', { class: 'ghu-acct' }, [
        av,
        h('div', { class: 'ghu-grow' }, [
          h('div', { style: 'font-weight:600;', text: S.user.name || S.user.login }),
          h('div', { class: 'ghu-muted', text: '@' + S.user.login })
        ]),
        link(S.user.url, t('acctProfile'))
      ]));
      var meta = S.tokenMeta || {};
      var lines = [];
      if (meta.kind === 'classic') {
        lines.push(meta.scopes ? t('acctKindClassic', meta.scopes) : t('acctKindClassicNone'));
      } else if (meta.kind === 'fine-grained') {
        lines.push(t('acctKindFine'));
      }
      if (meta.expires) lines.push(t('acctExpires', meta.expires));
      if (S.hint) lines.push(S.hint);
      if (lines.length) card.appendChild(h('div', { class: 'ghu-diag', text: lines.join('\n') }));
      card.appendChild(h('p', { class: 'ghu-muted', style: 'margin:10px 0 0;', text: t('acctBound') }));
      /* 持久化状态由宿主回报的 persist 明细决定（三个字段，不是一个布尔值）：
       *   source   —— 令牌来自哪一层：file=凭据库；env/.env=只读来源
       *   writable —— 能否写入凭据库（被只读来源遮蔽时为 false，而非「不可写」）
       *   inStore  —— 凭据库里到底有没有令牌 */
      var P = S.persist || {};
      if (P.inStore === true || P.source === 'file') {
        if (P.writable === false || P.source === 'env' || P.source === '.env') {
          card.appendChild(h('div', { class: 'ghu-diag', style: 'margin-top:8px;', text: t('acctPersistShadowed') }));
        } else {
          card.appendChild(h('div', { class: 'ghu-ok', style: 'margin-top:8px;', text: t('acctPersistOn') }));
        }
      } else if (S.persisted === true) {
        // 兼容旧宿主：只回 persisted 布尔值
        card.appendChild(h('div', { class: 'ghu-ok', style: 'margin-top:8px;', text: t('acctPersistOn') }));
      } else if (S.persisted === false) {
        card.appendChild(h('div', { class: 'ghu-warn', style: 'margin-top:8px;', text: t('acctPersistOff') }));
      }
      body.appendChild(card);

      foot.appendChild(h('button', { class: 'ghu-btn', text: t('acctUnbind'), onclick: function () {
        S.token = ''; keep(LS_TOKEN, null); S.bound = false; S.user = null;
        S.tokenMeta = null; S.hint = ''; S.diag = []; S.repos = []; S.persisted = null;
        guard(api('auth-clear').then(function () { render(); }));
      } }));
      foot.appendChild(h('button', {
        class: 'ghu-btn ghu-primary', text: t('acctNext'),
        onclick: function () { S.tab = 'repo'; render(); loadRepos(); }
      }));
      body.appendChild(checkCard());
      return;
    }

    card.appendChild(h('p', { class: 'ghu-muted', style: 'margin-top:0;', text: t('acctIntro') }));
    card.appendChild(h('div', { class: 'ghu-warn' }, [
      h('b', { text: t('acctDiffTitle') }),
      h('ul', null, [
        h('li', null, [t('acctClassicLi', 'repo'), ' ', link(TOKEN_URL_CLASSIC, t('acctClassicLink'))]),
        h('li', null, [t('acctFineLi'), ' ', link(TOKEN_URL_FINE, t('acctFineLink'))])
      ])
    ]));
    var input = h('input', { class: 'ghu-input', type: 'password', placeholder: 'ghp_... / github_pat_...', value: S.token });
    input.addEventListener('input', function () { S.token = input.value; });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') bindToken(); });
    card.appendChild(input);
    var rem = h('input', { class: 'ghu-cb', type: 'checkbox', checked: S.remember });
    rem.addEventListener('change', function () { S.remember = rem.checked; });
    card.appendChild(h('label', { class: 'ghu-switch', style: 'margin-top:8px;' }, [rem, t('acctRemember')]));
    body.appendChild(card);

    var btn = h('button', { class: 'ghu-btn ghu-primary', text: t('acctBind'), onclick: bindToken });
    foot.appendChild(btn);
    body.appendChild(checkCard());

    function bindToken() {
      var tok = input.value.trim();
      if (!tok) { S.error = t('acctTokenEmpty'); render(); return; }
      btn.disabled = true; btn.textContent = t('acctBinding');
      S.error = '';
      api('auth-set', { token: tok }).then(function (r) {
        S.token = tok;
        applyAuth(r);
        if (S.remember) keep(LS_TOKEN, tok); else keep(LS_TOKEN, null);
        S.repos = [];
        toast(t('acctBindOk', r.user ? r.user.login : ''));
        render();
        loadRepos();
      }).catch(function (e) {
        S.error = String((e && e.message) || e);
        render();
      });
    }
  }

  function checkCard() {
    var box = h('div', { class: 'ghu-sec' });
    box.appendChild(h('h4', { text: t('envHeading') }));
    var env = S.env || {};
    var kv = function (k, v) {
      return h('div', { class: 'ghu-kv' }, [
        h('span', { class: 'ghu-muted', text: k }),
        h('span', { style: 'word-break:break-all;text-align:right;', text: v })
      ]);
    };
    box.appendChild(kv(t('envDefaultDir'), env.projectRoot || '-'));
    // 界面版本：用来分辨「刷新后跑的是哪一版」。DSH 给客户端模块发的缓存头是
    // `max-age=31536000, immutable`，URL 里的 rev 只由 HMR 重算；HMR 没重算时刷新也会吃旧缓存。
    box.appendChild(kv(t('envVersion'), window.__DSH_GHU_VERSION__ || '?'));
    if (env.nodePath) box.appendChild(kv(t('envNode'), env.nodePath));
    if (env.assetDir) box.appendChild(kv(t('envAssets'), prettyPath(env.assetDir)));
    if (env.picker) box.appendChild(kv(t('envPicker'), env.picker.kind || t('pickerNone')));

    var btn = h('button', { class: 'ghu-btn', text: t('envSelfTest'), onclick: function () {
      btn.disabled = true; btn.textContent = t('envTesting');
      S.check = '';
      api('ping').then(function (d) {
        S.check = t('envOk', d.status, d.zen);
      }).catch(function (e) {
        S.check = t('envFail', String((e && e.message) || e));
      }).then(function () { render(); });
    } });
    box.appendChild(h('div', { class: 'ghu-row', style: 'margin-top:8px;' }, [btn]));
    if (S.check) {
      box.appendChild(h('div', {
        class: S.check.indexOf('OK') === 0 ? 'ghu-ok' : 'ghu-err',
        style: 'margin-top:8px;', text: S.check
      }));
    }
    return box;
  }

  function renderRepo(body, foot) {
    if (!S.bound) { body.appendChild(h('p', { class: 'ghu-muted', text: t('needBind') })); return; }

    var q = h('input', { class: 'ghu-input ghu-grow', placeholder: t('repoSearchPh'), value: S.repoFilter });
    q.addEventListener('input', function () { S.repoFilter = q.value; });
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') loadRepos(); });
    body.appendChild(h('div', { class: 'ghu-row', style: 'margin-bottom:10px;' }, [
      q, h('button', { class: 'ghu-btn', text: t('repoRefresh'), onclick: loadRepos })
    ]));

    body.appendChild(h('div', { class: 'ghu-row', style: 'margin-bottom:8px;' }, [
      h('span', {
        class: 'ghu-muted ghu-grow',
        text: S.repoBusy ? t('repoLoading') : t('repoCount', S.repos.length)
      }),
      h('button', {
        class: 'ghu-btn', text: S.newOpen ? t('repoCollapse') : t('repoNew'),
        onclick: function () { S.newOpen = !S.newOpen; render(); }
      })
    ]));

    if (S.newOpen) {
      var nm = h('input', { class: 'ghu-input', placeholder: t('repoNamePh'), value: S.newName });
      nm.addEventListener('input', function () { S.newName = nm.value; });
      var ds = h('input', { class: 'ghu-input', placeholder: t('repoDescPh'), value: S.newDesc });
      ds.addEventListener('input', function () { S.newDesc = ds.value; });
      var pv = h('input', { class: 'ghu-cb', type: 'checkbox', checked: S.newPrivate });
      pv.addEventListener('change', function () { S.newPrivate = pv.checked; });
      var createBtn = h('button', { class: 'ghu-btn ghu-primary', text: t('repoCreate'), onclick: function () {
        createBtn.disabled = true; createBtn.textContent = t('repoCreating');
        guard(api('create-repo', { name: S.newName, private: S.newPrivate, description: S.newDesc }).then(function (d) {
          S.newOpen = false; S.newName = ''; S.newDesc = '';
          // 先把新仓库插到列表最前面，再后台拉一次对齐 GitHub 的排序/字段 ——
          // 否则用户会看到列表里没有新仓库，以为创建失败了。
          var rest = [];
          for (var i = 0; i < S.repos.length; i++) {
            if (S.repos[i].fullName !== d.repo.fullName) rest.push(S.repos[i]);
          }
          S.repos = [d.repo].concat(rest);
          S.repoFilter = '';
          selectRepo({
            owner: d.repo.owner, name: d.repo.name, fullName: d.repo.fullName,
            private: d.repo.private, url: d.repo.url, defaultBranch: d.repo.defaultBranch
          });
          toast(t('repoCreated', d.repo.fullName));
          loadRepos();
        }));
      } });
      body.appendChild(h('div', { class: 'ghu-card', style: 'cursor:default;' }, [
        nm, h('div', { style: 'height:6px;' }), ds,
        h('label', { class: 'ghu-switch', style: 'margin-top:8px;' }, [pv, t('repoPrivateNew')]),
        h('div', { style: 'margin-top:10px;' }, [createBtn])
      ]));
    }

    var list = h('div', { class: 'ghu-repolist' });
    if (!S.repos.length && !S.repoBusy) {
      list.appendChild(h('div', { class: 'ghu-muted', style: 'padding:10px;', text: t('repoNone') }));
    }
    for (var i = 0; i < S.repos.length; i++) {
      (function (r) {
        var on = S.repo && S.repo.fullName === r.fullName;
        var tail = r.defaultBranch ? ' · ' + t('repoDefaultBranch', r.defaultBranch) : ' · ' + t('repoEmptyRepo');
        list.appendChild(h('div', {
          class: 'ghu-card' + (on ? ' ghu-on' : ''),
          onclick: function () { selectRepo(r); }
        }, [
          h('div', { class: 'ghu-row' }, [
            h('span', { style: 'font-weight:600;', text: r.fullName }),
            h('span', { class: 'ghu-tag', text: r.private ? t('tagPrivate') : t('tagPublic') }),
            r.archived ? h('span', { class: 'ghu-tag', text: t('tagArchived') }) : null
          ]),
          h('div', { class: 'ghu-muted', text: (r.description || t('repoNoDesc')) + tail })
        ]));
      })(S.repos[i]);
    }
    body.appendChild(list);

    if (!S.repos.length && !S.repoBusy) body.appendChild(emptyReposCard());
    if (S.diag.length) body.appendChild(h('div', { class: 'ghu-diag', text: S.diag.join('\n') }));
    body.appendChild(manualCard());

    if (S.repo) {
      foot.appendChild(h('span', { class: 'ghu-muted ghu-grow', text: t('repoSelected', S.repo.fullName) }));
      foot.appendChild(h('button', {
        class: 'ghu-btn ghu-primary', text: t('repoGoUpload'),
        onclick: function () { S.tab = 'upload'; render(); }
      }));
    }
  }

  /** 列表为空时的排障指引 —— 这是「绑定成功但看不到仓库」最常见的原因。 */
  function emptyReposCard() {
    var meta = S.tokenMeta || {};
    var box = h('div', { class: 'ghu-warn', style: 'margin-top:10px;' });
    box.appendChild(h('b', { text: t('guidTitle') }));
    box.appendChild(h('div', { style: 'margin-top:4px;', text: t('guidLead', S.user ? S.user.login : '') }));
    box.appendChild(h('ul', null, [
      h('li', null, [t('guidFine'), ' ', link(TOKEN_URL_FINE, t('guidRegenFine'))]),
      h('li', null, [t('guidClassic1', 'repo', meta.scopes || '—'), ' ', link(TOKEN_URL_CLASSIC, t('guidRegenClassic'))]),
      h('li', null, t('guidNone'))
    ]));
    box.appendChild(h('div', { style: 'margin-top:8px;', text: t('guidManual') }));
    return box;
  }

  function manualCard() {
    var card = h('div', { class: 'ghu-card', style: 'cursor:default;margin-top:8px;' });
    card.appendChild(h('div', { style: 'font-size:12px;font-weight:600;margin-bottom:6px;', text: t('repoManualTitle') }));
    var inp = h('input', { class: 'ghu-input ghu-grow', placeholder: t('repoManualPh'), value: S.manual });
    inp.addEventListener('input', function () { S.manual = inp.value; });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') use(); });
    var btn = h('button', { class: 'ghu-btn', text: t('repoManualUse'), onclick: use });
    function use() {
      var v = S.manual.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
      var parts = v.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        S.error = t('repoManualBad');
        render();
        return;
      }
      guard(api('get-repo', { owner: parts[0], repo: parts[1] }).then(function (d) {
        selectRepo({
          owner: d.repo.owner, name: d.repo.name, fullName: d.repo.fullName,
          private: d.repo.private, url: d.repo.url, defaultBranch: d.repo.defaultBranch
        });
        toast(t('repoManualOk', d.repo.fullName));
      }));
    }
    card.appendChild(h('div', { class: 'ghu-row' }, [inp, btn]));
    return card;
  }

  /* ---------- 文件选择统计 ---------- */

  function computeStats() {
    var files = (S.scan && S.scan.files) || [];
    var map = {};
    var total = 0, sel = 0, bytes = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var on = S.picked[f.path] === true;
      var parts = f.path.split('/');
      var pref = '';
      for (var j = 0; j < parts.length - 1; j++) {
        pref = pref ? pref + '/' + parts[j] : parts[j];
        if (!map[pref]) map[pref] = { total: 0, selected: 0 };
        map[pref].total++;
        if (on) map[pref].selected++;
      }
      total++;
      if (on) { sel++; bytes += f.size; }
    }
    S.stats = map; S.totalFiles = total; S.selFiles = sel; S.selBytes = bytes;
  }

  function applyDefaults() {
    var files = (S.scan && S.scan.files) || [];
    var picked = {};
    for (var i = 0; i < files.length; i++) {
      if (!files[i].ignored) picked[files[i].path] = true;
    }
    S.picked = picked;
    computeStats();
  }

  function setAll() {
    var files = (S.scan && S.scan.files) || [];
    var picked = {};
    for (var i = 0; i < files.length; i++) picked[files[i].path] = true;
    S.picked = picked;
    computeStats();
  }

  function setNone() {
    S.picked = {};
    computeStats();
  }

  function setSubtree(prefix, value) {
    var files = (S.scan && S.scan.files) || [];
    for (var i = 0; i < files.length; i++) {
      var p = files[i].path;
      if (p.indexOf(prefix + '/') === 0) {
        if (value) S.picked[p] = true; else delete S.picked[p];
      }
    }
    computeStats();
  }

  /* ---------- 文件树 ---------- */

  function treeOf(files) {
    var rootNode = { name: '', path: '', dirs: {}, files: [] };
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var parts = f.path.split('/');
      var node = rootNode;
      for (var j = 0; j < parts.length - 1; j++) {
        var seg = parts[j];
        if (!node.dirs[seg]) node.dirs[seg] = { name: seg, path: node.path ? node.path + '/' + seg : seg, dirs: {}, files: [] };
        node = node.dirs[seg];
      }
      node.files.push(f);
    }
    return rootNode;
  }

  function renderTree(container) {
    var files = (S.scan && S.scan.files) || [];
    var filter = S.fileFilter.trim().toLowerCase();
    var shown = [];
    for (var i = 0; i < files.length; i++) {
      if (filter && files[i].path.toLowerCase().indexOf(filter) === -1) continue;
      if (!S.showIgnored && files[i].ignored) continue;
      shown.push(files[i]);
      if (shown.length >= MAX_ROWS) break;
    }
    container.innerHTML = '';
    if (!shown.length) {
      container.appendChild(h('div', { class: 'ghu-muted', style: 'padding:8px;', text: t('treeEmpty') }));
      return;
    }
    if (shown.length >= MAX_ROWS) {
      container.appendChild(h('div', { class: 'ghu-muted', style: 'padding:6px;', text: t('treeCapped') }));
    }
    var out = [];
    walkTree(treeOf(shown), 0, out);
    for (var k = 0; k < out.length; k++) container.appendChild(out[k]);
  }

  function walkTree(node, depth, out) {
    var names = Object.keys(node.dirs).sort();
    for (var i = 0; i < names.length; i++) {
      var d = node.dirs[names[i]];
      var st = S.stats[d.path] || { total: 0, selected: 0 };
      var collapsed = S.collapsed[d.path] === true;
      var cb = h('input', { class: 'ghu-cb', type: 'checkbox' });
      cb.dataset.dir = d.path;
      cb.checked = st.total > 0 && st.selected === st.total;
      cb.indeterminate = st.selected > 0 && st.selected < st.total;
      cb.addEventListener('change', function (dd) {
        return function (ev) { setSubtree(dd.path, ev.target.checked); syncTree(); };
      }(d));
      var caret = h('span', {
        class: 'ghu-caret',
        html: collapsed
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>',
        title: collapsed ? t('treeExpand') : t('treeCollapse')
      });
      caret.addEventListener('click', function (dd) {
        return function () { S.collapsed[dd.path] = !(S.collapsed[dd.path] === true); refreshTree(); };
      }(d));
      out.push(h('div', { class: 'ghu-frow ghu-drow', style: 'padding-left:' + (4 + depth * 13) + 'px' }, [
        caret, cb,
        h('span', { class: 'ghu-fname', title: d.path, text: d.name + '/' }),
        h('span', { class: 'ghu-fsize', text: st.total })
      ]));
      if (!collapsed) walkTree(d, depth + 1, out);
    }
    var fs = node.files;
    for (var k = 0; k < fs.length; k++) {
      (function (f) {
        var cb2 = h('input', { class: 'ghu-cb', type: 'checkbox' });
        cb2.dataset.file = f.path;
        cb2.checked = S.picked[f.path] === true;
        cb2.addEventListener('change', function (ev) {
          if (ev.target.checked) S.picked[f.path] = true; else delete S.picked[f.path];
          computeStats(); syncTree();
        });
        var act = sessionMark(f.path);
        var mk = act
          ? h('span', { class: 'ghu-mark ghu-mark-' + act, title: t(MARK_KEY[act] || 'markRead') })
          : null;
        out.push(h('div', {
          class: 'ghu-frow' + (f.ignored ? ' ghu-ignored' : ''),
          style: 'padding-left:' + (4 + depth * 13 + 17) + 'px',
          title: f.path + (f.reason ? ' — ' + f.reason : '')
        }, [
          cb2,
          h('span', { class: 'ghu-fname', text: baseName(f.path) }),
          mk,
          h('span', { class: 'ghu-fsize', text: fmtSize(f.size) })
        ]));
      })(fs[k]);
    }
  }

  function refreshTree() {
    var c = document.getElementById('ghu-tree');
    if (c) renderTree(c);
  }

  function syncTree() {
    var c = document.getElementById('ghu-tree');
    if (!c) return;
    var boxes = c.querySelectorAll('input[data-file]');
    for (var i = 0; i < boxes.length; i++) boxes[i].checked = S.picked[boxes[i].dataset.file] === true;
    var dboxes = c.querySelectorAll('input[data-dir]');
    for (var j = 0; j < dboxes.length; j++) {
      var st = S.stats[dboxes[j].dataset.dir] || { total: 0, selected: 0 };
      dboxes[j].checked = st.total > 0 && st.selected === st.total;
      dboxes[j].indeterminate = st.selected > 0 && st.selected < st.total;
    }
    var sum = document.getElementById('ghu-sum');
    if (sum) sum.textContent = t('upSummary', S.selFiles, S.totalFiles, fmtSize(S.selBytes));
  }

  /* ---------- 上传 ---------- */

  function renderUpload(body, foot) {
    if (!S.bound) { body.appendChild(h('p', { class: 'ghu-muted', text: t('needBind') })); return; }
    if (!S.repo) { body.appendChild(h('p', { class: 'ghu-muted', text: t('needRepo') })); return; }
    if (!S.branch) S.branch = S.repo.defaultBranch || 'main';

    body.appendChild(h('div', { class: 'ghu-kv' }, [
      h('span', { class: 'ghu-muted', text: t('upTarget') }),
      h('span', {
        style: 'font-weight:600;text-align:right;word-break:break-all;',
        text: (S.repo.fullName || (S.repo.owner + '/' + S.repo.name)) + ' · ' + S.branch
      })
    ]));

    var dir = h('input', { class: 'ghu-input ghu-grow', placeholder: t('upDirPh'), value: S.dir });
    dir.addEventListener('input', function () { S.dir = dir.value; });
    dir.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') scanNow(); });
    // 粘贴完立刻把引号 / 重复分隔符洗掉，让人一眼看到真正会被用的路径
    dir.addEventListener('paste', function () {
      setTimeout(function () {
        var cleaned = cleanDir(dir.value);
        if (cleaned !== dir.value) {
          S.dir = cleaned;
          dir.value = cleaned;
          toast(t('dirCleaned'));
        }
      }, 0);
    });
    dir.addEventListener('blur', function () {
      var cleaned = cleanDir(dir.value);
      if (cleaned !== dir.value) { S.dir = cleaned; dir.value = cleaned; }
    });
    var pickBtn = h('button', {
      class: 'ghu-btn',
      text: t('upChoose'),
      // 三种情况分别给对应提示：只有系统对话框 / 只有内置浏览器 / 两者都有
      title: nativeOnly() ? t('upChooseTipNative')
        : (hasNativePicker() ? t('upChooseTip') : t('upChooseTipBrowse')),
      onclick: pickFolder
    });
    var scanBtn = h('button', {
      class: 'ghu-btn', text: S.scanBusy ? t('upScanning') : t('upScan'),
      disabled: S.scanBusy,
      onclick: scanNow
    });
    body.appendChild(h('h4', { style: 'margin:14px 0 6px;font-size:12px;color:var(--dsw-alias-label-secondary,#555);', text: t('upDirHeading') }));
    body.appendChild(h('div', { class: 'ghu-row' }, [dir, pickBtn, scanBtn]));

    /* 「未上传的改动」这一行在扫描前后都要有：没扫过时点它会先扫描再比对。
     * 语义是跨会话累计的「与远程不一致」，所以旁边附一个 deep 开关：
     * 默认只按大小 + 内容 sha 快速判断（tree 自带 sha，几乎不多发请求）；
     * 打开 deep 后连"大小相同"的文件也逐字节比对，最准但慢。 */
    var sessionRow = function () {
      var deep = h('input', { class: 'ghu-cb', type: 'checkbox', checked: S.deepCompare === true });
      deep.addEventListener('change', function () { S.deepCompare = deep.checked; });
      return h('div', { class: 'ghu-row', style: 'margin:10px 0 8px;' }, [
        h('button', {
          class: 'ghu-btn', text: S.sessionBusy ? t('upSessionPicking') : t('upPickSession'),
          title: t('upPickSessionTip'),
          disabled: S.sessionBusy,
          onclick: pickSessionFiles
        }),
        h('span', { class: 'ghu-muted ghu-grow', text: t('upPickSessionHint') }),
        h('label', { class: 'ghu-switch', title: t('upPickPendingDeep') }, [deep, t('upPickPendingDeep')])
      ]);
    };

    if (!S.scan) {
      body.appendChild(sessionRow());
      var dcard = detectCard();
      if (dcard) body.appendChild(dcard);
      body.appendChild(h('p', { class: 'ghu-muted', style: 'margin-top:10px;', text: t('upScanHint') }));
      return;
    }

    body.appendChild(h('div', { class: 'ghu-row', style: 'margin:14px 0 6px;' }, [
      h('span', {
        class: 'ghu-grow', id: 'ghu-sum', style: 'font-size:12px;font-weight:600;',
        text: t('upSummary', S.selFiles, S.totalFiles, fmtSize(S.selBytes))
      }),
      h('button', { class: 'ghu-btn', text: t('upAll'), onclick: function () { setAll(); refreshTree(); syncTree(); } }),
      h('button', { class: 'ghu-btn', text: t('upNone'), onclick: function () { setNone(); refreshTree(); syncTree(); } }),
      h('button', { class: 'ghu-btn', text: t('upReset'), onclick: function () { applyDefaults(); refreshTree(); syncTree(); } })
    ]));

    /* 说清「勾选」到底是什么语义：这是「更新」而不是「只传这些」 */
    body.appendChild(h('div', { class: 'ghu-diag', style: 'margin-bottom:8px;', text: t('upSelectionNote') }));

    var flt = h('input', { class: 'ghu-input ghu-grow', placeholder: t('upFilterPh'), value: S.fileFilter });
    flt.addEventListener('input', function () { S.fileFilter = flt.value; refreshTree(); });
    var ign = h('input', { class: 'ghu-cb', type: 'checkbox', checked: S.showIgnored });
    ign.addEventListener('change', function () { S.showIgnored = ign.checked; refreshTree(); });
    body.appendChild(h('div', { class: 'ghu-row', style: 'margin-bottom:6px;' }, [
      flt, h('label', { class: 'ghu-switch' }, [ign, t('upShowIgnored')])
    ]));

    /* 按会话自动勾选：把「这次聊天里动过的文件」一次选出来 */
    body.appendChild(sessionRow());
    if (S.sessionInfo) {
      var si = S.sessionInfo;
      var note = si.message || '';
      if (!note && si.session) {
        var wrote = (si.counts && (si.counts.written + si.counts.edited)) || 0;
        note = t('noteSession', sessionLabel(si.session), wrote, si.inside || 0);
        if (si.outside) note += t('noteSessionOutside', si.outside);
      }
      if (note) body.appendChild(h('div', { class: 'ghu-diag', style: 'margin-bottom:8px;', text: note }));
    }

    /* 比对结果自白：远程有多少文件、本地扫到多少、多少个没变、逐字节比了多少 ——
     * 让人能判断"只勾了 3 个"是因为真的只改了 3 个，而不是比对失灵。 */
    if (S.pendingInfo) {
      var pi = S.pendingInfo;
      var pnote = t('upPickPendingStat', pi.remoteFiles, pi.localFiles, pi.unchanged, pi.hashed);
      if (!pi.remoteOk) pnote = t('upPickPendingNew', pi.branch, pi.localFiles);
      body.appendChild(h('div', { class: 'ghu-diag', style: 'margin-bottom:8px;', text: pnote }));
    }

    var treeBox = h('div', { class: 'ghu-tree', id: 'ghu-tree' });
    body.appendChild(treeBox);
    renderTree(treeBox);

    /* 扫描结果自白：被跳过的目录、截断、应用了多少条 gitignore 规则 —— 避免「悄悄少了文件」 */
    var notes = [];
    if (S.scan.prunedCount) {
      var names = (S.scan.prunedDirs || []).slice(0, 6).join(', ');
      notes.push(t('notePruned', S.scan.prunedCount, names, S.scan.prunedCount > 6 ? t('notePrunedMore') : ''));
    }
    if (S.scan.truncated) notes.push(t('noteTruncated'));
    if (S.scan.gitignore) notes.push(t('noteGitignore', S.scan.gitignore));
    if (notes.length) body.appendChild(h('div', { class: 'ghu-diag', text: notes.join('\n') }));

    body.appendChild(h('label', { class: 'ghu-lbl', text: t('upCommit') }));
    var msg = h('input', { class: 'ghu-input', value: S.message });
    msg.addEventListener('input', function () { S.message = msg.value; });
    body.appendChild(msg);

    body.appendChild(h('label', { class: 'ghu-lbl', text: t('upBranch') }));
    var br = h('input', { class: 'ghu-input', value: S.branch, list: 'ghu-branches' });
    br.addEventListener('input', function () { S.branch = br.value; });
    var dl = h('datalist', { id: 'ghu-branches' });
    for (var i = 0; i < S.branches.length; i++) dl.appendChild(h('option', { value: S.branches[i] }));
    body.appendChild(br);
    body.appendChild(dl);

    var pr = h('input', { class: 'ghu-cb', type: 'checkbox', checked: S.prune });
    pr.addEventListener('change', function () { S.prune = pr.checked; });
    body.appendChild(h('label', { class: 'ghu-switch', style: 'margin-top:10px;' }, [pr, t('upPrune')]));

    body.appendChild(h('div', { class: 'ghu-sec', id: 'ghu-progress', style: 'margin-top:14px;' }));
    renderProgress();
    if (S.job && S.job.state === 'running') startPoll();

    var running = S.job && S.job.state === 'running';
    var up = h('button', {
      class: 'ghu-btn ghu-primary',
      text: running ? t('upUploading') : t('upStart'),
      disabled: running,
      onclick: doUpload
    });
    function doUpload() {
      if (!S.selFiles) { S.error = t('upPickOne'); render(); return; }
      var files = [];
      var all = S.scan.files;
      for (var k = 0; k < all.length; k++) if (S.picked[all[k].path] === true) files.push(all[k].path);
      S.error = '';
      up.disabled = true;
      api('upload-start', {
        owner: S.repo.owner, repo: S.repo.name, dir: S.scan.root, files: files,
        message: S.message, branch: S.branch, prune: S.prune
      }).then(function (d) {
        S.job = { id: d.jobId, state: 'running', phase: '', total: files.length, done: 0, log: [] };
        render();
        startPoll();
      }).catch(function (e) { S.error = String((e && e.message) || e); render(); });
    }
    foot.appendChild(h('span', { class: 'ghu-muted ghu-grow', text: S.repo.fullName }));
    foot.appendChild(up);
  }

  function renderProgress() {
    var box = document.getElementById('ghu-progress');
    if (!box) return;
    box.innerHTML = '';
    if (!S.job) return;
    var pct = S.job.total ? Math.round((S.job.done / S.job.total) * 100) : 0;
    var head = S.job.state === 'running'
      ? t('upProgress', S.job.phase || '')
      : (S.job.state === 'done' ? t('upDone') : t('upFailed'));
    box.appendChild(h('div', { class: 'ghu-row' }, [
      h('span', { class: 'ghu-grow', style: 'font-weight:600;', text: head }),
      h('span', { class: 'ghu-muted', text: S.job.total ? (S.job.done + ' / ' + S.job.total) : '' })
    ]));
    box.appendChild(h('div', { class: 'ghu-bar' }, [h('i', { style: 'width:' + pct + '%;' })]));
    if (S.job.current) box.appendChild(h('div', { class: 'ghu-muted', text: S.job.current }));
    if (S.job.error) box.appendChild(h('div', { class: 'ghu-err', style: 'margin-top:8px;', text: S.job.error }));
    if (S.job.result) {
      box.appendChild(h('div', { class: 'ghu-ok', text: t('upCommitted', S.job.result.commit.slice(0, 8), S.job.result.fileCount) }));
      box.appendChild(h('div', null, [link(S.job.result.commitUrl, S.job.result.commitUrl)]));
      box.appendChild(h('div', null, [link(S.job.result.repoUrl, t('upOpenRepo', S.job.result.repo))]));
    }
    if (S.job.log && S.job.log.length) box.appendChild(h('div', { class: 'ghu-log', text: S.job.log.join('\n') }));
  }

  function startPoll() {
    if (S.poll) return;
    S.poll = setInterval(function () {
      if (!S.job || S.job.state !== 'running') { clearInterval(S.poll); S.poll = null; return; }
      api('job-status', { jobId: S.job.id }).then(function (d) {
        S.job = d;
        renderProgress();
        if (d.state !== 'running') {
          clearInterval(S.poll); S.poll = null;
          render();
          if (d.state === 'done') {
            toast(t('uploadOk', d.result ? d.result.commit.slice(0, 8) : ''));
            loadBranches();
          }
        }
      }).catch(function () { clearInterval(S.poll); S.poll = null; });
    }, 700);
  }

  /* ---------- 仓库信息 ---------- */

  function renderSettings(body, foot) {
    if (!S.bound) { body.appendChild(h('p', { class: 'ghu-muted', text: t('needBind') })); return; }
    if (!S.repo) { body.appendChild(h('p', { class: 'ghu-muted', text: t('needRepo') })); return; }
    foot.appendChild(h('button', { class: 'ghu-btn', text: t('setOpen'), onclick: function () { window.open(S.repo.url, '_blank'); } }));

    if (!S.edit) {
      body.appendChild(h('p', { class: 'ghu-muted', text: t('setLoading') }));
      api('get-repo', { owner: S.repo.owner, repo: S.repo.name }).then(function (d) {
        S.edit = {
          name: d.repo.name, description: d.repo.description, homepage: d.repo.homepage,
          private: d.repo.private, archived: d.repo.archived, hasIssues: d.repo.hasIssues,
          hasWiki: d.repo.hasWiki, topics: (d.repo.topics || []).join(', '),
          url: d.repo.url, fullName: d.repo.fullName
        };
        render();
      }).catch(function (e) { S.error = String((e && e.message) || e); render(); });
      return;
    }

    var f = S.edit;
    body.appendChild(h('div', { class: 'ghu-kv' }, [
      h('span', { class: 'ghu-muted', text: t('upTarget') }),
      h('span', { style: 'font-weight:600;', text: f.fullName })
    ]));

    body.appendChild(h('label', { class: 'ghu-lbl', text: t('setName') }));
    var nm = h('input', { class: 'ghu-input', value: f.name });
    nm.addEventListener('input', function () { f.name = nm.value; });
    body.appendChild(nm);

    body.appendChild(h('label', { class: 'ghu-lbl', text: t('setDesc') }));
    var ds = h('textarea', { class: 'ghu-textarea', value: f.description });
    ds.addEventListener('input', function () { f.description = ds.value; });
    body.appendChild(ds);

    body.appendChild(h('label', { class: 'ghu-lbl', text: t('setHomepage') }));
    var hp = h('input', { class: 'ghu-input', value: f.homepage });
    hp.addEventListener('input', function () { f.homepage = hp.value; });
    body.appendChild(hp);

    body.appendChild(h('label', { class: 'ghu-lbl', text: t('setTopics') }));
    var tp = h('input', { class: 'ghu-input', value: f.topics });
    tp.addEventListener('input', function () { f.topics = tp.value; });
    body.appendChild(tp);

    body.appendChild(h('label', { class: 'ghu-lbl', text: t('setVisibility') }));
    var pv = h('input', { class: 'ghu-cb', type: 'checkbox', checked: f.private });
    pv.addEventListener('change', function () { f.private = pv.checked; render(); });
    var ai = h('input', { class: 'ghu-cb', type: 'checkbox', checked: f.hasIssues });
    ai.addEventListener('change', function () { f.hasIssues = ai.checked; });
    var aw = h('input', { class: 'ghu-cb', type: 'checkbox', checked: f.hasWiki });
    aw.addEventListener('change', function () { f.hasWiki = aw.checked; });
    var aa = h('input', { class: 'ghu-cb', type: 'checkbox', checked: f.archived });
    aa.addEventListener('change', function () { f.archived = aa.checked; });
    body.appendChild(h('div', { style: 'display:flex;flex-direction:column;gap:8px;' }, [
      h('label', { class: 'ghu-switch' }, [pv, f.private ? t('setPrivate') : t('setPublic')]),
      h('label', { class: 'ghu-switch' }, [ai, t('setIssues')]),
      h('label', { class: 'ghu-switch' }, [aw, t('setWiki')]),
      h('label', { class: 'ghu-switch' }, [aa, t('setArchive')])
    ]));

    body.appendChild(h('h4', { style: 'margin:18px 0 6px;font-size:12px;color:var(--dsw-alias-state-error-primary,#c00);', text: t('setDanger') }));
    var dc = h('input', { class: 'ghu-input', placeholder: t('setDeletePh', f.fullName) });
    dc.addEventListener('input', function () { S.delConfirm = dc.value; });
    var del = h('button', { class: 'ghu-btn ghu-danger', text: t('setDelete'), onclick: function () {
      if (S.delConfirm !== f.fullName) { S.error = t('setDeleteNeedName'); render(); return; }
      guard(api('delete-repo', { owner: S.repo.owner, repo: S.repo.name }).then(function () {
        S.repo = null; keep(LS_REPO, null); S.repos = []; S.edit = null;
        toast(t('setDeleted'));
        S.tab = 'repo'; render(); loadRepos();
      }));
    } });
    body.appendChild(h('div', { class: 'ghu-row', style: 'margin-top:6px;' }, [dc, del]));

    var save = h('button', { class: 'ghu-btn ghu-primary', text: t('setSave'), onclick: function () {
      save.disabled = true; save.textContent = t('setSaving');
      var patch = {
        name: f.name, description: f.description, homepage: f.homepage,
        private: f.private, archived: f.archived, hasIssues: f.hasIssues, hasWiki: f.hasWiki
      };
      guard(api('update-repo', { owner: S.repo.owner, repo: S.repo.name, patch: patch }).then(function (d) {
        var names = f.topics.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        return api('set-topics', { owner: S.repo.owner, repo: S.repo.name, names: names }).then(function () { return d; });
      }).then(function (d) {
        S.repo = {
          owner: d.repo.owner, name: d.repo.name, fullName: d.repo.fullName,
          private: d.repo.private, url: d.repo.url, defaultBranch: d.repo.defaultBranch
        };
        keep(LS_REPO, S.repo);
        S.edit = null;
        render();
        toast(t('setSaved'));
        // 改名或改可见性之后列表里的旧条目就过期了，顺手刷新
        loadRepos();
      }));
    } });
    foot.appendChild(save);
    foot.appendChild(h('button', { class: 'ghu-btn', text: t('setReload'), onclick: function () { S.edit = null; render(); } }));
  }

  /**
   * 挂载入口：由槽位组件调用，把容器交进来。
   * 重复调用只更新挂载点，不会建立第二份 UI（mount() 是幂等的）。
   */
  function start(host) {
    if (host) MOUNT_HOST = host;
    if (!MOUNT_HOST) return;
    if (root) { if (root.parentNode !== MOUNT_HOST) MOUNT_HOST.appendChild(root); return; }
    mount();
  }
  // 不自动执行：交给 ModuleLoader 工件里的槽位注册调用。
  window.__DSH_GHU_MOUNT__ = start;
})();

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
          el.setAttribute('data-plugin', 'dsh-github-upload');
          el.textContent = CSS;
          document.head.appendChild(el);
          return function () { if (el.parentNode) el.parentNode.removeChild(el); };
        });

        ctx.slots.inject('shell.overlay', function () {
          return ctx.slots.register({ name: 'shell.overlay', id: 'dsh-github-upload', order: 20 }, GithubUpload);
        });
      },
    };
  },
});
