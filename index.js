/**
 * 包入口
 *
 * Loader 按包名装载这个包，读的就是这里的具名导出：`inject` 和 `apply`。
 * 宿主逻辑全在 src/host.js。
 */
export { inject, apply } from './src/host.js'
