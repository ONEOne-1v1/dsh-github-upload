# dsh-github-upload

[English](README.md) | 中文

给 DeepSeek Harness 用的**动态 Cordis 插件**：在界面右下角加一个按钮，把本地项目一键推送到 GitHub —— 绑定账号、选/建仓库、挑要上传的文件、改仓库公开或私密，全程点鼠标，**不消耗模型 Token**。

界面中英双语（面板右上角可切换）。[English README](README.md)

- 插件 ID：`ghpush-1`
- 前端资源目录：`src/`（宿主运行时按需读取）
- 不需要本机装 `git`，也不会在你的项目里生成 `.git` 目录

---

## 1. 功能

| 面板标签 | 能做什么 |
| --- | --- |
| **账号** | 粘贴 GitHub Personal Access Token → 校验并绑定；显示令牌类型 / 权限 / 过期时间，并在令牌看不到仓库时给出可执行的提示；可选「记住令牌」；一键环境自检 |
| **仓库** | 列出账号可见仓库（自有 + 协作 + 组织成员 + 所属组织 + 公开兜底），搜索、选择；新建仓库并选择公开/私有；**新建 / 改名 / 改可见性后列表自动刷新**；列表不可用时可直接指定 `owner/repo` |
| **上传** | **项目目录由聊天本身识别** —— 打开这一页时，这次对话正在做的文件夹已经填好了（不需要先去选文件夹）→ 扫描（内置忽略规则 + `.gitignore`）→ **一键「未上传的改动」勾选所有与远程分支不一致的文件**（跨多轮对话累计，按内容比对；本会话改动的文件在树上还带标记）→ 提交信息 / 目标分支 → 上传并显示进度与日志。「选择文件夹」（内置浏览器 + 系统对话框两个入口）与手填路径仍然可用。 |

> **「勾选」到底是什么语义？** 勾选的文件在 GitHub 上**新增或覆盖**；未勾选的文件**在远程保持原样**。只有打开「完全同步」（删除远程未选中的文件）才会真的删远程文件。所以「就是想推整个项目」时点**全选**才是对的 —— 按聊天勾选适合做一次聚焦的提交，或者省掉大仓库里没动过的文件。
| **仓库信息** | 改名、描述、主页、话题标签、公开↔私密切换、Issues/Wiki 开关、归档、删除仓库 |

> **面板是浮层，不是贴边抽屉。** 桌面端的窗口关闭 / 退出键就在窗口右上角，所以面板四边都留空隙
> （顶部默认 52px，见 `src/client.css` 里的 `--ghu-top`）：关闭键在面板**右下角**，头部最左侧是「收起」键，
> 点面板以外或按 Esc 也会收起。窗口右上角永远不会被面板覆盖。
>
> **右下角入口按钮是一枚 46×46 的正圆，表面走 DSH 主题、里面是 GitHub logo（30px）+ 一枚状态点。**
> 没有文字（说明只在悬停提示 / 无障碍名里）。可以拖到界面最边上（只允许停在下半屏，避开标题栏），
> 并且**尺寸永远不变**：hover 不展开、面板打开也不展开。
> 这么设计是因为：按钮能贴到边上，一旦 hover 会变宽，贴边时就会「超出视口 → 被夹回 → 指针脱离 → 收起」
> 来回抖动，既拖不动也点不准。
>
> 注意它**不是** GitHub 官网那种深色丸子：深色是 GitHub 的品牌语言，贴在 DSH 的浅色界面上会像一张外来贴纸。
> 所以表面用 `--dsw-alias-bg-layer-2` + elevation 阴影 + 1px 细描边，图标用 `--dsw-alias-label-primary`，
> hover 用 `--dsw-alias-interactive-bg-hover-solid` —— 它是「DSH 里的一枚浮层按钮」，恰好印着 GitHub 的标记。
>
> ⚠️ **按钮和状态点都必须显式写 `corner-shape:round`。** DSH 主题里有一条全局规则
> （`dsh-client-ui-theme` → `corner-shape.css`）把所有元素的圆角改成「超椭圆（squircle）」：
> 对卡片是好设计，但会把 `border-radius:50%` 的正圆压成**圆角方块**。
> 只有支持该属性的浏览器（Chrome/Edge 139+）才会这样，删掉这两行就会「看起来不是圆的」。

