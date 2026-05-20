const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "audio[controls]",
    "video[controls]",
    "iframe",
    "summary",
    "[contenteditable]:not([contenteditable='false'])",
    "[tabindex]",
].join(",");

/**
 * 
 * @param {Element} el 
 * @returns {boolean}
 */
function isAccessible(el) {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    // @ts-ignore
    if (el.dataset.deAriaText === "true") return false;
    // @ts-ignore
    if (!el.dataset.deRole && typeof el.tabIndex === "number" && el.tabIndex < 0) return false;

    // Walk up the tree checking for inert / hidden ancestors.
    // @ts-ignore
    for (let node = el; node && node !== document; node = node.parentNode) {
        if (node.nodeType !== 1) continue;
        // @ts-ignore
        if (node.inert) return false;
        if (node.hasAttribute("hidden")) return false;
        const style = getComputedStyle(node);
        if (style.display === "none") return false;
        if (style.visibility === "hidden" || style.visibility === "collapse") return false;
    }

    return true;
}

/**
 * @param {any} root 
 * @param {string} selector
 * @returns {HTMLElement[]}
 */
function getAllElementsListBySelector(root, selector) {
    const foundElements = Array.from(root.querySelectorAll(selector));

    const elementsWithShadowRoots = root.querySelectorAll("*");
    for (const el of elementsWithShadowRoots) {
        if (el.shadowRoot || el.root) {
            const foundAtShadow = getAllElementsListBySelector(el.shadowRoot || el.root, selector);
            foundElements.push(...foundAtShadow);
        }
    }
    return foundElements;
}

/**
 * 
 * @param {any} root 
 * @param {string} selector 
 * @returns {HTMLElement | null}
 */
function getSpecificElementBySelector(root, selector) {
    const foundHere = root.querySelector(selector);
    if (foundHere) return foundHere;

    const elementsWithShadowRoots = root.querySelectorAll("*");
    for (const el of elementsWithShadowRoots) {
        if (el.shadowRoot || el.root) {
            const foundAtShadow = getSpecificElementBySelector(el.shadowRoot || el.root, selector);
            if (foundAtShadow) return foundAtShadow;
        }
    }
    return null;
}

function showAccessibility() {
    const focusable = getAllElementsListBySelector(document, FOCUSABLE_SELECTOR)
        .filter(isAccessible);

    const scroller = getAllElementsListBySelector(document, '[data-de-role="scroller"]')
        .find(isAccessible) || null;

    for (const el of focusable) {
        // @ts-ignore
        markFocusableElement(el);
    }

    handleDuplicates(focusable);

    if (scroller) {
        // @ts-ignore
        markScrollerElement(scroller);
    }
}

/**
 * @param {HTMLElement[]} focusableElements 
 */
function handleDuplicates(focusableElements) {
    /** @type {Record<string, HTMLElement[]>} */
    const keyMap = {};

    for (const el of focusableElements) {
        const key = el.dataset.deAriaKeyUsed;
        if (!key) continue;
        if (!keyMap[key]) keyMap[key] = [];
        keyMap[key].push(el);
    }

    for (const [key, elements] of Object.entries(keyMap)) {
        if (elements.length <= 1) continue;
        // If multiple elements share the same key, append a nesting number to the key label of each element to differentiate them.
        // the number must be zero padded to ensure no overlap between "Button 1" and "Button 11" for example.
        elements.forEach((el, index) => {
            const label = el.dataset.deAriaKeyLabelUsedOriginal;
            const assignedNumber = String(index + 1).padStart(String(elements.length).length, "0");
            if (label?.length === 1) {
                el.dataset.deAriaKeyLabelUsed = `${label}${assignedNumber}`;
            } else {
                el.dataset.deAriaKeyLabelUsed = `${label}+${assignedNumber}`;
            }

            el.dataset.deAriaKeyNestUsed = assignedNumber;

            // now update the indicator text if it exist with the new label
            const indicator = document.querySelector(`.de-aria-key-indicator[data-de-aria-indicator-for="${el.dataset.deAriaId}"]`);
            if (indicator) {
                indicator.textContent = el.dataset.deAriaKeyLabelUsed;
            }
        });
    }
}

/**
 * @param {HTMLElement} el 
 */
