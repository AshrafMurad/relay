interface WebHealthResponse {
  service: "relay-web";
  status: "ok";
  timestamp: string;
}

export function GET() {
  const body: WebHealthResponse = {
    service: "relay-web",
    status: "ok",
    timestamp: new Date().toISOString(),
  };

  return Response.json(body, {
    headers: { "cache-control": "no-store" },
  });
}