---

## 2. 目录结构

```
dsh-github-upload/
├─ index.js          包入口：再导出 src/host.js
├─ client.js         自动生成的 ModuleLoader 工件（UI + CSS），注册到 shell.overlay
├─ src/
│  ├─ host.js        宿主半边：API 路由、GitHub 调用、文件扫描、上传任务（真正的 ES 模块）
│  ├─ client.js      浏览器端 UI（右下角按钮 + 浮层面板），含双语文案表
│  └─ client.css     面板样式（全部走 DSH 主题变量，自动适配明暗色；`--ghu-top` 控制顶部让位高度）
├─ cordis.patch.yml  bundle 补丁：插入插件行
├─ locale/           插件管理器用的展示信息（中英各一份）
├─ icon.svg          bundle 图标
├─ build/
│  └─ bundle.mjs     把 src/client.js + src/client.css 拼成 client.js
├─ README.md         English README
├─ README.zh.md      本文件（中文）
├─ README.i18n.yaml  双语配对一致性记录（blob 哈希）
├─ CHANGELOG.md      更新记录（中文）
└─ package.json      bundle 清单（dsh.bundle.patch + dsh.client）
```

---

## 3. 双语实现

两份文案表都是最简单的定位表，每条 `[中文, English]`：

| 位置 | 在哪 | 覆盖范围 |
| --- | --- | --- |
| 浏览器 | `src/client.js` → `var M = { ... }` | 面板里所有标签、按钮、提示、toast |
| 宿主 | `src/host.js` → `const M = { ... }` | 报错、扫描忽略原因、上传任务日志、仓库来源统计、令牌权限提示 |

`{1}` / `{2}` 是位置占位符（用 `split`/`join` 替换，不走正则，因此没有转义坑）。

前端**每次请求都带 `lang`**（`zh` / `en`），宿主按它回话。切换开关在面板头部，选择存在 `localStorage`（`dsh.ghu.lang`），首次按浏览器语言猜。

GitHub 自己的报错原样透传 —— 它们本来就是英文。

---

## 4. 开发流程

### 安装

```bash
npm run build          # 从 src/ 重新生成 client.js（改过 src/ 就必须跑一次）
```

然后把**本目录的绝对路径**作为 bundle 安装进当前 profile（对所有会话生效，且重启后仍在）：

```
plugin_manager  action: install_bundle  target: <本目录的绝对路径>
```

判断是否生效要看返回结果里的 `application` 和 `warnings` 字段，而不是服务端日志。

### 改动生效时机

| 改了什么 | 什么时候生效 |
| --- | --- |
| `src/client.js`、`src/client.css` | `npm run build`，然后**重启 DSH**（见下面的坑；只刷新页面不一定够） |
| `src/host.js`、`index.js`、`cordis.patch.yml`、`package.json` | 重新 `install_bundle`，再重启 Harness 以装载新的模块代 |

