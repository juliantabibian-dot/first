import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Thrown to stop a request with a sentence the app shows to the user as is,
 * so keep messages short, plain and free of internal detail.
 */
export class Refusal extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function preflight(): Response {
  return new Response('ok', { headers: corsHeaders });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof Refusal) return json({ error: error.message }, error.status);
  console.error(error);
  return json({ error: 'Something went wrong on our side. Try again in a moment.' }, 500);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Refusal(400, "That request wasn't understood.");
  }
  return body as Record<string, unknown>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
