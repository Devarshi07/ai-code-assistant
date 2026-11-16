// Applies the saved colour theme before first paint. Light is the default, as
// on assessment platforms; the toggle in the top bar switches to dark.
try {
  const saved = JSON.parse(localStorage.getItem('dg-theme') || 'null');
  document.documentElement.dataset.theme = saved === 'dark' ? 'dark' : 'light';
} catch {
  document.documentElement.dataset.theme = 'light';
}
