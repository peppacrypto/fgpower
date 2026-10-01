import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * No page, route handler or server action relies on a layout for auth. A
 * client navigation renders only the segments that change, so a request that
 * says the /app layout is already on screen gets the page alone (the layout's
 * requireUser() never runs); a request flagged "metadata-only" renders a
 * page's generateMetadata and nothing else; route handlers and server actions
 * never run a layout at all; and proxy.ts only checks that a session cookie is
 * present — any value passes, and a server action's POST (a `Next-Action`
 * header) passes without one. So every /app and public page, its
 * generateMetadata, every route handler and server action establishes its
 * viewer itself (lib/auth/require-user), or is listed below with what keeps
 * it safe without one. Admin pages and routes: admin/admin-pages-gate.test.ts.
 *
 * Read from the source: a call counts when the entry point (a page's default
 * export, its generateMetadata, an exported HTTP handler, a server action)
 * makes it, directly or through a function of the same file — not in a
 * comment, not only in generateMetadata, and not only inside an inline server
 * action (an endpoint of its own, checked on its own).
 */

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url));

const SIGNED_IN = ["requireUser", "requireAdmin", "requireUserOrThrow", "requireAdminOrThrow"];
const ANY_VIEWER = [...SIGNED_IN, "getCurrentSession", "auth.api.getSession"];
const HTTP_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
/** What a page exports that renders on its own, without the page component. */
const PAGE_METADATA = ["generateMetadata", "generateViewport"];

/** Pages open to a signed-out viewer on purpose: each asks for the session and shows only what that viewer may see. */
const PUBLIC_PAGES: Record<string, string> = {
  "app/app/activity/[id]/page.tsx": "canViewActivity: signed out, only a PUBLIC workout of an author who isn't banned",
  "app/app/exercises/[slug]/page.tsx": "the library's content (as /exercises/[slug]); the favorite and the program's uses only with a session",
  "app/(public)/u/[username]/page.tsx": "getPublicProfile and getProfileActivities for this viewer, signed out included",
  "app/(public)/t/[token]/page.tsx": "the share token is the grant (getSharedWorkout); a signed-in viewer is checked with activityAccess",
};

/** /app pages that show nothing, so need no viewer (they may not read data). */
const EMPTY_PAGES: Record<string, string> = {
  "app/app/page.tsx": "redirects to /app/today",
  "app/app/[...missing]/page.tsx": "notFound() only",
};

/** generateMetadata that names only what anyone may see, so it needs no viewer. */
const PUBLIC_METADATA: Record<string, string> = {
  "app/app/exercises/[slug]/page.tsx": "the exercise's name (the library)",
  "app/app/exercises/[slug]/history/page.tsx": "the exercise's name (the library)",
  "app/app/programs/templates/[slug]/page.tsx": "the template's name (the catalog)",
  "app/app/programs/templates/[slug]/adapt/page.tsx": "the template's name (the catalog)",
  "app/app/science/[slug]/page.tsx": "the principle's title",
  "app/(public)/t/[token]/page.tsx": "the share token is the grant (getSharedWorkout)",
};

/**
 * Route handlers and image routes without a session, and the guard each keeps
 * instead: calls (or reads) its handlers must still make.
 */
const GUARDED_ROUTES: Record<string, { why: string; guard: string[] }> = {
  "app/api/auth/[...all]/route.ts": { why: "better-auth's own endpoints", guard: ["toNextJsHandler"] },
  "app/api/cron/reminders/route.ts": {
    why: "Bearer CRON_SECRET, compared in constant time; 404 without a secret",
    guard: ["process.env.CRON_SECRET", "timingSafeEqual"],
  },
  "app/api/email/unsubscribe/route.ts": {
    why: "the signed token is the grant (RFC 8058 one-click); GET only redirects to the page that asks",
    guard: ["unsubscribeDigestByToken"],
  },
  "app/api/email/webhook/route.ts": { why: "Svix signature (RESEND_WEBHOOK_SECRET); 404 without a secret", guard: ["verifySvix"] },
  "app/api/health/route.ts": { why: "liveness: says only whether the database answers", guard: [] },
  "app/api/test/login/route.ts": { why: "e2e only: 404 in production", guard: ["process.env.NODE_ENV"] },
  "app/api/test/outbox/route.ts": { why: "e2e only: 404 in production", guard: ["process.env.NODE_ENV"] },
  "app/api/test/reminders/route.ts": { why: "e2e only: 404 in production", guard: ["process.env.NODE_ENV"] },
  "app/api/workout/autosave/route.ts": { why: "saveSetValues checks the session (requireUserOrThrow)", guard: ["saveSetValues"] },
  "app/api/workout/sets/route.ts": { why: "syncSets checks the session (requireUserOrThrow)", guard: ["syncSets"] },
  "app/r/[token]/route.ts": { why: "a signed click link (verifyLink), to an app path only", guard: ["verifyLink", "safeNextPath"] },
  "app/(public)/t/[token]/story.png/route.tsx": { why: "the share token is the grant", guard: ["getSharedWorkout"] },
  "app/(public)/t/[token]/opengraph-image.tsx": { why: "the share token is the grant", guard: ["getSharedWorkout"] },
  "app/(public)/u/[username]/opengraph-image.tsx": {
    why: "what a signed-out visitor sees (getPublicProfile with no viewer)",
    guard: ["getPublicProfile"],
  },
  "app/robots.ts": { why: "static crawl rules", guard: [] },
  "app/manifest.ts": { why: "the static PWA manifest", guard: [] },
};

