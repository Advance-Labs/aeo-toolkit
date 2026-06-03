/**
 * JSON-LD extraction from `<script type="application/ld+json">` blocks.
 *
 * Real-world JSON-LD is messy: a script may contain a single object, an array of objects,
 * or an object whose `@graph` holds the real items. Any of those may nest typed sub-objects.
 * We flatten all of that into one `StructuredDataItem[]`, preserving each node's own type
 * while keeping its full property bag for validation.
 */
import type { CheerioAPI } from 'cheerio';
import type { StructuredDataItem } from '@aeo/types';
import { normalizeTypes } from './types-map.js';
import { finalizeItem } from './validation.js';

/** A plain JSON object (the only shape that can carry an `@type`). */
type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse one script body into zero or more top-level JSON nodes. Tolerates the common
 * mistake of multiple JSON objects concatenated by stripping nothing — we only accept
 * strictly valid JSON, and surface a parse failure as an empty list (the caller records it).
 */
function parseScriptBody(body: string): { nodes: unknown[]; parseError: boolean } {
  const trimmed = body.trim();
  if (trimmed.length === 0) return { nodes: [], parseError: false };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return { nodes: parsed, parseError: false };
    return { nodes: [parsed], parseError: false };
  } catch {
    return { nodes: [], parseError: true };
  }
}

/**
 * Expand a node into the typed objects it represents. An object with `@graph` contributes
 * its graph members (not itself); an array contributes each element; a typed object
 * contributes itself.
 */
function expandNode(node: unknown): JsonObject[] {
  if (Array.isArray(node)) {
    return node.flatMap((n) => expandNode(n));
  }
  if (!isJsonObject(node)) return [];

  const graph = node['@graph'];
  if (Array.isArray(graph)) {
    return graph.flatMap((n) => expandNode(n));
  }
  return [node];
}

/**
 * Build a `StructuredDataItem` for a typed JSON-LD object. The object's properties become
 * the item's `properties` (minus the `@type`/`@context` keywords, which are not data props
 * but are kept under their original keys so nested validators can still read `@type`).
 */
function itemFromObject(obj: JsonObject): StructuredDataItem | undefined {
  const typeValue = obj['@type'];
  if (typeValue === undefined) return undefined;
  const types = normalizeTypes(typeValue);
  if (types.length === 0) return undefined;

  // All declared types are joined; the validator splits and applies each matching rule.
  // The `@context` keyword is dropped (not a data property); `@type` is retained so nested
  // validators that inspect child objects can still read their types.
  const properties: JsonObject = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '@context') continue;
    properties[key] = value;
  }
  return finalizeItem('json-ld', types.join(','), properties);
}

/**
 * Extract every JSON-LD structured-data item from an HTML document.
 *
 * @param $ A loaded cheerio API over the document (injected so this stays pure / testable).
 * @returns One item per typed JSON-LD node, including `@graph` and array members.
 */
export function extractJsonLd($: CheerioAPI): StructuredDataItem[] {
  const items: StructuredDataItem[] = [];

  $('script[type="application/ld+json"]').each((_index, element) => {
    const body = $(element).text();
    const { nodes, parseError } = parseScriptBody(body);
    if (parseError) {
      items.push({
        format: 'json-ld',
        type: '',
        properties: {},
        valid: false,
        missingRequired: [],
        warnings: ['JSON-LD script contains invalid JSON and was skipped'],
      });
      return;
    }
    for (const node of nodes) {
      for (const obj of expandNode(node)) {
        const item = itemFromObject(obj);
        if (item !== undefined) items.push(item);
      }
    }
  });

  return items;
}
