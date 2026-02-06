self.onmessage = (event) => {
  const { payload } = event.data || {};
  self.postMessage({ ok: true, payload });
};
