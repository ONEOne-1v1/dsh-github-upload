// 预览环境：给包根 client.js 提供最小的 ModuleLoader / React 桩。
//
// 必须在 client.js 之前加载 —— 它一执行就会调用 window.__ModuleLoader__.load(...)。
(function () {
  function showBootError(where, e) {
    try {
      var pre = document.getElementById('ghu-boot-error') || document.createElement('pre')
      pre.id = 'ghu-boot-error'
      pre.textContent = (pre.textContent ? pre.textContent + '\n' : '') + where + ': ' + (e && e.stack ? e.stack : e)
      document.body.appendChild(pre)
      document.title = 'BOOT-FAILED: ' + where
    } catch (e2) { /* ignore */ }
  }
  window.__GHU_PREVIEW_ERROR__ = showBootError
  window.addEventListener('error', function (ev) { showBootError('window.onerror', ev.message + ' @ line ' + ev.lineno) })
  window.addEventListener('unhandledrejection', function (ev) { showBootError('unhandledrejection', ev.reason) })

  // 最小 React 桩：包根的 client.js 只用到这几个 API。
  // 真实 React 的顺序是「先渲染出元素、把 ref 填好，再跑 useEffect」。这里用一个
  // slotEl 模拟「本次渲染返回的元素」：createElement 记下 ref，useEffect 里把 slotEl 赋给它。
  // （用挂起队列会在多次渲染之间串味，第一版就是这么错的。）
  var slotEl = null
  var pendingRef = null
  var ReactStub = {
    useRef: function (v) { return { current: v === undefined ? null : v } },
    useEffect: function (fn) {
      if (pendingRef && slotEl) { pendingRef.current = slotEl; pendingRef = null }
      try { fn() } catch (e) { showBootError('useEffect', e) }
    },
    createElement: function (tag, props) {
      var el = document.createElement(tag)
      // 槽位组件每次都返回一个全新的 div，它就是本次渲染的元素；
      // ref 指向的应该是这个节点（真实 React 里正是如此）。
      slotEl = el
      if (props) {
        for (var k in props) {
          if (k === 'ref') { if (props[k]) pendingRef = props[k]; continue }
          if (k === 'className') el.className = props[k]
          else if (k === 'children') continue
          else el.setAttribute(k, props[k])
        }
      }
      return el
    }
  }

  window.__ModuleLoader__ = {
    load: function (artifact) {
      var trace = []
      try {
        trace.push('load()')
        var mod = artifact.factory(function (name) {
          if (name === 'react') return ReactStub
          throw new Error('unexpected require: ' + name)
        })
        trace.push('factory ok, apply=' + typeof mod.apply)
        var host = document.createElement('div')
        host.className = 'ghu-slot-host'
        document.body.appendChild(host)
        mod.apply({
          effect: function (fn) { trace.push('effect'); return fn() },
          slots: {
            inject: function (slot, fn) { trace.push('inject'); fn() },
            register: function (meta, Comp) {
              trace.push('register ' + (meta && meta.id))
              // 模拟 React：先渲染出槽位节点并设好 slotEl，再跑 effect（此时 ref 才有效）。
              slotEl = Comp()
              trace.push('Comp -> ' + (slotEl && slotEl.tagName) + ' cls=' + (slotEl && slotEl.className) + ' fab=' + !!document.getElementById('dsh-ghu-fab'))
              return function () {}
            }
          }
        })
        trace.push('apply returned')
        // 兜底：槽位回调没把容器交进来时手动挂一次，同时把差异留在 trace 里
        var container = document.querySelector('.ghu-slot-host')
        if (container && !document.getElementById('dsh-ghu-fab') && typeof window.__DSH_GHU_MOUNT__ === 'function') {
          trace.push('manual mount fallback')
          window.__DSH_GHU_MOUNT__(container)
        }
        trace.push('fab=' + !!document.getElementById('dsh-ghu-fab') + ' panel=' + !!document.getElementById('dsh-ghu-panel'))
        var info = document.createElement('pre')
        info.id = 'ghu-boot-info'
        info.style.display = 'none'
        info.textContent = trace.join(' | ')
        document.body.appendChild(info)
      } catch (e) {
        showBootError('module load', e)
      }
    }
  }
})()
