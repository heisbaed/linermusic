// Cine Music — 10-Foot TV Spatial Navigation Engine
// Geometric nearest-element routing, focus memory per shelf, screen-transition focus,
// D-pad/back handling for Android TV WebView. 100% remote operable.

import type { NativeApi } from './types';

declare global {
  interface Window {
    __cineTvKey?: (key: string) => boolean;
    CineAndroid?: NativeApi;
  }
}

export function isTvEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.CineAndroid?.isTv?.()) return true;
  if (window.location?.search?.includes('tv=1')) return true;
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent.toLowerCase();
  return (
    ua.includes('android tv') ||
    ua.includes('smart-tv') ||
    ua.includes('smarttv') ||
    ua.includes('googletv') ||
    ua.includes('aft') ||
    ua.includes('crkey') ||
    ua.includes('large screen')
  );
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
  '[data-tv-focusable="true"]',
].join(', ');

// Focus memory per shelf/container (Spotify-style). Keyed by data-tv-shelf-id.
const shelfMemory = new Map<string, string>();

function elementKey(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  const shelf = el.closest<HTMLElement>('[data-tv-shelf-id]');
  const shelfId = shelf?.dataset.tvShelfId || '';
  const label = el.getAttribute('aria-label') || el.dataset.tvKey || el.textContent?.trim().slice(0, 48) || '';
  return `${shelfId}::${el.tagName}:${label}`;
}

function rememberFocus(el: HTMLElement) {
  const shelf = el.closest<HTMLElement>('[data-tv-shelf-id]');
  if (!shelf?.dataset.tvShelfId) return;
  shelfMemory.set(shelf.dataset.tvShelfId, elementKey(el));
  shelf.dataset.tvLastFocus = elementKey(el);
}

export function restoreShelfFocus(shelfId: string): HTMLElement | null {
  const key = shelfMemory.get(shelfId);
  if (!key) return null;
  const shelf = document.querySelector<HTMLElement>(`[data-tv-shelf-id="${CSS.escape(shelfId)}"]`);
  if (!shelf) return null;
  const candidates = Array.from(shelf.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isElementVisible);
  return candidates.find(c => elementKey(c) === key) || candidates[0] || null;
}

function isElementVisible(el: HTMLElement): boolean {
  if (!el?.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  if (el.closest('[aria-hidden="true"], [inert], .is-hidden, [hidden]')) return false;
  return true;
}

export function getFocusableElements(root: ParentNode = document): HTMLElement[] {
  const elements = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return elements.filter(isElementVisible);
}

export function applyTvFocusClass(el: HTMLElement) {
  document.querySelectorAll('.tv-focused').forEach(e => {
    if (e !== el) e.classList.remove('tv-focused');
  });
  el.classList.add('tv-focused');
}

export function focusElement(el: HTMLElement | null, opts?: { scroll?: ScrollLogicalPosition; preventScroll?: boolean }) {
  if (!el) return false;
  const prevent = opts?.preventScroll ?? false;
  try { el.focus({ preventScroll: prevent }); } catch { el.focus(); }
  if (!prevent) el.scrollIntoView({ behavior: 'instant', block: opts?.scroll ?? 'nearest', inline: 'nearest' });
  applyTvFocusClass(el);
  rememberFocus(el);
  return true;
}

export function ensureTvFocus(preferred?: HTMLElement | null): HTMLElement | null {
  const candidates = getFocusableElements();
  if (!candidates.length) return null;

  const current = document.activeElement as HTMLElement | null;
  if (current && candidates.includes(current) && current !== document.body) {
    applyTvFocusClass(current);
    rememberFocus(current);
    return current;
  }

  const priority =
    (preferred && candidates.includes(preferred) ? preferred : null) ||
    candidates.find(el => el.hasAttribute('data-tv-autofocus') || el.hasAttribute('data-tv-focus-priority') || el.hasAttribute('autofocus')) ||
    // Prefer main content over rail on screen transitions when both visible.
    candidates.find(el => !!el.closest('.tv-main, .tv-player-left, .tv-pair-screen')) ||
    candidates[0];
  focusElement(priority);
  return priority;
}

// Called by screens/shell after route/view transitions to auto-focus first actionable item.
export function focusFirstActionable(root?: ParentNode | null) {
  const scope = root || document.querySelector('.tv-main, .tv-player, .tv-pair-screen, .tv-auth-gate') || document;
  const candidates = getFocusableElements(scope);
  const target =
    candidates.find(el => el.hasAttribute('data-tv-autofocus')) ||
    candidates.find(el => el.closest('.tv-hero-actions, .tv-hero-content')) ||
    candidates[0];
  if (target) {
    focusElement(target, { preventScroll: true });
    target.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
  }
  return target || null;
}

type Direction = 'up' | 'down' | 'left' | 'right';

function rectOf(el: HTMLElement) { return el.getBoundingClientRect(); }
function center(r: DOMRect) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

export function navigateSpatial(direction: Direction): boolean {
  const candidates = getFocusableElements();
  if (!candidates.length) return false;

  const current = document.activeElement as HTMLElement | null;
  if (!current || !candidates.includes(current) || current === document.body) {
    ensureTvFocus();
    return true;
  }

  const cur = rectOf(current);
  const cc = center(cur);

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    if (candidate === current) continue;
    const r = rectOf(candidate);
    const c = center(r);
    const dx = c.x - cc.x;
    const dy = c.y - cc.y;

    let primary = 0;
    let perp = 0;
    let ok = false;
    const overlapTolerance = 8;

    switch (direction) {
      case 'up':
        if (r.bottom <= cur.top + overlapTolerance) { primary = cur.top - r.bottom; perp = Math.abs(dx); ok = true; }
        break;
      case 'down':
        if (r.top >= cur.bottom - overlapTolerance) { primary = r.top - cur.bottom; perp = Math.abs(dx); ok = true; }
        break;
      case 'left':
        if (r.right <= cur.left + overlapTolerance) { primary = cur.left - r.right; perp = Math.abs(dy); ok = true; }
        break;
      case 'right':
        if (r.left >= cur.right - overlapTolerance) { primary = r.left - cur.right; perp = Math.abs(dy); ok = true; }
        break;
    }
    if (!ok) continue;

    // Favor candidates in the same shelf/row/column context.
    const sameShelf = current.closest('[data-tv-shelf-id]') && current.closest('[data-tv-shelf-id]') === candidate.closest('[data-tv-shelf-id]');
    const railToContent = !!current.closest('.tv-sidebar') !== !!candidate.closest('.tv-sidebar');
    const crossAxisWeight = sameShelf ? 1.4 : 2.4;
    let score = Math.max(0, primary) * 1.0 + perp * crossAxisWeight;
    if (railToContent && (direction === 'left' || direction === 'right')) score *= 0.82; // make rail/content transitions reliable
    if (sameShelf) score *= 0.92;

    if (score < bestScore) { bestScore = score; best = candidate; }
  }

  if (best) {
    focusElement(best);
    return true;
  }

  // Fallback: when moving right from rail into content, pick first content focusable.
  if (direction === 'right' && current.closest('.tv-header')) {
    const contentFirst = getFocusableElements(document.querySelector('.tv-main') || document)[0];
    if (contentFirst) { focusElement(contentFirst); return true; }
  }
  // Fallback: moving left from content, focus active rail item.
  if (direction === 'left' && current.closest('.tv-main')) {
    const railActive = document.querySelector<HTMLElement>('.tv-nav-item[aria-current=page], .tv-nav-item');
    if (railActive) { focusElement(railActive); return true; }
  }
  return false;
}

