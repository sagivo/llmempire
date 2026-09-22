const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export async function onRequestPost({ request }) {
  const authorization = request.headers.get("Authorization");
  const directProvider = request.headers.get("X-LLM-Provider");
  const provider = directProvider === "openai" ? "OpenAI" : directProvider === "anthropic" ? "Anthropic" : "Vercel AI Gateway";
  if (!authorization) {
    return Response.json({ error: { message: `Missing ${provider} API key` } }, { status: 401 });
  }

  let body = await request.json();
  let url = GATEWAY_URL;
  const headers = { "Content-Type": "application/json", "Accept": "application/json" };
  if (directProvider === "openai") {
    url = OPENAI_URL;
    headers.Authorization = authorization;
  } else if (directProvider === "anthropic") {
    url = ANTHROPIC_URL;
    headers["x-api-key"] = authorization.replace(/^Bearer\s+/i, "");
    headers["anthropic-version"] = "2023-06-01";
    const system = body.messages?.find(message => message.role === "system")?.content || "";
    body = {
      model: body.model,
      max_tokens: 4096,
      temperature: body.temperature,
      system,
      messages: (body.messages || []).filter(message => message.role !== "system")
    };
  } else {
    headers.Authorization = authorization;
  }

  let upstream;
  try {
    upstream = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (error) {
    return Response.json({ error: { message: `Could not reach ${provider}` } }, { status: 502 });
  }

  if (directProvider === "anthropic" && upstream.ok) {
    const result = await upstream.json();
    return Response.json({
      choices: [{ message: { content: (result.content || []).filter(part => part.type === "text").map(part => part.text).join("") } }],
      usage: { prompt_tokens: result.usage?.input_tokens || 0, completion_tokens: result.usage?.output_tokens || 0 }
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("Content-Type");
  if (contentType) responseHeaders.set("Content-Type", contentType);
  const retryAfter = upstream.headers.get("Retry-After");
  if (retryAfter) responseHeaders.set("Retry-After", retryAfter);
  responseHeaders.set("Cache-Control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
}