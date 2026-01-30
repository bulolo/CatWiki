import { useEffect, useRef, useCallback, useState } from 'react'
import { logger } from '@/lib/logger'

/**
 * 草稿数据接口
 */
export interface DraftData {
  title: string
  content: string
  summary?: string
  tags?: string[]
  coverImage?: string | null
  collectionId?: string
  savedAt: number
}

/**
 * 自动保存 Hook
 * 
 * @param data - 要保存的数据
 * @param key - 本地存储的唯一键（如 'draft-new' 或 'draft-123'）
 * @param delay - 延迟时间（毫秒），默认 2000ms
 * @param enabled - 是否启用自动保存，默认 true
 */
export function useAutosave(
  data: Partial<DraftData>,
  key: string,
  delay: number = 2000,
  enabled: boolean = true
) {
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<string>('')

  /* New state for status tracking */
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null)

  // 序列化数据以进行比较，避免对象引用变化导致的无限重渲染
  const dataString = JSON.stringify(data)

  // 保存草稿到 localStorage
  const saveDraft = useCallback(() => {
    if (!enabled) return

    const draftData: DraftData = {
      ...data,
      savedAt: Date.now()
    } as DraftData

    const currentDataString = JSON.stringify(draftData)

    // 如果数据没有变化，不保存
    if (currentDataString === lastSavedRef.current) {
      setIsSaving(false)
      return
    }

    try {
      localStorage.setItem(key, currentDataString)
      lastSavedRef.current = currentDataString
      setLastSavedTime(new Date())
      logger.debug('草稿已自动保存:', key)
    } catch (error) {
      logger.error('保存草稿失败:', error)
    } finally {
      setIsSaving(false)
    }
  }, [dataString, key, enabled]) // 依赖 dataString 而不是 data

  // 监听数据变化，延迟保存
  useEffect(() => {
    if (!enabled) return

    // 设置状态为保存中
    setIsSaving(true)

    // 清除之前的定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // 设置新的定时器
    timerRef.current = setTimeout(() => {
      saveDraft()
    }, delay)

    // 清理函数
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [dataString, delay, enabled, saveDraft]) // 依赖 dataString

  // 清除草稿
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key)
      lastSavedRef.current = ''
      setLastSavedTime(null)
      setIsSaving(false)
      logger.debug('草稿已清除:', key)
    } catch (error) {
      logger.error('清除草稿失败:', error)
    }
  }, [key])

  return { clearDraft, isSaving, lastSavedTime }
}






