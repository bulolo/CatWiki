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

import { useMutation } from "@tanstack/react-query"
import { getGetAdminAiConfigQueryKey, getGetAdminDocProcessorConfigQueryKey, testDocProcessorConnection, testModelConnection, updateAdminAiConfig, updateAdminDocProcessorConfig, useGetAdminAiConfig, useGetAdminDocProcessorConfig } from "@/lib/sdk/admin-system-configs"
import type { AIConfigUpdate, DocProcessorConfig, DocProcessorsUpdate, ModelConfig, TestConnectionRequestModelType } from "@/lib/sdk/sdk.schemas"
import { useIsAuthenticated } from "@/lib/auth-store"
import { useAdminMutation } from "./useAdminMutation"
import { STALE_TIME } from "@/lib/react-query"

type Scope = "platform" | "tenant"

/**
 * 获取 AI 模型配置
 */
export function useAIConfig(scope: Scope = "tenant") {
  const isAuthed = useIsAuthenticated()
  return useGetAdminAiConfig(
    { scope },
    {
      query: {
        enabled: isAuthed,
        staleTime: STALE_TIME.MEDIUM,
      },
    },
  )
}

/**
 * 更新 AI 模型配置
 */
export function useUpdateAIConfig(scope: Scope = "tenant") {
  return useAdminMutation({
    mutationFn: (config: AIConfigUpdate) => updateAdminAiConfig(config, { scope }),
    invalidateKeys: [getGetAdminAiConfigQueryKey({ scope })],
  })
}

/**
 * 测试模型连接
 */
export function useTestConnection(scope: Scope = "tenant") {
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
export function useDocProcessorConfig(scope: Scope = "tenant") {
  const isAuthed = useIsAuthenticated()
  return useGetAdminDocProcessorConfig(
    { scope },
    {
      query: {
        enabled: isAuthed,
      },
    },
  )
}

/**
 * 更新文档处理服务配置
 */
export function useUpdateDocProcessorConfig(scope: Scope = "tenant") {
  return useAdminMutation({
    mutationFn: (data: DocProcessorsUpdate) =>
      updateAdminDocProcessorConfig(data, { scope }),
    invalidateKeys: [getGetAdminDocProcessorConfigQueryKey({ scope })],
  })
}

/**
 * 测试文档处理服务连接
 */
export function useTestDocProcessorConnection(scope: Scope = "tenant") {
  return useMutation({
    mutationFn: (config: DocProcessorConfig) =>
      testDocProcessorConnection({ config }, { scope }),
  })
}
