"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

// 主题色配置
export const THEME_COLORS = {
  blue: {
    primary: "hsl(217, 91%, 60%)", // blue-500
    primaryHover: "hsl(217, 91%, 55%)",
    primaryLight: "hsl(217, 91%, 95%)",
    primaryDark: "hsl(217, 91%, 50%)",
  },
  emerald: {
    primary: "hsl(149, 80%, 45%)", // emerald-500
    primaryHover: "hsl(149, 80%, 40%)",
    primaryLight: "hsl(149, 80%, 95%)",
    primaryDark: "hsl(149, 80%, 35%)",
  },
  purple: {
    primary: "hsl(262, 83%, 58%)", // purple-500
    primaryHover: "hsl(262, 83%, 53%)",
    primaryLight: "hsl(262, 83%, 95%)",
    primaryDark: "hsl(262, 83%, 48%)",
  },
  orange: {
    primary: "hsl(25, 95%, 53%)", // orange-500
    primaryHover: "hsl(25, 95%, 48%)",
    primaryLight: "hsl(25, 95%, 95%)",
    primaryDark: "hsl(25, 95%, 43%)",
  },
  slate: {
    primary: "hsl(222, 47%, 11%)", // slate-800
    primaryHover: "hsl(222, 47%, 9%)",
    primaryLight: "hsl(222, 47%, 95%)",
    primaryDark: "hsl(222, 47%, 7%)",
  },
} as const

export type ThemeColor = keyof typeof THEME_COLORS

interface ThemeContextType {
  themeColor: ThemeColor
  layoutMode: "sidebar" | "top"
  setThemeColor: (color: ThemeColor) => void
  setLayoutMode: (mode: "sidebar" | "top") => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({
  children,
  initialThemeColor = "blue",
  initialLayoutMode = "sidebar",
}: {
  children: ReactNode
  initialThemeColor?: ThemeColor
  initialLayoutMode?: "sidebar" | "top"
}) {
  const [themeColor, setThemeColor] = useState<ThemeColor>(initialThemeColor)
  const [layoutMode, setLayoutMode] = useState<"sidebar" | "top">(initialLayoutMode)

  // 应用主题色到 CSS 变量
  useEffect(() => {
    const colors = THEME_COLORS[themeColor]
    const root = document.documentElement
    
    // 更新 CSS 变量
    root.style.setProperty("--theme-primary", colors.primary)
    root.style.setProperty("--theme-primary-hover", colors.primaryHover)
    root.style.setProperty("--theme-primary-light", colors.primaryLight)
    root.style.setProperty("--theme-primary-dark", colors.primaryDark)
    
    // 更新 Tailwind primary 颜色（使用 HSL 格式）
    const hslMatch = colors.primary.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
    if (hslMatch) {
      const [, h, s, l] = hslMatch
      root.style.setProperty("--primary", `${h} ${s}% ${l}%`)
    }
  }, [themeColor])

  return (
    <ThemeContext.Provider
      value={{
        themeColor,
        layoutMode,
        setThemeColor,
        setLayoutMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

