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


