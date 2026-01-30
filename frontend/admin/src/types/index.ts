/**
 * 全局类型定义
 */

import { LucideIcon } from "lucide-react"

// 站点类型
export interface Site {
  id: string
  name: string
  domain: string
  icon?: LucideIcon
  articleCount?: number
  status?: "active" | "draft"
  createdAt?: string
  description?: string
}

// 用户角色类型
export type UserRole = "admin" | "site_admin" | "editor"

// 用户状态类型
export type UserStatus = "active" | "inactive"

// 用户类型
export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  managedSites: string[]
  status: UserStatus
  lastLogin: string
}

// 合集树项类型（统一使用 collection 术语）
export interface CollectionItem {
  id: string
  name: string
  type?: 'collection' | 'document'
  children?: CollectionItem[]
  status?: string
  views?: number
  tags?: string[]
}

// 文档类型
export interface Article {
  id: string
  title: string
  site: string
  siteId: string
  folderId?: string
  category: string
  author: string
  status: "published" | "draft"
  updatedAt: string
  views: number
  content?: string  // Markdown 格式的文章内容
  coverImage?: string  // 封面图片 URL
  tags?: string[]  // 标签
  summary?: string  // 摘要
  readingTime?: number  // 预计阅读时间（分钟）
}

// 模型配置类型
export interface ModelConfig {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
}

// AI 配置类型
export interface AIConfigs {
  mode: "auto" | "manual"
  autoConfig: {
    provider: "bailian" | "openai" | "deepseek"
    apiKey: string
    models: {
      chat: string
      embedding: string
      rerank: string
      vl: string
    }
  }
  manualConfig: {
    chat: ModelConfig
    embedding: ModelConfig
    rerank: ModelConfig
    vl: ModelConfig
  }
  botConfig: BotConfig
}

// 机器人配置类型
export interface BotConfig {
  webWidget: {
    enabled: boolean
    title: string
    welcomeMessage: string
    primaryColor: string
    position: "left" | "right"
  }
  apiBot: {
    enabled: boolean
    apiEndpoint: string
    apiKey: string
    timeout: number
  }
  wechat: {
    enabled: boolean
    appId: string
    appSecret: string
    token: string
    encodingAESKey: string
  }
}

// 统计数据类型
export interface StatItem {
  title: string
  value: string
  description: string
  color: string
  bg: string
}

export interface HotDoc {
  title: string
  views: number
  category: string
}

export interface UpdateItem {
  title: string
  time: string
}

export interface SiteStats {
  stats: StatItem[]
  hotDocs: HotDoc[]
  updates: UpdateItem[]
}

// 目录项类型（用于拖拽排序）
export interface DirectoryItem {
  id: string
  name: string
  type?: 'collection' | 'document'
  children?: DirectoryItem[]
}

// 导出设置相关类型
export type { ModelType } from './settings'

