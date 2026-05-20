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
 * React Query hooks for System Config management
 */

import { useMutation } from '@tanstack/react-query'
import { deleteAdminConfig, getGetAdminAiConfigQueryKey, getGetAdminDocProcessorConfigQueryKey, testDocProcessorConnection, testModelConnection, updateAdminAiConfig, updateAdminDocProcessorConfig, useGetAdminAiConfig, useGetAdminDocProcessorConfig } from '@/lib/sdk/admin-system-configs'
import type { AIConfigUpdate, DocProcessorConfig, DocProcessorsUpdate, ModelConfig, TestConnectionRequestModelType } from '@/lib/sdk/sdk.schemas'
import { isAuthenticated } from '@/lib/auth'
import { useAdminMutation } from './useAdminMutation'

type Scope = 'platform' | 'tenant'

/**
 * 获取 AI 模型配置
 */
export function useAIConfig(scope: Scope = 'tenant') {
  return useGetAdminAiConfig(
    { scope },
    {
      query: {
        enabled: isAuthenticated(),
        staleTime: 5 * 60 * 1000,
      },
    },
  )
}

/**
 * 更新 AI 模型配置
 */
export function useUpdateAIConfig(scope: Scope = 'tenant') {
  return useAdminMutation({
    mutationFn: (config: AIConfigUpdate) => updateAdminAiConfig(config, { scope }),
    invalidateKeys: [getGetAdminAiConfigQueryKey({ scope })],
  })
}

/**
 * 删除指定配置
 */
export function useDeleteConfig(scope: Scope = 'tenant') {
  return useAdminMutation({
    mutationFn: (configKey: string) => deleteAdminConfig(configKey, { scope }),
    invalidateKeys: [getGetAdminAiConfigQueryKey({ scope })],
  })
}

/**
 * 测试模型连接
 */
export function useTestConnection(scope: Scope = 'tenant') {
  return useMutation({
    mutationFn: (data: { modelType: TestConnectionRequestModelType; config: ModelConfig }) =>
      testModelConnection(
        { model_type: data.modelType, config: data.config },
        { scope },
      ),
  })
}

/**
 * 获取文档处理服务配置
 */
export function useDocProcessorConfig(scope: Scope = 'tenant') {
  return useGetAdminDocProcessorConfig(
    { scope },
    {
      query: {
        enabled: isAuthenticated(),
      },
    },
  )
}

/**
 * 更新文档处理服务配置
 */
export function useUpdateDocProcessorConfig(scope: Scope = 'tenant') {
  return useAdminMutation({
    mutationFn: (data: DocProcessorsUpdate) =>
      updateAdminDocProcessorConfig(data, { scope }),
    invalidateKeys: [getGetAdminDocProcessorConfigQueryKey({ scope })],
  })
}

/**
 * 测试文档处理服务连接
 */
export function useTestDocProcessorConnection(scope: Scope = 'tenant') {
  return useMutation({
    mutationFn: (config: DocProcessorConfig) =>
      testDocProcessorConnection({ config }, { scope }),
  })
}
