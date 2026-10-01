# dsh-github-upload

A **Cordis bundle** for DeepSeek Harness: one button in the bottom-right corner that pushes a local project to GitHub — bind an account, pick or create a repository, choose which files to upload, flip a repository between public and private. All by mouse, with **zero model tokens spent**.

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
| **Upload** | **The project directory is detected from the chat itself** — open the tab and the folder this conversation is working in is already filled in (no folder-picking required) → scan (built-in ignore rules + `.gitignore`) → **"Unpushed changes" ticks every file that differs from the remote branch** (accumulated across conversations, compared by content; files this chat touched also carry a marker in the tree) → commit message / target branch → upload with live progress and a log. `Choose folder` (built-in browser, plus a system-dialog button) and manual entry remain available. |

> **What does ticking actually do?** Ticked files are **added or overwritten** on GitHub; files left unticked **stay exactly as they are on the remote**. Only the「exact sync」checkbox (`Delete remote files that are not selected`) removes remote files. Ticking everything is therefore the right move for a plain "push my project" — the per-chat selection exists for focused commits and for skipping a large repo's untouched files.
| **Repository settings** | Rename, description, homepage, topics, public ↔ private, Issues/Wiki switches, archive, delete |

> **The panel is a floating card, not an edge-docked drawer.** The desktop window's close / exit buttons sit in the
> top-right corner, so the panel keeps a gap on all four sides (top inset `--ghu-top`, 52px by default — see
> `src/client.css`): the close button lives at the panel's **bottom-right**, the header's left end is a "minimize"
> button, and clicking outside or pressing Esc also dismisses it. The window corner therefore stays clear.
>
> **The corner entry button is a 46×46 circle: a DSH-themed surface with the GitHub logo (30px) plus a status dot.**
> There is no text on it (the wording lives in the tooltip / accessible name). It can be dragged flush to any edge
> (vertical range is limited to the lower half, away from the title bar) and it **never changes size** — it does not
> expand on hover, nor while the panel is open. That is deliberate: an entry button that expands on hover jitters
> when parked at an edge (grow → overflow → clamp back → pointer leaves → collapse), which makes it impossible to
> drag or click reliably.
>
> Note it is **not** the dark GitHub-brand pill: that dark language looks like a foreign sticker on DSH's light UI.
> The surface uses `--dsw-alias-bg-layer-2` + an elevation shadow + a 1px hairline stroke, the icon uses
> `--dsw-alias-label-primary`, and hover uses `--dsw-alias-interactive-bg-hover-solid` — it is "a DSH overlay button
> that happens to carry the GitHub mark".
>
> ⚠️ **Both the button and the status dot must pin `corner-shape:round`.** The DSH theme ships a global rule
> (`dsh-client-ui-theme` → `corner-shape.css`) that turns every corner into a "superellipse" (squircle). That is a
> good look for cards, but it squashes a `border-radius:50%` circle into a **rounded square**. Only browsers that
> support the property (Chrome/Edge 139+) show it that way — drop those two declarations and the button stops
> looking round.

---

## 2. Layout

