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

const VISITOR_ID_KEY = 'catwiki_visitor_id';

/**
 * 获取或生成一个持久化的访问者 ID (Visitor ID)
 * 该 ID 存储在 localStorage 中，用于在无登录状态下追踪用户行为和会话历史
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';

  let visitorId = localStorage.getItem(VISITOR_ID_KEY);

  if (!visitorId) {
    // 优先使用原生 crypto API，如果由于安全上下文不可用则使用高质量随机数回退
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      visitorId = `v_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
    } else {
      visitorId = `v_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
    }
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }

  return visitorId;
}
