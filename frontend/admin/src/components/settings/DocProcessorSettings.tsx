"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  FileText, 
  Plus, 
  Pencil, 
  Trash2, 
  Zap, 
  Loader2,
  Server,
  X,
  Check,
  ExternalLink
} from "lucide-react"
import { toast } from "sonner"
import { 
  type DocProcessorConfig, 
  type DocProcessorType,
  DOC_PROCESSOR_TYPES,
  initialDocProcessorConfig 
} from "@/types/settings"
import { api } from "@/lib/api-client"

export function DocProcessorSettings() {
  const [processors, setProcessors] = useState<DocProcessorConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  
  // 内联编辑状态
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState<DocProcessorConfig>(initialDocProcessorConfig)

  // 加载配置
  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setLoading(true)
      const response = await api.systemConfig.getDocProcessorConfig()
      if (response?.processors) {
        setProcessors(response.processors)
      }
    } catch (error) {
      console.error("Failed to load doc processor config:", error)
      toast.error("加载配置失败")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (updatedProcessors: DocProcessorConfig[]) => {
    try {
      setSaving(true)
      await api.systemConfig.updateDocProcessorConfig({
        processors: updatedProcessors
      })
      setProcessors(updatedProcessors)
      toast.success("配置保存成功")
    } catch (error) {
      console.error("Failed to save config:", error)
      toast.error("保存配置失败")
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (processor: DocProcessorConfig) => {
    try {
      setTesting(processor.name)
      const response = await api.systemConfig.testDocProcessorConnection(processor)
      if (response?.status === "healthy") {
        toast.success(`${processor.name} 连接成功`)
      } else {
        toast.error("连接失败")
      }
    } catch (error) {
      console.error("Test connection failed:", error)
      toast.error("连接测试失败")
    } finally {
      setTesting(null)
    }
  }

  const handleStartAdd = () => {
    setIsAdding(true)
    setEditingIndex(null)
    setFormData(initialDocProcessorConfig)
  }

  const handleStartEdit = (index: number) => {
    setEditingIndex(index)
    setIsAdding(false)
    setFormData({ ...processors[index] })
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingIndex(null)
    setFormData(initialDocProcessorConfig)
  }

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("请输入服务名称")
      return
    }
    if (!formData.baseUrl.trim()) {
      toast.error("请输入 API 端点")
      return
    }

    let updated: DocProcessorConfig[]
    if (editingIndex !== null) {
      // 编辑模式
      updated = processors.map((p, i) => i === editingIndex ? formData : p)
    } else {
      // 新增模式
      if (processors.some(p => p.name === formData.name)) {
        toast.error("服务名称已存在")
        return
      }
      updated = [...processors, formData]
    }

    handleSave(updated)
    handleCancel()
  }

  const handleDelete = (processorName: string) => {
    const updated = processors.filter(p => p.name !== processorName)
    handleSave(updated)
  }

  const handleToggleEnabled = (processorName: string, enabled: boolean) => {
    const updated = processors.map(p => 
      p.name === processorName ? { ...p, enabled } : p
    )
    handleSave(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  // 内联编辑表单
  const renderForm = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">
          {editingIndex !== null ? "编辑解析器" : "添加解析器"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              placeholder="例如：本地 Docling"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={editingIndex !== null}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">类型</Label>
            <Select
              value={formData.type}
              onValueChange={(value: DocProcessorType) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_PROCESSOR_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* 显示当前选中类型的说明和文档链接 */}
            {(() => {
              const selectedType = DOC_PROCESSOR_TYPES.find(t => t.value === formData.type)
              if (selectedType) {
                return (
                  <p className="text-xs text-slate-500">
                    {selectedType.description}
                    {selectedType.docUrl && (
                      <>
                        {" · "}
                        <a 
                          href={selectedType.docUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          部署文档 <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    )}
                  </p>
                )
              }
              return null
            })()}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="baseUrl">API 端点</Label>
          <Input
            id="baseUrl"
            placeholder="例如：http://localhost:5000"
            value={formData.baseUrl}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">API 密钥（可选）</Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="如果需要认证，请输入密钥"
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked: boolean) => setFormData({ ...formData, enabled: checked })}
            />
            <Label htmlFor="enabled">启用</Label>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              取消
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              保存
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  )

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-5">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
            <FileText className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">文档解析</h2>
            <p className="text-sm text-slate-500 font-medium">配置可用的文档解析 API，实际使用时可选择。</p>
          </div>
        </div>
        {!isAdding && editingIndex === null && (
          <Button onClick={handleStartAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            添加解析器
          </Button>
        )}
      </div>

      {/* 添加表单 */}
      {isAdding && renderForm()}

      {/* Processor List */}
      {processors.length === 0 && !isAdding ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500 mb-4">暂无配置的文档解析服务</p>
            <Button variant="outline" onClick={handleStartAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              添加第一个解析器
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {processors.map((processor, index) => (
            editingIndex === index ? (
              <div key={processor.name}>{renderForm()}</div>
            ) : (
              <Card key={processor.name} className={`transition-all ${!processor.enabled ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{processor.name}</CardTitle>
                        <CardDescription>
                          {DOC_PROCESSOR_TYPES.find(t => t.value === processor.type)?.label || processor.type}
                          {" · "}
                          {processor.baseUrl}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={processor.enabled}
                        onCheckedChange={(checked: boolean) => handleToggleEnabled(processor.name, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTest(processor)}
                        disabled={testing === processor.name}
                      >
                        {testing === processor.name ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartEdit(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(processor.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )
          ))}
        </div>
      )}
    </div>
    </div>
  )
}
