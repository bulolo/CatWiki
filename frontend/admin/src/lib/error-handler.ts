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

