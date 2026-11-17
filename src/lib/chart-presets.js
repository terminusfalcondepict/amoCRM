// График «было → стало» для карточки кейса.
// Владелец сайта вводит только два значения и выбирает форму линии,
// а точки кривой (координаты 0–100, 0 — верх) строятся здесь.
// Публичная карточка (Case.astro) по-прежнему читает chart.points.

export const SHAPES = [
  {
    id: 'growth', name: 'Плавный рост',
    points: [[0, 84], [17, 74, 'before'], [38, 64], [58, 46], [76, 30, 'after'], [90, 25], [100, 18]],
  },
  {
    id: 'dip', name: 'Спад, затем рост',
    points: [[0, 72], [17, 66, 'before'], [30, 76], [42, 80], [58, 56], [76, 28, 'after'], [90, 36], [100, 30]],
  },
  {
    id: 'jump', name: 'Резкий рывок',
    points: [[0, 80], [17, 78, 'before'], [36, 76], [50, 62], [62, 36], [76, 26, 'after'], [100, 16]],
  },
];

// Нарисованная вручную кривая (три первых кейса). Форма сохраняется, меняются только подписи.
export const CUSTOM = { id: 'custom', name: 'Как сейчас' };

export const shapeById = (id) => SHAPES.find((s) => s.id === id);

/** Точки для сохранения в кейс. Для своей кривой нужен prevPoints — текущие точки кейса. */
export function chartPoints({ shape, before = '', after = '' }, prevPoints = []) {
  const preset = shapeById(shape);
  if (preset) {
    return preset.points.map(([x, y, role]) => {
      const p = { x, y };
      const tip = role === 'before' ? before : role === 'after' ? after : '';
      if (tip) p.tip = tip;
      return p;
    });
  }
  return relabel(prevPoints, before, after);
}

/* Своя кривая: первая подписанная точка — «было», последняя — «стало».
   Если подписанная точка одна, «стало» ставится на последнюю точку не правее 90 %,
   чтобы подпись не вылезала за край карточки.
   Пустая строка в tip сохраняет место подписи, но на сайте не показывается. */
function relabel(points, before, after) {
  const pts = [...points].map((p) => ({ ...p })).sort((a, b) => a.x - b.x);
  if (!pts.length) return pts;
  const tipped = pts.map((p, i) => ('tip' in p ? i : -1)).filter((i) => i >= 0);
  const first = tipped.length ? tipped[0] : 0;
  let last = tipped.length > 1 ? tipped[tipped.length - 1] : pts.findLastIndex((p, i) => i > first && p.x <= 90);
  if (last === first) last = -1;
  pts.forEach((p, i) => { if (i !== first && i !== last) delete p.tip; });
  pts[first].tip = before;
  if (last >= 0) pts[last].tip = after;
  return pts;
}

/** Значения «было/стало» из уже существующих точек — для старых данных без этих полей. */
export function labelsFromPoints(points = []) {
  const tips = [...points].sort((a, b) => a.x - b.x).filter((p) => 'tip' in p).map((p) => p.tip ?? '');
  return { before: tips[0] ?? '', after: tips.length > 1 ? tips[tips.length - 1] : '' };
}
