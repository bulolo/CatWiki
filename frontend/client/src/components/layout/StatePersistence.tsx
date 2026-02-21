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

"use client"

import { useEffect } from "react"

/**
 * 系统属性同步容器 (StatePersistence)
 */
export function StatePersistence() {
  useEffect(() => {
    const logo = `
   ______      __ _       ___ __   _ 
  / ____/___ _/ /| |     / (_) /__(_)
 / /   / __ \`/ __/ | /| / / / // _/ / 
/ /___/ /_/ / /_ | |/ |/ / / / , < / /  
\\____/\\__,_/\\__/ |__/|__/_/_/_/|_/_/   
                                       
    `
    console.log(
      `%c${logo}%c\n%cCatWiki - 企业级 AI 知识库平台%c\n%cOfficial: https://catwiki.ai%c`,
      "color: #3b82f6; font-weight: bold; font-family: monospace;",
      "",
      "color: #1e293b; font-weight: bold; font-size: 14px;",
      "",
      "color: #3b82f6; font-size: 12px; text-decoration: underline;",
      ""
    )
  }, [])

  return null
}