> **坑：重建客户端后只刷新页面，可能仍然跑旧界面。**
> DSH 给客户端模块发的响应头是 `cache-control: public, max-age=31536000, immutable`，
> 模块 URL 形如 `/plugins/??<包名>/client.js&rev=<内容哈希>`，而这个 `rev` **只有 HMR 重算时才会变**
> （`dsh-client-modules` 里的 `rebuilt(id)`）。HMR 没重算 → URL 不变 → 浏览器直接用那份
> 「immutable」的旧缓存，刷新多少次都是旧包。
> **所以要重启 DSH**（服务端重新组合，交出新的 `rev`）。
> 想确认页面到底跑的是哪一版：打开面板 →「账号」→「本机环境」→「界面版本」，形如 `1.0.1+252bba5a`，
> 由 `build/bundle.mjs` 按素材指纹生成，构建时会打印出来。
>
> **排查插件没挂上**：设 `DSH_GHU_DIAG=1` 再启动 DSH，宿主会在模块被加载时以及 `apply()` 的每一步
> 各写一行记录到 `DSH_GHU_DIAG_FILE`（未指定则用系统临时目录下的 `dsh-github-upload-diag.jsonl`），
> 并同时打印到控制台。默认关闭，关闭时不产生任何文件。它能一刀切开「新代码没被加载」和
> 「加载了但某一步静默失败」这两种情况。

profile 是把本包装成**软链**接进 `node_modules` 的（`link:/path/to/dsh-github-upload`，在 Windows 上落成 `node_modules/@local/` 下的 junction），所以磁盘上的文件就是真正在跑的文件，改完不用重装。

> **注意**：profile 里的依赖也可能是 GitHub 写法（`github:<owner>/<repo>`）。那种装法是**快照副本**而不是软链，本地改了也不生效 —— 「明明修好了却还是老样子」通常就是这么来的（面板挡住窗口退出键那次就是）。用 `plugin_manager install_bundle <本目录绝对路径>` 可以把它换回软链形式。

### 为什么 UI 变成了生成产物

早期版本用 HTTP 路由下发界面、再 tap `index.html` 注入 `<script>`。现在不需要了：包里声明 `dsh.client`，页面自己的模块加载器会加载 `client.js`，它把组件注册到 `shell.overlay` 槽位。`src/client.js` 仍然是纯浏览器脚本（不 import 任何东西），只是由构建脚本包一层 —— 界面代码没变，交付方式换成了受支持的那种。

> **装载约定（改 `build/bundle.mjs` 前必读）**：`client.js` 的 `factory` 只负责取 `react`
> 并返回插件对象；**界面脚本被包成 `mountUi()`，只在 `apply()` 里执行一次**，不能放回 factory 体。
> 原因：`src/client.js` 是自执行 IIFE，开头有「已初始化就直接 return」的重入保护。
> 若它在 factory 阶段先跑过一次，`apply()` 里再跑就只会命中那句 return，
> 后面的槽位注册与挂载入口全部被跳过 —— 插件显示 `active`，但界面永远不出现，且不报错。
> `scripts/test-artifact.mjs` 专门守这一点（加载生成工件、按真实约定走完装载→apply→挂载）。

### 为什么前端要放磁盘上

最初版本把前端源码以内联字符串塞进宿主源码，导致每改一行前端都要重新 define 一次 40KB 的载荷。
改成运行时读盘后，前端迭代只要刷新页面。

### 测试

```bash
npm run check     # 客户端语法 → 构建（含宿主语法预检）→ 渲染冒烟测试 → cleanDir 单元测试 → 宿主纯函数单元测试
npm test          # 只跑三个测试文件
```

`scripts/test-render.mjs` 是一个**无头冒烟测试**：用一个极简 DOM stub 把 `src/client.js` 真的挂载起来，
然后点入口按钮、切到上传页、点扫描，断言请求确实发出去了。它存在的原因是：到目前为止最糟的那个 bug
是 `render()` 抛异常 —— 后端完全正常、`curl` 根本测不出来，但界面就是不再响应。
它还守着桌面端布局：面板右上角不许有可交互元素、面板几何必须留出顶部空隙、入口按钮拖不进标题栏。

`scripts/test-internals.mjs` 把宿主最容易悄悄写错的那几个纯函数从 `src/host.js` 里抽出来直接断言：
手写 base64 编码器（分块边界）、ref / 内容路径编码、`.gitignore` 匹配、项目根推断。

每个回归用例都自带对照实验，每条都必须失败：

