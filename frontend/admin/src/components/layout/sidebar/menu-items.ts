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

import { type LucideIcon, LayoutGrid, FileText } from "lucide-react"

export interface MenuItem {
  title: string
  href: string
  icon: LucideIcon
  children?: { title: string; href: string }[]
  roles?: string[] // 允许访问的角色列表
}

export const allMenuItems: MenuItem[] = [
  {
    title: "dashboard",
    href: "/",
    icon: LayoutGrid,
    roles: ["admin", "tenant_admin", "site_admin"] // 管理员和站点管理员可见
  },
  {
    title: "documents",
    href: "/documents",
    icon: FileText,
    children: [
      { title: "documentList", href: "/documents" },
      { title: "newDocument", href: "/documents/new" },
    ],
    roles: ["admin", "tenant_admin", "site_admin"] // 所有角色都可见
  },
]
