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
| **Upload** | **Pick the project folder on this machine** (`Choose folder`: system dialog, or the built-in browser), or type the path → scan (built-in ignore rules + `.gitignore`) → tick the files to upload in a directory tree → commit message / target branch / optional "delete remote files that are not selected" → upload with live progress and a log |
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
- A dynamic plugin is process-local: **after a DSH restart it must be defined / run again**.
- Uploading builds a blob per file, so very large projects produce many API calls; the GitHub API is rate limited.

---

## 9. Troubleshooting

1. **No button** → refresh the page (the entry script is injected at page load); confirm `http://127.0.0.1:<port>/dsh-gh/app.js` opens.
2. **The button is there but the panel reports it cannot read the UI assets** → `ASSET_DIR` in `src/host.js` points at an old path; fix it or re-run `npm run build`.
3. **Bound, but the repository list is empty** → read the "source diagnostics" and the guidance in the panel; check the token scopes first (section 7), or type `owner/repo` under "Point at a repository directly".
4. **"Choose folder" shows no system dialog** → the host's `directoryPicker` native backend is unavailable (koffi missing, or a remote deployment). The panel silently switches to its built-in browser; the current picker kind is shown under Account → Local environment.
5. **Upload returns 403 / 404** → the token lacks `Contents: write`, or the owner / repository name is wrong.
6. **"Git Repository is empty"** → the target repository has no commits yet. This is handled automatically since 0.5.0; if you still see it, the Contents-API bootstrap failed — read the job log for the seeding line.
7. **Language looks half-switched** → switching language clears the previous scan and job state on purpose (host-rendered strings such as ignore reasons are already in the old language). Re-scan if you had one.