/** Server actions (each one an endpoint anyone can call) that need no session, and why: "<file> <function>". */
const OPEN_ACTIONS: Record<string, string> = {
  "app/app/settings/actions.ts signOutAction": "signs out whatever session the request carries",
  "app/app/today/actions.ts chooseWeekStart": "a cookie on the caller's own device; no data",
  "app/email/cancelar/actions.ts unsubscribeDigest": "the signed token is the grant",
  "app/email/cancelar/actions.ts resubscribeDigest": "the signed token is the grant",
  "app/app/programs/new/page.tsx createAction": "createCustomProgram checks the session (requireUserOrThrow)",
};

function files(dir: string, name: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "generated" || entry.name === "node_modules" ? [] : files(path, name);
    return name.test(entry.name) ? [path] : [];
  });
}

const relativeName = (path: string) => relative(SRC_DIR, path).split(sep).join("/");
const PAGE = /^page\.(tsx|ts|jsx|js)$/;
const ROUTE = /^route\.(tsx|ts|jsx|js)$/;
const IMAGE_ROUTE = /^(opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)\.(tsx|ts|jsx|js)$/;

const pages = [...files(join(SRC_DIR, "app/app"), PAGE), ...files(join(SRC_DIR, "app/(public)"), PAGE)].map(relativeName).sort();
// Everywhere but /admin (its own test): a route handler runs without any layout.
const routes = files(join(SRC_DIR, "app"), new RegExp(`${ROUTE.source}|${IMAGE_ROUTE.source}`))
  .map(relativeName)
  .filter((file) => !file.startsWith("app/admin/"))
  .sort();
const modules = files(SRC_DIR, /^(?!.*\.test\.).*\.(tsx|ts)$/).map(relativeName).sort();

const isDirective = (statement: ts.Statement | undefined, text: string) =>
  statement !== undefined && ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === text;

/** `async function act() { "use server"; … }`, also as a function expression or an arrow. */
const isInlineAction = (node: ts.Node) =>
  (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) &&
  node.body !== undefined &&
  ts.isBlock(node.body) &&
  isDirective(node.body.statements[0], "use server");

/**
 * A file's entry points, each with what it reaches — the functions it calls
 * and the properties it reads, following the file's own top-level functions:
 * - "default", generateMetadata and exported HTTP methods (pages, route
 *   handlers), however they're exported (`export { handler as POST }` too);
 * - server actions: every export of a "use server" module (a re-export
 *   reaches nothing here: define the action in the module), and each inline
 *   function that starts with "use server".
 */
