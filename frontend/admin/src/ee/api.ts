/**
 * CE stub for ee/api.ts
 * 
 * 社区版占位模块，提供与 EE 版相同的导出签名，
 * 所有功能均为空实现。
 * 
 * 维护规则：当 ee/api.ts 新增 export 时，同步在此添加对应的空实现。
 */
export const injectEEHeaders = () => {};
export const tenantApi = {} as any;
// EE 版 ee/api.ts 还导出了一个 eeApi 聚合对象(含 tenant / sites / chatSessions
// 三个子命名空间)。业务代码统一通过 require + try/catch 取用,所以即使这里只
// 给个空 object,运行时 `eeApi?.sites?.xxx` 会安全降级到 undefined。
export const eeApi = {} as any;
