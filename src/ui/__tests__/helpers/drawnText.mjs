/**
 * drawnText — what a module's source can put on the glass, read by PARSING it.
 *
 * ── WHY NOT A REGEX ────────────────────────────────────────────────────────
 *
 * Lane F has now written the same guard three times as `/fillText\('([^']*)'/`,
 * and a skeptic broke the third one by changing a quote character: rewrite
 * NavComputer.js:2884's footer to the DOUBLE-quoted "VIEW ONLY · PRESS ESC TO
 * RETURN" and every source scan in NavComputer.escape.test.js went green over a
 * live ESC promise at a live draw site. Adding `"` to the character class closes
 * that one case and leaves the species intact, because a drawn literal in this
 * file is spelled six different ways today:
 *
 *   'single quotes'                       17 fillText sites
 *   `template ${with} interpolation`      10 sites  (all ten interpolate)
 *   cond ? 'a' : 'b'                       e.g. :2304 KUIPER BELT / ASTEROID BELT
 *   expr || 'fallback'                     e.g. :1863 s.name || 'Unnamed'
 *   expr + ' suffix'                       e.g. :3289 (…).toFixed(0) + ' pc'
 *   const btnText = …; ctx.fillText(btnText, …)   :3840 → :3852, :2708 → :2720
 *
 * and none at all in double quotes, and `strokeText` — which the recording
 * context already treats as text — is not called even once, so a first use of
 * either would land outside a hand-tuned character class on day one.
 *
 * A parser is spelling-blind by construction: it reads the STRING VALUE, so
 * every row above collapses to the same thing and a seventh spelling nobody
 * anticipated does too.
 *
 * ── THE PARSER ─────────────────────────────────────────────────────────────
 *
 * `rollup/parseAst` — rollup ships inside vite, vite is this repo's declared
 * devDependency, and vitest cannot run without it, so it is present wherever
 * this suite runs. It is nonetheless a TRANSITIVE dep: if the import ever
 * fails, that must be a hard failure of these tests and never a skip, because
 * a source guard that quietly stops parsing is worse than no source guard.
 */
import { parseAst } from 'rollup/parseAst';

/** Depth-first over every ESTree node, ignoring position keys. */
function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const c of node) walk(c, fn); return; }
  if (typeof node.type === 'string') fn(node);
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'start' || k === 'end' || k === 'loc' || k === 'range') continue;
    walk(node[k], fn);
  }
}

const lineAt = (src, pos) => src.slice(0, pos).split('\n').length;

/**
 * Every `const NAME = <something static>` in the file, name → fragments.
 *
 * DELIBERATELY UNSCOPED — one flat map for the whole module, so `btnText`
 * (declared at :2708 as '[ BURN ]'/'[ WARP ]' and again at :3153) resolves to
 * the union of both. That is an OVER-approximation: it can attribute a string
 * to a draw site that cannot draw it. Safe here and only here, because the map
 * feeds a "no draw site may carry this string" check, where over-approximation
 * can only produce a false RED — a human looking at a string that turns out to
 * be fine. It is NOT used by the footer closure, which accepts fully-literal
 * arguments only and would be corrupted by a superset.
 */
function collectConstStrings(ast) {
  const byName = new Map();
  walk(ast, (nd) => {
    if (nd.type !== 'VariableDeclarator' || nd.id?.type !== 'Identifier' || !nd.init) return;
    const { fragments } = staticFragments(nd.init, null);
    if (!fragments.length) return;
    const prev = byName.get(nd.id.name) || [];
    byName.set(nd.id.name, [...prev, ...fragments]);
  });
  return byName;
}

/**
 * The string fragments a node can contribute, and whether anything was opaque.
 *
 * `dynamic` means "some part of this is computed at runtime and no source read
 * can know it" — a bare identifier that resolves to nothing, a call, a member
 * access. It is reported rather than hidden so a caller can tell "this draw
 * site carries no ESC promise" from "this draw site is unreadable from here".
 */
