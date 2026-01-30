"use client"

import Link from "next/link"
import { Github } from "lucide-react" 
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/ui/container"
import { cn } from "@/lib/utils"

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  
  useEffect(() => {
    const handleScroll = () => {
      // Transition point
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ease-in-out",
        isScrolled 
          ? "bg-white/90 backdrop-blur-md border-b border-slate-200/50 py-3 shadow-sm" 
          : "bg-transparent border-b border-transparent py-5"
      )}
    >
      <Container>
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-3 group" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className={cn(
                "flex items-center justify-center rounded-lg font-bold text-white transition-all duration-300 shadow-md",
                "bg-gradient-to-tr from-sky-500 to-indigo-600",
                isScrolled ? "w-8 h-8 text-lg" : "w-10 h-10 text-xl"
            )}>
              C
            </div>
            <span className={cn(
                "font-bold text-slate-900 tracking-tight transition-all duration-300",
                isScrolled ? "text-lg" : "text-xl"
            )}>
              CatWiki
            </span>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
             {/* GitHub Link - Clean & Simple */}
             <Link
              href="https://github.com/bulolo/CatWiki"
              target="_blank"
              rel="noreferrer"
              className={cn(
                  "flex items-center text-sm font-medium transition-colors",
                  isScrolled ? "text-slate-500 hover:text-slate-900" : "text-slate-600 hover:text-slate-900"
              )}
            >
               <Github className="w-5 h-5 mr-2" />
               GitHub
            </Link>
            
            <div className={cn(
                "w-px h-4 transition-colors",
                isScrolled ? "bg-slate-200" : "bg-slate-300"
            )} />

            {/* CTA Button */}
            <Button 
                variant="premium" 
                size={isScrolled ? "sm" : "default"}
                className={cn(
                    "rounded-full shadow-lg shadow-sky-200/50 font-medium transition-all duration-300",
                    isScrolled ? "h-9 px-5 text-sm" : "h-11 px-7 text-base"
                )}
            >
              立即开始
            </Button>
          </div>
        </div>
      </Container>
    </header>
  )
}
