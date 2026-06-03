/**
 * HTML Microdata extraction (`itemscope` / `itemtype` / `itemprop`).
 *
 * Each `itemscope` element starts a new item; its `itemtype` gives the schema.org type and
 * its descendant `itemprop` elements supply properties. A nested `itemscope` becomes a
 * nested item object (so e.g. `Product > Offer` or `FAQPage > Question > acceptedAnswer`
 * round-trips for validation). Property values come from element-type-specific attributes
 * per the WHATWG microdata value algorithm.
 */
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import type { StructuredDataItem } from '@aeo/types';
import { normalizeTypes } from './types-map.js';
import { finalizeItem } from './validation.js';

type ItemObject = Record<string, unknown>;

/** Resolve the value of an `itemprop` element per the microdata value rules. */
function propertyValue($: CheerioAPI, el: Element): string {
  const $el = $(el);
  const tag = (el.tagName ?? '').toLowerCase();

  const fromAttr = (attr: string): string | undefined => {
    const v = $el.attr(attr);
    return v !== undefined ? v.trim() : undefined;
  };

  switch (tag) {
    case 'meta':
      return fromAttr('content') ?? '';
    case 'audio':
    case 'embed':
    case 'iframe':
    case 'img':
    case 'source':
    case 'track':
    case 'video':
      return fromAttr('src') ?? '';
    case 'a':
    case 'area':
    case 'link':
      return fromAttr('href') ?? '';
    case 'object':
      return fromAttr('data') ?? '';
    case 'data':
    case 'meter':
      return fromAttr('value') ?? '';
    case 'time': {
      const dt = fromAttr('datetime');
      return dt ?? $el.text().trim();
    }
    default:
      return $el.text().trim();
  }
}

/** Append a value under a property name, promoting to an array when a key repeats. */
function addProperty(target: ItemObject, name: string, value: unknown): void {
  const existing = target[name];
  if (existing === undefined) {
    target[name] = value;
  } else if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    target[name] = [existing, value];
  }
}

/**
 * Find the direct `itemprop` descendants of a scope: elements with `itemprop` that are not
 * themselves contained within a deeper `itemscope` inside this scope. This keeps nested
 * items' properties attached to the nested item, not the parent.
 */
function directProps($: CheerioAPI, scope: Cheerio<Element>): Element[] {
  const scopeEl = scope.get(0);
  const result: Element[] = [];
  scope.find('[itemprop]').each((_i, el) => {
    // Walk up to the nearest ancestor itemscope; if it is this scope, the prop belongs here.
    let parent = el.parent;
    while (parent !== null && parent !== undefined && 'tagName' in parent) {
      const pe = parent as Element;
      if (pe === scopeEl) {
        result.push(el);
        return;
      }
      if ($(pe).attr('itemscope') !== undefined) {
        // Belongs to a nested scope, not this one.
        return;
      }
      parent = pe.parent;
    }
  });
  return result;
}

/** Recursively build an item object from an `itemscope` element. */
function buildItem($: CheerioAPI, scopeEl: Element): { type: string; properties: ItemObject } {
  const $scope = $(scopeEl);
  const itemType = $scope.attr('itemtype') ?? '';
  const types = normalizeTypes(itemType);
  const properties: ItemObject = {};
  if (types.length > 0) properties['_type'] = types.join(',');

  for (const propEl of directProps($, $scope)) {
    const names = ($(propEl).attr('itemprop') ?? '').trim().split(/\s+/).filter(Boolean);
    if (names.length === 0) continue;

    let value: unknown;
    if ($(propEl).attr('itemscope') !== undefined) {
      const nested = buildItem($, propEl);
      value = { '@type': nested.type, ...nested.properties };
    } else {
      value = propertyValue($, propEl);
    }
    for (const name of names) addProperty(properties, name, value);
  }

  return { type: types.join(','), properties };
}

/**
 * Extract every top-level Microdata item from a document.
 *
 * A "top-level" item is an `itemscope` element that is not itself an `itemprop` of an
 * enclosing item (those are captured as nested objects of their parent).
 */
export function extractMicrodata($: CheerioAPI): StructuredDataItem[] {
  const items: StructuredDataItem[] = [];

  $('[itemscope]').each((_i, el) => {
    // Skip scopes that are properties of an ancestor scope — they are nested, not top-level.
    if ($(el).attr('itemprop') !== undefined) return;

    const { type, properties } = buildItem($, el);
    if (type.length === 0) return; // No itemtype → nothing schema.org to validate.

    // `_type` is an internal marker for nested-type detection; drop it from public output.
    const publicProps: ItemObject = {};
    for (const [k, v] of Object.entries(properties)) {
      if (k === '_type') continue;
      publicProps[k] = v;
    }
    items.push(finalizeItem('microdata', type, publicProps));
  });

  return items;
}
