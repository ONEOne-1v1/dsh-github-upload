# 注释规约 / Comment conventions

本仓库的注释只承担一个职责：**记录代码本身看不出来的事实**。
代码怎么写、改过什么、踩过什么坑 —— 前者读代码即知，后者在 `CHANGELOG.md` 里。

## 该写

1. **反直觉的技术约束** —— 不知道就一定会误改。例如：
   - DSH 主题有一条全局 `corner-shape:superellipse(1.5)`，会把 `border-radius:50%` 压成圆角方形，
     所以圆形元素必须显式 `corner-shape:round`；
   - 客户端模块 URL 带 `cache-control: immutable`，`rev` 只由 HMR 重算，所以改完要看效果得重启 DSH；
   - `credentials.describe()` 的 `writable:false` 表示「被只读来源遮蔽」，不是「不可写」；
   - `webServer.register()` 对同一个 `(kind, path)` 重复注册会抛错；
   - git blob 的 sha 是 `sha1("blob <len>\0" + content)`，GitHub 的 tree 接口直接给出这个值。
2. **安全与正确性的理由**：为什么校验通过才落盘、为什么某处必须同步写文件、
   为什么目录列举要逐项容错。
3. **外部服务的契约要点**：方法签名、返回形状，以及为什么这样调用。
4. **文件顶部的用途说明**：几行讲清这个模块负责什么。

## 不该写

1. **开发过程叙述**：改了几轮、上一版如何、哪次事故怎么发现的 —— 这些属于 `CHANGELOG.md`。
2. **复述代码**：`// 设置语言`、`// 遍历文件`、`// 返回结果`。
3. **双语对照**：只留中文。
4. **失效的注释**：描述的代码已经不存在或已经改名。
5. **装饰性分隔线**：除非它确实在划分逻辑区块。

## 写法

- 解释**为什么**，不解释**是什么**。
- 一段注释最多讲一件事；能用一行说清就别写三行。
- 代码里的注释用中文；面向用户的文案走 `M` 表（中文 + English），不要写进注释。

## 改文件的方式

**只用 `read` / `edit` / `write` 工具改本仓库的文本文件。**
不要用 shell 做字符串替换或重写文件（`Get-Content -Raw` + 替换 + `Set-Content` 这类）：
在中文 Windows 上按错误码页往返会把 UTF-8 中文注释变成乱码，且本仓库没有 git 历史可恢复。

## 验收

```bash
npm run check      # 构建 + 18 条渲染断言 + cleanDir / internals / blobsha / picker 单测
```

`scripts/test-render.mjs` 支持对照实验（把已知 bug 注回去，证明测试抓得到）：

```bash
NEGATIVE_CONTROL=no-corner-shape npm run test:render   # 必须失败
```

可用的对照名见 `scripts/test-render.mjs` 顶部。
