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
 * 环境变量验证和类型定义
 * 
 * 使用 zod 在应用启动时验证所有必需的环境变量，
 * 确保配置正确，避免运行时错误。
 */

import { z } from 'zod'

/**
 * 环境变量 Schema
 */
/**
 * 校验是否为占位符 (用于 Docker 运行时注入)
 */
const isPlaceholder = (val: unknown) =>
  typeof val === 'string' && val.startsWith('__NEXT_PUBLIC_') && val.endsWith('_PLACEHOLDER__');

const envSchema = z.object({
  // ==================== 客户端环境变量 ====================

  /**
   * API 基础 URL
   */
  NEXT_PUBLIC_API_URL: z.preprocess(
    (val) => (isPlaceholder(val) ? '/api-proxy' : val),
    z.string()
      .min(1, { message: 'NEXT_PUBLIC_API_URL 不能为空' })
      .refine(
        (val) => val.startsWith('/') || z.string().url().safeParse(val).success,
        { message: 'NEXT_PUBLIC_API_URL 必须是有效的 URL 或以 / 开头的路径' }
      )
      .default('http://localhost:3000')
  ),

  /**
   * 应用环境
   */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  /**
   * 是否启用调试模式
   */
  NEXT_PUBLIC_DEBUG: z.preprocess(
    (val) => (isPlaceholder(val) ? 'false' : val),
    z.enum(['true', 'false'])
      .optional()
      .default('false')
      .transform((val) => val === 'true')
  ),

  /**
   * 管理后台地址
   */
  NEXT_PUBLIC_ADMIN_URL: z.preprocess(
    (val) => (isPlaceholder(val) ? 'http://localhost:8001' : val),
    z.string().url().optional().default('http://localhost:8001')
  ),

  /**
   * 文档站点地址
   */
  NEXT_PUBLIC_DOCS_URL: z.preprocess(
    (val) => (isPlaceholder(val) ? 'http://localhost:8003' : val),
    z.string().url().optional().default('http://localhost:8003')
  ),
})

/**
 * 环境变量类型
 */
export type Env = z.infer<typeof envSchema>

/**
 * 验证并获取环境变量
 */
function validateEnv(): Env {
  try {
    return envSchema.parse({
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG,
      NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL,
      NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map((err) => `  ❌ ${err.path.join('.')}: ${err.message}`)
        .join('\n')

      console.error('❌ 环境变量验证失败:\n\n' + errorMessage)

      if (process.env.NODE_ENV === 'development') {
        // 开发环境下抛出错误以便及时发现
        // throw new Error('环境变量验证失败')
      }
    }
    // 回退到默认值
    return envSchema.parse({})
  }
}

/**
 * 已验证的环境变量
 */
export const env = validateEnv()

/**
 * 是否为开发环境
 */
export const isDevelopment = env.NODE_ENV === 'development'

/**
 * 是否启用调试模式
 */
export const isDebug = env.NEXT_PUBLIC_DEBUG || isDevelopment
