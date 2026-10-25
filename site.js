import "bootstrap";

const THEME_KEY = "kontekstual-theme";
const moon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.1 15.4A8.5 8.5 0 0 1 8.6 3.9 8.6 8.6 0 1 0 20.1 15.4Z"/></svg>';
const sun = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.setAttribute("data-bs-theme", theme === "dark" ? "dark" : "light");
  if (document.querySelector("[data-theme-toggle]")) {
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }
  document.querySelectorAll("[data-theme-toggle]").forEach(button => {
    const dark = theme === "dark";
    button.setAttribute("aria-label", dark ? "Aktifkan mode terang" : "Aktifkan mode gelap");
    button.setAttribute("title", dark ? "Mode terang" : "Mode gelap");
    const icon = button.querySelector("[data-theme-icon]");
    if (icon) icon.innerHTML = dark ? sun : moon;
    const label = button.querySelector("[data-theme-label]");
    if (label) label.textContent = dark ? "Mode terang" : "Mode gelap";
  });
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", theme === "dark" ? "#18181B" : "#FFFFFF");
}

const themeControls = document.querySelectorAll("[data-theme-toggle]");
if (themeControls.length) {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) document.documentElement.dataset.theme = stored;
  } catch {}
}
applyTheme(themeControls.length ? (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) : "light");

document.addEventListener("click", event => {
  const button = event.target.closest("[data-theme-toggle]");
  if (!button) return;
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.classList.add("theme-transitioning");
  applyTheme(next);
  window.setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 420);
});

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
document.documentElement.classList.add("js");

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

// Share the canonical page URL without exposing locally stored playground code.
document.querySelectorAll("[data-share-page]").forEach(button => {
  button.addEventListener("click", async () => {
    const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
    const shareData = {
      title: "Playground Kontekstual",
      text: "Tulis program, jalankan di peramban, lalu lihat hasilnya.",
      url: canonical
    };
    const status = document.querySelector("[data-share-status]");
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        if (status) status.textContent = "Tautan Playground siap dibagikan.";
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(canonical);
      if (status) status.textContent = "Tautan Playground tersalin.";
    } catch {
      if (status) status.textContent = "Tidak dapat membagikan otomatis. Salin alamat halaman ini dari bilah peramban.";
    }
  });
});

// Copy installation commands
document.querySelectorAll("[data-copy]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const text = btn.getAttribute("data-copy");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="bi bi-check-lg"></i> Tersalin';
      btn.classList.add("is-copied");
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.classList.remove("is-copied");
      }, 1400);
    } catch {
      btn.textContent = "Gagal menyalin";
    }
  });
});

// Toggle showcase interactivity (demo purposes)
document.querySelectorAll('[data-toggle][role="switch"]').forEach(toggle => {
  toggle.addEventListener("click", () => {
    const isOn = toggle.getAttribute("aria-checked") !== "true";
    toggle.classList.toggle("is-on", isOn);
    toggle.setAttribute("aria-checked", String(isOn));
  });
});

// Palette copy
document.querySelectorAll("[data-copy-color]").forEach(card => {
  card.addEventListener("click", async () => {
    const color = card.getAttribute("data-copy-color");
    if (!color) return;
    try { await navigator.clipboard.writeText(color); } catch {}
    const note = card.querySelector(".palette-copied");
    if (note) {
      note.hidden = false;
      setTimeout(() => note.hidden = true, 1200);
    }
  });
});

document.addEventListener("DOMContentLoaded", () => applyTheme(document.documentElement.dataset.theme || "light"), { once: true });
