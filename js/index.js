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
    if (typeof el.tabIndex === "number" && el.tabIndex < 0) return false;

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

    // offsetParent === null catches elements detached from layout (also covers display:none ancestors).
    // @ts-ignore
    if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return false;

    return true;
}

function showAccessibility() {
    const focusable = Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter(isAccessible);

    const scroller = Array.from(document.querySelectorAll('[data-de-role="scroller"]'))
        .find(isAccessible) || null;

    for (const el of focusable) {
        // @ts-ignore
        markFocusableElement(el);
    }

    if (scroller) {
        // @ts-ignore
        markScrollerElement(scroller);
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

    const alreadyExistingKey = document.querySelector(`[data-de-aria-key-used="${keyToUse}"]`);
    if (alreadyExistingKey && alreadyExistingKey !== el) {
        console.error(`Duplicate data-de-aria-key "${keyToUse}" found on element ${el.tagName}. One of them will not be accessible. Consider assigning unique keys to each element.`);
    }

    el.classList.add("de-aria-marked");
    el.setAttribute("data-de-aria-key-used", keyToUse);
    el.setAttribute("data-de-aria-key-label-used", keyToUseLabel);

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
    indicator.dataset.deAriaIndicatorFor = keyToUse;
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
    const action = el.dataset.deAriaAction || "default";

    if (action === "none") {
        return;
    }

    if (action === "click" || action === "default" && isClickable(el)) {
        el.click();
        return;
    }

    if (action === "focus" || action === "default" && isFocusInput(el)) {
        el.focus();
        return;
    }

    if (action === "play" || action === "default" && isMedia(el)) {
        const media = /** @type {HTMLMediaElement} */ (el);
        if (media.paused) media.play();
        else media.pause();
        return;
    }

    // Final fallback for "default" — just focus the element.
    el.focus();
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
    let box = document.querySelector(".de-aria-scroller");
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

    // Position over the centre of the scrollable area. Square when both axes scroll,
    // otherwise a thin strip along the scrollable axis.
    const rect = el.getBoundingClientRect();
    const baseSize = Math.min(rect.width, rect.height) * 0.4;
    const thickness = baseSize * 0.4;
    const width = hasHorizontal ? baseSize : thickness;
    const height = hasVertical ? baseSize : thickness;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.style.left = `${rect.left + rect.width / 2 - width / 2}px`;
    box.style.top = `${rect.top + rect.height / 2 - height / 2}px`;

    // Toggle arrow visibility based on what is currently scrollable in each direction.
    /** @type {Record<string, { visible: boolean, row: string, col: string }>} */
    const layout = {
        up:    { visible: canUp,    row: "1", col: hasHorizontal ? "2" : "1" },
        down:  { visible: canDown,  row: hasVertical ? "3" : "1", col: hasHorizontal ? "2" : "1" },
        left:  { visible: canLeft,  row: hasVertical ? "2" : "1", col: "1" },
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

function hideFocusableElements() {
    document.querySelectorAll(".de-aria-key-indicator").forEach(el => el.remove());
    document.querySelectorAll(".de-aria-marked").forEach(el => {
        el.classList.remove("de-aria-marked");
        el.removeAttribute("data-de-aria-key-used");
        el.removeAttribute("data-de-aria-key-label-used");
    });
}

function hideScroller() {
    document.querySelectorAll(".de-aria-scroller").forEach(el => el.remove());
    document.querySelectorAll(".de-aria-scroll-marked").forEach(el => el.classList.remove("de-aria-scroll-marked"));
}

function hideAccessibility() {
    hideFocusableElements();
    hideScroller();
}

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

    if ("onscrollend" in el) {
        el.addEventListener("scrollend", () => markScrollerElement(el), { once: true });
    } else {
        // Fallback for browsers without scrollend: debounce the scroll event.
        /** @type {ReturnType<typeof setTimeout>} */
        let timer;
        const onScroll = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                // @ts-ignore
                el.removeEventListener("scroll", onScroll);
                markScrollerElement(el);
            }, 100);
        };
        // @ts-ignore
        el.addEventListener("scroll", onScroll);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    let ctrlCombo = false;

    const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Control") {
            ctrlCombo = false;
        } else if (e.ctrlKey) {
            ctrlCombo = true;
        }

        const currentlyFocused = document.activeElement;

        // get all the html elements that have the attribute data-de-aria-key-used equal to the pressed key
        const matchingElement = document.querySelector(`[data-de-aria-key-used="${e.key.toLowerCase()}"]`);
        if (!arrowKeys.has(e.key)) {
            hideAccessibility();
        }

        const currentScroller = document.querySelector(".de-aria-scroll-marked");
        if (arrowKeys.has(e.key) && currentScroller) {
            // @ts-ignore
            scrollElement(currentScroller, e.key);
        }

        if (matchingElement) {
            // @ts-ignore
            triggerFocusableElement(matchingElement);
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
        if (e.key === "Control" && !ctrlCombo) {
            showAccessibility();
        }
    });

    const mouseHideEvents = ["mousedown", "mouseup", "click", "contextmenu", "wheel", "pointerdown", "pointerup"];
    for (const event of mouseHideEvents) {
        document.addEventListener(event, hideAccessibility, { passive: true });
    }
});