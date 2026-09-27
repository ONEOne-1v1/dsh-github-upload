# dsh-github-upload

A **dynamic Cordis plugin** for DeepSeek Harness: one button in the bottom-right corner that pushes a local project to GitHub — bind an account, pick or create a repository, choose which files to upload, flip a repository between public and private. All by mouse, with **zero model tokens spent**.

Bilingual UI (中文 / English, switchable in the panel header). [中文说明](README.zh.md)

- Plugin ID: `ghpush-1`
- UI assets directory: `src/` (read by the host at request time)
- No local `git` required, and no `.git` directory is created in your project

---

## 1. Features

| Panel tab | What it does |
| --- | --- |
| **Account** | Paste a GitHub Personal Access Token → verify and bind; shows token type / scopes / expiry, with an actionable hint when the token cannot see repositories; optional "remember"; one-click environment self-test |
| **Repositories** | Lists every repository the account can reach (owned + collaborator + organization member + organizations + public fallback), searchable and selectable; create a repository as public or private; **the list refreshes automatically after create / rename / visibility change**; when the list is unusable, point at `owner/repo` directly |
| **Upload** | **The project directory is detected from the chat itself** — open the tab and the folder this conversation is working in is already filled in (no folder-picking required) → scan (built-in ignore rules + `.gitignore`) → **"Files from this chat" ticks the files this conversation wrote or edited** (each such file also carries a marker in the tree) → commit message / target branch → upload with live progress and a log. `Choose folder` (system dialog or built-in browser) and manual entry remain available. |

> **What does ticking actually do?** Ticked files are **added or overwritten** on GitHub; files left unticked **stay exactly as they are on the remote**. Only the「exact sync」checkbox (`Delete remote files that are not selected`) removes remote files. Ticking everything is therefore the right move for a plain "push my project" — the per-chat selection exists for focused commits and for skipping a large repo's untouched files.
| **Repository settings** | Rename, description, homepage, topics, public ↔ private, Issues/Wiki switches, archive, delete |

---

## 2. Layout

```
dsh-github-upload/
├─ src/
│  ├─ host.js        Host half: HTTP routes, GitHub API calls, scanning, upload job
│  ├─ client.js      Browser UI (corner button + drawer panel), bilingual catalog
│  └─ client.css     Panel styles (all DSH theme tokens, light/dark automatic)
├─ build/
│  └─ bundle.mjs     Build: syntax precheck + generate the cordis_define payload
├─ dist/             Build output (generated)
│  ├─ ghpush-package.json
│  └─ host.code.txt
├─ README.md         This file (English)
├─ README.zh.md      中文说明
├─ README.i18n.yaml  Bilingual-pair consistency record (blob hashes)
├─ CHANGELOG.md      Update history (Chinese)
└─ package.json
```

---

## 3. Bilingual UI

Both message catalogs are plain positional tables, each entry `[中文, English]`:

| Where | Location | Covers |
| --- | --- | --- |
| Browser | `src/client.js` → `var M = { ... }` | Every label, button, hint and toast in the panel |
| Host | `src/host.js` → `const M = { ... }` | Errors, scan ignore reasons, upload job log, repository-source diagnostics, token hints |

`{1}` / `{2}` are positional placeholders (substituted with `split`/`join`, never a regex, so no escaping surprises).

The browser sends `lang` (`zh` / `en`) with **every** request; the host answers in that language. The switch lives in the panel header, is persisted in `localStorage` (`dsh.ghu.lang`), and defaults to the browser language on first run.

GitHub's own error messages are passed through verbatim — they are English by nature.

---

## 4. Development workflow

### UI changes (no plugin restart)

`client.js` / `client.css` are read from disk on **every HTTP request**, so:

```bash
# edit src/client.js or src/client.css, then just refresh the browser page
```

### Host changes

The host half is `code.host` — it lives in the Cordis registry, not on disk, so changing it means re-activating:

```bash
npm run build         # = node build/bundle.mjs: syntax precheck + dist/ghpush-package.json
```

Then hand `dist/ghpush-package.json` to:

1. `cordis_define` (`plugin.kind: "existing"`, `pluginId: "ghpush-1"`, `code.host` = contents of `host.code.txt`)
2. `cordis_run` (`mode: "update"`, with the new `packageId` returned by define)

> After moving the project directory you must rebuild: the hard-coded `ASSET_DIR` still points at the old path, and the build script warns about the mismatch.

### Why the UI lives on disk

