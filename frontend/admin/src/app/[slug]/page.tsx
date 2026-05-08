// Copyright 2026 CatWiki Authors
// 
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui"
import { FileText, Users, MessageSquare, Eye, Network, Flame, ChevronRight, Clock, History, Loader2, Crown, BarChart3 } from "lucide-react"
import { useSiteData, useDocuments, useSiteStats, useHealth } from "@/hooks"
import { getRoutePath, useRouteContext } from "@/lib/routing"
import { cn } from "@/lib/utils"
import type { Document, RecentSession, TrendData } from "@/lib/api-client"


// 统计图标映射
const statIcons = {
  totalDocs: FileText,
  totalViews: Eye,
  aiSessions: MessageSquare,
  aiMessages: Users,
  uniqueVisitors: Network,
}

// 统计项配置
const STATS_CONFIG = [
  { id: "totalDocs", titleKey: "totalDocs", descKey: "totalDocsDesc", color: "text-blue-600", bg: "bg-blue-50" },
  { id: "totalViews", titleKey: "totalViews", descKey: "totalViewsDesc", color: "text-emerald-600", bg: "bg-emerald-50" },
  { id: "aiSessions", titleKey: "aiSessions", descKey: "aiSessionsDesc", color: "text-blue-600", bg: "bg-blue-50" },
  { id: "aiMessages", titleKey: "aiMessages", descKey: "aiMessagesDesc", color: "text-orange-600", bg: "bg-orange-50" },
  { id: "uniqueVisitors", titleKey: "uniqueVisitors", descKey: "uniqueVisitorsDesc", color: "text-rose-600", bg: "bg-rose-50" },
] as const

import AISessionChart from "@/components/charts/AISessionChart"


