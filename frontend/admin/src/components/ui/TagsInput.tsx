"use client"

import * as React from "react"
import { X, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface TagsInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  className?: string
}

export function TagsInput({ value = [], onChange, placeholder = "添加标签...", className }: TagsInputProps) {
  const [inputValue, setInputValue] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim()
    if (trimmedTag && !value.includes(trimmedTag)) {
      onChange([...value, trimmedTag])
    }
    setInputValue("")
  }

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1])
    } else if (e.key === "," || e.key === "，") {
      e.preventDefault()
      addTag(inputValue)
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 p-2 min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50/50 focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all",
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="flex items-center gap-1 bg-white text-primary border-slate-200 hover:bg-slate-50 px-2 py-1 text-xs font-medium transition-colors group"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeTag(tag)
            }}
            className="text-slate-400 hover:text-destructive transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm placeholder:text-slate-400 min-w-[120px]"
      />
      {inputValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary transition-all"
          onClick={(e) => {
            e.stopPropagation()
            addTag(inputValue)
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

