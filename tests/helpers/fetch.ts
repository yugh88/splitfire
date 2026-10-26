/** A fetch stub that serves canned responses by exact URL and records calls. */
type Routes = Record<string, { status?: number; body: unknown }>;

export function fakeFetch(routes: Routes) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const route = routes[url];
    if (!route) return new Response("missing", { status: 404 });
    const body = typeof route.body === "string" ? route.body : JSON.stringify(route.body);
    return new Response(body, { status: route.status ?? 200 });
  }) as typeof fetch;
  return { impl, calls };
}
