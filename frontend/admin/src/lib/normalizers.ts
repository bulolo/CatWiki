// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE

/**
 * 业务侧防御性 normalize / 表单转换助手。
 *
 * 这些工具与具体 HTTP 调用无关，是 raw payload → 业务类型 之间的转换层。
 */

import { isRecord } from './utils'
import type { BodyImportDocument, DocProcessorType } from '@/lib/sdk/sdk.schemas'

export interface DocumentChunk {
  id?: string | number
  content: string
  metadata?: Record<string, unknown> & {
    chunk_index?: number
  }
}

export interface UploadedFileInfo {
  url?: string
  object_name?: string
  size?: number
  [key: string]: unknown
}

export function normalizeChunks(value: unknown): DocumentChunk[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      ...item,
      id: typeof item.id === 'string' || typeof item.id === 'number' ? item.id : undefined,
      content: typeof item.content === 'string' ? item.content : '',
      metadata: isRecord(item.metadata) ? item.metadata : undefined,
    }))
}

export function toUploadedFileInfo(value: unknown): UploadedFileInfo {
  if (!isRecord(value)) {
    return {}
  }
  const sizeValue = value.size
  return {
    ...value,
    url: typeof value.url === 'string' ? value.url : undefined,
    object_name: typeof value.object_name === 'string' ? value.object_name : undefined,
    size: typeof sizeValue === 'number' ? sizeValue : undefined,
  }
}

export function parseBooleanField(value: FormDataEntryValue | null): boolean | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return undefined
}

export function parseRequiredIntField(
  fieldName: string,
  value: FormDataEntryValue | null,
): number {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required field: ${fieldName}`)
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid field: ${fieldName}`)
  }
  return parsed
}

/**
 * 把 FormData 转成 ``BodyImportDocument``。SDK 函数接受 typed body 而非 FormData。
 */
export function toImportDocumentBody(
  payload: BodyImportDocument | FormData,
): BodyImportDocument {
  if (!(payload instanceof FormData)) {
    return payload
  }

  const file = payload.get('file')
  if (!(file instanceof Blob)) {
    throw new Error('Missing required field: file')
  }

  const body: BodyImportDocument = {
    file,
    site_id: parseRequiredIntField('site_id', payload.get('site_id')),
    collection_id: parseRequiredIntField('collection_id', payload.get('collection_id')),
  }

  const processorType = payload.get('processor_type')
  if (typeof processorType === 'string' && processorType.trim() !== '') {
    body.processor_type = processorType as DocProcessorType
  }

  const ocrEnabled = parseBooleanField(payload.get('ocr_enabled'))
  if (ocrEnabled !== undefined) body.ocr_enabled = ocrEnabled
  const extractImages = parseBooleanField(payload.get('extract_images'))
  if (extractImages !== undefined) body.extract_images = extractImages
  const extractTables = parseBooleanField(payload.get('extract_tables'))
  if (extractTables !== undefined) body.extract_tables = extractTables
  const generateSummary = parseBooleanField(payload.get('generate_summary'))
  if (generateSummary !== undefined) body.generate_summary = generateSummary
  const generateTags = parseBooleanField(payload.get('generate_tags'))
  if (generateTags !== undefined) body.generate_tags = generateTags
  const autoVectorize = parseBooleanField(payload.get('auto_vectorize'))
  if (autoVectorize !== undefined) body.auto_vectorize = autoVectorize

  const duplicateStrategy = payload.get('duplicate_strategy')
  if (typeof duplicateStrategy === 'string' && duplicateStrategy.trim() !== '') {
    body.duplicate_strategy = duplicateStrategy
  }

  return body
}
