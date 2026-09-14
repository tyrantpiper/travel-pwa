// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { type, table, record } = payload;

    if (type !== 'INSERT') {
      return new Response(JSON.stringify({ message: 'Ignored: not INSERT' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    type NotifRecord = {
      user_id: string;
      type: string;
      title: string;
      body: string;
      link?: string;
      metadata?: Record<string, unknown>;
    };

    let notifications: NotifRecord[] = [];

    if (table === 'trip_members') {
      const { itinerary_id, user_id: newMemberId, user_name: newMemberName } = record;

      const { data: trip } = await supabase
        .from('itineraries')
        .select('title')
        .eq('id', itinerary_id)
        .single();

      const tripTitle = trip?.title || 'Unknown Trip';

      const { data: members } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('itinerary_id', itinerary_id)
        .neq('user_id', newMemberId);

      if (members && members.length > 0) {
        notifications = members.map((m: { user_id: string }) => ({
          user_id: m.user_id,
          type: 'trip_invite',
          title: '🤝 New Travel Buddy!',
          body: `${newMemberName || 'Someone'} joined "${tripTitle}"`,
          link: `/?trip=${itinerary_id}&day=0`,
          metadata: { trip_id: itinerary_id, member_name: newMemberName },
        }));
      }
    } else if (table === 'expenses') {
      const { itinerary_id, title: expTitle, amount, currency, created_by, creator_name, is_public } = record;

      if (!is_public) {
        return new Response(JSON.stringify({ message: 'Private expense, skipped' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: trip } = await supabase
        .from('itineraries')
        .select('title')
        .eq('id', itinerary_id)
        .single();

      const tripTitle = trip?.title || 'Unknown Trip';

      const { data: members } = await supabase
        .from('trip_members')
        .select('user_id')
        .eq('itinerary_id', itinerary_id)
        .neq('user_id', created_by);

      if (members && members.length > 0) {
        const formatted = `${currency || 'JPY'} ${Number(amount).toLocaleString()}`;
        notifications = members.map((m: { user_id: string }) => ({
          user_id: m.user_id,
          type: 'new_expense',
          title: '💰 New Expense Added',
          body: `${creator_name || 'Someone'} added "${expTitle}" (${formatted})`,
          link: `/?trip=${itinerary_id}&tab=tools&expense_id=${record.id}`,
          metadata: { trip_id: itinerary_id, expense_id: record.id, amount, currency },
        }));
      }
    }

    // Write in-app notifications
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Failed to insert notifications:', insertError);
      }
    }

    // Web Push sending (Phase 2 enhancement - requires VAPID secrets)
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (vapidPublicKey && vapidPrivateKey && notifications.length > 0) {
      const { default: webpush } = await import('npm:web-push@3');
      webpush.setVapidDetails('mailto:ryanpig228@gmail.com', vapidPublicKey, vapidPrivateKey);

      for (const notif of notifications) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', notif.user_id);

        if (subs) {
          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                JSON.stringify({ title: notif.title, body: notif.body, link: notif.link, tag: notif.type })
              );
            } catch (pushErr: unknown) {
              console.error(`Push failed for ${notif.user_id}:`, pushErr);
              if ((pushErr as { statusCode?: number })?.statusCode === 410) {
                await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: 'OK', notifications_created: notifications.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('notify-event error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
