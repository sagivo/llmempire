const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

export async function onRequestPost({ request }) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return Response.json({ error: { message: "Missing AI Gateway API key" } }, { status: 401 });
  }

  let upstream;
  try {
    upstream = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": authorization,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: await request.arrayBuffer()
    });
  } catch (error) {
    return Response.json({ error: { message: "Could not reach AI Gateway" } }, { status: 502 });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  const retryAfter = upstream.headers.get("Retry-After");
  if (retryAfter) headers.set("Retry-After", retryAfter);
  headers.set("Cache-Control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}