```bash
NEGATIVE_CONTROL=drop-null-guard       node scripts/test-render.mjs   # render() 崩溃
NEGATIVE_CONTROL=raw-localstorage-read node scripts/test-render.mjs   # 默认目录带引号
NEGATIVE_CONTROL=close-in-header       node scripts/test-render.mjs   # 控制键被挪回头部
NEGATIVE_CONTROL=docked-panel          node scripts/test-render.mjs   # 面板又贴到窗口右上角
NEGATIVE_CONTROL=fab-unclamped         node scripts/test-render.mjs   # 入口按钮又能停到标题栏
```

---

## 5. 宿主 API

前端所有请求都走 `POST /dsh-gh/api`，body 为 `{ op, lang, ...args }`，返回 `{ ok, data }` 或 `{ ok: false, error }`。

| op | 参数 | 说明 |
| --- | --- | --- |
| `hello` | — | 默认目录、工作区根、node 路径、前端资源目录、文件夹选择后端类型 |
| `ping` | — | 请求 GitHub `/zen`，验证 node 与网络连通性（不需要令牌） |
| `auth-status` | — | 当前绑定状态、用户、令牌类型与提示 |
| `auth-set` | `token` | 校验令牌并绑定 |
| `auth-clear` | — | 解除绑定 |
| `list-repos` | `query` | 汇总多来源仓库列表 + 来源统计 + 令牌提示 |
| `create-repo` | `name, private, description` | 新建仓库（`auto_init: false`） |
| `get-repo` | `owner, repo` | 单个仓库详情（含 topics） |
| `update-repo` | `owner, repo, patch` | 改名/描述/主页/可见性/归档等 |
| `set-topics` | `owner, repo, names` | 覆盖话题标签 |
| `list-branches` | `owner, repo` | 分支列表 |
| `delete-repo` | `owner, repo` | 删除仓库（需 `delete_repo` scope） |
| `scan` | `dir, useGitignore` | 递归扫描目录，返回文件清单、忽略原因、被整棵跳过的目录 |
| `session-files` | `dir?` | 重放会话里的 `tool/call`，识别本聊天写入 / 修改 / 读取过的文件。**不传 `dir`** 时由宿主挑「活着的会话」并用改动文件的最深公共目录推断项目根（返回 `projectRoot` 与 `rootSource`） |
| `pending-files` | `owner, repo, dir, branch?, deep?` | 列出**内容与远程分支不一致**的文件（「未上传的改动」比对）。只读一次远程 tree，再按「大小 / git blob sha」逐文件判定；`deep` 打开时对同大小的文件也逐字节比对 |
| `pick-folder` | — | 打开文件夹选择：`native` 后端弹系统对话框并返回绝对路径；`browse`/无后端则返回 `mode` 让前端自己画浏览器 |
| `list-dirs` | `path` | 列出一层子目录（面包屑、可跳转的根、是否支持新建文件夹） |
| `mkdir-dir` | `parent, name` | 新建文件夹（仅 `browse` 后端支持；系统对话框自带「新建文件夹」） |
| `upload-start` | `owner, repo, dir, files, message, branch, prune` | 启动异步上传任务，返回 `jobId` |
| `job-status` | `jobId` | 轮询任务状态、进度、日志、结果 |

上传走 GitHub **Git Data API**：读分支 head → 逐个建 blob → 建 tree（带 `base_tree`）→ 建 commit → 更新/新建 ref。

---

## 6. 实现要点（踩过的坑）

