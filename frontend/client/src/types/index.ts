// Copyright 2024 CatWiki Authors
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
 * Client 端类型定义
 */

// 菜单项类型（用于侧边栏，轻量）
export interface MenuItem {
  id: string
  title: string
  type: "collection" | "article"
  children?: MenuItem[]
  views?: number
  tags?: string[]
}

// 文档详情类型（用于文档展示页面，完整）
export interface DocumentDetail {
  id: string
  title: string
  content?: string
  summary?: string
  views?: number
  readingTime?: number
  tags?: string[]
}

// 引用来源类型
export interface Source {
  id: string
  title: string
  siteName?: string
  siteDomain?: string
  siteId?: number
  documentId?: number
}

// Tool Call 类型（OpenAI 兼容）
export interface ToolCallFunction {
  name: string
  arguments: string // JSON 字符串
}

export interface ToolCall {
  id: string
  type: "function"
  function: ToolCallFunction
  // 前端扩展字段
  status?: "pending" | "running" | "completed" | "error"
  result?: string
}

// 消息状态类型
export type MessageStatus = "idle" | "thinking" | "tool_calling" | "streaming"

// 消息类型（AI 对话）
export interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  sources?: Source[]
  // Tool calling 扩展
  toolCalls?: ToolCall[]
  status?: MessageStatus
  activeToolName?: string // 当前正在调用的工具名称
}
