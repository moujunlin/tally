import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function calculateDayCoins(db: any, checkDate: string): Promise<number> {
  const { data: items } = await db
    .from("tally_checklist_items")
    .select("id, category, coin_rule")
    .eq("active", true);

  const { data: logs } = await db
    .from("tally_checklist_logs")
    .select("item_id, checked")
    .eq("check_date", checkDate);

  const checkedSet = new Set(
    (logs || []).filter((l: any) => l.checked).map((l: any) => l.item_id)
  );

  const categories: Record<string, { items: any[]; rule: any }> = {};
  for (const item of items || []) {
    if (!item.coin_rule) continue;
    const cat = item.category;
    if (!categories[cat]) {
      categories[cat] = { items: [], rule: item.coin_rule };
    }
    categories[cat].items.push(item);
  }

  let totalCoins = 0;
  for (const [, group] of Object.entries(categories)) {
    if (group.rule.type === "all_in_category") {
      const allChecked = group.items.every((i: any) => checkedSet.has(i.id));
      if (allChecked) totalCoins += group.rule.coins;
    } else if (group.rule.type === "per_check") {
      for (const item of group.items) {
        if (checkedSet.has(item.id)) totalCoins += group.rule.coins;
      }
    }
  }
  return totalCoins;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const resource = parts[1] || "";
  const id = parts[2] ? parseInt(parts[2]) : null;

  try {
    // ---- CHECKLIST ITEMS ----
    if (resource === "checklist-items") {
      if (req.method === "GET") {
        const { data, error } = await db
          .from("tally_checklist_items")
          .select("*")
          .eq("active", true)
          .order("sort_order");
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (req.method === "POST") {
        const body = await req.json();
        const { data, error } = await db
          .from("tally_checklist_items")
          .insert(body)
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
      if (req.method === "PATCH" && id) {
        const body = await req.json();
        const { data, error } = await db
          .from("tally_checklist_items")
          .update(body)
          .eq("id", id)
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
    }

    // ---- CHECKLIST LOGS ----
    if (resource === "checklist-logs") {
      if (req.method === "GET") {
        const date = url.searchParams.get("date");
        if (date) {
          const { data: items } = await db
            .from("tally_checklist_items")
            .select("*")
            .eq("active", true)
            .order("sort_order");

          const { data: logs } = await db
            .from("tally_checklist_logs")
            .select("*")
            .eq("check_date", date);

          const logMap: Record<number, any> = {};
          (logs || []).forEach((l: any) => { logMap[l.item_id] = l; });

          const merged = (items || []).map((item: any) => ({
            ...item,
            checked: logMap[item.id]?.checked || false,
            comment: logMap[item.id]?.comment || "",
            log_id: logMap[item.id]?.id || null,
          }));

          const coinsEarned = await calculateDayCoins(db, date);

          return json({ items: merged, coins_earned: coinsEarned });
        }

        // history mode
        const limit = parseInt(url.searchParams.get("limit") || "7");
        const { data: recentLogs } = await db
          .from("tally_checklist_logs")
          .select("*, tally_checklist_items(name, category)")
          .order("check_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(500);

        const byDate: Record<string, any[]> = {};
        (recentLogs || []).forEach((l: any) => {
          if (!byDate[l.check_date]) byDate[l.check_date] = [];
          byDate[l.check_date].push(l);
        });

        const dates = Object.keys(byDate).sort().reverse().slice(0, limit);
        const history = [];
        for (const d of dates) {
          const coins = await calculateDayCoins(db, d);
          history.push({
            date: d,
            logs: byDate[d],
            coins_earned: coins,
          });
        }
        return json(history);
      }

      if (req.method === "POST") {
        const body = await req.json();
        const { item_id, check_date, checked, comment } = body;

        const oldCoins = await calculateDayCoins(db, check_date);

        const { error } = await db
          .from("tally_checklist_logs")
          .upsert(
            { item_id, check_date, checked, comment: comment || "" },
            { onConflict: "item_id,check_date" }
          );
        if (error) return json({ error: error.message }, 400);

        const newCoins = await calculateDayCoins(db, check_date);
        const delta = newCoins - oldCoins;

        if (delta !== 0) {
          const { data: settings } = await db
            .from("tally_settings")
            .select("coins_balance")
            .single();
          if (settings) {
            await db
              .from("tally_settings")
              .update({
                coins_balance: (settings.coins_balance || 0) + delta,
                updated_at: new Date().toISOString(),
              })
              .eq("id", 1);
          }
        }

        return json({ ok: true, coins_today: newCoins, coins_delta: delta });
      }
    }

    // ---- ENTRIES ----
    if (resource === "entries") {
      if (req.method === "GET") {
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const month = url.searchParams.get("month");
        let q = db.from("tally_entries").select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
        if (month) {
          q = q.gte("created_at", `${month}-01`).lt("created_at", `${month}-32`);
        }
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (req.method === "POST") {
        const body = await req.json();
        const { data, error } = await db.from("tally_entries").insert(body).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
      if (req.method === "PATCH" && id) {
        const body = await req.json();
        const { data, error } = await db.from("tally_entries").update(body).eq("id", id).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (req.method === "DELETE" && id) {
        const { error } = await db.from("tally_entries").delete().eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
    }

    // ---- REVIEWS ----
    if (resource === "reviews") {
      if (req.method === "GET") {
        const { data, error } = await db.from("tally_reviews").select("*").order("created_at", { ascending: false }).limit(20);
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (req.method === "POST") {
        const body = await req.json();
        const { data, error } = await db.from("tally_reviews").insert(body).select().single();
        if (error) return json({ error: error.message }, 400);
        if (body.coins_earned) {
          await db.rpc("increment_balance", { amount: body.coins_earned }).catch(() => {});
          const { data: settings } = await db.from("tally_settings").select("coins_balance").single();
          if (settings) {
            await db.from("tally_settings").update({ coins_balance: (settings.coins_balance || 0) + body.coins_earned, updated_at: new Date().toISOString() }).eq("id", 1);
          }
        }
        return json(data, 201);
      }
    }

    // ---- REWARDS (Gacha) ----
    if (resource === "rewards") {
      if (req.method === "GET") {
        const { data, error } = await db.from("tally_rewards").select("*").order("created_at", { ascending: false }).limit(50);
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (req.method === "POST") {
        const body = await req.json();
        const cost = body.coins_spent || 5;
        const { data: settings } = await db.from("tally_settings").select("coins_balance").single();
        if (!settings || settings.coins_balance < cost) {
          return json({ error: "Not enough coins" }, 400);
        }
        const { data, error } = await db.from("tally_rewards").insert(body).select().single();
        if (error) return json({ error: error.message }, 400);
        await db.from("tally_settings").update({ coins_balance: settings.coins_balance - cost, updated_at: new Date().toISOString() }).eq("id", 1);
        return json(data, 201);
      }
    }

    // ---- WISHES ----
    if (resource === "wishes") {
      if (req.method === "GET") {
        const { data, error } = await db.from("tally_wishes").select("*").order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (req.method === "POST") {
        const body = await req.json();
        const { data, error } = await db.from("tally_wishes").insert(body).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }
      if (req.method === "PATCH" && id) {
        const body = await req.json();
        if (body.add_coins) {
          const amount = body.add_coins;
          delete body.add_coins;
          const { data: settings } = await db.from("tally_settings").select("coins_balance").single();
          if (!settings || settings.coins_balance < amount) {
            return json({ error: "Not enough coins" }, 400);
          }
          const { data: wish } = await db.from("tally_wishes").select("coins_saved, coins_target").eq("id", id).single();
          if (wish) {
            body.coins_saved = (wish.coins_saved || 0) + amount;
            if (body.coins_saved >= wish.coins_target) {
              body.status = "reached";
            }
          }
          await db.from("tally_settings").update({ coins_balance: settings.coins_balance - amount, updated_at: new Date().toISOString() }).eq("id", 1);
        }
        const { data, error } = await db.from("tally_wishes").update(body).eq("id", id).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (req.method === "DELETE" && id) {
        const { data: wish } = await db.from("tally_wishes").select("coins_saved").eq("id", id).single();
        if (wish && wish.coins_saved > 0) {
          const { data: settings } = await db.from("tally_settings").select("coins_balance").single();
          if (settings) {
            await db.from("tally_settings").update({ coins_balance: settings.coins_balance + wish.coins_saved, updated_at: new Date().toISOString() }).eq("id", 1);
          }
        }
        const { error } = await db.from("tally_wishes").delete().eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
    }

    // ---- SETTINGS ----
    if (resource === "settings") {
      if (req.method === "GET") {
        const { data, error } = await db.from("tally_settings").select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
      if (req.method === "PATCH") {
        const body = await req.json();
        body.updated_at = new Date().toISOString();
        const { data, error } = await db.from("tally_settings").update(body).eq("id", 1).select().single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
