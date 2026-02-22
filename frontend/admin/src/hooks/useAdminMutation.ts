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
 * 通用 Admin Mutation Hook
 * 集成了常用的 toast 提示和 Query Invalidation 逻辑
 */

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/sdk/core/ApiError'

interface UseAdminMutationOptions<TData, TError, TVariables, TContext>
  extends UseMutationOptions<TData, TError, TVariables, TContext> {
  successMsg?: string | ((data: TData, variables: TVariables) => string | undefined)
  errorMsg?: string | ((error: TError, variables: TVariables) => string | undefined)
  invalidateKeys?: ReadonlyArray<ReadonlyArray<unknown>> // 支持 as const 数组
}

export function useAdminMutation<TData = unknown, TError = Error, TVariables = unknown, TContext = unknown>(
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
          invalidateKeys.map(key => queryClient.invalidateQueries({ queryKey: key }))
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

      // 提取错误消息
      let message = (error as Error)?.message || '操作失败'

      // 提取 ApiError 中的详细消息
      if (error instanceof ApiError) {
        if (error.body && typeof error.body === 'object' && error.body.msg) {
          message = error.body.msg
        }
      }

      const msg = typeof errorMsg === 'function' ? errorMsg(error, variables) : (errorMsg || message)
      if (msg) toast.error(msg)
    },

  })

}
