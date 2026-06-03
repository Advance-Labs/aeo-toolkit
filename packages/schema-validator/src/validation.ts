/**
 * Required-property validation for key AEO schema.org types.
 *
 * Each rule names the short type and the properties schema.org marks as required (or that
 * answer engines effectively require) for that type to be useful. A rule may also run a
 * custom check for nested shapes — e.g. an `FAQPage.mainEntity` must contain `Question`
 * items that each carry an `acceptedAnswer`.
 */
import type { StructuredDataItem } from '@aeo/types';
import { normalizeTypes } from './types-map.js';

/** Outcome of validating a single normalized item against its type rule(s). */
export interface ValidationResult {
  valid: boolean;
  missingRequired: string[];
  warnings: string[];
}

interface TypeRule {
  /** Top-level properties that must be present and non-empty. */
  required: string[];
  /** Optional structural check producing extra missing-prop names and warnings. */
  check?: (properties: Record<string, unknown>) => { missing: string[]; warnings: string[] };
}

/** A property is "present" when it is not undefined/null and not an empty string/array. */
function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Read a property case-insensitively; schema.org is case-sensitive but real markup drifts. */
function getProp(properties: Record<string, unknown>, name: string): unknown {
  if (name in properties) return properties[name];
  const lower = name.toLowerCase();
  for (const key of Object.keys(properties)) {
    if (key.toLowerCase() === lower) return properties[key];
  }
  return undefined;
}

/** Coerce a possibly-single value into an array for uniform iteration. */
function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Does a nested entity (object) declare one of the given short types? */
function entityHasType(entity: unknown, ...wanted: string[]): boolean {
  if (typeof entity !== 'object' || entity === null) return false;
  const typeValue = (entity as Record<string, unknown>)['@type'];
  if (typeValue === undefined) {
    // Microdata/RDFa store the type under a synthetic key; fall back to that.
    const altType = (entity as Record<string, unknown>)['_type'];
    if (altType === undefined) return false;
    const alt = normalizeTypes(altType);
    return wanted.some((w) => alt.includes(w));
  }
  const types = normalizeTypes(typeValue);
  return wanted.some((w) => types.includes(w));
}

function getEntityProp(entity: unknown, name: string): unknown {
  if (typeof entity !== 'object' || entity === null) return undefined;
  return getProp(entity as Record<string, unknown>, name);
}

/** FAQPage: mainEntity must hold Question entities, each with an acceptedAnswer. */
function checkFaqPage(properties: Record<string, unknown>): {
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  const questions = asArray(getProp(properties, 'mainEntity'));
  if (questions.length === 0) {
    missing.push('mainEntity');
    return { missing, warnings };
  }
  let validQuestions = 0;
  for (const q of questions) {
    const isQuestion = entityHasType(q, 'Question') || hasValue(getEntityProp(q, 'name'));
    const hasAnswer =
      entityHasType(getEntityProp(q, 'acceptedAnswer'), 'Answer') ||
      hasValue(getEntityProp(getEntityProp(q, 'acceptedAnswer'), 'text')) ||
      hasValue(getEntityProp(q, 'acceptedAnswer'));
    if (isQuestion && hasAnswer) validQuestions += 1;
    else warnings.push('mainEntity contains a Question without a valid acceptedAnswer');
  }
  if (validQuestions === 0) missing.push('mainEntity.acceptedAnswer');
  return { missing, warnings };
}

/** QAPage: mainEntity must hold a Question with an accepted or suggested answer. */
function checkQaPage(properties: Record<string, unknown>): {
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  const main = asArray(getProp(properties, 'mainEntity'));
  if (main.length === 0) {
    missing.push('mainEntity');
    return { missing, warnings };
  }
  const question = main[0];
  const hasAnswer =
    hasValue(getEntityProp(question, 'acceptedAnswer')) ||
    hasValue(getEntityProp(question, 'suggestedAnswer'));
  if (!hasAnswer) {
    missing.push('mainEntity.acceptedAnswer');
    warnings.push('QAPage mainEntity Question is missing an acceptedAnswer or suggestedAnswer');
  }
  return { missing, warnings };
}

