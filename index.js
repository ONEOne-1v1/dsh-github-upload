/**
 * 包入口 / package entry
 *
 * Loader 按包名装载这个包，读的就是这里的具名导出：`inject` 和 `apply`。
 * 真正的宿主逻辑全在 src/host.js —— 那里是唯一需要改的地方，本文件不需要动。
 */
export { inject, apply } from './src/host.js'
