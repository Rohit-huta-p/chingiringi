import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';

// One point per day from GET /api/admin/dashboard → data.revenueTrend.
export interface TrendPoint { label: string; revenue: number; conversions: number; }

// Fixed viewBox → the SVG scales responsively to the card width via width="100%".
const VB_W = 720;
const VB_H = 260;
const PAD_L = 48;
const PAD_R = 18;
const PAD_T = 14;
const PAD_B = 30;
const CHART_W = VB_W - PAD_L - PAD_R;
const CHART_H = VB_H - PAD_T - PAD_B;

const REVENUE_COLOR = '#2563eb';
const CONVERSIONS_COLOR = '#93c5fd';
const GRID = '#eef2f7';
const AXIS_TXT = '#94a3b8';

function fmtK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}

// Round a value up to a "nice" 1/2/2.5/4/5/10 × power-of-ten.
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 4 ? 4 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

// Catmull-Rom → cubic bezier for a smooth curve through the points.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  const pts = Array.isArray(data) ? data : [];
  const n = pts.length;

  const allVals = pts.flatMap((d) => [d.revenue || 0, d.conversions || 0]);
  const rawMax = Math.max(0, ...allVals);
  const step = rawMax > 0 ? niceCeil(rawMax / 4) : 25;
  const maxY = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);

  const xFor = (i: number) => PAD_L + (n <= 1 ? CHART_W / 2 : (i / (n - 1)) * CHART_W);
  const yFor = (v: number) => PAD_T + (1 - (v || 0) / maxY) * CHART_H;

  const revPts = pts.map((d, i) => ({ x: xFor(i), y: yFor(d.revenue) }));
  const convPts = pts.map((d, i) => ({ x: xFor(i), y: yFor(d.conversions) }));

  const xEvery = Math.max(1, Math.ceil(n / 8));
  const hasData = rawMax > 0;

  return (
    <View>
      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: REVENUE_COLOR }]} />
          <Text style={s.legendTxt}>Revenue</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.dot, { backgroundColor: CONVERSIONS_COLOR }]} />
          <Text style={s.legendTxt}>Conversions</Text>
        </View>
      </View>

      <Svg width="100%" height={240} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        {ticks.map((t, i) => {
          const y = yFor(t);
          return (
            <React.Fragment key={`g${i}`}>
              <Line x1={PAD_L} y1={y} x2={VB_W - PAD_R} y2={y} stroke={GRID} strokeWidth={1} />
              <SvgText x={PAD_L - 8} y={y + 3} fontSize={11} fill={AXIS_TXT} textAnchor="end">
                {fmtK(t)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {pts.map((d, i) =>
          i % xEvery === 0 || i === n - 1 ? (
            <SvgText key={`x${i}`} x={xFor(i)} y={VB_H - 10} fontSize={10} fill={AXIS_TXT} textAnchor="middle">
              {d.label}
            </SvgText>
          ) : null,
        )}

        {n > 0 && <Path d={smoothPath(convPts)} stroke={CONVERSIONS_COLOR} strokeWidth={2} fill="none" />}
        {n > 0 && <Path d={smoothPath(revPts)} stroke={REVENUE_COLOR} strokeWidth={2.5} fill="none" />}
      </Svg>

      {!hasData && (
        <Text style={s.emptyNote}>
          No revenue in the last 30 days yet — the trend fills in as conversions credit.
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  legendRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendTxt: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  emptyNote: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 8 },
});

export default RevenueTrendChart;