```
dsh-github-upload/
├─ index.js          Package entry: re-exports src/host.js
├─ client.js         GENERATED ModuleLoader artifact (UI + CSS), registers into shell.overlay
├─ src/
│  ├─ host.js        Host half: API route, GitHub calls, scanning, upload job (real ES module)
│  ├─ client.js      Browser UI (corner button + floating panel), bilingual catalog
│  └─ client.css     Panel styles (all DSH theme tokens, light/dark automatic; `--ghu-top` sets the top inset)
├─ cordis.patch.yml  Bundle patch: inserts the plugin row
├─ locale/           Display metadata for the Plugin Manager (zh + en)
├─ icon.svg          Bundle icon
├─ build/
│  └─ bundle.mjs     Assembles client.js from src/client.js + src/client.css
├─ README.md         This file (English)
├─ README.zh.md      中文说明
├─ README.i18n.yaml  Bilingual-pair consistency record (blob hashes)
├─ CHANGELOG.md      Update history (Chinese)
└─ package.json      Bundle manifest (dsh.bundle.patch + dsh.client)
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

### Install

```bash
npm run build          # regenerate client.js from src/ (required after any src/ edit)
```

Then install the package directory as a bundle (this installs it into the current profile and survives restart):

```
plugin_manager  action: install_bundle  target: <absolute path to this directory>
```

Follow the result's `application` and `warnings` fields — not server logs — to know whether it is live. `applyIndexTaps` / route registration are not needed: the Host registers one API route, and the UI arrives through the module loader.

### Iterating

| Changed | Effective after |
| --- | --- |
| `src/client.js`, `src/client.css` | `npm run build`, then **restart DSH** (see the cache trap below — a page refresh alone may not be enough) |
| `src/host.js`, `index.js`, `cordis.patch.yml`, `package.json` | `install_bundle` again, then a Harness restart to load a fresh module generation |

> **Trap: after rebuilding the client, a page refresh may still run the old UI.**
> DSH serves client modules with `cache-control: public, max-age=31536000, immutable`, at a URL shaped like
> `/plugins/??<pkg>/client.js&rev=<content hash>`. That `rev` **only changes when HMR recomputes it**
> (`rebuilt(id)` in `dsh-client-modules`). If HMR does not recompute it, the URL is unchanged and the browser
> serves its "immutable" cached copy — refreshing any number of times returns the old bundle.
> **Restart DSH** so the host recomposes and hands out a new `rev`.
> To check which build a page is actually running: panel → Account → Local environment → "UI build", shown as
> `1.0.1+252bba5a` (version + asset fingerprint, generated by `build/bundle.mjs` and printed during the build).
>
> **Debugging a plugin that did not mount**: start DSH with `DSH_GHU_DIAG=1` and the host writes one record
> when the module is loaded plus one per step of `apply()`, to `DSH_GHU_DIAG_FILE` (default: a
> `dsh-github-upload-diag.jsonl` in the system temp directory) and to the console. It is off by default and
> writes nothing when off. It separates "the new code was never loaded" from "loaded, but a later step
> failed silently".

The profile installs this package as a **link** to the working directory (`link:/path/to/dsh-github-upload`, materialised on Windows as a junction under `node_modules/@local/`), so the files on disk are the files that run — and no reinstall is needed after an edit.

> **Watch out:** the profile's dependency can also be a GitHub spec (`github:<owner>/<repo>`). That installs a **snapshot copy**, not a link, so local edits stay invisible (this is exactly how a "fixed but still broken" panel happens). `plugin_manager install_bundle <absolute workspace path>` switches it to the link form.

### Why the UI is a generated artifact

Earlier versions served the UI over an HTTP route and tapped `index.html` to inject a `<script>` tag. That is no longer needed: the package declares `dsh.client` and the page's own module loader loads `client.js`, which registers a component into the `shell.overlay` slot. `src/client.js` stays a plain browser script (it imports nothing), and the build wraps it — so the UI code is unchanged while the delivery is now the supported one.

> **Loading contract (read before touching `build/bundle.mjs`)**: the artifact's `factory` only pulls
> in `react` and returns the plugin object; **the UI script is wrapped as `mountUi()` and runs exactly
> once, from `apply()`** — never move it back into the factory body. `src/client.js` is a
> self-executing IIFE whose first line returns early once it has initialised, so running it at factory
> time makes the `apply()` run hit that guard: the slot registration and the mount entry point are
> skipped, the plugin still reports `active`, and the UI never appears — with no error at all.
> `scripts/test-artifact.mjs` guards exactly this: it loads the generated artifact and walks the real
> load → apply → mount path.

### Tests

```bash
npm run check     # client syntax → build (host syntax precheck) → render smoke test → cleanDir unit test → host-internals unit test
npm test          # just the three test files
```

`scripts/test-render.mjs` is a **headless smoke test**: it mounts `src/client.js` against a minimal DOM stub, then clicks the entry button, switches to the Upload tab and presses Scan, asserting that a request is actually issued. It exists because the worst bug so far was a `render()` crash — the backend was perfectly healthy and `curl` could not see it, but the UI silently stopped responding. It also guards the desktop layout: no interactive control in the panel's top-right corner, a top gap in the panel geometry, and a draggable entry button that cannot be parked over the window controls.

`scripts/test-internals.mjs` extracts the host's riskiest pure functions (hand-written base64 encoder, ref/content path encoding, `.gitignore` matching, project-root inference) out of `src/host.js` and asserts them directly.

Every regression test carries its own negative control, and each one must FAIL:

```bash
NEGATIVE_CONTROL=drop-null-guard       node scripts/test-render.mjs   # render() crash
NEGATIVE_CONTROL=raw-localstorage-read node scripts/test-render.mjs   # quoted default directory
NEGATIVE_CONTROL=close-in-header       node scripts/test-render.mjs   # controls back in the header
NEGATIVE_CONTROL=docked-panel          node scripts/test-render.mjs   # panel back over the window corner
NEGATIVE_CONTROL=fab-unclamped         node scripts/test-render.mjs   # entry button back in the title bar
```

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
| `pending-files` | `owner, repo, dir, branch?, deep?` | List the files whose content differs from the remote branch — the "unpushed changes" comparison. One tree read plus a per-file size / git-blob-sha check; `deep` also byte-compares equal-sized files |
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
| The plugin sandbox has no `fetch` / `require` / timers | HTTPS runs in a short-lived node child spawned through `subprocess`; timeouts come from `inject: ['timer']` |
| Binary files cannot go through `btoa` | A hand-written byte-level base64 encoder; text files use `encoding: "utf-8"` to avoid 33% inflation |
| A branch name containing `/` must keep literal slashes in the ref path | Split on `/`, encode each segment, re-join — otherwise it is mistaken for "branch missing" and an orphan commit is created |
| Bound successfully but no repositories appear | `list-repos` merges account-visible repos + organization repos + a public fallback and returns per-source hit counts; an empty list gets ranked guidance plus a direct `owner/repo` input |
| `shell.overlay` is a click-through layer | The container and root opt **out** (`pointer-events: none`) and only the button, panel, toast and modal opt back **in**; otherwise the button renders but cannot be clicked |
| The host has no `AbortController`, but the native picker demands an `AbortSignal` | The implementation only touches `aborted` / `addEventListener` / `removeEventListener`, so it gets a duck-typed signal (this plugin never aborts: closing the dialog *is* the user's answer) |
| Ignored directories were pruned silently | Two tiers: HARD (dependency/cache) is pruned but reported by name; SOFT (build output) is listed and merely unticked by default |
| A `JSON.stringify` write to `localStorage` read back raw | Preferences now go through `readString()`, which JSON-decodes (and tolerates legacy double-encoding) and self-heals on startup — earlier the stored quotes became part of the project path |
| A Frontend crash silently disabled a whole tab | `npm run check` runs a headless smoke test that mounts the UI and asserts a click on Scan actually issues a request |

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
- This is a **profile bundle**: installed with `plugin_manager install_bundle`, it applies to every session in the profile and **survives restarts** (unlike the earlier dynamic package, which had to be re-defined after each restart).
- Chat-file detection reads the session log's `tool/call` records, so it recognizes the `write` / `edit` / `read` / `grep` / `glob` tools. Files touched only through shell commands, or by a subagent's own session, are **not** attributed to this chat.
- Uploading builds a blob per file, so very large projects produce many API calls; the GitHub API is rate limited.

---

## 9. Troubleshooting

1. **No button** → refresh the page first (the client artifact is loaded by the page's module loader). Still missing? Check Settings → Plugins that `@local/dsh-github-upload` is enabled; it is a local profile bundle, not a shipped official one.
2. **The button is visible but cannot be clicked** → `shell.overlay` is a click-through layer, so an entry must opt back into pointer events. The `.ghu-slot-host` / `#dsh-ghu-root` / `#dsh-ghu-fab` rules in `src/client.css` do exactly that — do not remove them.
3. **The panel covers the window's close / exit button** → in DSH Desktop the window controls are drawn *above* the page in the top-right corner. Two things together keep them reachable:
   (a) the panel header is **title-only**, with the language switch and Close button in the bottom control bar (`.ghu-panelctl`, right-aligned) — do not move them back into the header;
   (b) the panel is a **floating card** with a gap on all four sides (`top:var(--ghu-top)`, 52px by default — see `#dsh-ghu-panel`), **not** a drawer running from the window's top edge to the bottom — do not restore `top:0;right:0;bottom:0`.
   Dismiss it with the header's minimize button, the bottom-right Close button, **Esc**, a click outside, or the corner button again.
   `npm run check` guards both with four assertions and three negative controls (`NEGATIVE_CONTROL=docked-panel` / `fab-unclamped` / `close-in-header`).
