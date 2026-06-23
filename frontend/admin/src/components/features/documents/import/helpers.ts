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

import { type DocProcessorConfig, DocProcessorType } from "@/types/settings"
import { isRecord } from "@/lib/utils"
import type { CollectionItem } from "@/types"

export type SourceTab = "upload" | "datasource"

export interface ProcessorExtraConfig {
  is_ocr?: boolean
  extract_images?: boolean
  extract_tables?: boolean
}

export type DocProcessor = Omit<DocProcessorConfig, "config"> & { config?: ProcessorExtraConfig }

export function parseProcessorConfig(config: unknown): ProcessorExtraConfig {
  if (!isRecord(config)) return {}
  return {
    is_ocr: typeof config.is_ocr === "boolean" ? config.is_ocr : undefined,
    extract_images: typeof config.extract_images === "boolean" ? config.extract_images : undefined,
    extract_tables: typeof config.extract_tables === "boolean" ? config.extract_tables : undefined,
  }
}

export function parseDocProcessorType(value: unknown): DocProcessorType {
  if (value === "Docling" as const || value === "MinerU" as const || value === "PaddleOCR" as const) return value
  return "MinerU" as const
}

export function parseProcessorOrigin(value: unknown): "platform" | "tenant" | undefined {
  if (value === "platform" || value === "tenant") return value
  return undefined
}

export const FORMAT_TO_EXT: Record<string, string> = {
  PDF: ".pdf",
  Word: ".docx,.doc",
  PPT: ".pptx,.ppt",
  Excel: ".xlsx,.xls",
  HTML: ".html,.htm",
  Image: ".jpg,.jpeg,.png,.webp,.tiff",
  Markdown: ".md",
}

export const FORMAT_TO_MIME: Record<string, string[]> = {
  PDF: ["application/pdf"],
  Word: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"],
  PPT: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-powerpoint"],
  Excel: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"],
  HTML: ["text/html"],
  Image: ["image/jpeg", "image/png", "image/webp", "image/tiff"],
  Markdown: ["text/markdown", "text/plain"],
}

export function flattenCollections(items: CollectionItem[], level = 0): { id: string; name: string; level: number }[] {
  const result: { id: string; name: string; level: number }[] = []
  items.forEach(item => {
    if (item.type === "collection") {
      result.push({ id: item.id, name: item.name, level })
      if (item.children?.length) result.push(...flattenCollections(item.children, level + 1))
    }
  })
  return result
}
