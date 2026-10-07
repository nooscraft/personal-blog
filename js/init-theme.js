/*
 * @file This script initializes the theme data. This script should not be
 * deferred and should be placed within the <head> section of the page to
 * set the theme class on the DOM before rendering the page to prevent
 * flickering.
 */

(function () {
  try {
    const storedTheme = localStorage.getItem("theme-storage");
    const defaultTheme = document.documentElement.dataset.theme || "toggle";
    let theme;

    if (["light", "dark", "auto"].includes(defaultTheme)) {
      theme = defaultTheme;
    } else if (storedTheme) {
      theme = storedTheme;
    } else {
      theme = "light"; // fallback default
    }

    // Apply theme class directly
    document.documentElement.classList.add(theme);

    if (document.body) {
      document.body.classList.add(theme);
    } else {
      // Defer body class application
      window.addEventListener("DOMContentLoaded", function () {
        document.body.classList.add(theme);
      });
    }
  } catch (e) {
    // In case localStorage access fails
    document.documentElement.classList.add("light");
    document.body.classList.add("light");
  }
})();
