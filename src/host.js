/**
 * dsh-github-upload — 宿主半边（Host half）
 *
 * 一个普通的 ES 模块插件：`export const inject` + `export function apply(ctx)`；
 * 包根的 index.js 只是把它再导出一次，供 Loader 按包名装载。
 * 它跑在 DSH 的 Node 进程里，负责：
 *   1. 通过 webServer 注册 /dsh-gh/api 这一个 JSON 接口（前端由客户端半边直接调用）；
 *   2. 用 subprocess 拉起短命 node 子进程做 HTTPS 请求（插件沙箱内没有 fetch / require）；
 *   3. 用 fs 服务扫描项目目录、读取文件内容，用 directoryPicker 让用户选文件夹；
 *   4. 用 credentials 持久化令牌（插件重装后自动恢复），用 sessionQuery 读会话日志推断项目目录；
 *   5. 用 GitHub Git Data API 把文件推成一个 commit（不依赖本机 git，也不会生成 .git）。
 *
 * 界面（右下角按钮 + 面板）由包根的 client.js 提供：那是 ModuleLoader 工件，
 * 由页面注册到 shell.overlay 槽位，**import 不到本模块** —— 两边只通过 /dsh-gh/api 通信。
 * 因此改界面只需要改 src/client.js 再跑 `npm run build`（重新生成 client.js），不需要动这里。
 */

import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'

const API_BASE = 'https://api.github.com'
const MAX_FILE_BYTES = 26214400 // 单文件 25MB
const MAX_SCAN_FILES = 20000
const ROUTE_PREFIX = '/dsh-gh'

/**
 * 启动诊断（**默认关闭**）。
 *
 * 只在 `DSH_GHU_DIAG=1` 时启用，用来排查「插件显示已加载、路由却不存在」这类静默失败：
 * 模块被加载时写一行，之后 apply() 的每一步也各写一行。关闭时完全不碰文件系统。
 * 输出到 `DSH_GHU_DIAG_FILE`，未指定则用系统临时目录 —— 不写死任何本机路径。
 * 任何失败都必须吞掉：诊断绝不能害得插件启动不了。
 */
const DIAG_ON = (() => {
  try { return process.env.DSH_GHU_DIAG === '1' } catch (e) { return false }
})()
const DIAG_FILE = (() => {
  if (!DIAG_ON) return ''
  try {
    const forced = String(process.env.DSH_GHU_DIAG_FILE || '').trim()
    if (forced) return forced
    const tmp = String(process.env.TEMP || process.env.TMPDIR || process.env.TMP || '/tmp')
    return tmp.replace(/[\\/]+$/, '') + '/dsh-github-upload-diag.jsonl'
  } catch (e) { return '' }
})()
const DIAG_STAMP = 'host'
/**
 * 同步 fs：诊断用，尽力而为。`fsMod` 取自 createRequire，失败则为 null，
 * 而 diag() 会把异常吞掉 —— 所以文件写入只是附赠，进程内记录才是权威。
 */
let fsMod = null
try { fsMod = createRequire(import.meta.url)('node:fs') } catch (e) { fsMod = null }

function stampBoot() {
  if (!DIAG_ON) return
  const line = new Date().toISOString() + '  host.js loaded  stamp=' + DIAG_STAMP +
    '  fsMod=' + (fsMod ? 'ok' : 'NULL') + '  pid=' + process.pid
  try { if (fsMod && DIAG_FILE) fsMod.appendFileSync(DIAG_FILE, line + '\n') } catch (e) { /* 附赠 */ }
  try { console.log('[dsh-github-upload] boot ' + line.trim()) } catch (e2) { /* ignore */ }
}
stampBoot()

/**
 * 双向文案表：每条 [中文, English]。
 * {1} / {2} 是位置占位符（用 split/join 替换，避免正则转义问题）。
 * 只放「用户会看到」的文本；GitHub 自己的报错原样透传。
 */
const M = {
  notBound: ['尚未绑定 GitHub 账号，请先在「账号」标签页填入 Personal Access Token',
    'No GitHub account is bound yet — paste a Personal Access Token on the Account tab first.'],
  nodeMissing: ['找不到 node 可执行文件，无法发起 GitHub 请求',
    'Cannot find a node executable, so GitHub requests cannot be made.'],
  reqFail: ['网络请求失败：{1}', 'Network request failed: {1}'],
  timeout: ['请求超时', 'Request timed out'],
  helperNoOut: ['网络辅助进程无输出{1}', 'The network helper process produced no output{1}'],
  helperBad: ['网络辅助进程返回异常：{1}', 'The network helper returned a malformed result: {1}'],
  tokenEmpty: ['令牌不能为空', 'The token must not be empty.'],
  tokenInvalid: ['令牌校验失败：{1}', 'Token verification failed: {1}'],
  repoNameEmpty: ['请填写仓库名', 'Enter a repository name.'],
  repoNameBad: ['仓库名只能包含字母、数字、点、下划线和连字符',
    'A repository name may contain only letters, digits, dot, underscore and hyphen.'],
  noField: ['没有需要更新的字段', 'There are no fields to update.'],
  unknownOp: ['未知操作：{1}', 'Unknown operation: {1}'],
  needRepo: ['请先选择目标仓库', 'Select a target repository first.'],
  needFiles: ['没有选择任何要上传的文件', 'No files were selected for upload.'],
  refReadFail: ['读取远程分支失败（{1}）：{2}', 'Could not read the remote branch ({1}): {2}'],
  blobFail: ['上传 {1} 失败：{2}', 'Failed to upload {1}: {2}'],
  treeFail: ['创建 tree 失败', 'Failed to create the tree.'],
  commitFail: ['创建 commit 失败', 'Failed to create the commit.'],
  jobMissing: ['任务不存在', 'No such job.'],
  dirEmpty: ['请填写项目目录', 'Enter a project directory.'],
  dirMissing: ['目录不存在：{1}', 'Directory does not exist: {1}'],
  dirNotDir: ['不是目录：{1}', 'Not a directory: {1}'],
  dirUnreadable: ['目录不可读：{1}', 'Directory is not readable: {1}'],
  // 起点目录列不动时，自动改到能用的目录（例如 D:/ 根列不出来，但项目目录可以）
  pickFallback: ['原来的位置（{1}）列不出来，已自动切到 {2}；上面的盘符按钮可以换到别处。',
    'Could not list {1}, so this opened at {2} instead; use the drive buttons above to go elsewhere.'],
  mkdirNoParent: ['缺少父目录', 'Missing parent directory.'],
  mkdirBadName: ['请输入合法的文件夹名', 'Enter a valid folder name.'],
  mkdirSep: ['文件夹名不能包含路径分隔符', 'A folder name cannot contain a path separator.'],
  mkdirUnsupported: ['当前宿主的目录选择后端不支持新建文件夹（可用系统对话框里的「新建文件夹」）',
    'The host directory-picker backend cannot create folders (use "New folder" inside the system dialog instead).'],
  pickerNone: ['宿主没有目录选择服务，已切换为内置文件浏览器',
    'No host directory-picker service is available; using the built-in browser instead.'],

  // 扫描忽略原因
  igDep: ['内置忽略（依赖/缓存）：{1}', 'built-in ignore (dependency/cache): {1}'],
  igBuild: ['内置忽略（构建产物）：{1}', 'built-in ignore (build output): {1}'],
  igGitignore: ['.gitignore 忽略', 'ignored by .gitignore'],
  igBuiltin: ['内置忽略：{1}', 'built-in ignore: {1}'],
  igTooBig: ['超过 25MB 上限（{1} 字节）', 'over the 25MB limit ({1} bytes)'],

  // 上传任务日志
  logTarget: ['目标仓库 {1}，分支 {2}', 'Target repository {1}, branch {2}'],
  logHead: ['远程分支已存在 head={1}', 'Remote branch exists, head={1}'],
  logNewBranch: ['远程分支尚不存在，将新建分支 {1}', 'Remote branch does not exist; creating {1}'],
  logUploaded: ['文件内容已上传（{1} 个）', 'Uploaded file contents ({1} file(s))'],
  logPrune: ['将删除远程多余的 {1} 个文件', 'Will delete {1} extra file(s) from the remote branch'],
  logBranch: ['分支 {1} 已更新 -> {2}', 'Branch {1} updated -> {2}'],

  // 仓库来源统计
  diagMine: ['账号可见仓库：新增 {1} 个', 'Repositories visible to the account: {1} new'],
  diagMineFail: ['账号可见仓库：失败 —— {1}', 'Repositories visible to the account: failed — {1}'],
  diagOrgNone: ['所属组织：0 个（或令牌缺少 read:org 权限）',
    'Organizations: 0 (or the token lacks read:org)'],
  diagOrgFail: ['所属组织：读取失败 —— {1}', 'Organizations: failed — {1}'],
  diagOrgRepo: ['组织 {1}：新增 {2} 个', 'Organization {1}: {2} new'],
  diagOrgRepoFail: ['组织 {1}：读取失败（{2}）', 'Organization {1}: failed ({2})'],
  diagOrgBatchFail: ['组织仓库：批量读取失败 —— {1}', 'Organization repositories: batch read failed — {1}'],
  diagPublic: ['公开仓库兜底：新增 {1} 个', 'Public repositories fallback: {1} new'],
  diagPublicFail: ['公开仓库兜底：读取失败 —— {1}', 'Public repositories fallback: failed — {1}'],

  // 令牌权限提示
  hintClassicNone: ['classic 令牌没有任何 scope，只能读公开信息，看不到仓库列表。',
    'This classic token has no scopes, so it can only read public metadata and cannot list repositories.'],
  hintClassicNoRepo: ['classic 令牌缺少 repo / public_repo 权限，只能看到公开仓库。',
    'This classic token lacks the repo / public_repo scope, so only public repositories are visible.'],
  hintClassicPublicOnly: ['classic 令牌只有 public_repo 权限，看不到私有仓库。',
    'This classic token only has public_repo, so private repositories are invisible.'],
  hintClassicOk: ['classic 令牌权限看起来正常。', 'This classic token looks correctly scoped.'],
  hintFine: ['fine-grained 令牌只能访问创建令牌时被授权的仓库；若要看到全部仓库，请在令牌设置里选择 All repositories。',
    'A fine-grained token only sees the repositories it was granted; choose "All repositories" in the token settings to see everything.'],

  // 空仓库初始化
  seedMessage: ['由 DeepSeek Harness 初始化仓库', 'Initialize repository from DeepSeek Harness'],
  logSeeded: ['空仓库：已用 {1} 创建首个提交（{2}）',
    'Empty repository: created the first commit from {1} ({2})'],
  logSeededDefault: ['仓库默认分支已建立：{1}', 'Repository default branch created: {1}'],
  logSeedRetry: ['GitHub 报告仓库为空，创建首个提交后重试',
    'GitHub reported an empty repository; creating the first commit and retrying'],
  seedFail: ['空仓库初始化失败（{1}）：{2}', 'Could not initialize the empty repository ({1}): {2}'],
  logBranchOff: ['分支 {1} 尚不存在，将从 {2} 分出',
    'Branch {1} does not exist yet; branching it off {2}'],

  // 会话文件识别
  sessionUnavailable: ['宿主没有会话查询服务，无法识别聊天中改动的文件',
    'The host exposes no session-query service, so files touched in the chat cannot be detected.'],
  sessionNone: ['没有找到任何会话记录', 'No session records were found.'],
  sessionNoFiles: ['在会话《{1}》里没有找到写入或修改过的文件',
    'No written or edited files were found in session "{1}".'],
  sessionNoRoot: ['识别到会话《{1}》，但推断不出项目目录（曾改动的文件跨了多个盘或根）',
    'Found session "{1}", but its project directory cannot be inferred (the touched files span several roots).'],
}

/** 取一条文案并替换占位符（最多三个）。 */
function tr(lang, key, a, b, c) {
  const row = M[key]
  let s = row === undefined ? key : (lang === 'en' ? row[1] : row[0])
  if (a !== undefined) s = s.split('{1}').join(String(a))
  if (b !== undefined) s = s.split('{2}').join(String(b))
  if (c !== undefined) s = s.split('{3}').join(String(c))
  return s
}

/**
 * 在子 node 进程里执行的网络助手。
 * 动态插件沙箱里 fetch / require 都被禁用，所以这里把「一批 HTTP 请求」用 stdin 传进去，
 * 子进程按并发度执行，再把结果数组从 stdout 吐回来。
 * 入口参数：{ requests: [{url, method, headers, body}], concurrency }
 * 输出：{ ok: true, results: [{ok, status, headers, text} | {ok:false, error}] }
 */
