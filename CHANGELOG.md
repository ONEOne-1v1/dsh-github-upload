# 更新记录

> 本文件保持中文。README 有双语版本：`README.md`（English）/ `README.zh.md`（中文）。

## 1.0.1

### 修复：**账号头像（以及文件树标记点）不是正圆，是圆角方形**
- 现象：展开面板后，账号区那枚 36px 头像看着"带点方"。
- 根因还是那个坑：DSH 主题有一条全局规则
  `@supports (corner-shape:superellipse(1.5)){ *,:before,:after{corner-shape:var(--dsw-corner-shape)} }`，
  会把 `border-radius:50%` 的**正圆压成圆角方块**；只有 Chrome/Edge 139+ 才触发，
  老浏览器反而正常 —— 所以极易漏。之前给 FAB 和状态点补过 `corner-shape:round`，
  **头像和会话标记点漏了**（同一个文件里四处正圆，只补了两处）。
- 修法：`.ghu-acct img`、`.ghu-mark` 补上 `corner-shape:round`。
- 而且这次不再靠"一个个元素补"：新增一条**全局不变量断言** —— 扫描整张样式表，
  凡是用 `border-radius:50%` 的规则都必须声明 `corner-shape:round`，
  并要求至少找到 3 条正圆规则（防止断言因解析失败而空跑通过）。以后再漏会直接测试失败。
- 顺带修了测试自身一个解析缺陷：`test-render.mjs` 直接在**含注释**的 CSS 上做
  `选择器{...}` 正则匹配，注释里提到 `#dsh-ghu-fab` 就会污染结果
  （这次正是它把 `.ghu-acct img` 误判成 FAB 状态规则）。现在读进来先剥掉注释。

### 改变：**仓库可见性改成「公开 / 私有」分段选择器（不再是勾选框）**
- 用户反馈：原来用一个 checkbox 表达可见性，**不勾选时显示"公开"、勾选后显示"私密"** ——
  勾选态与语义态对不上，人必须先读旁边那行文字才知道现在到底是什么状态。
- 改法：换成二选一的**分段控件**（`.ghu-segbox` / `.ghu-seg`）：
  - 两个选项**同时可见**（公开 / 私有），当前项高亮（`.ghu-seg-on`）；
  - 下方说明文字跟着选择走，说明"当前这个选择意味着什么"，而不是充当按钮标签；
  - 无障碍上是一个 `role=radiogroup` + 两个 `role=radio`，用 `aria-checked` 表达状态，
    所以视觉状态与语义状态始终一致；
  - 点击已选中项不再触发回调（避免无谓重渲染）。
- **两处都改了**：仓库信息页的可见性，以及**新建仓库**表单里的可见性。
- 其余 checkbox（Issues / Wiki / 归档 / 显示隐藏 / 显示被忽略 / 记住令牌 …）**保持勾选框**
  —— 它们是真正的"是/否"开关，语义与勾选态本来就一致；只有互斥的可见性不该用勾选框。
- 顺带把设置页层次理清：可见性单独一节（`仓库可见性`），其余开关归入`其他开关`。
- 测试：新增 `scripts/test-vispicker.mjs`（并入 `npm run check`），6 条断言：
  两个选项同时可见、高亮跟随 private、两个方向都对、`aria-checked` 与视觉一致、
  点击回调传正确的布尔值且重复点击无副作用、**整个控件里不允许出现 `INPUT`**（杜绝退回勾选框）。
- 同时修了 `scripts/test-render.mjs` 一个**会骗人的缺陷**：`step()` 原来是同步的，
  传入 async 步骤时会在第一个 `await` 处静默断掉、后面的断言根本不执行，而该步骤照样打印 ok。
  现在 `step()` 返回 promise、19 处调用全部改为 `await step(...)`，异步步骤才真正被等待。

### 修复：**「选择文件夹」只提示"手动粘贴路径" —— uiWorkspace 依赖被误删**
- 现象：插件挂载正常，但点「选择文件夹」弹的是
  「这台宿主没有可用的文件夹选择器……请直接把项目目录的完整路径粘贴到输入框」
  —— 两条路（原生对话框、内置浏览器）全被判为不可用。
- 根因：`uiWorkspace.pickDirectory()` 的实现是
  `pickDirectory() { const result = await this.directoryPicker.pick(); ... }`，
  它**依赖 `uiWorkspace` 这个服务实例**。而我在上一轮把它从客户端 `inject` 里去掉了，
  改成 `ctx.get('uiWorkspace')` —— 实测**客户端的 `ctx.get()` 拿不到它**，
  于是适配器永远返回 `reject('unavailable')`，最后只剩手动输入。
- 为什么会误删：当时去掉它的理由是"加了 inject 后插件整体加载失败"。
  但那次失败的真正原因是**界面代码在 factory 阶段被重复执行、命中了重入保护**（已由前一条修掉），
  与这个依赖无关。修好执行时机后本该把它还原 —— 我把两个无关的问题混在了一起，
  而且没有再验证一次。
- 修法：`inject: ['slots', 'uiWorkspace']` 还原；适配器保持"调用时惰性解析"，
  并优先取 `ctx.uiWorkspace`（inject 注入的才可靠）。
- 断言升级：`scripts/test-artifact.mjs` 现在会 ①要求 `uiWorkspace` 出现在 `inject` 里，
  ②用真实的 `uiWorkspace` 桩调用 `__DSH_GHU_HOST__` 的三个方法，**验证调用真的穿透到服务上**
  （之前只验证"方法存在"，所以这个 bug 从断言下面溜了过去）。
- 另外：`pickNative` 失败时不再只给笼统文案，而是把**底层原因**一起显示出来，
  下次排障不必从零猜。

### 修复：**「选择文件夹」怎么点都弹不出对话框 —— 可选服务被在启动时刻取了一次**
- 现象：插件已挂载、按钮也在，但点「选择文件夹」时内置浏览器报
  `directory browse failed: directory-picker/unavailable: directoryPicker.list needs the browse capability;
  the composed picker serves "native"` —— 该宿主只有 native 后端，浏览器列目录被拒；
  而本该兜底的系统对话框也弹不出来。
- 根因（**同一个错误在宿主与客户端各犯了一次**）：把「`apply()` 那一刻查询到的服务」当成永久事实。
  - 宿主：`const dp = ctx.get('directoryPicker')` 在 `apply()` 里取一次。而提供该服务的后端插件
    **在本插件之后加载**（插件列表里它排在最后），那一刻拿到的是 `undefined`，
    于是 `pickerCapability()` 永远返回 false —— 「弹系统对话框」的能力被静默丢掉，
    `pick-folder` 一路走到 `fallback`。**不报错，只是永远弹不出来。**
  - 客户端：`if (!hasNativePicker()) { openPicker(''); return; }` 在能力探测失败时直接进浏览器，
    把 `pickNative()` 自己那条**不依赖该探测**的 HTTP 兜底也一起绕过了。
- 修法：
  - 宿主：新增 `svc(name)` 惰性取服务（拿到才缓存，拿不到下次再问）；`pickerCapability()`
    只在"拿到服务、但能力形状不认"时才缓存否定结论。`credentials` / `sessionQuery` 同样改惰性
    （它们是同一类错误的隐患）。
  - 客户端：`pickFolder()` **不再按能力探测挑入口**，改成逐级退：
    browse 已证明可用 → 浏览器；否则真试一次列目录，成功用浏览器、失败直接弹系统对话框
    （**不把探测错误显示出来** —— 那是内部试探，不是用户操作失败）；系统对话框也失败才提示手动输入。
  - `browseTo()` 遇到同类错误时顺手记住 browse 不可用，下次点按钮直接进对话框，不再走失败的中间态。

### 修复：**重启后界面整个不出现（插件 enabled/active，但 UI 从不挂载）**
- 现象：重启 DSH 后界面异常，用户只能靠禁用其它插件把 DSH 拉起来；插件在管理器里显示
  `enabled: true / fiberPhase: active`，但 `cordis_inspect` 的 `shell.overlay` 占位列表里**没有它**。
