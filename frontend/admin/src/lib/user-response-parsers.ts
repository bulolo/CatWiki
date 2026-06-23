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

// 用户相关接口返回的松散校验工具：后端 reset-password / invite 接口的 response_model
// 标注为 dict，SDK 由此生成宽泛类型，这里做运行时收窄。

export type PasswordResponse = {
  password: string
}

export type InviteResponseWithPassword = {
  user: { email: string }
  password: string
}

export function parsePasswordResponse(data: unknown): PasswordResponse | null {
  if (!data || typeof data !== "object") {
    return null
  }
  const password = (data as { password?: unknown }).password
  return typeof password === "string" ? { password } : null
}

export function parseInviteResponse(data: unknown): InviteResponseWithPassword | null {
  if (!data || typeof data !== "object") {
    return null
  }
  const user = (data as { user?: unknown }).user
  const password = (data as { password?: unknown }).password
  if (!user || typeof user !== "object" || typeof password !== "string") {
    return null
  }
  const email = (user as { email?: unknown }).email
  if (typeof email !== "string") {
    return null
  }
  return { user: { email }, password }
}
