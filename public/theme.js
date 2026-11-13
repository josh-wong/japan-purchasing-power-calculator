// Applies the saved appearance before the first paint and wires the header button.
// Shared by every page as a classic script, so it must stay small and blocking.
(() => {
  const storageKey = 'japan-purchasing-power.theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const nextMode = { system: 'light', light: 'dark', dark: 'system' };
  let theme = 'system';

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch {
    // Keep the system default when browser storage is unavailable.
  }

  function applyTheme() {
    const systemColor = systemTheme.matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme === 'system' ? systemColor : theme;
  }

  applyTheme();
  systemTheme.addEventListener('change', applyTheme);

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme');

    function updateButton() {
      const label = `Appearance: ${theme}. Switch to ${nextMode[theme]}.`;
      button.dataset.mode = theme;
      button.title = label;
      button.setAttribute('aria-label', label);
    }

    updateButton();
    button.addEventListener('click', () => {
      theme = nextMode[theme];
      applyTheme();
      updateButton();
      try {
        localStorage.setItem(storageKey, theme);
      } catch {
        // The new theme still applies for this visit.
      }
    });
  });
})();
