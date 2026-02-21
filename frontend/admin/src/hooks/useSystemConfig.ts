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

import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { AIConfigUpdate } from '@/lib/api-client'
import { isAuthenticated, getSelectedTenantId } from '@/lib/auth'
import { useAdminMutation } from './useAdminMutation'

// ==================== Query Keys ====================

export const systemConfigKeys = {
  all: ['systemConfig'] as const,
  aiConfig: (tenantId?: string | number | null, scope: string = 'tenant') => [...systemConfigKeys.all, 'ai', tenantId, scope] as const,
  docProcessor: (tenantId?: string | number | null, scope: string = 'tenant') => [...systemConfigKeys.all, 'docProcessor', tenantId, scope] as const,
}

// ==================== Hooks ====================

/**
 * 获取 AI 模型配置
 */
export function useAIConfig(scope: 'platform' | 'tenant' = 'tenant') {
  const isAuth = isAuthenticated()
  const tenantId = scope === 'platform' ? 'platform' : getSelectedTenantId()

  return useQuery({
    queryKey: systemConfigKeys.aiConfig(tenantId, scope),
    queryFn: () => api.systemConfig.getAIConfig(scope),
    enabled: isAuth,
    staleTime: 5 * 60 * 1000,
  })
}


/**
 * 更新 AI 模型配置
 */
export function useUpdateAIConfig(scope: 'platform' | 'tenant' = 'tenant') {
  const tenantId = scope === 'platform' ? 'platform' : getSelectedTenantId()
  return useAdminMutation({
    mutationFn: (config: AIConfigUpdate) => api.systemConfig.updateAIConfig(config, scope),
    invalidateKeys: [systemConfigKeys.aiConfig(tenantId, scope)],
  })
}

/**
 * 删除指定配置
 */
export function useDeleteConfig(scope: 'platform' | 'tenant' = 'tenant') {
  const tenantId = scope === 'platform' ? 'platform' : getSelectedTenantId()
  return useAdminMutation({
    mutationFn: (configKey: string) => api.systemConfig.deleteConfig(configKey, scope),
    invalidateKeys: [systemConfigKeys.aiConfig(tenantId, scope)],
    successMsg: '配置删除成功',
  })
}

/**
 * 测试模型连接
 */
export function useTestConnection(scope: 'platform' | 'tenant' = 'tenant') {
  return useMutation({
    mutationFn: (data: { modelType: string; config: any }) => api.systemConfig.testConnection(data.modelType, data.config, scope),
  })
}

/**
 * 获取文档处理服务配置
 */
export function useDocProcessorConfig(scope: 'platform' | 'tenant' = 'tenant') {
  const isAuth = isAuthenticated()
  const tenantId = scope === 'platform' ? 'platform' : getSelectedTenantId()

  return useQuery({
    queryKey: systemConfigKeys.docProcessor(tenantId, scope),
    queryFn: () => api.systemConfig.getDocProcessorConfig(scope),
    enabled: isAuth,
  })
}

/**
 * 更新文档处理服务配置
 */
export function useUpdateDocProcessorConfig(scope: 'platform' | 'tenant' = 'tenant') {
  const tenantId = scope === 'platform' ? 'platform' : getSelectedTenantId()
  return useAdminMutation({
    mutationFn: (data: { processors: any[] }) => api.systemConfig.updateDocProcessorConfig(data, scope),
    invalidateKeys: [systemConfigKeys.docProcessor(tenantId, scope)],
  })
}

/**
 * 测试文档处理服务连接
 */
export function useTestDocProcessorConnection(scope: 'platform' | 'tenant' = 'tenant') {
  return useMutation({
    mutationFn: (config: any) => api.systemConfig.testDocProcessorConnection(config, scope),
  })
}






