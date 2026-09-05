import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface D3ConsistencyGaugeProps {
  score: number;
  label: string;
  sublabel?: string;
  isDarkMode?: boolean;
}

export const D3ConsistencyGauge: React.FC<D3ConsistencyGaugeProps> = ({ score, label, sublabel, isDarkMode = true }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 220;
    const height = 140;
    const radius = Math.min(width, height * 2) / 2 - 10;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height - 15})`);

    // Arc generator for background track (semi-circle from -PI/2 to PI/2)
    const arcBackground = d3.arc()
      .innerRadius(radius - 18)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(Math.PI / 2);

    g.append('path')
      .datum({ startAngle: -Math.PI / 2, endAngle: Math.PI / 2 })
      .style('fill', isDarkMode ? '#282828' : '#e2e8f0')
      .attr('d', arcBackground as any);

    const percent = Math.min(Math.max(score, 0), 100) / 100;
    const targetAngle = -Math.PI / 2 + percent * Math.PI;

    // Arc generator for value gauge
    const arcValue = d3.arc()
      .innerRadius(radius - 18)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .cornerRadius(9);

    const path = g.append('path')
      .datum({ startAngle: -Math.PI / 2, endAngle: -Math.PI / 2 })
      .style('fill', '#1ed760')
      .attr('d', arcValue as any);

    path.transition()
      .duration(1000)
      .attrTween('d', function(d: any) {
        const interpolate = d3.interpolate(d.endAngle, targetAngle);
        return function(t) {
          d.endAngle = interpolate(t);
          return arcValue(d) || '';
        };
      });

    // Score text
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-15px')
      .attr('fill', isDarkMode ? '#ffffff' : '#0f172a')
      .attr('font-size', '28px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'sans-serif')
      .text(`${score}%`);

    if (sublabel) {
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '8px')
        .attr('fill', isDarkMode ? '#b3b3b3' : '#64748b')
        .attr('font-size', '11px')
        .attr('text-transform', 'uppercase')
        .attr('letter-spacing', '1px')
        .text(sublabel);
    }
  }, [score, isDarkMode]);

  return (
    <div className={`rounded-2xl border p-6 shadow-lg flex flex-col items-center justify-center transition-colors ${
      isDarkMode ? 'glass-card border-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.6)]' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-[#b3b3b3]' : 'text-slate-500'}`}>{label}</h3>
      <svg ref={svgRef} width={220} height={140} className="overflow-visible" />
    </div>
  );
};
