"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft,
  Save,
  Send,
  Image as ImageIcon,
  Settings as SettingsIcon,
  FileText,
  Tags,
  Hash,
  User,
  Info,
  Clock,
  ExternalLink
} from "lucide-react"
import { LazyMarkdownEditor } from "@/components/editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TagsInput } from "@/components/ui/TagsInput"
import { ImageUpload } from "@/components/ui/ImageUpload"
import type { CollectionTree } from "@/lib/api-client"
import { DocumentStatus } from "@/lib/api-client"
import { toast } from "sonner"
import { getRoutePath, useRouteContext } from "@/lib/routing"
import { useSiteData, useDocument, useCollectionTree, useUpdateDocument, documentKeys } from "@/hooks"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"
import { env } from "@/lib/env"
import { useQueryClient } from "@tanstack/react-query"

// 扩展类型以包含 level 属性
type CollectionTreeWithLevel = CollectionTree & { level?: number }

export default function EditDocumentPage() {
  const router = useRouter()
  const params = useParams()
  const routeContext = useRouteContext()
  const queryClient = useQueryClient()
  const documentId = parseInt(params.id as string)
  const currentSite = useSiteData()
  const siteId = currentSite.id

  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [originalCoverImage, setOriginalCoverImage] = useState<string | null>(null) // 追踪原始封面图
  const [collectionId, setCollectionId] = useState<string>("")
  const [content, setContent] = useState("")
  const [status, setStatus] = useState<DocumentStatus>(DocumentStatus.DRAFT)

  // 使用 React Query hooks
  const { data: document, isLoading: documentLoading } = useDocument(documentId)
  const { data: collectionsTree, isLoading: collectionsLoading } = useCollectionTree(siteId, false)
  const updateDocumentMutation = useUpdateDocument()

  const loading = documentLoading || collectionsLoading

  // 将树状结构扁平化为列表
  const flattenCollections = (tree: CollectionTree[]): CollectionTreeWithLevel[] => {
    const result: CollectionTreeWithLevel[] = []
    const flatten = (items: CollectionTree[], level = 0) => {
      items.forEach(item => {
        result.push({ ...item, level })
        if (item.children && item.children.length > 0) {
          flatten(item.children, level + 1)
        }
      })
    }
    flatten(tree)
    return result
  }

  const collections = collectionsTree ? flattenCollections(collectionsTree) : []

  // 当文档数据加载完成时，设置表单值
  useEffect(() => {
    if (document) {
      setTitle(document.title)
      setSummary(document.summary || "")
      setTags(document.tags || [])
      const coverImg = document.cover_image || null
      setCoverImage(coverImg)
      setOriginalCoverImage(coverImg) // 保存原始封面图
      setContent(document.content || "")
      setCollectionId(document.collection_id ? document.collection_id.toString() : "")
      // 确保 status 是有效值
      if (document.status === DocumentStatus.DRAFT || document.status === DocumentStatus.PUBLISHED) {
        setStatus(document.status)
      }
    }
  }, [document])

  const handleBack = () => {
    router.push(getRoutePath("/documents", routeContext.domain))
  }

  const handlePreview = () => {
    const clientUrl = env.NEXT_PUBLIC_CLIENT_URL
    const domain = routeContext.domain || currentSite.domain || 'demo'
    window.open(`${clientUrl}/${domain}?documentId=${documentId}`, '_blank')
  }

  const handleSave = async (newStatus?: DocumentStatus) => {
    if (!title.trim()) {
      toast.error("请输入文档标题")
      return
    }

    if (!collectionId) {
      toast.error("请选择所属合集")
      return
    }

    const targetStatus = newStatus || status

    updateDocumentMutation.mutate({
      documentId,
      data: {
        title: title.trim(),
        summary: summary.trim() || undefined,
        cover_image: coverImage,
        tags: tags,
        content: content || undefined,
        collection_id: parseInt(collectionId),
        status: targetStatus
      }
    }, {
      onSuccess: async () => {
        // 保存成功后，如果封面图片发生了变化，删除旧图片
        if (originalCoverImage && originalCoverImage !== coverImage) {
          try {
            // 从 URL 中提取 object_name
            const url = new URL(originalCoverImage)

            // 移除开头的斜杠和存储桶名称
            const pathParts = url.pathname.split('/').filter(Boolean)

            // object_name 格式: covers/xxx.jpg (移除 bucket 名称 catwiki)
            const objectName = pathParts.length > 1 ? pathParts.slice(1).join('/') : pathParts.join('/')

            // 调用删除 API
            await api.file.deleteFile(objectName)
          } catch (error: any) {
            // 删除失败不影响主流程，静默处理
            if (process.env.NODE_ENV === 'development') {
              console.error('删除旧封面图片失败:', error)
            }
          }
        }

        // 强制刷新文档列表缓存并重新获取数据
        await queryClient.invalidateQueries({
          queryKey: documentKeys.lists(),
          refetchType: 'all' // 强制重新获取所有匹配的查询
        })

        toast.success(targetStatus === DocumentStatus.PUBLISHED ? "文档已发布" : "草稿已保存")

        // 使用 setTimeout 确保在下一个事件循环中跳转，让缓存刷新完成
        setTimeout(() => {
          router.push(getRoutePath("/documents", routeContext.domain))
        }, 100)
      }
    })
  }

  if (loading && !document) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* 页面标题区域 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-100" onClick={handleBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">编辑文档</h1>
              <span className="text-slate-300 font-mono text-sm mt-1">#{documentId}</span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">更新现有文档的内容与配置，支持实时预览。</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-11 px-6 rounded-xl border-slate-200" onClick={handleBack} disabled={updateDocumentMutation.isPending}>
            取消
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2 h-11 px-6 rounded-xl border-slate-200"
            onClick={handlePreview}
          >
            <ExternalLink className="h-4 w-4" />
            预览文档
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2 h-11 px-6 rounded-xl border-slate-200"
            onClick={() => handleSave(DocumentStatus.DRAFT)}
            disabled={updateDocumentMutation.isPending}
          >
            <Save className="h-4 w-4" />
            保存草稿
          </Button>
          <Button
            className="flex items-center gap-2 h-11 px-8 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
            onClick={() => handleSave(DocumentStatus.PUBLISHED)}
            disabled={updateDocumentMutation.isPending}
          >
            <Send className="h-4 w-4" />
            {updateDocumentMutation.isPending ? "保存中..." : "保存并发布"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* 左侧主要内容区域 */}
        <div className="col-span-9 space-y-6">
          <Card className="border-border/50 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="pb-6 px-8 pt-8 space-y-4">
              {/* 标题输入 */}
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="在此输入文档标题..."
                  className="text-3xl font-extrabold border-none focus-visible:ring-0 px-0 h-auto placeholder:text-slate-300 bg-transparent"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* 摘要输入 */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Info className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">文章摘要</span>
                </div>
                <Textarea
                  placeholder="添加一段简短的摘要，描述这篇文章的主要内容..."
                  className="resize-none min-h-[80px] text-sm leading-relaxed text-slate-600 border-none bg-slate-50/50 focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl px-4 py-3 placeholder:text-slate-400"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 border-t border-slate-100">
              <div className="md-editor-container">
                <LazyMarkdownEditor
                  value={content}
                  onChange={setContent}
                  placeholder="从这里开始您的创作..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧配置侧边栏 */}
        <div className="col-span-3 space-y-6">
          <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-muted/20 py-5 px-6">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="p-1.5 bg-white rounded-lg shadow-sm">
                  <SettingsIcon className="h-4 w-4 text-primary" />
                </div>
                文档配置
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* 所属合集 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <Hash className="h-4 w-4" />
                  <label className="text-sm font-bold">所属合集</label>
                  <span className="text-red-500">*</span>
                </div>
                <Select value={collectionId} onValueChange={setCollectionId} disabled={loading}>
                  <SelectTrigger className="w-full bg-slate-50/50 border-slate-200 h-10 rounded-xl">
                    <SelectValue placeholder={loading ? "加载中..." : "选择合集..."} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {collections.map((col: CollectionTreeWithLevel) => (

                      <SelectItem key={col.id} value={col.id.toString()} className="text-sm">
                        <span style={{ paddingLeft: `${(col.level || 0) * 12}px` }}>
                          {col.title}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 标签 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <Tags className="h-4 w-4" />
                  <label className="text-sm font-bold">标签</label>
                </div>
                <TagsInput
                  value={tags}
                  onChange={setTags}
                  placeholder="按回车或逗号添加标签..."
                />
              </div>

              {/* 封面图 */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-slate-500">
                  <ImageIcon className="h-4 w-4" />
                  <label className="text-sm font-bold">封面图片</label>
                </div>
                <ImageUpload
                  value={coverImage}
                  onChange={setCoverImage}
                  disabled={updateDocumentMutation.isPending}
                />
              </div>

              {/* 附加信息 */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Info className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">当前状态</span>
                  </div>
                  <Badge variant={status === DocumentStatus.PUBLISHED ? "default" : "outline"} className={cn(
                    "text-[10px] font-bold border-none",
                    status === DocumentStatus.PUBLISHED ? "bg-emerald-50 text-emerald-600" : "bg-white border-slate-200 text-slate-500"
                  )}>
                    {status === DocumentStatus.PUBLISHED ? "已发布" : "草稿"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">上次更新</span>
                  </div>
                  <span className="text-xs font-bold text-slate-700">
                    {document?.updated_at ? new Date(document.updated_at).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    }) : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-500">
                    <User className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">文章作者</span>
                  </div>
                  <span className="text-xs font-bold text-slate-700">{document?.author || "Admin"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 自定义样式 */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .md-editor {
          --md-bk-color: transparent !important;
          --md-color: #0f172a !important;
          border: none !important;
        }
        .md-editor-toolbar-wrapper {
          border-bottom: 1px solid #f1f5f9 !important;
          background-color: #fff !important;
          padding: 12px 24px !important;
        }
        .md-editor-content {
          font-family: inherit !important;
        }
        .md-editor-footer {
          border-top: 1px solid #f1f5f9 !important;
          background-color: #fbfbfc !important;
          height: 40px !important;
          padding: 0 24px !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          color: #94a3b8 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.1em !important;
        }
        .md-editor-preview-wrapper {
          padding: 40px !important;
          background-color: #fbfbfc !important;
        }
        .md-editor-input-wrapper {
          padding: 40px !important;
        }
        .md-editor-toolbar-item {
          color: #64748b !important;
          transition: all 0.2s !important;
        }
        .md-editor-toolbar-item:hover {
          color: #3b82f6 !important;
          background-color: #eff6ff !important;
          border-radius: 8px !important;
        }
        .shadow-primary/20 {
          box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.2);
        }
      `}} />
    </div>
  )
}
