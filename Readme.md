# DE-aria

Accessibility tools for plain HTML websites (originally made for dreamengine).

Pressing and releasing **Ctrl** (tap without any combo key) shows keyboard shortcut hints for all currently interactive elements. Pressing any other key, clicking, scrolling with the mouse, or any non-hover mouse event hides them. While hints are visible, **arrow keys** scroll the active scroller without hiding the hints.

---

## Usage

```html
<script type="module" src="js/index.js"></script>
```

Import the script as an ES module. No framework or build step required.

---

## HTML Attributes

These are the attributes you place on your own elements to control behaviour. All attribute names follow the `data-de-aria-*` convention.

### `data-de-aria-key`

**Required on every interactive element.**

The key code for keydown (with ignored case) that the user presses (while hints are visible) to trigger that element. Case-insensitive — always stored and matched in lower-case internally.

```html
<button data-de-aria-key="s">Save</button>
<a href="/help" data-de-aria-key="h">Help</a>
<input type="text" data-de-aria-key="n" placeholder="Name">
```

If omitted, the library falls back to the first character of the element's `textContent` and logs a warning.

---

### `data-de-aria-key-label`

**Optional.** Overrides the character shown on the visual badge indicator.

Useful when the displayed letter should differ from the trigger key (e.g. the key is `Escape` but you want the badge to show `Esc`).

```html
<button data-de-aria-key="s" data-de-aria-key-label="S">Save</button>
```

Defaults to the upper-cased value of `data-de-aria-key`.

---

### `data-de-aria-action`

**Optional.** Overrides the default action taken when the key is pressed.

| Value | Behaviour |
|---|---|
| *(omitted)* | Inferred from element type (see below) |
| `click` | Calls `.click()` |
| `focus` | Calls `.focus()` |
| `play` | Toggles `.play()` / `.pause()` on media elements |
| `none` | No action taken, useful for elements that should not respond to key presses for example a modal dialog with escape handled already as a keydown but also a button available |

**Default inference rules (when omitted):**

- `button`, `a`, `summary`, clickable `input` types (`checkbox`, `radio`, `submit`, `button`, `reset`, `image`) → `click`
- `input` (text types), `textarea`, `select`, `iframe`, `[contenteditable]` → `focus`
- `audio`, `video` → `play`/`pause` toggle
- Anything else → `focus`

```html
<audio controls data-de-aria-key="p" data-de-aria-action="play" src="..."></audio>
```

---

### `data-de-aria-offset-x` / `data-de-aria-offset-y`

**Optional.** Translates the badge indicator by the given amount via CSS `transform: translate(x, y)`. Accepts any valid CSS length unit (`px`, `em`, `%`, etc.).

```html
<a href="#" data-de-aria-key="h" data-de-aria-offset-x="-1em" data-de-aria-offset-y="1.5em">Help</a>
```

Both default to `0` if only one axis is specified.

---

### `data-de-aria-horizontal-alignment`

**Optional.** Controls where the badge indicator is anchored horizontally relative to the element. Honours writing direction (`start` and `end` flip in RTL).

| Value | Position |
|---|---|
| `end-inside` *(default)* | Flush against the trailing edge of the element, **inside** its bounding box (right edge in LTR, left in RTL) |
| `end-outside` | Just past the trailing edge of the element, **outside** its bounding box |
| `start-inside` | Flush against the leading edge of the element, **inside** its bounding box (left edge in LTR, right in RTL) |
| `start-outside` | Just past the leading edge of the element, **outside** its bounding box |

```html
<button data-de-aria-key="s" data-de-aria-horizontal-alignment="start-outside">Save</button>
```

---

### `data-de-aria-vertical-alignment`

**Optional.** Controls where the badge indicator is anchored vertically relative to the element.

| Value | Position |
|---|---|
| `top-inside` *(default)* | Flush against the top edge of the element, **inside** its bounding box |
| `top-outside` | Just above the top edge of the element, **outside** its bounding box |
| `bottom-inside` | Flush against the bottom edge of the element, **inside** its bounding box |
| `bottom-outside` | Just below the bottom edge of the element, **outside** its bounding box |

```html
<button data-de-aria-key="s" data-de-aria-vertical-alignment="bottom-outside">Save</button>
```

Combine with `data-de-aria-horizontal-alignment` and `data-de-aria-offset-x` / `data-de-aria-offset-y` for fine-grained control over badge placement.

