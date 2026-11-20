// Pure fuzzy search (no browser APIs, unit-testable).
export function score(q, text) {
  q = q.toLowerCase();
  const t = (text || '').toLowerCase();
  if (!q) return 1;
  const idx = t.indexOf(q);
  if (idx >= 0) return 100 - idx * 0.5 + (idx === 0 ? 20 : 0);
  let qi = 0, s = 0, last = -2;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      s += i === last + 1 ? 5 : 1;
      last = i;
      qi++;
    }
  }
  return qi === q.length ? s : 0;
}

/** items: {title,url,path}; every whitespace separated term must match. */
export function search(query, items, limit = 30) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return items.slice(0, limit);
  const out = [];
  for (const it of items) {
    let total = 0;
    for (const term of terms) {
      const s = Math.max(score(term, it.title) * 2, score(term, it.url), score(term, it.path) * 0.5);
      if (!s) { total = 0; break; }
      total += s;
    }
    if (total) out.push([total, it]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1]);
}
