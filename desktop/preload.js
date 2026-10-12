/** Mark the hub page so CSS/JS can detect the desktop shell if needed. */
window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.dataset.mygamesDesktop = "1";
});
