/* dsh-github-upload — 浏览器端 UI / browser-side UI
 *
 * 本文件由宿主在每次请求时从磁盘读取并原样下发，不经过任何打包器。
 * 改完保存、刷新浏览器页面即可生效，无需重新激活插件。
 *
 * 双语：所有面向用户的文案都在下面的 M 表里，每条 [中文, English]。
 * 语言存在 localStorage（dsh.ghu.lang），首次按浏览器语言猜；
 * 每次 api() 都会带上 lang，宿主用自己的文案表回话。
 *
 * 与宿主通信：fetch('/dsh-gh/api', {op, lang, ...}) -> {ok, data|error}
 */
(function () {
  if (window.__DSH_GHU__) return;
  window.__DSH_GHU__ = true;

  var API = '/dsh-gh/api';
  var LS_TOKEN = 'dsh.ghu.token';
  var LS_REPO = 'dsh.ghu.repo';
  var LS_DIR = 'dsh.ghu.dir';
  var LS_POS = 'dsh.ghu.pos';
  var LS_LANG = 'dsh.ghu.lang';
  var MAX_ROWS = 6000;
  var TOKEN_URL_CLASSIC = 'https://github.com/settings/tokens/new?scopes=repo&description=dsh-github-upload';
  var TOKEN_URL_FINE = 'https://github.com/settings/personal-access-tokens/new';
  var GH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z"/></svg>';

  /* ---------- 文案表 / message catalog ---------- */

  var M = {
    // 入口与面板 / entry point and panel
    fabLabel: ['上传到 GitHub', 'Upload to GitHub'],
    fabTitle: ['上传项目到 GitHub（可拖动移动）', 'Upload this project to GitHub (drag to move)'],
    panelTitle: ['GitHub 上传', 'GitHub Upload'],
    close: ['关闭', 'Close'],
    tabAccount: ['账号', 'Account'],
    tabRepo: ['仓库', 'Repositories'],
    tabUpload: ['上传', 'Upload'],
    tabSettings: ['仓库信息', 'Repository settings'],

    // 账号页 / account tab
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
    acctPersistOff: ['⚠️ 宿主的凭据库当前不可写（该引用被环境变量占用），令牌只留在浏览器里 —— 插件重启后需要重新绑定。',
      '⚠️ The host credential store is not writable (an environment variable shadows this reference), so the token only lives in the browser — you will need to re-bind after a plugin restart.'],
    acctBind: ['校验并绑定', 'Verify and bind'],
    acctBinding: ['校验中…', 'Verifying…'],
    acctTokenEmpty: ['请先填入令牌', 'Paste a token first.'],
    acctBindOk: ['绑定成功：@{1}', 'Bound: @{1}'],
    acctKindClassic: ['令牌类型：classic（权限：{1}）', 'Token type: classic (scopes: {1})'],
    acctKindClassicNone: ['令牌类型：classic（无任何 scope）', 'Token type: classic (no scopes)'],
    acctKindFine: ['令牌类型：fine-grained（只能访问创建时授权的仓库）',
      'Token type: fine-grained (only repositories granted at creation)'],
    acctExpires: ['过期时间：{1}', 'Expires: {1}'],

    // 本机环境 / local environment
    envHeading: ['本机环境', 'Local environment'],
    envDefaultDir: ['默认目录', 'Default directory'],
    envNode: ['Node 运行时', 'Node runtime'],
    envAssets: ['前端资源目录', 'UI assets directory'],
    envPicker: ['文件夹选择后端', 'Folder-picker backend'],
    envSelfTest: ['运行自检', 'Run self-test'],
    envTesting: ['自检中…', 'Testing…'],
    envOk: ['OK · GitHub 返回 {1}：{2}', 'OK · GitHub replied {1}: {2}'],
    envFail: ['失败：{1}', 'Failed: {1}'],

    // 仓库页 / repositories tab
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

    // 空列表排障 / empty-list guidance
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

    // 上传页 / upload tab
    upTarget: ['目标仓库', 'Target repository'],
    upDirHeading: ['项目目录', 'Project directory'],
    upDirPh: ['项目目录绝对路径', 'Absolute path to the project directory'],
    upChoose: ['选择文件夹', 'Choose folder'],
    upChoosing: ['等待系统对话框…', 'Waiting for the system dialog…'],
    upChooseTip: ['打开内置文件浏览器选择项目文件夹（不依赖任何系统组件，随时可用）',
      'Open the built-in file browser to pick the project folder (no OS component involved; always available)'],
    upScan: ['扫描', 'Scan'],
    upScanning: ['扫描中…', 'Scanning…'],
    upScanHint: ['点「扫描」列出目录内容，然后勾选本次要上传的文件。',
      'Press Scan to list the directory, then tick the files you want to upload.'],
    upSummary: ['已选 {1} / {2} 个文件 · {3}', '{1} / {2} files selected · {3}'],
    upAll: ['全选', 'All'],
    upNone: ['清空', 'None'],
    upReset: ['恢复默认', 'Defaults'],
    upPickSession: ['本聊天改动的文件', 'Files from this chat'],
    upPickSessionTip: ['识别当前工作区对应会话里被写入 / 修改过的文件并勾选',
      'Detect the files written or edited in the session for this workspace and tick them'],
    upPickSessionHint: ['自动识别本次聊天里动过的文件，省得在几百个文件里手动勾选',
      'Detects the files this chat touched, so you do not have to tick through hundreds of files'],
    upSessionPicking: ['识别中…', 'Detecting…'],
    upSessionNone: ['没有识别到本会话改动的文件', 'No files from this session were detected.'],
    upSessionPicked: ['已按会话《{1}》勾选 {2} 个文件', 'Ticked {2} file(s) from session "{1}"'],
    noteSession: ['来源会话《{1}》 · 本会话写入/修改 {2} 个文件，其中 {3} 个在项目目录内',
      'Source session "{1}" · this session wrote or edited {2} file(s), {3} inside the project'],
    noteSessionOutside: ['（另有 {1} 个改动文件在项目目录之外）', ' ({1} touched file(s) lie outside the project)'],
    markWritten: ['本会话写入', 'written in this session'],
    markEdited: ['本会话修改', 'edited in this session'],
    markRead: ['本会话读取', 'read in this session'],
    markSearched: ['本会话检索', 'searched in this session'],
    dirCleaned: ['已自动去掉路径两端的引号 / 多余分隔符（资源管理器「复制为路径」会带引号）',
      'Stripped the surrounding quotes / extra separators from the path (Explorer\'s "Copy as path" adds quotes)'],

    // 项目目录识别 / project-directory detection
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
    upPickSession: ['本聊天改动的文件', 'Files from this chat'],
    upPickSessionTip: ['识别当前工作区对应会话里被写入 / 修改过的文件并勾选',
      'Detect the files written or edited in the session for this workspace and tick them'],
    upPickSessionHint: ['自动识别本次聊天里动过的文件，省得在几百个文件里手动勾选',
      'Detects the files this chat touched, so you do not have to tick through hundreds of files'],
    upSessionPicking: ['识别中…', 'Detecting…'],
    upSessionNone: ['没有识别到本会话改动的文件', 'No files from this session were detected.'],
    upSessionPicked: ['已按会话《{1}》勾选 {2} 个文件', 'Ticked {2} file(s) from session "{1}"'],
    noteSession: ['来源会话《{1}》 · 本会话写入/修改 {2} 个文件，其中 {3} 个在项目目录内',
      'Source session "{1}" · this session wrote or edited {2} file(s), {3} inside the project'],
    noteSessionOutside: ['（另有 {1} 个改动文件在项目目录之外）', ' ({1} touched file(s) lie outside the project)'],
    markWritten: ['本会话写入', 'written in this session'],
    markEdited: ['本会话修改', 'edited in this session'],
    markRead: ['本会话读取', 'read in this session'],
    markSearched: ['本会话检索', 'searched in this session'],
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

    // 仓库信息页 / repository settings tab
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

    // 文件夹浏览器 / folder picker
    pkTitle: ['选择项目文件夹', 'Choose the project folder'],
    pkHome: ['主目录', 'Home'],
    pkLoading: ['读取中…', 'Reading…'],
    pkEmptyHidden: ['没有可见的子文件夹（可勾选「显示隐藏项」）',
      'No visible subfolders (tick "Show hidden" to reveal them)'],
    pkEmpty: ['这个文件夹里没有子文件夹', 'This folder has no subfolders'],
    pkTruncated: ['目录过多，列表已被宿主截断', 'Too many entries; the host truncated this listing'],
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
    pickTimeout: ['系统对话框 25 秒内没有响应（本机的原生选择器可能不可用），已放弃等待 —— 请用「选择文件夹」的内置浏览器。',
      'The system dialog did not respond within 25 seconds (the native picker may be unavailable here); stopped waiting — use the built-in browser behind "Choose folder".'],

    // 其他 / misc
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
    tokenMeta: null, hint: '', diag: [], persisted: null,
    repos: [], repoFilter: '', repo: null, repoBusy: false,
    newOpen: false, newName: '', newPrivate: true, newDesc: '',
    manual: '',
    dir: '', scan: null, picked: {}, collapsed: {}, fileFilter: '', showIgnored: false,
    sessionFiles: {}, sessionInfo: null, sessionBusy: false,
    sessionRoot: '', pendingSessionPick: false,
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
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var j = null;
        try { j = JSON.parse(txt); } catch (e) { j = null; }
        if (!j) throw new Error(t('envFail', 'no response'));
        if (!j.ok) throw new Error(j.error || 'request failed');
        return j.data;
      });
  }

  function baseName(p) { var i = p.lastIndexOf('/'); return i === -1 ? p : p.slice(i + 1); }

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
    document.body.appendChild(el);
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
  }

  var root, fab, fabLabelEl, panel;
  var pickerEl = null;

  /* ---------- 挂载 ---------- */

  function mount() {
    root = h('div', { id: 'dsh-ghu-root' });
    fabLabelEl = h('span', { text: t('fabLabel') });
    fab = h('div', { id: 'dsh-ghu-fab', title: t('fabTitle') }, [
      h('span', { html: GH_ICON, style: 'display:block;width:18px;height:18px;' }),
      fabLabelEl,
      h('span', { class: 'ghu-dot' })
    ]);
    panel = h('div', { id: 'dsh-ghu-panel' }, [
      h('div', { class: 'ghu-head' }, [
        h('span', { class: 'ghu-ttl', id: 'ghu-title', text: t('panelTitle') }),
        h('div', { class: 'ghu-lang', id: 'ghu-lang' }),
        h('button', { class: 'ghu-iconbtn', id: 'ghu-close', title: t('close'), text: '\u00D7', onclick: function () { S.open = false; render(); } })
      ]),
      h('div', { class: 'ghu-tabs', id: 'ghu-tabs' }),
      h('div', { class: 'ghu-body', id: 'ghu-body' }),
      h('div', { class: 'ghu-foot', id: 'ghu-foot' })
    ]);
    root.appendChild(fab);
    root.appendChild(panel);
    document.body.appendChild(root);
    setupFab(after('ghu-pos', {}));
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (S.picker && S.picker.open) closePicker();
        else if (S.open) { S.open = false; render(); }
      }
    });
    setInterval(keepAlive, 1500);
    boot();
  }

  function keepAlive() {
    if (root && root.parentNode !== document.body) document.body.appendChild(root);
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
   * （`"D:\\a"`）。以前这里用 `localStorage.getItem` 直接读，于是读回来的字符串**字面上就带引号**，
   * 默认填进目录框后一扫描就报「目录不存在："D:\\a"」—— 引号是这么来的，不是用户粘贴的。
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

  function setupFab(pos) {
    var x = typeof pos.x === 'number' ? pos.x : null;
    var y = typeof pos.y === 'number' ? pos.y : null;
    if (x === null) { fab.style.right = '18px'; fab.style.bottom = '92px'; }
    else { fab.style.left = x + 'px'; fab.style.top = y + 'px'; }
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
      var nx = Math.max(4, Math.min(window.innerWidth - fab.offsetWidth - 4, ox + dx));
      var ny = Math.max(4, Math.min(window.innerHeight - fab.offsetHeight - 4, oy + dy));
      fab.style.right = 'auto'; fab.style.bottom = 'auto';
      fab.style.left = nx + 'px'; fab.style.top = ny + 'px';
    });
    fab.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      fab.classList.remove('ghu-dragging');
      try { fab.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (moved) {
        var r = fab.getBoundingClientRect();
        keep(LS_POS, { x: r.left, y: r.top });
      } else {
        S.open = !S.open;
        render();
        if (S.open && S.bound && !S.repos.length) loadRepos();
        // 打开面板时如果正好停在上传页，顺手把项目目录识别出来（不用先选文件夹）。
        if (S.open && S.tab === 'upload') detectProject();
      }
    });
  }

  /* ---------- 语言 ---------- */

  function initLang() {
    // 之前这里直接读原文，存进去的其实是 `"zh"`（带引号），所以语言偏好从来没生效过。
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
    // 全部走 readString：以前直接读原文会把 JSON 引号一起读进来（令牌也一样，只是被凭据库盖住了）。
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
   * 主路径：内置文件浏览器。完全不依赖系统组件（只用宿主的 fs 列目录），所以永远可用。
   * 之前这里先试宿主的原生选择器，但原生对话框在部分环境里根本弹不出来，
   * 请求会一直挂着，界面就卡在「等待系统对话框」上了。
   */
  function pickFolder() {
    openPicker('');
  }

  /**
   * 备选：宿主的原生选择器。它在宿主侧会同步等到用户操作完为止，
   * 所以这里加一个 25 秒的客户端超时 —— 万一对话框没弹出来，界面不会永久卡住
   * （那个请求留在后台，超时后我们不再等它）。
   */
  function pickNative() {
    if (S.picking) return;
    S.picking = true;
    S.error = '';
    render();
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
      canCreate: false, truncated: false, error: '', note: note || '',
      showHidden: false, newName: ''
    };
    renderPicker();
    browseTo(S.dir && S.dir.trim() ? S.dir.trim() : '');
  }

  function browseTo(path) {
    if (!S.picker) return;
    S.picker.loading = true;
    S.picker.error = '';
    renderPicker();
    api('list-dirs', { path: path || '' }).then(function (d) {
      if (!S.picker) return;
      S.picker.loading = false;
      S.picker.path = d.path;
      S.picker.home = d.home || '';
      S.picker.crumbs = d.crumbs || [];
      S.picker.entries = d.entries || [];
      S.picker.roots = d.roots || [];
      S.picker.canCreate = d.canCreate === true;
      S.picker.truncated = d.truncated === true;
      renderPicker();
    }).catch(function (e) {
      if (!S.picker) return;
      S.picker.loading = false;
      S.picker.error = String((e && e.message) || e);
      renderPicker();
    });
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
    guard(api('mkdir-dir', { parent: S.picker.path, name: name }).then(function (d) {
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

    var listBox = h('div', { class: 'ghu-modal-list' });
    if (p.loading) {
      listBox.appendChild(h('div', { class: 'ghu-muted', style: 'padding:10px;', text: t('pkLoading') }));
    } else if (p.error) {
      listBox.appendChild(h('div', { class: 'ghu-err', style: 'margin:8px;', text: p.error }));
    } else {
      var shown = 0;
      for (var e = 0; e < p.entries.length; e++) {
        var ent = p.entries[e];
        if (ent.hidden && !p.showHidden) continue;
        shown++;
        (function (entry) {
          listBox.appendChild(h('div', {
            class: 'ghu-dirrow' + (entry.hidden ? ' ghu-hiddenrow' : ''),
            title: entry.path,
            onclick: function () { browseTo(entry.path); }
          }, [
            h('span', { class: 'ghu-diricon', text: '\uD83D\uDCC1' }),
            h('span', { class: 'ghu-grow', text: entry.name })
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
    foot.appendChild(h('button', {
      class: 'ghu-btn', text: t('pkTryNative'),
      title: t('upChooseTip'),
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
   * 点「本聊天改动的文件」：还没扫描就先扫描，扫完再勾。
   * 勾选前按写入/修改优先，一个都没有时退一步把读取过的也勾上。
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
    S.sessionBusy = true;
    S.error = '';
    render();
    api('session-files', { dir: S.scan.root }).then(function (d) {
      S.sessionBusy = false;
      S.sessionInfo = d;
      S.sessionRoot = d.projectRoot || S.scan.root;
      // 大小写不敏感地映射回本次扫描到的真实路径，顺带丢掉不在项目里的文件
      var index = {};
      for (var q = 0; q < S.scan.files.length; q++) {
        index[S.scan.files[q].path.toLowerCase()] = S.scan.files[q].path;
      }
      var map = {};
      var list = d.files || [];
      for (var i = 0; i < list.length; i++) {
        var real = index[String(list[i].path).toLowerCase()];
        if (real) map[real] = list[i].action;
      }
      S.sessionFiles = map;

      var picked = {};
      var n = 0;
      var k;
      for (k in map) if (map[k] === 'written' || map[k] === 'edited') { picked[k] = true; n++; }
      if (!n) {
        for (k in map) if (map[k] === 'read' || map[k] === 'searched') { picked[k] = true; n++; }
      }
      S.picked = picked;
      computeStats();
      render();
      if (n) toast(t('upSessionPicked', sessionLabel(d.session), n));
      else toast(d.message || t('upSessionNone'));
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
    // 绝不返回 null：调用方会直接 appendChild，null 会抛 TypeError 把整个 render 打断
    // （这正是「扫描点了没反应」的原因 —— scanNow 里 render() 在发请求之前）。
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
    fab.className = S.bound ? 'ghu-bound' : '';
    fab.title = t('fabTitle');
    if (fabLabelEl) fabLabelEl.textContent = t('fabLabel');
    var titleEl = document.getElementById('ghu-title');
    if (titleEl) titleEl.textContent = t('panelTitle');
    var closeEl = document.getElementById('ghu-close');
    if (closeEl) closeEl.title = t('close');

    /* 语言开关 */
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
      if (S.persisted === true) {
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
    if (env.nodePath) box.appendChild(kv(t('envNode'), env.nodePath));
    if (env.assetDir) box.appendChild(kv(t('envAssets'), env.assetDir));
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
      var caret = h('span', { class: 'ghu-caret', text: collapsed ? '\u25B8' : '\u25BE' });
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
      title: t('upChooseTip'),
      onclick: pickFolder
    });
    var scanBtn = h('button', {
      class: 'ghu-btn', text: S.scanBusy ? t('upScanning') : t('upScan'),
      disabled: S.scanBusy,
      onclick: scanNow
    });
    body.appendChild(h('h4', { style: 'margin:14px 0 6px;font-size:12px;color:var(--dsw-alias-label-secondary,#555);', text: t('upDirHeading') }));
    body.appendChild(h('div', { class: 'ghu-row' }, [dir, pickBtn, scanBtn]));

    /* 「本聊天改动的文件」这一行在扫描前后都要有：没扫过时点它会先扫描再勾选。 */
    var sessionRow = function () {
      return h('div', { class: 'ghu-row', style: 'margin:10px 0 8px;' }, [
        h('button', {
          class: 'ghu-btn', text: S.sessionBusy ? t('upSessionPicking') : t('upPickSession'),
          title: t('upPickSessionTip'),
          disabled: S.sessionBusy,
          onclick: pickSessionFiles
        }),
        h('span', { class: 'ghu-muted ghu-grow', text: t('upPickSessionHint') })
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

  function start() {
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
  }
  start();
})();
