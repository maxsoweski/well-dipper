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
 * A parser is blind to how a literal is QUOTED, which is exactly what the regex
 * was sensitive to: every row above collapses to the same string VALUE, and a
 * seventh QUOTING nobody anticipated collapses with them.
 *
 * ⚠ IT IS NOT BLIND TO HOW A VALUE IS CONSTRUCTED, and this file used to imply
 * otherwise — "a seventh spelling nobody anticipated does too", which reads as a
 * guarantee about any future way of getting a string onto the glass and is not
 * one. What this reads is the literals the source WRITES DOWN. A value never
 * written down as a literal — assembled from character codes, decoded, read off
 * an object, returned by a call this cannot follow — is invisible here and always
 * will be. `dynamic` is how a caller learns it is looking at that case rather
 * than at a clean read.
 *
 * Two construction shapes ARE resolved, because a good-faith author writes them:
 * a static `+` is JOINED into one value (see `staticFragments`), and a
 * `const NAME = 'literal'` drawn by name is resolved through `collectConstStrings`.
 * Template interpolation is deliberately NOT joined, so a word split across `${}`
 * reads as two fragments. Which of those are covered promises and which are
 * declined — and why declining some is the correct answer rather than a gap — is
 * settled in NavComputer.escape.test.js's threat model. Read it before widening
 * anything here.
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
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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
      // ── JOINED WHEN IT CAN BE ────────────────────────────────────────────
      //
      // `'PRESS ES' + 'C TO RETURN'` is ONE sentence on the glass, and this used
      // to hand back the two halves separately and test each — so the word the
      // player reads existed in no fragment and matched no pattern. Both sides
      // fully static means the joined value is knowable here, and it is the value
      // that actually gets drawn, so that is what is reported.
      //
      // The product, not the pairs: either side can be a conditional, and
      // `(a ? 'X' : 'Y') + 'Z'` really can put 'XZ' or 'YZ' on the glass.
      //
      // If EITHER side is dynamic the joined value is not knowable from the
      // source at all — `(…).toFixed(0) + ' pc'` at :3289 is the live example —
      // so the static parts stay separate and `dynamic` stays true, which is the
      // caller's signal that it is reading a fragment and not a sentence.
      if (!l.dynamic && !r.dynamic && l.fragments.length && r.fragments.length) {
        const joined = [];
        for (const a of l.fragments) for (const b of r.fragments) joined.push(a + b);
        return { fragments: joined, dynamic: false };
      }
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
 * A `<identifier> - <number>` baseline, read STRUCTURALLY.
 *
 * The footer census identifies a footer by WHERE it is drawn, and it used to do
 * that by comparing the y argument's exact source slice against the text
 * `'drawH - 8'`. So `drawH-8` — which any formatter will write, and which draws
 * the identical pixel row — matched nothing, and dropped that site out of the
 * footer set, the computed-baseline pin and the bottom-strip tripwire in one go.
 * A whitespace-sensitive check on source text is the same species of mistake as
 * the quote-sensitive regex this whole helper exists to replace.
 *
 * Reading the two operands off the AST makes the spacing unrepresentable:
 * `drawH-8`, `drawH - 8` and `drawH  -  8` parse to the same two nodes. Returns
 * null for anything that is not that shape (`chip.y + PAD_Y + 9`, a bare
 * identifier, a number) — those are not bottom-strip baselines and the census
 * does not claim to read them.
 */
function bottomOffset(node) {
  if (node?.type !== 'BinaryExpression' || node.operator !== '-') return null;
  if (node.left?.type !== 'Identifier') return null;
  if (node.right?.type !== 'Literal' || typeof node.right.value !== 'number') return null;
  return { base: node.left.name, offset: node.right.value };
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
 * `yBase`/`yOffset` are the third argument read as a `<identifier> - <number>`
 * baseline, whitespace-proof (see `bottomOffset`). Footers in NavComputer are
 * identified by WHERE they are drawn (`drawH` minus 8), not by how they are
 * worded; see the footer census in NavComputer.escape.test.js. `ySrc` is kept
 * alongside as the exact source slice, for failure messages only — nothing
 * decides anything by comparing it.
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
      yBase: bottomOffset(yArg)?.base ?? null,
      yOffset: bottomOffset(yArg)?.offset ?? null,
      argSrc: arg ? src.slice(arg.start, arg.end) : null,
    });
  });
  return sites;
}