| 问题 | 处理 |
| --- | --- |
| 插件沙箱里没有 `fetch` / `require` / 定时器 | 用 `subprocess` 拉起短命 node 子进程承载 HTTPS；用 `inject: ['timer']` 拿超时 |
| 二进制文件不能直接 `btoa` | 手写字节级 base64 编码器；文本文件走 `encoding: "utf-8"` 免受 33% 膨胀 |
| 分支名含 `/` 时 ref 路径不能整体 URL 编码 | 按 `/` 拆段分别编码再拼回，否则会误判为「分支不存在」并生成游离提交 |
| 绑定成功却看不到仓库 | `list-repos` 汇总账号可见仓库 + 所属组织仓库 + 公开兜底，并回传每个来源的命中数；列表为空时给出按可能性排序的排查指引，另提供手动指定 `owner/repo` |
| `shell.overlay` 整层是 click-through 的 | 容器与根节点主动**退出**指针事件（`pointer-events: none`），只有按钮、面板、toast、弹层再收回来；否则按钮画得出来却点不动 |
| 宿主没有 `AbortController`，但原生选择器要求 `AbortSignal` | 实现只用到 `aborted` / `addEventListener` / `removeEventListener`，于是给它一个鸭子类型 signal（本插件从不主动中止：关掉对话框就是用户的选择） |
| 被忽略的目录会被悄悄漏掉 | 分两档：HARD（依赖/缓存）整棵跳过但报出目录名；SOFT（构建产物）照常列出、只是默认不勾 |
| `localStorage` 写的是 `JSON.stringify`，读时却直读原文 | 所有偏好统一走 `readString()`（解析 JSON、兼容历史二次编码）并在启动时回写自愈 —— 以前那层引号会变成路径的一部分 |
| 前端一崩就整个标签页失灵 | `npm run check` 会跑一个无头冒烟测试：真的挂载界面，并断言点「扫描」确实发出了请求 |

---

## 7. 令牌怎么给权限

| 令牌类型 | 需要什么 |
| --- | --- |
| Classic | 勾选 `repo`（否则看不到私有仓库，甚至看不到仓库列表）；删仓库需要 `delete_repo`；列组织需要 `read:org` |
| Fine-grained | 选择 **All repositories**，授予 **Contents: Read and write**、**Administration: Read and write**、**Metadata: Read** |

---

## 8. 已知限制

- 所有文件以 `100644` 推送，**可执行位不保留**（GitHub 的 blob API 拿不到本机 mode）。
- **往空仓库里的第一次上传会产生两个 commit**。没有任何 commit 的仓库上，GitHub 的 Git Data API 全线拒绝（`409 Git Repository is empty`），所以插件先用被选中的最小文件走 Contents API 落一个提交，再把完整文件树写成第二个 commit。仓库里不会多出任何多余文件，只是历史上多一条记录 —— 仅限第一次推送。
- 单个文件超过 **25MB** 会被扫描标记为忽略（可手动勾选，但仍会被拒绝）。
- 忽略规则是 `.gitignore` 的简化实现（支持注释、`!` 取反、尾随 `/`、`*` / `**` / `?`），复杂 pattern 可能不准 —— 所以被忽略的文件在 UI 里仍可手动勾选。
- 忽略目录分两档：依赖/缓存目录（`node_modules`、`.git`、`.venv` 等）**整棵跳过**、文件不出现在列表里（但会在扫描结果里报出目录名）；构建产物目录（`dist`、`build`、`out`、`target` 等）只是**默认不勾选**，仍然可见可勾。
- 令牌写进**宿主凭据库**（`ctx.credentials`，引用名 `DSH_GITHUB_UPLOAD_TOKEN` → `~/.dsh/.credentials.yaml`），因此插件重启、DSH 重启后都会自动恢复；勾了「记住」时浏览器 `localStorage` 里也留一份。**不会发给模型**。
- 这是一个 **profile bundle**：用 `plugin_manager install_bundle` 装进当前 profile，对所有会话生效，**重启后依然在**（早先的动态包每次重启都要重新 define / run）。
- 「本聊天改动的文件」读的是会话日志里的 `tool/call` 记录，因此只识别 `write` / `edit` / `read` / `grep` / `glob` 这几个工具。只被 shell 命令改过的文件、以及子代理自己会话里改的文件，**不会**算进本次聊天。
- 上传是「先建 blob 再建 commit」，超大项目会产生较多 API 调用；GitHub API 有速率限制。

