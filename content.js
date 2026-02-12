// Smart Dark Mode - Content Script

let isEnabled = true;
let currentMode = 'dark';
let processedElements = new WeakSet();

// Initialize
chrome.storage.sync.get(['enabled', 'mode'], (result) => {
    isEnabled = result.enabled !== false;
    currentMode = result.mode || 'dark';
    if (isEnabled) {
        initDarkMode();
    }
});

// Listen for toggle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggle") {
        isEnabled = request.enabled;
        if (request.mode) currentMode = request.mode;

        if (isEnabled) {
            console.log(`Adaptive Theme: Enabled (${currentMode}) via toggle.`);
            // If checking mode change, might need to re-process differently or reload.
            // For now, reload is safest to clear previous theme.
            // Ideally we should just re-run if enable, but if mode CHANGED we need to clear first.
            processedElements = new WeakSet();
            location.reload();
        } else {
            console.log("Adaptive Theme: Disabled. Reloading...");
            location.reload();
        }
    } else if (request.action === "force_process") {
        console.log("Adaptive Theme: Force processing triggered.");
        if (request.mode) currentMode = request.mode;

        // Revert previously inverted elements to ensure a clean slate
        const invertedElements = document.querySelectorAll('[data-smart-dark-inverted]');
        invertedElements.forEach(el => {
            el.style.removeProperty('background-color');
            el.style.removeProperty('color');
            el.style.removeProperty('border-color');
            delete el.dataset.smartDarkInverted;
        });

        processedElements = new WeakSet(); // Reset processed cache
        initDarkMode();

        // Optional: User Feedback
        // alert("Page re-processed!");
    }
});

function initDarkMode() {
    console.log(`Adaptive Theme: Initializing (${currentMode})...`);

    // Try to catch the body early
    if (document.body) {
        processNode(document.body);
    } else {
        window.addEventListener('DOMContentLoaded', () => processNode(document.body));
    }

    // Observer for dynamic content
    const observer = new MutationObserver((mutations) => {
        if (!isEnabled) return;
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    processNode(node);
                }
            });
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

function processNode(rootElement) {
    const walker = document.createTreeWalker(
        rootElement,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
    );

    let node = walker.nextNode();
    while (node) {
        if (currentMode === 'light') {
            applyLightMode(node);
        } else {
            applySmartDarkMode(node);
        }
        node = walker.nextNode();
    }
    // Also process the root itself
    if (rootElement.nodeType === 1) {
        if (currentMode === 'light') {
            applyLightMode(rootElement);
        } else {
            applySmartDarkMode(rootElement);
        }
    }
}

