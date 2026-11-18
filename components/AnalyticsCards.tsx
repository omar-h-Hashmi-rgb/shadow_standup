"use client";

import React from 'react';
import { 
  BarChart3, 
  Leaf, 
  TrendingUp, 
  Zap 
} from 'lucide-react';

export default function AnalyticsCards() {
  // Mock data for now as requested
  const metrics = [
    {
      title: "Productivity Score",
      value: "84",
      unit: "/100",
      icon: <TrendingUp size={24} />,
      color: "text-blue-600",
      bg: "bg-blue-50",
      subtitle: "Based on commit frequency & size"
    },
    {
      title: "Estimated Carbon Impact",
      value: "12.4",
      unit: " gCO2eq",
      icon: <Leaf size={24} />,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      subtitle: "Based on cyclomatic complexity"
    },
    {
      title: "Active Repository",
      value: "Shadow Standup",
      unit: "",
      icon: <BarChart3 size={24} />,
      color: "text-purple-600",
      bg: "bg-purple-50",
      subtitle: "Highest activity this week"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {metrics.map((m, i) => (
        <div 
          key={i} 
          className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 ${m.bg} ${m.color} rounded-2xl transition-transform group-hover:scale-110`}>
              {m.icon}
            </div>
            <Zap size={14} className="text-gray-200" />
          </div>
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{m.title}</h3>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-gray-900 tracking-tighter">{m.value}</span>
            <span className="text-sm font-bold text-gray-400">{m.unit}</span>
          </div>
          <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-tight">{m.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
