"use client"

import React, { useState, useEffect, useRef, useMemo, createContext, useContext } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronRight, Folder, FolderPlus, Hash, FileText, Eye, EyeOff, Trash2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CollectionItem } from "@/types"

interface CollectionTreeProps {
  items: CollectionItem[]
  selectedId?: string
  onSelect?: (id: string | undefined) => void
  onCreateCollection?: (parentId?: string) => void
  onDeleteCollection?: (id: string, name: string) => void
  onRenameCollection?: (id: string, newName: string) => void
  onMoveCollection?: (collectionId: string, targetParentId: string | null, insertBeforeId?: string | null) => void
  showDocuments?: boolean
  onToggleShowDocuments?: () => void
}

// 全局拖拽状态管理 Context
interface DragContextType {
  draggedId: string | null
  dragOverNodeId: string | null
  dragOverPosition: 'top' | 'middle' | 'bottom' | null
  setDraggedId: (id: string | null) => void
  setDragOver: (nodeId: string | null, position: 'top' | 'middle' | 'bottom' | null) => void
  clearDragState: () => void
}

const DragContext = createContext<DragContextType | null>(null)

// 辅助函数：检查 targetId 是否是 nodeId 的后代
function isDescendant(items: CollectionItem[], nodeId: string, targetId: string): boolean {
  const findNode = (items: CollectionItem[], id: string): CollectionItem | null => {
    for (const item of items) {
      if (item.id === id) return item
      if (item.children?.length) {
        const found = findNode(item.children, id)
        if (found) return found
      }
    }
    return null
  }

  const checkSubtree = (node: CollectionItem, targetId: string): boolean => {
    if (node.id === targetId) return true
    return node.children?.some(child => checkSubtree(child, targetId)) ?? false
  }

  const node = findNode(items, nodeId)
  return node ? checkSubtree(node, targetId) : false
}

// 计算拖拽位置 - 改进算法，使用更精确的阈值
function getDragPosition(clientY: number, rect: DOMRect): 'top' | 'middle' | 'bottom' {
  const y = clientY - rect.top
  const height = rect.height

  // 使用更小的阈值区域，避免误判
  const topThreshold = height * 0.3
  const bottomThreshold = height * 0.7

  if (y < topThreshold) return 'top'
  if (y > bottomThreshold) return 'bottom'
  return 'middle'
}

// 检查鼠标是否真的在元素外（增加容差）
function isOutsideElement(clientX: number, clientY: number, rect: DOMRect, tolerance: number = 5): boolean {
  return (
    clientX < rect.left - tolerance ||
    clientX >= rect.right + tolerance ||
    clientY < rect.top - tolerance ||
    clientY >= rect.bottom + tolerance
  )
}