const node_interpolates = (tpl) => tpl.expressions.length > 0;

/**
 * The modules a module imports FROM THIS REPO, as absolute paths.
 *
 * ── WHY THE SCAN NEEDS THIS AT ALL ─────────────────────────────────────────
 *
 * Every source check in NavComputer.escape.test.js reads ONE file, so a hint
 * constant living one module over — `export const BACK_HINT = 'PRESS ESC TO
 * RETURN'` in a sibling, imported and drawn — was invisible to all of them.
 * Measured: the literal forbidden string, plain ASCII, no trick, and 43/43 green.
 * That is a plausible refactor rather than an evasion, which is what puts it
 * inside the threat model.
 *
 * ── WHY DEPTH ONE, AND NOT `src/ui/**` ─────────────────────────────────────
 *
 * Anything NavComputer DRAWS it must first IMPORT, so the modules it imports are
 * the whole of the surface a hint can arrive from in one hop — including a new
 * `navHints.js` written tomorrow, which becomes a new import the moment it is
 * used. A directory sweep buys nothing over that and costs correctness: Max's
 * ruling is that ESC DISMISSES, so an unrelated UI module that tells the player
 * "ESC to dismiss" is telling the truth, and a guard that reddens on it is crying
 * wolf about a correct string. Depth one keeps the scan pointed at the modules
 * whose strings NavComputer can actually draw.
 *
 * ⚠ THE LIMIT, STATED: one hop. A constant in a module that a sibling imports
 * and re-exports is not read here. Bare specifiers (`alea`) are skipped as
 * node_modules, not our code. Both static and dynamic `import()` are followed.
 *
 * A relative specifier that does not resolve to a file THROWS rather than being
 * skipped: this does no extension or index resolution, and a specifier it cannot
 * resolve is a module it would silently stop reading.
 */
export function localImportPaths(src, modulePath) {
  const ast = parseAst(src, {});
  const here = dirname(modulePath);
  const out = [];
  walk(ast, (nd) => {
    const kind = nd.type;
    if (kind !== 'ImportDeclaration' && kind !== 'ImportExpression'
      && kind !== 'ExportNamedDeclaration' && kind !== 'ExportAllDeclaration') return;
    const spec = nd.source;
    if (spec?.type !== 'Literal' || typeof spec.value !== 'string') return;
    if (!spec.value.startsWith('.')) return; // bare specifier — node_modules
    const p = resolve(here, spec.value);
    if (!existsSync(p)) {
      throw new Error(
        `${modulePath} imports '${spec.value}', which does not resolve to a file at ${p}. `
        + 'localImportPaths resolves relative specifiers by hand and does no extension or '
        + 'index resolution, so a specifier it cannot resolve is a module the cross-module '
        + 'scan would stop reading without saying so. Teach it the new shape.',
      );
    }
    out.push(p);
  });
  return [...new Set(out)];
}

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
 *
 * A fully-static `+` is reported BOTH ways: each operand, and the joined value
 * as a `concatenated` entry. Without the join this net was weaker than the
 * draw-site scan beside it, which does join — so `const H = 'PRESS ES' + 'C …'`
 * in a module with no `fillText` in it (a sibling helper, say) fell between the
 * two. Emitting both is redundant and cheap, and redundancy is the right cost
 * for a net.
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
    } else if (nd.type === 'BinaryExpression' && nd.operator === '+') {
      const { fragments, dynamic } = staticFragments(nd, null);
      if (dynamic) return; // half a sentence and a runtime value — the operands above stand alone
      for (const v of fragments) out.push({ value: v, line: lineAt(src, nd.start), kind: 'concatenated' });
    }
  });
  return out;
}
