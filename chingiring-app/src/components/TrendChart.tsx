import React from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';

export interface SeriesPoint { label: string; value: number; }

const VB_H = 200, PAD_L = 40, PAD_R = 16, PAD_T = 14, PAD_B = 28;
const CHART_H = VB_H - PAD_T - PAD_B;
const GRID = '#ecebf5', AXIS_TXT = '#9aa1ad';

function fmtK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 4 ? 4 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function TrendChart({ data, color = '#5b4be6', fillOpacity = 0.12 }: {
  data: SeriesPoint[]; color?: string; fillOpacity?: number;
}) {
  const [width, setWidth] = React.useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - width) > 1) setWidth(w);
  };
  const pts = Array.isArray(data) ? data : [];
  const n = pts.length;
  const rawMax = Math.max(0, ...pts.map((d) => d.value || 0));
  const step = rawMax > 0 ? niceCeil(rawMax / 4) : 25;
  const maxY = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const chartW = Math.max(0, width - PAD_L - PAD_R);
  const xFor = (i: number) => PAD_L + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  const yFor = (v: number) => PAD_T + (1 - (v || 0) / maxY) * CHART_H;
  const linePts = pts.map((d, i) => ({ x: xFor(i), y: yFor(d.value) }));
  const baseline = PAD_T + CHART_H;
  const line = smoothPath(linePts);
  const area = n > 0 ? `${line} L ${linePts[n - 1].x.toFixed(1)} ${baseline} L ${linePts[0].x.toFixed(1)} ${baseline} Z` : '';
  const xEvery = Math.max(1, Math.ceil(n / 8));
  const hasData = rawMax > 0;
  const end = linePts[n - 1];

  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={VB_H} viewBox={`0 0 ${width} ${VB_H}`}>
          {ticks.map((t, i) => {
            const y = yFor(t);
            return (
              <React.Fragment key={`g${i}`}>
                <Line x1={PAD_L} y1={y} x2={width - PAD_R} y2={y} stroke={GRID} strokeWidth={1} />
                <SvgText x={PAD_L - 8} y={y + 3} fontSize={11} fill={AXIS_TXT} textAnchor="end">{fmtK(t)}</SvgText>
              </React.Fragment>
            );
          })}
          {pts.map((d, i) => (i % xEvery === 0 || i === n - 1 ? (
            <SvgText key={`x${i}`} x={xFor(i)} y={VB_H - 8} fontSize={10} fill={AXIS_TXT} textAnchor="middle">{d.label}</SvgText>
          ) : null))}
          {n > 0 && <Path d={area} fill={color} fillOpacity={fillOpacity} />}
          {n > 0 && <Path d={line} stroke={color} strokeWidth={2.5} fill="none" />}
          {n > 0 && end && <Circle cx={end.x} cy={end.y} r={4} fill={color} stroke="#fff" strokeWidth={2} />}
        </Svg>
      )}
      {!hasData && <Text style={st.empty}>No shares in the last 30 days yet — the trend fills in as users share.</Text>}
    </View>
  );
}

const st = StyleSheet.create({ empty: { fontSize: 12, color: '#9aa1ad', textAlign: 'center', marginTop: 8 } });
export default TrendChart;
