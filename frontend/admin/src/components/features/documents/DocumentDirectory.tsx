"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronRight, Hash, Folder, FolderPlus, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DirectoryItem } from "@/types"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface DocumentDirectoryProps {
  items: DirectoryItem[]
  selectedId?: string
  onSelect?: (id: string, type?: "collection" | "document") => void
  onCreateCollection?: (parentId?: string) => void
  onReorder?: (newItems: DirectoryItem[]) => void
}

interface SortableItemProps {
  item: DirectoryItem
  level: number
  isExpanded: boolean
  isSelected: boolean
  onToggleCollection: (id: string) => void
  onSelect: (id: string, type?: "collection" | "document") => void
  onCreateCollection?: (parentId?: string) => void
  children?: React.ReactNode
}

function SortableItem({
  item,
  level,
  isExpanded,
  isSelected,
  onToggleCollection,
  onSelect,
  onCreateCollection,
  children,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginLeft: `${level * 12}px`,
  }

  const isCollection = item.type === "collection"

  return (
    <div ref={setNodeRef} style={style} className="mb-1">
      <div
        className={cn(
          "group flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200",
          isSelected
            ? "bg-primary/10 text-primary border border-primary/20"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          isDragging && "shadow-lg ring-2 ring-primary/20"
        )}
      >
        {/* 拖拽手柄 */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-slate-400" />
        </div>

        {isCollection ? (
          <div
            className="flex items-center gap-2 flex-1 overflow-hidden cursor-pointer"
            onClick={() => {
              onToggleCollection(item.id)
              onSelect(item.id, item.type)
            }}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-slate-400 transition-transform duration-200 shrink-0",
                isExpanded && "rotate-90"
              )}
            />
            {/* Folder icon 代表 Collection */}
            <Folder className={cn("h-4 w-4 shrink-0", isExpanded ? "text-primary/60" : "text-slate-400")} />
            <span className="text-[13px] font-medium truncate flex-1">
              {item.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-primary p-0"
              onClick={(e) => {
                e.stopPropagation()
                onCreateCollection?.(item.id)
              }}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 flex-1 overflow-hidden pl-5 cursor-pointer"
            onClick={() => onSelect(item.id, item.type)}
          >
            <Hash className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-primary" : "text-slate-400")} />
            <span className="text-[13px] truncate">{item.name}</span>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

export function DocumentDirectory({
  items: initialItems,
  selectedId,
  onSelect,
  onCreateCollection,
  onReorder
}: DocumentDirectoryProps) {
  const [items, setItems] = useState<DirectoryItem[]>(initialItems)
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    new Set(initialItems.map((i: DirectoryItem) => i.id))
  )

  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const toggleCollection = (id: string) => {
    const newExpanded = new Set(expandedCollections)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedCollections(newExpanded)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        const newItems = arrayMove(items, oldIndex, newIndex)
        onReorder?.(newItems)
        return newItems
      })
    }

    setActiveId(null)
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  // 同步外部 items 的变化
  if (JSON.stringify(initialItems) !== JSON.stringify(items)) {
    setItems(initialItems)
  }

  const renderItem = (item: DirectoryItem, level = 0) => {
    const isExpanded = expandedCollections.has(item.id)
    const isSelected = selectedId === item.id
    const isCollection = item.type === "collection"

    return (
      <SortableItem
        key={item.id}
        item={item}
        level={level}
        isExpanded={isExpanded}
        isSelected={isSelected}
        onToggleCollection={toggleCollection}
        onSelect={onSelect || (() => { })}
        onCreateCollection={onCreateCollection}
      >
        {isCollection && isExpanded && item.children && item.children.length > 0 && (
          <div className="mt-1">
            <SortableContext
              items={item.children.map((c: DirectoryItem) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {item.children.map((child: DirectoryItem) => renderItem(child, level + 1))}
            </SortableContext>

          </div>
        )}
      </SortableItem>
    )
  }

  const activeItem = activeId ? items.find((item: DirectoryItem) => item.id === activeId) : null


  return (
    <div className="w-full h-full flex flex-col bg-slate-50/50 rounded-xl border border-slate-200/60">
      <div
        className="p-4 border-b border-slate-200/60 bg-white/50 rounded-t-xl flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => onSelect?.("", "collection")}
      >
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Hash className="h-4 w-4 text-primary" />
          合集文档结构
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-400 hover:text-primary hover:bg-primary/5"
          title="新建文件夹"
          onClick={(e) => {
            e.stopPropagation()
            onCreateCollection?.()
          }}
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={items.map((item: DirectoryItem) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {items.map((item: DirectoryItem) => renderItem(item))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeItem ? (
              <div className="bg-white rounded-lg shadow-lg p-3 border-2 border-primary">
                <div className="flex items-center gap-2">
                  {activeItem.type === "collection" ? (
                    <>
                      {/* Folder icon 代表 Collection */}
                      <Folder className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{activeItem.name}</span>
                    </>
                  ) : (
                    <>
                      <Hash className="h-4 w-4 text-primary" />
                      <span className="text-sm">{activeItem.name}</span>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>
    </div>
  )
}
