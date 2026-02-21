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
 * 统一错误处理工具
 */

/**
 * 处理 API 错误
 */
export function handleApiError(error: unknown, defaultMessage = "操作失败"): string {
  if (error instanceof Error) {
    return error.message || defaultMessage
  }
  if (typeof error === "string") {
    return error
  }
  return defaultMessage
}

/**
 * 安全的错误日志记录
 */
export function logError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === "development") {
    console.error(`[${context}]`, error)
  }
  // 生产环境可以在这里集成错误监控服务（如 Sentry）
}

