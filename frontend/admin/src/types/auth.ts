/**
 * 认证相关类型定义
 * 
 * 注意：现在使用 SDK 生成的类型，这里仅作为兼容层
 */

import { type UserRole, type UserStatus, type UserResponse } from '@/lib/api-client'

// 导出 SDK 类型作为本地类型
export type { UserRole, UserStatus }

// 用户信息类型（兼容 SDK 的 UserResponse）
export type UserInfo = UserResponse

export interface LoginResponse {
  token: string
  user: UserInfo
}


