import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Every admin page checks for an admin itself, first thing: the layout's
 * requireAdmin() doesn't guard a page. A client navigation renders only the
 * segments that change, so a request that says the admin layout is already on
 * screen (`RSC: 1` and a Next-Router-State-Tree naming it) gets the page
 * segment alone — to anyone, signed out too (proxy.ts doesn't cover /admin).
 * A request flagged "metadata-only" renders a page's generateMetadata and
 * nothing else, so that starts with the check too. A route handler here would
 * never run the layout at all.
 *
 * Read from the source: the check has to be the first statement (an awaited
 * requireAdmin() call, not a comment or a call made elsewhere) of every export
 * the router calls.
 */

const ADMIN_DIR = fileURLToPath(new URL(".", import.meta.url));
const ADMIN_CHECKS = new Set(["requireAdmin", "requireAdminOrThrow"]);
const HTTP_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
/** What a page exports that renders on its own, without the page component. */
const PAGE_METADATA = ["generateMetadata", "generateViewport"];

function files(dir: string, name: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path, name) : name.test(entry.name) ? [path] : [];
  });
}

const relativeName = (path: string) => relative(ADMIN_DIR, path).split(sep).join("/");
const pages = files(ADMIN_DIR, /^page\.(tsx|ts|jsx|js)$/).map(relativeName).sort();
// Route handlers and image routes: no layout runs for them.
const IMAGE_ROUTE = /^(opengraph-image|twitter-image|icon|apple-icon|sitemap)\.(tsx|ts|jsx|js)$/;
const routes = files(ADMIN_DIR, new RegExp(`^route\\.(tsx|ts|jsx|js)$|${IMAGE_ROUTE.source}`))
  .map(relativeName)
  .sort();

/**
 * Every name the file exports, with the node that defines it: a function
 * declaration when it's written `export (default) async function name()`,
 * anything else (a const, `export { x as GET }`, a re-export) otherwise.
 */
function exportsOf(text: string, file: string): Map<string, ts.Node> {
  const kind = /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const found = new Map<string, ts.Node>();
  const modifiers = (node: ts.Node) => (ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []).map((m) => m.kind) : []);
  for (const statement of source.statements) {
    const exported = modifiers(statement).includes(ts.SyntaxKind.ExportKeyword);
    if (ts.isFunctionDeclaration(statement) && exported) {
      const name = modifiers(statement).includes(ts.SyntaxKind.DefaultKeyword) ? "default" : statement.name?.text;
      if (name) found.set(name, statement);
    } else if (ts.isVariableStatement(statement) && exported) {
      for (const declaration of statement.declarationList.declarations) {
        const names = ts.isIdentifier(declaration.name)
          ? [declaration.name.text]
          : ts.isObjectBindingPattern(declaration.name)
            ? declaration.name.elements.flatMap((e) => (ts.isIdentifier(e.name) ? [e.name.text] : []))
            : [];
        for (const name of names) found.set(name, declaration);
      }
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      found.set("default", statement);
    } else if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const specifier of statement.exportClause.elements) found.set(specifier.name.text, specifier);
      } else {
        found.set("*", statement);
      }
    }
  }
  return found;
}

/** `await requireAdmin()`, `const admin = await requireAdmin()`, `const a = await requireAdminOrThrow().catch(…)`. */
function checksForAdmin(statement: ts.Statement | undefined): boolean {
  const expression =
    statement && ts.isExpressionStatement(statement)
      ? statement.expression
      : statement && ts.isVariableStatement(statement)
        ? statement.declarationList.declarations[0]?.initializer
        : undefined;
  if (!expression || !ts.isAwaitExpression(expression)) return false;
  let calls = false;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ADMIN_CHECKS.has(node.expression.text)) calls = true;
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return calls;
}

/** What's wrong with one export the router calls, or null: a function declaration that starts with the check. */
function entryProblem(label: string, node: ts.Node | undefined): string | null {
  if (!node || !ts.isFunctionDeclaration(node)) return `${label}: export it as an \`async function\` declaration`;
  return checksForAdmin(node.body?.statements[0]) ? null : `${label}: make \`await requireAdmin()\` its first statement`;
}

/** An admin page: the page itself, and whatever renders without it (generateMetadata). */
function pageProblems(text: string, file = "page.tsx"): string[] {
  const exported = exportsOf(text, file);
  const problems = [entryProblem("the page (export default)", exported.get("default"))];
  for (const name of PAGE_METADATA) if (exported.has(name)) problems.push(entryProblem(name, exported.get(name)));
  if (exported.has("*")) problems.push("`export *`: export each function by name, here");
  return problems.filter((p): p is string => p !== null);
}