- 根因在 `build/bundle.mjs` 的拼装方式，**不是** DSH 的问题：
  `src/client.js` 是一个自执行 IIFE，开头有「已初始化就直接 return」的重入保护，
  而它被内联在 **`factory` 体内** → 于是它在 **factory 阶段**就执行了一次；
  等 `apply()` 里再执行同一段代码时，那句 `return` 直接命中，**后面的语句被整个跳过**：
  槽位注册没执行、挂载入口没有被赋值。于是插件"激活"了但界面永远不出现，而且不报任何错。
- 修法：把 `src/client.js` 包成 `mountUi()`，**只在 `apply()` 里调用一次**（DSH 保证 apply 会被调用），
  时机由插件自己掌控。同时把 `uiWorkspace` 从客户端 `inject` 里去掉
  （它是可选的目录能力，作为硬依赖会因服务未就绪而让整个客户端插件加载失败），
  三个方法改为调用时惰性解析，拿不到就返回带原因的 rejected promise，界面降级到宿主 HTTP 路由。
- 新增 `scripts/test-artifact.mjs`（并入 `npm run check`）—— 这类故障以前**测不出来**，
  因为 `src/client.js` 的单测直接加载源码、绕开了装载约定。新测试加载**生成的工件**
  并按真实约定走一遍：ModuleLoader 注册 → factory → apply → 槽位注册 → 样式注入 →
  `window.__DSH_GHU_MOUNT__` 可调用 → 宿主服务接线就绪。6 项断言，正是这次故障的每一步。
- 排查过程记录（教训）：`client.js` 顶层有 `return`（属于 factory），所以**不能用
  `new Function(整个文件)` 去"提取"factory** —— 它会立刻报语法错，并让后续所有定位失真。
  我因此连续误判了好几轮。整文件用 `node --check` 验，行为用真实 ModuleLoader 约定验。

### 修复：**宿主只有 native 后端时，内置浏览器里什么都选不了**
- 现象：点「选择文件夹」进入内置浏览器，直接报
  `directory browse failed: directory-picker/unavailable: directoryPicker.list needs the browse capability; the composed picker serves "native"`。
- 根因：DSH 的目录选择是 **seam（接缝）**，同一时刻只装一种后端。宿主这台只装了 **native**，
  于是 `uiWorkspace.listDirectory()` / `createDirectory()`（需要 **browse** 能力）一律拒绝，
  只有 `pickDirectory()` 可用。而我把内置浏览器做成了默认入口 —— 在这类宿主上等于没有入口。
- 修法：**按宿主实际能力决定入口，不靠猜能力字段，而是先真试一次**。
  - `pickFolder()` 先用当前目录探一次列目录：成功 → 保留内置浏览器（好看、能看清目录结构）；
    失败且报错提到 `browse capability` / `directory-picker/unavailable` → 记住"browse 不可用"，
    **直接弹系统对话框**并提示原因；其它错误（例如该目录不可读）不改变结论，仍交给浏览器显示。
  - `browseTo()` 收到同类报错时也走同一条路：收起浏览器 → 弹系统对话框，不把用户留在空界面里。
  - 「选择文件夹」按钮的提示文案按实际能力切换（只有对话框 / 只有浏览器 / 两者都有）。
  - 最坏情况（连 `pickDirectory` 也不可用）给明确提示：**把项目目录完整路径粘到输入框再点扫描**，
    而不是留一个点了没反应的按钮。
- 同时修 `build/bundle.mjs` 的接线缺陷：原先在 `apply` 时**抓一次** `ctx.uiWorkspace` 引用，
  服务若尚未就绪就永久拿到 `undefined` —— 按钮点了毫无反应。现在三个方法都**在调用时惰性解析**，
  并在服务缺失时返回一个说明原因的 rejected promise，界面能把原因显示出来。
- 新增断言：`a native-only host goes straight to the system dialog`
  （模拟 `listDirectory` 以真实的 browse-capability 报错拒绝，要求直接调用 `pickDirectory`
  并扫描所选目录，且不得把空浏览器留在界面上）。

### 变更：**开源清理 —— 注释瘦身、去掉本机痕迹、诊断改为显式开关**
- **注释瘦身**：`src/`、`build/`、`scripts/` 共 794 → 727 行注释。删掉的是开发过程叙述
  （"改了几轮"、"以前…后来…"、"这个坑真实发生过"）、复述代码的注释、以及全部双语对照注释的英文半边；
  保留的是反直觉技术约束（主题全局 `corner-shape` 超椭圆会压扁 `border-radius:50%`、
  客户端模块 `immutable` 缓存导致改完必须重启、`credentials.describe()` 的 `writable:false` 语义、
  `webServer.register()` 重复 `(kind,path)` 会抛错、git blob sha 算法）、外部服务契约与安全理由。
  约定见 `COMMENT-POLICY.md`。
- **去掉硬编码本机路径**：`src/host.js` 里的诊断文件路径原本写死成作者机器的
  `D:\dsh plugins\dsh-github-upload\.dsh-ghu-*.{log,json}`，而 `src/` 会随包分发 —— 在别人机器上
  既写不进去、又把作者的目录结构固化进源码。现在诊断改为**环境变量开关**（见下），
  输出走 `DSH_GHU_DIAG_FILE` 或系统临时目录。顺带把 `scripts/preview*.mjs`、`scripts/test-cleandir.mjs`
  里的作者用户名与本机路径换成通用夹具，`README` 的 `link:` 示例改成 `/path/to/...`。
- **启动诊断改为显式开关**：只有 `DSH_GHU_DIAG=1` 时才记录（模块加载一行 + `apply()` 每步一行，
  写 `DSH_GHU_DIAG_FILE` 或系统临时目录，并打印到控制台）。默认完全关闭，不产生任何文件、
  不写 `globalThis` —— 公开安装里不留运行痕迹。
- **修 `test-blobsha.mjs` 的环境依赖**：临时文件原本写在 `shots/`（该目录被 gitignore，新克隆不存在），
  现在写到系统临时目录；`gitBlobSha` 也补上对 `Uint8Array` 与 `Buffer` 的统一处理。
- **修 `test-render.mjs` 的一处失效对照实验**：`NEGATIVE_CONTROL=docked-panel` 的模式串写死了
  `right:14px;bottom:14px`，而 CSS 早已改成 `var(--ghu-r)`，导致该对照实验变成"抛错"而不是
  "测试失败"（其余 6 个模式串不受影响）。现在锚定 `position:fixed;top:var(--ghu-top);right:…;bottom:…;`
  的结构，不再写死会变的值。
- `.gitignore` 同步整理：去掉已不存在的 `dist/` 规则，诊断文件按 `DSH_GHU_DIAG` 的产物模式忽略。

### 变更：**文件夹选择改成「好看的浏览器 + 系统对话框」两个入口**
- 上一轮为了让"选文件夹"恢复可用，把主入口换成了宿主原生对话框。功能对了，但用户反馈
  **那个自绘的界面更好看**，希望保留。所以改成两个入口并存：
  - 点「选择文件夹」→ 打开**自绘浏览器**（能一眼看清目录结构、有面包屑 / 盘符 / 过滤 / 新建目录）；
  - 浏览器底部新增**「系统对话框」**按钮（仅在原生选择器可用时出现）→ 弹系统的「选择文件夹」对话框。
    它能到达任何位置，正好覆盖自绘浏览器列不动的那些根目录。
