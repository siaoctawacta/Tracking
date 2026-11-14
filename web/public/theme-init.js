// Runs before first paint (external file so the CSP can stay script-src 'self'): applies the saved
// theme, or the OS preference, to avoid a flash of the wrong theme.
;(function () {
  var t = null
  try { t = localStorage.getItem('bc-theme') } catch (e) {}
  var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', dark)
  var m = document.querySelector('meta[name="theme-color"]')
  if (m) m.setAttribute('content', dark ? '#0b1220' : '#f8fafc')
})()
