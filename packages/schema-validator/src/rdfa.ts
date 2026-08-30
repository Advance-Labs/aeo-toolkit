/**
 * RDFa Lite extraction (`vocab` / `typeof` / `property`).
 *
 * RDFa Lite (the subset Google and schema.org document) marks a typed resource with
 * `typeof` and supplies its properties with `property`, optionally resolving short names
 * against a `vocab` (usually `https://schema.org/`). We treat each `typeof` element as an
 * item, gather its `property` descendants (excluding those owned by a nested `typeof`), and
 * recurse so nested typed resources become nested objects for validation.
 */
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import type { StructuredDataItem } from '@advance-labs/types';
import { normalizeTypes } from './types-map.js';
import { finalizeItem } from './validation.js';

type ItemObject = Record<string, unknown>;

/** Resolve the literal/resource value of a `property` element under RDFa rules. */
function propertyValue($: CheerioAPI, el: Element): string {
  const $el = $(el);
  const tag = (el.tagName ?? '').toLowerCase();

  const attr = (name: string): string | undefined => {
    const v = $el.attr(name);
    return v !== undefined ? v.trim() : undefined;
  };

  // Explicit literal overrides element content.
  const content = attr('content');
  if (content !== undefined) return content;

  switch (tag) {
    case 'a':
    case 'area':
    case 'link':
      return attr('href') ?? $el.text().trim();
    case 'img':
    case 'audio':
    case 'video':
    case 'source':
    case 'iframe':
    case 'embed':
      return attr('src') ?? '';
    case 'object':
      return attr('data') ?? '';
    case 'time':
      return attr('datetime') ?? $el.text().trim();
    case 'meta':
      return attr('content') ?? '';
    default:
      return $el.text().trim();
  }
}

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
 * Direct `property` descendants of a typed scope: those whose nearest typed ancestor is
 * this scope. Properties under a nested `typeof` belong to that nested resource.
 */
function directProps($: CheerioAPI, scope: Cheerio<Element>): Element[] {
  const scopeEl = scope.get(0);
  const result: Element[] = [];
  scope.find('[property]').each((_i, el) => {
    let parent = el.parent;
    while (parent !== null && parent !== undefined && 'tagName' in parent) {
      const pe = parent as Element;
      if (pe === scopeEl) {
        result.push(el);
        return;
      }
      if ($(pe).attr('typeof') !== undefined) return; // owned by a nested typed resource
      parent = pe.parent;
    }
  });
  return result;
}

function buildItem($: CheerioAPI, scopeEl: Element): { type: string; properties: ItemObject } {
  const $scope = $(scopeEl);
  const typeofAttr = $scope.attr('typeof') ?? '';
  const types = normalizeTypes(typeofAttr.split(/\s+/).filter(Boolean));
  const properties: ItemObject = {};
  if (types.length > 0) properties['_type'] = types.join(',');

  for (const propEl of directProps($, $scope)) {
    const names = ($(propEl).attr('property') ?? '').trim().split(/\s+/).filter(Boolean);
    if (names.length === 0) continue;

    let value: unknown;
    if ($(propEl).attr('typeof') !== undefined) {
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
 * Extract every top-level RDFa-typed resource from a document. A `typeof` element nested as
 * a `property` of an enclosing resource is captured as a child object, not a top-level item.
 */
export function extractRdfa($: CheerioAPI): StructuredDataItem[] {
  const items: StructuredDataItem[] = [];

  $('[typeof]').each((_i, el) => {
    if ($(el).attr('property') !== undefined) return; // nested typed resource

    const { type, properties } = buildItem($, el);
    if (type.length === 0) return;

    const publicProps: ItemObject = {};
    for (const [k, v] of Object.entries(properties)) {
      if (k === '_type') continue;
      publicProps[k] = v;
    }
    items.push(finalizeItem('rdfa', type, publicProps));
  });

  return items;
}