function applySmartDarkMode(element) {
    if (processedElements.has(element)) return;

    // Skip excluded elements
    const tagName = element.tagName.toLowerCase();
    if (['img', 'video', 'canvas', 'svg', 'iframe'].includes(tagName)) return;

    // Check for inline styles or computed styles
    const style = window.getComputedStyle(element);

    // Background Color
    const bgColor = parseColor(style.backgroundColor);
    if (bgColor && bgColor.a > 0) {
        const bgHsl = rgbToHsl(bgColor.r, bgColor.g, bgColor.b);

        // If background is light (L > 0.5), darken it
        if (bgHsl.l > 0.5) {
            // Invert Lightness: 0=black, 1=white. 
            // We want to map high L (0.5-1.0) to low L (0-0.5)
            let newL = 1 - bgHsl.l;
            // Ensure it doesn't get TOO bright if it was black? No, we are darkening LIGHT backgrounds.
            // If original was White (1.0), new is 0.0. 
            // Let's clam newL to be at most 0.2 for backgrounds to keep it dark.
            // mapping 0.5 -> 0.5
            // mapping 1.0 -> 0.0

            // Boost dark slightly to avoid pure black if desired, or keep pure mapping
            // Let's ensure it's not too washed out. 
            // If original was pure white (1.0), new is 0.0 (black).

            // Keep hue/saturation (Preserve Color)
            // If saturation is low (grayscale), just invert L
            // If saturation is high (colorful bg), keep S

            element.style.setProperty('background-color', `hsl(${bgHsl.h * 360}, ${bgHsl.s * 100}%, ${newL * 100}%)`, 'important');
            element.dataset.smartDarkInverted = 'true'; // Mark as inverted
        }
    } else if (tagName === 'html' || tagName === 'body') {
        // Force dark background if transparent on root
        // Check if actually transparent
        if (!bgColor || bgColor.a === 0) {
            element.style.setProperty('background-color', '#121212', 'important');
            element.dataset.smartDarkInverted = 'true';
        }
    }

    // Text Color
    const color = parseColor(style.color);
    if (color && color.a > 0) {
        const textHsl = rgbToHsl(color.r, color.g, color.b);

        // If text is dark (L < 50%), lighten it
        if (textHsl.l < 0.5) {
            let newL = 1 - textHsl.l;
            // Boost readability? If newL is < 0.7, maybe boost to 0.9?
            if (newL < 0.7) newL = 0.9;

            // Ensure contrast?
            // If we just inverted background, we likely inverted text too implicitly by logic? 
            // No, we process them independently based on their OWN values.
            // If background was white -> became black.
            // Text was black -> becomes white.
            // Text was Red (Dark Red) -> becomes Light Red.

            element.style.setProperty('color', `hsl(${textHsl.h * 360}, ${textHsl.s * 100}%, ${newL * 100}%)`, 'important');
            element.dataset.smartDarkInverted = 'true';
        }
    }

    processedElements.add(element);
}

function applyLightMode(element) {
    if (processedElements.has(element)) return;

    const tagName = element.tagName.toLowerCase();
    if (['img', 'video', 'canvas', 'svg', 'iframe'].includes(tagName)) return;

    const style = window.getComputedStyle(element);

    // Background Color
    const bgColor = parseColor(style.backgroundColor);
    if (bgColor && bgColor.a > 0) {
        const bgHsl = rgbToHsl(bgColor.r, bgColor.g, bgColor.b);

        // If background is DARK (L < 0.5), lighten it
        if (bgHsl.l < 0.5) {
            let newL = 1 - bgHsl.l;
            // Mapping 0.0 -> 1.0

            // Check if it's a colorful background (high saturation)
            // If Saturation is high, we keep it but lighten.

            element.style.setProperty('background-color', `hsl(${bgHsl.h * 360}, ${bgHsl.s * 100}%, ${newL * 100}%)`, 'important');
            element.dataset.smartDarkInverted = 'true';
        }
    } else if (tagName === 'html' || tagName === 'body') {
        // Force light background if transparent on root
        if (!bgColor || bgColor.a === 0) {
            element.style.setProperty('background-color', '#ffffff', 'important');
            element.dataset.smartDarkInverted = 'true';
        }
    }

    // Text Color
    const color = parseColor(style.color);
    if (color && color.a > 0) {
        const textHsl = rgbToHsl(color.r, color.g, color.b);

        // If text is LIGHT (L > 0.5), darken it
        if (textHsl.l > 0.5) {
            let newL = 1 - textHsl.l;
            // Boost readability? If newL > 0.3, maybe darken more?
            if (newL > 0.2) newL = 0.1;

            element.style.setProperty('color', `hsl(${textHsl.h * 360}, ${textHsl.s * 100}%, ${newL * 100}%)`, 'important');
            element.dataset.smartDarkInverted = 'true';
        }
    }

    processedElements.add(element);
}

// Helpers

function parseColor(colorString) {
    if (!colorString) return null;
    const rgba = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgba) {
        return {
            r: parseInt(rgba[1]),
            g: parseInt(rgba[2]),
            b: parseInt(rgba[3]),
            a: rgba[4] !== undefined ? parseFloat(rgba[4]) : 1
        };
    }
    return null;
}

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 */
function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h, s, l };
}
