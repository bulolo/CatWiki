"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  Plus
} from "lucide-react"
import { LazyMarkdownEditor } from "@/components/editor"
import { CreateCollectionDialog } from "@/components/features/documents/CreateCollectionDialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TagsInput } from "@/components/ui/TagsInput"
import { ImageUpload } from "@/components/ui/ImageUpload"
import { DraftRestoreDialog } from "@/components/ui/DraftRestoreDialog"
import type { CollectionTree } from "@/lib/api-client"
import { DocumentStatus } from "@/lib/api-client"
import { toast } from "sonner"
import { getRoutePath, useRouteContext } from "@/lib/routing"
import { useSiteData, useCollectionTree, useCreateDocument, documentKeys, useAutosave, useDraftRestore } from "@/hooks"
import { getUserInfo } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"

// 扩展类型以包含 level 属性
type CollectionTreeWithLevel = CollectionTree & { level?: number }

export default function NewDocumentPage() {
  const router = useRouter()
  const routeContext = useRouteContext()
  const queryClient = useQueryClient()
  const currentSite = useSiteData()
  const siteId = currentSite.id

  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [collectionId, setCollectionId] = useState<string>("")
  const [content, setContent] = useState("")
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false)


  // 使用 React Query hooks
  const { data: collectionsTree, isLoading: loading } = useCollectionTree(siteId, false)
  const createDocumentMutation = useCreateDocument(siteId)

  // 草稿恢复
  const draftKey = `draft-new-${siteId}`
  const { hasDraft, draftData, restoreDraft, discardDraft, savedTimeAgo } = useDraftRestore(draftKey)

  // 自动保存草稿
  const { clearDraft, isSaving, lastSavedTime } = useAutosave(
    {
      title,
      content,
      summary,
      tags,
      coverImage,
      collectionId
    },
    draftKey,
    2000, // 2秒延迟
    true // 启用自动保存
  )

  // 恢复草稿处理
  const handleRestoreDraft = () => {
    const draft = restoreDraft()
    if (draft) {
      setTitle(draft.title || "")
      setContent(draft.content || "")
      setSummary(draft.summary || "")
      setTags(draft.tags || [])
      setCoverImage(draft.coverImage || null)
      setCollectionId(draft.collectionId || "")
      toast.success("草稿已恢复")
    }
  }

  // 丢弃草稿处理
  const handleDiscardDraft = () => {
    discardDraft()
    toast.info("草稿已丢弃")
  }



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

  const handleBack = () => {
    router.push(getRoutePath("/documents", routeContext.domain))
  }

  const handleSave = (status: DocumentStatus) => {
    if (!title.trim()) {
      toast.error("请输入文档标题")
      return
    }

    if (!collectionId) {
      toast.error("请选择所属合集")
      return
    }

    // 获取当前登录用户信息
    const userInfo = getUserInfo()
    const author = userInfo?.name || userInfo?.email || "Admin"

    createDocumentMutation.mutate({
      site_id: siteId,
      title: title.trim(),
      summary: summary.trim() || undefined,
      cover_image: coverImage,
      tags: tags,
      content: content || undefined,
      collection_id: parseInt(collectionId),
      author: author,
      status
    }, {
      onSuccess: async () => {
        // 清除草稿
        clearDraft()

        // 强制刷新文档列表缓存并重新获取数据
        await queryClient.invalidateQueries({
          queryKey: documentKeys.lists(),
          refetchType: 'all' // 强制重新获取所有匹配的查询
        })

        toast.success(status === DocumentStatus.PUBLISHED ? "文档已发布" : "草稿已保存")

        // 使用 setTimeout 确保在下一个事件循环中跳转，让缓存刷新完成
        setTimeout(() => {
          router.push(getRoutePath("/documents", routeContext.domain))
        }, 100)
      }
    })
  }

  return (
    <>
      {/* 草稿恢复对话框 */}
      <DraftRestoreDialog
        open={hasDraft}
        onRestore={handleRestoreDraft}
        onDiscard={handleDiscardDraft}
        savedTimeAgo={savedTimeAgo}
      />

      <CreateCollectionDialog
        siteId={siteId}
        open={isCreateCollectionOpen}
        onOpenChange={setIsCreateCollectionOpen}
        onSuccess={(id) => setCollectionId(id.toString())}
        collections={collections}
      />

      <div className="max-w-7xl mx-auto space-y-6 pb-20">
        {/* 页面标题区域 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-sm">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">撰写新文档</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-muted-foreground text-sm">创建一个全新的百科文档，支持 Markdown 创作。</p>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3 w-3" />
                  <span>
                    {isSaving ? "保存中..." : lastSavedTime ? `已保存于 ${lastSavedTime.toLocaleTimeString()}` : "等待输入..."}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-11 px-6 rounded-xl border-slate-200" onClick={handleBack} disabled={createDocumentMutation.isPending}>
              取消
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 h-11 px-6 rounded-xl border-slate-200"
              onClick={() => handleSave(DocumentStatus.DRAFT)}
              disabled={createDocumentMutation.isPending}
            >
              <Save className="h-4 w-4" />
              存为草稿
            </Button>
            <Button
              className="flex items-center gap-2 h-11 px-8 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
              onClick={() => handleSave(DocumentStatus.PUBLISHED)}
              disabled={createDocumentMutation.isPending}
            >
              <Send className="h-4 w-4" />
              {createDocumentMutation.isPending ? "保存中..." : "发布文档"}
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
                  <div className="flex items-center gap-2">
                    <Select value={collectionId} onValueChange={setCollectionId} disabled={loading}>
                      <SelectTrigger className="flex-1 bg-slate-50/50 border-slate-200 h-10 rounded-xl">
                        <SelectValue placeholder={loading ? "加载中..." : (collections.length === 0 ? "暂无合集，请先创建" : "选择合集...")} />
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
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-xl border-slate-200 hover:bg-slate-50 transition-colors"
                      onClick={() => setIsCreateCollectionOpen(true)}
                      title="创建新合集"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {collections.length === 0 && !loading && (
                    <p className="text-[10px] text-amber-600 font-medium">还没有合集？点击右侧“+”按钮快速创建一个。</p>
                  )}
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
                    disabled={createDocumentMutation.isPending}
                  />
                </div>

                {/* 附加信息 */}
                <div className="pt-6 border-t border-slate-100 space-y-4">
                  <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-xl">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Info className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">当前状态</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-white border-slate-200 text-slate-500 font-bold">草稿</Badge>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-xl">
                    <div className="flex items-center gap-2 text-slate-500">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">文章作者</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      {getUserInfo()?.name || getUserInfo()?.email || "Admin"}
                    </span>
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
    </>
  )
}
