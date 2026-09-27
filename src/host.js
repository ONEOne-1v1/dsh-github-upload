/**
 * dsh-github-upload — 宿主半边（Host half） / Host half of the dynamic Cordis plugin
 *
 * 这是 Cordis 动态插件的 `code.host`：一个普通 JavaScript 函数体，最终 `return` 一个 Cordis Plugin。
 * 它在 DSH 的 Node 进程里运行，负责：
 *   1. 通过 webServer 注册 /dsh-gh 前缀路由（下发前端资源 + JSON API）；
 *   2. 通过 tapIndex 把入口脚本注入到页面，得到那个右下角的按钮；
 *   3. 用 subprocess 拉起一个短命的 node 子进程做 HTTPS 请求（动态沙箱内没有 fetch）；
 *   4. 用 fs 服务扫描项目目录、读取文件内容；
 *   5. 用 directoryPicker 服务让用户在本机选文件夹；
 *   6. 用 GitHub Git Data API 把文件推成一个 commit（不依赖本机 git，也不会生成 .git）。
 *
 * 双语：前端每次请求都会带上 lang（zh / en），宿主用它挑选消息文案。
 *
 * ── 开发方式 ──────────────────────────────────────────────────────────
 * 前端资源（src/client.js、src/client.css）在**每次请求时从磁盘读取**，
 * 所以改完前端只需要刷新浏览器页面，不必重新 define / run 插件。
 *
 * 改完本文件后需要重新激活插件：运行 `node build/bundle.mjs` 生成
 * dist/ghpush-package.json，再用 cordis_define / cordis_run 载入。
 */

// 前端资源目录。项目移动后请修改这里，或重新运行 build/bundle.mjs。
const ASSET_DIR = 'D:/dsh plugins/dsh-github-upload/src'

const API_BASE = 'https://api.github.com'
const MAX_FILE_BYTES = 26214400 // 单文件 25MB
const MAX_SCAN_FILES = 20000
const ROUTE_PREFIX = '/dsh-gh'