The first version inlined the UI source into the host source, so every one-line UI tweak meant re-defining a ~40KB payload. Reading from disk at request time makes UI iteration a page refresh.

### Tests

```bash
npm run check     # client syntax → build (host syntax precheck) → render smoke test → cleanDir unit test
npm test          # just the two test files
```

`scripts/test-render.mjs` is a **headless smoke test**: it mounts `src/client.js` against a minimal DOM stub, then clicks the entry button, switches to the Upload tab and presses Scan, asserting that a request is actually issued. It exists because the worst bug so far was a `render()` crash — the backend was perfectly healthy and `curl` could not see it, but the UI silently stopped responding.

The test carries its own negative control:

```bash
NEGATIVE_CONTROL=drop-null-guard node scripts/test-render.mjs   # must FAIL
```

which re-injects that exact bug and must reproduce the symptom, proving the test can still catch it.

---

## 5. Host API

Every browser call is `POST /dsh-gh/api` with `{ op, lang, ...args }`, answering `{ ok, data }` or `{ ok: false, error }`.

| op | Args | Purpose |
| --- | --- | --- |
| `hello` | — | Default directory, workspace root, node path, UI assets directory, folder-picker kind |
| `ping` | — | Requests GitHub `/zen` to verify node + network (no token needed) |
| `auth-status` | — | Current binding, user, token type and hint |
| `auth-set` | `token` | Verify and bind a token |
| `auth-clear` | — | Unbind |
| `list-repos` | `query` | Merged repository list plus per-source diagnostics and token hint |
| `create-repo` | `name, private, description` | Create a repository (`auto_init: false`) |
| `get-repo` | `owner, repo` | One repository's details (including topics) |
| `update-repo` | `owner, repo, patch` | Rename / description / homepage / visibility / archive |
| `set-topics` | `owner, repo, names` | Replace topics |
| `list-branches` | `owner, repo` | Branch list |
| `delete-repo` | `owner, repo` | Delete a repository (needs `delete_repo`) |
| `scan` | `dir, useGitignore` | Recursively scan a directory: file list, ignore reasons, pruned directories |
| `session-files` | `dir?` | Detect the files this chat wrote / edited / read, by replaying `tool/call` records from a session. **Omit `dir`** to have the host pick the live session and infer the project root from the common directory of the files it mutated (returns `projectRoot` + `rootSource`) |
| `pick-folder` | — | Open the folder picker: the `native` backend opens the OS dialog and returns an absolute path; `browse`/none returns a `mode` so the UI draws its own browser |
| `list-dirs` | `path` | List one directory level (crumbs, jumpable roots, whether folder creation is supported) |
| `mkdir-dir` | `parent, name` | Create a folder (only with the `browse` backend; the system dialog has its own "New folder") |
| `upload-start` | `owner, repo, dir, files, message, branch, prune` | Start an async upload, returns `jobId` |
| `job-status` | `jobId` | Poll state, progress, log, result |

Uploads go through the GitHub **Git Data API**: read branch head → create one blob per file → create a tree (with `base_tree`) → create a commit → update/create the ref.

---

## 6. Implementation notes (pitfalls hit along the way)