function markFocusableElement(el) {
    const keyToUse = el.dataset.deAriaKey?.toLowerCase() || el.textContent?.trim()?.[0]?.toLowerCase() || "?";
    const keyToUseLabel = (el.dataset.deAriaKeyLabel || keyToUse.toUpperCase());

    if (!el.dataset.deAriaKey) {
        console.warn(`Element ${el.tagName} is missing data-de-aria-key attribute, using "${keyToUse}" as fallback. Consider adding a specific key for better accessibility.`);
    }

    const randomId = Math.random().toString(36).slice(2);

    el.classList.add("de-aria-marked");
    el.setAttribute("data-de-aria-key-used", keyToUse);
    el.setAttribute("data-de-aria-next-key-to-trigger", keyToUse);
    el.setAttribute("data-de-aria-key-label-used", keyToUseLabel);
    el.setAttribute("data-de-aria-key-label-used-original", keyToUseLabel);
    el.setAttribute("data-de-aria-key-nest-used", "");
    el.setAttribute("data-de-aria-id", randomId);

    // these offset values can come in any unit (e.g. "10px", "1em", "5%") and should be applied as CSS variables in the stylesheet to position the key indicators accordingly
    const offsetX = el.dataset.deAriaOffsetX;
    const offsetY = el.dataset.deAriaOffsetY;

    // Determine writing direction so the indicator sits on the trailing edge of the element.
    const direction = getComputedStyle(el).direction === "rtl" ? "rtl" : "ltr";

    // Anchor the indicator to the element's bounding box. Using position:fixed so it overlays correctly
    // regardless of ancestor overflow/clipping. It is short-lived (cleared by hideAccessibility) so we
    // don't try to track scroll/resize updates.
    const rect = el.getBoundingClientRect();

    const indicator = document.createElement("span");
    indicator.className = `${el.dataset.deAriaIndicatorClass || ""} de-aria-key-indicator`.trim();
    indicator.setAttribute("aria-hidden", "true");
    indicator.dataset.deAriaIndicatorFor = randomId;
    indicator.dataset.deAriaDirection = direction;
    indicator.textContent = keyToUseLabel;

    const position = el.dataset.deAriaHorizontalAlignment || "end-inside";
    const positionV = el.dataset.deAriaVerticalAlignment || "top-inside";

    indicator.style.position = "fixed";
    if (positionV === "top-inside") {
        indicator.style.top = `${rect.top}px`;
    } else if (positionV === "top-outside") {
        indicator.style.bottom = `${window.innerHeight - rect.top}px`;
    } else if (positionV === "bottom-inside") {
        indicator.style.bottom = `${window.innerHeight - rect.bottom}px`;
    } else if (positionV === "bottom-outside") {
        indicator.style.top = `${rect.bottom}px`;
    }

    if (direction === "rtl") {
        if (position === "end-inside") {
            indicator.style.left = `${rect.left}px`;
        } else if (position === "end-outside") {
            indicator.style.right = `${window.innerWidth - rect.left}px`;
        } else if (position === "start-inside") {
            indicator.style.right = `${window.innerWidth - rect.right}px`;
        } else if (position === "start-outside") {
            indicator.style.left = `${rect.left + rect.width}px`;
        }
    } else {
        if (position === "end-inside") {
            indicator.style.right = `${window.innerWidth - rect.right}px`;
        } else if (position === "end-outside") {
            indicator.style.left = `${rect.right}px`;
        } else if (position === "start-inside") {
            indicator.style.left = `${rect.left}px`;
        } else if (position === "start-outside") {
            indicator.style.right = `${window.innerWidth - rect.left}px`;
        }
    }

    if (offsetX || offsetY) {
        indicator.style.transform = `translate(${offsetX || "0"}, ${offsetY || "0"})`;
    }

    document.body.appendChild(indicator);
}

/**
 * @param {HTMLElement} el 
 */
function triggerFocusableElement(el) {

    if (el.dataset.deAriaKeyNestUsed) {
        // If this element is part of a nested group, trigger the next element in the group instead of this one.
        const nextNestNumber = el.dataset.deAriaKeyNestUsed[0];
        const newNestNumber = el.dataset.deAriaKeyNestUsed.slice(1);

        el.dataset.deAriaKeyNestUsed = newNestNumber;
        el.dataset.deAriaNextKeyToTrigger = nextNestNumber;

        const indicator = document.querySelector(`.de-aria-key-indicator[data-de-aria-indicator-for="${el.dataset.deAriaId}"]`);
        if (indicator) {
            indicator.textContent = nextNestNumber + newNestNumber;
        }
        return true;
    }

    const action = el.dataset.deAriaAction || "default";

    if (action === "none") {
        return false;
    }

    if (action === "click" || action === "default" && isClickable(el)) {
        el.click();
        return false;
    }

    if (action === "focus" || action === "default" && isFocusInput(el)) {
        el.focus();
        return false;
    }

    if (action === "play" || action === "default" && isMedia(el)) {
        const media = /** @type {HTMLMediaElement} */ (el);
        if (media.paused) media.play();
        else media.pause();
        return false;
    }

    // Final fallback for "default" — just focus the element.
    el.focus();
    return false;
}