function scanSource(text: string, file: string) {
  const kind = /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const serverModule = isDirective(source.statements[0], "use server");
  const declarations = new Map<string, ts.Node>();
  const entries = new Map<string, ts.Node>();
  const actions = new Map<string, ts.Node>();
  const imports: string[] = [];
  const specifiers: ts.ExportSpecifier[] = [];
  const has = (node: ts.Node, modifier: ts.SyntaxKind) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === modifier);
  const isEntry = (name: string) => name === "default" || HTTP_METHODS.has(name) || PAGE_METADATA.includes(name);
  const exportAs = (name: string, node: ts.Node) => {
    if (isEntry(name)) entries.set(name, node);
    if (serverModule) actions.set(name, node);
  };

  for (const statement of source.statements) {
    const exported = has(statement, ts.SyntaxKind.ExportKeyword);
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push(statement.moduleSpecifier.text);
    } else if (ts.isFunctionDeclaration(statement)) {
      const name = statement.name?.text;
      if (name) declarations.set(name, statement);
      if (exported) exportAs(has(statement, ts.SyntaxKind.DefaultKeyword) ? "default" : (name ?? "default"), statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const names = ts.isIdentifier(declaration.name)
          ? [declaration.name.text]
          : ts.isObjectBindingPattern(declaration.name)
            ? declaration.name.elements.flatMap((e) => (ts.isIdentifier(e.name) ? [e.name.text] : []))
            : [];
        for (const name of names) {
          declarations.set(name, declaration);
          if (exported) exportAs(name, declaration);
        }
      }
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      exportAs("default", statement.expression);
    } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        specifiers.push(...statement.exportClause.elements.filter((specifier) => !specifier.isTypeOnly));
      } else {
        exportAs("*", statement);
      }
    }
  }
  // `export { handler as POST }` is the local handler; a re-export (or an imported binding) is the specifier itself.
  for (const specifier of specifiers) {
    const local = (specifier.propertyName ?? specifier.name).text;
    const fromHere = !specifier.parent.parent.moduleSpecifier && declarations.get(local);
    exportAs(specifier.name.text, fromHere || specifier);
  }
  // Inline server actions: `async function act() { "use server"; … }`, also as a const.
  const findInline = (node: ts.Node): void => {
    if (isInlineAction(node)) {
      const fn = node as ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;
      const named = ts.isFunctionDeclaration(fn) ? fn.name : ts.isVariableDeclaration(fn.parent) ? fn.parent.name : undefined;
      const line = source.getLineAndCharacterOfPosition(fn.getStart(source)).line + 1;
      actions.set(named && ts.isIdentifier(named) ? named.text : `(inline, line ${line})`, fn);
    }
    ts.forEachChild(node, findInline);
  };
  findInline(source);

  const reach = (start: ts.Node) => {
    const names = new Set<string>();
    const seen = new Set<ts.Node>([start]);
    const visit = (node: ts.Node): void => {
      // An inline server action is an endpoint of its own: its check doesn't guard the code around it.
      if (node !== start && isInlineAction(node)) return;
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) names.add(node.expression.text);
      if (ts.isPropertyAccessExpression(node)) names.add(node.getText(source));
      const declaration = ts.isIdentifier(node) ? declarations.get(node.text) : undefined;
      if (declaration && !seen.has(declaration)) {
        seen.add(declaration);
        visit(declaration);
      }
      ts.forEachChild(node, visit);
    };
    visit(start);
    return names;
  };
  const reached = (nodes: Map<string, ts.Node>) => new Map([...nodes].map(([name, node]) => [name, reach(node)]));
  return { entries: reached(entries), actions: reached(actions), imports };
}

const scan = (file: string) => scanSource(readFileSync(join(SRC_DIR, file), "utf8"), file);

const reachesAny = (reached: Set<string> | undefined, names: string[]) => names.some((name) => reached?.has(name));

/** A page's generateMetadata (and generateViewport) that neither asks for the viewer nor is listed. */
const unguardedMetadata = (file: string, entries: Map<string, Set<string>>) =>
  PAGE_METADATA.filter((name) => entries.has(name) && !(file in PUBLIC_METADATA) && !reachesAny(entries.get(name), ANY_VIEWER));

/** A route file's handlers: the default export of an image route, the exported HTTP methods of a route handler. */
const handlersOf = (file: string, entries: Map<string, Set<string>>) =>
  [...entries].filter(([name]) => (IMAGE_ROUTE.test(basename(file)) ? name === "default" : HTTP_METHODS.has(name) || name === "*"));

describe("pages establish their viewer themselves, not through a layout", () => {
  it("are all found", () => {
    expect(pages.length).toBeGreaterThan(30);
    expect(pages).toEqual(expect.arrayContaining(["app/app/today/page.tsx", "app/(public)/u/[username]/page.tsx"]));
  });

  it.each(pages)("%s", (file) => {
    const { entries, imports } = scan(file);
    const page = entries.get("default");
    expect(page, `${file}: no \`export default\` page found`).toBeDefined();
    if (file in EMPTY_PAGES) {
      const reads = imports.filter((spec) => /^@\/lib\/(db|data)(\/|$)/.test(spec));
      expect(reads, `${file} is in EMPTY_PAGES (${EMPTY_PAGES[file]}) but reads data`).toEqual([]);
    } else if (file in PUBLIC_PAGES) {
      expect(reachesAny(page, ANY_VIEWER), `${file} is in PUBLIC_PAGES but never asks for the session`).toBe(true);
    } else {
      expect(
        reachesAny(page, SIGNED_IN),
        `${file} calls neither requireUser() nor requireAdmin(): the layout's check doesn't guard it (add the call, or list it here with why it's safe)`,
      ).toBe(true);
    }
    expect(
      unguardedMetadata(file, entries),
      `${file}: a "metadata-only" request renders generateMetadata without the page — ask for the viewer there too (getCurrentSession), or list it in PUBLIC_METADATA`,
    ).toEqual([]);
  });
});

