// Applies the saved colour theme before first paint.
try {
  const saved = JSON.parse(localStorage.getItem('dg-theme') || 'null');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch {}
