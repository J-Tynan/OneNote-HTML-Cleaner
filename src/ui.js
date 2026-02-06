export function initUi({ runPipeline }) {
  const app = document.getElementById("app");
  if (!app) return;
  app.dataset.ready = "true";
  runPipeline("");
}
