// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.

import { defineConfig } from 'orval'

/**
 * orval 配置 —— Admin SDK。
 *
 * 由 ``backend/scripts/generate_sdk.py`` 在 ``openapi.json`` 落盘后调用。
 *
 * - mode=tags：按 tag 拆分 services 文件（``admin-sites/admin-sites.ts`` 等），
 *   所有 models 合并到一个 ``sdk.schemas.ts``，文件数受控。
 * - client=react-query：每个端点自动产 ``useXxx`` / ``useXxxMutation`` hooks，
 *   消除手写 useQuery 样板，queryKey 由 orval 自动算（与 invalidation 一致）。
 * - mutator：所有调用统一过 ``./src/lib/custom-fetch.ts``，把 baseURL/auth/
 *   ApiResponse 解包等通用逻辑收口到一处。
 */
export default defineConfig({
  catwikiAdmin: {
    input: './openapi.json',
    output: {
      mode: 'tags',
      target: './src/lib/sdk/sdk.ts',
      client: 'react-query',
      clean: true,
      override: {
        mutator: {
          path: './src/lib/custom-fetch.ts',
          name: 'customFetch',
        },
        fetch: {
          // 直接返回业务数据（关闭 ``{data, status, headers}`` 二次包装）。
          // 业务层 ``useListAdminSites().data?.list`` 零多余 .data。
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
})
