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

import Link from "next/link"
import Image from "next/image"
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
              "flex items-center justify-center transition-all duration-300",
              isScrolled ? "w-8 h-8" : "w-10 h-10"
            )}>
              <Image
                src="/logo.png"
                alt="CatWiki Logo"
                width={40}
                height={40}
                className="w-full h-full object-contain"
              />
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
            <Link href="https://docs.catwiki.ai" target="_blank" rel="noreferrer">
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
            </Link>
          </div>
        </div>
      </Container>
    </header>
  )
}
