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

// 消息类型（AI 对话）
export interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  sources?: Source[]
}