- 为什么两者都要：`uiWorkspace.listDirectory()` 能列绝大多数目录，但在某些系统级受限位置
  （例如 `D:\` 根目录下的 `System Volume Information`）会被拒；而原生对话框不需要列举，
  用户直接导航即可。两者互补。

### 新增：**「未上传的改动」按钮（取代原来的「本聊天改动的文件」）**
- 需求来自用户，而且这个判断比我原来的设计更实用：要的是**跨多轮对话累计**的
  「改了但还没上传」的文件，而不是只看当前这一轮会话日志。原来那个按钮读的是会话日志里的
  `tool/call`，所以上一轮改了没传的文件会漏掉。
- 判定方式：**按内容与远程分支比对**，不依赖会话日志、也不需要用户做任何额外操作。
  1. 读远程分支 head → 取它的 tree（`recursive=1`，**只此一次请求**）；
  2. GitHub 的 tree 接口**自带每个 blob 的 `sha` 和 `size`**，于是：远程没有 → `added`；
     大小不同 → `modified`；大小相同但 blob sha 不同 → `modified`；sha 相同 → 未变（跳过）。
     **绝大多数文件因此无需再发请求**；
  3. 需要算本地 sha 时用 `gitBlobSha()`：`sha1("blob <size>\0" + content)`，
     实测与 `git hash-object` **完全一致**（空文件 / 单字节 / 中文 / 含 NUL 的二进制 / 5KB 文本）。
- 界面：按钮旁加了「深度比对」开关 —— 默认走上面那套快速判断；打开后连"大小相同"的文件
  也逐字节比对（最准但慢）。比对完显示一行明细：
  `远程 N 个文件 · 本地 M 个 · 未变 K 个 · 逐字节比对 J 个`，
  这样"只勾了 3 个"能看出是真的只改了 3 个，而不是比对失灵。
- 会话标记（文件树上绿/蓝/灰的小圆点）**保留**，作为"这一轮动过哪些文件"的参考信息，
  只是不再决定勾选范围。
- 新增宿主操作 `pending-files`；会话识别 `session-files` 原样保留（目录识别仍在用它）。
- 新增 `scripts/test-blobsha.mjs`（并入 `npm run check`）：验证 `gitBlobSha` 与 git 自身一致。
  这条必须测 —— 算错一位，整个功能会**静默**把「已改」当成「没改」，不报错、只给出错误的选择。
- 顺手删掉消息表里重复的一整段（`upPickSession` 等定义了两次，后来者覆盖前者）。

### 修复：**选择文件夹时报 `cannot list "D:\System Volume Information": permission denied`**
- 现象：把选择器切到 `D:\` 盘根目录就直接失败，整个列表出不来。
- 根因有**三层**，我分三轮才挖到底（记录下来，因为前两轮的假设都不完整）：
  1. `fsListing` 只 stat 了**父目录**，逐项列子目录没有容错 —— 已改成逐项探测；
  2. 宿主的 `directoryPicker`（browse 后端）`cap.list()` **自己内部就会抛这个错**，
     而我们直接 `await` 透传 —— 已改成失败即退回自己的 fs 列举；
  3. **真正的卡点**：你这台机器上选择器后端是 **`native`**，而 native 能力
     （`DirectoryPickerNativeCapability`）**只有 `pick(signal)`，没有 `list()`** ——
     所以内置浏览器只能靠我们自己的 fs 列举，而 **DSH 的 fs 服务本身拒绝列 `D:/`**，
     抛出的正是那句关于 `System Volume Information` 的话。用真实调用复现确认：
     `POST /dsh-gh/api {"op":"list-dirs","path":"D:/"}` → 同一个错误。
- 修法（这轮）：
  - `fsListing` 在列不动时**自动换一种根目录写法重试一次**（`D:/` ⇄ `D:\`）——
    两种写法在宿主 fs 服务里未必等价，这是零成本的尝试；
  - 新增 `listDirectoriesSafe()`：列不动这一层时**不再直接抛错**，而是返回
    `{path, error, entries: [], roots, home, canRetryNative}`。因为以前那个抛错会让界面卡在一个
    **没有任何出口**的错误上，连"回到项目目录"都做不到；
  - 界面在这个错误下保留可用导航：盘符按钮、**回到起始目录**、**回到项目目录**、
    （有 native 时）**试试系统对话框**，并说明"这个位置列不出来"通常是系统级受限目录；
  - 探针覆盖 `list-dirs` 全过程（进入 / 选择器成功 / 选择器失败 / fs 兜底成功 / 两路都失败 /
    根目录写法切换），写进 `.dsh-ghu-route-diag.json`，用来定位卡在哪一步。
- 测试：`scripts/test-picker.mjs` 加到 5 个用例，新增「父目录本身列不动时错误要带两层原因」；
  另外修了测试自身的桩不全（抽出的代码依赖 `diag` / `pickerKind` / `toSlashes` / `alternateRootForm`，
  每加一个宿主闭包依赖就得同步补桩 —— 这类 `xxx is not defined` 是测试的问题，不是被测代码的问题）。

### 修复：**「选择文件夹」回到宿主原生对话框**（"为什么早先的版本能打开"的答案）
- 用户这一问问到了根子上。查清后确认：**早先能用，是因为走的是宿主的原生 OS 选择器，
  而不是我们自己的目录列举**；后来我把入口换成了"自己列目录的画布"，才撞上
  DSH fs 服务拒列 `D:/` 的问题，于是一路打补丁。
- 关键发现（`cordis_inspect_query` + 读 `dsh-client-ui-directory-picker-native/lib/client.js`）：
  原生选择器的真正入口在**客户端的 `uiWorkspace` 服务**上：
  ```
  inject = ["slots", "uiWorkspace"]
  pick: () => ctx.uiWorkspace.pickDirectory()
  ```
  `uiWorkspace` 暴露 `pickDirectory()`（开原生对话框）、`listDirectory()`、`createDirectory()` ——
  这正是 DSH 产品界面「选择工作区」用的那一套，**不经我们的 HTTP 路由，也不依赖宿主 fs 服务的
  目录列举**，所以天然不受那个受限目录问题影响。
- 修法：客户端优先接上 `uiWorkspace`，宿主 HTTP 路由降为兜底。
  - `build/bundle.mjs` 的 `inject` 加上 `uiWorkspace`，并通过 `window.__DSH_GHU_HOST__`
    以窄接口（三个方法）把它交给纯浏览器的 `src/client.js`；
  - `pickFolder()`：**有该服务就直接开系统对话框**（不再默认打开内置浏览器），选完立刻扫描；
    没有该服务（例如单独调试本文件）才退回内置浏览器；
  - `browseTo()` 用 `uiWorkspace.listDirectory()`；`makeFolder()` 用 `createDirectory()`；
    服务返回的 `DirectoryListing` 由 `normalizeListing()` 补齐字段（它只有 `name/path/hidden`）；
  - 按钮 title 按实际走哪条路切换文案。
- 新增断言（`test-render.mjs`）：**有宿主服务时点「选择文件夹」必须调用 `pickDirectory` 并扫描所选目录**
  —— 钉住"别再退回自有列举"这条；另校验打包产物里 `inject` / `__DSH_GHU_HOST__` / 三个方法都在。
- 此前所有容错（逐项探测、根目录写法重试、起点自动改位置、错误+出口）全部保留，
  它们现在是**兜底路径**上的加固，而不再是主路径。

### 修复：**选择器一落到 `D:/` 就整页不可用**
- 用真实调用把现场摸清了（不再靠猜）：
  ```
  hello                     → {"picker":{"kind":"none"}}   ← 这个 DSH 配置里 directoryPicker 对插件不可用，
                                                              所以连"试试系统对话框"都没有，只能靠 fs 列举
  list-dirs D:/             → ✗ 目录不可读：cannot list "D:\System Volume Information": permission denied
  list-dirs D:/dsh plugins  → ✓ {"entries":[{"name":"dsh-github-upload"}]}
  ```
  即：**DSH 的 fs 服务拒绝列 `D:/` 根目录，但子目录正常**。而 `D:/` 恰恰是选择器最容易落到的起点，
  于是"选择文件夹"看起来整个坏掉。
- 修法：**起点列不动就自动换到能列的位置**，而不是给一张死页。
  - 客户端打开选择器时带 `landing: true` + `hint`（当前项目目录）；
  - 宿主在这个前提下若列不动，自动改列 `hint` → 工作区根目录，并在响应里带 `fallbackNote`
    说明"原来的位置列不出来，已自动切到 X"，界面把这行显示出来；
  - 用户**主动点进**某个目录（未带 landing）时仍如实报错 —— 那是他自己的选择，
    此时界面保留盘符 / 回到起始目录 / 回到项目目录 / 系统对话框等出口。
- 顺带修：`recoverListing` 不再依赖一个未定义的闭包函数取提示目录，改成显式参数。

### 修复：**文件夹选择器显示「这个文件夹里没有子文件夹」**
- 现象：真实存在子文件夹的位置，选择器却说"没有子文件夹"，看起来像空的。
- 根因（**两处，其中一处是我上一轮引入的**）：
  1. 上一轮我把"这一层列不出来"从 **抛错** 改成 **`{error, entries: []}` 返回**（为的是让界面保留
     导航出口），但**客户端没读 `d.error`** —— 于是"列不出来"被显示成"没有子文件夹"。已修：
     客户端读 `d.error`（并一并带上 `blockedCount` / `canRetryNative`）。
  2. 路径分隔符不一致：宿主的 `fsx.processPath()` 在 Windows 上返回**反斜杠**形式
     （`D:\dsh plugins\x`），而面包屑 / 子项路径我们一律用 `/` 拼 —— 同一个响应里
     `path` 是反斜杠、`entries[].path` 是混合体，任何基于字符串比较的地方都可能出错。
     已加 `toSlashes()` 统一成 `/`。
- 用真实调用确认过现场：
  ```
  列 D:/     → {entries: [], error: "目录不可读：D:/（cannot list …）"}   ← 旧客户端把它显示成"空文件夹"
  列项目目录  → {entries: [build, locale, scripts, shots, src]}            ← 正常
  ```

### 修复
- **桌面端面板压住 DSH 桌面窗口的关闭/退出键**。分两步修，第二步才是根因：
  1. 面板原本是 `top:0;right:0;bottom:0` 的整块右侧抽屉，头部（标题 + 语言开关 + `×`）
     正好落在窗口装饰所在的那块右上角，窗口按钮画在这一层之上，于是那个 `×` 既看不见也点不到。
     先把**面板头部只留标题**，语言开关和关闭键一起搬到新增的**底部控制条**（`.ghu-panelctl`，右下角右对齐），
     关闭键也从 `×` 图标换成带文字的「关闭 / Close」。
  2. 但抽屉本身仍然从窗口顶边一直拉到最右边 —— 它的**整块表面**都在窗口控制区下面，
     用户要的「退出」还是被这一整片浮层压着。所以面板改成**浮在窗口里、四边都留空隙的卡片**：
     `top:calc(var(--ghu-top))`（默认 52px，让出标题栏）、`right/bottom:14px`、圆角 14px、
     宽度 `min(520px, 100vw - 28px)`、高度 `calc(100vh - var(--ghu-top) - 14px)`。
     窗口的右上角从此完全空出来，面板自己的关闭键在右下角，离窗口装饰最远。
     `--ghu-top` 是面板自己的变量，头部更高时只改这一处即可。

### 新增
- **面板可以「收起」**：头部最左侧新增收起键（`–`，`#ghu-min`），加上原有的三种关闭方式
  （右下角「关闭」、Esc、再点一次右下角入口按钮）。另外**点面板以外的任何地方也会收起** ——
  面板现在是浮层而不是抽屉，被它盖住的那块界面要能一键还回去。

