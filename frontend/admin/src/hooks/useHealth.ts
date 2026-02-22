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

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api-client'

export const healthKeys = {
  all: ['health'] as const,
}

export const tenantKeys = {
  current: ['tenant', 'current'] as const,
}

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: () => api.health.getHealth(),
  })
}

export function useCurrentTenant() {
  return useQuery({
    queryKey: tenantKeys.current,
    queryFn: () => api.tenant.getCurrent(),
    // 调试期间设为 30 秒，方便观察变更
    staleTime: 30 * 1000,
  })
}

export function useDemoMode() {
  const { data: tenant } = useCurrentTenant()
  return tenant?.is_demo ?? false
}
