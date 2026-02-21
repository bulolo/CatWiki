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

/**
 * 模型详情卡片包装器
 * 用于展示单个模型的详细配置页面
 */

"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, Cpu } from "lucide-react"
import { SingleModelConfig } from "./SingleModelConfig"
import { MODEL_META } from "@/constants/models"

interface ModelDetailCardProps {
  modelType: "chat" | "embedding" | "rerank" | "vl"
  onBack: () => void
}

export function ModelDetailCard({ modelType, onBack }: ModelDetailCardProps) {
  const info = MODEL_META[modelType]
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
              className="h-10 w-10 hover:bg-background/80 shadow-sm border border-border/50 bg-background/50 transition-all"
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