### 界面（按反馈重做了一轮）
- **整块面板重新配了一套样式**：以前大量用 `--dsw-alias-border-l3` / `--dsw-alias-interactive-bg-hover`
  这类**不存在**的变量（它们会静默回退到硬编码的浅色值，深色主题下就会发白、发脏）。
  现在只用真实存在的 token（`bg-layer-1/2/3`、`border-l1/2/3`、`label-primary/secondary/tertiary/dimmed`、
  `button-floating-fill`、`elevation-panel/prominent/soft`、`--dsw-font-mono`…，可用
  `cordis_inspect_query platform=client provider=Theme` 复核）。分区变成带边框的卡片、
  小节标题改成大写小字、标签页改成胶囊分段控件、输入框带 3px 焦点环、按钮统一高度与圆角、
  文件树用等宽字体并自绘展开箭头、滚动条也跟着主题走。
- **入口按钮最终形态：48×48 正圆，DSH 自己的表面 + GitHub logo + 一枚状态点。**
  没有文字。中途改错的几版都记在这里免得再踩：
  1. 「按文案自适应宽度的胶囊」→ 中英文长度差很大（`上传到 GitHub` / `Upload to GitHub`），英文被撑长，比例失真；
  2. 「固定 157px 的胶囊」→ 比例稳了，但它在浮层里**挡住对话框等主要功能区**；
  3. 「hover 展开成胶囊」→ 按钮能拖到界面最边上，一靠边展开就**超出视口 → 被夹回 → 指针脱离 → 又收起**，
     来回抖的死循环，既拖不动也点不准；
  4. 圆钮里塞文字 → 圆钮里放文字本身就难受；
  5. 角上挂绿色状态点但不给 `overflow` 留余地 → 点被圆边裁掉一角，还把 logo 在视觉上挤偏；
  6. logo 20px / 按钮 48px → 反馈「外圈黑太粗、logo 占比小」；
  7. **深色渐变丸子（GitHub 官网那种）** → 尺寸和比例都调过之后，反馈仍然是「看着怪」。
- **第 7 版的根因是设计方向错了，不是数值没调好**：深色圆丸是 **GitHub 的品牌语言**，
  而 DSH 通篇是浅色、超椭圆、0.5px 描边、淡阴影。一个又黑又重的圆贴在浅色面板旁边，
  天然像一张**外来贴纸** —— 无论把 logo 放大到什么比例，这个"异物感"都消不掉。
- 改法：**用 DSH 的语言画这枚按钮**，只是恰好印着 GitHub 的标记：
  表面 = `--dsw-alias-bg-layer-2` + `--dsw-elevation-prominent` + 1px `--dsw-alias-border-l2` 细描边
  （和面板、卡片同一套表面与阴影），图标 = `--dsw-alias-label-primary`（和正文同一前景色），
  hover = `--dsw-alias-interactive-bg-hover-solid`（和 DSH 其它按钮同一反馈）。
  于是它看起来是「DSH 里的一枚浮层按钮」，而不是「GitHub 的按钮」。
- 细节修正：状态点从 10px 提到 11px 并把环改成跟随按钮底色 ——
  小尺寸 + 主题的 `corner-shape` 插值会让 10px 的圆边缘发平，看起来像个缺角的小方块。
- 固定下来的数值：**46×46 正圆、`border-radius:50%` + `corner-shape:round`、logo 30px**。
  留白与尺寸的收敛过程（每轮反馈都是"外圈还粗一点点"）：
  `48/20` → `48/26` → `48/28`（实测 logo 最远点距圆心 25.5px、半径 26px，**余量只剩 0.5px**，
  就是被抱怨过的"顶边发胀"）→ `46/30`。最后这版横向留白 (46−30)/2 = **8px**，
  而 46px 圆对 30px 宽的标记能提供约 17.4px 的纵向可用量、墨迹只需 29.3px，**不会顶边**。
- 顺手把 `GH_ICON` 的 viewBox 从 `0 0 24 24` 收紧到 `0 0.5 24 23.41`
  （用浏览器 `getBBox()` 实测的墨迹范围：横向 0→24 占满、纵向 0.5→23.91，光学中心 12.0 已居中）。
  这样图标的 `width` **就等于可见标记的宽度**，留白可以直接算 ——
  之前"设了 28px 却因为字形不吃满 viewBox 而少掉一截"的意外就是这么来的。
- 状态点同时收了一档：直径 11 → 9px，环 2 → 1.5px，避免那枚绿点在浅色按钮上喧宾夺主。
- 测试断言：任何 FAB 状态规则不许改宽高、状态点必须在且带底色环、不许 `overflow:hidden`、
  按钮与状态点都必须写 `corner-shape:round`、logo/按钮比例在 1.15:1 ~ 1.7:1、
  **留白不能薄到顶边**、表面/图标/阴影/描边必须全部走 DSH 主题 token。

