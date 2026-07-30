// build-flags.js — 构建期功能开关
//
// 调试版（仓库源码）保持 true。正式版打包时 scripts/package-release.js
// 会在 staging 目录里把两个开关都改写为 false，并用
// debug-log.release.js 替换完整日志实现。
//
// 注意：package-release.js 依赖下列精确写法做替换，改动格式会导致
// 打包脚本报错（这是故意的防呆）。
export const DEBUG_LOGGING_ENABLED = true;
export const DEBUG_EXPORT_ENABLED = true;
