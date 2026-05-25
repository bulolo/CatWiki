// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.

import { defineConfig } from "orval"

/**
 * orval 配置 —— Client SDK。详见 ``frontend/admin/orval.config.ts`` 的说明。
 */
export default defineConfig({
  catwikiClient: {
    input: "./openapi.json",
    output: {
      mode: "tags",
      target: "./src/lib/sdk/sdk.ts",
      client: "react-query",
      clean: true,
      override: {
        mutator: {
          path: "./src/lib/custom-fetch.ts",
          name: "customFetch",
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
})