describe("route handlers establish their viewer (no layout runs for them)", () => {
  it("are all found", () => {
    expect(routes).toEqual(expect.arrayContaining(["app/api/account/export/route.ts", "app/r/[token]/route.ts"]));
  });

  it.each(routes)("%s", (file) => {
    const handlers = handlersOf(file, scan(file).entries);
    expect(handlers.length, `${file}: no exported handler found`).toBeGreaterThan(0);
    const guarded = GUARDED_ROUTES[file];
    if (guarded) {
      const reached = new Set(handlers.flatMap(([, names]) => [...names]));
      for (const name of guarded.guard) {
        expect(reached.has(name), `${file} is in GUARDED_ROUTES (${guarded.why}) but no longer reaches ${name}`).toBe(true);
      }
      return;
    }
    for (const [method, reached] of handlers) {
      expect(
        reachesAny(reached, ANY_VIEWER),
        `${file} ${method}: no session check (getCurrentSession, requireUserOrThrow…), and not in GUARDED_ROUTES`,
      ).toBe(true);
    }
  });
});

describe("server actions establish their caller (each is an endpoint of its own)", () => {
  const actions = modules.flatMap((file) => [...scan(file).actions].map(([name, reached]) => ({ key: `${file} ${name}`, reached })));

  it("are all found", () => {
    expect(actions.length).toBeGreaterThan(50);
    expect(actions.map((a) => a.key)).toEqual(expect.arrayContaining(["lib/actions/favorites.ts toggleFavoriteExercise"]));
  });

  it("each checks the session (or is in OPEN_ACTIONS)", () => {
    const unchecked = actions.filter((a) => !(a.key in OPEN_ACTIONS) && !reachesAny(a.reached, ANY_VIEWER));
    expect(unchecked.map((a) => a.key), "server actions with no session check: add one, or list them in OPEN_ACTIONS").toEqual([]);
  });
});

describe("the exception lists", () => {
  it("name only files and actions that exist", () => {
    for (const file of [...Object.keys(PUBLIC_PAGES), ...Object.keys(EMPTY_PAGES)]) expect(pages).toContain(file);
    for (const file of Object.keys(PUBLIC_METADATA)) {
      expect(pages).toContain(file);
      expect(PAGE_METADATA.some((name) => scan(file).entries.has(name)), `PUBLIC_METADATA: ${file} has no generateMetadata`).toBe(true);
    }
    for (const file of Object.keys(GUARDED_ROUTES)) expect(routes).toContain(file);
    for (const key of Object.keys(OPEN_ACTIONS)) {
      const [file, name] = key.split(" ");
      expect([...scan(file).actions.keys()], `OPEN_ACTIONS: ${key}`).toContain(name);
    }
  });
});

