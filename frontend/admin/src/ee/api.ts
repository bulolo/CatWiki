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

/**
 * CE 恒返回 null —— 业务侧 `if (ee)` 守卫在运行时自动短路。
 *
 * 返回类型放宽到结构占位（而非字面量 ``null``）：业务侧写
 * ``const ee = getEeApi(); if (ee) { ee.sites.xxx() }`` 时，CE 构建下该分支虽是死代码，
 * 但仍需通过类型检查 —— 若返回 ``null``，``if (ee)`` 会把 ``ee`` 收窄成 ``never``，
 * 访问 ``ee.sites`` 即报 “Property 'sites' does not exist on type 'never'”。放宽后死分支
 * 可编译，运行时仍恒为 null。EE 版 ``getEeApi`` 返回真实强类型，不受此影响。
 */
export function getEeApi(): Record<string, any> | null {
  return null
}
