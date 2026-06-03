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
  siteSlug?: string
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
  /** 本次工具调用耗时（毫秒），由 SSE response.tool_call.completed 透传 */
  elapsedMs?: number
  /** 本次工具返回的结果条数（如知识库检索的 chunks 数），实时由后端预算好直传 */
  chunkCount?: number
  // 后端兼容字段（部分场景 name/args 直接在顶层）
  name?: string
  args?: string
}

// 消息状态类型
export type MessageStatus = "idle" | "thinking" | "tool_calling" | "streaming"

// Pipeline trace：站点开启 show_pipeline_trace 时由后端透传
export interface MessageTimings {
  ttfbMs?: number
  firstTokenMs?: number
  totalMs?: number
}

export interface MessageUsage {
  totalTokens?: number
}

// 消息类型（AI 对话）
export interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  sources?: Source[]
  toolCalls?: ToolCall[]
  status?: MessageStatus
  timings?: MessageTimings
  usage?: MessageUsage
  /** 同 thread 内 assistant 消息的 0-based 序号，feedback 用它定位到具体消息行 */
  messageSeq?: number
}
