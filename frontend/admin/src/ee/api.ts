/**
 * CE stub for ee/api.ts
 *
 * 社区版占位模块。维护规则:
 *   - 直接被调用的 symbol(如 injectEEHeaders、tenantApi.xxx())要补 noop。
 *   - 被业务侧用 `if (xxx) { ... }` truthy 判断的 symbol —— 不要 stub,
 *     让 require 解构出 undefined,if 自动短路。常见就是 eeApi。
 *     若 stub 成 `{}`,truthy 会进 if 分支然后访问 `.sites.foo` 炸掉。
 */
export const injectEEHeaders = () => {};
export const tenantApi = {} as any;
// eeApi 故意不导出 —— 见上方维护规则。