/**
 * 双向文案表 / bilingual message table：每条 [中文, English]。
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
  mkdirNoParent: ['缺少父目录', 'Missing parent directory.'],
  mkdirBadName: ['请输入合法的文件夹名', 'Enter a valid folder name.'],
  mkdirSep: ['文件夹名不能包含路径分隔符', 'A folder name cannot contain a path separator.'],
  mkdirUnsupported: ['当前宿主的目录选择后端不支持新建文件夹（可用系统对话框里的「新建文件夹」）',
    'The host directory-picker backend cannot create folders (use "New folder" inside the system dialog instead).'],
  pickerNone: ['宿主没有目录选择服务，已切换为内置文件浏览器',
    'No host directory-picker service is available; using the built-in browser instead.'],

  // 扫描忽略原因 / scan ignore reasons
  igDep: ['内置忽略（依赖/缓存）：{1}', 'built-in ignore (dependency/cache): {1}'],
  igBuild: ['内置忽略（构建产物）：{1}', 'built-in ignore (build output): {1}'],
  igGitignore: ['.gitignore 忽略', 'ignored by .gitignore'],
  igBuiltin: ['内置忽略：{1}', 'built-in ignore: {1}'],
  igTooBig: ['超过 25MB 上限（{1} 字节）', 'over the 25MB limit ({1} bytes)'],

  // 上传任务日志 / upload job log
  logTarget: ['目标仓库 {1}，分支 {2}', 'Target repository {1}, branch {2}'],
  logHead: ['远程分支已存在 head={1}', 'Remote branch exists, head={1}'],
  logNewBranch: ['远程分支尚不存在，将新建分支 {1}', 'Remote branch does not exist; creating {1}'],
  logUploaded: ['文件内容已上传（{1} 个）', 'Uploaded file contents ({1} file(s))'],
  logPrune: ['将删除远程多余的 {1} 个文件', 'Will delete {1} extra file(s) from the remote branch'],
  logBranch: ['分支 {1} 已更新 -> {2}', 'Branch {1} updated -> {2}'],

  // 仓库来源统计 / repository source diagnostics
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

  // 令牌权限提示 / token scope hints
  hintClassicNone: ['classic 令牌没有任何 scope，只能读公开信息，看不到仓库列表。',
    'This classic token has no scopes, so it can only read public metadata and cannot list repositories.'],
  hintClassicNoRepo: ['classic 令牌缺少 repo / public_repo 权限，只能看到公开仓库。',
    'This classic token lacks the repo / public_repo scope, so only public repositories are visible.'],
  hintClassicPublicOnly: ['classic 令牌只有 public_repo 权限，看不到私有仓库。',
    'This classic token only has public_repo, so private repositories are invisible.'],
  hintClassicOk: ['classic 令牌权限看起来正常。', 'This classic token looks correctly scoped.'],
  hintFine: ['fine-grained 令牌只能访问创建令牌时被授权的仓库；若要看到全部仓库，请在令牌设置里选择 All repositories。',
    'A fine-grained token only sees the repositories it was granted; choose "All repositories" in the token settings to see everything.'],

  // 空仓库初始化 / empty-repository bootstrapping
  seedMessage: ['由 DeepSeek Harness 初始化仓库', 'Initialize repository from DeepSeek Harness'],
  logSeeded: ['空仓库：已用 {1} 创建首个提交（{2}）',
    'Empty repository: created the first commit from {1} ({2})'],
  logSeededDefault: ['仓库默认分支已建立：{1}', 'Repository default branch created: {1}'],
  logSeedRetry: ['GitHub 报告仓库为空，创建首个提交后重试',
    'GitHub reported an empty repository; creating the first commit and retrying'],
  seedFail: ['空仓库初始化失败（{1}）：{2}', 'Could not initialize the empty repository ({1}): {2}'],
  logBranchOff: ['分支 {1} 尚不存在，将从 {2} 分出',
    'Branch {1} does not exist yet; branching it off {2}'],

  // 会话文件识别 / session file detection
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
 * 在子 node 进程里执行的网络助手。 / Network helper executed inside a short-lived node child.
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

return {
  // timer 是硬依赖：raceTimeout 用它给网络请求加超时。
  inject: ['timer'],

  apply(ctx) {
    const fsx = ctx.get('fs')
    const sp = ctx.get('subprocess')
    const wsvc = ctx.get('webServer')
    const spol = ctx.get('sandboxPolicy')
    // 可选服务：宿主自带的目录选择器。native=弹系统文件夹对话框，browse=给列表原语自己画浏览器。
    const dp = ctx.get('directoryPicker')
    // 可选服务：宿主凭据库。用来把 GitHub 令牌持久化，免得插件重启后又要重新绑定。
    const creds = ctx.get('credentials')
    // 可选服务：会话查询。用来识别「这次聊天里改过哪些文件」。
    const sessionQuery = ctx.get('sessionQuery')
    if (fsx === undefined || sp === undefined || wsvc === undefined) {
      console.error('[dsh-github-upload] 缺少 fs / subprocess / webServer 服务，插件未激活')
      return
    }

    const B64CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    // 用字符码代替字面量转义序列：源码里不出现反斜杠，把它塞进 JSON 载荷时就不会被二次转义。
    const BS = String.fromCharCode(92)
    const CR = String.fromCharCode(13)
    const REGEX_SPECIAL = '.+^$()[]{}|' + BS

    /** 语言归一化：只认 en，其余都是 zh。 */
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
    // 动态插件的宿主半边每次重新激活都会换一个全新的闭包，内存里的令牌就没了；
    // 之前用户每次都要重新绑定（GitHub 又只显示一次令牌，只好再造一个）。
    // 这里把令牌写进宿主的凭据库（credentials 服务），重启后自动恢复。
    const TOKEN_REF = 'DSH_GITHUB_UPLOAD_TOKEN'
    let tokenWritable = false
    let tokenRestored = false

    /** 从凭据库读回令牌；顺带记录「能否写入」，供 UI 提示用。 */
    async function loadStoredToken() {
      if (creds === undefined) return ''
      try {
        const info = await creds.describe(TOKEN_REF)
        tokenWritable = info !== undefined && info.writable === true
      } catch (e) {
        tokenWritable = false
      }
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

    async function persistToken(value) {
      if (creds === undefined) return false
      try {
        if (!tokenWritable) {
          const info = await creds.describe(TOKEN_REF)
          tokenWritable = info !== undefined && info.writable === true
        }
        if (!tokenWritable) return false
        await creds.set(TOKEN_REF, value)
        return true
      } catch (e) {
        console.error('[dsh-github-upload] 写入凭据库失败', e)
        return false
      }
    }

    async function forgetToken() {
      if (creds === undefined || !tokenWritable) return
      try { await creds.unset(TOKEN_REF) } catch (e) { /* ignore */ }
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

    /** 读取前端资源；每次请求都重新读，方便边改边刷新。 */
    async function readAsset(name) {
      try {
        const t = await fsx.resolve(ASSET_DIR + '/' + name)
        return await fsx.readText(t)
      } catch (e) {
        console.error('[dsh-github-upload] 读取前端资源失败：' + ASSET_DIR + '/' + name)
        return null
      }
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

    /** capability 对象在服务生命周期内稳定，可以安全缓存。 */
    function pickerCapability() {
      if (pickerCap !== null) return pickerCap
      try {
        if (dp !== undefined && typeof dp.capability === 'function') {
          const cap = dp.capability()
          if (cap && (cap.kind === 'native' || cap.kind === 'browse')) {
            pickerCap = cap
            pickerKind = cap.kind
            return cap
          }
        }
      } catch (e) {
        console.error('[dsh-github-upload] 读取 directoryPicker 能力失败', e)
      }
      pickerCap = false
      pickerKind = 'none'
      return false
    }

    /**
     * 原生选择器需要一个 AbortSignal，但动态沙箱里没有 AbortController。
     * 实现只用到 aborted / addEventListener / removeEventListener，所以给个鸭子类型即可
     * —— 我们从不主动中止：对话框关闭就是用户的选择。
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

    /** 没有 browse 能力时的兜底：直接用 fs 列出子目录，并自己拼面包屑。 */
    async function fsListing(pathArg, lang) {
      const base = String(pathArg || '').trim() || await baseCwd()
      const target = await fsx.resolve(base)
      const info = await fsx.stat(target)
      if (!info || info.type !== 'directory') throw new Error(tr(lang, 'dirUnreadable', base))
      const abs = fsx.processPath(target)
      const children = await fsx.listDir(target)
      const entries = []
      for (let i = 0; i < children.length; i++) {
        if (children[i].type !== 'directory') continue
        const name = String(children[i].name)
        entries.push({ name: name, path: abs + '/' + name, hidden: name.charAt(0) === '.' })
      }
      entries.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1 })

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
      return { path: abs, home: await baseCwd(), crumbs: crumbs, entries: entries, truncated: false }
    }

    /** 统一入口：拿一层目录列表。 */
    async function listDirectories(pathArg, lang) {
      const cap = pickerCapability()
      if (cap && cap.kind === 'browse') return trimListing(await cap.list(pathArg || undefined))
      return await fsListing(pathArg, lang)
    }

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
          assetDir: ASSET_DIR,
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
        const listing = await listDirectories(String(args.path || ''), lang)
        listing.roots = await rootsList()
        listing.canCreate = pickerCapability() ? pickerCapability().kind === 'browse' : false
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
        if (!token) return { bound: false, user: null, persisted: tokenWritable }
        if (user) {
          return { bound: true, user: user, token: tokenMeta, hint: tokenHint(tokenMeta, lang), persisted: tokenWritable }
        }
        try {
          const r = await gh('GET', '/user', undefined, undefined, lang)
          if (r.status >= 400) throw new Error(ghMessage(r.json, r.status))
          user = trimUser(r.json)
          tokenMeta = tokenInfo(r.headers)
          return { bound: true, user: user, token: tokenMeta, hint: tokenHint(tokenMeta, lang), persisted: tokenWritable }
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
          const persisted = await persistToken(t)
          return { bound: true, user: user, token: tokenMeta, hint: tokenHint(tokenMeta, lang), persisted: persisted }
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
        return { bound: false, persisted: tokenWritable }
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

    ctx.effect(function () {
      return wsvc.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: async function (req, res) {
          try {
            let path = String(req.url || '')
            const q = path.indexOf('?')
            if (q !== -1) path = path.slice(0, q)

            if (req.method === 'GET' && path === ROUTE_PREFIX + '/app.js') {
              const text = await readAsset('client.js')
              res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' })
              res.end(text === null
                ? 'console.error("[dsh-github-upload] 无法读取前端资源：' + ASSET_DIR + '/client.js");'
                : text)
              return
            }

            if (req.method === 'GET' && path === ROUTE_PREFIX + '/app.css') {
              const text = await readAsset('client.css')
              res.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' })
              res.end(text === null ? '' : text)
              return
            }

            if (req.method === 'POST' && path === ROUTE_PREFIX + '/api') {
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
              return
            }

            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
            res.end('not found')
          } catch (err) {
            console.error('[dsh-github-upload] route error', err)
            try {
              res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
              res.end('internal error')
            } catch (e) { /* ignore */ }
          }
        },
      })
    }, 'dsh-github-upload: http routes')

    ctx.effect(function () {
      return wsvc.tapIndex(function (html) {
        if (typeof html !== 'string') return html
        if (html.indexOf(ROUTE_PREFIX + '/app.js') !== -1) return html
        const inject = '<link rel="stylesheet" href="' + ROUTE_PREFIX + '/app.css">'
          + '<script src="' + ROUTE_PREFIX + '/app.js" defer></script>'
        if (html.indexOf('</body>') === -1) return html + inject
        return html.replace('</body>', function () { return inject + '</body>' })
      })
    }, 'dsh-github-upload: index tap')

    console.log('[dsh-github-upload] mounted / 已挂载: ' + ROUTE_PREFIX + ' routes ready, assets at ' + ASSET_DIR)
  },
}
