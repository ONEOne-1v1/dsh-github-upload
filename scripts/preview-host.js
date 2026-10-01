// 预览用的假宿主：全部走内存，不发真请求。
// 由 scripts/preview.mjs 生成的自包含 HTML 以 <script src> 引入（file:// 同目录可直接加载外部脚本）。
window.__GHU_PREVIEW_SCENARIO__ = (/[?&]s=([a-z-]+)/.exec(location.search) || [])[1] || 'upload'
// 场景名带 -en 后缀就是英文界面（用 &lang=en 也行，但 shell 里 & 很容易被吃掉）
window.__GHU_PREVIEW_LANG__ = /-en$/.test(window.__GHU_PREVIEW_SCENARIO__) ||
  /[?&]lang=en/.test(location.search) ? 'en' : 'zh'
// 场景名出现 dark 就是深色主题（预览用的主题变量里深色那套挂在 body[data-ds-dark-theme] 上）
window.__GHU_PREVIEW_DARK__ = /dark/.test(window.__GHU_PREVIEW_SCENARIO__) || /[?&]theme=dark/.test(location.search)

try { localStorage.setItem('dsh.ghu.lang', JSON.stringify(window.__GHU_PREVIEW_LANG__)) } catch (e) { /* ignore */ }

try { localStorage.setItem('dsh.ghu.lang', JSON.stringify('zh')) } catch (e) { /* ignore */ }
try {
  localStorage.setItem('dsh.ghu.repo', JSON.stringify({
    owner: 'ONEOne-1v1', name: 'dsh-github-upload', fullName: 'ONEOne-1v1/dsh-github-upload',
    private: false, defaultBranch: 'main'
  }))
  localStorage.setItem('dsh.ghu.dir', JSON.stringify('D:/projects/sample-app'))
} catch (e) { /* ignore */ }

var FILES = [
  ['client.js', 114700, false, ''], ['index.js', 294, false, ''], ['package.json', 1224, false, ''],
  ['cordis.patch.yml', 305, false, ''], ['icon.svg', 468, false, ''], ['README.md', 15984, false, ''],
  ['README.zh.md', 15474, false, ''], ['CHANGELOG.md', 18535, false, ''], ['README.i18n.yaml', 371, false, ''],
  ['src/host.js', 76728, false, ''], ['src/client.js', 89600, false, ''], ['src/client.css', 23000, false, ''],
  ['build/bundle.mjs', 4796, false, ''], ['scripts/test-render.mjs', 15000, false, ''],
  ['scripts/test-cleandir.mjs', 2817, false, ''], ['scripts/test-internals.mjs', 7000, false, ''],
  ['locale/zh.json', 283, false, ''], ['locale/en.json', 300, false, ''],
  ['dist/bundle.js', 45120, true, '内置忽略（构建产物）：dist'],
  ['debug.log', 120, true, '内置忽略：.log']
]

var REPOS = [
  { name: 'dsh-github-upload', fullName: 'ONEOne-1v1/dsh-github-upload', owner: 'ONEOne-1v1', private: false, archived: false, fork: false, description: 'One-button GitHub upload for DeepSeek Harness', homepage: '', defaultBranch: 'main', url: 'https://github.com/ONEOne-1v1/dsh-github-upload', updatedAt: '2026-09-27T18:17:30Z', pushedAt: '2026-09-27T18:17:30Z', hasIssues: true, hasWiki: false, topics: ['dsh', 'cordis', 'plugin'] },
  { name: 'dotfiles', fullName: 'ONEOne-1v1/dotfiles', owner: 'ONEOne-1v1', private: true, archived: false, fork: false, description: '我的配置', homepage: '', defaultBranch: 'main', url: 'https://github.com/ONEOne-1v1/dotfiles', updatedAt: '2026-09-20T10:00:00Z', pushedAt: '2026-09-20T10:00:00Z', hasIssues: true, hasWiki: false, topics: [] },
  { name: 'scratch', fullName: 'ONEOne-1v1/scratch', owner: 'ONEOne-1v1', private: false, archived: true, fork: false, description: '', homepage: '', defaultBranch: 'master', url: 'https://github.com/ONEOne-1v1/scratch', updatedAt: '2026-08-01T10:00:00Z', pushedAt: '2026-08-01T10:00:00Z', hasIssues: false, hasWiki: true, topics: [] }
]

