/**
 * 快速问题配置组件
 * 用于在站点管理中配置快速问题列表
 */

"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, GripVertical, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { QuickQuestion } from "@/lib/api-client"

interface QuickQuestionsConfigProps {
  questions: QuickQuestion[]
  onChange: (questions: QuickQuestion[]) => void
}

export function QuickQuestionsConfig({ questions, onChange }: QuickQuestionsConfigProps) {
  const handleAddQuestion = () => {
    onChange([...questions, { text: "", category: "" }])
  }

  const handleRemoveQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index))
  }

  const handleQuestionChange = (index: number, field: keyof QuickQuestion, value: string) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], [field]: value }
    onChange(newQuestions)
  }

  return (
    <Card className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden transition-all duration-300 w-full">
      <CardHeader className="border-b border-slate-50 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary border border-primary/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">快速问题配置</CardTitle>
            <CardDescription>
              配置首页展示的快速开始问题，如果不配置，首页将不会显示快速问题区域。
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold text-slate-700">问题列表</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddQuestion}
            className="h-8 gap-1 text-xs rounded-lg border-slate-200 hover:bg-slate-100"
          >
            <Plus className="h-3 w-3" />
            添加问题
          </Button>
        </div>

        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center">
              <p className="text-muted-foreground text-xs">
                暂无快速问题配置，点击上方按钮开始
              </p>
            </div>
          ) : (
            questions.map((question: QuickQuestion, index: number) => (

              <div
                key={index}
                className="group flex items-start gap-2 p-3 bg-muted/30 rounded-lg border border-border/30 hover:border-border/60 transition-all"
              >
                <div className="mt-2 text-muted-foreground/30">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="flex-1 grid grid-cols-12 gap-3">
                  <div className="col-span-8 space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">问题内容</Label>
                    <Input
                      value={question.text}
                      onChange={(e) => handleQuestionChange(index, "text", e.target.value)}
                      placeholder="例如：项目的核心功能是什么？"
                      className="h-9 text-xs bg-background"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">分类</Label>
                    <Input
                      value={question.category || ""}
                      onChange={(e) => handleQuestionChange(index, "category", e.target.value)}
                      placeholder="分类"
                      className="h-9 text-xs bg-background"
                    />
                  </div>
                  <div className="col-span-1 flex items-end justify-center pb-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveQuestion(index)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
