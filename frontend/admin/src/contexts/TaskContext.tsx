// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.

"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import { getAdminTask } from "@/lib/sdk/admin-tasks"
import { getListAdminDocumentsQueryKey } from "@/lib/sdk/admin-documents"
import type { Task } from "@/lib/sdk/sdk.schemas"
import { toast } from "sonner"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { logger } from "@/lib/logger"

interface TaskContextType {
  tasks: Task[]
  isPanelOpen: boolean
  setPanelOpen: (open: boolean) => void
  addTasks: (newTasks: Task[]) => void
  removeTask: (taskId: number) => void
  clearFinishedTasks: () => void
  minimizePanel: () => void
  togglePanel: () => void
}

const TaskContext = createContext<TaskContextType | undefined>(undefined)

const ACTIVE_STATUSES = ["pending", "processing", "running"] as const
type ActiveStatus = typeof ACTIVE_STATUSES[number]
const isActive = (status: string | undefined | null): status is ActiveStatus =>
  ACTIVE_STATUSES.includes(status as ActiveStatus)

const TASK_QUERY_KEY = (id: number) => ["admin-task", id] as const
const POLL_INTERVAL = 3000

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [taskIds, setTaskIds] = useState<number[]>([])
  const [isPanelOpen, setPanelOpen] = useState(false)
  const queryClient = useQueryClient()
  const t = useTranslations("TaskQueue")

  // 每个任务一个 useQuery，自动按 refetchInterval 轮询；进入终止态后 refetchInterval=false 停止轮询
  const results = useQueries({
    queries: taskIds.map(id => ({
      queryKey: TASK_QUERY_KEY(id),
      queryFn: async () => {
        try {
          const latest = await getAdminTask(id)
          return latest ?? null
        } catch (err) {
          logger.error(`Failed to poll task ${id}`, err)
          throw err
        }
      },
      refetchInterval: (query: { state: { data: Task | null | undefined } }) =>
        isActive(query.state.data?.status ?? "pending") ? POLL_INTERVAL : false,
    })),
  })

  const tasks: Task[] = results
    .map(r => r.data)
    .filter((t): t is Task => !!t)

  // 监听 pending/processing/running → completed/failed 的状态转换，仅 toast 一次
  const notifiedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    let anyTerminal = false
    for (const task of tasks) {
      if (notifiedRef.current.has(task.id)) continue
      if (task.status !== "completed" && task.status !== "failed") continue
      notifiedRef.current.add(task.id)
      anyTerminal = true
      const payload = (task.payload ?? {}) as Record<string, string | undefined>
      const name = payload.filename || t("taskFallback", { id: task.id })
      if (task.status === "completed") {
        toast.success(t("docCompleted", { name }))
      } else {
        toast.error(t("docFailed", { name, error: task.error || "Unknown error" }))
      }
    }
    if (anyTerminal) {
      queryClient.invalidateQueries({ queryKey: getListAdminDocumentsQueryKey() })
    }
  }, [tasks, queryClient, t])

  const addTasks = useCallback((newTasks: Task[]) => {
    setTaskIds(prev => {
      const existing = new Set(prev)
      const merged = [...prev]
      for (const task of newTasks) {
        if (existing.has(task.id)) continue
        // 先把后端返回的初始状态写进 cache，避免首屏拿不到数据要等第一次 fetch
        queryClient.setQueryData(TASK_QUERY_KEY(task.id), task)
        merged.push(task.id)
      }
      return merged
    })
    setPanelOpen(true)
  }, [queryClient])

  const removeTask = useCallback((taskId: number) => {
    setTaskIds(prev => prev.filter(id => id !== taskId))
    queryClient.removeQueries({ queryKey: TASK_QUERY_KEY(taskId) })
    notifiedRef.current.delete(taskId)
  }, [queryClient])

  const clearFinishedTasks = useCallback(() => {
    setTaskIds(prev => prev.filter(id => {
      const task = queryClient.getQueryData<Task | null>(TASK_QUERY_KEY(id))
      const keep = isActive(task?.status ?? undefined)
      if (!keep) {
        queryClient.removeQueries({ queryKey: TASK_QUERY_KEY(id) })
        notifiedRef.current.delete(id)
      }
      return keep
    }))
  }, [queryClient])

  const minimizePanel = useCallback(() => setPanelOpen(false), [])
  const togglePanel = useCallback(() => setPanelOpen(prev => !prev), [])

  return (
    <TaskContext.Provider value={{
      tasks,
      isPanelOpen,
      setPanelOpen,
      addTasks,
      removeTask,
      clearFinishedTasks,
      minimizePanel,
      togglePanel,
    }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const context = useContext(TaskContext)
  if (context === undefined) {
    throw new Error("useTasks must be used within a TaskProvider")
  }
  return context
}
