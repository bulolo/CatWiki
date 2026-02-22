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

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { cn } from "@/lib/utils";

interface ChartData {
  date: string;
  value: number;
  label?: string;
  subValue?: number; // e.g. messages count
}

interface ChartPoint extends ChartData {
  x: number
  y: number
  leftPercent: number
  topPercent: number
  hitWidth: number
  hitLeft: number
  isToday: boolean
}

interface AISessionChartProps {
  data: ChartData[];
  color?: string; // Hex color
  className?: string;
}

export default function AISessionChart({ data, color = "#3b82f6", className }: AISessionChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState(1000); // Default fallback

  useEffect(() => {
    setHasLoaded(true);

    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (entries[0].contentRect.width > 0) {
        setViewWidth(entries[0].contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Configuration - Use responsive internal coordinate system
  const PADDING_TOP = 40; // Increased to accommodate Max label
  const PADDING_BOTTOM = 35;
  const VIEW_HEIGHT = 400;
  const VIEW_WIDTH = viewWidth; // Dynamic based on container

  const { points, areaPath, linePath, maxVal } = useMemo(() => {
    if (!data || data.length === 0) return { points: [], areaPath: "", linePath: "", maxVal: 0 };

    const mv = Math.max(...data.map(d => d.value)) || 1;
    const plottingHeight = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

    // Calculate coordinates and hit areas
    const segmentWidth = VIEW_WIDTH / (data.length - 1 || 1);

    const coords = data.map((d, i) => {
      const x = i * segmentWidth;
      const percent = d.value / mv;
      const y = PADDING_TOP + plottingHeight * (1 - percent);

      const leftPercent = (i / (data.length - 1 || 1)) * 100;
      const topPercent = (y / VIEW_HEIGHT) * 100;

      // Calculate hit area
      const hitWidthPercent = 100 / (data.length - 1 || 1);
      const hitWidth = (i === 0 || i === data.length - 1) ? hitWidthPercent / 2 : hitWidthPercent;
      const hitLeft = (i === 0) ? 0 : (i === data.length - 1) ? 100 - hitWidth : leftPercent - hitWidth / 2;

      return {
        x, y,
        leftPercent, topPercent,
        hitWidth, hitLeft,
        isToday: i === data.length - 1,
        ...d
      };
    });

    // Fluid Monotone Spline algorithm
    const generateSmoothPath = (pts: ChartPoint[]) => {
      if (pts.length < 2) return "";
      let path = `M ${pts[0].x} ${pts[0].y}`;

      const slopes = pts.map((p, i) => {
        if (i === 0) return (pts[1].y - p.y) / (pts[1].x - pts[0].x);
        if (i === pts.length - 1) return (p.y - pts[i - 1].y) / (pts[i].x - pts[i - 1].x);

        const dx1 = pts[i].x - pts[i - 1].x;
        const dy1 = p.y - pts[i - 1].y;
        const dx2 = pts[i + 1].x - pts[i].x;
        const dy2 = pts[i + 1].y - p.y;

        const s1 = dy1 / dx1;
        const s2 = dy2 / dx2;
        if (s1 * s2 <= 0) return 0;
        const w1 = 2 * dx2 + dx1;
        const w2 = dx2 + 2 * dx1;
        return (w1 + w2) / (w1 / s1 + w2 / s2);
      });

      for (let i = 0; i < pts.length - 1; i++) {
        const curr = pts[i];
        const next = pts[i + 1];
        const dx = (next.x - curr.x) / 2.75;
        path += ` C ${curr.x + dx} ${curr.y + slopes[i] * dx}, ${next.x - dx} ${next.y - slopes[i + 1] * dx}, ${next.x} ${next.y}`;
      }
      return path;
    };

    const lp = generateSmoothPath(coords);
    const ap = `${lp} L ${VIEW_WIDTH} ${VIEW_HEIGHT} L 0 ${VIEW_HEIGHT} Z`;

    return { points: coords, areaPath: ap, linePath: lp, maxVal: mv };
  }, [data, VIEW_HEIGHT, VIEW_WIDTH, PADDING_TOP, PADDING_BOTTOM]);

  if (!data || data.length === 0) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center text-slate-300 italic text-sm", className)}>
        暂无趋势采样数据
      </div>
    );
  }

  // Grid levels
  const gridLevels = [
    { lvl: 0, label: "0" },
    { lvl: 0.5, label: "50%" },
    { lvl: 1, label: "最大值" }
  ];

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full h-full select-none group/chart", className)}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.12" />
            <stop offset="40%" stopColor={color} stopOpacity="0.05" />
            <stop offset="75%" stopColor={color} stopOpacity="0.01" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>

          {/* Stroke Gradient for the path itself */}
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor={color} stopOpacity="0.8" />
            <stop offset="50%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.9" />
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <clipPath id="revealMask">
            <rect
              x="0" y="0"
              width={hasLoaded ? VIEW_WIDTH : 0}
              height={VIEW_HEIGHT}
              style={{ transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </clipPath>
        </defs>

        {/* Horizontal Grid lines */}
        {gridLevels.map((g) => {
          const y = PADDING_TOP + (VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM) * (1 - g.lvl);
          return (
            <line
              key={`grid-${g.lvl}`}
              x1="0" y1={y} x2={VIEW_WIDTH} y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="4 4"
              className="opacity-30"
            />
          );
        })}

        {/* Area Fill */}
        <path d={areaPath} fill="url(#chartGradient)" stroke="none" clipPath="url(#revealMask)" />

        {/* Neon Line Path Duo */}
        <g clipPath="url(#revealMask)">
          {/* Halo Stroke (Soft Light) */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-20"
            filter="url(#glow)"
            style={{
              strokeDasharray: 3000,
              strokeDashoffset: hasLoaded ? 0 : 3000,
              transition: hasLoaded ? 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
            }}
          />
          {/* Core Stroke (Sharp & Vibrant) */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-sm"
            style={{
              strokeDasharray: 3000,
              strokeDashoffset: hasLoaded ? 0 : 3000,
              transition: hasLoaded ? 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
            }}
          />
        </g>

        {/* Points removed from SVG to prevent squeezing - moved to HTML overlay */}
      </svg>

      {/* HTML Overlay for Tooltips, Grid Labels and Hit Testing */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Grid Labels - Moved from SVG to prevent squeezing */}
        {gridLevels.map((g) => {
          const topPercent = ((PADDING_TOP + (VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM) * (1 - g.lvl)) / VIEW_HEIGHT) * 100;
          return (
            <div
              key={`label-${g.lvl}`}
              className="absolute right-1 text-[10px] text-slate-400 font-bold tracking-tight pointer-events-none"
              style={{
                top: `${topPercent}%`,
                marginTop: '-16px', // Roughly y-8 equivalent in SVG
                opacity: 0.8
              }}
            >
              {g.label === "最大值" ? `最大值: ${maxVal}` : g.label}
            </div>
          );
        })}

        {points.map((p: ChartPoint, i: number) => {
          const isHovered = hoverIndex === i;

          return (
            <div
              key={`hit-${i}`}
              className="absolute top-0 bottom-0 group/item cursor-default outline-none flex flex-col justify-end pointer-events-auto"
              style={{ left: `${p.hitLeft}%`, width: `${p.hitWidth}%` }}
              onMouseEnter={() => setHoverIndex(i)}
            >
              {/* Interaction Point Markers (HTML) - High Z-index to stay above tooltip tail */}
              <div
                className="absolute pointer-events-none z-[60]"
                style={{
                  left: i === 0 ? '0%' : i === points.length - 1 ? '100%' : '50%',
                  top: `${p.topPercent}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                {/* Static / Today Point */}
                {p.isToday && !isHovered && (
                  <div className="relative flex items-center justify-center w-0 h-0">
                    <div
                      className="absolute w-4 h-4 rounded-full animate-pulse opacity-25"
                      style={{ backgroundColor: color }}
                    />
                    <div
                      className="absolute w-[6px] h-[6px] rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                )}
                {/* Hover State Marker */}
                {isHovered && (
                  <div className="relative flex items-center justify-center">
                    <div
                      className="absolute w-5 h-5 rounded-full opacity-10"
                      style={{ backgroundColor: color }}
                    />
                    <div
                      className="w-3 h-3 rounded-full bg-white shadow-sm border-2 flex items-center justify-center"
                      style={{ borderColor: color }}
                    >
                      <div
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Active Column Highlight - Suave Overlay */}
              <div className={cn(
                "absolute inset-0 transition-opacity duration-500 pointer-events-none",
                isHovered ? "bg-gradient-to-t from-blue-500/[0.06] via-transparent to-transparent opacity-100" : "opacity-0"
              )} />

              {/* Vertical Guide Line - Extra Faint */}
              <div className={cn(
                "absolute top-0 bottom-[30px] w-px transition-opacity duration-300 pointer-events-none border-l-2 border-dotted",
                i === 0 ? "left-0" : i === points.length - 1 ? "right-0" : "left-1/2",
                isHovered ? "opacity-100 border-blue-400/20" : "opacity-0"
              )} />

              {/* Tooltip - LIGHT THEME (No top transition to prevent 'flying') */}
              <div className={cn(
                "absolute -translate-x-1/2 transition-[opacity,transform] duration-300 ease-out pointer-events-none z-50",
                i === 0 ? "left-0 translate-x-0" : i === points.length - 1 ? "right-0 translate-x-0" : "left-1/2",
                isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95"
              )} style={{
                bottom: `${100 - p.topPercent}%`,
                marginBottom: '12px' // Gap for tail and dot marker
              }}>
                <div className={cn(
                  "bg-white/95 backdrop-blur-xl text-slate-900 px-5 py-4 rounded-[24px] shadow-2xl whitespace-nowrap flex flex-col items-center gap-1.5 relative border border-slate-200/50",
                  i === 0 ? "ml-4" : i === points.length - 1 ? "mr-4" : ""
                )}>
                  <span className="text-[10px] text-blue-600/80 font-black tracking-[0.1em] uppercase mb-0.5">{p.date}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-black text-3xl bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-transparent leading-none">{p.value}</span>
                    <span className="text-[11px] text-slate-500 font-bold">会话</span>
                  </div>
                  {p.subValue !== undefined && (
                    <div className="flex items-center gap-3 mt-1.5 pt-2 border-t border-slate-100 w-full justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">消息互动</span>
                      <span className="text-sm font-black text-blue-600">{p.subValue}</span>
                    </div>
                  )}
                  {/* Tooltip Tail */}
                  <div className={cn(
                    "absolute -bottom-1.5 w-3 h-3 bg-white rotate-45 border-r border-b border-slate-200/50",
                    i === 0 ? "left-5" : i === points.length - 1 ? "right-5" : "left-1/2 -ml-1.5"
                  )} />
                </div>
              </div>

              {/* Date Label */}
              <div className={cn(
                "h-[30px] flex items-center relative z-20",
                i === 0 ? "justify-start" : i === points.length - 1 ? "justify-end" : "justify-center"
              )}>
                <span className={cn(
                  "text-[10px] font-bold transition-all duration-300 tracking-tight",
                  p.isToday ? "text-blue-600" : "text-slate-400 group-hover/item:text-slate-600",
                  isHovered && "text-blue-600 scale-110 drop-shadow-sm font-black"
                )}>
                  {p.date}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
