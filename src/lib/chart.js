// Строит плавную кривую (Catmull-Rom → Безье) по точкам из админки. Координаты 0–100.
export function buildChart(points) {
  const p = [...points].filter((a) => Number.isFinite(a?.x) && Number.isFinite(a?.y)).sort((a, b) => a.x - b.x);
  if (p.length < 2) return { line: '', area: '', tips: [] };
  let d = `M${p[0].x} ${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2;
    const c1 = [p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6];
    const c2 = [p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6];
    const fmt = (n) => +n.toFixed(2);
    d += ` C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${p2.x} ${p2.y}`;
  }
  const last = p[p.length - 1];
  return { line: d, area: `${d} L${last.x} 100 L${p[0].x} 100 Z`, tips: p.filter((a) => a.tip) };
}