/**
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isClickable(el) {
    if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") return true;
    if (el.tagName === "A" || el.getAttribute("role") === "link") return true;
    if (el.tagName === "SUMMARY") return true;
    if (el.tagName === "INPUT") {
        const type = /** @type {HTMLInputElement} */ (el).type;
        return type === "checkbox" || type === "radio" || type === "submit" || type === "button" || type === "reset" || type === "image";
    }
    if (el.dataset.deAriaAction === "click") return true;
    return false;
}

/**
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isFocusInput(el) {
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.tagName === "IFRAME") return true;
    if (el.isContentEditable) return true;
    return false;
}

/**
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isMedia(el) {
    return el.tagName === "AUDIO" || el.tagName === "VIDEO";
}

/**
 * @param {HTMLElement} el 
 */
function markScrollerElement(el) {
    el.classList.add("de-aria-scroll-marked");

    // Reuse the existing overlay box if this element has already been marked, otherwise build it.
    /** @type {HTMLElement | null} */
    let box = getSpecificElementBySelector(document, ".de-aria-scroller");
    if (!box) {
        box = document.createElement("div");
        box.className = `${el.dataset.deAriaScrollerClass || ""} de-aria-scroller`.trim();
        box.setAttribute("aria-hidden", "true");
        box.style.position = "fixed";
        box.style.pointerEvents = "none";
        box.style.display = "grid";
        box.style.gridTemplateColumns = "1fr 1fr 1fr";
        box.style.gridTemplateRows = "1fr 1fr 1fr";
        box.style.placeItems = "center";

        const directions = /** @type {const} */ ([
            ["up", "▲", { row: "1", col: "2" }],
            ["down", "▼", { row: "3", col: "2" }],
            ["left", "◀", { row: "2", col: "1" }],
            ["right", "▶", { row: "2", col: "3" }],
        ]);

        for (const [name, glyph, pos] of directions) {
            const arrow = document.createElement("div");
            arrow.className = `de-aria-scroller-arrow de-aria-scroller-arrow-${name}`;
            arrow.textContent = glyph;
            arrow.style.gridRow = pos.row;
            arrow.style.gridColumn = pos.col;
            box.appendChild(arrow);
        }

        document.body.appendChild(box);
    }

    // Determine what is currently scrollable in each direction.
    const canUp = el.scrollTop > 0;
    const canDown = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    const canLeft = el.scrollLeft > 0;
    const canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;

    const hasVertical = canUp || canDown;
    const hasHorizontal = canLeft || canRight;

    // If nothing is scrollable in any direction, hide the box entirely.
    if (!hasVertical && !hasHorizontal) {
        box.style.display = "none";
        return;
    }

    // Collapse axes that have no scroll, so the box only shows the relevant axis.
    box.style.display = "grid";
    box.style.gridTemplateColumns = hasHorizontal ? "1fr 1fr 1fr" : "1fr";
    box.style.gridTemplateRows = hasVertical ? "1fr 1fr 1fr" : "1fr";

    // Centre the box over the scrollable area. Size is left to CSS (width/height/padding
    // on .de-aria-scroller, or on the user-supplied scroller class). We just anchor
    // the centre point and let CSS decide how big it is.
    const rect = el.getBoundingClientRect();
    box.style.left = `${rect.left + rect.width / 2}px`;
    box.style.top = `${rect.top + rect.height / 2}px`;
    box.style.transform = "translate(-50%, -50%)";

    // Toggle arrow visibility based on what is currently scrollable in each direction.
    /** @type {Record<string, { visible: boolean, row: string, col: string }>} */
    const layout = {
        up: { visible: canUp, row: "1", col: hasHorizontal ? "2" : "1" },
        down: { visible: canDown, row: hasVertical ? "3" : "1", col: hasHorizontal ? "2" : "1" },
        left: { visible: canLeft, row: hasVertical ? "2" : "1", col: "1" },
        right: { visible: canRight, row: hasVertical ? "2" : "1", col: hasHorizontal ? "3" : "1" },
    };
    for (const [name, info] of Object.entries(layout)) {
        const arrow = /** @type {HTMLElement | null} */ (
            box.querySelector(`.de-aria-scroller-arrow-${name}`)
        );
        if (!arrow) continue;
        // Use display:none for axis-collapsed arrows so they don't take grid space; visibility:hidden
        // for arrows on an active axis but currently not scrollable (keeps layout stable).
        const onActiveAxis = (name === "up" || name === "down") ? hasVertical : hasHorizontal;
        if (!onActiveAxis) {
            arrow.style.display = "none";
        } else {
            arrow.style.display = "";
            arrow.style.gridRow = info.row;
            arrow.style.gridColumn = info.col;
            arrow.style.visibility = info.visible ? "visible" : "hidden";
        }
    }
}

