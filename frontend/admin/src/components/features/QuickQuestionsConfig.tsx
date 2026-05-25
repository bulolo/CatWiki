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
 * 快速问题配置组件
 * 用于在站点管理中配置快速问题列表
 */

"use client"

import { useTranslations } from "next-intl"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@/components/ui"
import { Plus, Trash2, GripVertical, Sparkles } from "lucide-react"
import type { QuickQuestion } from "@/lib/sdk/sdk.schemas"

interface QuickQuestionsConfigProps {
  questions: QuickQuestion[]
  onChange: (questions: QuickQuestion[]) => void
}

export function QuickQuestionsConfig({ questions, onChange }: QuickQuestionsConfigProps) {
  const t = useTranslations("QuickQuestions")
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
    <Card className="border-slate-200/60 shadow-sm overflow-hidden transition-all duration-300 w-full">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary border border-primary/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">{t("title")}</CardTitle>
            <CardDescription>
              {t("description")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold text-slate-700">{t("listLabel")}</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddQuestion}
            className="h-8 gap-1 text-xs rounded-lg border-slate-200 hover:bg-slate-100"
          >
            <Plus className="h-3 w-3" />
            {t("addQuestion")}
          </Button>
        </div>

        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center">
              <p className="text-muted-foreground text-xs">
                {t("empty")}
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
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{t("questionLabel")}</Label>
                    <Input
                      value={question.text}
                      onChange={(e) => handleQuestionChange(index, "text", e.target.value)}
                      placeholder={t("placeholder")}
                      className="h-9 text-xs bg-background"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{t("categoryLabel")}</Label>
                    <Input
                      value={question.category || ""}
                      onChange={(e) => handleQuestionChange(index, "category", e.target.value)}
                      placeholder={t("categoryPlaceholder")}
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
