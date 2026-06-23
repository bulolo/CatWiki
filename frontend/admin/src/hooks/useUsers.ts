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
 * React Query hooks for User management
 */

import { createAdminUser, deleteAdminUser, getListAdminUsersQueryKey, inviteAdminUser, loginAdmin, resetAdminUserPassword, updateAdminUser, useGetAdminUser, useListAdminUsers } from "@/lib/sdk/admin-users"
import type { ListAdminUsersParams, UserCreate, UserInvite, UserRole, UserStatus, UserUpdate } from "@/lib/sdk/sdk.schemas"
import { useIsAuthenticated } from "@/lib/auth-store"
import { useAdminMutation } from "./useAdminMutation"
import { STALE_TIME } from "@/lib/react-query"

interface UseUsersParams {
  page?: number
  size?: number
  role?: UserRole | string
  status?: UserStatus | string
  search?: string
  siteId?: number
  orderBy?: string
  orderDir?: "asc" | "desc"
}

/**
 * 获取用户列表（解开成 {users, total}）
 */
export function useUsers(params: UseUsersParams = {}) {
  const apiParams: ListAdminUsersParams = {
    page: params.page,
    size: params.size,
    role: params.role as UserRole | undefined,
    status: params.status as UserStatus | undefined,
    search: params.search,
    site_id: params.siteId,
    order_by: params.orderBy,
    order_dir: params.orderDir,
  }

  const isAuthed = useIsAuthenticated()
  return useListAdminUsers(apiParams, {
    query: {
      enabled: isAuthed,
      staleTime: STALE_TIME.MEDIUM,
      select: (data) => ({
        users: data?.list ?? [],
        total: data?.pagination?.total ?? 0,
      }),
    },
  })
}

/**
 * 获取单个用户详情
 */
export function useUser(userId: number | undefined) {
  const isAuthed = useIsAuthenticated()
  return useGetAdminUser(userId ?? 0, {
    query: {
      enabled: !!userId && isAuthed,
      staleTime: STALE_TIME.MEDIUM,
    },
  })
}

/**
 * 创建用户
 */
export function useCreateUser() {
  return useAdminMutation({
    mutationFn: (data: UserCreate) => createAdminUser(data),
    invalidateKeys: [getListAdminUsersQueryKey()],
  })
}

/**
 * 邀请用户
 */
export function useInviteUser() {
  return useAdminMutation({
    mutationFn: (data: UserInvite) => inviteAdminUser(data),
    invalidateKeys: [getListAdminUsersQueryKey()],
    // 邀请通常需要特殊处理返回的临时密码，由 caller 处理 onSuccess
    errorMsg: () => undefined,
  })
}

/**
 * 更新用户信息
 */
export function useUpdateUser() {
  return useAdminMutation({
    mutationFn: ({ userId, data }: { userId: number; data: UserUpdate }) =>
      updateAdminUser(userId, data),
    invalidateKeys: [["/admin/v1/users"]],
  })
}

/**
 * 更新用户角色
 */
export function useUpdateUserRole() {
  return useAdminMutation({
    mutationFn: ({ userId, role }: { userId: number; role: UserRole }) =>
      updateAdminUser(userId, { role }),
    invalidateKeys: [["/admin/v1/users"]],
  })
}

/**
 * 更新用户管理的站点
 */
export function useUpdateUserSites() {
  return useAdminMutation({
    mutationFn: ({
      userId,
      managed_site_ids,
    }: {
      userId: number
      managed_site_ids: number[]
    }) => updateAdminUser(userId, { managed_site_ids }),
    invalidateKeys: [["/admin/v1/users"]],
  })
}

/**
 * 更新用户状态
 */
export function useUpdateUserStatus() {
  return useAdminMutation({
    mutationFn: ({ userId, status }: { userId: number; status: UserStatus }) =>
      updateAdminUser(userId, { status }),
    invalidateKeys: [["/admin/v1/users"]],
  })
}

/**
 * 重置用户密码
 */
export function useResetUserPassword() {
  return useAdminMutation({
    mutationFn: (userId: number) => resetAdminUserPassword(userId),
  })
}

/**
 * 删除用户
 */
export function useDeleteUser() {
  return useAdminMutation({
    mutationFn: (userId: number) => deleteAdminUser(userId),
    invalidateKeys: [getListAdminUsersQueryKey()],
  })
}

/**
 * 用户登录
 */
export function useLogin() {
  return useAdminMutation({
    mutationFn: (data: { email: string; password: string }) => loginAdmin(data),
  })
}