function CollectionNode({
  item,
  level = 0,
  parentId = null,
  siblings = [],
  allItems,
  selectedId,
  onSelect,
  onCreateCollection,
  onDeleteCollection,
  onRenameCollection,
  onMoveCollection,
}: {
  item: CollectionItem
  level?: number
  parentId?: string | null
  siblings?: CollectionItem[]
  allItems: CollectionItem[]
  selectedId?: string
  onSelect?: (id: string) => void
  onCreateCollection?: (parentId?: string) => void
  onDeleteCollection?: (id: string, name: string) => void
  onRenameCollection?: (id: string, newName: string) => void
  onMoveCollection?: (collectionId: string, targetParentId: string | null, insertBeforeId?: string | null) => void
}) {
  const dragContext = useContext(DragContext)
  if (!dragContext) {
    throw new Error('CollectionNode must be used within DragContext')
  }

  const { draggedId, dragOverNodeId, dragOverPosition, setDraggedId, setDragOver, clearDragState } = dragContext

  const [isExpanded, setIsExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editingName, setEditingName] = useState(item.name)
  const [clickCount, setClickCount] = useState(0)
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nodeRef = useRef<HTMLDivElement>(null)

  const isSelected = selectedId === item.id
  const hasChildren = item.children && item.children.length > 0
  const isDocument = item.type === 'document'
  const isDragging = draggedId === item.id
  const isDragOver = dragOverNodeId === item.id
  const currentDragPosition = isDragOver ? dragOverPosition : null

  // 当 allItems 改变时（列表刷新后），重置编辑状态
  useEffect(() => {
    if (!isEditing) {
      setEditingName(item.name)
    }
  }, [item.name, isEditing])

  // 当进入编辑模式时，聚焦输入框并选中文本
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // 处理双击编辑
  const handleClick = () => {
    if (isDocument) {
      onSelect?.(item.id)
      return
    }

    setClickCount(prev => prev + 1)

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
    }

    clickTimerRef.current = setTimeout(() => {
      if (clickCount + 1 === 1) {
        // 单击 - 选中
        onSelect?.(item.id)
      } else if (clickCount + 1 >= 2) {
        // 双击 - 进入编辑模式
        setIsEditing(true)
        setEditingName(item.name)
      }
      setClickCount(0)
    }, 250)
  }

  // 保存重命名
  const handleSaveRename = () => {
    const trimmedName = editingName.trim()
    if (trimmedName && trimmedName !== item.name) {
      onRenameCollection?.(item.id, trimmedName)
    }
    setIsEditing(false)
    setEditingName(item.name)
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditingName(item.name)
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent) => {
    if (isDocument || isEditing) {
      e.preventDefault()
      return
    }

    e.stopPropagation()
    setDraggedId(item.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)

    // 设置拖拽图像
    if (nodeRef.current) {
      const dragImage = nodeRef.current.cloneNode(true) as HTMLElement
      dragImage.style.opacity = '0.5'
      dragImage.style.position = 'absolute'
      dragImage.style.top = '-1000px'
      document.body.appendChild(dragImage)
      e.dataTransfer.setDragImage(dragImage, 0, 0)
      setTimeout(() => document.body.removeChild(dragImage), 0)
    }
  }

  // 拖拽结束
  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation()
    clearDragState()
  }

  // 拖拽经过 - 立即更新位置，不使用防抖以确保 drop 时能获取到正确位置
  const handleDragOver = (e: React.DragEvent) => {
    if (isDocument || isEditing || !draggedId || draggedId === item.id) {
      return
    }

    e.preventDefault()
    e.stopPropagation()

    if (!nodeRef.current) return

    const rect = nodeRef.current.getBoundingClientRect()
    const position = getDragPosition(e.clientY, rect)

    // 检查是否可以放置（不能拖到自己或后代）
    if (draggedId === item.id || isDescendant(allItems, item.id, draggedId)) {
      setDragOver(item.id, null)
      return
    }

    // 立即更新位置，不使用防抖
    setDragOver(item.id, position)
  }

  // 拖拽离开
  const handleDragLeave = (e: React.DragEvent) => {
    if (isDocument || isEditing) return

    e.stopPropagation()

    if (!nodeRef.current) return

    const rect = nodeRef.current.getBoundingClientRect()

    // 检查是否真的离开了当前节点
    if (isOutsideElement(e.clientX, e.clientY, rect, 10)) {
      // 检查是否进入了子节点
      const relatedTarget = e.relatedTarget as HTMLElement
      if (relatedTarget && nodeRef.current.contains(relatedTarget)) {
        // 进入了子节点，不清除状态
        return
      }

      // 真的离开了，清除拖拽状态
      if (dragOverNodeId === item.id) {
        setDragOver(null, null)
      }
    }
  }

  // 放置
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isDocument || isEditing || !draggedId) {
      return
    }

    // 不能拖到自己身上或自己的后代节点上
    if (draggedId === item.id) {
      clearDragState()
      return
    }

    if (isDescendant(allItems, item.id, draggedId)) {
      clearDragState()
      return
    }

    // 如果当前节点不是拖拽目标，不处理
    if (dragOverNodeId !== item.id) {
      return
    }

    // 计算当前位置（如果 currentDragPosition 为空，立即计算一次）
    let position = currentDragPosition
    if (!position && nodeRef.current) {
      const rect = nodeRef.current.getBoundingClientRect()
      position = getDragPosition(e.clientY, rect)
    }

    // 如果仍然没有位置信息，使用 middle 作为默认值
    if (!position) {
      position = 'middle'
    }

    // 根据拖拽位置决定操作
    switch (position) {
      case 'middle':
        // 拖到中间：作为子级，移动到目标目录下
        onMoveCollection?.(draggedId, item.id, null)
        break

      case 'top':
        // 拖到上方：作为同级插入到当前节点之前
        onMoveCollection?.(draggedId, parentId, item.id)
        break

      case 'bottom':
        // 拖到下方：作为同级插入到当前节点之后
        const currentIndex = siblings.findIndex(s => s.id === item.id)
        const nextSibling = siblings[currentIndex + 1] || null
        onMoveCollection?.(draggedId, parentId, nextSibling?.id || null)
        break
    }

    clearDragState()
  }

  // 清理定时器
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
      }
    }
  }, [])

  // 计算缩进：每层缩进 20px，确保文本对齐
  // 基础缩进 10px + 每层 20px
  const indentWidth = 10 + (level * 20)
  // gap-2 = 0.5rem = 8px
  // 图标区域总宽度：拖拽手柄容器(14px) + gap(8px) + 展开图标容器(18px) + gap(8px) + 图标容器(20px) + gap(8px) = 76px
  // 使用精确的像素值确保对齐
  const dragHandleWidth = 14  // w-3.5 = 0.875rem = 14px
  const expandIconWidth = 18  // 需要自定义，因为 w-4.5 不存在
  const folderIconWidth = 20  // w-5 = 1.25rem = 20px
  const gapWidth = 8          // gap-2 = 0.5rem = 8px
  const iconAreaWidth = dragHandleWidth + gapWidth + expandIconWidth + gapWidth + folderIconWidth + gapWidth

  return (
    <div className="mb-1 relative" ref={nodeRef}>
      {/* 拖拽指示器 - 上方插入线 */}
      {isDragOver && currentDragPosition === 'top' && (
        <div
          className="absolute top-0 h-0.5 bg-primary z-50 pointer-events-none"
          style={{
            left: `${indentWidth + iconAreaWidth}px`,
            right: '10px'
          }}
        />
      )}

      {/* 拖拽指示器 - 下方插入线 */}
      {isDragOver && currentDragPosition === 'bottom' && (
        <div
          className="absolute bottom-0 h-0.5 bg-primary z-50 pointer-events-none"
          style={{
            left: `${indentWidth + iconAreaWidth}px`,
            right: '10px'
          }}
        />
      )}

      <div
        className={cn(
          "group flex items-center gap-2 py-1.5 rounded-xl transition-all duration-200 relative",
          !isEditing && !isDocument && "cursor-move",
          isEditing && "cursor-default",
          isSelected
            ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          isDocument && "cursor-pointer",
          isDragging && "opacity-50 scale-95",
          isDragOver && currentDragPosition === 'middle' && !isDocument && "bg-primary/20 border-2 border-primary border-dashed"
        )}
        style={{ paddingLeft: `${indentWidth}px`, paddingRight: '10px' }}
        onClick={isEditing ? undefined : handleClick}
        draggable={!isDocument && !isEditing}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 拖拽手柄 - 固定宽度 */}
        <div className="shrink-0 flex items-center justify-center" style={{ width: `${dragHandleWidth}px` }}>
          {!isDocument && !isEditing && (
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>

        {/* 展开/折叠图标 - 固定宽度 */}
        <div className="shrink-0 flex items-center justify-center" style={{ width: `${expandIconWidth}px` }}>
          {hasChildren ? (
            <div
              className="p-0.5 hover:bg-muted-foreground/10 rounded-md transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200",
                  isExpanded && "rotate-90"
                )}
              />
            </div>
          ) : null}
        </div>

        {/* 图标区域 - 固定宽度 */}
        <div className="shrink-0 flex items-center justify-center" style={{ width: `${folderIconWidth}px` }}>
          {isDocument ? (
            <div className="p-1 bg-muted/50 rounded-lg group-hover:bg-background transition-colors">
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            </div>
          ) : (
            <div className={cn(
              "p-1 rounded-lg transition-colors",
              isExpanded ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground/70"
            )}>
              <Folder className="h-3.5 w-3.5 shrink-0" />
            </div>
          )}
        </div>

        {/* 名称显示或编辑 */}
        {isEditing && !isDocument ? (
          <Input
            ref={inputRef}
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveRename}
            className="h-7 px-2 py-0 text-[13px] font-medium flex-1 bg-background"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={cn(
              "truncate flex-1 py-0.5",
              isDocument ? "text-xs font-normal" : "text-[13px] font-semibold tracking-tight"
            )}
            title={item.name}
          >
            {item.name}
          </span>
        )}

        {/* 文档状态指示器 */}
        {isDocument && item.status === "published" && (
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0" />
        )}

        {/* 合集操作按钮 */}
        {!isDocument && !isEditing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg p-0"
              onClick={(e) => {
                e.stopPropagation()
                onCreateCollection?.(item.id)
              }}
              title="创建子合集"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg p-0"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteCollection?.(item.id, item.name)
              }}
              title="删除合集"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-1">
          {item.children!.map((child) => (
            <CollectionNode
              key={child.id}
              item={child}
              level={level + 1}
              parentId={item.id}
              siblings={item.children!}
              allItems={allItems}
              selectedId={selectedId}
              onSelect={onSelect}
              onCreateCollection={onCreateCollection}
              onDeleteCollection={onDeleteCollection}
              onRenameCollection={onRenameCollection}
              onMoveCollection={onMoveCollection}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CollectionTree({
  items,
  selectedId,
  onSelect,
  onCreateCollection,
  onDeleteCollection,
  onRenameCollection,
  onMoveCollection,
  showDocuments,
  onToggleShowDocuments,
}: CollectionTreeProps) {
  // 全局拖拽状态
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'middle' | 'bottom' | null>(null)

  // 设置拖拽悬停状态
  const setDragOver = (nodeId: string | null, position: 'top' | 'middle' | 'bottom' | null) => {
    setDragOverNodeId(nodeId)
    setDragOverPosition(position)
  }

  // 清除所有拖拽状态
  const clearDragState = () => {
    setDraggedId(null)
    setDragOverNodeId(null)
    setDragOverPosition(null)
  }

  // 全局拖拽结束处理
  useEffect(() => {
    const handleWindowDragEnd = () => {
      clearDragState()
    }

    const handleWindowDragLeave = (e: MouseEvent) => {
      // 只有当拖拽真正离开窗口时才触发
      if (e.target === document.documentElement || e.target === document.body) {
        clearDragState()
      }
    }


    window.addEventListener('dragend', handleWindowDragEnd)
    window.addEventListener('dragleave', handleWindowDragLeave)

    return () => {
      window.removeEventListener('dragend', handleWindowDragEnd)
      window.removeEventListener('dragleave', handleWindowDragLeave)
    }
  }, [])

  // 当 items 改变时，清除拖拽状态
  useEffect(() => {
    clearDragState()
  }, [items])

  const dragContextValue: DragContextType = {
    draggedId,
    dragOverNodeId,
    dragOverPosition,
    setDraggedId,
    setDragOver,
    clearDragState,
  }

  return (
    <DragContext.Provider value={dragContextValue}>
      <div className="w-full flex flex-col bg-card rounded-2xl border border-border/50 shadow-sm">
        <div
          className={cn(
            "p-4 border-b border-border/40 bg-muted/20 rounded-t-2xl",
            !selectedId && "bg-primary/5"
          )}
        >
          <div
            className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-xl -m-1.5 p-1.5 transition-all"
            onClick={() => onSelect?.(undefined)}
          >
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <div className="p-1 bg-primary/10 rounded-lg text-primary">
                <Hash className="h-3.5 w-3.5" />
              </div>
              <span>合集目录</span>
              {!selectedId && (
                <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full tracking-wider font-bold">全部</span>
              )}
            </h3>
            <div className="flex items-center gap-0.5">
              {onToggleShowDocuments && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                  title={showDocuments ? "隐藏文档" : "显示文档"}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleShowDocuments()
                  }}
                >
                  {showDocuments ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                title="新建合集"
                onClick={(e) => {
                  e.stopPropagation()
                  onCreateCollection?.()
                }}
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="p-2" style={{ maxHeight: '500px' }}>
          {items.length > 0 ? (
            <div className="space-y-1">
              {items.map((item: CollectionItem) => (

                <CollectionNode
                  key={item.id}
                  item={item}
                  parentId={null}
                  siblings={items}
                  allItems={items}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onCreateCollection={onCreateCollection}
                  onDeleteCollection={onDeleteCollection}
                  onRenameCollection={onRenameCollection}
                  onMoveCollection={onMoveCollection}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
              <Folder className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-xs">暂无目录</p>
              <p className="text-xs mt-1">点击右上角创建</p>
            </div>
          )}
        </ScrollArea>
      </div>
    </DragContext.Provider>
  )
}