---

### `data-de-aria-indicator-class`

**Optional.** Extra CSS class(es) added to the badge indicator `<span>` for this specific element, in addition to the base `de-aria-key-indicator` class. Useful for per-element styling overrides.

```html
<button data-de-aria-key="d" data-de-aria-indicator-class="danger-badge">Delete</button>
```

---

### `data-de-aria-scroller-class`

**Optional. Place on a `[data-de-role="scroller"]` element.** Extra CSS class(es) added to the scroller overlay box, in addition to the base `de-aria-scroller` class.

```html
<div data-de-role="scroller" data-de-aria-scroller-class="my-scroll-overlay">...</div>
```

---

### `data-de-role="scroller"`

Marks an element as the scrollable region. The library finds the first accessible element with this attribute and shows the arrow-key overlay on top of it.

The element must also be actually scrollable (i.e. have `overflow: auto` or `overflow: scroll` and content that overflows).

```html
<div data-de-role="scroller" style="overflow: auto; height: 300px;">
    <!-- scrollable content -->
</div>
```

Arrow directions are shown or hidden based on whether scrolling in that direction is currently possible. If neither axis is scrollable the overlay is not shown at all.

---

## Styling

All visual elements are plain DOM nodes with stable CSS classes. None of the base styles are injected by the library — you provide them entirely.

### Badge indicator: `.de-aria-key-indicator`

A `<span>` appended to `<body>`, positioned with `position: fixed` adjacent to the marked element's bounding box. The badge sits on the **trailing edge** of the element (right for LTR, left for RTL).

```css
.de-aria-key-indicator {
    background: #222;
    color: #ffd54a;
    font-weight: bold;
    font-size: 0.85rem;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #ffd54a;
    font-family: ui-monospace, monospace;
    pointer-events: none;
    z-index: 9999;
}
```

Additional data attributes available for CSS hooks:

| Attribute | Values | Description |
|---|---|---|
| `data-de-aria-direction` | `ltr` \| `rtl` | Writing direction of the source element |
| `data-de-aria-indicator-for` | key character | The trigger key this badge belongs to |

### Marked elements: `.de-aria-marked`

Added to every interactive element while hints are visible. Use this to show a highlight ring or similar.

```css
.de-aria-marked {
    outline: 2px dashed #ffd54a;
    outline-offset: 2px;
}
```

### Scroller overlay: `.de-aria-scroller`

A `<div>` appended to `<body>`, centered over the scrollable element. Uses CSS grid internally. `pointer-events: none` is set inline.

```css
.de-aria-scroller {
    background: rgba(0, 0, 0, 0.65);
    border: 2px solid #ffd54a;
    border-radius: 12px;
    z-index: 9999;
}
```

### Scroller arrows: `.de-aria-scroller-arrow`

Individual directional arrow `<div>`s inside the overlay. Each also has a directional class.

```css
.de-aria-scroller-arrow {
    color: #ffd54a;
    font-size: 1.2rem;
    text-shadow: 0 1px 2px black;
}

/* Per-direction overrides */
.de-aria-scroller-arrow-up    { }
.de-aria-scroller-arrow-down  { }
.de-aria-scroller-arrow-left  { }
.de-aria-scroller-arrow-right { }
```

Arrows whose direction is not currently scrollable are hidden via `visibility: hidden` (preserving layout) or `display: none` (when the entire axis is inactive).

### Marked scroller element: `.de-aria-scroll-marked`

Added to the `[data-de-role="scroller"]` element itself while the overlay is active.

```css
.de-aria-scroll-marked {
    outline: 2px solid #ffd54a;
}
```

---

## Accessibility & Layering

The library respects the standard browser accessibility tree. An element is considered interactive only if it passes all of these checks:

- Not `disabled`
- Not `aria-hidden="true"`
- Not a negative `tabindex`
- No ancestor with `inert`, `hidden`, `display: none`, or `visibility: hidden/collapse`
- Has a layout box (not detached), unless `position: fixed`

This means that when a modal dialog is open and you set `inert` on the background, only the dialog's elements will receive hint badges — the background is automatically excluded with no extra configuration needed.

```js
// On open: make everything behind the dialog inert
document.getElementById('app').inert = true;

// On close: restore
document.getElementById('app').inert = false;
```
