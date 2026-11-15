import assert from "node:assert/strict";
import { bindViewShortcut } from "../js/view-shortcut.js";

class ListenerTarget {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  fire(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

const doc = new ListenerTarget();
doc.defaultView = new ListenerTarget();
doc.body = {};
doc.documentElement = {};
const scene = { inside: true, dataset: {} };
let dialogOpen = false;
const root = {
  ownerDocument: doc,
  contains: target => !!target?.inside,
  querySelector: selector => selector === "#scene" ? scene : dialogOpen ? {} : null,
};
let ariaDisabled = "false";
const viewButton = { inside: true, disabled: false,
  getAttribute: () => ariaDisabled };
let toggles = 0;
const unbind = bindViewShortcut(root, viewButton, () => { toggles++; });
const key = (overrides = {}) => ({
  code: "KeyV", key: "ㅍ", target: scene, defaultPrevented: false,
  preventDefault() { this.defaultPrevented = true; },
  ...overrides,
});
const up = () => doc.fire("keyup", key());
const press = overrides => {
  const event = key(overrides);
  doc.fire("keydown", event);
  up();
  return event;
};

const first = key();
doc.fire("keydown", first);
assert.equal(toggles, 1, "Physical KeyV works with the Korean ㅍ key value");
assert.equal(first.defaultPrevented, true);
doc.fire("keydown", key({ repeat: true }));
doc.fire("keydown", key());
assert.equal(toggles, 1, "Holding V cannot oscillate the camera");
up();
press();
assert.equal(toggles, 2, "Releasing then pressing V toggles again");

const blocked = [
  { code: "KeyB", key: "v" },
  { repeat: true },
  { ctrlKey: true },
  { altKey: true },
  { metaKey: true },
  { isComposing: true },
  { defaultPrevented: true },
  { target: { inside: true, isContentEditable: true } },
  ...["input", "textarea", "select", "[contenteditable]"].map(tag => ({
    target: { inside: true, closest: selector => selector.includes(tag) ? {} : null },
  })),
  { target: { inside: false } },
];
for (const overrides of blocked) {
  const event = press(overrides);
  assert.equal(toggles, 2, `Blocked shortcut: ${JSON.stringify(overrides)}`);
  if (!overrides.defaultPrevented) assert.equal(event.defaultPrevented, false);
}
viewButton.disabled = true;
press();
viewButton.disabled = false;
ariaDisabled = "true";
press();
ariaDisabled = "false";
scene.dataset.dialogueOpen = "true";
press();
scene.dataset.dialogueOpen = "false";
dialogOpen = true;
press();
dialogOpen = false;
assert.equal(toggles, 2, "Disabled camera and open NPC/product dialogs are protected");

press({ target: viewButton });
press({ target: doc.body });
press({ target: doc.documentElement });
press({ shiftKey: true });
assert.equal(toggles, 6, "Icon focus, initial page focus and Shift do not lose V");
doc.fire("keydown", key());
doc.defaultView.fire("blur");
doc.fire("keydown", key());
doc.fire("visibilitychange");
doc.fire("keydown", key());
assert.equal(toggles, 9, "Focus loss and visibility changes release held state");
unbind();
up();
press();
assert.equal(toggles, 9, "Cleanup removes all shortcut listeners");
console.log("PASS: physical V, one toggle per press, modifiers, IME/editable/modal guards, focus and cleanup");
