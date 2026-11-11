#!/usr/bin/env node
/**
 * Turn docs/api/openapi.json into the TypeScript both clients import.
 *
 *   node tools/api/gen-types.mjs            write both files
 *   node tools/api/gen-types.mjs --check    exit 1 if either is out of date (CI runs this)
 *
 * Writes the same module twice — frontend/lib/types/api.gen.ts and
 * mobile/src/lib/types/api.gen.ts — one `export` per schema the backend
 * declares (CategoryRead, ExpenseCreate, BudgetPeriod…). The clients' own type
 * files alias these, so a field the backend adds, renames or retypes fails
 * `tsc` in both clients instead of waiting for someone to notice.
 *
 * Why not openapi-typescript: it needs TypeScript 5's compiler API and both
 * apps run TypeScript 7; it would also be a dependency in two lockfiles for a
 * job this small. FastAPI and Pydantic emit a narrow, regular subset of JSON
 * Schema, listed in `typeOf` below. Anything outside it stops the run with the
 * schema's name rather than being typed as `unknown` — a contract with a silent
 * hole in it is worse than a generator that needs ten more lines.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = 'docs/api/openapi.json';
const OUTPUTS = ['frontend/lib/types/api.gen.ts', 'mobile/src/lib/types/api.gen.ts'];
/** Both apps format to this width (their .oxfmtrc.jsonc), and CI checks the output against it. */
const WIDTH = 100;

const REF = '#/components/schemas/';
/** JSON Schema keywords that constrain values but do not change the TypeScript type. */
const IGNORED = new Set([
  'title',
  'description',
  'default',
  'examples',
  'format',
  'pattern',
  'deprecated',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'readOnly',
  'writeOnly',
]);
const HANDLED = new Set([
  '$ref',
  'type',
  'enum',
  'const',
  'anyOf',
  'allOf',
  'items',
  'properties',
  'required',
  'additionalProperties',
]);

