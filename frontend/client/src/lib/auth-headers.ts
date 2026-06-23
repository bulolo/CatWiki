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

import { getSiteAccessToken } from "./site-access-token"

/**
 * 构造带站点访问令牌的请求头。
 *
 * 走 orval SDK 的请求由 custom-fetch mutator 自动注入 X-Site-Access-Token；
 * 但 useAIChat 的 SSE / feedback 用原生 fetch，绕过了 mutator，需手动注入——
 * 这里统一两处的拼装逻辑。
 */
export function getAuthHeaders(
  tenantSlug?: string | null,
  siteSlug?: string | null,
): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const token = getSiteAccessToken(tenantSlug, siteSlug)
  if (token) headers["X-Site-Access-Token"] = token
  return headers
}
