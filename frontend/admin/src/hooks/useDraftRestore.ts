import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'
import type { DraftData } from './useAutosave'

/**
 * 草稿恢复 Hook
 * 
 * @param key - 本地存储的唯一键
 * @returns 草稿数据和恢复/丢弃方法
 */
export function useDraftRestore(key: string) {
  const [draftData, setDraftData] = useState<DraftData | null>(null)
  const [hasDraft, setHasDraft] = useState(false)

  // 检查是否有草稿
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(key)
      if (savedData) {
        const draft: DraftData = JSON.parse(savedData)
        // 检查是否有实际内容
        const hasContent = draft.title?.trim() || draft.content?.trim() || draft.summary?.trim()

        if (hasContent) {
          setDraftData(draft)
          setHasDraft(true)
          logger.debug('发现草稿:', key, draft)
        }
      }
    } catch (error) {
      logger.error('读取草稿失败:', error)
      // 如果解析失败，清除损坏的数据
      localStorage.removeItem(key)
    }
  }, [key])

  // 恢复草稿
  const restoreDraft = useCallback(() => {
    setHasDraft(false)
    return draftData
  }, [draftData])

  // 丢弃草稿
  const discardDraft = useCallback(() => {
    try {
      localStorage.removeItem(key)
      setDraftData(null)
      setHasDraft(false)
      logger.debug('草稿已丢弃:', key)
    } catch (error) {
      logger.error('丢弃草稿失败:', error)
    }
  }, [key])

  // 格式化保存时间
  const getSavedTimeAgo = useCallback(() => {
    if (!draftData?.savedAt) return ''

    const now = Date.now()
    const diff = now - draftData.savedAt
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days} 天前`
    if (hours > 0) return `${hours} 小时前`
    if (minutes > 0) return `${minutes} 分钟前`
    return '刚刚'
  }, [draftData])

  return {
    hasDraft,
    draftData,
    restoreDraft,
    discardDraft,
    savedTimeAgo: getSavedTimeAgo()
  }
}






