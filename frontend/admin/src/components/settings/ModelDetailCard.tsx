/**
 * 模型详情卡片包装器
 * 用于展示单个模型的详细配置页面
 */

"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Layers, RefreshCw, Eye, ChevronRight, Cpu } from "lucide-react"
import { SingleModelConfig } from "./SingleModelConfig"
import { type ModelType } from "@/types/settings"

interface ModelDetailCardProps {
  modelType: "chat" | "embedding" | "rerank" | "vl"
  onBack: () => void
}

export function ModelDetailCard({ modelType, onBack }: ModelDetailCardProps) {
  const modelInfo = {
    chat: {
      title: "对话模型配置",
      icon: MessageSquare,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
      description: "用于 AI 对话、内容生成和摘要提取的主模型。"
    },
    embedding: {
      title: "向量模型配置",
      icon: Layers,
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-500/10",
      description: "用于将文档转化为向量，实现 AI 语义检索。"
    },
    rerank: {
      title: "重排序模型配置",
      icon: RefreshCw,
      iconColor: "text-purple-500",
      iconBg: "bg-purple-500/10",
      description: "在检索完成后对结果进行精排，大幅提升回答准确度。"
    },
    vl: {
      title: "多模态 (Vision) 模型配置",
      icon: Eye,
      iconColor: "text-orange-500",
      iconBg: "bg-orange-500/10",
      description: "支持图片理解和多模态交互的能力。"
    }
  }

  const info = modelInfo[modelType]
  const Icon = info.icon

  return (
    <Card className="border-border/50 shadow-sm min-h-[500px] rounded-2xl overflow-hidden transition-all duration-300">
      <CardHeader className="border-b border-border/40 bg-muted/20 pb-6 px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-10 w-10 rounded-xl hover:bg-background/80 shadow-sm border border-border/50 bg-background/50 transition-all"
              title="返回模型设置"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </Button>
            <div className="ml-1">
              <CardTitle className="text-2xl font-bold flex items-center gap-3">
                <div className={`p-2 ${info.iconBg} rounded-xl ${info.iconColor} shadow-sm`}>
                  <Icon className="h-6 w-6" />
                </div>
                {info.title}
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground/80 mt-1.5">
                {info.description}
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="h-8 flex items-center gap-2 px-4 bg-background border border-border/50 text-muted-foreground font-bold rounded-xl shadow-sm">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <Cpu className="h-3.5 w-3.5" />
            内核 v1.0
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <SingleModelConfig type={modelType} onSuccess={onBack} />
      </CardContent>
    </Card>
  )
}