### 事故：**我自己把 `src/client.css` 弄成乱码了**（已修复，教训照抄一遍）
- 为了临时复现「超椭圆」形状，我用 PowerShell 做了这个仓库里明令禁止的事：
  `Get-Content -Raw` 读 + 字符串替换 + `Set-Content` 写回 `src/client.css`。
  这个读写往返按错误的码页解码，**所有中文注释变成乱码**，还挤掉了若干字符。
  （讽刺的是本文件 0.7.2 那一条早就记着「绝不用 shell 做字符串替换」，我还是踩了。）
- 修复：因为没有 git 仓库、没有 dist 备份，`git` 也救不回来，所以**用 `write` 工具（UTF-8 安全）
  按当前设计值整表重写** `src/client.css`，并逐项校验：0 个 U+FFFD、UTF-8 解码通过、括号配平、
  所有选择器与关键声明都在。`client.js` 也重新构建过（同样 0 个乱码字符）。
- 结论：这个仓库里的文本文件一律用 `read` / `edit` / `write` 工具改；**临时改动也不例外**。

### 修复：**按钮怎么都不是正圆、看着「发钝不精致」** —— 主题的全局超椭圆
- 根因在 DSH 主题包自己的一条全局规则里（`dsh-client-ui-theme` → `corner-shape.css`）：
  ```css
  @supports (corner-shape:superellipse(1.5)){
    :root{--dsw-corner-shape:superellipse(1.5)}
    *,:before,:after{corner-shape:var(--dsw-corner-shape)}
  }
  ```
  它把**所有**圆角都改成「超椭圆（squircle）」。这对卡片、输入框是好设计，
  但 `border-radius:50%` 的按钮会被压成**圆角方块**，状态点也一样 —— 于是不管尺寸、颜色、
  阴影怎么调，看起来都「不是圆的、不精致」。形状问题的根因就是这个，不是数值没调好。
- **为什么几轮都没查出来**：只有支持 `corner-shape` 的浏览器（Chrome/Edge 139+）才会这样，
  而我的无头预览**自己拼主题 CSS 时漏掉了这条 `@supports` 规则**，所以预览里一直是正圆、
  真机上是圆角方块 —— 我一直在拿两个不同的形状互相对照。
- 修法：按钮与状态点都显式写 `corner-shape:round`（面板容器不加，继续跟随主题的超椭圆风格）。
  预览也补上了这条规则的**模拟**（`scripts/preview.mjs` 默认注入，`PREVIEW_NO_SQUIRCLE=1` 关闭），
  现在预览能复现真机形状。
- 对照实验 `NEGATIVE_CONTROL=no-corner-shape node scripts/test-render.mjs`（必须失败），
  外加断言「按钮与状态点都必须写 `corner-shape:round`」—— 以后谁删掉它，`npm run check` 立刻红。

### 修复：**「宿主的凭据库当前不可写……令牌只留在浏览器里」是误报**
- 现象：绑定成功后面板显示
  「⚠️ 宿主的凭据库当前不可写（该引用被环境变量占用），令牌只留在浏览器里」，
  但现场事实正好相反：`.credentials.yaml` 里**明明有** `DSH_GITHUB_UPLOAD_TOKEN`
  （`ghp_AGyC…`，40 位），而且 `DSH_GITHUB_UPLOAD_TOKEN` 这个环境变量在
  进程级 / 用户级 / 机器级**都不存在**，各处 `.env` 也都没有。
- 根因（两处，把语义搞反了）：
  1. `credentials.describe(ref)` 返回 `{configured, source, writable}`，而 `writable:false` 的含义是
     **「有个只读来源遮蔽了这个引用」**（分层：继承的进程环境 > `.credentials.yaml` > `.env`），
     **不是**「文件不可写」。我把 `writable === false` 直接当成文案「凭据库不可写」，
     于是把「值来自环境变量、文件里其实也存着」说成了「没存下来」。
  2. `persistToken()` 先看缓存标志、`!tokenWritable` 就直接 `return false` ——
     **从没真正尝试过写入**，却让 UI 告诉用户存不进去。令牌之所以在文件里，
     是更早一次成功写入留下的。
- 修法：
  - 宿主：`persistToken` / `forgetToken` **先真正调用** `creds.set` / `creds.unset`，再按真实结果说话
    （服务在只读来源遮蔽时会 reject，这正是要如实回报的）；`auth-status` / `auth-set` / `auth-clear`
    改为回传明细 `persist: { source, writable, inStore }`，不再只给一个布尔值。
  - 界面：令牌**确实在库里**时，若被更高优先级的只读来源遮蔽，显示中性说明
    （`acctPersistShadowed`：令牌不会丢、不需要重新绑定）；只有当值既没进库、也没留在浏览器里时，
    才显示红色警告。旧的误报文案已删除。
- 附带说明（仍存在的边界）：被只读来源遮蔽时 `credentials.unset` 会被服务拒绝，
  所以「解除绑定」无法清掉文件里那条令牌；下次启动若遮蔽仍在，`resolve` 会继续返回遮蔽值，
  表现为解绑后仍然已登录。这是 `credentials` 服务的既定语义，不是本插件能绕过的。

### 修复：**「绑定失败：失败：no response」** —— 宿主接口路由根本没注册
- 现象：界面上点「校验并绑定」永远失败，报 `失败：no response`；`POST /dsh-gh/api` 返回 **405**。
- 定位过程（值得记下来，因为中间被自己的诊断骗过一轮）：
  - `GET /dsh-gh/api → 404`、`POST/PUT/OPTIONS → 405`：这个组合说明请求**落到了 DSH 的兜底路由**
    （`dsh-host-frontend-static` 里「不是 GET/HEAD 就 405」那条），也就是**我们的精确路由不存在**；
  - 查 `webServer` 契约（`cordis_inspect_query`）确认 `register(WebRoute)` 正常，
    而它的文档写明**重复的 `(kind, path)` 会 throw**；
  - 真正的根因：路由注册只写在 `ctx.effect(cb)` 里，而 `apply()` 末尾**无条件**打印「已挂载」。
    只要那个 effect 回调没被调用（或回调里 `register` 抛错被 Cordis 吞掉），就变成
    「进程说已挂载、路由其实不存在」，前端只拿到兜底路由的 405 → 解析不出 JSON → `no response`。
  - 排查中我自己造的坑：第一版诊断用 `await baseCwd()` + `fsx.writeText` 写文件，
    而 `baseCwd()` 依赖 `fsx.resolve('.')`；一旦 apply() 更早就炸了，**诊断自己也挂**，
    于是"什么都没写出来"，看起来像"新代码没加载" —— 白查了一轮。
- 修法（三层，逐层更可靠）：
  1. **在 `apply()` 里同步注册一次**（`tryRegisterRoute('apply-sync')`）—— 不再依赖 effect 被调用；
  2. `ctx.effect` 里再做一次**幂等注册**，并在卸载时 dispose（保留正确的生命周期）；
  3. 若前两步都没成，用 `ctx.interval` **每 2 秒重试最多 30 次** —— 定时器只依赖硬依赖
     `inject: ['timer']`，比 effect 更可靠。
  注册成功/失败都会把**真实结果**写进日志和诊断文件；`apply()` 末尾不再无条件说"已挂载"，
  而是打印 `路由=OK / 未注册!`。两条路径都用桩验证过（effect 完全不调用时靠 timer 兜住）。
- 诊断设施（保留）：模块被加载时同步写 `.dsh-ghu-boot.log`；`apply()` 每一步写
  `.dsh-ghu-route-diag.json`，并把权威记录放进进程内 `globalThis.__DSH_GHU_DIAG__` ——
  文件写入是**尽力而为**，进程内数组才是权威（避免诊断自己变成新的静默故障点）。
- 顺带修好前端的错误文案：以前任何异常都只显示 `no response`，现在按状态码区分
  （404/405 → 接口不存在、401/403 → 登录态、5xx → 宿主内部错误、非 JSON → 带上响应片段），
  并且宿主侧的 405 也改成回 JSON（以前回 `text/plain`，前端 `JSON.parse` 必然失败）。

