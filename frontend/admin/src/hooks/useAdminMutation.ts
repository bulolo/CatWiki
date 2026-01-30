/**
 * 通用 Admin Mutation Hook
 * 集成了常用的 toast 提示和 Query Invalidation 逻辑
 */

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'

interface UseAdminMutationOptions<TData, TError, TVariables, TContext>
  extends UseMutationOptions<TData, TError, TVariables, TContext> {
  successMsg?: string | ((data: TData, variables: TVariables) => string | undefined)
  errorMsg?: string | ((error: TError, variables: TVariables) => string | undefined)
  invalidateKeys?: ReadonlyArray<ReadonlyArray<any>> // 支持 as const 数组
}

export function useAdminMutation<TData = any, TError = Error, TVariables = any, TContext = any>(
  options: UseAdminMutationOptions<TData, TError, TVariables, TContext>
) {
  const queryClient = useQueryClient()
  const {
    successMsg,
    errorMsg,
    invalidateKeys,
    onSuccess,
    onError,
    ...mutationOptions
  } = options

  return useMutation({
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // 执行失效逻辑
      if (invalidateKeys && invalidateKeys.length > 0) {
        await Promise.all(
          invalidateKeys.map(key => queryClient.invalidateQueries({ queryKey: key as any }))
        )
      }

      // 执行自定义回调
      if (onSuccess) {
        // @ts-ignore - 兼容不同版本的 tanstack query 签名
        await onSuccess(data, variables, context)
      }

      // 显示成功提示
      if (successMsg) {
        const msg = typeof successMsg === 'function' ? successMsg(data, variables) : successMsg
        if (msg) toast.success(msg)
      }
    },
    onError: async (error, variables, context) => {
      // 执行自定义回调
      if (onError) {
        // @ts-ignore - 兼容不同版本的 tanstack query 签名
        await onError(error, variables, context)
      }

      // 显示错误提示
      const defaultErrorMsg = (error as Error)?.message || '操作失败'
      const msg = typeof errorMsg === 'function' ? errorMsg(error, variables) : (errorMsg || defaultErrorMsg)
      if (msg) toast.error(msg)
    },

  })

}
