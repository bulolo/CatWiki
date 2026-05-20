// Copyright 2026 CatWiki Authors
// 
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.

"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getAdminTask } from '@/lib/sdk/admin-tasks'
import type { Task } from '@/lib/sdk/sdk.schemas'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

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

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isPanelOpen, setPanelOpen] = useState(false)
  const queryClient = useQueryClient()
  const t = useTranslations('TaskQueue')

  // Polling logic
  useEffect(() => {
    // Collect active tasks
    const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'processing' || t.status === 'running')
    
    if (activeTasks.length === 0) return

    const timer = setInterval(async () => {
      let isAnyCompleted = false
      const updatedTasks = await Promise.all(
        tasks.map(async (task) => {
          if (task.status === 'pending' || task.status === 'processing' || task.status === 'running') {
            try {
              const latest = await getAdminTask(task.id)
              if (!latest) return task

              // Handle completion to notify
              const payload = (latest.payload ?? {}) as Record<string, string | undefined>
              if (latest.status === 'completed') {
                isAnyCompleted = true
                toast.success(t('docCompleted', { name: payload.filename || t('taskFallback', { id: latest.id }) }))
              }
              if (latest.status === 'failed') {
                isAnyCompleted = true
                toast.error(t('docFailed', { name: payload.filename || t('taskFallback', { id: latest.id }), error: latest.error || 'Unknown error' }))
              }

              return latest
            } catch (err) {
              console.error(`Failed to poll task ${task.id}`, err)
              return task
            }
          }
          return task
        })
      )

      setTasks(updatedTasks)

      // Invalidate document list cache to naturally refresh lists 
      if (isAnyCompleted) {
        queryClient.invalidateQueries({ queryKey: ['adminDocuments'] })
        queryClient.invalidateQueries({ queryKey: ['documents'] })
      }

    }, 3000)

    return () => clearInterval(timer)
  }, [tasks, queryClient, t])

  const addTasks = useCallback((newTasks: Task[]) => {
    setTasks(prev => {
      // Avoid duplicates
      const existingIds = new Set(prev.map(t => t.id))
      const toAdd = newTasks.filter(t => !existingIds.has(t.id))
      return [...prev, ...toAdd]
    })
    setPanelOpen(true)
  }, [])

  const removeTask = useCallback((taskId: number) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }, [])

  const clearFinishedTasks = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status === 'pending' || t.status === 'processing' || t.status === 'running'))
  }, [])

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
      togglePanel
    }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const context = useContext(TaskContext)
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider')
  }
  return context
}