| Problem | Handling |
| --- | --- |
| The dynamic host sandbox has no `fetch` / `require` / timers | HTTPS runs in a short-lived node child spawned through `subprocess`; timeouts come from `inject: ['timer']` |
| Binary files cannot go through `btoa` | A hand-written byte-level base64 encoder; text files use `encoding: "utf-8"` to avoid 33% inflation |
| A branch name containing `/` must keep literal slashes in the ref path | Split on `/`, encode each segment, re-join — otherwise it is mistaken for "branch missing" and an orphan commit is created |
| Bound successfully but no repositories appear | `list-repos` merges account-visible repos + organization repos + a public fallback and returns per-source hit counts; an empty list gets ranked guidance plus a direct `owner/repo` input |
| Approval prompts are disabled in this session, so a Client Cordis Package is auto-rejected | The whole UI is host-side: `webServer.register` serves routes, `webServer.tapIndex` injects the entry script |
| The host has no `AbortController`, but the native picker demands an `AbortSignal` | The implementation only touches `aborted` / `addEventListener` / `removeEventListener`, so it gets a duck-typed signal (this plugin never aborts: closing the dialog *is* the user's answer) |
| Ignored directories were pruned silently | Two tiers: HARD (dependency/cache) is pruned but reported by name; SOFT (build output) is listed and merely unticked by default |
| UI assets are re-read per request | UI edits need no plugin restart; the cost is that `code.host` no longer contains the UI bytes |

---

## 7. Token permissions

| Token type | What it needs |
| --- | --- |
| Classic | Tick `repo` (without it private repositories — and sometimes the whole list — are invisible); `delete_repo` to delete; `read:org` to list organizations |
| Fine-grained | Choose **All repositories** and grant **Contents: Read and write**, **Administration: Read and write**, **Metadata: Read** |

---

## 8. Known limitations

- Every file is pushed as `100644`: the **executable bit is not preserved** (the GitHub blob API cannot see local modes).
- **The first push into an empty repository creates two commits.** GitHub's Git Data API refuses everything on a repository with no commits (`409 Git Repository is empty`), so the plugin first creates one commit through the Contents API using the smallest selected file, then writes the complete tree as a second commit. No stray file is left behind, but the history has one extra entry — only for that very first push.
- Files over **25MB** are flagged as ignored during scanning (they can still be ticked, but will be rejected).
- The ignore engine is a simplified `.gitignore` (comments, `!` negation, trailing `/`, `*` / `**` / `?`); unusual patterns may be inaccurate — which is why ignored files stay tickable in the UI.
- Ignored directories come in two tiers: dependency/cache directories (`node_modules`, `.git`, `.venv`, …) are skipped **entirely** and their files never appear (the directory names are reported in the scan result); build-output directories (`dist`, `build`, `out`, `target`, …) are only **unticked by default** and remain visible and tickable.
- The token is written to the **host credential store** (`ctx.credentials`, reference `DSH_GITHUB_UPLOAD_TOKEN` → `~/.dsh/.credentials.yaml`) so it survives plugin restarts and DSH restarts, and is also kept in browser `localStorage` when "remember" is ticked. It is **never sent to the model**.
- A dynamic plugin is process-local: **after a DSH restart it must be defined / run again** (the token survives in the credential store, so nothing needs re-binding).
- Chat-file detection reads the session log's `tool/call` records, so it recognizes the `write` / `edit` / `read` / `grep` / `glob` tools. Files touched only through shell commands, or by a subagent's own session, are **not** attributed to this chat.
- Uploading builds a blob per file, so very large projects produce many API calls; the GitHub API is rate limited.

---

## 9. Troubleshooting

1. **No button** → refresh the page (the entry script is injected at page load); confirm `http://127.0.0.1:<port>/dsh-gh/app.js` opens.
2. **The button is there but the panel reports it cannot read the UI assets** → `ASSET_DIR` in `src/host.js` points at an old path; fix it or re-run `npm run build`.
3. **Bound, but the repository list is empty** → read the "source diagnostics" and the guidance in the panel; check the token scopes first (section 7), or type `owner/repo` under "Point at a repository directly".
4. **"Choose folder" opens the built-in browser, not a system dialog** → this is deliberate. The host's native picker can hang forever when its OS dialog cannot open (missing koffi, remote deployment), which used to freeze the button. The built-in browser only uses the host's `fs` listing and always works; the system dialog is available as an optional "Try the system dialog" button inside it, guarded by a 25-second timeout. Account → Local environment shows which backend kind is active.
5. **"Scan" does nothing / the Upload tab looks half-drawn** → this was a frontend crash (fixed in 0.7.1) where `render()` threw before the request was sent. If it ever comes back, run `npm run check`: the headless smoke test asserts that clicking Scan actually issues a request.
6. **Upload returns 403 / 404** → the token lacks `Contents: write`, or the owner / repository name is wrong.
7. **"Git Repository is empty"** → the target repository has no commits yet. This is handled automatically since 0.5.0; if you still see it, the Contents-API bootstrap failed — read the job log for the seeding line.
8. **The default directory came back wrapped in quotes** → this was **our own bug** (fixed in 0.7.2), not a bad paste. `keep()` writes to `localStorage` with `JSON.stringify`, so the stored text already contains quotes; `boot()` used to read it back raw and the quotes became part of the path — producing exactly the `Directory does not exist: "D:\..."` error seen earlier. Every preference is now read through `readString()` (JSON-decoding, tolerant of legacy double-encoding) and self-healed on startup. The path field still tolerates a pasted quoted path, since that genuinely happens too.
9. **Language looks half-switched** → switching language clears the previous scan and job state on purpose (host-rendered strings such as ignore reasons are already in the old language). Re-scan if you had one.
