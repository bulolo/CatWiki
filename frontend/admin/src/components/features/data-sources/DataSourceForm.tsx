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

import { type Dispatch, type SetStateAction } from "react"
import { useTranslations } from "next-intl"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@/components/ui"
import { Loader2, Info, X, Check } from "lucide-react"
import type { FormState } from "./form-state"

interface DataSourceFormProps {
  editingId: number | null
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
  isSaving: boolean
  onCancel: () => void
  onSave: () => void
}

export function DataSourceForm({ editingId, form, setForm, isSaving, onCancel, onSave }: DataSourceFormProps) {
  const t = useTranslations("DataSources")
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {editingId ? t("editTitle") : t("createTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("fieldName")} *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("fieldType")}</Label>
              <Select
                value={form.type}
                onValueChange={v => setForm(f => ({ ...f, type: v as "internal" | "s3" }))}
                disabled={!!editingId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">{t("typeInternal")}</SelectItem>
                  <SelectItem value="s3">{t("typeS3")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("fieldDescription")}</Label>
            <Input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={t("descriptionPlaceholder")}
            />
          </div>

          {form.type === "internal" && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 flex gap-2.5">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">{t("internalHintDesc")}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("fieldRootPrefix")}</Label>
            <Input
              value={form.root_prefix}
              onChange={e => setForm(f => ({ ...f, root_prefix: e.target.value }))}
              placeholder={form.type === "internal" ? "uploads/" : "docs/"}
            />
            <p className="text-xs text-slate-400">
              {form.type === "internal" ? t("rootPrefixHintInternal") : t("rootPrefixHintS3")}
            </p>
          </div>

          {form.type === "internal" && editingId && form.endpoint && (
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">{t("internalStoragePath")}</Label>
              <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 font-mono text-xs text-slate-600 break-all">
                {[form.endpoint, form.bucket_name, form.tenant_base + (form.root_prefix || "")].filter(Boolean).join("/")}
              </div>
            </div>
          )}

          {form.type === "s3" && (
            <div className="border-t pt-4 space-y-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">S3 {t("connectionConfig")}</p>

              <div className="space-y-1.5">
                <Label>{t("fieldEndpoint")} *</Label>
                <Input
                  value={form.endpoint}
                  onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))}
                  placeholder={t("endpointPlaceholder")}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("fieldBucket")} *</Label>
                <Input
                  value={form.bucket_name}
                  onChange={e => setForm(f => ({ ...f, bucket_name: e.target.value }))}
                  placeholder="my-documents"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t("fieldAccessKey")} *</Label>
                  <Input
                    value={form.access_key}
                    onChange={e => setForm(f => ({ ...f, access_key: e.target.value }))}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("fieldSecretKey")} {!editingId && "*"}</Label>
                  <Input
                    type="password"
                    value={form.secret_key}
                    onChange={e => setForm(f => ({ ...f, secret_key: e.target.value }))}
                    placeholder={editingId ? t("secretKeyKeep") : "wJalrXUtnFEMI/K7MDENG"}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.use_ssl}
                  onCheckedChange={v => setForm(f => ({ ...f, use_ssl: v }))}
                />
                <Label className="cursor-pointer">{t("fieldUseSSL")}</Label>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end pt-2 gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
              <X className="h-4 w-4 mr-1" />
              {t("cancel")}
            </Button>
            <Button size="sm" onClick={onSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {editingId ? t("save") : t("create")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
