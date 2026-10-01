// 预览引导：等界面挂好之后，按 ?s=<场景> 打开面板、切标签页、可选地点某个按钮。
// 必须在 client.js 之后加载（要等 __DSH_GHU_MOUNT__ 注册完）。
(function () {
  var showBootError = window.__GHU_PREVIEW_ERROR__ || function (w, e) { console.error(w, e) }

  window.addEventListener('load', function () {
    var scenario = (window.__GHU_PREVIEW_SCENARIO__ || 'upload').replace(/-en$/, '').replace(/-?dark/, '')
    // 深色主题：主题包把深色那套变量挂在 body[data-ds-dark-theme] 上
    if (window.__GHU_PREVIEW_DARK__) document.body.setAttribute('data-ds-dark-theme', '')
    // 每次加载都把语言写回去：无头浏览器会复用 profile，上一轮的 localStorage
    // 会盖掉 URL 里的 ?lang=en / -en 后缀（第一次就是这么被"中文"骗过去的）。
    try { localStorage.setItem('dsh.ghu.lang', JSON.stringify(window.__GHU_PREVIEW_LANG__ || 'zh')) } catch (e) { /* ignore */ }
    var activeBtn = document.querySelector('.ghu-langbtn.ghu-on')
    var want = window.__GHU_PREVIEW_LANG__ === 'en' ? 'EN' : '中文'
    if (activeBtn && activeBtn.textContent !== want) {
      var all = document.querySelectorAll('.ghu-langbtn')
      for (var i = 0; i < all.length; i++) if (all[i].textContent === want) { all[i].click(); break }
    }
    // 排障用的黄色诊断条只在 ?diag=1 时显示，免得进截图
    if (!/[?&]diag=1/.test(location.search)) {
      var probe = document.getElementById('ghu-probe')
      if (probe && probe.parentNode) probe.parentNode.removeChild(probe)
    }
    var fab = document.getElementById('dsh-ghu-fab')
    if (!fab) { showBootError('mount', 'FAB missing after mount'); return }
    fab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }))
    fab.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }))

    function clickTab(label) {
      var btns = document.querySelectorAll('.ghu-tabs button')
      for (var i = 0; i < btns.length; i++) if (btns[i].textContent === label) { btns[i].click(); return true }
      return false
    }
    function clickByText(txt) {
      var btns = document.querySelectorAll('.ghu-btn, .ghu-iconbtn')
      for (var i = 0; i < btns.length; i++) if (btns[i].textContent === txt) { btns[i].click(); return true }
      return false
    }

    /** measure 模式：量入口按钮的尺寸，并验证「拖到最边上也不会因为 hover 抖动」。 */
    function measure() {
      // 先收起面板：面板打开时 FAB 会淡化，但尺寸必须恒定
      var panel = document.getElementById('dsh-ghu-panel')
      if (panel && panel.className.indexOf('ghu-open') !== -1) {
        fab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }))
        fab.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }))
      }
      var kill = document.createElement('style')
      kill.textContent = '#dsh-ghu-fab,#dsh-ghu-fab *{transition:none !important;animation:none !important;}'
      document.head.appendChild(kill)

      var out = {}
      var r0 = fab.getBoundingClientRect()
      out.base = {
        w: Math.round(r0.width), h: Math.round(r0.height),
        radius: getComputedStyle(fab).borderRadius,
        cursor: getComputedStyle(fab).cursor,
      }
      // 把按钮拖到右下角最边上，再模拟 hover/focus，断言尺寸完全不变。
      // 尺寸必须实测：写死 40 会算出 -2px 的「贴边」（差的就是按钮的真实宽高）。
      var bw = Math.round(r0.width)
      var bh = Math.round(r0.height)
      fab.style.right = 'auto'; fab.style.bottom = 'auto'
      fab.style.left = (window.innerWidth - bw - 2) + 'px'
      fab.style.top = (window.innerHeight - bh - 2) + 'px'
      var atEdge = fab.getBoundingClientRect()
      fab.classList.add('ghu-fab-expand')       // 老版本用这个类展开，现在必须无效
      var hovered = fab.getBoundingClientRect()
      fab.classList.remove('ghu-fab-expand')
      out.atEdge = {
        left: Math.round(atEdge.left), top: Math.round(atEdge.top),
        right: Math.round(window.innerWidth - atEdge.right), bottom: Math.round(window.innerHeight - atEdge.bottom),
        w: Math.round(atEdge.width), h: Math.round(atEdge.height),
      }
      out.hoverChangesSize = hovered.width !== atEdge.width || hovered.height !== atEdge.height
      out.withinViewport = atEdge.right <= window.innerWidth + 0.5 && atEdge.bottom <= window.innerHeight + 0.5

      // 量完把按钮放回默认停靠位，这样 measure 场景出的图也是真实位置。
      // 之前量完没还原，截图里的按钮位置是假的（贴在右下 2px），容易误判。
      fab.style.left = 'auto'; fab.style.top = 'auto'
      fab.style.right = '18px'; fab.style.bottom = '92px'

      kill.remove()
      var pre = document.createElement('pre')
      pre.id = 'ghu-measure'
      pre.style.display = 'none'
      pre.textContent = JSON.stringify(out)
      document.body.appendChild(pre)
      document.title = 'measured'
    }

    var labels = window.__GHU_PREVIEW_LANG__ === 'en'
      ? { account: 'Account', repo: 'Repositories', upload: 'Upload', settings: 'Repository settings' }
      : { account: '账号', repo: '仓库', upload: '上传', settings: '仓库信息' }
    var pickSession = window.__GHU_PREVIEW_LANG__ === 'en' ? 'Files from this chat' : '本聊天改动的文件'
    var chooseFolder = window.__GHU_PREVIEW_LANG__ === 'en' ? 'Choose folder' : '选择文件夹'
    var startUpload = window.__GHU_PREVIEW_LANG__ === 'en' ? 'Start upload' : '开始上传'
    setTimeout(function () {
      if (scenario === 'measure') { measure(); return }
      if (!clickTab(labels[scenario] || '上传')) showBootError('tabs', 'tab not found: ' + scenario)
      setTimeout(function () {
        if (scenario === 'upload' || scenario === 'running') clickByText(pickSession)
        if (scenario === 'picker') clickByText(chooseFolder)
        if (scenario === 'running') setTimeout(function () { clickByText(startUpload) }, 120)
        if (scenario === 'tree') {
          var carets = document.querySelectorAll('#ghu-tree .ghu-caret')
          if (carets.length) carets[0].click()
        }
        var d = document.getElementById('ghu-probe2')
        if (!d) {
          d = document.createElement('pre')
          d.id = 'ghu-probe2'
          d.style.display = 'none'
          document.body.appendChild(d)
        }
        d.textContent = 'scenario=' + scenario + ' lang=' + window.__GHU_PREVIEW_LANG__ +
          ' stored=' + (function () { try { return localStorage.getItem('dsh.ghu.lang') } catch (e) { return '?' } })() +
          ' active=' + (document.querySelector('.ghu-langbtn.ghu-on') || {}).textContent
        document.title = 'ready:' + scenario
      }, 220)
    }, 260)
  })
})()