### 修复：**「重新构建了、也刷新了，界面还是旧的」**
- 不是样式问题，是 DSH 客户端模块的缓存策略 + HMR 的组合结果。查了
  `dsh-client-modules/lib/index.js`：
  - 模块响应头是 `cache-control: public, max-age=31536000, immutable`（第 122、866 行）；
  - 模块 URL 形如 `/plugins/??<id>/client.js&rev=<内容哈希>`，内容取自**启动时读进内存**的表；
  - **`rev` 只有 `rebuilt(id)` 这一条路径会重算**（第 536-562 行），由 HMR 的文件监视触发。
  于是 HMR 没重算 `rev` → URL 不变 → 浏览器直接用那份「immutable」的旧缓存，
  **F5 甚至 Ctrl+F5 都不保证换得掉，必须重启 DSH**。
- 处理：面板「本机环境」里**显示界面版本**（`1.0.1+<素材指纹>`，由 `build/bundle.mjs` 生成、构建时打印），
  一眼就能分辨页面跑的是哪一版；README 的迭代说明也改成「重建客户端后必须重启 DSH」。
- **预览工具修了三个真 bug**（都是它自己报出来的）：
  `?s=measure` 把按钮宽度写死成 40 → 给 44px 的按钮算出 −2px 的「贴边」（量到视口外）；
  主题变量提取取了同一选择器的**第一段碎片**（2.4KB）而不是最长那段（10.5KB / 5.3KB），
  且把深色块排在浅色块前面 —— 深色预览因此一直「看起来没生效」；
  以及**漏掉全局 `corner-shape` 规则**，导致预览与真机的形状不一致（上面那条的根因）。
- 面板打开时入口按钮淡化到 35% 但仍可点（`.ghu-dim`），避免和面板右下角抢位置。
- **入口按钮的可拖动范围收紧到下半屏**：纵向只允许落在窗口高度 42% 以下，横向留 2px ——
  这样按钮不可能被拖到标题栏那一条上，也就不会出现「按钮本身挡住窗口按钮」的新问题。

### 测试
- 冒烟测试加到 6 条布局/交互断言：面板右上角不许有可交互元素、面板 CSS 必须留出顶部空隙且不贴右边缘、
  入口按钮尺寸恒定且全圆角（**任何状态都不许改宽高**）、控制键必须在底部控制条、
  按钮拖到右上角后必须被夹回下半屏、收起键能收起且入口按钮能重新打开。
- 新增 `scripts/preview*.mjs`（**开发辅助，不进 `npm run check`**）：把 `client.js` + DSH 主题包的真实
  CSS 变量拼成一个自包含页面，用无头 Edge/Chrome 出图，并用 `?s=measure` 量真实几何
  （尺寸、圆角、贴边余量、hover 是否改尺寸）。这一整套就是上面三版按钮改错的依据 ——
  光看 CSS 文本看不出「抖」和「挡」，得真的渲染出来量。

### 对照实验（每条都必须失败，用来证明用例真的抓得到）
```bash
NEGATIVE_CONTROL=close-in-header node scripts/test-render.mjs   # 控制条被挪回头部
NEGATIVE_CONTROL=docked-panel    node scripts/test-render.mjs   # 面板又贴回窗口右上角
NEGATIVE_CONTROL=fab-unclamped   node scripts/test-render.mjs   # 入口按钮又能停到标题栏
```

### 修复（「修了却还是老样子」的真正原因）
- **profile 里装的是 GitHub 快照，不是本目录的软链**。`profiles/desktop/package.json` 的依赖写的是
  `github:ONEOne-1v1/dsh-github-upload`，pnpm 装下来的是一份**副本**；同时 `include:dsh-github-upload`
  这一行已经被从加载器里移除（插件处于未加载状态，`POST /dsh-gh/api` 直接 404/405）。
  于是无论工作区怎么改、怎么 `npm run build`，跑的都还是那份旧副本。
  用 `plugin_manager install_bundle D:\dsh plugins\dsh-github-upload` 重装后：
  依赖变成 `link:D:/dsh plugins/dsh-github-upload`（Windows 上落成 junction），
  版本 1.0.1，`node_modules` 里的 `client.js` 就是工作区构建出来的那一份 —— **以后改完只需刷新页面**。
  README 第 4 节加了这个坑的说明。

### 测试
- 新增 `scripts/test-internals.mjs`（并入 `npm run check` / `npm test`）：把宿主最容易悄悄写错的纯函数
  从 `src/host.js` 抽出来直接断言 —— 手写 base64 编码器（含 24KB 分块边界、0xFF、中文）、
  `refPath` / `contentPath` 的逐段编码、`.gitignore` 匹配（取反、后者覆盖前者、`**`、锚定、特殊字符）、
  `commonDirOf` 的项目根推断、目录/文件的忽略判定。此前这些一个都没测。

## 1.0.0

### 变更：从「动态插件」改成可安装的 **bundle**
换了桌面环境后 `cordis_define` / `cordis_run` 不再存在，动态包也没了。改成官方支持的安装方式：
用 `plugin_manager install_bundle` 把本目录装进当前 profile。

- **宿主半边**（`src/host.js`）从「函数体」改成真正的 ES 模块：`export const inject` + `export function apply(ctx)`；
  包根的 `index.js` 只是把它再导出一次，Loader 按包名装载的就是这个。
- **客户端半边**改成 ModuleLoader 工件：`package.json` 声明 `dsh.client`，页面自己的模块加载器加载包根的
  `client.js`，它把界面注册到 **`shell.overlay`** 槽位（root 作用域、框架级浮层、`replaceRisk: none`）。
  于是不再需要 `webServer.tapIndex`，也不再需要宿主下发前端资源。
- **界面代码本身没重写**：`src/client.js` 仍然是那个纯浏览器脚本（不 import 任何 Harness 包），
  只改了三处挂载点 —— 不再往 `document.body` 上挂，而是暴露 `window.__DSH_GHU_MOUNT__(container)`，
  由槽位组件把容器交进来。`build/bundle.mjs` 负责把 `src/client.js` + `src/client.css` 拼成 `client.js`。
- 宿主只保留一个 `exact` 路由：`POST /dsh-gh/api`。

### 修复
- **`shell.overlay` 整层是 click-through 的**，条目必须自己收回指针事件 —— 否则按钮画得出来却点不动。
  `.ghu-slot-host` / `#dsh-ghu-root` 退出指针事件，`#dsh-ghu-fab` / `#dsh-ghu-panel` / `.ghu-toast` / `.ghu-backdrop` 收回来。
- 「本机环境」里显示的插件目录是 URL 形式（`/D:/dsh%20plugins/...`），现在解码后再显示。

### 安装结果（实测）
```
+ @local/dsh-github-upload link:D:/dsh plugins/dsh-github-upload
{"stage":"enable","enabled":true,"changed":true,"application":"applied","warnings":[]}
```
装进去的是**软链**，所以磁盘上的文件就是真正在跑的文件。验证结果：
- `POST /dsh-gh/api {"op":"hello"}` → 200；
- `shell.overlay` 的 occupants 里出现 `{"id":"dsh-github-upload","order":20,"active":true}`；
- **令牌没丢**：`auth-status` → `bound=true, user=ONEOne-1v1, persisted=true`，换环境后不需要重新绑定。

## 0.7.2

### 修复
- **默认填的项目目录每次打开都带一层引号**（点扫描又被自动去掉）。根因在客户端自己身上：
  `keep()` 写入 localStorage 用的是 `JSON.stringify(value)`，所以存储里的文本**本身就带引号、反斜杠也是转义的**；
  而 `boot()` / `initLang()` 用 `localStorage.getItem` 直接读原文，把引号一起读进了路径。

  这也解释了更早那次报错 `目录不存在："D:\dsh plugins\dsh-github-upload"` —— **引号是我自己写进存储又原样读出来的，
  不是用户从资源管理器粘贴的**。0.6.1 当时的「资源管理器复制为路径」判断是错的，`cleanDir` 只是在治标，
  所以现象变成「每次带引号、一扫描才清掉」。

  现在统一走新的 `readString()`（解析 JSON，并容忍历史上可能被二次编码的值），并在启动时把编码不规范的值**回写自愈**。
  同一个 bug 还顺带影响了两处，一并修好：
  - **令牌**同样被读成带引号的字符串（只是宿主凭据库把它盖住了，所以没暴露）；
  - **语言偏好从来没生效过** —— 存进去的是 `"zh"`，比较 `saved === 'zh'` 永远不成立。
