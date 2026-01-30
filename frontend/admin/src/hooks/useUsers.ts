/**
 * React Query hooks for User management
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { UserResponse, UserRole, UserStatus, UserCreate, UserInvite, UserUpdate } from '@/lib/api-client'
import { isAuthenticated } from '@/lib/auth'
import { useAdminMutation } from './useAdminMutation'

// ==================== Query Keys ====================

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters?: any) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: number) => [...userKeys.details(), id] as const,
}

// ==================== Hooks ====================

interface UseUsersParams {
  page?: number
  size?: number
  role?: UserRole | string
  status?: UserStatus | string
  search?: string
  siteId?: number
  orderBy?: string
  orderDir?: 'asc' | 'desc'
}

/**
 * 获取用户列表
 */
export function useUsers(params: UseUsersParams = {}) {
  const isAuth = isAuthenticated()

  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => api.user.list(params).then((res: any) => ({
      users: res.list || [],
      total: res.pagination?.total || 0,
    })),
    enabled: isAuth,
    staleTime: 3 * 60 * 1000,
  })
}

/**
 * 获取单个用户详情
 */
export function useUser(userId: number | undefined) {
  const isAuth = isAuthenticated()

  return useQuery({
    queryKey: userKeys.detail(userId!),
    queryFn: () => api.user.get(userId!),
    enabled: !!userId && isAuth,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 创建用户
 */
export function useCreateUser() {
  return useAdminMutation({
    mutationFn: (data: UserCreate) => api.user.create(data),
    invalidateKeys: [userKeys.lists()],
    successMsg: '用户创建成功',
  })
}

/**
 * 邀请用户
 */
export function useInviteUser() {
  return useAdminMutation({
    mutationFn: (data: UserInvite) => api.user.invite(data),
    invalidateKeys: [userKeys.lists()],
    // 邀请通常需要特殊处理返回的临时密码，由 caller 处理 onSuccess
    // 错误也由 caller 处理 (CreateUserForm)
    errorMsg: () => undefined,
  })
}

/**
 * 更新用户信息
 */
export function useUpdateUser() {
  return useAdminMutation({
    mutationFn: ({ userId, data }: { userId: number; data: UserUpdate }) =>
      api.user.update(userId, data) as any,
    invalidateKeys: [userKeys.all],
    successMsg: '用户更新成功',
  })
}

/**
 * 更新用户角色
 */
export function useUpdateUserRole() {
  return useAdminMutation({
    mutationFn: ({ userId, role }: { userId: number; role: UserRole }) =>
      api.user.update(userId, { role }),

    invalidateKeys: [userKeys.all],
    successMsg: '用户角色更新成功',
  })
}

/**
 * 更新用户管理的站点
 */
export function useUpdateUserSites() {
  return useAdminMutation({
    mutationFn: ({ userId, managed_site_ids }: { userId: number; managed_site_ids: number[] }) =>
      api.user.update(userId, { managed_site_ids }),
    invalidateKeys: [userKeys.all],
    successMsg: '用户站点权限更新成功',
  })
}

/**
 * 更新用户状态
 */
export function useUpdateUserStatus() {
  return useAdminMutation({
    mutationFn: ({ userId, status }: { userId: number; status: UserStatus }) =>
      api.user.update(userId, { status }) as any,

    invalidateKeys: [userKeys.all],
    successMsg: (res: UserResponse) => res.status === 'inactive' ? '用户已禁用' : '用户已启用',
  })
}

/**
 * 重置用户密码
 */
export function useResetUserPassword() {
  return useAdminMutation({
    mutationFn: (userId: number) => api.user.resetPassword(userId),
    successMsg: '密码重置成功',
  })
}

/**
 * 删除用户
 */
export function useDeleteUser() {
  return useAdminMutation({
    mutationFn: (userId: number) => api.user.delete(userId),
    invalidateKeys: [userKeys.lists()],
    successMsg: '用户删除成功',
  })
}

/**
 * 用户登录
 */
export function useLogin() {
  return useAdminMutation({
    mutationFn: (data: { email: string; password: string }) => api.user.login(data),
    // 登录通常不显示通用 successMsg，由 caller 处理跳转
  })
}