const literal = (value) =>
  typeof value === 'string'
    ? `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
    : String(value);
const identifier = (name) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : literal(name));
const unique = (items) => [...new Set(items)];

/** Pydantic names a generic or a split input/output model with characters TypeScript cannot use. */
const typeName = (schemaName) => schemaName.replace(/[^A-Za-z0-9_$]/g, '');

function fail(where, message) {
  throw new Error(`${SOURCE}: ${where}: ${message}`);
}

/** The TypeScript type of one schema node. `where` names it in error messages. */
function typeOf(node, where) {
  if (
    node === true ||
    (typeof node === 'object' && Object.keys(node).every((k) => IGNORED.has(k)))
  ) {
    return 'unknown'; // No constraint at all, e.g. the offending `input` of a validation error.
  }
  for (const key of Object.keys(node)) {
    if (!IGNORED.has(key) && !HANDLED.has(key)) fail(where, `unsupported keyword "${key}"`);
  }
  if (node.$ref) {
    if (!node.$ref.startsWith(REF)) fail(where, `unsupported $ref ${node.$ref}`);
    return typeName(node.$ref.slice(REF.length));
  }
  if (node.const !== undefined) return literal(node.const);
  if (node.enum) return node.enum.map(literal).join(' | ');
  if (node.anyOf)
    return unique(node.anyOf.map((member, i) => typeOf(member, `${where}.anyOf[${i}]`))).join(
      ' | '
    );
  if (node.allOf) {
    // Pydantic wraps a lone $ref in allOf to attach a default or a description to it.
    if (node.allOf.length !== 1) fail(where, 'allOf with more than one member');
    return typeOf(node.allOf[0], `${where}.allOf[0]`);
  }
  if (Array.isArray(node.type)) {
    return unique(node.type.map((type) => typeOf({ ...node, type }, where))).join(' | ');
  }
  switch (node.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array': {
      if (!node.items) fail(where, 'array without items');
      const item = typeOf(node.items, `${where}[]`);
      return item.includes(' | ') ? `(${item})[]` : `${item}[]`;
    }
    case 'object': {
      if (node.properties)
        return `{ ${properties(node, where)
          .map((p) => p.line)
          .join(' ')} }`;
      const values = node.additionalProperties;
      return `Record<string, ${values && values !== true ? typeOf(values, `${where}{}`) : 'unknown'}>`;
    }
    default:
      return fail(where, `unsupported type ${JSON.stringify(node.type)}`);
  }
}

/** What a format tells a reader that `string` does not. */
function formatNote(node) {
  const formats = unique(
    [node, ...(node.anyOf ?? [])].map((member) => member.format).filter(Boolean)
  );
  if (formats.includes('date')) return 'ISO date, YYYY-MM-DD.';
  if (formats.includes('date-time')) return 'ISO date-time with its UTC offset.';
  return null;
}

function properties(node, where) {
  const required = new Set(node.required ?? []);
  return Object.entries(node.properties).map(([name, schema]) => {
    const type = typeOf(schema, `${where}.${name}`);
    const key = `${identifier(name)}${required.has(name) ? '' : '?'}`;
    const doc = [schema.description, formatNote(schema)].filter(Boolean).join('\n');
    return { key, type, doc, line: `${key}: ${type};` };
  });
}

function jsdoc(text, indent) {
  if (!text) return [];
  const lines = text
    .replace(/\*\//g, '*\\/')
    .split('\n')
    .map((line) => line.trimEnd());
  if (lines.length === 1) return [`${indent}/** ${lines[0]} */`];
  return [
    `${indent}/**`,
    ...lines.map((line) => `${indent} *${line ? ` ${line}` : ''}`),
    `${indent} */`,
  ];
}

/** `head type;` on one line when it fits, otherwise a union broken the way the formatter breaks it. */
function statement(head, type, indent) {
  const oneLine = `${indent}${head} ${type};`;
  const members = type.split(' | ');
  if (oneLine.length <= WIDTH || members.length === 1) return [oneLine];
  return [
    `${indent}${head}`,
    ...members.map((member, i) => `${indent}  | ${member}${i === members.length - 1 ? ';' : ''}`),
  ];
}

function declaration(schemaName, schema) {
  const name = typeName(schemaName);
  const out = jsdoc(schema.description, '');
  if (schema.type === 'object' && schema.properties) {
    out.push(`export interface ${name} {`);
    for (const property of properties(schema, schemaName)) {
      out.push(...jsdoc(property.doc, '  '), ...statement(`${property.key}:`, property.type, '  '));
    }
    out.push('}');
  } else {
    out.push(...statement(`export type ${name} =`, typeOf(schema, schemaName), ''));
  }
  return out.join('\n');
}

function generate() {
  const spec = JSON.parse(readFileSync(resolve(ROOT, SOURCE), 'utf8'));
  const schemas = spec.components?.schemas ?? {};
  const names = Object.keys(schemas);
  if (names.length === 0) fail('components.schemas', 'no schemas — is this the right file?');
  const clash = names.find(
    (name, i) => names.findIndex((other) => typeName(other) === typeName(name)) !== i
  );
  if (clash) fail(clash, `two schemas would both be named ${typeName(clash)}`);

  const banner = `// GENERATED by tools/api/gen-types.mjs from ${SOURCE} — do not edit.
//
// One export per schema the backend declares (${spec.info.title} ${spec.info.version}, ${names.length} schemas).
// When the API changes, from the repo root:
//   cd backend && python ../tools/api/dump_openapi.py && cd .. && node tools/api/gen-types.mjs
// Import app-facing names from this folder's other files, which alias these.`;
  return `${[banner, ...names.map((name) => declaration(name, schemas[name]))].join('\n\n')}\n`;
}

const read = (file) => readFileSync(resolve(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
const mode = process.argv.slice(2).find((arg) => arg.startsWith('--'));
const generated = generate();

if (mode === '--check') {
  const stale = OUTPUTS.filter((file) => {
    try {
      return read(file) !== generated;
    } catch {
      return true; // Missing counts as out of date.
    }
  });
  if (stale.length) {
    console.error(`Out of date with ${SOURCE}:\n  ${stale.join('\n  ')}`);
    console.error('Run `node tools/api/gen-types.mjs` from the repo root and commit the result.');
    process.exit(1);
  }
  console.log('API types are current in both clients.');
} else if (mode) {
  console.error(`Unknown option ${mode}. Use --check, or no option to write.`);
  process.exit(2);
} else {
  for (const file of OUTPUTS) writeFileSync(resolve(ROOT, file), generated);
  console.log(`Wrote ${OUTPUTS.join(' and ')}.`);
}