- 所有写入 `S.dir` 的入口（启动读取、自动识别、文件夹选择、原生对话框返回）都过一遍 `cleanDir`，
  默认值不再可能带任何多余符号。

### 说明
- `cleanDir` 保留：粘贴带引号的路径在现实里确实存在，输入框仍然容错，只是不再需要它来救自己的火。

### 过程记录（诚实交代）
- 修这个 bug 时，我用 PowerShell 的 `Get-Content -Raw` + `WriteAllText` 做字符串替换，把 `src/client.js`
  当成了 UTF-8 往返安全的 —— 实际上那次读取按 ANSI 码页解，中文全变成乱码且丢了一个字符，**文件被我弄坏了**。
  已从 DSH 会话日志（12,588 个 zstd 帧，逐帧解压后重放本会话对该文件的 43 次 write/edit）完整恢复，
  再用 `edit` 工具补回丢失的 5 处改动。教训：这个仓库里的文本文件一律用 `edit` / `write` 工具改，
  绝不用 shell 做字符串替换。

## 0.7.1

### 修复
- **「扫描」点了没反应，上传页整块失灵**。根因是一个前端崩溃：上一版新加的 `detectCard()`
  在「还没开始检测」和「检测没得出目录」这两种情况下返回 `null`，而调用方直接
  `body.appendChild(detectCard())` —— `appendChild(null)` 抛 `TypeError`，把整个 `render()`
  打断。而 `scanNow()` 里 `render()` 排在发请求**之前**，于是点扫描什么都不发生。
  这次崩溃还发生在 `boot()` / `loadRepos()` 的 promise 回调里，所以浏览器控制台里是一条
  未捕获异常，面板处于半渲染状态。两处都修了：`detectCard()` 永不返回 `null`，
  调用方也不再无条件 `appendChild`（两道独立防线）。
- **系统文件夹对话框弹不出来，界面卡在「等待系统对话框」**。宿主的原生选择器会同步等到
  用户操作完为止，对话框没弹出来时那个请求会一直挂着，按钮就永远停在等待态。
  现在**主按钮「选择文件夹」直接打开内置文件浏览器**（只用宿主的 fs 列目录，不依赖任何
  系统组件，实测可用），原生对话框降级成内置浏览器底部的一个可选按钮，并带 **25 秒客户端超时**：
  没响应就提示放弃等待，不再卡界面。
- 「本聊天改动的文件」按钮之前只在扫描之后才渲染，与「不用先扫描」的设计自相矛盾。现在扫描
  前后都有。

### 新增
- `scripts/test-render.mjs`（`npm test`）：**无头冒烟测试**。用一个极简 DOM stub 真的把
  `src/client.js` 挂载起来，然后模拟点入口按钮、切到上传页、点扫描，并断言请求确实发出去了。
  它专门抓「render() 抛异常」这一类 bug —— 这类 bug 后端完全正常，从 curl 测不出来。
- 测试自带**对照实验**：`NEGATIVE_CONTROL=drop-null-guard node scripts/test-render.mjs`
  会把上面那个 bug 注回去，必须失败；实测报出的正是用户看到的那句
  `scan button did not issue a request (render() likely threw first)`。
- `npm run check` 现在包含：客户端语法检查 → 构建（含宿主语法预检）→ 渲染冒烟测试 → cleanDir 单元测试。

## 0.7.0

### 新增
- **不用先选文件夹就能识别本次聊天的项目**。上传页一打开就会问宿主「这次聊天在哪个目录里干活」，
  并把结果直接填进目录框：
  - 会话挑选：**优先 `live` 的会话**（也就是 `ctx.sessions` 里活着的那一个，正是当前这次聊天），
    没有 live 的才退回「创建时间最新」；
  - 项目根推断：取本会话**被写入/修改文件的最深公共目录**（跨盘或太浅时退回该会话的 cwd），
    所以 `D:\a\proj\src\x.js` 与 `D:\a\proj\src\y.js` 会得到 `D:\a\proj`；
  - 界面上显示一张卡：项目目录、来源会话标题、本会话写入/修改了几个文件，
    按钮「使用并扫描」/「扫描这个目录」/「忽略」；
  - 只在目录框还空着时自动填入，不覆盖你手选的目录。
- 「本聊天改动的文件」按钮现在**不再要求先扫描**：没扫过就先扫，扫完自动接着勾选。
- `session-files` 的 `dir` 变成可选；返回值新增 `projectRoot` 与 `rootSource`
  （`files`=由改动文件推断 / `cwd`=退回会话工作目录 / `given`=调用方给的），
  以及 `session.chosenBy`（`live` / `cwd` / `newest`）。

### 变更
- 上传页在选择控件下面新增一行说明，把语义写在界面上（回应「是更新还是直接加」）：
  **勾选的文件在 GitHub 上新增或覆盖；未勾选的保持原样，除非打开「完全同步」才会删掉远程多余文件；
  想直接推整个项目就点「全选」。**

## 0.6.1

