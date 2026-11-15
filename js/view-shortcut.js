// Keep the shortcut inside this page and leave text entry/dialog controls alone.
export function bindViewShortcut(root, viewButton, toggleView) {
  const doc = root.ownerDocument;
  const appWindow = doc.defaultView;
  let held = false;

  const reset = () => { held = false; };
  const keyUp = event => {
    if (event.code === "KeyV") reset();
  };
  const keyDown = event => {
    if (event.code !== "KeyV" || event.repeat || held || event.isComposing ||
        event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) return;
    const target = event.target;
    const inside = target === doc.body || target === doc.documentElement || root.contains(target);
    if (!inside || target?.isContentEditable || target?.closest?.("input, textarea, select, [contenteditable]")) return;
    if (viewButton.disabled || viewButton.getAttribute("aria-disabled") === "true") return;
    if (root.querySelector("#scene")?.dataset.dialogueOpen === "true" ||
        root.querySelector("dialog[open]")) return;
    held = true;
    event.preventDefault();
    toggleView();
  };

  doc.addEventListener("keydown", keyDown);
  doc.addEventListener("keyup", keyUp, true);
  doc.addEventListener("visibilitychange", reset);
  appWindow?.addEventListener("blur", reset);
  return () => {
    doc.removeEventListener("keydown", keyDown);
    doc.removeEventListener("keyup", keyUp, true);
    doc.removeEventListener("visibilitychange", reset);
    appWindow?.removeEventListener("blur", reset);
    reset();
  };
}