function focusRail(): boolean {
  const active = document.querySelector<HTMLElement>('.tv-nav-item[aria-current=page], .tv-nav-item');
  return !!(active && focusElement(active));
}

function hasOpenOverlay(): boolean {
  return !!document.querySelector('.tv-player[role="dialog"], .modal-scrim:not([hidden]), .sheet-backdrop, [role="dialog"][aria-modal="true"]');
}

export function handleTvKey(key: string): boolean {
  if (!window.dispatchEvent(new Event('cine:tv-input', { cancelable: true }))) return true;
  const active = document.activeElement as HTMLElement | null;
  if ((key === 'left' || key === 'right') && active?.getAttribute('role') === 'slider') {
    active.dispatchEvent(new CustomEvent('cine:seek', { detail: key === 'left' ? -10000 : 10000 }));
    return true;
  }
  switch (key) {
    case 'up':
    case 'down':
    case 'left':
    case 'right':
      return navigateSpatial(key);
    case 'enter': {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body) active.click();
      else ensureTvFocus();
      return true;
    }
    case 'back':
      if (!window.dispatchEvent(new Event('cine:back', { cancelable: true }))) return true;
      if (document.activeElement?.closest('.tv-main')) return focusRail();
      return false;
    case 'play_pause':
    case 'play':
    case 'pause':
    case 'next':
    case 'previous':
      window.dispatchEvent(new CustomEvent('cine:remote-transport', { detail: { action: key } }));
      return true;
    default:
      return false;
  }
}

let initialized = false;

export function initTvSpatialNav(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  if (isTvEnvironment()) {
    document.documentElement.classList.add('is-tv');
    document.body.classList.add('is-tv');
  }

  window.__cineTvKey = (key: string) => handleTvKey(key);

  window.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!document.body.classList.contains('is-tv')) return;
    const active = document.activeElement as HTMLElement | null;
    const inField = !!active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);

    if (event.key === 'ArrowUp') { event.preventDefault(); handleTvKey('up'); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); handleTvKey('down'); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); handleTvKey('left'); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); handleTvKey('right'); }
    else if (event.key === 'Enter') {
      if (inField) return;
      event.preventDefault(); handleTvKey('enter');
    } else if (event.key === 'Escape' || (event.key === 'Backspace' && !inField)) {
      if (inField && event.key === 'Escape') { /* let field/app decide */ }
      else { event.preventDefault(); handleTvKey('back'); }
    }
  }, true);

  window.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement;
    if (el && el !== document.body) { applyTvFocusClass(el); rememberFocus(el); }
  }, true);

  const observer = new MutationObserver(() => {
    if (!document.body.classList.contains('is-tv')) return;
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || !isElementVisible(active)) ensureTvFocus();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'inert', 'aria-hidden'] });

  const kick = () => ensureTvFocus();
  window.addEventListener('DOMContentLoaded', kick);
  setTimeout(kick, 120);
  setTimeout(kick, 500);
}
