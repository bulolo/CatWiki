/**
 * 统一日志工具
 * 
 * 使用方式：
 * - logger.debug('调试信息') - 仅开发环境输出
 * - logger.info('提示信息') - 仅开发环境输出
 * - logger.warn('警告信息') - 总是输出
 * - logger.error('错误信息') - 总是输出
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  /**
   * 调试日志（仅开发环境）
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args)
    }
  },

  /**
   * 信息日志（仅开发环境）
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args)
    }
  },

  /**
   * 警告日志（总是输出）
   */
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args)
  },

  /**
   * 错误日志（总是输出）
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args)
    // 未来可以在这里集成错误监控服务（如 Sentry）
  },

  /**
   * 成功日志（仅开发环境）
   */
  success: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[SUCCESS]', ...args)
    }
  }
}






