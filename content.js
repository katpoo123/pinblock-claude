// Selector for Pinterest feed tiles — stable across class name changes.
const TILE_SELECTOR = 'div[data-grid-item="true"][role="listitem"]';

// Attribute we stamp on a tile only after it has been hidden,
// so we never re-process already-hidden tiles.
const HIDDEN_ATTR = 'data-pinhider-hidden';

// ─── Detection helpers ────────────────────────────────────────────────────────

function isSponsoredTile(tile) {
  // Attribute-based checks (fastest, most reliable).
  if (tile.querySelector('[aria-label="Sponsored"]')) return true;
  if (tile.querySelector('[title="Sponsored"]')) return true;

  // Fallback: walk every text node inside the tile looking for exact "Sponsored" match.
  // Only used when neither attribute is present.
  const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue.trim() === 'Sponsored') return true;
  }

  return false;
}

function isShoppableProductTile(tile) {
  if (tile.querySelector('[data-test-id="pincard-product-with-link"]')) return true;
  if (tile.querySelector('[aria-label="Shoppable Pin indicator"]')) return true;
  if (tile.querySelector('[data-test-id="shopping-icon"]')) return true;
  return false;
}

// ─── Reason ───────────────────────────────────────────────────────────────────

// Returns "sponsored", "shoppable", or null.
function getHideReason(tile) {
  if (isSponsoredTile(tile)) return 'sponsored';
  if (isShoppableProductTile(tile)) return 'shoppable';
  return null;
}

// ─── Hiding ───────────────────────────────────────────────────────────────────

function hideTile(tile, reason) {
  // Stamp before touching styles so a racing observer doesn't double-process.
  tile.setAttribute(HIDDEN_ATTR, reason);

  tile.style.setProperty('display',        'none',   'important');
  tile.style.setProperty('visibility',     'hidden', 'important');
  tile.style.setProperty('pointer-events', 'none',   'important');
  tile.style.setProperty('height',         '0',      'important');
  tile.style.setProperty('min-height',     '0',      'important');
  tile.style.setProperty('margin',         '0',      'important');
  tile.style.setProperty('padding',        '0',      'important');

  console.log(`[PinHider] Hiding ${reason} tile`, tile);
}

// ─── Per-tile processor ───────────────────────────────────────────────────────

function processTile(tile) {
  // Skip tiles we've already hidden.
  if (tile.hasAttribute(HIDDEN_ATTR)) return;

  const reason = getHideReason(tile);
  if (reason) hideTile(tile, reason);

  // Intentionally do NOT mark visible tiles — Pinterest may attach
  // sponsored/shopping markers after the initial render, so every
  // scan must re-evaluate non-hidden tiles.
}

// ─── Bulk scanner ─────────────────────────────────────────────────────────────

function processAllTiles(root) {
  // root defaults to document when called by setTimeout/setInterval
  // (they pass the timeout ID as the first arg, so we normalise here).
  const searchRoot = (root instanceof Node) ? root : document;
  searchRoot.querySelectorAll(TILE_SELECTOR).forEach(processTile);
}

// ─── MutationObserver ─────────────────────────────────────────────────────────

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const addedNode of mutation.addedNodes) {
      if (addedNode.nodeType !== Node.ELEMENT_NODE) continue;

      // 1. The added node itself might be a tile.
      if (addedNode.matches(TILE_SELECTOR)) {
        processTile(addedNode);
      }

      // 2. Climb from the added node to the nearest ancestor tile —
      //    catches attribute mutations injected inside an existing tile.
      const parentTile = addedNode.closest(TILE_SELECTOR);
      if (parentTile) processTile(parentTile);

      // 3. Scan any tiles nested inside the added subtree
      //    (e.g., a whole new grid section dropped in by infinite scroll).
      addedNode.querySelectorAll?.(TILE_SELECTOR).forEach(processTile);
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree:   true,
});

// ─── Rescans ──────────────────────────────────────────────────────────────────
// Pinterest renders content asynchronously; these cover tiles that load
// after the observer starts but before their markers are attached.

setTimeout(processAllTiles,  500);
setTimeout(processAllTiles, 1500);
setTimeout(processAllTiles, 3000);
setInterval(processAllTiles, 2000);

// Initial pass for anything already in the DOM.
processAllTiles();
