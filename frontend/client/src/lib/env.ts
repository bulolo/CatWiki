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
const envSchema = z.object({
  // ==================== 客户端环境变量 ====================

  /**
   * API 基础 URL
   */
  NEXT_PUBLIC_API_URL: z.string().url({
    message: 'NEXT_PUBLIC_API_URL 必须是有效的 URL'
  }).default('http://localhost:3000'),

  /**
   * 应用环境
   */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  /**
   * 是否启用调试模式
   */
  NEXT_PUBLIC_DEBUG: z.enum(['true', 'false'])
    .transform((val: string) => val === 'true')
    .optional()
    .default(false),
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