const HELPER = `
const https = require('node:https');
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', function (c) { raw += c });
process.stdin.on('end', function () { run() });

function one(req) {
  return new Promise(function (resolve) {
    let u;
    try { u = new URL(req.url) } catch (e) { resolve({ ok: false, error: 'bad url' }); return }
    const headers = Object.assign({}, req.headers || {});
    let payload = null;
    if (req.body !== null && req.body !== undefined) {
      payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      headers['content-length'] = Buffer.byteLength(payload);
    }
    const r = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: req.method || 'GET',
      headers: headers
    });
    r.on('response', function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c) });
      res.on('end', function () {
        const text = Buffer.concat(chunks).toString('utf8');
        const h = {};
        const keys = Object.keys(res.headers);
        for (let i = 0; i < keys.length; i++) {
          const v = res.headers[keys[i]];
          h[keys[i]] = Array.isArray(v) ? v.join(', ') : String(v);
        }
        resolve({ ok: true, status: res.statusCode, headers: h, text: text });
      });
    });
    r.on('error', function (e) { resolve({ ok: false, error: String((e && e.message) || e) }) });
    if (payload !== null) r.write(payload);
    r.end();
  });
}

async function run() {
  let plan;
  try { plan = JSON.parse(raw) } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: 'invalid request json' }));
    return;
  }
  const list = Array.isArray(plan.requests) ? plan.requests : [];
  const conc = Math.max(1, Math.min(8, plan.concurrency || 4));
  const results = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      results[i] = await one(list[i]);
    }
  }
  const pool = [];
  for (let i = 0; i < conc; i++) pool.push(worker());
  await Promise.all(pool);
  process.stdout.write(JSON.stringify({ ok: true, results: results }));
}
`

/**
 * 依赖声明。**必须把用到的服务全部写在这里**，再用 `ctx.<name>` 取用。
 *
 * 在 DSH 0.2.0-rc.2 的桌面 profile 里，`ctx.get('fs')` / `ctx.get('webServer')`
 * 对这个插件的上下文全部返回 undefined（连 `webServer` 也是），
 * 于是 `apply()` 在第一段自检就 `return` 了 —— 插件在列表里显示 `active`，
 * 却**从来没注册过路由**，前端每次请求都落到兜底路由拿 405（表现为「绑定失败：no response」）。
 * 声明成 inject 之后由加载器保证依赖就绪，`ctx.webServer` 一定拿得到。
 */
export const inject = ['timer', 'fs', 'subprocess', 'webServer']

