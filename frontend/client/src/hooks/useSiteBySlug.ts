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
 * 通过 slug 获取站点信息的 Hook
 * 直接复用 orval 生成的 useGetClientSiteBySlug；
 * queryKey 由生成器统一管理，无需手写。
 */

'use client'

import { useGetClientSiteBySlug } from '@/lib/sdk/client-sites'

export function useSiteBySlug(slug: string) {
  return useGetClientSiteBySlug(slug, {
    query: {
      enabled: !!slug,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  })
}
