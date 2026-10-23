const THEME_KEY = "kontekstual-theme";
const moon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.1 15.4A8.5 8.5 0 0 1 8.6 3.9 8.6 8.6 0 1 0 20.1 15.4Z"/></svg>';
const sun = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
  document.querySelectorAll("[data-theme-toggle]").forEach(button => {
    const dark = theme === "dark";
    button.setAttribute("aria-label", dark ? "Aktifkan mode terang" : "Aktifkan mode gelap");
    button.setAttribute("title", dark ? "Mode terang" : "Mode gelap");
    const icon = button.querySelector("[data-theme-icon]");
    if (icon) icon.innerHTML = dark ? sun : moon;
    const label = button.querySelector("[data-theme-label]");
    if (label) label.textContent = dark ? "Mode terang" : "Mode gelap";
  });
}
applyTheme(document.documentElement.dataset.theme || "light");
document.addEventListener("click", event => {
  const button = event.target.closest("[data-theme-toggle]");
  if (!button) return;
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.classList.add("theme-transitioning");
  applyTheme(next);
  window.setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 520);
});
function iconThemeButton() {
  return '<button class="theme-toggle" type="button" data-theme-toggle aria-label="Aktifkan mode gelap" title="Mode gelap"><span data-theme-icon>' + (document.documentElement.dataset.theme === "dark" ? sun : moon) + '</span><span class="theme-label" data-theme-label>Mode gelap</span></button>';
}
const header = document.querySelector("[data-site-header]");
if (header) {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const nav = [
    ["/docs/", "Dokumentasi"],
    ["/docs/grammar/", "Sintaks"],
    ["/agent/", "AI docs"]
  ];
  header.className = "site-header";
  header.innerHTML = '<div class="nav-inner"><a class="site-brand" href="/" aria-label="Kontekstual, halaman utama"><span class="brand-mark">K.</span><span class="brand-label"><strong>Kontekstual</strong><small>BAHASA PEMROGRAMAN</small></span></a><nav class="nav-links" aria-label="Navigasi utama">' + nav.map(item => '<a href="' + item[0] + '"' + (path === item[0].replace(/\/$/, "") ? ' aria-current="page"' : "") + '>' + item[1] + '</a>').join("") + '</nav><div class="nav-actions">' + iconThemeButton() + '<a class="nav-cta" href="/coba/">Coba sekarang <span aria-hidden="true">↗</span></a></div></div>';
}
const footer = document.querySelector("[data-site-footer]");
if (footer) {
  footer.className = "site-footer";
  footer.innerHTML = '<div class="footer-inner"><div class="footer-copy"><span class="brand-mark">K.</span><span>Kontekstual · bahasa pemrograman eksperimental</span></div><nav class="footer-links" aria-label="Tautan footer"><a href="/docs/">Dokumentasi</a><a href="/docs/tutorial/">Tutorial</a><a href="/agent/">AI docs</a><a href="/llms.txt">llms.txt</a><a href="https://github.com/flessan/kontekstual" target="_blank" rel="noreferrer">GitHub ↗</a></nav><span class="footer-meta">Dibangun terbuka.</span></div>';
}
document.querySelectorAll("[data-theme-toggle]").forEach(button => {
  const dark = document.documentElement.dataset.theme === "dark";
  button.setAttribute("aria-label", dark ? "Aktifkan mode terang" : "Aktifkan mode gelap");
});
const revealEls = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -28px 0px" });
  revealEls.forEach(el => observer.observe(el));
} else revealEls.forEach(el => el.classList.add("is-visible"));
document.querySelectorAll("[data-doc-search]").forEach(input => {
  const container = document.querySelector(input.dataset.docSearch);
  if (!container) return;
  input.addEventListener("input", () => {
    const term = input.value.trim().toLocaleLowerCase("id");
    const entries = container.querySelectorAll("[data-searchable]");
    let visible = 0;
    entries.forEach(entry => {
      const show = !term || entry.textContent.toLocaleLowerCase("id").includes(term);
      entry.hidden = !show;
      if (show) visible++;
    });
    const count = document.querySelector("[data-search-count]");
    if (count) count.textContent = term ? visible + " topik ditemukan" : "Jelajahi topik dokumentasi";
  });
});
document.addEventListener("DOMContentLoaded", () => applyTheme(document.documentElement.dataset.theme || "light"), { once: true });
