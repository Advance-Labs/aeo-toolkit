/**
 * @advance-labs/schema-validator — detect and validate all structured-data formats from raw HTML.
 *
 * Rebuilds the behavior of `structured-data-testing-tool` in TypeScript: extract JSON-LD,
 * Microdata, and RDFa, normalize each to schema.org short types, validate required
 * properties for AEO-relevant types, and roll the results into a `StructuredDataReport`.
 */
export { analyzeStructuredData } from './analyze.js';
export { extractJsonLd } from './json-ld.js';
export { extractMicrodata } from './microdata.js';
export { extractRdfa } from './rdfa.js';
export { validateItem } from './validation.js';
export type { ValidationResult } from './validation.js';
export { toShortType, normalizeTypes, isAeoSchemaType } from './types-map.js';