/** An admin route handler, or image route: every handler it exports. */
function routeProblems(text: string, file = "route.ts"): string[] {
  const exported = exportsOf(text, file);
  const imageRoute = IMAGE_ROUTE.test(file.split("/").pop()!);
  const handlers = [...exported.keys()].filter((name) => (imageRoute ? name === "default" : HTTP_METHODS.has(name)));
  if (handlers.length === 0) return ["no handler found: export each one as an `async function` declaration"];
  const problems = handlers.map((name) => entryProblem(name, exported.get(name)));
  if (exported.has("*")) problems.push("`export *`: export each handler by name, here");
  return problems.filter((p): p is string => p !== null);
}

describe("admin pages", () => {
  it("are all found", () => {
    expect(pages).toEqual(
      expect.arrayContaining(["page.tsx", "exercises/page.tsx", "exercises/[id]/edit/page.tsx", "reports/page.tsx"]),
    );
  });

  it.each(pages)("%s starts with await requireAdmin()", (file) => {
    expect(pageProblems(readFileSync(join(ADMIN_DIR, file), "utf8"), file), file).toEqual([]);
  });

  it("route handlers start with the admin check too", () => {
    for (const file of routes) {
      expect(routeProblems(readFileSync(join(ADMIN_DIR, file), "utf8"), file), file).toEqual([]);
    }
  });
});

/** The check itself, on sources written for it: each hole it must find, and the forms it accepts. */
describe("the admin check (negative controls)", () => {
  const src = (...lines: string[]) => lines.join("\n");
  const page = (...body: string[]) => src("export default async function P() {", ...body, "}");
  const checkedPage = page("await requireAdmin();", "return 1;");

  it.each([
    ["no check (the hole C1 found)", page("return await prisma.user.count();")],
    ["a check only in a comment", page("// await requireAdmin();", "return await prisma.user.count();")],
    ["a check after the data read", page("const n = await prisma.user.count();", "await requireAdmin();", "return n;")],
    ["a check not awaited", page("requireAdmin();", "return await prisma.user.count();")],
    ["a check only in generateMetadata", src("export async function generateMetadata() { await requireAdmin(); return {}; }", page("return 1;"))],
    ["a default export that isn't a function declaration", src("const P = async () => { await requireAdmin(); return 1; };", "export default P;")],
    [
      "generateMetadata reading data before the check (a metadata-only request renders it alone)",
      src(
        "export async function generateMetadata() {",
        "  const report = await prisma.userReport.findFirst();",
        "  return { title: report?.details };",
        "}",
        checkedPage,
      ),
    ],
  ])("a page with %s is flagged", (_, text) => {
    expect(pageProblems(text)).not.toEqual([]);
  });

  it.each([
    ["await requireAdmin() first, after a comment", page("// Not the layout's check.", "await requireAdmin();", "return 1;")],
    ["const admin = await requireAdmin() first", page("const admin = await requireAdmin();", "return admin.id;")],
    ["a static metadata object", src('export const metadata = { title: "Admin" };', checkedPage)],
    ["generateMetadata that checks first", src("export async function generateMetadata() { await requireAdmin(); return {}; }", checkedPage)],
  ])("a page with %s passes", (_, text) => {
    expect(pageProblems(text)).toEqual([]);
  });

  it.each([
    ["a handler with no check", "export async function GET() { return Response.json(await prisma.user.findMany()); }"],
    [
      "a const handler next to a checked one",
      src("export async function GET() { await requireAdminOrThrow(); }", "export const POST = async () => Response.json({});"),
    ],
    ["a handler exported by name", src("const handler = async () => Response.json({});", "export { handler as POST };")],
    ["a re-exported handler", 'export { GET } from "./elsewhere";'],
    ["no handler at all", 'export const dynamic = "force-dynamic";'],
  ])("a route with %s is flagged", (_, text) => {
    expect(routeProblems(text)).not.toEqual([]);
  });

  it("an image route with no check is flagged", () => {
    expect(routeProblems("export default async function Image() { return new Response(); }", "opengraph-image.tsx")).not.toEqual([]);
  });

  it("a route whose handlers check first passes", () => {
    const text = src(
      "export async function GET() {",
      "  const admin = await requireAdminOrThrow().catch(() => null);",
      "  if (!admin) return new Response(null, { status: 401 });",
      "}",
      "export async function POST() { await requireAdminOrThrow(); }",
    );
    expect(routeProblems(text)).toEqual([]);
  });
});
