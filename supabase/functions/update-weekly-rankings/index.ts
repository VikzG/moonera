import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const currentDate = new Date();
    const weekNumber = getWeekNumber(currentDate);
    const year = currentDate.getFullYear();

    const { data: topLooks, error: fetchError } = await supabaseClient
      .from('looks')
      .select('id, user_id, likes_count')
      .eq('week_number', weekNumber)
      .eq('year', year)
      .order('likes_count', { ascending: false })
      .limit(100);

    if (fetchError) throw fetchError;

    const { error: updateError } = await supabaseClient
      .from('looks')
      .update({ is_weekly_top: false })
      .eq('week_number', weekNumber)
      .eq('year', year);

    if (updateError) throw updateError;

    if (topLooks && topLooks.length > 0) {
      const topLookIds = topLooks.map(look => look.id);

      const { error: markTopError } = await supabaseClient
        .from('looks')
        .update({ is_weekly_top: true })
        .in('id', topLookIds);

      if (markTopError) throw markTopError;

      const historyRecords = topLooks.map((look, index) => ({
        look_id: look.id,
        user_id: look.user_id,
        week_number: weekNumber,
        year: year,
        rank: index + 1,
        likes_count: look.likes_count,
      }));

      const { error: historyError } = await supabaseClient
        .from('weekly_top_history')
        .upsert(historyRecords, {
          onConflict: 'look_id,week_number,year',
        });

      if (historyError) throw historyError;

      const userWeeklyTopCounts = new Map<string, number>();
      for (const look of topLooks) {
        const count = userWeeklyTopCounts.get(look.user_id) || 0;
        userWeeklyTopCounts.set(look.user_id, count + 1);
      }

      for (const [userId, count] of userWeeklyTopCounts) {
        const { data: historyCount, error: countError } = await supabaseClient
          .from('weekly_top_history')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (countError) continue;

        const totalWeeklyTops = historyCount || 0;

        const { error: profileUpdateError } = await supabaseClient
          .from('profiles')
          .update({ weekly_top_count: totalWeeklyTops })
          .eq('id', userId);

        if (profileUpdateError) continue;

        if (totalWeeklyTops >= 5 && totalWeeklyTops < 10) {
          const { data: existingBadge } = await supabaseClient
            .from('badges')
            .select('id')
            .eq('user_id', userId)
            .eq('badge_type', 'rising_star')
            .maybeSingle();

          if (!existingBadge) {
            await supabaseClient.from('badges').insert([{
              user_id: userId,
              badge_type: 'rising_star',
              weekly_top_count: totalWeeklyTops,
            }]);
          }
        } else if (totalWeeklyTops >= 10 && totalWeeklyTops < 20) {
          const { data: existingBadge } = await supabaseClient
            .from('badges')
            .select('id')
            .eq('user_id', userId)
            .eq('badge_type', 'elite_style')
            .maybeSingle();

          if (!existingBadge) {
            await supabaseClient.from('badges').insert([{
              user_id: userId,
              badge_type: 'elite_style',
              weekly_top_count: totalWeeklyTops,
            }]);
          }
        } else if (totalWeeklyTops >= 20) {
          const { data: existingBadge } = await supabaseClient
            .from('badges')
            .select('id')
            .eq('user_id', userId)
            .eq('badge_type', 'legend')
            .maybeSingle();

          if (!existingBadge) {
            await supabaseClient.from('badges').insert([{
              user_id: userId,
              badge_type: 'legend',
              weekly_top_count: totalWeeklyTops,
            }]);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        week: weekNumber,
        year: year,
        topCount: topLooks?.length || 0,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error updating weekly rankings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});