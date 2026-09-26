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
| **上传** | **在本机选项目文件夹**（「选择文件夹」：系统对话框或内置文件浏览器），也可手填路径 → 扫描（内置忽略规则 + `.gitignore`）→ 目录树勾选本次要上传的文件 → 提交信息 / 目标分支 / 可选「删除远程多余文件」→ 上传并显示进度与日志 |
| **仓库信息** | 改名、描述、主页、话题标签、公开↔私密切换、Issues/Wiki 开关、归档、删除仓库 |

---

## 2. 目录结构

```
dsh-github-upload/
├─ src/
│  ├─ host.js        宿主半边：HTTP 路由、GitHub API 调用、文件扫描、上传任务
│  ├─ client.js      浏览器端 UI（右下角按钮 + 抽屉面板），含双语文案表
│  └─ client.css     面板样式（全部走 DSH 主题变量，自动适配明暗色）
├─ build/
│  └─ bundle.mjs     构建：语法预检 + 生成 cordis_define 载荷
├─ dist/             构建产物（自动生成）
│  ├─ ghpush-package.json
│  └─ host.code.txt
├─ README.md         English README
├─ README.zh.md      本文件（中文）
├─ README.i18n.yaml  双语配对一致性记录（blob 哈希）
├─ CHANGELOG.md      更新记录（中文）
└─ package.json
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

### 改前端（不用重启插件）

`client.js` / `client.css` 是宿主在**每次 HTTP 请求时从磁盘读取**的，所以：

```bash
# 直接编辑 src/client.js 或 src/client.css，然后刷新浏览器页面即可
```

### 改宿主

宿主的源码是 `code.host`（一段普通 JS 函数体），居住在 Cordis 注册表里而不是磁盘上，所以改完需要重新激活：

```bash
npm run build         # = node build/bundle.mjs，做语法预检并生成 dist/ghpush-package.json
```

然后把 `dist/ghpush-package.json` 的内容交给：

1. `cordis_define`（`plugin.kind: "existing"`，`pluginId: "ghpush-1"`，`code.host` 填 `host.code.txt` 的内容）
2. `cordis_run`（`mode: "update"`，目标 `packageId` 用 define 返回的新 ID）

> 移动项目目录后必须重新构建：宿主里写死的 `ASSET_DIR` 会指向旧路径，构建脚本会提醒你。

### 为什么前端要放磁盘上

最初版本把前端源码以内联字符串塞进宿主源码，导致每改一行前端都要重新 define 一次 40KB 的载荷。
改成运行时读盘后，前端迭代只要刷新页面。

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
| 动态宿主沙箱里没有 `fetch` / `require` / 定时器 | 用 `subprocess` 拉起短命 node 子进程承载 HTTPS；用 `inject: ['timer']` 拿超时 |
| 二进制文件不能直接 `btoa` | 手写字节级 base64 编码器；文本文件走 `encoding: "utf-8"` 免受 33% 膨胀 |
| 分支名含 `/` 时 ref 路径不能整体 URL 编码 | 按 `/` 拆段分别编码再拼回，否则会误判为「分支不存在」并生成游离提交 |
| 绑定成功却看不到仓库 | `list-repos` 汇总账号可见仓库 + 所属组织仓库 + 公开兜底，并回传每个来源的命中数；列表为空时给出按可能性排序的排查指引，另提供手动指定 `owner/repo` |
| 本会话审批被禁用，客户端 Cordis Package 会被自动拒绝 | UI 完全走宿主：`webServer.register` 提供路由，`webServer.tapIndex` 注入入口脚本 |
| 宿主没有 `AbortController`，但原生选择器要求 `AbortSignal` | 实现只用到 `aborted` / `addEventListener` / `removeEventListener`，于是给它一个鸭子类型 signal（本插件从不主动中止：关掉对话框就是用户的选择） |
| 被忽略的目录会被悄悄漏掉 | 分两档：HARD（依赖/缓存）整棵跳过但报出目录名；SOFT（构建产物）照常列出、只是默认不勾 |
| 前端资源每次请求都从磁盘重读 | 改 UI 不用重新 define 插件；代价是 `code.host` 不再包含前端字节 |

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
- 动态插件是进程内的：**DSH 进程重启后需要重新 define / run**。
- 上传是「先建 blob 再建 commit」，超大项目会产生较多 API 调用；GitHub API 有速率限制。

---

## 9. 排障

1. **看不到按钮** → 刷新页面（入口脚本是页面加载时注入的）；确认 `http://127.0.0.1:<port>/dsh-gh/app.js` 能打开。
2. **按钮出现但面板报「无法读取前端资源」** → `src/host.js` 里的 `ASSET_DIR` 指向了旧路径，改对或重新 `npm run build`。
3. **绑定成功但仓库列表为空** → 看面板里的「来源统计」和排查指引；优先检查令牌权限（见第 7 节），或直接用「直接指定仓库」填 `owner/repo`。
4. **点「选择文件夹」没弹系统对话框** → 说明宿主的 `directoryPicker` 原生后端不可用（缺少 koffi，或部署在远程）。面板会自动切到内置文件浏览器，功能不受影响；「账号 → 本机环境」里能看到当前 `picker` 种类。
5. **上传报 403 / 404** → 令牌缺少 `Contents: write`，或目标仓库名 / owner 写错。
6. **报 `Git Repository is empty`** → 目标仓库还没有任何 commit。0.5.0 起会自动处理；若仍然出现，说明 Contents API 垫底那一步失败了，看任务日志里的对应行。
7. **切换语言后看起来只切了一半** → 切换语言会故意清掉上一轮的扫描结果和任务状态（忽略原因、旧报错是宿主已经下发的上一轮语言文案）。之前扫过的话重新扫一次即可。
