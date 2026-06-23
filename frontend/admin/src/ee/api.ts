/**
 * CE stub for ee/api.ts
 *
 * 社区版占位模块。维护规则:
 *   - 直接被调用的 symbol(如 injectEEHeaders、tenantApi.xxx())要补 noop。
 *   - 被业务侧用 `if (xxx) { ... }` truthy 判断的 symbol —— 不要 stub,
 *     让 require 解构出 undefined,if 自动短路。常见就是 eeApi。
 *     若 stub 成 `{}`,truthy 会进 if 分支然后访问 `.sites.foo` 炸掉。
 *   - getEeApi(): 业务侧统一入口，CE 恒返回 null，让 `if (getEeApi())` 短路。
 */
export const injectEEHeaders = () => {}
export const tenantApi = {} as any
// eeApi 故意不导出 —— 见上方维护规则。

/** CE 恒返回 null —— 与 EE 版 ``getEeApi`` 签名对齐，业务侧 `if (ee)` 守卫自动短路。 */
export function getEeApi(): null {
  return null
}