var UPLOAD = {
  root: 'D:/projects/sample-app', totalSize: 400000, truncated: false, gitignore: 2,
  prunedDirs: ['node_modules'], prunedCount: 1,
  files: FILES.map(function (f) { return { path: f[0], size: f[1], ignored: f[2], reason: f[3] } })
}

var SESSION = {
  available: true, projectRoot: 'D:/projects/sample-app', rootSource: 'files',
  session: { id: 's1', title: '插件功能自测与改进建议', chosenBy: 'live', live: true, matched: true, sessions: 12 },
  counts: { written: 4, edited: 2, read: 3, searched: 1 }, inside: 6, outside: 1, toolCalls: 31,
  files: [
    { path: 'src/client.js', action: 'written' }, { path: 'src/client.css', action: 'edited' },
    { path: 'src/host.js', action: 'read' }, { path: 'client.js', action: 'written' },
    { path: 'scripts/test-render.mjs', action: 'edited' }, { path: 'CHANGELOG.md', action: 'written' }
  ]
}

function reply(op) {
  if (op === 'hello') return { projectRoot: 'D:/projects/sample-app', workspaceRoot: 'D:/projects/sample-app', fsRoot: 'D:/projects/sample-app', nodePath: 'C:/Program Files/nodejs/node.EXE', assetDir: '/D:/projects/sample-app/src/', picker: { kind: 'native' } }
  if (op === 'auth-status') return { bound: true, user: { login: 'ONEOne-1v1', name: '万万', avatar: '', url: 'https://github.com/ONEOne-1v1' }, token: { kind: 'classic', scopes: 'repo, workflow, delete_repo' }, hint: 'classic 令牌权限看起来正常。', persisted: true }
  if (op === 'list-repos') return { repos: REPOS, total: REPOS.length, diag: ['账号可见仓库：新增 3 个', '所属组织：0 个（或令牌缺少 read:org 权限）'], token: { kind: 'classic', scopes: 'repo' }, hint: '' }
  if (op === 'list-branches') return { branches: ['main', 'dev'] }
  if (op === 'scan') return UPLOAD
  if (op === 'session-files') return SESSION
  if (op === 'ping') return { status: 200, zen: 'Speak like a human.', node: 'node' }
  if (op === 'list-dirs') return { path: 'D:/projects', home: 'C:/Users/you', crumbs: [{ name: 'D:', path: 'D:/' }, { name: 'projects', path: 'D:/projects' }], entries: [{ name: 'sample-app', path: 'D:/projects/sample-app', hidden: false }, { name: 'another-app', path: 'D:/projects/another-app', hidden: false }], roots: [{ name: 'C:', path: 'C:/' }, { name: 'D:', path: 'D:/' }], canCreate: false }
  if (op === 'job-status') return { id: 'job1', state: 'running', phase: '上传文件内容', total: 19, done: 11, current: 'src/client.js', log: ['17:02:11  目标仓库 ONEOne-1v1/dsh-github-upload，分支 main', '17:02:12  远程分支已存在 head=a1b2c3d4', '17:02:13  文件内容已上传（11 个）'], result: null, error: null }
  if (op === 'upload-start') return { jobId: 'job1' }
  return {}
}

window.fetch = function (url, init) {
  var op = ''
  try { op = JSON.parse(init.body).op } catch (e) { /* ignore */ }
  var data = reply(op)
  return Promise.resolve({ text: function () { return Promise.resolve(JSON.stringify({ ok: true, data: data })) } })
}
