"use client"

import React from 'react'
import { useTranslations } from 'next-intl'
import { useTasks } from '@/contexts/TaskContext'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { X, Minus, Loader2, CheckCircle2, AlertCircle, ChevronUp } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { type Task } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { DOC_PROCESSOR_TYPES } from '@/types/settings'

export function TaskQueuePanel() {
  const { tasks, isPanelOpen, setPanelOpen, minimizePanel, togglePanel, removeTask, clearFinishedTasks } = useTasks()
  const t = useTranslations('TaskQueue')

  if (tasks.length === 0) return null

  // Calculate totals
  const total = tasks.length
  const completed = tasks.filter(t => t.status === 'completed').length
  const failed = tasks.filter(t => t.status === 'failed').length
  const processing = tasks.filter(t => t.status === 'processing' || t.status === 'pending' || t.status === 'running').length

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'processing': 
      case 'running':
      case 'pending':
      default: return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    }
  }

  const getStatusTextColor = (status: Task['status']) => {
    switch (status) {
      case 'completed': return 'text-emerald-600'
      case 'failed': return 'text-red-600'
      default: return 'text-slate-600'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return t("completed")
      case 'failed': return t("failed")
      case 'pending': return t("pending")
      case 'processing': return t("processing")
      case 'running': return t("processing")
      default: return status
    }
  }

  const totalProgress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0

  return (
    <>
      <AnimatePresence>
        {!isPanelOpen && tasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 right-6 z-50 cursor-pointer shadow-lg rounded-full"
            onClick={togglePanel}
          >
            <div className="bg-white border border-slate-200 rounded-full pl-2 pr-4 py-2 flex items-center gap-3 font-medium text-sm hover:bg-slate-50 transition-colors">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                {processing > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {processing > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                    {processing}
                  </span>
                )}
              </div>
              <span className="text-slate-700">{t("documentProcessing")} ({completed + failed}/{total})</span>
              <ChevronUp className="h-4 w-4 text-slate-400" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPanelOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] shadow-2xl rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {processing > 0 ? <Loader2 className="h-4 w-4 text-blue-500 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                <span className="font-semibold text-sm text-slate-800">
                  {processing > 0 ? t("processingDocuments") : t("processingComplete")}
                </span>
                <span className="text-xs text-slate-500 ml-1">({completed + failed}/{total})</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md" onClick={minimizePanel}>
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                {processing === 0 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md" onClick={() => setPanelOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {totalProgress < 100 && (
              <div className="px-4 pt-3">
                <div className="h-1.5 w-full bg-slate-100 overflow-hidden rounded-full">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-in-out" 
                    style={{ width: `${totalProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {tasks.map((task) => {
                const filename = task.payload?.filename || task.payload?.original_filename || t("taskFallback", { id: task.id })
                const processorType = task.payload?.processor_config?.type
                const processorInfo = processorType
                  ? DOC_PROCESSOR_TYPES.find(p => p.value === processorType)
                  : null
                return (
                  <div key={task.id} className="flex flex-col p-2 bg-white hover:bg-slate-50 rounded-lg group transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 overflow-hidden">
                        <div className="mt-0.5 shrink-0">
                          {getStatusIcon(task.status)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate" title={filename}>
                            {filename}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn("text-xs", getStatusTextColor(task.status))}>
                              {getStatusLabel(task.status)}
                            </span>
                            {processorInfo && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                {processorInfo.icon.startsWith('/') ? (
                                  <Image src={processorInfo.icon} alt={processorInfo.label} width={12} height={12} className="object-contain" />
                                ) : null}
                                {processorInfo.label}
                              </span>
                            )}
                            {task.status === 'failed' && task.error && (
                              <span className="text-xs text-red-500 truncate max-w-[150px]" title={task.error}>
                                : {task.error}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {(task.status === 'completed' || task.status === 'failed') && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" 
                          onClick={() => removeTask(task.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {processing === 0 && (
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex justify-end">
                <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-slate-500 hover:text-slate-900" onClick={clearFinishedTasks}>
                  {t("clearAll")}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
