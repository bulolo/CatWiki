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

import { MessageSquare, Layers, RefreshCw } from "lucide-react"
import { SettingsTabId } from "@/types/settings"
import type { LucideIcon } from "lucide-react"

export interface ModelMeta {
  id: SettingsTabId
  titleKey: string
  descKey: string
  subtitle: string
  icon: LucideIcon
  color: string
  iconColor: string
  iconBg: string
  required: boolean
  recommended?: boolean
}

export const MODEL_META: Record<"chat" | "embedding" | "rerank", ModelMeta> = {
  chat: {
    id: "chat",
    titleKey: "chatTitle",
    subtitle: "Chat Model",
    icon: MessageSquare,
    color: "bg-blue-50",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    descKey: "chatDesc",
    required: true,
    recommended: false
  },
  embedding: {
    id: "embedding",
    titleKey: "embeddingTitle",
    subtitle: "Embedding Model",
    icon: Layers,
    color: "bg-emerald-50",
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
    descKey: "embeddingDesc",
    required: true,
    recommended: false
  },
  rerank: {
    id: "rerank",
    titleKey: "rerankTitle",
    subtitle: "Rerank Model",
    icon: RefreshCw,
    color: "bg-purple-50",
    iconColor: "text-purple-500",
    iconBg: "bg-purple-500/10",
    descKey: "rerankDesc",
    required: false,
    recommended: true
  }
}

export const MODEL_TYPES_LIST = Object.values(MODEL_META)
