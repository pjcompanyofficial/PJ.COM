// Secret config for update workflows.
// Note: anything shipped to the browser can still be viewed by visitors.
// For real secrecy, keep server-side checks or a private repo.
window.PJ_STORE_SECRET = {
  updateKey: "PJ-W9Y7-LBR9-6JQB-PAVI",
  updateModeEnabled: false
};

function verifyUpdateKey(inputKey) {
  return String(inputKey || "").trim() === window.PJ_STORE_SECRET.updateKey;
}
window.verifyUpdateKey = verifyUpdateKey;