export function staticFragments(node, consts) {
  if (!node) return { fragments: [], dynamic: true };
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string'
        ? { fragments: [node.value], dynamic: false }
        : { fragments: [], dynamic: false }; // numbers, null — nothing to promise
    case 'TemplateLiteral': {
      const quasis = node.quasis.map((q) => q.value.cooked ?? q.value.raw).filter((s) => s !== '');
      let dynamic = false;
      const inner = [];
      for (const e of node.expressions) {
        const r = staticFragments(e, consts);
        inner.push(...r.fragments);
        dynamic = dynamic || r.dynamic;
      }
      return { fragments: [...quasis, ...inner], dynamic };
    }
    case 'BinaryExpression': {
      if (node.operator !== '+') return { fragments: [], dynamic: true };
      const l = staticFragments(node.left, consts);
      const r = staticFragments(node.right, consts);
      return { fragments: [...l.fragments, ...r.fragments], dynamic: l.dynamic || r.dynamic };
    }
    case 'ConditionalExpression': {
      // Both arms, never the test: either arm can end up on the glass.
      const a = staticFragments(node.consequent, consts);
      const b = staticFragments(node.alternate, consts);
      return { fragments: [...a.fragments, ...b.fragments], dynamic: a.dynamic || b.dynamic };
    }
    case 'LogicalExpression': {
      const a = staticFragments(node.left, consts);
      const b = staticFragments(node.right, consts);
      return { fragments: [...a.fragments, ...b.fragments], dynamic: a.dynamic || b.dynamic };
    }
    case 'Identifier': {
      const hit = consts?.get(node.name);
      return hit ? { fragments: [...hit], dynamic: false } : { fragments: [], dynamic: true };
    }
    default:
      return { fragments: [], dynamic: true };
  }
}

/**
 * Every text-drawing call in the source, with what it can put on the glass.
 *
 * `fillText` AND `strokeText`: the recording context treats both as text, the
 * class happens to use only the first today, and a guard that knows about one
 * of them is a guard with a documented hole.
 *
 * `spelling` classifies the FIRST argument as it is written, which is the thing
 * a regex was sensitive to. It exists so a test can pin the census — if the
 * counts shift, the file has grown a spelling this helper has not been thought
 * about against, and that should be read by a human rather than absorbed.
 *
 * `ySrc` is the third argument's exact source text. Footers in NavComputer are
 * identified by WHERE they are drawn (`drawH - 8`), not by how they are worded;
 * see the footer census in NavComputer.escape.test.js.
 */
export function collectDrawSites(src) {
  const ast = parseAst(src, {});
  const consts = collectConstStrings(ast);
  const sites = [];
  walk(ast, (nd) => {
    if (nd.type !== 'CallExpression') return;
    const callee = nd.callee;
    if (callee?.type !== 'MemberExpression' || callee.computed) return;
    const op = callee.property?.name;
    if (op !== 'fillText' && op !== 'strokeText') return;
    const arg = nd.arguments[0];
    const yArg = nd.arguments[2];
    const { fragments, dynamic } = staticFragments(arg, consts);
    const literal = staticFragments(arg, null); // no const resolution
    let spelling = 'other';
    if (arg?.type === 'Literal' && typeof arg.value === 'string') {
      spelling = src[arg.start] === '"' ? 'double' : 'single';
    } else if (arg?.type === 'TemplateLiteral') {
      spelling = node_interpolates(arg) ? 'template-interpolated' : 'template-plain';
    } else if (arg?.type === 'Identifier') {
      spelling = 'identifier';
    } else if (arg?.type === 'ConditionalExpression') {
      spelling = 'conditional';
    } else if (arg?.type === 'LogicalExpression') {
      spelling = 'logical';
    } else if (arg?.type === 'BinaryExpression' && arg.operator === '+') {
      spelling = 'concatenation';
    }
    sites.push({
      op,
      line: lineAt(src, nd.start),
      spelling,
      fragments,
      dynamic,
      /** True when the first argument is one whole string literal, any quote style. */
      wholeLiteral: arg?.type === 'Literal' && typeof arg.value === 'string',
      literalFragments: literal.fragments,
      ySrc: yArg ? src.slice(yArg.start, yArg.end) : null,
      argSrc: arg ? src.slice(arg.start, arg.end) : null,
    });
  });
  return sites;
}

const node_interpolates = (tpl) => tpl.expressions.length > 0;

/**
 * EVERY string in the file — literal or template chunk — wherever it sits.
 *
 * The net under the draw-site scan above. A literal assigned to a field in one
 * method and drawn by another, or handed to a helper that draws it, is opaque
 * to any per-call-site analysis; it is not opaque to this. Comments are not
 * included, because the parser does not treat them as strings — which is why
 * NavComputer's several `// … after ESC` notes do not trip it.
 *
 * The cost of the net is that it cannot tell a drawn string from an internal
 * one, so it over-reports by construction. For a "nothing anywhere in this file
 * may promise ESC" check that is the correct direction to be wrong in.
 */
export function collectStringLiterals(src) {
  const ast = parseAst(src, {});
  const out = [];
  walk(ast, (nd) => {
    if (nd.type === 'Literal' && typeof nd.value === 'string') {
      out.push({ value: nd.value, line: lineAt(src, nd.start), kind: src[nd.start] === '"' ? 'double' : 'single' });
    } else if (nd.type === 'TemplateElement') {
      const v = nd.value.cooked ?? nd.value.raw;
      if (v !== '') out.push({ value: v, line: lineAt(src, nd.start), kind: 'template-chunk' });
    }
  });
  return out;
}
