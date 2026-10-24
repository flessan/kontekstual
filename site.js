import "bootstrap";

const THEME_KEY = "kontekstual-theme";
const moon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.1 15.4A8.5 8.5 0 0 1 8.6 3.9 8.6 8.6 0 1 0 20.1 15.4Z"/></svg>';
const sun = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.setAttribute("data-bs-theme", theme === "dark" ? "dark" : "light");
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

  // Update theme-color meta for mobile browser
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", theme === "dark" ? "#0f1310" : "#f6f7f2");
  }
}

// Initial theme
try {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) document.documentElement.dataset.theme = stored;
} catch {}
applyTheme(document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

document.addEventListener("click", event => {
  const button = event.target.closest("[data-theme-toggle]");
  if (!button) return;
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.classList.add("theme-transitioning");
  applyTheme(next);
  window.setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 520);
});

// Header: scroll elevation + theme toggle label refresh.
const header = document.querySelector(".site-header");
if (header) {
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
      ticking = false;
    });
  }, { passive: true });
}

// Reveal animation
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

// Press "/" to jump into the documentation search.
document.addEventListener("keydown", event => {
  const input = document.querySelector("[data-doc-search]");
  if (!input || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable) return;
  if (event.key !== "/") return;
  event.preventDefault();
  input.focus();
  input.select?.();
});

// Doc search
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
