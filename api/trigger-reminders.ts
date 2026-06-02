/**
 * Vercel Edge API route — invoked daily by Vercel Cron at 08:00 UTC.
 * Calls the Supabase send-push-notification edge function to process
 * episode_reminders where air_date = today and reminder_sent = false.
 *
 * Vercel automatically passes CRON_SECRET in the Authorization header
 * for cron-invoked routes.
 */
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  // Vercel cron sends: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;

  if (authHeader !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    return new Response('SUPABASE_URL not configured', { status: 500 });
  }

  const res = await fetch(
    `${supabaseUrl}/functions/v1/send-push-notification`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,   // forward the same secret
      },
      body: JSON.stringify({ type: 'reminders' }),
    }
  );

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
