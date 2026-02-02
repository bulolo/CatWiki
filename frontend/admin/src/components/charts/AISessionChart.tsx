"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { cn } from "@/lib/utils";

interface ChartData {
  date: string;
  value: number;
  label?: string;
  subValue?: number; // e.g. messages count
}

interface AISessionChartProps {
  data: ChartData[];
  height?: number;
  color?: string; // Hex color
  className?: string;
}

export default function AISessionChart({ data, color = "#3b82f6", className }: AISessionChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setHasLoaded(true);
  }, []);

  // Configuration - Use a stable internal coordinate system
  const PADDING_TOP = 40; // Increased to accommodate Max label
  const PADDING_BOTTOM = 35;
  const VIEW_WIDTH = 1000;
  const VIEW_HEIGHT = 400;

  const { points, areaPath, linePath, maxVal } = useMemo<{
    points: any[];
    areaPath: string;
    linePath: string;
    maxVal: number;
  }>(() => {
    if (!data || data.length === 0) return { points: [], areaPath: "", linePath: "", maxVal: 0 };

    const mv = Math.max(...data.map(d => d.value)) || 1;
    const plottingHeight = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

    // Calculate coordinates
    const coords = data.map((d, i) => {
      const x = (i / (data.length - 1)) * VIEW_WIDTH;
      const percent = d.value / mv;
      const y = PADDING_TOP + plottingHeight * (1 - percent);
      return { x, y, ...d };
    });

    // Refined Fluid Monotone Spline
    const generateSmoothPath = (pts: {x: number, y: number, subY?: number}[]) => {
        if (pts.length < 2) return "";
        let path = `M ${pts[0].x} ${pts[0].y}`;
        
        const slopes = pts.map((p, i) => {
            const py = p.y;
            const prevY = pts[i-1]?.y;
            const nextY = pts[i+1]?.y;

            if (i === 0) return (( (pts[1]?.y) as number || 0) - (py as number)) / (pts[1].x - pts[0].x);
            if (i === pts.length - 1) return ((py as number) - ((pts[i-1]?.y) as number || 0)) / (pts[i].x - pts[i-1].x);
            
            const dx1 = pts[i].x - pts[i-1].x;
            const dy1 = (py as number) - (prevY as number || 0);
            const dx2 = pts[i+1].x - pts[i].x;
            const dy2 = (nextY as number || 0) - (py as number);
            
            const s1 = dy1 / dx1;
            const s2 = dy2 / dx2;
            if (s1 * s2 <= 0) return 0;
            const w1 = 2 * dx2 + dx1;
            const w2 = dx2 + 2 * dx1;
            return (w1 + w2) / (w1 / s1 + w2 / s2);
        });

        for (let i = 0; i < pts.length - 1; i++) {
            const curr = pts[i];
            const next = pts[i+1];
            const dx = (next.x - curr.x) / 2.75;
            const cy = curr.y;
            const ny = next.y;
            path += ` C ${curr.x + dx} ${(cy as number) + slopes[i] * dx}, ${next.x - dx} ${(ny as number) - slopes[i+1] * dx}, ${next.x} ${ny}`;
        }
        return path;
    };

    const lp = generateSmoothPath(coords);
    const ap = `${lp} L ${VIEW_WIDTH} ${VIEW_HEIGHT} L 0 ${VIEW_HEIGHT} Z`;

    return { points: coords, areaPath: ap, linePath: lp, maxVal: mv };
  }, [data, VIEW_HEIGHT, PADDING_TOP, PADDING_BOTTOM]);

  if (!data || data.length === 0) {
    return (
        <div className={cn("w-full h-full flex items-center justify-center text-slate-300 italic text-sm", className)}>
            暂无趋势采样数据
        </div>
    );
  }

  // Grid levels with labels
  const gridLevels = [
    { lvl: 0, label: "0" },
    { lvl: 0.5, label: "50%" },
    { lvl: 1, label: "最大值" }
  ];

  return (
    <div 
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
            <stop offset="0%" stopColor={color} stopOpacity="0.12"/>
            <stop offset="40%" stopColor={color} stopOpacity="0.05"/>
            <stop offset="75%" stopColor={color} stopOpacity="0.01"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>

          {/* Stroke Gradient for the path itself */}
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse">
             <stop offset="0%" stopColor={color} stopOpacity="0.8"/>
             <stop offset="50%" stopColor={color} stopOpacity="1"/>
             <stop offset="100%" stopColor={color} stopOpacity="0.9"/>
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          <clipPath id="revealMask">
            <rect x="0" y="0" width="1000" height="400">
               <animate attributeName="width" from="0" to="1000" dur="1.2s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" />
            </rect>
          </clipPath>
        </defs>

        {/* Horizontal Grid lines with Styled Badges */}
        {gridLevels.map((g) => {
            const y = PADDING_TOP + (VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM) * (1 - g.lvl);
            return (
                <g key={`grid-${g.lvl}`}>
                    <line 
                        x1="0" y1={y} x2={VIEW_WIDTH} y2={y} 
                        stroke="#e2e8f0" 
                        strokeWidth="1" 
                        strokeDasharray="4 4"
                        className="opacity-30"
                    />
                    <text 
                        x={VIEW_WIDTH - 4} y={y - 8} 
                        className="text-[10px] fill-slate-400 font-bold tracking-tight"
                        style={{ textAnchor: 'end', fontSize: '10px', opacity: 0.8 }}
                    >
                        {g.label === "最大值" ? `最大值: ${maxVal}` : g.label}
                    </text>
                </g>
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

        {/* Interaction Points - Discrete Rendering (No coordinate transitions) */}
        {points.map((point: any, i: number) => {
            const isHovered = hoverIndex === i;
            const isToday = i === points.length - 1;
            
            return (
                <g key={`point-${i}`}>
                    {/* Living Pulse for Today (Only if not hovered) */}
                    {isToday && !isHovered && (
                        <circle 
                            cx={point.x} 
                            cy={point.y} 
                            r="6" 
                            fill={color} 
                            className="animate-pulse opacity-25"
                        />
                    )}
                    
                    {/* Hover Marker - Instant Reveal */}
                    {isHovered && (
                        <g className="pointer-events-none">
                            <circle 
                                cx={point.x} 
                                cy={point.y} 
                                r="10" 
                                fill={color} 
                                className="opacity-10"
                            />
                            <circle 
                                cx={point.x} 
                                cy={point.y} 
                                r="6" 
                                fill="white" 
                                stroke={color}
                                strokeWidth="2"
                                className="shadow-sm"
                            />
                            <circle 
                                cx={point.x} 
                                cy={point.y} 
                                r="2" 
                                fill={color}
                            />
                        </g>
                    )}

                    {/* Today Static Point */}
                    {isToday && !isHovered && (
                        <circle 
                            cx={point.x} 
                            cy={point.y} 
                            r="3"
                            fill={color}
                            className="opacity-100"
                        />
                    )}
                </g>
            )
        })}
      </svg>

      {/* HTML Overlay for Tooltips and Hit Testing */}
      <div className="absolute inset-0 z-10">
        {points.map((point: any, i: number) => {
             const leftPercent = (i / (points.length - 1)) * 100;
             const topPercent = (point.y / VIEW_HEIGHT) * 100;
             const isHovered = hoverIndex === i;
             
             // Calculate hit area width
             const segmentPercent = 100 / (points.length - 1);
             const hitWidth = (i === 0 || i === points.length - 1) ? segmentPercent / 2 : segmentPercent;
             const hitLeft = (i === 0) ? 0 : (i === points.length - 1) ? 100 - hitWidth : leftPercent - hitWidth / 2;

             return (
                <div 
                    key={`hit-${i}`}
                    className="absolute top-0 bottom-0 group/item cursor-default outline-none flex flex-col justify-end"
                    style={{ left: `${hitLeft}%`, width: `${hitWidth}%` }}
                    onMouseEnter={() => setHoverIndex(i)}
                >
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
                        top: `${topPercent}%`,
                        marginTop: '-115px' 
                    }}>
                         <div className={cn(
                             "bg-white/95 backdrop-blur-xl text-slate-900 px-5 py-4 rounded-[24px] shadow-2xl whitespace-nowrap flex flex-col items-center gap-1.5 relative border border-slate-200/50",
                             i === 0 ? "ml-4" : i === points.length - 1 ? "mr-4" : ""
                         )}>
                             <span className="text-[10px] text-blue-600/80 font-black tracking-[0.1em] uppercase mb-0.5">{point.date}</span>
                             <div className="flex items-baseline gap-2">
                                <span className="font-black text-3xl bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-transparent leading-none">{point.value}</span>
                                <span className="text-[11px] text-slate-500 font-bold">会话</span>
                             </div>
                             {point.subValue !== undefined && (
                                <div className="flex items-center gap-3 mt-1.5 pt-2 border-t border-slate-100 w-full justify-between">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">消息互动</span>
                                    <span className="text-sm font-black text-blue-600">{point.subValue}</span>
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
                        (i === points.length - 1) ? "text-blue-600" : "text-slate-400 group-hover/item:text-slate-600",
                        isHovered && "text-blue-600 scale-110 drop-shadow-sm font-black"
                        )}>
                        {point.date}
                        </span>
                    </div>
                </div>
             )
        })}
      </div>
    </div>
  );
}
