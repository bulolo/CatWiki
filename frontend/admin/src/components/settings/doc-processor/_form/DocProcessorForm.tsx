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

import Image from "next/image"
import { useTranslations } from "next-intl"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Switch } from "@/components/ui"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { BookOpen, Bird, Check, ExternalLink, FileText, Loader2, Pickaxe, Scan, X, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { type DocProcessorConfig, type DocProcessorType, DOC_PROCESSOR_TYPES } from "@/types/settings"

// config 字段安全读取（config 为松散 JSON）
const getConfigFlag = (config: DocProcessorConfig["config"], key: string, fallback = false): boolean => {
  const value = config?.[key]
  return typeof value === "boolean" ? value : fallback
}
const getConfigString = (config: DocProcessorConfig["config"], key: string, fallback: string): string => {
  const value = config?.[key]
  return typeof value === "string" ? value : fallback
}
const getConfigStringArray = (config: DocProcessorConfig["config"], key: string, fallback: string[]): string[] => {
  const value = config?.[key]
  return Array.isArray(value) && value.every(v => typeof v === "string") ? value : fallback
}

interface DocProcessorFormProps {
  formData: DocProcessorConfig
  setFormData: (next: DocProcessorConfig) => void
  isEditing: boolean
  isSaving: boolean
  onCancel: () => void
  onSubmit: () => void
}

/** 文档处理服务的新增/编辑内联表单。由 DocProcessorSettings.renderForm(~375 行) 抽出，行为一致。 */
export function DocProcessorForm({ formData, setFormData, isEditing, isSaving, onCancel, onSubmit }: DocProcessorFormProps) {
  const t = useTranslations("DocProcessor")

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {isEditing ? t("editProcessor") : t("addProcessor")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="enabled" className="text-sm font-medium cursor-pointer">{t("enabled")}</Label>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked: boolean) => setFormData({ ...formData, enabled: checked })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                placeholder={t("namePlaceholder")}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">{t("type")}</Label>
              <Select
                value={formData.type}
                onValueChange={(value: DocProcessorType) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_PROCESSOR_TYPES.map((type) => {
                    const icons: Record<string, LucideIcon> = { Bird, Zap, Scan, BookOpen, Pickaxe, FileText }
                    const Icon = icons[type.icon] || FileText
                    return (
                      <SelectItem
                        key={type.value}
                        value={type.value}
                        disabled={type.disabled}
                      >
                        <div className="flex items-center gap-2">
                          {type.icon.startsWith("/") ? (
                            <Image src={type.icon} alt="" width={16} height={16} className="object-contain" />
                          ) : (
                            <Icon className={`h-4 w-4 ${type.color.split(" ")[0] || "text-slate-500"}`} />
                          )}
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {/* 显示当前选中类型的说明和文档链接 */}
              {(() => {
                const selectedType = DOC_PROCESSOR_TYPES.find(t => t.value === formData.type)
                if (selectedType) {
                  return (
                    <p className="text-xs text-slate-500">
                      {selectedType.docUrl && (
                        <a
                          href={selectedType.docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {t("deployDoc")} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </p>
                  )
                }
                return null
              })()}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="base_url">{t("baseUrl")}</Label>
            <Input
              id="base_url"
              placeholder={t("baseUrlPlaceholder")}
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
            />
            {(() => {
              const selectedType = DOC_PROCESSOR_TYPES.find(t => t.value === formData.type)
              if (selectedType) {
                return (
                  <p className="text-xs text-slate-500">
                    {t("endpoint")}: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">{selectedType.endpoint}</code>
                  </p>
                )
              }
            })()}
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key">
              {formData.type === "Docling" ? "API Key (X-Api-Key)" : t("apiKey")}
              <span className="text-slate-400 font-normal ml-1">{t("optional")}</span>
            </Label>
            <Input
              id="api_key"
              type="password"
              placeholder={formData.type === "Docling" ? t("enterApiKey") : t("apiKeyPlaceholder")}
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              autoComplete="new-password"
              name="doc_processor_api_key_disable_autofill"
            />
          </div>

          {/* 特定配置区域 */}
          {(formData.type === "Docling" || formData.type === "MinerU" || formData.type === "PaddleOCR") && (
            <div className="bg-white/50 rounded-lg p-4 border border-primary/10 space-y-3">
              <Label className="text-xs font-medium text-primary/80 uppercase tracking-wider">{t("capabilities")}</Label>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_ocr"
                    checked={getConfigFlag(formData.config, "is_ocr")}
                    onCheckedChange={(checked: boolean) =>
                      setFormData({
                        ...formData,
                        config: { ...formData.config, is_ocr: checked }
                      })
                    }
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="is_ocr" className="text-sm">{t("ocr")}</Label>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="extract_images"
                    checked={getConfigFlag(formData.config, "extract_images")}
                    onCheckedChange={(checked: boolean) =>
                      setFormData({
                        ...formData,
                        config: { ...formData.config, extract_images: checked }
                      })
                    }
                  />
                  <Label htmlFor="extract_images" className="text-sm">{t("extractImages")}</Label>
                </div>

                {formData.type === "Docling" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="extract_tables"
                        checked={getConfigFlag(formData.config, "extract_tables")}
                        onCheckedChange={(checked: boolean) =>
                          setFormData({
                            ...formData,
                            config: { ...formData.config, extract_tables: checked }
                          })
                        }
                      />
                      <Label htmlFor="extract_tables" className="text-sm">{t("extractTables")}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="do_formula_enrichment"
                        checked={getConfigFlag(formData.config, "do_formula_enrichment", true)}
                        onCheckedChange={(checked: boolean) =>
                          setFormData({
                            ...formData,
                            config: { ...formData.config, do_formula_enrichment: checked }
                          })
                        }
                      />
                      <Label htmlFor="do_formula_enrichment" className="text-sm">{t("formulaRecognition")}</Label>
                    </div>
                  </>
                )}

                {formData.type === "MinerU" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="formula_enable"
                        checked={getConfigFlag(formData.config, "formula_enable", true)}
                        onCheckedChange={(checked: boolean) =>
                          setFormData({ ...formData, config: { ...formData.config, formula_enable: checked } })
                        }
                      />
                      <Label htmlFor="formula_enable" className="text-sm">{t("formulaRecognition")}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="table_enable"
                        checked={getConfigFlag(formData.config, "table_enable", true)}
                        onCheckedChange={(checked: boolean) =>
                          setFormData({ ...formData, config: { ...formData.config, table_enable: checked } })
                        }
                      />
                      <Label htmlFor="table_enable" className="text-sm">{t("extractTables")}</Label>
                    </div>
                  </>
                )}
              </div>

              {/* Docling 专属配置 */}
              {formData.type === "Docling" && (
                <div className="space-y-3 pt-2 border-t border-primary/10">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="docling_ocr_engine" className="text-sm">{t("ocrEngine")}</Label>
                      <Select
                        value={getConfigString(formData.config, "ocr_engine", "rapidocr")}
                        onValueChange={(value) =>
                          setFormData({ ...formData, config: { ...formData.config, ocr_engine: value } })
                        }
                      >
                        <SelectTrigger id="docling_ocr_engine"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rapidocr">rapidocr</SelectItem>
                          <SelectItem value="easyocr">easyocr</SelectItem>
                          <SelectItem value="tesseract">tesseract</SelectItem>
                          <SelectItem value="tesserocr">tesserocr</SelectItem>
                          <SelectItem value="ocrmac">ocrmac</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="docling_pdf_backend" className="text-sm">{t("pdfBackend")}</Label>
                      <Select
                        value={getConfigString(formData.config, "pdf_backend", "dlparse_v4")}
                        onValueChange={(value) =>
                          setFormData({ ...formData, config: { ...formData.config, pdf_backend: value } })
                        }
                      >
                        <SelectTrigger id="docling_pdf_backend"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dlparse_v4">{`dlparse_v4${t("recommendedSuffix")}`}</SelectItem>
                          <SelectItem value="dlparse_v2">dlparse_v2</SelectItem>
                          <SelectItem value="dlparse_v1">dlparse_v1</SelectItem>
                          <SelectItem value="pypdfium2">pypdfium2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="docling_pipeline" className="text-sm">{t("doclingPipeline")}</Label>
                      <Select
                        value={getConfigString(formData.config, "pipeline", "standard")}
                        onValueChange={(value) =>
                          setFormData({ ...formData, config: { ...formData.config, pipeline: value } })
                        }
                      >
                        <SelectTrigger id="docling_pipeline"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">{`standard${t("recommendedSuffix")}`}</SelectItem>
                          <SelectItem value="vlm">{`vlm${t("vlmGpuSuffix")}`}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* MinerU 专属配置 */}
              {formData.type === "MinerU" && (
                <div className="space-y-3 pt-2 border-t border-primary/10">
                  <div className="space-y-1.5">
                    <Label htmlFor="mineru_backend" className="text-sm">{t("mineruBackend")}</Label>
                    <Select
                      value={getConfigString(formData.config, "backend", "hybrid-auto-engine")}
                      onValueChange={(value) =>
                        setFormData({ ...formData, config: { ...formData.config, backend: value } })
                      }
                    >
                      <SelectTrigger id="mineru_backend">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hybrid-auto-engine">{t("hybridAutoEngine")}</SelectItem>
                        <SelectItem value="pipeline">{t("pipeline")}</SelectItem>
                        <SelectItem value="vlm-auto-engine">{t("vlmAutoEngine")}</SelectItem>
                        <SelectItem value="vlm-http-client">{t("vlmHttpClient")}</SelectItem>
                        <SelectItem value="hybrid-http-client">{t("hybridHttpClient")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mineru_parse_method" className="text-sm">{t("parseMethod")}</Label>
                    <Select
                      value={getConfigString(formData.config, "parse_method", "auto")}
                      onValueChange={(value) =>
                        setFormData({ ...formData, config: { ...formData.config, parse_method: value } })
                      }
                    >
                      <SelectTrigger id="mineru_parse_method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">{t("parseAuto")}</SelectItem>
                        <SelectItem value="ocr">{t("parseOcr")}</SelectItem>
                        <SelectItem value="txt">{t("parseTxt")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t("recognitionLanguage")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "ch", label: t("langCh") },
                        { value: "en", label: t("langEn") },
                        { value: "korean", label: t("langKorean") },
                        { value: "japan", label: t("langJapan") },
                        { value: "chinese_cht", label: t("langCht") },
                        { value: "latin", label: t("langLatin") },
                        { value: "arabic", label: t("langArabic") },
                        { value: "cyrillic", label: t("langCyrillic") },
                        { value: "east_slavic", label: t("langEastSlavic") },
                        { value: "devanagari", label: t("langDevanagari") },
                        { value: "th", label: t("langTh") },
                        { value: "el", label: t("langEl") },
                        { value: "ta", label: t("langTa") },
                        { value: "te", label: t("langTe") },
                        { value: "ka", label: t("langKa") },
                      ].map(({ value: lang, label }) => {
                        const current = getConfigStringArray(formData.config, "lang_list", ["ch", "en"])
                        const selected = current.includes(lang)
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => {
                              const next = selected
                                ? current.filter(l => l !== lang)
                                : [...current, lang]
                              if (next.length === 0) return
                              setFormData({ ...formData, config: { ...formData.config, lang_list: next } })
                            }}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                              selected
                                ? "bg-primary text-white border-primary"
                                : "bg-white text-slate-600 border-slate-200 hover:border-primary/50"
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end pt-2 gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" />
              {t("cancel")}
            </Button>
            <Button size="sm" onClick={onSubmit} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div >
  )
}