/** HowTo: must declare ordered step(s). */
function checkHowTo(properties: Record<string, unknown>): {
  missing: string[];
  warnings: string[];
} {
  const steps = asArray(getProp(properties, 'step'));
  if (steps.length === 0) return { missing: ['step'], warnings: [] };
  return { missing: [], warnings: [] };
}

/** LocalBusiness: needs a postal address; an empty `address` is not enough. */
function checkLocalBusiness(properties: Record<string, unknown>): {
  missing: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const address = getProp(properties, 'address');
  if (!hasValue(address)) return { missing: ['address'], warnings };
  // A bare string address is allowed but weaker than a PostalAddress object.
  if (typeof address === 'string') {
    warnings.push('address is a plain string; a structured PostalAddress is preferred');
  }
  return { missing: [], warnings };
}

/**
 * Required-property rules keyed by short schema.org type. Types that share a contract
 * (the Article family) all map to the same rule.
 */
const TYPE_RULES: Record<string, TypeRule> = {
  FAQPage: { required: [], check: checkFaqPage },
  QAPage: { required: [], check: checkQaPage },
  HowTo: { required: [], check: checkHowTo },
  Article: { required: ['headline'] },
  NewsArticle: { required: ['headline'] },
  BlogPosting: { required: ['headline'] },
  Person: { required: ['name'] },
  Organization: { required: ['name'] },
  BreadcrumbList: { required: ['itemListElement'] },
  Product: { required: ['name'] },
  Review: { required: ['reviewRating'] },
  LocalBusiness: { required: ['name'], check: checkLocalBusiness },
};

/**
 * Validate a normalized item's properties against the required-property rules for its
 * type(s). When an item declares multiple types, the union of all matching rules applies.
 * Types with no rule are considered valid (we only assert what we know how to check).
 */
export function validateItem(type: string, properties: Record<string, unknown>): ValidationResult {
  // `type` may carry several comma-joined types (e.g. "Product,Review"); split before
  // normalizing so each declared type is matched against its own rule.
  const declared = type.length > 0 ? type.split(',') : [];
  const types = normalizeTypes(declared);
  const missingRequired: string[] = [];
  const warnings: string[] = [];
  let matchedAnyRule = false;

  for (const shortType of types) {
    const rule = TYPE_RULES[shortType];
    if (rule === undefined) continue;
    matchedAnyRule = true;

    for (const prop of rule.required) {
      if (!hasValue(getProp(properties, prop)) && !missingRequired.includes(prop)) {
        missingRequired.push(prop);
      }
    }
    if (rule.check) {
      const result = rule.check(properties);
      for (const m of result.missing) if (!missingRequired.includes(m)) missingRequired.push(m);
      for (const w of result.warnings) if (!warnings.includes(w)) warnings.push(w);
    }
  }

  // Unknown / unvalidated types are not flagged invalid — absence of a rule is not a failure.
  if (!matchedAnyRule) {
    return { valid: true, missingRequired: [], warnings: [] };
  }

  return { valid: missingRequired.length === 0, missingRequired, warnings };
}

/** Build a fully-validated {@link StructuredDataItem} from a normalized raw item. */
export function finalizeItem(
  format: StructuredDataItem['format'],
  type: string,
  properties: Record<string, unknown>,
  extraWarnings: string[] = [],
): StructuredDataItem {
  const result = validateItem(type, properties);
  const warnings = [...extraWarnings];
  for (const w of result.warnings) if (!warnings.includes(w)) warnings.push(w);
  return {
    format,
    type,
    properties,
    valid: result.valid,
    missingRequired: result.missingRequired,
    warnings,
  };
}