/**
 * @param {HTMLElement[]} preventHidingElements 
 */
function hideFocusableElements(preventHidingElements = []) {
    getAllElementsListBySelector(document, ".de-aria-marked").forEach(el => {
        if (preventHidingElements.includes(el)) return;

        const indicator = document.querySelector(`.de-aria-key-indicator[data-de-aria-indicator-for="${el.dataset.deAriaId}"]`);
        if (indicator) indicator.remove();

        el.classList.remove("de-aria-marked");
        el.removeAttribute("data-de-aria-key-used");
        el.removeAttribute("data-de-aria-next-key-to-trigger");
        el.removeAttribute("data-de-aria-key-label-used");
        el.removeAttribute("data-de-aria-key-label-used-original");
        el.removeAttribute("data-de-aria-key-nest-used");
        el.removeAttribute("data-de-aria-id");
    });
    removeOrphanedIndicators();
}

export function removeOrphanedIndicators() {
    // In case some indicators are left orphaned (e.g. by a hot reload during development), remove them.
    getAllElementsListBySelector(document, ".de-aria-key-indicator").forEach(indicator => {
        const forId = indicator.dataset.deAriaIndicatorFor;
        if (!forId || !document.querySelector(`[data-de-aria-id="${forId}"]`)) {
            indicator.remove();
        }
    });
}

function hideScroller() {
    getAllElementsListBySelector(document, ".de-aria-scroller").forEach(el => el.remove());
    getAllElementsListBySelector(document, ".de-aria-scroll-marked").forEach(el => el.classList.remove("de-aria-scroll-marked"));
}

/**
 * @param {HTMLElement[]} preventHidingElements 
 */
function hideAccessibility(preventHidingElements = []) {
    hideFocusableElements(preventHidingElements);
    if (preventHidingElements.length === 0) {
        hideScroller();
    }
}

/**
 * Tracks rAF watchers per scroller element so multiple scrollElement calls
 * (e.g. arrow key auto-repeat) don't create duplicate polling loops, and so
 * we don't rely on the flaky `scrollend` event with smooth scrolling.
 * @type {WeakMap<HTMLElement, number>}
 */
const SCROLLER_WATCH_FRAMES = new WeakMap();

/**
 * @param {HTMLElement} el 
 * @param {"ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"} direction 
 */
function scrollElement(el, direction) {
    hideFocusableElements();
    el.scrollBy({
        top: direction === "ArrowDown" ? 100 : direction === "ArrowUp" ? -100 : 0,
        left: direction === "ArrowRight" ? 100 : direction === "ArrowLeft" ? -100 : 0,
        behavior: "smooth",
    });

    // Cancel any prior watcher so we don't have multiple polling loops fighting.
    const existing = SCROLLER_WATCH_FRAMES.get(el);
    if (existing) cancelAnimationFrame(existing);

    // Poll with rAF until the scroll position stops changing for a few frames.
    // This is robust against interrupted smooth scrolls where `scrollend` is
    // unreliable across browsers.
    let lastTop = el.scrollTop;
    let lastLeft = el.scrollLeft;
    let stableFrames = 0;
    const STABLE_FRAMES_NEEDED = 3;

    const tick = () => {
        // Re-mark every frame so the box reflects current scrollability in real time.
        markScrollerElement(el);

        const currentTop = el.scrollTop;
        const currentLeft = el.scrollLeft;
        if (currentTop === lastTop && currentLeft === lastLeft) {
            stableFrames++;
        } else {
            stableFrames = 0;
            lastTop = currentTop;
            lastLeft = currentLeft;
        }

        if (stableFrames >= STABLE_FRAMES_NEEDED) {
            SCROLLER_WATCH_FRAMES.delete(el);
            return;
        }

        SCROLLER_WATCH_FRAMES.set(el, requestAnimationFrame(tick));
    };
    SCROLLER_WATCH_FRAMES.set(el, requestAnimationFrame(tick));
}