/** The scan itself, on sources written for it: each hole it must find, and the forms it accepts. */
describe("the scan (negative controls)", () => {
  const src = (...lines: string[]) => lines.join("\n");
  const entry = (text: string) => scanSource(text, "page.tsx").entries.get("default");
  const unchecked = (text: string) =>
    [...scanSource(text, "actions.ts").actions].filter(([, reached]) => !reachesAny(reached, ANY_VIEWER)).map(([name]) => name);

  it.each([
    ["no check", src("export default async function P() {", "  return <p>{(await prisma.a.findMany()).length}</p>;", "}")],
    [
      "a check only in generateMetadata",
      src("export async function generateMetadata() { await requireUser(); return {}; }", "export default async function P() { return 1; }"),
    ],
    ["a check only in a comment", src("export default async function P() {", "  // await requireUser()", "  return 1;", "}")],
    ["a check only in a string", 'export default async function P() { return "requireUser()"; }'],
    [
      "a check only inside its inline server action",
      src(
        "export default async function P() {",
        "  const x = await prisma.a.findMany();",
        '  async function save() { "use server"; await requireUserOrThrow(); }',
        "  return <form action={save}>{x.length}</form>;",
        "}",
      ),
    ],
    [
      "a check only in the form action it renders",
      src(
        'async function save() { "use server"; await requireUserOrThrow(); }',
        "export default async function P() { return <form action={save}>{await prisma.a.count()}</form>; }",
      ),
    ],
  ])("a page with %s is flagged", (_, text) => {
    expect(reachesAny(entry(text), SIGNED_IN)).toBe(false);
  });

  it.each([
    [
      "the check through a cached loader",
      src(
        "const load = cache(async (id) => { const u = await requireUser(); return u; });",
        "export default async function P({ params }) { return load((await params).id); }",
      ),
    ],
    [
      "the check in a child component of the file",
      src("async function Data() { const u = await requireUser(); return <p>{u.id}</p>; }", "export default function P() { return <Data />; }"),
    ],
    [
      "the check in Promise.all",
      "export default async function P({ searchParams }) { const [sp, user] = await Promise.all([searchParams, requireUser()]); }",
    ],
    ["`export default Page`", src("async function Page() { await requireUser(); }", "export default Page;")],
  ])("a page with %s passes", (_, text) => {
    expect(reachesAny(entry(text), SIGNED_IN)).toBe(true);
  });

  it("generateMetadata that reads data without the viewer is flagged; one that asks for it passes", () => {
    const page = "export default async function P() { await requireUser(); }";
    const leaky = src(
      "export async function generateMetadata({ params }) {",
      "  const p = await prisma.userProgram.findUnique({ where: { id: (await params).id } });",
      "  return { title: p?.name };",
      "}",
      page,
    );
    expect(unguardedMetadata("page.tsx", scanSource(leaky, "page.tsx").entries)).toEqual(["generateMetadata"]);
    const asks = src(
      "const load = cache(async (id) => { const s = await getCurrentSession(); return s; });",
      "export async function generateMetadata({ params }) { return { title: String(await load((await params).id)) }; }",
      page,
    );
    expect(unguardedMetadata("page.tsx", scanSource(asks, "page.tsx").entries)).toEqual([]);
  });

  it.each([
    ["a GET with no check", "export async function GET() { return Response.json(await prisma.user.findMany()); }", "GET"],
    [
      "a handler exported by name, unchecked",
      src("const handler = async () => Response.json(await prisma.user.findMany());", "export { handler as POST };"),
      "POST",
    ],
    ["a re-exported handler", 'export { GET } from "./elsewhere";', "GET"],
  ])("a route with %s is flagged", (_, text, method) => {
    const handlers = new Map(handlersOf("route.ts", scanSource(text, "route.ts").entries));
    expect(handlers.has(method)).toBe(true);
    expect(reachesAny(handlers.get(method), ANY_VIEWER)).toBe(false);
  });

  it("a route handler that checks passes, however it's exported", () => {
    const text = src(
      "const handler = async () => { const u = await requireUserOrThrow().catch(() => null); if (!u) return 401; };",
      "export { handler as GET, handler as POST };",
    );
    const handlers = handlersOf("route.ts", scanSource(text, "route.ts").entries);
    expect(handlers.map(([name]) => name).sort()).toEqual(["GET", "POST"]);
    for (const [, reached] of handlers) expect(reachesAny(reached, ANY_VIEWER)).toBe(true);
  });

  it("server actions with no check are flagged, however they're exported", () => {
    const text = src(
      '"use server";',
      'export { leak } from "./elsewhere";',
      'export * from "./more";',
      "export async function listAll() { return prisma.user.findMany(); }",
      "export const arrow = async () => prisma.user.findMany();",
      "export default async function (id: string) { return prisma.user.findUnique({ where: { id } }); }",
      "export async function checked() { const user = await requireUserOrThrow(); return user.id; }",
      "export const checkedArrow = async () => (await requireUserOrThrow()).id;",
    );
    expect(unchecked(text).sort()).toEqual(["*", "arrow", "default", "leak", "listAll"]);
  });

  it("an inline action is checked on its own", () => {
    const text = src(
      "export default async function P() {",
      "  await requireUser();",
      '  async function open() { "use server"; return prisma.user.findMany(); }',
      '  async function shut() { "use server"; await requireUserOrThrow(); }',
      "  return null;",
      "}",
    );
    expect(unchecked(text)).toEqual(["open"]);
  });
});