export default function AdminHome() {
  const t = useTranslations("Dashboard")
  const locale = useLocale()
  const currentSite = useSiteData()
  const routeContext = useRouteContext()
  const router = useRouter()
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
  const { data: healthData } = useHealth()
  const isEnterprise = healthData?.edition === 'enterprise'

  const hotDocs = hotDocsData?.documents || []
  const recentDocs = recentDocsData?.documents || []
  const loading = hotDocsLoading || recentDocsLoading || statsLoading

  // 调试辅助与数据转换
  const stats = {
    totalDocuments: statsData?.total_documents ?? 0,
    totalViews: statsData?.total_views ?? 0,
    viewsToday: statsData?.views_today ?? 0,
    uniqueIpsToday: statsData?.unique_ips_today ?? 0,
    totalUniqueIps: statsData?.total_unique_ips ?? 0,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
        </div>
        {isEnterprise ? (
          <Link href={getRoutePath("/analytics", routeContext.slug)}>
            <Button variant="outline" size="sm" className="gap-1.5 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all">
              <BarChart3 className="h-3.5 w-3.5" />
              {t("analytics.viewDetail")}
              <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            {t("analytics.viewDetail")}
            <Badge className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 text-[10px] font-bold px-1.5 py-0 gap-1 shadow-sm h-4">
              <Crown className="h-2.5 w-2.5" />
              {t("eeBadge")}
            </Badge>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {STATS_CONFIG.map((stat) => {
          const Icon = statIcons[stat.id as keyof typeof statIcons] || FileText
          // 根据标题显示实际数据
          let displayValue = "0"
          let subValue = ""

          if (stat.id === "totalDocs") {
            displayValue = stats.totalDocuments.toString()
          } else if (stat.id === "totalViews") {
            displayValue = stats.totalViews.toString()
            if (stats.viewsToday >= 0) {
              subValue = t("stats.today") + ` +${stats.viewsToday}`
            }
          } else if (stat.id === "aiSessions") {
            displayValue = stats.totalChatSessions.toString()
            if (stats.newSessionsToday >= 0) {
              subValue = t("stats.today") + ` +${stats.newSessionsToday}`
            }
          } else if (stat.id === "aiMessages") {
            displayValue = stats.totalChatMessages.toString()
            if (stats.newMessagesToday >= 0) {
              subValue = t("stats.today") + ` +${stats.newMessagesToday}`
            }
          } else if (stat.id === "uniqueVisitors") {
            displayValue = stats.totalUniqueIps.toString()
            subValue = t("stats.today") + ` ${stats.uniqueIpsToday}`
          }

          return (
            <Card key={stat.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {t(`stats.${stat.titleKey}` as any)}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{displayValue}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-slate-500 font-medium">
                    {t(`stats.${stat.descKey}` as any)}
                  </p>
                  {stat.id === "aiSessions" || stat.id === "aiMessages" ? (
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{t("stats.today")}</span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full transition-all",
                        (subValue.includes("+0") || !subValue) ? "bg-slate-100 text-slate-400" : "bg-emerald-500 text-white shadow-sm"
                      )}>
                        {subValue.replace(t("stats.today") + ' ', '') || '0'}
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
              <CardTitle className="text-base font-bold">{t("charts.sessionTrend")}</CardTitle>
            </div>
            <div className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded">{t("charts.sevenDays")}</div>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col">
            <div className="flex-1 w-full min-h-[200px] px-2">
              {statsError ? (
                <div className="w-full h-full flex items-center justify-center text-rose-500 text-xs text-center p-4">
                  {t("charts.error")}: {statsError instanceof Error ? statsError.message : "Unknown error"}
                </div>
              ) : statsLoading ? (
                <div className="w-full h-full flex items-center justify-center text-slate-300 animate-pulse text-sm">{t("charts.loading")}</div>
              ) : (stats.dailyTrends && stats.dailyTrends.length > 0) ? (
                <AISessionChart
                  data={stats.dailyTrends.map((d: TrendData) => ({
                    date: d.date,
                    value: Number(d.sessions) || 0,
                    subValue: d.messages || 0
                  }))}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300 italic text-sm">{t("charts.empty")}</div>
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
              <CardTitle className="text-base font-bold">{t("recentQA.title")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {stats.recentSessions.length > 0 ? (
                stats.recentSessions.map((session: RecentSession) => (
                  <div key={session.thread_id} className={cn(
                    "p-4 transition-colors",
                    isEnterprise ? "hover:bg-muted/30 cursor-pointer group" : "cursor-default"
                  )}
                    onClick={isEnterprise ? () => router.push(getRoutePath(`/analytics?tab=chat&thread=${session.thread_id}`, routeContext.slug)) : undefined}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{session.title || t("recentQA.newChat")}</h4>
                      <span className="text-[10px] font-medium text-slate-400">
                        {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-500 font-medium">
                        {t("recentQA.turns", { count: session.message_count })}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center">
                  <p className="text-xs text-muted-foreground italic">{t("recentQA.empty")}</p>
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
                <CardTitle className="text-base font-bold">{t("hotDocs.title")}</CardTitle>
                <p className="text-[10px] text-muted-foreground font-medium">{t("hotDocs.subtitle")}</p>
              </div>
            </div>
            <Link href={getRoutePath("/documents", routeContext.slug)}>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-semibold text-primary hover:bg-primary/5">
                {t("hotDocs.viewAll")}
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">{t("charts.loading")}</span>
                </div>
              ) : hotDocs.length > 0 ? (
                hotDocs.map((doc: Document, i: number) => (
                  <Link
                    key={doc.id}
                    href={getRoutePath(`/documents/edit/${doc.id}`, routeContext.slug)}
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
                          <span>{t("hotDocs.views", { count: doc.views || 0 })}</span>
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
                  <p className="text-sm text-muted-foreground italic">{t("hotDocs.empty")}</p>
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
                <CardTitle className="text-base font-bold">{t("recentUpdates.title")}</CardTitle>
                <p className="text-[10px] text-muted-foreground font-medium">{t("recentUpdates.subtitle")}</p>
              </div>
            </div>
            <Link href={getRoutePath("/documents", routeContext.slug)}>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-semibold text-primary hover:bg-primary/5">
                {t("recentUpdates.viewAll")}
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
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">{t("charts.loading")}</span>
                </div>
              ) : recentDocs.length > 0 ? (
                recentDocs.map((doc: Document) => (
                  <Link
                    key={doc.id}
                    href={getRoutePath(`/documents/edit/${doc.id}`, routeContext.slug)}
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
                        <span className="text-[10px] font-bold text-muted-foreground/60">{doc.author || t("recentUpdates.system")}</span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-medium">
                          <Clock className="h-3 w-3 opacity-60" />
                          <span>
                            {new Date(doc.updated_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
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
                  <p className="text-sm text-muted-foreground italic">{t("recentUpdates.empty")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