4. **Bound, but the repository list is empty** → read the "source diagnostics" and the guidance in the panel; check the token scopes first (section 7), or type `owner/repo` under "Point at a repository directly".
5. **"Choose folder" opens the built-in browser — where is the system dialog?** → the built-in browser opens first (crumbs, drives, filter, new-folder, and a clear view of the directory structure). Its footer has a **"System dialog"** button (shown only when the host's native picker is available) that opens the OS chooser. The two complement each other: the browser lists directories through `uiWorkspace.listDirectory()`, which is refused in a few system-restricted locations (for example the root `D:\`); the OS dialog needs no listing, so you can navigate anywhere. On a host without a native picker (a remote deployment, say) the button does not appear and the browser is used alone.
6. **"Scan" does nothing / the Upload tab looks half-drawn** → this was a frontend crash (fixed in 0.7.1) where `render()` threw before the request was sent. If it ever comes back, run `npm run check`: the headless smoke test asserts that clicking Scan actually issues a request.
7. **Upload returns 403 / 404** → the token lacks `Contents: write`, or the owner / repository name is wrong.
8. **"Git Repository is empty"** → the target repository has no commits yet. This is handled automatically since 0.5.0; if you still see it, the Contents-API bootstrap failed — read the job log for the seeding line.
9. **The default directory came back wrapped in quotes** → this was **our own bug** (fixed in 0.7.2), not a bad paste. `keep()` writes to `localStorage` with `JSON.stringify`, so the stored text already contains quotes; `boot()` used to read it back raw and the quotes became part of the path — producing exactly the `Directory does not exist: "D:\..."` error seen earlier. Every preference is now read through `readString()` (JSON-decoding, tolerant of legacy double-encoding) and self-healed on startup. The path field still tolerates a pasted quoted path, since that genuinely happens too.
10. **Language looks half-switched** → switching language clears the previous scan and job state on purpose (host-rendered strings such as ignore reasons are already in the old language). Re-scan if you had one.
