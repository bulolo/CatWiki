/**
 * 环境变量验证和类型定义
 * 
 * 使用 zod 在应用启动时验证所有必需的环境变量，
 * 确保配置正确，避免运行时错误。
 */

import { z } from 'zod'

/**
 * 环境变量 Schema
 * 
 * 说明：
 * - Next.js 中，以 NEXT_PUBLIC_ 开头的变量会暴露给客户端
 * - 不要在 NEXT_PUBLIC_ 变量中存储敏感信息
 * - 服务端专用的环境变量不需要 NEXT_PUBLIC_ 前缀
 */
const envSchema = z.object({
  // ==================== 客户端环境变量 ====================

  /**
   * API 基础 URL
   * 用于所有后端 API 请求
   * 
   * 示例：
   * - 开发环境: http://localhost:3000
   * - 生产环境: https://api.catwiki.com
   */
  NEXT_PUBLIC_API_URL: z.string().url({
    message: 'NEXT_PUBLIC_API_URL 必须是有效的 URL'
  }).default('http://localhost:3000'),

  /**
   * 应用环境
   * development | production | test
   */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  /**
   * 是否启用调试模式
   * 在开发环境中默认启用
   */
  NEXT_PUBLIC_DEBUG: z.enum(['true', 'false'])
    .transform(val => val === 'true')
    .optional()
    .default('false'),

  /**
   * Sentry DSN（可选）
   * 用于错误监控
   */
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  /**
   * Google Analytics ID（可选）
   * 用于分析
   */
  NEXT_PUBLIC_GA_ID: z.string().optional(),

  /**
   * 客户端站点 URL
   * 用于从管理后台跳转到客户端
   */
  NEXT_PUBLIC_CLIENT_URL: z.string().url({
    message: 'NEXT_PUBLIC_CLIENT_URL 必须是有效的 URL'
  }).default('http://localhost:8002'),
})

/**
 * 环境变量类型
 */
export type Env = z.infer<typeof envSchema>

/**
 * 验证并获取环境变量
 * 
 * @throws {ZodError} 如果环境变量验证失败
 */
function validateEnv(): Env {
  try {
    // 解析环境变量
    const env = envSchema.parse({
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
      NEXT_PUBLIC_CLIENT_URL: process.env.NEXT_PUBLIC_CLIENT_URL,
    })

    return env
  } catch (error) {
    if (error instanceof z.ZodError) {
      // 格式化错误信息
      const errorMessage = error.errors
        .map(err => `  ❌ ${err.path.join('.')}: ${err.message}`)
        .join('\n')

      console.error('❌ 环境变量验证失败:\n\n' + errorMessage)
      console.error('\n💡 请检查 .env.local 文件并确保所有必需的环境变量都已正确设置。')

      // 在开发环境中抛出错误，在生产环境中可能需要更优雅的处理
      if (process.env.NODE_ENV === 'development') {
        throw new Error('环境变量验证失败，请查看上面的错误信息')
      }
    }

    throw error
  }
}

/**
 * 已验证的环境变量
 * 
 * 使用方式：
 * ```typescript
 * import { env } from '@/lib/env'
 * 
 * const apiUrl = env.NEXT_PUBLIC_API_URL
 * ```
 */
export const env = validateEnv()

/**
 * 是否为生产环境
 */
export const isProduction = env.NODE_ENV === 'production'

/**
 * 是否为开发环境
 */
export const isDevelopment = env.NODE_ENV === 'development'

/**
 * 是否为测试环境
 */
export const isTest = env.NODE_ENV === 'test'

/**
 * 是否启用调试模式
 */
export const isDebug = env.NEXT_PUBLIC_DEBUG || isDevelopment

/**
 * 打印环境配置（开发环境）
 */
if (isDevelopment && typeof window !== 'undefined') {
  console.log('🔧 环境配置:')
  console.log('  - NODE_ENV:', env.NODE_ENV)
  console.log('  - API_URL:', env.NEXT_PUBLIC_API_URL)
  console.log('  - DEBUG:', isDebug)
}