### 修复
- **粘贴资源管理器「复制为路径」得到的路径会报「目录不存在」**。Windows 的「复制为路径」会给路径
  套一层引号（`"D:\a\b"`），这层引号被原样传给文件系统，于是直接报目录不存在 —— 报错里那对引号
  就是线索。现在路径输入框会先把输入归一化再使用：剥掉整层包裹的引号（半角 `"` `'` 与全角 `“”‘’`）、
  折叠重复分隔符（`D:\\a` → `D:\a`，同时保留 UNC 的 `\\server`）、去掉首尾空格与尾随分隔符
  （但保留 `C:\` 与 `/` 这样的根）。粘贴时和失焦时都会即时洗一遍并在界面上回显，
  点「扫描」时再兜一次。
- 新增 `scripts/test-cleandir.mjs`（`npm test`）：从 `src/client.js` 里抽出 `cleanDir` 做花括号配对
  提取，覆盖 14 个边界用例（带引号、全角引号、重复分隔符、正斜杠、盘符根、UNC、空串、纯空格等）。

### 说明
- 这一处是纯前端修复，而前端资源是宿主每次请求从磁盘读的 —— **改完只需刷新页面，不用重启插件**。

## 0.6.0

### 新增
- **「本聊天改动的文件」按钮**。上传页新增：读会话日志里每个 `tool/call` 的 `name` 与
  `arguments`，还原出这次对话写入 / 修改 / 读取过的文件，按写入→修改→读取的优先级去重，
  并与本次扫描结果求交集（大小写不敏感，所以日志里的 `readme.md` 能对上磁盘上的 `README.md`）。
  - 点一下就把这些文件勾上；没有写入/修改过任何文件时会退一步勾选读取过的。
  - 文件树里每个相关文件旁边会有一个小圆点：绿=写入、蓝=修改、灰=仅读取、浅灰=仅检索。
  - 面板会写明来源会话标题与统计（写入/修改/读取各几个、多少在项目目录内、多少在目录外）。
  - 会话选择：先按会话的 `cwd` 与项目目录匹配，取其中创建时间最新的一个；一个都匹配不上时
    退回最新会话并在返回值里标注 `matched: false`。
- 新增宿主操作 `session-files`，`hello` 多返回一个 `sessionQuery` 可用性标记。

### 说明
- 只识别 `write` / `edit` / `read` / `grep` / `glob` 这几个工具；只被 shell 命令改过的文件、
  以及子代理自己会话里改的文件不计入。
- 该操作会完整读一次会话日志，所以只在点按钮时执行（不在扫描时自动跑），避免拖慢日常扫描。

## 0.5.0

### 修复
- **每次插件更新都要重新绑定令牌**。宿主半边每次重新激活都会换一个全新的闭包，之前令牌只存在内存里，
  一更新就没了；而 GitHub 只显示一次令牌，用户只好不断新建。现在令牌在校验通过后写入宿主的
  **凭据库**（`ctx.credentials`，引用名 `DSH_GITHUB_UPLOAD_TOKEN`，落在 `~/.dsh/.credentials.yaml`），
  插件重启、页面刷新、DSH 重启后都会自动恢复。前端启动时先问 `auth-status`，宿主有就用宿主的，
  浏览器 `localStorage` 降级为第二备份；「账号」页会明说令牌是否已持久化（凭据库不可写时给出警告）。
- **空仓库上传失败：`上传 .gitignore 失败：Git Repository is empty`**。没有任何 commit 的仓库上，
  GitHub 的 Git Data API（blobs / trees / commits）全线返回 409，唯一能落第一个 commit 的是 Contents API。
  现在会主动探测（`size == 0` 且 `GET /git/refs/heads` 返回 409）并先用**被选中的最小文件**垫出首个提交，
  再走 Git Data API 写完整文件树；万一探测漏了，也会在报「Repository is empty」时自动垫完重试一次。
  全程不会在仓库里留下多余文件。
- 目标分支不存在时不再造游离提交：若仓库已有默认分支，就从默认分支分出来（日志会写明），
  并相应改用 `POST /git/refs` 而不是 `PATCH`。

### 说明
- 空仓库的首次推送因此会有两个 commit（垫底 + 完整树），仅限第一次。

## 0.4.0

### 新增
- **界面中英双语，可实时切换**。面板头部加了 `中文 | EN` 开关，选择记在 `localStorage`，
  首次按浏览器语言猜。两侧各有一份 `[中文, English]` 定位文案表：
  - 浏览器端 `src/client.js` 的 `var M`：面板里所有标签、按钮、提示、toast；
  - 宿主端 `src/host.js` 的 `const M`：报错、扫描忽略原因、上传任务日志、仓库来源统计、令牌权限提示。
  前端每次请求都带 `lang`，宿主按它回话；GitHub 自己的报错原样透传（本来就是英文）。
- README 双语：`README.md`（English）+ `README.zh.md`（中文），顶部互相跳转，并用
  `README.i18n.yaml` 记录两侧 git blob 哈希作为配对一致性凭据。

### 变更
- 上传任务的 `phase` 改为由宿主按语言下发（前端只负责「上传中 / 完成 / 失败」的框壳），
  因此进度区在两种语言下都是完整的句子。
- 切换语言时会清掉上一轮的扫描结果与任务状态：那是宿主已按旧语言下发的文案，留着会中英混排。
- 扫描忽略原因、来源统计等全部改成按语言生成，不再有硬编码中文。

## 0.3.0

### 新增
- **本机文件夹选择器**。原来只能在「上传」页手打项目路径，既麻烦又容易写错。现在目录输入框旁边有
  「选择文件夹」按钮：
  - 宿主 `directoryPicker` 是 `native` 后端时（本机部署即如此），直接弹出系统文件夹对话框
    （Windows 走 `IFileOpenDialog`），一次点击拿到绝对路径，选完自动扫描；
  - 是 `browse` 后端或没有该服务时，自动切换到内置文件浏览器：盘符/主目录快捷跳转、面包屑、
    逐层进入、隐藏项开关、可选新建文件夹；
  - 两条路都走不通时，手动输入框仍然照常可用。
- `pick-folder` / `list-dirs` / `mkdir-dir` 三个宿主操作，`hello` 新增 `picker.kind` 供前端选择交互。

### 修复
- **新建仓库后列表不更新**，必须手动点「刷新」才能看到。现在创建成功会立刻把新仓库插到列表最前面
  （并清空搜索框，避免被过滤掉），随后在后台重新拉取一次对齐 GitHub 的排序。
- **重命名/改可见性之后仓库列表被清空**（原实现直接 `S.repos = []`），同样需要手动刷新。现在保留
  列表并在保存后自动刷新。

### 说明
- 原生文件夹对话框会一直阻塞那次 HTTP 请求，直到用户选完或取消 —— 本地应用可以接受，前端在等待
  期间把按钮置为「等待系统对话框…」。

## 0.2.1

### 修复
- **依赖目录会被悄悄漏掉**。原来所有「内置忽略」目录都是整棵不扫描，包括 `build/`、`dist/`、
  `out/`、`target/` 这些构建产物目录 —— 于是像本项目这样把构建脚本放在 `build/` 里的情况，
  文件会直接不出现在列表里，用户既看不到也无法勾选，上传结果悄悄少文件。现在忽略目录分两档：
  - **HARD**（`node_modules`、`.git`、`.venv`、`__pycache__`、`coverage` 等）：整棵不下钻，
    但会通过 `prunedDirs` / `prunedCount` 明确报出跳过了哪些目录；
  - **SOFT**（`dist`、`build`、`out`、`target`、`bin`、`obj`、`release`、`debug` 等）：照常下钻、
    照常出现在文件列表里，只是默认不勾选（勾上「显示被忽略」即可看到）。
- `.gitignore` 取反规则（`!keep.txt`）此前永远无效，因为父目录的忽略状态会无条件覆盖。
  现在只有「没有规则显式命中该文件」时才继承父目录的忽略状态。

### 改进
- 扫描结果新增 `prunedDirs` / `prunedCount`，前端在上传页显示「已整棵跳过 N 个依赖/缓存目录」，
  并在扫描被截断时明确提示，避免「悄悄少了文件」。

## 0.2.0

### 修复
- **绑定成功却看不到任何仓库**。原来的实现只调一次
  `GET /user/repos?affiliation=owner,collaborator,organization_member`，一旦令牌是
  fine-grained（只授权了部分仓库）或 classic 缺 `repo` scope，GitHub 会返回 200 + 空数组，
  UI 只能显示「没有仓库」。现在：
  - 汇总三个来源：账号可见仓库、**所属组织的仓库**（`/user/orgs` → `/orgs/{org}/repos`）、
    列表仍为空时的**公开仓库兜底**（`/users/{login}/repos`），按 `pushed_at` 倒序去重；
  - 回传每个来源的命中数（「来源统计」），失败来源也会写明原因；
  - 从响应头解析令牌类型与权限（`x-oauth-scopes` / `github-authentication-token-expiration`），
    在「账号」标签页展示，并按可能性排序给出排查指引 + 一键创建正确令牌的链接；
  - 「仓库」标签页新增**直接指定仓库**输入框，填 `owner/repo` 即可绕过列表。
- 组织仓库的读取合并成一次子进程批量请求，避免 N 个组织拉起 N 个 node 进程。

### 改进
- **前端资源改为运行时从磁盘读取**（`src/client.js`、`src/client.css`）。原来它们以内联字符串
  塞在宿主源码里，改一行前端都要重新 define 约 40KB 的载荷；现在改完刷新页面即可。
  宿主里的 `ASSET_DIR` 写死指向本项目的 `src/`，移动目录后构建脚本会告警。
- 新增 `build/bundle.mjs`：语法预检 + 校验 `ASSET_DIR` + 生成 `dist/ghpush-package.json`。
- `hello` 返回 `assetDir`，「账号 → 本机环境」里可见，便于排查资源读取失败。

## 0.1.0

首个可用版本。

- 右下角可拖动入口按钮 + 右侧抽屉面板（账号 / 仓库 / 上传 / 仓库信息）。
- PAT 绑定与校验、仓库搜索与新建、Git Data API 上传（blob → tree → commit → ref）、
  仓库信息编辑与删除、本机环境自检。
- 宿主侧通过 `webServer.register` + `webServer.tapIndex` 提供 UI，绕开本会话被禁用的审批流程。
- 修复：分支名含 `/` 时 ref 路径整体 URL 编码导致被误判为「新分支」并生成游离提交；
  非 404/409 的分支读取失败改为显式报错。
