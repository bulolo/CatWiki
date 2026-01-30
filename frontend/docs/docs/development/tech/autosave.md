# 自动保存

Admin 管理后台提供了自动保存功能，避免用户编辑内容丢失。

## 📋 功能特性

- ✅ 自动保存编辑内容
- ✅ 防抖处理，避免频繁请求
- ✅ 显示保存状态
- ✅ 显示最后保存时间
- ✅ 错误处理和重试

---

## 🔧 使用方法

### 基本用法

```typescript
import { useAutosave } from '@/hooks/useAutosave'

function DocumentEditor() {
  const [content, setContent] = useState('')
  
  const { isSaving, lastSavedTime } = useAutosave({
    data: content,
    onSave: async (data) => {
      await apiClient.documents.updateDocument({
        id: documentId,
        requestBody: { content: data }
      })
    },
    delay: 2000  // 2秒后自动保存
  })
  
  return (
    <div>
      <textarea 
        value={content} 
        onChange={(e) => setContent(e.target.value)} 
      />
      
      {isSaving && <span>保存中...</span>}
      {lastSavedTime && (
        <span>最后保存: {lastSavedTime.toLocaleTimeString()}</span>
      )}
    </div>
  )
}
```

---

## ⚙️ 配置选项

### useAutosave 参数

```typescript
interface AutosaveOptions<T> {
  data: T                    // 要保存的数据
  onSave: (data: T) => Promise<void>  // 保存函数
  delay?: number             // 延迟时间（毫秒），默认 2000
  enabled?: boolean          // 是否启用，默认 true
}
```

### 返回值

```typescript
interface AutosaveResult {
  isSaving: boolean          // 是否正在保存
  lastSavedTime: Date | null // 最后保存时间
  save: () => Promise<void>  // 手动保存函数
}
```

---

## 💡 高级用法

### 手动触发保存

```typescript
const { save } = useAutosave({
  data: content,
  onSave: saveContent
})

// 手动保存
await save()
```

### 条件启用

```typescript
const { isSaving } = useAutosave({
  data: content,
  onSave: saveContent,
  enabled: isDirty  // 仅在内容改变时启用
})
```

### 自定义延迟

```typescript
const { isSaving } = useAutosave({
  data: content,
  onSave: saveContent,
  delay: 5000  // 5秒后保存
})
```

---

## 🎯 最佳实践

### 1. 合理设置延迟时间

```typescript
// ❌ 太短，频繁请求
delay: 500

// ✅ 合适的延迟
delay: 2000

// ✅ 较长的延迟（大文档）
delay: 5000
```

### 2. 显示保存状态

```typescript
{isSaving ? (
  <span className="text-gray-500">保存中...</span>
) : lastSavedTime ? (
  <span className="text-green-500">
    已保存 {formatTime(lastSavedTime)}
  </span>
) : null}
```

### 3. 错误处理

```typescript
const { isSaving } = useAutosave({
  data: content,
  onSave: async (data) => {
    try {
      await saveContent(data)
    } catch (error) {
      console.error('保存失败:', error)
      toast.error('保存失败，请重试')
    }
  }
})
```

---

## 🔍 实现原理

自动保存使用了以下技术：

1. **防抖 (Debounce)**: 使用 `lodash.debounce` 或自定义防抖函数
2. **useEffect**: 监听数据变化
3. **依赖优化**: 使用 `useCallback` 避免无限循环

---

## 📚 相关文档

- [Admin 前端开发](/development/guide/frontend-admin)
- [SDK 使用指南](/development/tech/sdk-usage)

---

## 📖 源码位置

完整实现请查看：
- Hook: `frontend/admin/src/hooks/useAutosave.ts`
- 使用文档: `frontend/admin/src/hooks/AUTOSAVE_USAGE.md`
