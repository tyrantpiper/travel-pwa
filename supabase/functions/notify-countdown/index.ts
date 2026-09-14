// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Countdown milestones (days before trip)
const COUNTDOWN_DAYS = [7, 3, 1];

const COUNTDOWN_EMOJI: Record<number, string> = {
  7: '✈️',
  3: '📦',
  1: '🎉',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find trips starting in 7, 3, or 1 days
    const results = [];

    for (const daysAhead of COUNTDOWN_DAYS) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);
      const dateStr = targetDate.toISOString().split('T')[0];

      const { data: trips } = await supabase
        .from('itineraries')
        .select('id, title, start_date')
        .eq('start_date', dateStr);

      if (!trips || trips.length === 0) continue;

      for (const trip of trips) {
        // Get all members of this trip
        const { data: members } = await supabase
          .from('trip_members')
          .select('user_id')
          .eq('itinerary_id', trip.id);

        if (!members || members.length === 0) continue;

        for (const member of members) {
          // Dedup: check if we already sent this type today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', member.user_id)
            .eq('type', 'trip_countdown')
            .gte('created_at', todayStart.toISOString())
            .contains('metadata', { trip_id: trip.id, days_left: daysAhead })
            .limit(1);

          if (existing && existing.length > 0) continue;

          const emoji = COUNTDOWN_EMOJI[daysAhead] || '✈️';
          const title = `${emoji} Trip Countdown!`;
          const body = daysAhead === 1
            ? `Tomorrow is the day! "${trip.title}" starts tomorrow!`
            : `"${trip.title}" is ${daysAhead} days away!`;

          // Insert notification
          const { error: insertErr } = await supabase
            .from('notifications')
            .insert({
              user_id: member.user_id,
              type: 'trip_countdown',
              title,
              body,
              link: `/?trip=${trip.id}&day=0`,
              metadata: { trip_id: trip.id, days_left: daysAhead },
            });

          if (insertErr) {
            console.error('Insert notification failed:', insertErr);
          } else {
            results.push({ user: member.user_id, trip: trip.title, days: daysAhead });
          }

          // Attempt Web Push
          const vapidPub = Deno.env.get('VAPID_PUBLIC_KEY');
          const vapidPriv = Deno.env.get('VAPID_PRIVATE_KEY');

          if (vapidPub && vapidPriv) {
            try {
              const { default: webpush } = await import('npm:web-push@3');
              webpush.setVapidDetails('mailto:ryanpig228@gmail.com', vapidPub, vapidPriv);

              const { data: subs } = await supabase
                .from('push_subscriptions')
                .select('endpoint, p256dh, auth')
                .eq('user_id', member.user_id);

              if (subs) {
                for (const sub of subs) {
                  try {
                    await webpush.sendNotification(
                      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                      JSON.stringify({ title, body, link: `/?trip=${trip.id}&day=0`, tag: 'trip_countdown' })
                    );
                  } catch (pushErr: unknown) {
                    console.error('Push send failed:', pushErr);
                    if ((pushErr as { statusCode?: number })?.statusCode === 410) {
                      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Web push module error:', e);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: 'OK', notifications_sent: results.length, details: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('notify-countdown error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
