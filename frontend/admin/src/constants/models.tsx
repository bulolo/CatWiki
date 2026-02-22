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

import { MessageSquare, Layers, RefreshCw, Eye } from "lucide-react"
import { ModelType } from "@/types/settings"
import type { LucideIcon } from "lucide-react"

export interface ModelMeta {
  id: ModelType
  title: string
  subtitle: string
  icon: LucideIcon
  color: string
  iconColor: string
  iconBg: string
  description: string
  required: boolean
}

export const MODEL_META: Record<"chat" | "embedding" | "rerank" | "vl", ModelMeta> = {
  chat: {
    id: "chat",
    title: "对话模型",
    subtitle: "Chat Model",
    icon: MessageSquare,
    color: "bg-blue-50",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    description: "用于 AI 对话、内容生成和摘要提取的主模型。",
    required: true
  },
  embedding: {
    id: "embedding",
    title: "向量模型",
    subtitle: "Embedding Model",
    icon: Layers,
    color: "bg-emerald-50",
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
    description: "用于将文档转化为向量，实现 AI 语义检索。",
    required: true
  },
  rerank: {
    id: "rerank",
    title: "重排序模型",
    subtitle: "Rerank Model",
    icon: RefreshCw,
    color: "bg-purple-50",
    iconColor: "text-purple-500",
    iconBg: "bg-purple-500/10",
    description: "在检索完成后对结果进行精排，大幅提升回答准确度。",
    required: true
  },
  vl: {
    id: "vl",
    title: "多模态 (Vision) 模型",
    subtitle: "Vision Model",
    icon: Eye,
    color: "bg-orange-50",
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
    description: "支持图片理解和多模态交互的能力。",
    required: false
  }
}

export const MODEL_TYPES_LIST = Object.values(MODEL_META)
