// Landing page interactions: demo tabs with full keyboard support + small UX polish.

const tablist = document.querySelector('[role="tablist"][aria-label="Contoh program"]');

if (tablist) {
  const tabs = Array.from(tablist.querySelectorAll(".demo-tab"));
  const panelHost = tablist.closest(".demo-tabs");
  const panels = Array.from(panelHost.querySelectorAll("[data-demo-panel]"));

  function activate(tab, { focus = false } = {}) {
    tabs.forEach(item => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => {
      panel.hidden = panel.id !== tab.dataset.target;
    });
    if (focus) tab.focus();
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => activate(tab));
    tab.addEventListener("keydown", event => {
      const index = tabs.indexOf(tab);
      let next = null;
      if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
      if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === "Home") next = tabs[0];
      if (event.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        event.preventDefault();
        activate(next, { focus: true });
      }
    });
  });

  activate(tabs.find(tab => tab.classList.contains("is-active")) || tabs[0]);
}

// Copy the hero sample to the clipboard, so visitors can paste it into the playground.
document.querySelectorAll("[data-copy-sample]").forEach(button => {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copySample || "");
      const label = button.querySelector("[data-copy-label]");
      if (label) {
        const original = label.textContent;
        label.textContent = "Tersalin!";
        window.setTimeout(() => { label.textContent = original; }, 1800);
      }
    } catch {
      /* Clipboard access is optional. */
    }
  });
});