export function apply(ctx) {
    // 探针：把启动过程摊开写进文件 —— 中间任何一步静默抛错都会造成「进程说已挂载、路由却不存在」的假象。
    // diag() 是同步 + 绝对路径 + 零依赖，不会自己被拖死。
    const TAG = '[dsh-github-upload]'
    diag('apply:enter')
    // 硬依赖：已在上面的 inject 里声明，加载器保证可用，因此直接用 ctx.xxx。
    const fsx = ctx.fs
    const sp = ctx.subprocess
    const wsvc = ctx.webServer
    /* 可选服务：**一律惰性获取**。
     *
     * 教训（真踩过两次）：`apply()` 跑在启动早期，而提供这些服务的插件可能**后加载**。
     * 在 apply 里 `ctx.get(...)` 取一次并长期使用，会永久拿到 undefined，
     * 相应能力就被静默丢掉 —— 表现是"怎么点都没反应"，且不报错。
     * 目录选择器（directoryPicker）正是这样丢掉过一次：后端在插件列表的最后加载，
     * 结果「弹系统文件夹对话框」永远不可用。所以这里只保留"每次用的时候再问一次"。
     */
    const opt = {}
    function svc(name) {
      if (opt[name] !== undefined) return opt[name]
      let v
      try { v = ctx.get(name) } catch (e) { v = undefined }
      if (v !== undefined && v !== null) opt[name] = v   // 拿到了就缓存；拿不到下次再问
      return v
    }
    const spol = svc('sandboxPolicy')
    diag('apply:services',
      'ctx.fs=' + (fsx !== undefined) + ' ctx.subprocess=' + (sp !== undefined) +
      ' ctx.webServer=' + (wsvc !== undefined) + ' register=' + typeof (wsvc && wsvc.register) +
      ' | get: sandboxPolicy=' + (spol !== undefined) +
      ' credentials=' + (svc('credentials') !== undefined) +
      ' sessionQuery=' + (svc('sessionQuery') !== undefined))
    if (fsx === undefined || sp === undefined || wsvc === undefined) {
      diag('apply:ABORT', '硬依赖缺失：fs=' + (fsx !== undefined) + ' subprocess=' + (sp !== undefined) + ' webServer=' + (wsvc !== undefined))
      console.error(TAG + ' 缺少 fs / subprocess / webServer 服务，插件未激活')
      return
    }
    diag('apply:services-ok')

    const B64CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    // 用字符码代替字面量转义序列：源码里不出现反斜杠，把它塞进 JSON 载荷时就不会被二次转义。
    const BS = String.fromCharCode(92)
    const CR = String.fromCharCode(13)
    const REGEX_SPECIAL = '.+^$()[]{}|' + BS

    function langOf(args) {
      return args && args.lang === 'en' ? 'en' : 'zh'
    }

    // ── 会话内状态（进程级、不落盘）────────────────────────────────
    let token = ''
    let user = null
    let tokenMeta = null
    let nodeExeCache = null
    let cwdCache = null
    let jobSeq = 0
    const jobs = new Map()

    // ── 令牌持久化 ────────────────────────────────────────────────
    //
    // 动态插件的宿主半边每次重新激活都会换一个全新的闭包，内存里的令牌会丢，
    // 所以把令牌写进宿主的凭据库（credentials 服务），重启后自动恢复。
    const TOKEN_REF = 'DSH_GITHUB_UPLOAD_TOKEN'
    /**
     * 凭据库的「写入能力」不是一个布尔值。`describe(ref)` 回的是
     * `{ configured, source, writable }`，而 `writable:false` 的含义是
     * **「有个只读来源遮蔽了这个引用」**（继承的进程环境 > .credentials.yaml > .env），
     * 不是「文件不可写」：令牌可能早就落在 .credentials.yaml 里，只是被环境变量覆盖了解析结果。
     * 所以这里把原始判定拆开记：source（env / file）+ writable，供 UI 说人话。
     */
    let tokenPersist = { source: '', writable: false, inStore: false }
    let tokenRestored = false

    /** 从凭据库读回令牌；顺带记录它来自哪一层、能否写入，供 UI 提示用。 */
    async function loadStoredToken() {
      const creds = svc('credentials')
      if (creds === undefined) return ''
      try {
        const info = await creds.describe(TOKEN_REF)
        if (info !== undefined) {
          tokenPersist = {
            source: String(info.source || ''),
            writable: info.writable === true,
            // 「文件里有」= 来源是 file，或虽然被 env 遮蔽但值也在文件里（这里只按来源判断）
            inStore: info.source === 'file' || info.writable === true,
          }
        }
      } catch (e) { /* 保持上一次判定 */ }
      try {
        const resolved = await creds.resolve(TOKEN_REF)
        return resolved && resolved.value ? String(resolved.value) : ''
      } catch (e) {
        return ''
      }
    }

    /** 只要有一次能用上库里的令牌，就记住这个事实，避免每次请求都去读盘。 */
    async function ensureToken() {
      if (token) return
      if (tokenRestored) return
      tokenRestored = true
      const stored = await loadStoredToken()
      if (stored) token = stored
    }

    /**
     * 持久化令牌。**先真正尝试写，再根据结果说话** ——
     * 无论缓存的可写标志如何都试一次，写失败才算失败，
     * 并把真实原因（哪个只读来源遮蔽了它）回报给 UI。
     */
    async function persistToken(value) {
      const creds = svc('credentials')
      if (creds === undefined) return { ok: false, reason: 'no-service' }
      try {
        await creds.set(TOKEN_REF, value)
        tokenPersist = { source: 'file', writable: true, inStore: true }
        return { ok: true, reason: 'file' }
      } catch (e) {
        // 常见原因：环境变量或 .env 遮蔽了这个引用（服务会拒绝写入）。
        const msg = String(e && e.message ? e.message : e)
        console.error('[dsh-github-upload] 写入凭据库失败：', msg)
        try {
          const info = await creds.describe(TOKEN_REF)
          tokenPersist = {
            source: String((info && info.source) || ''),
            writable: !!(info && info.writable),
            inStore: !!(info && (info.source === 'file' || info.writable)),
          }
        } catch (e2) { /* 保持原值 */ }
        return { ok: false, reason: tokenPersist.source === 'env' ? 'env-shadowed' : 'write-failed', message: msg }
      }
    }

    /**
     * 解除绑定时顺手清掉文件里的令牌。同样**先真正尝试**再说话：
     * 被只读来源遮蔽时 `unset` 会拒绝（服务语义如此），那就不动它，也不报错。
     */
    async function forgetToken() {
      const creds = svc('credentials')
      if (creds === undefined) return
      try {
        await creds.unset(TOKEN_REF)
        tokenPersist = { source: '', writable: true, inStore: false }
      } catch (e) {
        console.error('[dsh-github-upload] 清除凭据库里的令牌失败（可能被只读来源遮蔽）：', String(e && e.message ? e.message : e))
      }
    }

    // ── 路径工具 ──────────────────────────────────────────────────

    async function baseCwd() {
      if (cwdCache !== null) return cwdCache
      let v = ''
      try {
        if (spol !== undefined && typeof spol.workspaceRoot === 'string' && spol.workspaceRoot) v = spol.workspaceRoot
      } catch (e) { v = '' }
      if (!v) {
        try {
          const t = await fsx.resolve('.')
          v = fsx.processPath(t)
        } catch (e2) { v = '.' }
      }
      cwdCache = v
      return v
    }

    async function fsCwd() {
      try {
        const t = await fsx.resolve('.')
        return fsx.processPath(t)
      } catch (e) { return '' }
    }

    /** 插件包目录（客户端半边打包在包根的 client.js 里），只用于 hello 里回报，便于排障。 */
    function assetDir() {
      try { return new URL('.', import.meta.url).pathname } catch (e) { return '' }
    }

    // ── 子进程 / 网络 ─────────────────────────────────────────────

    async function nodeExe() {
      if (nodeExeCache !== null) return nodeExeCache
      const candidates = ['node', 'node.exe']
      for (let i = 0; i < candidates.length; i++) {
        try {
          const p = await sp.resolveExecutable(candidates[i])
          if (p) { nodeExeCache = p; return p }
        } catch (e) { /* 试下一个 */ }
      }
      throw new Error(tr('zh', 'nodeMissing'))
    }

    function raceTimeout(promise, ms, onTimeout) {
      return new Promise(function (resolve, reject) {
        let settled = false
        const dispose = ctx.timeout(function () {
          if (settled) return
          settled = true
          try { onTimeout() } catch (e) { /* ignore */ }
          reject(new Error(tr('zh', 'timeout')))
        }, ms)
        promise.then(function (v) {
          if (settled) return
          settled = true
          try { dispose() } catch (e) { /* ignore */ }
          resolve(v)
        }, function (e) {
          if (settled) return
          settled = true
          try { dispose() } catch (e2) { /* ignore */ }
          reject(e)
        })
      })
    }

    /** 跑一批 HTTP 请求，返回同样顺序的结果数组。 */
    async function runHelper(requests, concurrency) {
      if (!requests.length) return []
      const exe = await nodeExe()
      const cwd = await baseCwd()
      const payload = JSON.stringify({ requests: requests, concurrency: concurrency || 4 })
      const handle = sp.spawn({
        argv: [exe, '-e', HELPER],
        cwd: cwd,
        stdio: {
          stdin: { data: payload },
          stdout: { maxBytes: 33554432 },
          stderr: { maxBytes: 262144 },
        },
        graceMs: 5000,
      })
      await raceTimeout(handle.done, 180000, function () {
        try { handle.terminate() } catch (e) { /* ignore */ }
      })
      const out = handle.collected.stdout ? handle.collected.stdout.readFrom(0) : null
      const err = handle.collected.stderr ? handle.collected.stderr.readFrom(0) : null
      if (!out || !out.text) {
        const detail = err && err.text ? '：' + String(err.text).slice(0, 600) : ''
        throw new Error(tr('zh', 'helperNoOut', detail))
      }
      let parsed = null
      try { parsed = JSON.parse(out.text) } catch (e) { parsed = null }
      if (!parsed || parsed.ok !== true || !Array.isArray(parsed.results)) {
        throw new Error(tr('zh', 'helperBad', String(out.text).slice(0, 400)))
      }
      return parsed.results
    }

    async function rawRequest(req, lang) {
      const results = await runHelper([req], 1)
      const r = results[0]
      if (!r || r.ok !== true) throw new Error(tr(lang, 'reqFail', String((r && r.error) || 'unknown')))
      return r
    }

    function ghHeaders(accept) {
      return {
        authorization: 'Bearer ' + token,
        accept: accept || 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'dsh-github-upload',
      }
    }

    function parseJson(text) {
      if (!text) return null
      try { return JSON.parse(text) } catch (e) { return null }
    }

    /** GitHub 自己的报错是英文，原样透传；没有 message 时退回 HTTP 状态码。 */
    function ghMessage(json, status) {
      if (json && typeof json.message === 'string') {
        let m = json.message
        if (Array.isArray(json.errors) && json.errors.length) {
          const parts = []
          for (let i = 0; i < json.errors.length; i++) {
            const e = json.errors[i]
            if (e && typeof e.message === 'string') parts.push(e.message)
          }
          if (parts.length) m = m + ' (' + parts.join('; ') + ')'
        }
        return m
      }
      return 'HTTP ' + status
    }

    /** 分支名里的 `/` 必须按路径分隔符保留，不能整体 URL 编码。 */
    function refPath(branch) {
      const segs = String(branch).split('/')
      const out = []
      for (let i = 0; i < segs.length; i++) out.push(encodeURIComponent(segs[i]))
      return out.join('/')
    }

    async function gh(method, path, body, accept, lang) {
      // 每次带鉴权的请求都先尝试从凭据库恢复 —— 插件重启后第一次调用就自动重新绑定。
      await ensureToken()
      if (!token) throw new Error(tr(lang, 'notBound'))
      const r = await rawRequest({
        url: API_BASE + path,
        method: method,
        headers: ghHeaders(accept),
        body: body === undefined ? null : body,
      }, lang)
      return { status: r.status, json: parseJson(r.text), text: r.text, headers: r.headers || {} }
    }

    async function ghOk(method, path, body, accept, lang) {
      const r = await gh(method, path, body, accept, lang)
      if (r.status >= 400) throw new Error(ghMessage(r.json, r.status))
      return r.json
    }

    /** 批量 GET（一次子进程，多个请求）。 */
    async function ghBatch(paths, lang) {
      if (!paths.length) return []
      const requests = []
      for (let i = 0; i < paths.length; i++) {
        requests.push({ url: API_BASE + paths[i], method: 'GET', headers: ghHeaders(), body: null })
      }
      const results = await runHelper(requests, 4)
      const out = []
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (!r || r.ok !== true) {
          out.push({ status: 0, json: null, headers: {}, error: String((r && r.error) || 'unknown') })
          continue
        }
        out.push({ status: r.status, json: parseJson(r.text), headers: r.headers || {}, error: '' })
      }
      return out
    }

    // ── GitHub 数据整形 ───────────────────────────────────────────

    function trimUser(u) {
      if (!u || typeof u !== 'object') return null
      return {
        login: String(u.login || ''),
        name: u.name ? String(u.name) : '',
        avatar: u.avatar_url ? String(u.avatar_url) : '',
        url: u.html_url ? String(u.html_url) : '',
      }
    }

    function trimRepo(r) {
      if (!r || typeof r !== 'object') return null
      return {
        name: String(r.name || ''),
        fullName: String(r.full_name || ''),
        owner: r.owner && r.owner.login ? String(r.owner.login) : '',
        private: r.private === true,
        archived: r.archived === true,
        fork: r.fork === true,
        description: r.description ? String(r.description) : '',
        homepage: r.homepage ? String(r.homepage) : '',
        defaultBranch: r.default_branch ? String(r.default_branch) : '',
        url: r.html_url ? String(r.html_url) : '',
        updatedAt: r.updated_at ? String(r.updated_at) : '',
        pushedAt: r.pushed_at ? String(r.pushed_at) : '',
        hasIssues: r.has_issues !== false,
        hasWiki: r.has_wiki === true,
        topics: Array.isArray(r.topics) ? r.topics.map(function (t) { return String(t) }) : [],
      }
    }

    /**
     * 从响应头判断令牌类型与权限。
     * classic 令牌会带 x-oauth-scopes；fine-grained 令牌没有这个头。
     */
    function tokenInfo(headers) {
      const scopes = headers && headers['x-oauth-scopes'] !== undefined ? String(headers['x-oauth-scopes']) : ''
      const expires = headers && headers['github-authentication-token-expiration']
        ? String(headers['github-authentication-token-expiration'])
        : ''
      return { kind: scopes ? 'classic' : 'fine-grained', scopes: scopes, expires: expires }
    }

    /** 根据令牌类型给出「为什么可能看不到仓库」的提示。 */
    function tokenHint(meta, lang) {
      if (!meta) return ''
      if (meta.kind === 'classic') {
        const s = meta.scopes
        if (!s) return tr(lang, 'hintClassicNone')
        if (s.indexOf('repo') === -1 && s.indexOf('public_repo') === -1) return tr(lang, 'hintClassicNoRepo')
        if (s.indexOf('repo') === -1) return tr(lang, 'hintClassicPublicOnly')
        return tr(lang, 'hintClassicOk')
      }
      return tr(lang, 'hintFine')
    }

    // ── 仓库枚举 ──────────────────────────────────────────────────

    /**
     * 汇总三处来源：账号可见仓库（owner + collaborator + 组织成员）、
     * 所在组织的仓库、以及（列表为空时的）公开仓库兜底。
     * 返回按最近推送排序的去重结果 + 每个来源的命中统计，便于排障。
     */
    async function collectRepos(lang) {
      const out = []
      const seen = {}
      const diag = []

      /** 去重合并并返回新增条数；diag 行由调用方自己拼（因为文案要带来源名）。 */
      function add(list) {
        let n = 0
        if (Array.isArray(list)) {
          for (let i = 0; i < list.length; i++) {
            const t = trimRepo(list[i])
            if (!t || !t.fullName) continue
            const key = t.fullName.toLowerCase()
            if (seen[key]) continue
            seen[key] = true
            out.push(t)
            n++
          }
        }
        return n
      }

      // 1) 账号可见仓库
      try {
        const mine = await ghOk('GET', '/user/repos?per_page=100&sort=pushed&direction=desc'
          + '&affiliation=owner,collaborator,organization_member&visibility=all', undefined, undefined, lang)
        diag.push(tr(lang, 'diagMine', add(mine)))
      } catch (e) {
        diag.push(tr(lang, 'diagMineFail', String(e && e.message ? e.message : e)))
      }

      // 2) 组织的仓库（affiliation 在部分令牌下覆盖不到）
      const orgLogins = []
      try {
        const orgs = await ghOk('GET', '/user/orgs?per_page=100', undefined, undefined, lang)
        if (Array.isArray(orgs)) {
          for (let i = 0; i < orgs.length && orgLogins.length < 15; i++) {
            if (orgs[i] && orgs[i].login) orgLogins.push(String(orgs[i].login))
          }
        }
        if (!orgLogins.length) diag.push(tr(lang, 'diagOrgNone'))
      } catch (e) {
        diag.push(tr(lang, 'diagOrgFail', String(e && e.message ? e.message : e)))
      }
      if (orgLogins.length) {
        try {
          const paths = orgLogins.map(function (n) {
            return '/orgs/' + encodeURIComponent(n) + '/repos?per_page=100&sort=pushed&direction=desc&type=all'
          })
          const results = await ghBatch(paths, lang)
          for (let i = 0; i < results.length; i++) {
            const r = results[i]
            if (!r || r.status >= 400 || !Array.isArray(r.json)) {
              diag.push(tr(lang, 'diagOrgRepoFail', orgLogins[i], r ? r.status : 0))
              continue
            }
            diag.push(tr(lang, 'diagOrgRepo', orgLogins[i], add(r.json)))
          }
        } catch (e) {
          diag.push(tr(lang, 'diagOrgBatchFail', String(e && e.message ? e.message : e)))
        }
      }

      // 3) 兜底：公开仓库。仅在前两步都没有结果时执行。
      if (!out.length && user && user.login) {
        try {
          const pub = await ghOk('GET', '/users/' + encodeURIComponent(user.login) + '/repos?per_page=100&sort=pushed&direction=desc', undefined, undefined, lang)
          diag.push(tr(lang, 'diagPublic', add(pub)))
        } catch (e) {
          diag.push(tr(lang, 'diagPublicFail', String(e && e.message ? e.message : e)))
        }
      }

      out.sort(function (a, b) {
        const x = a.pushedAt || a.updatedAt
        const y = b.pushedAt || b.updatedAt
        return x < y ? 1 : x > y ? -1 : 0
      })
      return { repos: out, diag: diag }
    }

    // ── 忽略规则 ──────────────────────────────────────────────────
    //
    // 目录名分两档，因为「跳过」和「默认不勾」是两种不同的语义：
    //   HARD：依赖/缓存目录，体积巨大且几乎不可能需要上传 —— 整棵不下钻，
    //         因此它们的文件不会出现在文件列表里（但会在 prunedDirs 里报出来）。
    //   SOFT：构建产物目录，体积可控且有时确实要上传（比如 build/ 里放着构建脚本）
    //         —— 照常下钻、照常出现在列表里，只是默认不勾选。
    const HARD_IGNORED_DIRS = ['.git', '.hg', '.svn', 'node_modules', 'bower_components',
      'jspm_packages', '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache',
      '.ruff_cache', '.cache', '.parcel-cache', '.next', '.nuxt', '.turbo', '.svelte-kit',
      '.idea', '.vscode', '.vs', '.gradle', '.dart_tool', '.terraform', '.tox', '.sass-cache',
      'coverage', '.nyc_output']
    const SOFT_IGNORED_DIRS = ['dist', 'build', 'out', 'target', 'bin', 'obj', 'release', 'debug', '.output']
    const DEFAULT_IGNORED_FILES = ['.DS_Store', 'Thumbs.db', 'desktop.ini', 'npm-debug.log', 'yarn-error.log', 'pnpm-debug.log']
    const DEFAULT_IGNORED_EXT = ['.log', '.tmp', '.pyc', '.pyo', '.class', '.swp', '.swo']

    function globToRegExp(pattern) {
      let p = pattern
      const anchored = p.charAt(0) === '/'
      if (anchored) p = p.slice(1)
      let re = ''
      for (let i = 0; i < p.length; i++) {
        const ch = p.charAt(i)
        if (ch === '*') {
          if (p.charAt(i + 1) === '*') {
            re += '.*'
            i++
            if (p.charAt(i + 1) === '/') i++
          } else {
            re += '[^/]*'
          }
        } else if (ch === '?') {
          re += '[^/]'
        } else if (REGEX_SPECIAL.indexOf(ch) !== -1) {
          re += BS + ch
        } else {
          re += ch
        }
      }
      const hasSlash = p.indexOf('/') !== -1
      if (anchored || hasSlash) return new RegExp('^' + re + '(/.*)?$')
      return new RegExp('(^|/)' + re + '(/.*)?$')
    }

    /** .gitignore 的简化实现：支持注释、! 取反、尾随 /、** 与 * 通配。 */
    function parseGitignore(text) {
      const rules = []
      const lines = String(text).split('\n')
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i]
        if (line.charAt(line.length - 1) === CR) line = line.slice(0, -1)
        if (line.charAt(0) === '#') continue
        line = line.trim()
        if (!line) continue
        let negate = false
        if (line.charAt(0) === '!') { negate = true; line = line.slice(1) }
        if (!line) continue
        if (line.charAt(line.length - 1) === '/') line = line.slice(0, -1)
        if (!line) continue
        try {
          rules.push({ re: globToRegExp(line), negate: negate })
        } catch (e) { /* 跳过写错的花式 pattern */ }
      }
      return rules
    }

    /** 最后一条命中的 .gitignore 规则生效（与 git 的「后者覆盖前者」一致）。 */
    function matchRule(relPath, rules) {
      let hit = null
      for (let i = 0; i < rules.length; i++) {
        if (rules[i].re.test(relPath)) hit = rules[i]
      }
      return hit
    }

    /** 目录判定。prune=整棵跳过；ignored=默认不勾但仍在列表里。 */
    function dirDecision(relPath, name, rules, lang) {
      for (let i = 0; i < HARD_IGNORED_DIRS.length; i++) {
        if (name === HARD_IGNORED_DIRS[i]) {
          return { prune: true, ignored: true, reason: tr(lang, 'igDep', name) }
        }
      }
      let ignored = false
      let reason = ''
      for (let i = 0; i < SOFT_IGNORED_DIRS.length; i++) {
        if (name === SOFT_IGNORED_DIRS[i]) { ignored = true; reason = tr(lang, 'igBuild', name); break }
      }
      const hit = matchRule(relPath, rules)
      if (hit !== null) {
        ignored = !hit.negate
        reason = ignored ? tr(lang, 'igGitignore') : ''
      }
      return { prune: false, ignored: ignored, reason: reason }
    }

    /**
     * 文件判定。
     * matched 表示有 .gitignore 规则显式命中该文件（哪怕是否定规则）—— 这时就不再继承
     * 父目录的忽略状态，否则 `!keep.txt` 这类取反规则永远没机会生效。
     */
    function fileDecision(relPath, name, rules, lang) {
      let ignored = false
      let reason = ''
      for (let i = 0; i < DEFAULT_IGNORED_FILES.length; i++) {
        if (name === DEFAULT_IGNORED_FILES[i]) { ignored = true; reason = tr(lang, 'igBuiltin', name); break }
      }
      if (!ignored) {
        const dot = name.lastIndexOf('.')
        if (dot > 0) {
          const ext = name.slice(dot).toLowerCase()
          for (let i = 0; i < DEFAULT_IGNORED_EXT.length; i++) {
            if (ext === DEFAULT_IGNORED_EXT[i]) { ignored = true; reason = tr(lang, 'igBuiltin', ext); break }
          }
        }
      }
      const hit = matchRule(relPath, rules)
      if (hit !== null) {
        ignored = !hit.negate
        reason = ignored ? tr(lang, 'igGitignore') : ''
      }
      return { ignored: ignored, reason: reason, matched: hit !== null }
    }

    async function scanProject(dir, useGitignore, lang) {
      if (typeof dir !== 'string' || !dir.trim()) throw new Error(tr(lang, 'dirEmpty'))
      const root = dir.trim()
      const rootTarget = await fsx.resolve(root)
      const info = await fsx.stat(rootTarget)
      if (!info) throw new Error(tr(lang, 'dirMissing', root))
      if (info.type !== 'directory') throw new Error(tr(lang, 'dirNotDir', root))

      let rules = []
      if (useGitignore !== false) {
        try {
          const gi = await fsx.resolve('.gitignore', { cwd: root })
          const st = await fsx.stat(gi)
          if (st && st.type === 'file') rules = parseGitignore(await fsx.readText(gi))
        } catch (e) { rules = [] }
      }

      const files = []
      const prunedDirs = []
      let prunedCount = 0
      let truncated = false
      async function walk(target, rel, inheritedReason) {
        if (files.length >= MAX_SCAN_FILES) { truncated = true; return }
        let entries
        try { entries = await fsx.listDir(target) } catch (e) { return }
        for (let i = 0; i < entries.length; i++) {
          if (files.length >= MAX_SCAN_FILES) { truncated = true; return }
          const e = entries[i]
          const childRel = rel ? rel + '/' + e.name : e.name
          if (e.type === 'directory') {
            const dd = dirDecision(childRel, e.name, rules, lang)
            if (dd.prune) {
              prunedCount++
              if (prunedDirs.length < 40) prunedDirs.push(childRel)
              continue
            }
            await walk(e.target, childRel, dd.ignored ? dd.reason : '')
          } else if (e.type === 'file') {
            const fd = fileDecision(childRel, e.name, rules, lang)
            const size = typeof e.size === 'number' ? e.size : 0
            const tooBig = size > MAX_FILE_BYTES
            let ignored = fd.ignored
            let reason = fd.reason
            // 没有 .gitignore 规则显式命中时，继承父目录的忽略状态（比如 dist/ 下的文件）。
            if (!ignored && !fd.matched && inheritedReason) { ignored = true; reason = inheritedReason }
            if (tooBig) { ignored = true; reason = tr(lang, 'igTooBig', size) }
            files.push({
              path: childRel,
              size: size,
              ignored: ignored,
              reason: reason,
            })
          }
        }
      }
      await walk(rootTarget, '', '')

      files.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0 })
      let total = 0
      for (let i = 0; i < files.length; i++) total += files[i].size
      return {
        root: root,
        files: files,
        totalSize: total,
        truncated: truncated,
        gitignore: rules.length,
        prunedDirs: prunedDirs,
        prunedCount: prunedCount,
      }
    }

    // ── 目录选择 ──────────────────────────────────────────────────
    //
    // 优先用宿主自带的 ctx.directoryPicker：
    //   native -> 直接弹系统文件夹对话框，一次点击拿到绝对路径（本机部署走这条）
    //   browse -> 提供 list/createDirectory 原语，由前端自己画文件浏览器（远程部署走这条）
    // 两者都没有时退回用 fs 自己列目录，保证「选文件夹」这个功能不会彻底消失。

    let pickerCap = null
    let pickerKind = 'none'

    /**
     * 取目录选择器能力。capability 对象在服务生命周期内稳定，拿到后可以缓存。
     *
     * ⚠️ 服务本身**必须每次惰性获取**：`ctx.get('directoryPicker')` 在 apply() 那一刻
     * 可能还没注册（后端插件后加载），取一次就永久是 undefined，
     * 于是「弹系统文件夹对话框」的能力被静默丢掉，用户怎么点都没反应。
     * 只有"确认拿到能力"或"确认拿到服务但能力不认"时才缓存结果。
     */
    function pickerService() {
      try {
        if (typeof dp !== 'undefined' && dp) return dp
        return ctx.get('directoryPicker')
      } catch (e) { return undefined }
    }

    function pickerCapability() {
      if (pickerCap !== null) return pickerCap
      const svc = pickerService()
      if (!svc || typeof svc.capability !== 'function') {
        // 服务还没就绪：**不缓存**这个否定结论，下次调用再问一遍
        pickerKind = 'none'
        return false
      }
      try {
        const cap = svc.capability()
        if (cap && (cap.kind === 'native' || cap.kind === 'browse')) {
          pickerCap = cap
          pickerKind = cap.kind
          return cap
        }
      } catch (e) {
        console.error('[dsh-github-upload] 读取 directoryPicker 能力失败', e)
      }
      // 服务在、但能力形状不认识：这是稳定事实，可以缓存
      pickerCap = false
      pickerKind = 'none'
      return false
    }

    /**
     * 原生选择器需要一个 AbortSignal，但动态沙箱里没有 AbortController。
     * 实现只用到 aborted / addEventListener / removeEventListener，所以给个鸭子类型即可
     * —— 从不主动中止：对话框关闭就是用户的选择。
     */
    function inertSignal() {
      return {
        aborted: false,
        reason: undefined,
        onabort: null,
        addEventListener: function () { /* 永不触发 */ },
        removeEventListener: function () { /* 无需移除 */ },
        dispatchEvent: function () { return true },
        throwIfAborted: function () { /* 永不抛出 */ },
      }
    }

    function splitPath(p) {
      const out = []
      let cur = ''
      for (let i = 0; i < p.length; i++) {
        const ch = p.charAt(i)
        if (ch === '/' || ch === BS) {
          if (cur) { out.push(cur); cur = '' }
        } else {
          cur += ch
        }
      }
      if (cur) out.push(cur)
      return out
    }

    /** 可跳转的根：Windows 下枚举真实存在的盘符，其他平台就是 /。 */
    async function rootsList() {
      const out = []
      const probe = await baseCwd()
      if (probe.indexOf(':') !== -1) {
        const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'
        for (let i = 0; i < letters.length; i++) {
          const p = letters.charAt(i) + ':/'
          try {
            const st = await fsx.stat(await fsx.resolve(p))
            if (st && st.type === 'directory') out.push({ name: letters.charAt(i) + ':', path: p })
          } catch (e) { /* 该盘符不存在 */ }
        }
      } else {
        out.push({ name: '/', path: '/' })
      }
      return out
    }

    /** 把 directoryPicker 的 DirectoryListing 裁成前端要的几个字段。 */
    function trimListing(l) {
      const crumbs = []
      if (Array.isArray(l.crumbs)) {
        for (let i = 0; i < l.crumbs.length; i++) {
          const c = l.crumbs[i]
          if (c && typeof c.path === 'string') crumbs.push({ name: String(c.name || c.path), path: String(c.path) })
        }
      }
      const entries = []
      if (Array.isArray(l.entries)) {
        for (let i = 0; i < l.entries.length; i++) {
          const e = l.entries[i]
          if (e && typeof e.path === 'string') {
            entries.push({ name: String(e.name || ''), path: String(e.path), hidden: e.hidden === true })
          }
        }
      }
      return {
        path: String(l.path || ''),
        home: l.home ? String(l.home) : '',
        crumbs: crumbs,
        entries: entries,
        truncated: l.truncated === true,
      }
    }

    /**
     * 统一路径分隔符为 `/`。
     *
     * 为什么必须做：宿主的 `fsx.processPath()` 在 Windows 上返回**反斜杠**形式
     * （`D:\dsh plugins\x`），而菜单 / 面包屑 / 子项路径一律用 `/` 拼（`abs + '/' + name`）。
     * 否则同一个响应里 `path` 是反斜杠、`entries[].path` 变成"反斜杠 + 正斜杠"的混合体，
     * 会让任何基于字符串比较的地方（去重、判断是不是同一目录）出错。
     * 前端本来写的就是 `/`，所以这里统一成 `/`。
     */
    function toSlashes(p) {
      return String(p || '').replace(/\\/g, '/')
    }

    /**
     * 同一个根目录的另一种合法写法：`D:/` ⇄ `D:\`。
     * 只处理"盘符根 + 分隔符"这一种情况，不做别的猜测 ——
     * 目的是在宿主 fs 服务对某一种写法挑剔时，留一次重试的机会。
     */
    function alternateRootForm(p) {
      const s = String(p || '')
      if (/^[A-Za-z]:[\\/]$/.test(s)) {
        const useBackslash = s.charAt(2) === '/'
        return s.slice(0, 2) + (useBackslash ? BS : '/')
      }
      return ''
    }

    /**
     * 没有 browse 能力时的兜底：直接用 fs 列出一层子目录，并自己拼面包屑。
     *
     * **逐项容错**：Windows 上 `D:\System Volume Information`、`D:\WindowsApps` 这类目录
     * 会直接 `permission denied`。因此逐个探测，读不了的标记 `unreadable` 并**照常返回列表**，
     * 由界面显示成不可进入的条目 —— 一个目录读不了不能让整个列表抛错。
     */
    async function fsListing(pathArg, lang) {
      const base = String(pathArg || '').trim() || await baseCwd()
      const target = await fsx.resolve(base)
      const info = await fsx.stat(target)
      if (!info || info.type !== 'directory') throw new Error(tr(lang, 'dirUnreadable', base))
      let abs = toSlashes(base)
      let children = []
      try {
        const read = await fsx.listDir(target)
        abs = toSlashes(fsx.processPath(target))
        children = Array.isArray(read) ? read : []
      } catch (e) {
        const first = String(e && e.message ? e.message : e)
        // 换一种写法再试一次：`D:/` 与 `D:\` 在宿主 fs 服务里未必等价，
        // 而 Windows 上这两种写法都是合法的根目录表示。只在这两种之间切换，不做别的猜测。
        const alt = alternateRootForm(base)
        if (alt) {
          try {
            const t2 = await fsx.resolve(alt)
            const read2 = await fsx.listDir(t2)
            abs = toSlashes(fsx.processPath(t2))
            children = Array.isArray(read2) ? read2 : []
            diag('list-dirs:root-form-alternate', base + ' -> ' + alt)
          } catch (e2) {
            diag('list-dirs:both-root-forms-failed', base + ' :: ' + first + ' :: ' + String(e2 && e2.message ? e2.message : e2))
            throw new Error(tr(lang, 'dirUnreadable', base + '（' + first + '）'))
          }
        } else {
          // 连这一层自己都读不了（例如点进 System Volume Information）→ 这才是真错误
          throw new Error(tr(lang, 'dirUnreadable', base + '（' + first + '）'))
        }
      }

      const dirEntries = []
      for (let i = 0; i < children.length; i++) {
        const c = children[i]
        if (c && c.type === 'directory') dirEntries.push(c)
      }
      // 并发探测每个子目录：能 stat 通的就是可进入的，报错的标记为 unreadable。
      const probed = await Promise.all(dirEntries.map(async function (c) {
        const name = String(c.name)
        const path = abs + '/' + name
        let ok = true
        let reason = ''
        try {
          const st = await fsx.stat(await fsx.resolve(path))
          if (!st || st.type !== 'directory') ok = false
        } catch (e) {
          ok = false
          reason = String(e && e.message ? e.message : e)
        }
        return { name: name, path: path, hidden: name.charAt(0) === '.', unreadable: !ok, reason: ok ? '' : reason }
      }))

      const entries = probed
      const blocked = entries.filter(function (e) { return e.unreadable })
      entries.sort(function (a, b) {
        if (a.unreadable !== b.unreadable) return a.unreadable ? 1 : -1
        return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
      })

      const segs = splitPath(abs)
      const crumbs = []
      let acc = ''
      for (let i = 0; i < segs.length; i++) {
        if (i === 0 && segs[i].length === 2 && segs[i].charAt(1) === ':') {
          acc = segs[i] + '/'
          crumbs.push({ name: segs[i], path: acc })
        } else {
          acc = acc === '/' ? '/' + segs[i] : acc + (acc.charAt(acc.length - 1) === '/' ? '' : '/') + segs[i]
          crumbs.push({ name: segs[i], path: acc })
        }
      }
      return {
        path: abs,
        home: await baseCwd(),
        crumbs: crumbs,
        entries: entries,
        truncated: false,
        blockedCount: blocked.length,
        blockedNames: blocked.slice(0, 5).map(function (e) { return e.name }),
      }
    }

    /**
     * 统一入口：拿一层目录列表。
     *
     * 这里必须容错两层：
     *   · 宿主的 `directoryPicker`（browse 后端）自己会抛错 —— 例如列 `D:\` 时它内部撞上
     *     `System Volume Information` 的 permission denied（本机实测）。它抛错也得能列，
     *     所以失败就**退回用 fs 列**（`fsListing` 已经逐项容错）；
     *   · `fsListing` 只有在"当前这一层自己读不了"时才抛错，那种情况照旧报给用户。
     */
    async function listDirectories(pathArg, lang) {
      const cap = pickerCapability()
      diag('list-dirs:enter', 'path=' + String(pathArg) + ' picker=' + pickerKind + ' cap=' + (cap ? cap.kind : 'none'))
      if (cap && cap.kind === 'browse') {
        try {
          const listing = trimListing(await cap.list(pathArg || undefined))
          // 宿主列表可能不带 unreadable 标记；统一补上，界面才能一致地处理受限目录
          const entries = Array.isArray(listing.entries) ? listing.entries : []
          for (let i = 0; i < entries.length; i++) {
            if (entries[i].unreadable === undefined) entries[i].unreadable = false
          }
          diag('list-dirs:picker-ok', 'path=' + String(pathArg) + ' entries=' + entries.length)
          return listing
        } catch (e) {
          // 宿主选择器失败（权限、后端异常…）→ 用自己的 fs 列，别让整个"选择文件夹"不可用
          diag('list-dirs:picker-FAILED', 'path=' + String(pathArg) + ' :: ' + String(e && e.message ? e.message : e))
          console.error('[dsh-github-upload] directoryPicker.list 失败，改用 fs 兜底：', String(e && e.message ? e.message : e))
          try {
            const fallback = await fsListing(pathArg, lang)
            fallback.fallbackFrom = 'directoryPicker'
            fallback.fallbackReason = String(e && e.message ? e.message : e)
            diag('list-dirs:fs-fallback-ok', 'path=' + String(pathArg) + ' entries=' + (fallback.entries || []).length)
            return fallback
          } catch (e2) {
            // 连 fs 也读不了这一层 → 这才是真的不可读。
            // 两个错误都要记下来：宿主的失败原因 + fs 失败的原因，否则没法定位到底卡在哪。
            diag('list-dirs:fs-fallback-FAILED', 'path=' + String(pathArg) +
              ' :: picker=' + String(e && e.message ? e.message : e) +
              ' :: fs=' + String(e2 && e2.stack ? e2.stack : e2))
            throw new Error(tr(lang, 'dirUnreadable', String(pathArg || '') +
              '（宿主选择器：' + String(e && e.message ? e.message : e) +
              '；本机文件系统：' + String(e2 && e2.message ? e2.message : e2) + '）'))
          }
        }
      }
      try {
        const r = await fsListing(pathArg, lang)
        diag('list-dirs:fs-ok', 'path=' + String(pathArg) + ' entries=' + (r.entries || []).length)
        return r
      } catch (e) {
        diag('list-dirs:fs-FAILED', 'path=' + String(pathArg) + ' :: ' + String(e && e.stack ? e.stack : e))
        throw e
      }
    }

    /**
     * 列一层目录，**失败也要能让人走回去**。
     *
     * DSH 的 fs 服务**拒绝列盘符根目录**（Windows 上 `D:/` 会报
     * `cannot list "D:\System Volume Information": permission denied`），
     * 但其下的**子目录是能列的** —— 而根目录恰是用户最可能看到的起点。
     *
     * 所以：
     *   · `landing=true`（界面自动落到某个起点）时，如果这个起点列不动，**自动改到能列的目录**
     *     （优先项目目录/工作区），并把这件事写在 `fallbackNote` 里 —— 用户拿到的是可用的界面，
     *     而不是一张死页；
     *   · `landing=false`（用户主动点进某个目录）时，如实返回 `error` + 导航出口。
     */
    async function listDirectoriesSafe(pathArg, lang, landing, hint) {
      try {
        return await listDirectories(pathArg, lang)
      } catch (e) {
        return await recoverListing(e, pathArg, lang, landing, hint)
      }
    }

    async function recoverListing(err, pathArg, lang, landing, hint) {
      const msg = String(err && err.message ? err.message : err)
      diag('list-dirs:safe-catch', 'path=' + String(pathArg) + ' landing=' + (landing === true) + ' :: ' + msg)
      const base = { path: String(pathArg || ''), home: '', crumbs: [], entries: [], truncated: false }

      if (landing === true) {
        // 起点列不动 → 换成能列的目录，别让用户面对一张死页
        const candidates = []
        if (hint) candidates.push(String(hint))
        try { candidates.push(await baseCwd()) } catch (e2) { /* ignore */ }
        for (let i = 0; i < candidates.length; i++) {
          const c = candidates[i].trim()
          if (!c || c === String(pathArg)) continue
          try {
            const alt = await listDirectories(c, lang)
            diag('list-dirs:landing-recovered', String(pathArg) + ' -> ' + c)
            alt.fallbackNote = tr(lang, 'pickFallback', String(pathArg), c)
            return alt
          } catch (e3) { /* 试下一个候选 */ }
        }
      }

      // 走不下去：返回错误 + 所有还能用的出口
      let roots = []
      let home = ''
      try { roots = await rootsList() } catch (e4) { /* ignore */ }
      try { home = await baseCwd() } catch (e5) { /* ignore */ }
      const cap = pickerCapability()
      return Object.assign(base, {
        home: home,
        error: msg,
        roots: roots,
        canRetryNative: !!(cap && cap.kind === 'native'),
        canCreate: !!(cap && cap.kind === 'browse'),
      })
    }
    let dirHint = ''
    function S_dir_hint() { return dirHint }

    // ── 会话文件识别 ──────────────────────────────────────────────
    //
    // DSH 的会话日志里每个 `tool/call` 都带 name 和 arguments（JSON 字符串），
    // 从中可以还原「这次聊天里写过/改过哪些文件」。语义与客户端 ui-deliverables 的
    // produced-files 一致：写入/修改才算「产出」，read 只作为参考强度更低的一档。

    const TOOL_ACTION = {
      write: { action: 'written', rank: 4 },
      edit: { action: 'edited', rank: 3 },
      read: { action: 'read', rank: 2 },
      grep: { action: 'searched', rank: 1 },
      glob: { action: 'searched', rank: 1 },
    }

    /** 归一化路径用于比较：转正斜杠、转小写、去掉尾部分隔符。 */
    function normPath(p) {
      const s = String(p === undefined || p === null ? '' : p)
      let out = ''
      for (let i = 0; i < s.length; i++) {
        const ch = s.charAt(i)
        out += ch === BS ? '/' : ch
      }
      out = out.toLowerCase()
      while (out.length > 1 && out.charAt(out.length - 1) === '/') out = out.slice(0, -1)
      return out
    }

    /** 拆路径段（同时认 / 和 \）。 */
    function pathSegments(p) {
      const out = []
      let cur = ''
      for (let i = 0; i < p.length; i++) {
        const ch = p.charAt(i)
        if (ch === BS || ch === '/') {
          if (cur) { out.push(cur); cur = '' }
        } else {
          cur += ch
        }
      }
      if (cur) out.push(cur)
      return out
    }

    /** 看起来是绝对路径吗（盘符或根开头）？相对路径会污染公共祖先，直接跳过。 */
    function looksAbsolute(p) {
      if (!p) return false
      if (p.charAt(0) === '/' || p.charAt(0) === BS) return true
      return p.length > 2 && p.charAt(1) === ':' && (p.charAt(2) === BS || p.charAt(2) === '/')
    }

    /**
     * 一批文件路径的最深公共目录 —— 也就是「这个项目在哪」。
     * 只有公共前缀至少到「根 + 一层目录」才算项目目录，否则返回空串，
     * 由调用方退回会话的 cwd（避免跨盘时把 C:\ 这种根当成项目）。
     */
    function commonDirOf(paths) {
      if (!paths.length) return ''
      const first = pathSegments(paths[0])
      const sep = paths[0].indexOf(BS) !== -1 ? BS : '/'
      let n = first.length
      for (let i = 1; i < paths.length; i++) {
        const segs = pathSegments(paths[i])
        let k = 0
        while (k < n && k < segs.length && segs[k].toLowerCase() === first[k].toLowerCase()) k++
        n = Math.min(n, k)
        if (n === 0) return ''
      }
      // 只有一个文件（或路径完全相同）时，最后一段是文件名，退一层
      while (n > 0 && n >= first.length) n--
      if (n < 2) return ''
      return first.slice(0, n).join(sep)
    }

    /**
     * 找出「当前聊天」动过的文件，并据此推断项目目录。
     *
     * 会话选择：
     *   - 给了 dir：按 header.cwd 与它匹配优先，取创建时间最新的；
     *   - 没给 dir（前端刚打开、还没选文件夹）：优先「活着的」会话（ctx.sessions 里的，
     *     也就是当前这次聊天），再取最新的 —— 这样不用先选目录就能识别项目。
     * 项目根推断：给了 dir 就用它；否则取被写入/修改文件的最深公共目录；
     * 公共目录太浅（跨盘）时退回该会话的 cwd。
     */
    async function sessionFileActivity(dir, lang) {
      const sessionQuery = svc('sessionQuery')
      if (sessionQuery === undefined) {
        return { available: false, message: tr(lang, 'sessionUnavailable'), files: [] }
      }
      let records = []
      try {
        records = await sessionQuery.listSessions()
      } catch (e) { records = [] }
      if (!Array.isArray(records)) records = []

      const givenRoot = normPath(dir)
      const candidates = []
      for (let i = 0; i < records.length; i++) {
        const rec = records[i]
        const h = rec && rec.header ? rec.header : null
        if (!h || !h.id) continue
        const rawCwd = String(h.cwd || '')
        const cwd = normPath(rawCwd)
        const matches = cwd !== '' && givenRoot !== ''
          && (cwd === givenRoot || givenRoot.indexOf(cwd + '/') === 0 || cwd.indexOf(givenRoot + '/') === 0)
        candidates.push({
          id: String(h.id),
          cwd: cwd,
          rawCwd: rawCwd,
          createdAt: typeof h.createdAt === 'number' ? h.createdAt : 0,
          live: rec.live === true,
          matches: matches,
        })
      }
      if (!candidates.length) {
        return { available: true, message: tr(lang, 'sessionNone'), files: [] }
      }

      let pool
      let chosenBy
      if (givenRoot) {
        const matching = candidates.filter(function (c) { return c.matches })
        pool = matching.length ? matching : candidates
        chosenBy = matching.length ? 'cwd' : 'newest'
      } else {
        const liveOnes = candidates.filter(function (c) { return c.live })
        pool = liveOnes.length ? liveOnes : candidates
        chosenBy = liveOnes.length ? 'live' : 'newest'
      }
      pool.sort(function (a, b) { return b.createdAt - a.createdAt })
      const chosen = pool[0]

      let title = ''
      try {
        const snap = await sessionQuery.readTitle(chosen.id)
        if (snap && typeof snap.title === 'string') title = snap.title
        else if (snap && typeof snap.text === 'string') title = snap.text
      } catch (e) { title = '' }

      let events = []
      try {
        const log = await sessionQuery.readSession(chosen.id)
        events = log && Array.isArray(log.events) ? log.events : []
      } catch (e) { events = [] }

      // 第一遍：把工具调用还原成 (绝对路径, 动作) 列表
      const touched = []
      const mutatedAbs = []
      const counts = { written: 0, edited: 0, read: 0, searched: 0 }
      let toolCalls = 0
      for (let i = 0; i < events.length; i++) {
        const ev = events[i]
        if (!ev || ev.type !== 'tool/call' || !ev.data) continue
        toolCalls++
        const spec = TOOL_ACTION[String(ev.data.name || '')]
        if (!spec) continue
        let abs = ''
        try {
          const parsed = JSON.parse(String(ev.data.arguments || '{}'))
          if (parsed && typeof parsed.file_path === 'string') abs = parsed.file_path
          else if (parsed && typeof parsed.path === 'string') abs = parsed.path
        } catch (e) { abs = '' }
        if (!abs || !looksAbsolute(abs)) continue
        touched.push({ abs: abs, norm: normPath(abs), action: spec.action, rank: spec.rank })
        if (spec.action === 'written' || spec.action === 'edited') mutatedAbs.push(abs)
      }

      // 第二遍：定项目根，再算相对路径
      let rootRaw = ''
      let rootSource = 'none'
      let root = ''
      if (givenRoot) {
        rootRaw = String(dir || '').trim()
        root = givenRoot
        rootSource = 'given'
      } else {
        const guess = commonDirOf(mutatedAbs)
        if (guess) {
          rootRaw = guess
          root = normPath(guess)
          rootSource = 'files'
        } else if (chosen.rawCwd) {
          rootRaw = chosen.rawCwd
          root = chosen.cwd
          rootSource = 'cwd'
        }
      }

      const session = {
        id: chosen.id,
        cwd: chosen.cwd,
        rawCwd: chosen.rawCwd,
        title: title,
        matched: chosen.matches,
        chosenBy: chosenBy,
        live: chosen.live,
        sessions: candidates.length,
      }
      if (!root) {
        return {
          available: true, session: session, counts: counts,
          projectRoot: '', rootSource: 'none',
          message: tr(lang, 'sessionNoRoot', title || chosen.id),
          files: [],
        }
      }

      const best = {}
      let outside = 0
      for (let i = 0; i < touched.length; i++) {
        const t = touched[i]
        if (t.norm === root) continue
        if (t.norm.indexOf(root + '/') !== 0) { outside++; continue }
        const relative = t.norm.slice(root.length + 1)
        if (!relative) continue
        const prev = best[relative]
        if (prev === undefined || t.rank > prev.rank) best[relative] = { action: t.action, rank: t.rank }
      }

      const files = []
      const keys = Object.keys(best)
      for (let i = 0; i < keys.length; i++) {
        const action = best[keys[i]].action
        if (counts[action] !== undefined) counts[action]++
        files.push({ path: keys[i], action: action })
      }
      files.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0 })

      if (!files.length) {
        return {
          available: true, session: session, counts: counts,
          projectRoot: rootRaw, rootSource: rootSource,
          message: tr(lang, 'sessionNoFiles', title || chosen.id),
          files: [],
        }
      }
      return {
        available: true,
        session: session,
        counts: counts,
        inside: files.length,
        outside: outside,
        toolCalls: toolCalls,
        projectRoot: rootRaw,
        rootSource: rootSource,
        files: files,
      }
    }

    // ── 编码 ──────────────────────────────────────────────────────

    /**
     * 计算文件的 git blob SHA-1（`sha1("blob <size>\0" + content)`）。
     *
     * 为什么要自己算：GitHub 的 tree 接口**直接给出每个 blob 的 sha 和 size**，
     * 所以只要能算出本地文件的同一个 sha，就能**不发任何额外请求**地判断
     * "这个文件相对远程到底改了没有" —— 比按修改时间猜可靠得多，也是"上传未更新的改动"
     * 这个功能的基础。SHA-1 是 git 的对象格式要求，不是拿来做安全用途。
     */
    function gitBlobSha(bytes) {
      const header = 'blob ' + bytes.length + '\u0000'
      // Buffer 与 Uint8Array 共用底层内存，但 Buffer.isBuffer 之外的类型没有 .buffer 时
      // 必须退回数组本身 —— 否则从子进程或 TextEncoder 拿到的是 Uint8Array，长度会算错。
      const view = Buffer.isBuffer(bytes)
        ? bytes
        : Buffer.from(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.length)
      const h = createHash('sha1')
      h.update(header, 'utf8')
      h.update(view)
      return h.digest('hex')
    }

    /**
     * 列出「本地与远程分支不一致、也就是还没上传（或上传后又被改过）」的文件。
     *
     * 这是用户真正想要的语义：跨多轮对话累计的改动，而不是只看当前这一轮会话日志。
     * 判定完全基于内容，不需要用户在 DSH 之外做任何事：
     *   1. 读远程分支的 head → 拿它的 tree（`recursive=1`，**只此一次请求**）；
     *   2. 逐文件比对：远程没有 → 新增；大小不同 → 已改；大小相同但 sha 不同 → 已改；
     *      sha 相同 → 未改（跳过）。
     * 因为 tree 自带 sha，绝大多数文件不需要再发请求；只有"需要算本地 sha"时才读盘。
     * `deep` 打开时对**所有**文件都算 sha（连同样大小的也算），代价是慢一些但结论最准。
     */
    async function pendingChanges(owner, repo, dir, branchArg, deep, lang) {
      if (!owner || !repo) throw new Error(tr(lang, 'needRepo'))
      if (typeof dir !== 'string' || !dir.trim()) throw new Error(tr(lang, 'dirEmpty'))

      const info = await ghOk('GET', '/repos/' + owner + '/' + repo, undefined, undefined, lang)
      const branch = String(branchArg || '').trim()
        || String(info.default_branch || '').trim() || 'main'

      // 本地扫描结果（沿用同一套忽略规则，保证和上传列表一致）
      const scan = await scanProject(dir, true, lang)

      // 远程树：仓库为空或分支不存在时视为"全都要上传"
      const remote = {}
      let remoteOk = false
      let remoteReason = ''
      const ref = await gh('GET', '/repos/' + owner + '/' + repo + '/git/ref/heads/' + refPath(branch), undefined, undefined, lang)
      if (ref.status === 200 && ref.json && ref.json.object && ref.json.object.sha) {
        const commit = await ghOk('GET', '/repos/' + owner + '/' + repo + '/git/commits/' + String(ref.json.object.sha), undefined, undefined, lang)
        const treeSha = commit && commit.tree ? String(commit.tree.sha) : ''
        if (treeSha) {
          const treeRes = await ghOk('GET', '/repos/' + owner + '/' + repo + '/git/trees/' + treeSha + '?recursive=1', undefined, undefined, lang)
          const nodes = treeRes && Array.isArray(treeRes.tree) ? treeRes.tree : []
          for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i]
            if (!n || n.type !== 'blob') continue
            remote[String(n.path)] = { sha: String(n.sha || ''), size: typeof n.size === 'number' ? n.size : -1 }
          }
          remoteOk = true
        }
      } else if (ref.status === 404 || ref.status === 409) {
        remoteReason = 'branch-missing'
      } else {
        throw new Error(tr(lang, 'refReadFail', ref.status, ghMessage(ref.json, ref.status)))
      }
      if (!remoteOk && !remoteReason) remoteReason = 'no-tree'

      const files = []
      let unchanged = 0
      let hashed = 0
      for (let i = 0; i < scan.files.length; i++) {
        const f = scan.files[i]
        const rel = String(f.path)
        const r = remote[rel]
        let state = ''
        if (!r) state = 'added'
        else if (r.size >= 0 && f.size !== r.size) state = 'modified'
        else if (deep || r.size < 0) {
          // 同大小：必须比内容才知道有没有改
          try {
            const bytes = await readRelBytes(dir, rel)
            hashed++
            state = gitBlobSha(bytes) === r.sha ? '' : 'modified'
          } catch (e) {
            state = 'modified'  // 读不到就当作要更新，让用户自己决定
          }
        } else {
          // 同大小：git 里"内容不同但大小相同"确实存在，但概率远低于"没改过"。
          // 默认跳过，避免为了少数情况读遍全仓库；deep=true 时全算。
          state = ''
        }
        if (!state) { unchanged++; continue }
        files.push({ path: rel, state: state, size: f.size, ignored: f.ignored === true, reason: f.reason || '' })
      }

      return {
        repo: String(info.full_name || (owner + '/' + repo)),
        branch: branch,
        remoteOk: remoteOk,
        remoteReason: remoteReason,
        remoteFiles: Object.keys(remote).length,
        localFiles: scan.files.length,
        unchanged: unchanged,
        hashed: hashed,
        pending: files.length,
        files: files,
      }
    }

    /** 手写 base64：沙箱里的 btoa 只接受「UTF-8 文本」，二进制必须按字节编码。 */
    function bytesToBase64(bytes) {
      const len = bytes.length
      const parts = []
      let buf = ''
      let i = 0
      for (; i + 2 < len; i += 3) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
        buf += B64CHARS[(n >>> 18) & 63] + B64CHARS[(n >>> 12) & 63] + B64CHARS[(n >>> 6) & 63] + B64CHARS[n & 63]
        if (buf.length >= 24576) { parts.push(buf); buf = '' }
      }
      const rem = len - i
      if (rem === 1) {
        const n = bytes[i] << 16
        buf += B64CHARS[(n >>> 18) & 63] + B64CHARS[(n >>> 12) & 63] + '=='
      } else if (rem === 2) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
        buf += B64CHARS[(n >>> 18) & 63] + B64CHARS[(n >>> 12) & 63] + B64CHARS[(n >>> 6) & 63] + '='
      }
      if (buf) parts.push(buf)
      return parts.join('')
    }

    /** 有 NUL 字节或不是合法 UTF-8 就当作二进制。 */
    function looksText(bytes) {
      const n = Math.min(bytes.length, 8000)
      for (let i = 0; i < n; i++) { if (bytes[i] === 0) return false }
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        return true
      } catch (e) { return false }
    }

    // ── 上传任务 ──────────────────────────────────────────────────

    /** 逐段编码路径，保留 `/` 作为分隔符。 */
    function contentPath(path) {
      const segs = String(path).split('/')
      const out = []
      for (let i = 0; i < segs.length; i++) out.push(encodeURIComponent(segs[i]))
      return out.join('/')
    }

    async function readRelBytes(dir, rel) {
      const target = await fsx.resolve(rel, { cwd: dir })
      return await fsx.readBytes(target, undefined, MAX_FILE_BYTES)
    }

    /**
     * 空仓库（没有任何 commit）上 GitHub 的 Git Data API 全线 409 "Git Repository is empty" ——
     * blobs / trees / commits 都不可用，唯一能落第一个 commit 的是 Contents API。
     * 所以挑一个文件先垫出首个提交，随后 Git Data API 再把完整文件树写成第二个 commit；
     * 垫底用的文件内容与最终一致，因此仓库里不会多出任何多余文件。
     *
     * @returns 首个提交的 sha（失败时抛出可读的错误）。
     */
    async function seedEmptyRepo(job, owner, repo, dir, files, lang) {
      // 优先挑最小的文件：Contents API 的 JSON 体不适合塞大内容。
      let seed = ''
      let seedSize = -1
      const probes = Math.min(files.length, 50)
      for (let i = 0; i < probes; i++) {
        const rel = String(files[i])
        try {
          const st = await fsx.stat(await fsx.resolve(rel, { cwd: dir }))
          const size = st && typeof st.size === 'number' ? st.size : 0
          if (size > MAX_FILE_BYTES) continue
          if (seedSize === -1 || size < seedSize) { seed = rel; seedSize = size }
          if (size <= 262144) break
        } catch (e) { /* 读不到的跳过 */ }
      }
      if (!seed) seed = String(files[0])

      const bytes = await readRelBytes(dir, seed)
      const body = { message: tr(lang, 'seedMessage'), content: bytesToBase64(bytes) }
      // 不带 branch：让 GitHub 自己在默认分支上落第一个 commit，然后把实际分支名读回来。
      const res = await ghOk('PUT', '/repos/' + owner + '/' + repo + '/contents/' + contentPath(seed), body, undefined, lang)
      const sha = res && res.commit && res.commit.sha ? String(res.commit.sha) : ''
      if (!sha) throw new Error(tr(lang, 'seedFail', seed, 'no commit sha'))
      job.push(tr(lang, 'logSeeded', seed, sha.slice(0, 8)))
      return sha
    }

    /**
     * 走 GitHub Git Data API：
     *   读分支 head -> 逐个建 blob -> 建 tree（带 base_tree）-> 建 commit -> 更新/新建 ref
     * 全程不落地 .git，也不要求本机装 git。
     */
    async function runUploadOnce(job, p, lang) {
      const owner = String(p.owner || '')
      const repo = String(p.repo || '')
      const dir = String(p.dir || '')
      const files = Array.isArray(p.files) ? p.files : []
      if (!owner || !repo) throw new Error(tr(lang, 'needRepo'))
      if (!files.length) throw new Error(tr(lang, 'needFiles'))
      job.total = files.length

      const info = await ghOk('GET', '/repos/' + owner + '/' + repo, undefined, undefined, lang)
      const branch = String(p.branch || '').trim() || String(info.default_branch || '').trim() || 'main'
      job.push(tr(lang, 'logTarget', info.full_name, branch))

      let headSha = null
      let baseTree = null
      let refExists = false
      const ref = await gh('GET', '/repos/' + owner + '/' + repo + '/git/ref/heads/' + refPath(branch), undefined, undefined, lang)
      if (ref.status === 200 && ref.json && ref.json.object && ref.json.object.sha) {
        headSha = String(ref.json.object.sha)
        refExists = true
        const commit = await ghOk('GET', '/repos/' + owner + '/' + repo + '/git/commits/' + headSha, undefined, undefined, lang)
        baseTree = commit && commit.tree ? String(commit.tree.sha) : null
        job.push(tr(lang, 'logHead', headSha.slice(0, 8)))
      } else if (ref.status === 404 || ref.status === 409) {
        // 目标分支还不存在。若仓库本身有默认分支，就从它分出来，而不是造一个没有共同历史的游离提交。
        const fallback = String(info.default_branch || '')
        if (fallback && fallback !== branch) {
          const dref = await gh('GET', '/repos/' + owner + '/' + repo + '/git/ref/heads/' + refPath(fallback), undefined, undefined, lang)
          if (dref.status === 200 && dref.json && dref.json.object && dref.json.object.sha) {
            headSha = String(dref.json.object.sha)
            const dc = await ghOk('GET', '/repos/' + owner + '/' + repo + '/git/commits/' + headSha, undefined, undefined, lang)
            baseTree = dc && dc.tree ? String(dc.tree.sha) : null
            job.push(tr(lang, 'logBranchOff', branch, fallback))
          }
        }
        if (!headSha) job.push(tr(lang, 'logNewBranch', branch))
      } else {
        throw new Error(tr(lang, 'refReadFail', ref.status, ghMessage(ref.json, ref.status)))
      }

      job.phase = lang === 'en' ? 'Uploading file contents' : '上传文件内容'
      const tree = []
      const CHUNK = 6
      for (let i = 0; i < files.length; i += CHUNK) {
        const slice = files.slice(i, i + CHUNK)
        const requests = []
        const metas = []
        for (let k = 0; k < slice.length; k++) {
          const rel = String(slice[k])
          const bytes = await readRelBytes(dir, rel)
          const isText = looksText(bytes)
          const body = isText
            ? { content: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8' }
            : { content: bytesToBase64(bytes), encoding: 'base64' }
          requests.push({
            url: API_BASE + '/repos/' + owner + '/' + repo + '/git/blobs',
            method: 'POST',
            headers: ghHeaders(),
            body: body,
          })
          metas.push({ path: rel })
        }
        const results = await runHelper(requests, 4)
        for (let k = 0; k < metas.length; k++) {
          const r = results[k]
          if (!r || r.ok !== true) throw new Error(tr(lang, 'blobFail', metas[k].path, String((r && r.error) || 'unknown')))
          const j = parseJson(r.text)
          if (r.status >= 400 || !j || !j.sha) throw new Error(tr(lang, 'blobFail', metas[k].path, ghMessage(j, r.status)))
          tree.push({ path: metas[k].path, mode: '100644', type: 'blob', sha: String(j.sha) })
          job.done += 1
          job.current = metas[k].path
        }
      }
      job.push(tr(lang, 'logUploaded', tree.length))

      if (p.prune === true && baseTree) {
        job.phase = lang === 'en' ? 'Pruning extra remote files' : '清理远程多余文件'
        const remote = await ghOk('GET', '/repos/' + owner + '/' + repo + '/git/trees/' + baseTree + '?recursive=1', undefined, undefined, lang)
        const keep = {}
        for (let i = 0; i < files.length; i++) keep[String(files[i])] = true
        const nodes = remote && Array.isArray(remote.tree) ? remote.tree : []
        let removed = 0
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i]
          if (!n || n.type !== 'blob') continue
          const path = String(n.path || '')
          if (!keep[path]) {
            tree.push({ path: path, mode: '100644', type: 'blob', sha: null })
            removed += 1
          }
        }
        job.push(tr(lang, 'logPrune', removed))
      }

      job.phase = lang === 'en' ? 'Creating commit' : '创建提交'
      const treeBody = { tree: tree }
      if (baseTree) treeBody.base_tree = baseTree
      const treeRes = await ghOk('POST', '/repos/' + owner + '/' + repo + '/git/trees', treeBody, undefined, lang)
      const newTree = treeRes && treeRes.sha ? String(treeRes.sha) : ''
      if (!newTree) throw new Error(tr(lang, 'treeFail'))
      const message = String(p.message || '').trim()
        || ('Upload from DeepSeek Harness @ ' + new Date().toISOString().slice(0, 19).replace('T', ' '))
      const commitRes = await ghOk('POST', '/repos/' + owner + '/' + repo + '/git/commits', {
        message: message,
        tree: newTree,
        parents: headSha ? [headSha] : [],
      }, undefined, lang)
      const newCommit = commitRes && commitRes.sha ? String(commitRes.sha) : ''
      if (!newCommit) throw new Error(tr(lang, 'commitFail'))

      job.phase = lang === 'en' ? 'Updating branch' : '更新分支'
      if (refExists) {
        await ghOk('PATCH', '/repos/' + owner + '/' + repo + '/git/refs/heads/' + refPath(branch), {
          sha: newCommit,
          force: false,
        }, undefined, lang)
      } else {
        await ghOk('POST', '/repos/' + owner + '/' + repo + '/git/refs', {
          ref: 'refs/heads/' + branch,
          sha: newCommit,
        }, undefined, lang)
      }
      job.push(tr(lang, 'logBranch', branch, newCommit.slice(0, 8)))

      const url = String(info.html_url || '')
      return {
        repo: String(info.full_name || ''),
        repoUrl: url,
        branch: branch,
        commit: newCommit,
        commitUrl: url + '/commit/' + newCommit,
        fileCount: files.length,
      }
    }

    /** GitHub 对空仓库的报错就是这个字符串；用它做兜底判定。 */
    function isEmptyRepoError(err) {
      const m = String(err && err.message ? err.message : err)
      return m.toLowerCase().indexOf('repository is empty') !== -1
    }

    /** 主动探一遍：仓库 size 为 0 且一个 ref 都没有，才算真空。 */
    async function repoHasNoCommit(owner, repo, info, lang) {
      if (!info || typeof info.size !== 'number' || info.size !== 0) return false
      try {
        const probe = await gh('GET', '/repos/' + owner + '/' + repo + '/git/refs/heads', undefined, undefined, lang)
        return probe.status === 409
      } catch (e) {
        return false
      }
    }

    /**
     * 上传入口：先主动判断空仓库并垫一个 commit；万一判断漏了，
     * 就在 Git Data API 报「Repository is empty」时垫完重试一次。
     */
    async function runUpload(job, p, lang) {
      const owner = String(p.owner || '')
      const repo = String(p.repo || '')
      const dir = String(p.dir || '')
      const files = Array.isArray(p.files) ? p.files : []
      const hasFiles = owner && repo && files.length > 0

      if (hasFiles) {
        try {
          const info = await ghOk('GET', '/repos/' + owner + '/' + repo, undefined, undefined, lang)
          if (await repoHasNoCommit(owner, repo, info, lang)) {
            await seedEmptyRepo(job, owner, repo, dir, files, lang)
            job.push(tr(lang, 'logSeededDefault', String(info.default_branch || '')))
          }
        } catch (e) {
          // 探路失败不能挡住上传本身，交给下面的正常流程去报错。
          job.push(String(e && e.message ? e.message : e))
        }
      }

      try {
        return await runUploadOnce(job, p, lang)
      } catch (err) {
        if (!hasFiles || !isEmptyRepoError(err)) throw err
        job.push(tr(lang, 'logSeedRetry'))
        job.done = 0
        job.current = ''
        await seedEmptyRepo(job, owner, repo, dir, files, lang)
        return await runUploadOnce(job, p, lang)
      }
    }

    // ── API 分发 ──────────────────────────────────────────────────

    async function dispatch(args) {
      const op = args && args.op ? String(args.op) : ''
      const lang = langOf(args)

      if (op === 'hello') {
        const wsRoot = await baseCwd()
        const fRoot = await fsCwd()
        let nodePath = ''
        try { nodePath = await nodeExe() } catch (e) { nodePath = '' }
        return {
          projectRoot: fRoot || wsRoot,
          workspaceRoot: wsRoot,
          fsRoot: fRoot,
          nodePath: nodePath,
          assetDir: assetDir(),
          picker: { kind: pickerCapability() ? pickerKind : 'none' },
        }
      }

      if (op === 'ping') {
        let nodePath = ''
        try { nodePath = await nodeExe() } catch (e) { nodePath = '' }
        const r = await rawRequest({
          url: API_BASE + '/zen',
          method: 'GET',
          headers: { accept: 'application/vnd.github+json', 'user-agent': 'dsh-github-upload' },
          body: null,
        }, lang)
        return { status: r.status, zen: String(r.text || '').slice(0, 200), node: nodePath }
      }

      if (op === 'pick-folder') {
        const cap = pickerCapability()
        if (!cap) return { mode: 'fallback', message: tr(lang, 'pickerNone') }
        if (cap.kind === 'browse') return { mode: 'browse' }
        // native：会阻塞到用户选完或取消（这是本地应用，请求挂着没问题）。
        const picked = await cap.pick(inertSignal())
        return { mode: 'native', path: picked === null || picked === undefined ? '' : String(picked) }
      }

      if (op === 'list-dirs') {
        // 用 safe 版本：起点列不动时自动改到能用的目录；用户主动点进去才如实报错
        const listing = await listDirectoriesSafe(
          String(args.path || ''), lang,
          args.landing === true, String(args.hint || ''))
        if (!listing.roots) listing.roots = await rootsList()
        const cap = pickerCapability()
        if (listing.canCreate === undefined) listing.canCreate = !!(cap && cap.kind === 'browse')
        if (listing.canRetryNative === undefined) listing.canRetryNative = !!(cap && cap.kind === 'native')
        return listing
      }

      if (op === 'mkdir-dir') {
        const parent = String(args.parent || '').trim()
        const name = String(args.name || '').trim()
        if (!parent) throw new Error(tr(lang, 'mkdirNoParent'))
        if (!name || name === '.' || name === '..') throw new Error(tr(lang, 'mkdirBadName'))
        if (name.indexOf('/') !== -1 || name.indexOf(BS) !== -1) throw new Error(tr(lang, 'mkdirSep'))
        const cap = pickerCapability()
        if (cap && cap.kind === 'browse') {
          const created = await cap.createDirectory(parent, name)
          return { path: String(created) }
        }
        throw new Error(tr(lang, 'mkdirUnsupported'))
      }

      if (op === 'auth-status') {
        await ensureToken()
        if (!token) return { bound: false, user: null, persist: tokenPersist }
        if (user) {
          return { bound: true, user: user, token: tokenMeta, hint: tokenHint(tokenMeta, lang), persist: tokenPersist }
        }
        try {
          const r = await gh('GET', '/user', undefined, undefined, lang)
          if (r.status >= 400) throw new Error(ghMessage(r.json, r.status))
          user = trimUser(r.json)
          tokenMeta = tokenInfo(r.headers)
          return { bound: true, user: user, token: tokenMeta, hint: tokenHint(tokenMeta, lang), persist: tokenPersist }
        } catch (e) {
          return { bound: false, user: null, error: String(e && e.message ? e.message : e) }
        }
      }

      if (op === 'auth-set') {
        const t = String(args.token || '').trim()
        if (!t) throw new Error(tr(lang, 'tokenEmpty'))
        const prev = token
        const prevUser = user
        const prevMeta = tokenMeta
        token = t
        user = null
        tokenMeta = null
        tokenRestored = true
        try {
          const r = await gh('GET', '/user', undefined, undefined, lang)
          if (r.status >= 400) throw new Error(ghMessage(r.json, r.status))
          user = trimUser(r.json)
          tokenMeta = tokenInfo(r.headers)
          // 校验通过才落盘，避免把打错的令牌固化下来。
          const write = await persistToken(t)
          return {
            bound: true, user: user, token: tokenMeta, hint: tokenHint(tokenMeta, lang),
            persist: tokenPersist, wrote: write,
          }
        } catch (e) {
          token = prev
          user = prevUser
          tokenMeta = prevMeta
          throw new Error(tr(lang, 'tokenInvalid', String(e && e.message ? e.message : e)))
        }
      }

      if (op === 'auth-clear') {
        token = ''
        user = null
        tokenMeta = null
        tokenRestored = true
        await forgetToken()
        return { bound: false, persist: tokenPersist }
      }

      if (op === 'list-repos') {
        if (!user) {
          const r = await gh('GET', '/user', undefined, undefined, lang)
          if (r.status >= 400) throw new Error(ghMessage(r.json, r.status))
          user = trimUser(r.json)
          tokenMeta = tokenInfo(r.headers)
        }
        const collected = await collectRepos(lang)
        const q = String(args.query || '').trim().toLowerCase()
        const repos = q
          ? collected.repos.filter(function (r) {
            return (r.fullName + ' ' + r.description).toLowerCase().indexOf(q) !== -1
          })
          : collected.repos
        return {
          repos: repos.slice(0, 300),
          total: collected.repos.length,
          diag: collected.diag,
          token: tokenMeta,
          hint: tokenHint(tokenMeta, lang),
        }
      }

      if (op === 'create-repo') {
        const name = String(args.name || '').trim()
        if (!name) throw new Error(tr(lang, 'repoNameEmpty'))
        if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error(tr(lang, 'repoNameBad'))
        const created = await ghOk('POST', '/user/repos', {
          name: name,
          private: args.private === true,
          description: String(args.description || ''),
          auto_init: false,
        }, undefined, lang)
        return { repo: trimRepo(created) }
      }

      if (op === 'get-repo') {
        return { repo: trimRepo(await ghOk('GET', '/repos/' + String(args.owner) + '/' + String(args.repo), undefined, undefined, lang)) }
      }

      if (op === 'update-repo') {
        const body = {}
        const p = args.patch && typeof args.patch === 'object' ? args.patch : {}
        if (typeof p.name === 'string' && p.name.trim()) body.name = p.name.trim()
        if (typeof p.description === 'string') body.description = p.description
        if (typeof p.homepage === 'string') body.homepage = p.homepage
        if (typeof p.private === 'boolean') body.private = p.private
        if (typeof p.hasIssues === 'boolean') body.has_issues = p.hasIssues
        if (typeof p.hasWiki === 'boolean') body.has_wiki = p.hasWiki
        if (typeof p.archived === 'boolean') body.archived = p.archived
        if (!Object.keys(body).length) throw new Error(tr(lang, 'noField'))
        return { repo: trimRepo(await ghOk('PATCH', '/repos/' + String(args.owner) + '/' + String(args.repo), body, undefined, lang)) }
      }

      if (op === 'set-topics') {
        const names = Array.isArray(args.names)
          ? args.names.map(function (n) { return String(n).trim() }).filter(Boolean).slice(0, 20)
          : []
        const r = await ghOk('PUT', '/repos/' + String(args.owner) + '/' + String(args.repo) + '/topics', { names: names }, undefined, lang)
        return { topics: r && Array.isArray(r.names) ? r.names : names }
      }

      if (op === 'list-branches') {
        const list = await ghOk('GET', '/repos/' + String(args.owner) + '/' + String(args.repo) + '/branches?per_page=100', undefined, undefined, lang)
        return {
          branches: Array.isArray(list)
            ? list.map(function (b) { return String(b && b.name ? b.name : '') }).filter(Boolean)
            : [],
        }
      }

      if (op === 'delete-repo') {
        await ghOk('DELETE', '/repos/' + String(args.owner) + '/' + String(args.repo), undefined, undefined, lang)
        return { deleted: true }
      }

      if (op === 'scan') return await scanProject(String(args.dir || ''), args.useGitignore !== false, lang)

      if (op === 'session-files') return await sessionFileActivity(String(args.dir || ''), lang)

      // 跨会话累计的「还没上传的改动」：按内容与远程分支比对，不看会话日志
      if (op === 'pending-files') {
        return await pendingChanges(
          String(args.owner || ''), String(args.repo || ''), String(args.dir || ''),
          String(args.branch || ''), args.deep === true, lang)
      }

      if (op === 'upload-start') {
        jobSeq += 1
        const job = {
          id: 'job' + jobSeq,
          state: 'running',
          phase: '…',
          total: 0,
          done: 0,
          current: '',
          log: [],
          result: null,
          error: null,
          push: function (line) {
            const stamp = new Date().toISOString().slice(11, 19)
            job.log.push(stamp + '  ' + line)
            if (job.log.length > 300) job.log.splice(0, job.log.length - 300)
          },
        }
        jobs.set(job.id, job)
        if (jobs.size > 12) {
          const oldest = jobs.keys().next()
          if (!oldest.done) jobs.delete(oldest.value)
        }
        runUpload(job, args, lang).then(function (result) {
          job.result = result
          job.state = 'done'
          job.phase = 'done'
        }, function (err) {
          job.error = String(err && err.message ? err.message : err)
          job.state = 'error'
          job.phase = 'failed'
        })
        return { jobId: job.id }
      }

      if (op === 'job-status') {
        const job = jobs.get(String(args.jobId || ''))
        if (!job) throw new Error(tr(lang, 'jobMissing'))
        return {
          id: job.id,
          state: job.state,
          phase: job.phase,
          total: job.total,
          done: job.done,
          current: job.current,
          log: job.log.slice(-80),
          result: job.result,
          error: job.error,
        }
      }

      throw new Error(tr(lang, 'unknownOp', op))
    }

    // ── HTTP 路由与入口注入 ───────────────────────────────────────

    function readBody(req) {
      return new Promise(function (resolve, reject) {
        const chunks = []
        req.on('data', function (c) { chunks.push(c) })
        req.on('end', function () {
          const parts = []
          for (let i = 0; i < chunks.length; i++) {
            try { parts.push(chunks[i].toString('utf8')) } catch (e) { /* skip */ }
          }
          resolve(parts.join(''))
        })
        req.on('error', reject)
      })
    }

    const API_PATH = ROUTE_PREFIX + '/api'

    /**
     * 记一条启动诊断（仅在 `DSH_GHU_DIAG=1` 时有效）。
     *
     * 必须**同步、零依赖**：若走 `await baseCwd()` + `fsx.writeText`，一旦 apply() 在那之前
     * 已经炸了，`baseCwd()` 内部的 `fsx.resolve('.')` 也会挂，诊断反倒把真正的故障掩盖掉。
     */
    function diag(step, detail) {
      if (!DIAG_ON) return
      const row = {
        at: new Date().toISOString(), pid: process.pid, step: step,
        detail: detail === undefined ? null : String(detail)
      }
      // 进程内记录：宿主进程还活着就能读到，不依赖文件系统、不依赖任何服务。
      try {
        const g = globalThis
        if (!g.__DSH_GHU_DIAG__) g.__DSH_GHU_DIAG__ = []
        g.__DSH_GHU_DIAG__.push(row)
        if (g.__DSH_GHU_DIAG__.length > 200) g.__DSH_GHU_DIAG__.shift()
      } catch (e) { /* ignore */ }
      try { if (fsMod && DIAG_FILE) fsMod.appendFileSync(DIAG_FILE, JSON.stringify(row) + '\n') } catch (e2) { /* ignore */ }
      try { console.log(TAG + ' [diag] ' + JSON.stringify(row)) } catch (e3) { /* ignore */ }
    }

    /** 真正的请求处理：始终回 JSON，前端才不会看到 "no response"。 */
    async function handleApi(req, res) {
      try {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: false, error: 'method not allowed: ' + req.method + '（本接口只用 POST）' }))
          return
        }
        const body = await readBody(req)
        let args = {}
        try { args = JSON.parse(body || '{}') } catch (e) { args = {} }
        let payload
        try {
          payload = { ok: true, data: await dispatch(args) }
        } catch (err) {
          payload = { ok: false, error: String(err && err.message ? err.message : err) }
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(payload))
      } catch (err) {
        console.error('[dsh-github-upload] route error', err)
        try {
          res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: false, error: 'internal error: ' + String(err && err.message ? err.message : err) }))
        } catch (e) { /* ignore */ }
      }
    }

    /**
     * 注册 API 路由。
     *
     * 分三层，因为「注册成功」不能只依赖 Cordis 的调度：一旦 `ctx.effect` 的回调没被调用
     * （或调用时 register 抛错被 Cordis 吞掉），就变成「进程说已挂载、路由其实不存在」，
     * 前端只拿到兜底路由的 405。
     *
     *   1. 先**同步注册一次**，并记录真实结果（注册不上就立刻说清楚，不假装挂载成功）；
     *   2. 再用 `ctx.effect` 做一次幂等重试，保证生命周期正确（fiber 卸载时会 dispose）；
     *   3. 最后用 `timer` 做保底重试：万一 effect 没被调用，
     *      定时器仍会把路由挂上 —— 定时器只依赖硬依赖 `inject: ['timer']`，比 effect 更可靠。
     */
    let routeDisposer = null
    let routeRetryStop = null

    function tryRegisterRoute(why) {
      if (routeDisposer) return true
      try {
        routeDisposer = wsvc.register({ kind: 'exact', path: API_PATH, handler: handleApi })
        diag('register:ok', API_PATH + ' via=' + why + ' dispose=' + typeof routeDisposer)
        console.log(TAG + ' 路由已注册: ' + API_PATH + '（' + why + '）')
        if (routeRetryStop) { try { routeRetryStop() } catch (e) { /* ignore */ } routeRetryStop = null }
        return true
      } catch (err) {
        diag('register:FAILED', API_PATH + ' via=' + why + ' :: ' + String(err && err.stack ? err.stack : err))
        console.error(TAG + ' 路由注册失败 ' + API_PATH + '（' + why + '）：', err)
        return false
      }
    }

    // 1) 同步注册：apply() 里立刻做，不依赖任何调度。
    tryRegisterRoute('apply-sync')

    // 2) 生命周期内重试一次（effect 正常时它就是权威路径）。
    ctx.effect(function () {
      tryRegisterRoute('effect')
      return function () {
        if (routeDisposer) { try { routeDisposer() } catch (e) { /* ignore */ } routeDisposer = null }
      }
    }, 'dsh-github-upload: api route')

    // 3) 保底：每 2 秒重试，直到注册成功为止。只依赖 inject 里的 timer 服务。
    if (!routeDisposer) {
      let tries = 0
      try {
        routeRetryStop = ctx.interval(function () {
          tries += 1
          if (routeDisposer || tries > 30) { if (routeRetryStop) { routeRetryStop() }; routeRetryStop = null; return }
          tryRegisterRoute('timer#' + tries)
        }, 2000)
        diag('register:retry-armed', '每 2 秒重试，最多 30 次')
      } catch (e) {
        diag('register:retry-failed', String(e && e.message ? e.message : e))
      }
    }

    diag('apply:done', 'route=' + (routeDisposer ? 'registered' : 'NOT-registered'))
    console.log(TAG + ' mounted / 已挂载: ' + API_PATH + '  路由=' + (routeDisposer ? 'OK' : '未注册!'))
}