---

## 9. 排障

1. **看不到按钮** → 先刷新页面（客户端工件由页面模块加载器加载）。还看不到就在「设置 → 插件」里确认 `@local/dsh-github-upload` 是启用的；它不是官方包，属于本 profile 的本地 bundle。
2. **按钮看得见但点不动** → `shell.overlay` 整层是 click-through 的，条目必须自己收回指针事件。`src/client.css` 里的 `.ghu-slot-host` / `#dsh-ghu-root` / `#dsh-ghu-fab` 三行就是干这个的，别删。
3. **面板挡住窗口的关闭 / 退出键** → DSH 桌面端把窗口的关闭/最小化/退出按钮画在页面**之上**的右上角。两件事一起保证它不被挡：
   (a) 面板头部**只有标题**，语言开关和关闭键都在底部控制条（`.ghu-panelctl`，右下角右对齐）里 —— 别把它们挪回头部；
   (b) 面板本身是**浮层卡片**，四边留空隙（`top:var(--ghu-top)`，默认 52px，见 `#dsh-ghu-panel`），**不是**从窗口顶边铺到底的贴边抽屉 —— 别把它改回 `top:0;right:0;bottom:0`。
   收起面板：头部左侧「收起」键、右下角「关闭」、**Esc**、点面板以外、或再点一次右下角入口按钮。
   `npm run check` 里有四条针对性断言 + 三个对照实验（`NEGATIVE_CONTROL=docked-panel` / `fab-unclamped` / `close-in-header`）守着这两条。
4. **绑定成功但仓库列表为空** → 看面板里的「来源统计」和排查指引；优先检查令牌权限（见第 7 节），或直接用「直接指定仓库」填 `owner/repo`。
5. **「选择文件夹」打开的是内置浏览器，系统对话框在哪里？** → 默认打开**内置浏览器**（面包屑、盘符、过滤、新建目录，能一眼看清目录结构）；浏览器底部有一个**「系统对话框」**按钮（仅在宿主原生选择器可用时出现），点它会弹系统的「选择文件夹」对话框。两者互补：内置浏览器用 `uiWorkspace.listDirectory()` 列目录，在少数系统级受限位置（例如 `D:\` 根目录）会被拒绝；而系统对话框不需要列举，任何位置都能直接导航过去。若宿主没有原生选择器（例如远程部署），按钮不会出现，此时只用内置浏览器。
6. **点「扫描」没反应 / 上传页像没画完** → 这是 0.7.1 修掉的前端崩溃：`render()` 在发请求之前抛异常。万一再出现，跑 `npm run check` —— 无头冒烟测试会断言「点扫描必须真的发出请求」。
7. **上传报 403 / 404** → 令牌缺少 `Contents: write`，或目标仓库名 / owner 写错。
8. **报 `Git Repository is empty`** → 目标仓库还没有任何 commit。0.5.0 起会自动处理；若仍然出现，说明 Contents API 垫底那一步失败了，看任务日志里的对应行。
9. **默认填的项目目录带引号（扫描后又被清掉）** → 这**是我们自己的 bug**（0.7.2 修），不是粘贴问题。`keep()` 写 localStorage 用的是 `JSON.stringify`，存储里的文本本身就带引号；而 `boot()` 以前直接读原文，引号就成了路径的一部分 —— 也正是更早那句 `目录不存在："D:\..."` 的来源。现在所有偏好都经 `readString()`（解析 JSON、兼容历史二次编码）读取，并在启动时回写自愈。路径输入框仍然容忍粘贴进来的带引号路径，因为那在现实里确实会发生。
10. **切换语言后看起来只切了一半** → 切换语言会故意清掉上一轮的扫描结果和任务状态（忽略原因、旧报错是宿主已经下发的上一轮语言文案）。之前扫过的话重新扫一次即可。
