"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Users, MessageSquare, Eye, Network, Flame, ChevronRight, Clock, History } from "lucide-react"
import { useSiteData, useDocuments, useSiteStats } from "@/hooks"
import { getRoutePath, useRouteContext } from "@/lib/routing"
import { cn } from "@/lib/utils"
import type { Document } from "@/lib/api-client"


// 统计图标映射
const statIcons = {
  "文档总数": FileText,
  "访问次数": Eye,
  "问答次数": MessageSquare,
  "访问用户数": Users,
  "来源 IP 数": Network,
}

// 统计项配置
const STATS_CONFIG = [
  { title: "文档总数", description: "知识库文档", color: "text-blue-600", bg: "bg-blue-50" },
  { title: "累计阅读", description: "文章阅读总数", color: "text-emerald-600", bg: "bg-emerald-50" },
  { title: "AI 会话", description: "今日新增会话", color: "text-blue-600", bg: "bg-blue-50" },
  { title: "AI 消息", description: "互动消息总量", color: "text-orange-600", bg: "bg-orange-50" },
  { title: "独立访客", description: "今日独立IP", color: "text-rose-600", bg: "bg-rose-50" },
] as const

import AISessionChart from "@/components/charts/AISessionChart"


export default function AdminHome() {
  const currentSite = useSiteData()
  const routeContext = useRouteContext()
  const siteId = currentSite.id

  // 使用 React Query hooks
  const { data: hotDocsData, isLoading: hotDocsLoading } = useDocuments({
    siteId,
    page: 1,
    size: 5,
    orderBy: 'views',
    orderDir: 'desc',
  })

  const { data: recentDocsData, isLoading: recentDocsLoading } = useDocuments({
    siteId,
    page: 1,
    size: 5,
    orderBy: 'updated_at',
    orderDir: 'desc',
  })

  const { data: statsData, isLoading: statsLoading, error: statsError } = useSiteStats(siteId)

  const hotDocs = hotDocsData?.documents || []
  const recentDocs = recentDocsData?.documents || []
  const loading = hotDocsLoading || recentDocsLoading || statsLoading
  
  // 调试辅助与数据转换
  const stats = {
    totalDocuments: statsData?.total_documents ?? 0,
    totalViews: statsData?.total_views ?? 0,
    viewsToday: statsData?.views_today ?? 0,
    uniqueIpsToday: statsData?.unique_ips_today ?? 0,
    totalChatSessions: statsData?.total_chat_sessions ?? 0,
    totalChatMessages: statsData?.total_chat_messages ?? 0,
    activeChatUsers: statsData?.active_chat_users ?? 0,
    newSessionsToday: statsData?.new_sessions_today ?? 0,
    newMessagesToday: statsData?.new_messages_today ?? 0,
    dailyTrends: statsData?.daily_trends || [],
    recentSessions: statsData?.recent_sessions || [],
  }

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          运营概览
        </h1>
        <p className="text-slate-500 mt-2">查看当前 Wiki 站点的运行状况和关键指标。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {STATS_CONFIG.map((stat) => {
          const Icon = statIcons[stat.title as keyof typeof statIcons] || FileText
          // 根据标题显示实际数据
          let displayValue = "0"
          let subValue = ""
          
          if (stat.title === "文档总数") {
            displayValue = stats.totalDocuments.toString()
          } else if (stat.title === "累计阅读") {
            displayValue = stats.totalViews.toString()
            if (stats.viewsToday >= 0) {
              subValue = `今日 +${stats.viewsToday}`
            }
          } else if (stat.title === "AI 会话") {
            displayValue = stats.totalChatSessions.toString()
            if (stats.newSessionsToday >= 0) {
              subValue = `今日 +${stats.newSessionsToday}`
            }
          } else if (stat.title === "AI 消息") {
            displayValue = stats.totalChatMessages.toString()
            if (stats.newMessagesToday >= 0) {
              subValue = `今日 +${stats.newMessagesToday}`
            }
          } else if (stat.title === "独立访客") {
            displayValue = stats.uniqueIpsToday.toString()
            subValue = "今日独立 IP"
          }

          return (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{displayValue}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-slate-500 font-medium">
                    {stat.description}
                  </p>
                  {stat.title === "AI 会话" || stat.title === "AI 消息" ? (
                    <div className="flex items-center gap-1.5 font-bold">
                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter">TODAY</span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full transition-all",
                          (subValue.includes("+0") || !subValue) ? "bg-slate-100 text-slate-400" : "bg-emerald-500 text-white shadow-sm"
                        )}>
                          {subValue.replace('今日 ', '') || '0'}
                        </span>
                    </div>
                  ) : subValue && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {subValue}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 趋势与动态汇总 */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* AI 会话趋势 - 占据 2/3 宽度 */}
        <Card className="md:col-span-2 border-border/50 shadow-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-muted/20 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600">
                <Network className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-bold">AI 会话趋势</CardTitle>
            </div>
            <div className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded">最近 7 天</div>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col">
            <div className="flex-1 w-full min-h-[200px] px-2">
              {statsError ? (
                <div className="w-full h-full flex items-center justify-center text-rose-500 text-xs text-center p-4">
                  加载趋势失败: {(statsError as any)?.message || "未知错误"}
                </div>
              ) : statsLoading ? (
                 <div className="w-full h-full flex items-center justify-center text-slate-300 animate-pulse text-sm">正在加载统计数据...</div>
              ) : (stats.dailyTrends && stats.dailyTrends.length > 0) ? (
                 <AISessionChart 
                    data={stats.dailyTrends.map((d: any) => ({
                        date: d.date,
                        value: Number(d.sessions) || 0,
                        subValue: d.messages || 0
                    }))}
                 />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300 italic text-sm">暂无趋势采样数据</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 最近 AI 问答 - 占据 1/3 宽度 */}
        <Card className="md:col-span-1 border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-muted/20 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-bold">最近 AI 问答</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {stats.recentSessions.length > 0 ? (
                stats.recentSessions.map((session: any) => (
                  <div key={session.thread_id} className="p-4 hover:bg-muted/30 transition-colors cursor-default group">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{session.title || '新对话'}</h4>
                      <span className="text-[10px] font-medium text-slate-400">
                        {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-500 font-medium">
                        {session.message_count} 轮对话
                       </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center">
                  <p className="text-xs text-muted-foreground italic">暂无对话记录</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 热门文档卡片 */}
        <Card className="col-span-1 border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-muted/20 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-orange-500/10 rounded-xl text-orange-600">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">热门文档</CardTitle>
                <p className="text-[10px] text-muted-foreground font-medium">累计浏览量最高的活跃内容</p>
              </div>
            </div>
            <Link href={getRoutePath("/documents", routeContext.domain)}>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-semibold text-primary hover:bg-primary/5">
                查看全部
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs text-muted-foreground">加载中...</span>
                </div>
              ) : hotDocs.length > 0 ? (
                hotDocs.map((doc: Document, i: number) => (
                  <Link
                    key={doc.id}
                    href={getRoutePath(`/documents/edit/${doc.id}`, routeContext.domain)}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-all group"
                  >
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black italic",
                      i === 0 ? "bg-amber-100 text-amber-600 border border-amber-200" :
                        i === 1 ? "bg-slate-100 text-slate-500 border border-slate-200" :
                          i === 2 ? "bg-orange-50 text-orange-400 border border-orange-100" :
                            "text-muted-foreground/40"
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate tracking-tight">
                        {doc.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                          <Eye className="h-3 w-3 opacity-60" />
                          <span>{doc.views?.toLocaleString() || 0} 次预览</span>
                        </div>
                        {doc.category && (
                          <span className="h-3 w-[1px] bg-border/60" />
                        )}
                        {doc.category && (
                          <span className="text-[10px] text-muted-foreground font-medium">{doc.category}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary/40 group-hover:translate-x-1 transition-all" />
                  </Link>
                ))
              ) : (
                <div className="py-20 text-center">
                  <p className="text-sm text-muted-foreground italic">暂无热门文档数据</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 最近更新卡片 */}
        <Card className="col-span-1 border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 bg-muted/20 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600">
                <History className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">最近更新</CardTitle>
                <p className="text-[10px] text-muted-foreground font-medium">知识库内容的最新动态记录</p>
              </div>
            </div>
            <Link href={getRoutePath("/documents", routeContext.domain)}>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-semibold text-primary hover:bg-primary/5">
                查看全部
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative p-6 space-y-6">
              {/* 垂直时间线轴 */}
              <div className="absolute left-[39px] top-8 bottom-8 w-[2px] bg-border/40" />

              {loading ? (
                <div className="py-14 flex flex-col items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs text-muted-foreground">正在获取动态...</span>
                </div>
              ) : recentDocs.length > 0 ? (
                recentDocs.map((doc: Document) => (
                  <Link
                    key={doc.id}
                    href={getRoutePath(`/documents/edit/${doc.id}`, routeContext.domain)}
                    className="flex items-start gap-4 group relative z-10"
                  >
                    <div className="w-8 h-8 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center group-hover:border-primary group-hover:bg-primary/5 transition-all">
                      <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate tracking-tight">
                        {doc.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground/60">{doc.author || '系统'}</span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-medium">
                          <Clock className="h-3 w-3 opacity-60" />
                          <span>
                            {new Date(doc.updated_at).toLocaleString('zh-CN', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-14 text-center">
                  <p className="text-sm text-muted-foreground italic">暂无更新动态</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
