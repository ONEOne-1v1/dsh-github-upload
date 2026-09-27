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
| **上传** | **项目目录由聊天本身识别** —— 打开这一页时，这次对话正在做的文件夹已经填好了（不需要先去选文件夹）→ 扫描（内置忽略规则 + `.gitignore`）→ **一键「本聊天改动的文件」勾选这次对话写入 / 修改过的文件**（这些文件在树上还带标记）→ 提交信息 / 目标分支 → 上传并显示进度与日志。「选择文件夹」（系统对话框或内置浏览器）与手填路径仍然可用。 |

> **「勾选」到底是什么语义？** 勾选的文件在 GitHub 上**新增或覆盖**；未勾选的文件**在远程保持原样**。只有打开「完全同步」（删除远程未选中的文件）才会真的删远程文件。所以「就是想推整个项目」时点**全选**才是对的 —— 按聊天勾选适合做一次聚焦的提交，或者省掉大仓库里没动过的文件。
| **仓库信息** | 改名、描述、主页、话题标签、公开↔私密切换、Issues/Wiki 开关、归档、删除仓库 |

---

## 2. 目录结构

```
dsh-github-upload/
├─ index.js          包入口：再导出 src/host.js
├─ client.js         自动生成的 ModuleLoader 工件（UI + CSS），注册到 shell.overlay
├─ src/
│  ├─ host.js        宿主半边：API 路由、GitHub 调用、文件扫描、上传任务（真正的 ES 模块）
│  ├─ client.js      浏览器端 UI（右下角按钮 + 抽屉面板），含双语文案表
│  └─ client.css     面板样式（全部走 DSH 主题变量，自动适配明暗色）
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
| `src/client.js`、`src/client.css` | `npm run build` 后刷新页面（**不用重启**） |
| `src/host.js`、`index.js`、`cordis.patch.yml`、`package.json` | 重新 `install_bundle`，再重启 Harness 以装载新的模块代 |

profile 是把本包装成**软链**接进 `node_modules` 的（`link:D:/dsh plugins/dsh-github-upload`），所以磁盘上的文件就是真正在跑的文件。

### 为什么 UI 变成了生成产物

早期版本用 HTTP 路由下发界面、再 tap `index.html` 注入 `<script>`。现在不需要了：包里声明 `dsh.client`，页面自己的模块加载器会加载 `client.js`，它把组件注册到 `shell.overlay` 槽位。`src/client.js` 仍然是纯浏览器脚本（不 import 任何东西），只是由构建脚本包一层 —— 界面代码没变，交付方式换成了受支持的那种。

### 为什么前端要放磁盘上

最初版本把前端源码以内联字符串塞进宿主源码，导致每改一行前端都要重新 define 一次 40KB 的载荷。
改成运行时读盘后，前端迭代只要刷新页面。

### 测试

```bash
npm run check     # 客户端语法 → 构建（含宿主语法预检）→ 渲染冒烟测试 → cleanDir 单元测试
npm test          # 只跑两个测试文件
```

`scripts/test-render.mjs` 是一个**无头冒烟测试**：用一个极简 DOM stub 把 `src/client.js` 真的挂载起来，
然后点入口按钮、切到上传页、点扫描，断言请求确实发出去了。它存在的原因是：到目前为止最糟的那个 bug
是 `render()` 抛异常 —— 后端完全正常、`curl` 根本测不出来，但界面就是不再响应。

测试自带对照实验：

```bash
NEGATIVE_CONTROL=drop-null-guard node scripts/test-render.mjs   # 必须失败
```

它会把那个 bug 原样注回去，必须复现出用户看到的症状，以此证明这个测试还抓得住它。

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
3. **绑定成功但仓库列表为空** → 看面板里的「来源统计」和排查指引；优先检查令牌权限（见第 7 节），或直接用「直接指定仓库」填 `owner/repo`。
4. **点「选择文件夹」打开的是内置浏览器，而不是系统对话框** → 这是有意的。宿主的原生选择器在系统对话框弹不出来时会一直挂着（缺 koffi、或远程部署），以前会把按钮永久卡在「等待系统对话框」。内置浏览器只用宿主的 `fs` 列目录，永远可用；想试系统对话框可以用它底部的「试试系统对话框」按钮（带 25 秒超时）。「账号 → 本机环境」里能看到当前是哪一种后端。
5. **点「扫描」没反应 / 上传页像没画完** → 这是 0.7.1 修掉的前端崩溃：`render()` 在发请求之前抛异常。万一再出现，跑 `npm run check` —— 无头冒烟测试会断言「点扫描必须真的发出请求」。
6. **上传报 403 / 404** → 令牌缺少 `Contents: write`，或目标仓库名 / owner 写错。
7. **报 `Git Repository is empty`** → 目标仓库还没有任何 commit。0.5.0 起会自动处理；若仍然出现，说明 Contents API 垫底那一步失败了，看任务日志里的对应行。
8. **默认填的项目目录带引号（扫描后又被清掉）** → 这**是我们自己的 bug**（0.7.2 修），不是粘贴问题。`keep()` 写 localStorage 用的是 `JSON.stringify`，存储里的文本本身就带引号；而 `boot()` 以前直接读原文，引号就成了路径的一部分 —— 也正是更早那句 `目录不存在："D:\..."` 的来源。现在所有偏好都经 `readString()`（解析 JSON、兼容历史二次编码）读取，并在启动时回写自愈。路径输入框仍然容忍粘贴进来的带引号路径，因为那在现实里确实会发生。
9. **切换语言后看起来只切了一半** → 切换语言会故意清掉上一轮的扫描结果和任务状态（忽略原因、旧报错是宿主已经下发的上一轮语言文案）。之前扫过的话重新扫一次即可。
