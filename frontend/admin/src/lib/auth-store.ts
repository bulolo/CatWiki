// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * 响应式认证状态。
 *
 * 背景：`auth.ts` 把 token / 用户信息 / 租户选择 存在 localStorage，本身不具响应式。
 * 过去组件与 hook 在 render 期直接调用 `isAuthenticated()` / `getUserInfo()`，存在两个问题：
 *   1. 非响应式 —— 登录/登出/切租户后，依赖它的 React Query `enabled` 门控与 UI 不会自动更新；
 *   2. 每次 render 都同步读 localStorage（并 JSON.parse），有性能与一致性隐患。
 *
 * 这里用 `useSyncExternalStore` 把 localStorage 适配成单一可订阅的外部 store：
 *   - 快照只在 `auth.ts` 触发 `emitAuthChange()`（登录/登出/切租户）或跨标签页 `storage` 事件时重算；
 *   - `getSnapshot` 返回稳定引用，避免 useSyncExternalStore 的无限重渲染告警。
 */

"use client"

import { useSyncExternalStore } from "react"
import type { UserResponse } from "@/lib/sdk/sdk.schemas"
import { getSelectedTenantId, getUserInfo, isAuthenticated, subscribeAuthChange } from "./auth"

export interface AuthSnapshot {
  isAuthenticated: boolean
  user: UserResponse | null
  selectedTenantId: number | null
}

// SSR / 首屏快照：必须是稳定引用，且与服务端渲染结果一致（未认证）。
const SERVER_SNAPSHOT: AuthSnapshot = {
  isAuthenticated: false,
  user: null,
  selectedTenantId: null,
}

let snapshot: AuthSnapshot = SERVER_SNAPSHOT

function computeSnapshot(): AuthSnapshot {
  return {
    isAuthenticated: isAuthenticated(),
    user: getUserInfo(),
    selectedTenantId: getSelectedTenantId(),
  }
}

const listeners = new Set<() => void>()
let teardown: (() => void) | null = null

function refresh() {
  snapshot = computeSnapshot()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  // 首个订阅者接入时，开始监听 auth 变更 + 跨标签页 storage，并同步一次当前快照。
  if (listeners.size === 0) {
    snapshot = computeSnapshot()
    const unsubAuth = subscribeAuthChange(refresh)
    const onStorage = () => refresh()
    window.addEventListener("storage", onStorage)
    teardown = () => {
      unsubAuth()
      window.removeEventListener("storage", onStorage)
    }
  }

  listeners.add(listener)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && teardown) {
      teardown()
      teardown = null
    }
  }
}

function getSnapshot(): AuthSnapshot {
  return snapshot
}

function getServerSnapshot(): AuthSnapshot {
  return SERVER_SNAPSHOT
}

/** 响应式读取完整认证快照。 */
export function useAuth(): AuthSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** 响应式：当前是否已认证（用于 React Query `enabled` 门控与路由保护）。 */
export function useIsAuthenticated(): boolean {
  return useAuth().isAuthenticated
}

/** 响应式：当前登录用户信息。 */
export function useCurrentUser(): UserResponse | null {
  return useAuth().user
}

/** 响应式：当前选中的租户 ID（仅管理员 / EE）。 */
export function useSelectedTenantId(): number | null {
  return useAuth().selectedTenantId
}
