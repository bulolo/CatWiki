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

import { useGetAdminHealth } from "@/lib/sdk/admin-health"
import { useGetAdminCurrentTenant } from "@/lib/sdk/admin-tenants"
import { STALE_TIME } from "@/lib/react-query"

export function useHealth() {
  return useGetAdminHealth()
}

export function useCurrentTenant() {
  return useGetAdminCurrentTenant({
    query: {
      // 调试期间设为 30 秒，方便观察变更
      staleTime: STALE_TIME.SHORT,
    },
  })
}

export function useDemoMode() {
  const { data: tenant } = useCurrentTenant()
  return tenant?.is_demo ?? false
}