document.addEventListener("DOMContentLoaded", () => {

    let lastKeyDownAccessibilityVisible = false;
    /**
     * @type {string | null}
     */
    let lastKeyDown = null;

    const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

    document.addEventListener("keydown", (e) => {
        const isAccessibilityVisible = getSpecificElementBySelector(document, ".de-aria-key-indicator") !== null || getSpecificElementBySelector(document, ".de-aria-scroll-marked") !== null;
        if (e.key === "Control") {
            makeShadowRootsAdoptAccessibilityStyles(figureConstructedSheets(), document);
        }

        lastKeyDownAccessibilityVisible = isAccessibilityVisible;
        lastKeyDown = e.key;

        const currentlyFocused = document.activeElement;

        // get all the html elements that have the attribute data-de-aria-key-used equal to the pressed key
        const matchingElements = getAllElementsListBySelector(document, `[data-de-aria-next-key-to-trigger="${e.key.toLowerCase()}"]`);

        let accessibilityContinuesIntoNested = false;
        if (matchingElements) {
            for (const el of matchingElements) {
                const continueAccesibilityEffect = triggerFocusableElement(el);
                if (continueAccesibilityEffect) {
                    accessibilityContinuesIntoNested = true;
                }
            }
        }

        if (!arrowKeys.has(e.key)) {
            hideAccessibility(accessibilityContinuesIntoNested ? matchingElements : []);
        }

        const currentScroller = getSpecificElementBySelector(document, ".de-aria-scroll-marked");
        if (arrowKeys.has(e.key) && currentScroller) {
            // @ts-ignore
            scrollElement(currentScroller, e.key);
        }

        if (
            currentlyFocused &&
            (e.key === "Enter" || e.key === " ") &&
            // @ts-ignore
            isClickable(currentlyFocused)
        ) {
            // @ts-ignore
            currentlyFocused.click();
        }
    });

    document.addEventListener("keyup", (e) => {
        if (lastKeyDown === "Control" && !lastKeyDownAccessibilityVisible) {
            showAccessibility();
        }
    });

    const mouseHideEvents = ["mousedown", "mouseup", "click", "contextmenu", "wheel", "pointerdown", "pointerup"];
    for (const event of mouseHideEvents) {
        document.addEventListener(event, hideAccessibility.bind(null, []), { passive: true });
    }
});

/**
 * @type {Record<string, CSSStyleSheet>}
 */
const CONSTRUCTED_SHEETS = {};
function figureConstructedSheets() {
    const sheets = Array.from(document.querySelectorAll("[data-de-aria-stylesheet=\"true\"]")).map(el => {
        // @ts-ignore
        return el.sheet;
    }).filter(sheet => sheet) /** @type {CSSStyleSheet[]} */;

    const finalSheets = [];
    for (const sheet of sheets) {
        if (!CONSTRUCTED_SHEETS[sheet.href]) {
            const constructedSheet = new CSSStyleSheet();
            const css = Array.from(sheet.cssRules)
                .map(rule => rule.cssText)
                .join('\n');
            constructedSheet.replaceSync(css);
            CONSTRUCTED_SHEETS[sheet.href] = constructedSheet;
        }
        finalSheets.push(CONSTRUCTED_SHEETS[sheet.href]);
    }

    return finalSheets;
}

/**
 * @param {CSSStyleSheet[]} sheets
 * @param {any} root 
 */
function makeShadowRootsAdoptAccessibilityStyles(sheets, root) {
    const elementsWithShadowRoots = root.querySelectorAll("*");
    for (const el of elementsWithShadowRoots) {
        if (el.shadowRoot || el.root) {
            const shadow = el.shadowRoot || el.root;
            for (const sheet of sheets) {
                if (shadow.adoptedStyleSheets && !shadow.adoptedStyleSheets.includes(sheet)) {
                    // @ts-ignore
                    shadow.adoptedStyleSheets = [...(shadow.adoptedStyleSheets || []), sheet];
                }
            }
            makeShadowRootsAdoptAccessibilityStyles(sheets, shadow);
        }
    }
}