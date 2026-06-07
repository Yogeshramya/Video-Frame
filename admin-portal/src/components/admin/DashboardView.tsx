'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Camera, Play, Award, Eye, Calendar, MapPin, Smartphone, Globe, Loader2 } from 'lucide-react';


interface ScanRecord {
  id: string;
  memory_id: string;
  timestamp: string;
  device_type: string;
  browser: string;
  country: string;
  city: string;
  memories?: {
    customer_name: string;
    memory_title: string;
  };
}

export default function DashboardView() {
  const [stats, setStats] = useState({
    totalFrames: 0,
    totalVideos: 0,
    totalScans: 0,
    activeTargets: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [chartData, setChartData] = useState<{
    daily: { label: string; count: number }[];
    monthly: { label: string; count: number }[];
  }>({ daily: [], monthly: [] });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // 1. Fetch memories stats
        const { data: memories, error: memError } = await supabase
          .from('memories')
          .select('id, scan_count, status, video_url, customer_name, memory_title');

        if (memError) throw memError;

        const totalFrames = memories?.length || 0;
        const totalVideos = memories?.filter(m => m.video_url).length || 0;
        const totalScans = memories?.reduce((acc, curr) => acc + (curr.scan_count || 0), 0) || 0;
        const activeTargets = memories?.filter(m => m.status === 'active').length || 0;

        setStats({ totalFrames, totalVideos, totalScans, activeTargets });

        // 2. Fetch scan analytics
        const { data: analytics, error: analyticsError } = await supabase
          .from('scan_analytics')
          .select('*, memories (customer_name, memory_title)')
          .order('timestamp', { ascending: false });

        if (analyticsError) throw analyticsError;

        const rawScans: ScanRecord[] = analytics || [];
        setRecentScans(rawScans.slice(0, 5));

        // 3. Process chart data
        // Daily (last 7 days)
        const dailyData = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          // Count scans on this date
          const count = rawScans.filter(s => {
            const scanDate = new Date(s.timestamp);
            return scanDate.toDateString() === date.toDateString();
          }).length;

          dailyData.push({ label: dateString, count });
        }

        // Monthly (last 6 months)
        const monthlyData = [];
        for (let i = 5; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const monthString = date.toLocaleDateString('en-US', { month: 'short' });
          
          // Count scans in this month
          const count = rawScans.filter(s => {
            const scanDate = new Date(s.timestamp);
            return scanDate.getMonth() === date.getMonth() && scanDate.getFullYear() === date.getFullYear();
          }).length;

          monthlyData.push({ label: monthString, count });
        }

        setChartData({ daily: dailyData, monthly: monthlyData });
      } catch (err) {
        console.error('Error loading dashboard statistics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  // Helper values for custom SVG charts
  const maxDaily = Math.max(...chartData.daily.map(d => d.count), 1);
  const maxMonthly = Math.max(...chartData.monthly.map(m => m.count), 1);

  return (
    <div className="space-y-8 select-none">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Frames */}
        <div className="glass-panel p-6 rounded border border-white/5 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="absolute top-0 right-0 w-16 h-16 bg-[radial-gradient(circle,rgba(212,175,55,0.08)_0%,transparent_70%)]" />
          <div className="text-white/40 text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-[#D4AF37]" /> Total Frames
          </div>
          <div className="text-3xl font-serif font-bold tracking-wider">{stats.totalFrames}</div>
          <div className="text-[10px] text-white/20 uppercase tracking-widest">Uploaded target assets</div>
        </div>

        {/* Total Videos */}
        <div className="glass-panel p-6 rounded border border-white/5 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="absolute top-0 right-0 w-16 h-16 bg-[radial-gradient(circle,rgba(212,175,55,0.08)_0%,transparent_70%)]" />
          <div className="text-white/40 text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5">
            <Play className="w-4 h-4 text-[#D4AF37]" /> Total Videos
          </div>
          <div className="text-3xl font-serif font-bold tracking-wider">{stats.totalVideos}</div>
          <div className="text-[10px] text-white/20 uppercase tracking-widest">Assigned video films</div>
        </div>

        {/* Total Scans */}
        <div className="glass-panel p-6 rounded border border-[#D4AF37]/10 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="absolute top-0 right-0 w-16 h-16 bg-[radial-gradient(circle,rgba(212,175,55,0.15)_0%,transparent_70%)]" />
          <div className="text-[#D4AF37]/80 text-xs uppercase tracking-widest font-bold flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-[#D4AF37]" /> Total Scans
          </div>
          <div className="text-3xl font-serif font-bold tracking-wider text-[#D4AF37]">{stats.totalScans}</div>
          <div className="text-[10px] text-white/20 uppercase tracking-widest">Accumulated client views</div>
        </div>

        {/* Active Targets */}
        <div className="glass-panel p-6 rounded border border-white/5 relative overflow-hidden flex flex-col justify-between h-32">
          <div className="absolute top-0 right-0 w-16 h-16 bg-[radial-gradient(circle,rgba(212,175,55,0.08)_0%,transparent_70%)]" />
          <div className="text-white/40 text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#D4AF37]" /> Active Targets
          </div>
          <div className="text-3xl font-serif font-bold tracking-wider">{stats.activeTargets}</div>
          <div className="text-[10px] text-white/20 uppercase tracking-widest">Compiled tracking targets</div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* Custom SVG Daily Scans Bar Chart */}
        <div className="glass-panel border border-white/5 p-6 rounded flex flex-col gap-4">
          <div>
            <h3 className="text-sm uppercase tracking-widest font-bold text-[#D4AF37]">Daily Scans</h3>
            <p className="text-xs text-white/40 mt-0.5">Frequency over the last 7 days</p>
          </div>
          
          <div className="relative w-full h-[220px]">
            <svg viewBox="0 0 500 200" className="w-full h-full">
              <defs>
                <linearGradient id="goldBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FCF6BA" />
                  <stop offset="50%" stopColor="#BF953F" />
                  <stop offset="100%" stopColor="transparent" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="30" y1="30" x2="480" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
              <line x1="30" y1="95" x2="480" y2="95" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
              <line x1="30" y1="160" x2="480" y2="160" stroke="rgba(255,255,255,0.1)" />

              {/* Bars */}
              {chartData.daily.map((d, i) => {
                const x = 50 + i * 62;
                const barHeight = (d.count / maxDaily) * 120;
                const y = 160 - barHeight;

                return (
                  <g key={i} className="group">
                    {/* Hover tooltip value */}
                    <text 
                      x={x + 15} 
                      y={y - 8} 
                      textAnchor="middle" 
                      fill="#D4AF37" 
                      fontSize="9" 
                      fontWeight="bold" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      {d.count}
                    </text>
                    {/* Bar */}
                    <rect 
                      x={x} 
                      y={y} 
                      width="30" 
                      height={barHeight} 
                      rx="3" 
                      fill="url(#goldBarGrad)" 
                      className="hover:opacity-95 transition-all cursor-pointer"
                    />
                    {/* X-axis Label */}
                    <text x={x + 15} y="180" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" letterSpacing="0.05em">
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Custom SVG Monthly Scans Area Chart */}
        <div className="glass-panel border border-white/5 p-6 rounded flex flex-col gap-4">
          <div>
            <h3 className="text-sm uppercase tracking-widest font-bold text-[#D4AF37]">Monthly Scans</h3>
            <p className="text-xs text-white/40 mt-0.5">Scan distribution over the last 6 months</p>
          </div>

          <div className="relative w-full h-[220px]">
            <svg viewBox="0 0 500 200" className="w-full h-full">
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#BF953F" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="30" x2="480" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
              <line x1="40" y1="95" x2="480" y2="95" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
              <line x1="40" y1="160" x2="480" y2="160" stroke="rgba(255,255,255,0.1)" />

              {/* Path Generation */}
              {(() => {
                const points = chartData.monthly.map((m, i) => {
                  const x = 60 + i * 80;
                  const y = 160 - (m.count / maxMonthly) * 120;
                  return { x, y };
                });

                if (points.length === 0) return null;

                const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const areaPath = `${linePath} L ${points[points.length - 1].x} 160 L ${points[0].x} 160 Z`;

                return (
                  <>
                    {/* Fill Area */}
                    <path d={areaPath} fill="url(#areaGrad)" />
                    {/* Stroke Line */}
                    <path d={linePath} fill="none" stroke="#D4AF37" strokeWidth="2.5" />
                    
                    {/* Points & Labels */}
                    {points.map((p, i) => (
                      <g key={i} className="group">
                        {/* Hover Value */}
                        <text 
                          x={p.x} 
                          y={p.y - 10} 
                          textAnchor="middle" 
                          fill="#FFFFFF" 
                          fontSize="9" 
                          fontWeight="semibold" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        >
                          {chartData.monthly[i].count}
                        </text>
                        {/* Dot */}
                        <circle 
                          cx={p.x} 
                          cy={p.y} 
                          r="4" 
                          fill="#FCF6BA" 
                          stroke="#BF953F" 
                          strokeWidth="2" 
                          className="hover:scale-150 transition-transform cursor-pointer"
                        />
                        {/* X-axis Label */}
                        <text x={p.x} y="180" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">
                          {chartData.monthly[i].label}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="glass-panel border border-white/5 p-6 rounded flex flex-col gap-6">
        <div>
          <h3 className="text-sm uppercase tracking-widest font-bold text-[#D4AF37]">Recent Scans</h3>
          <p className="text-xs text-white/40 mt-0.5 font-light">Real-time log of the latest 5 image detections</p>
        </div>

        {recentScans.length === 0 ? (
          <div className="text-center py-8 text-white/20 text-xs uppercase tracking-wider">No scans logged yet.</div>
        ) : (
          <div className="space-y-4">
            {recentScans.map((scan) => {
              const scanDate = new Date(scan.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={scan.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full" />
                    <div>
                      <div className="text-sm font-semibold">
                        {scan.memories?.customer_name || 'Deleted Memory'} 
                        <span className="text-white/40 font-normal text-xs ml-2">({scan.memories?.memory_title || 'Unknown'})</span>
                      </div>
                      
                      {/* Meta details */}
                      <div className="flex flex-wrap items-center gap-4 text-[10px] text-white/40 mt-1 font-light uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> {scan.device_type}</span>
                        <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {scan.browser}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {scan.city}, {scan.country}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-[#D4AF37] tracking-wider uppercase flex items-center gap-1.5 font-medium self-end sm:self-center">
                    <Calendar className="w-3 h-3" /> {scanDate}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
