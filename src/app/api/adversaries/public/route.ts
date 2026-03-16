import { NextRequest, NextResponse } from "next/server";
import { mapAdversaryRow } from "@/lib/adversaries";
import { getOrCreateAppUser, getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

function toNumber(value: string | null, fallback: number) {
  const n = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const search = params.get("search")?.trim() ?? "";
  const type = params.get("type")?.trim() ?? "";
  const tags = params.get("tags")?.trim().toLowerCase() ?? "";
  const sort = params.get("sort")?.trim() ?? "newest";
  const tier = toNumber(params.get("tier"), 0);
  const page = Math.max(1, toNumber(params.get("page"), 1));
  const limit = Math.min(50, Math.max(1, toNumber(params.get("limit"), 20)));
  const offset = (page - 1) * limit;

  const authUser = await getSessionUser();
  const appUser = authUser ? await getOrCreateAppUser(authUser) : null;

  let query = supabaseAdmin
    .from("adversaries")
    .select("*", { count: "exact" })
    .eq("is_public", true)
    .range(offset, offset + limit - 1);

  if (sort === "oldest") {
    query = query.order("updated_at", { ascending: true });
  } else if (sort === "name_asc") {
    query = query.order("name", { ascending: true });
  } else if (sort === "name_desc") {
    query = query.order("name", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }
  if (type) {
    query = query.eq("type", type);
  }
  if (tier > 0) {
    query = query.eq("tier", tier);
  }
  if (tags) {
    query = query.ilike("tags", `%${tags}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const ids = rows.map((row) => Number(row.id));
  const counts: Record<number, number> = {};

  const myFavourites = new Set<number>();
  if (ids.length > 0) {
    const { data: favourites, error: favouriteError } = await supabaseAdmin
      .from("adversary_favourites")
      .select("adversary_id,user_id")
      .in("adversary_id", ids);

    if (!favouriteError) {
      for (const favourite of (favourites ?? []) as Array<{ adversary_id: number; user_id: number }>) {
        const id = favourite.adversary_id;
        counts[id] = (counts[id] ?? 0) + 1;
        if (appUser && favourite.user_id === appUser.id) {
          myFavourites.add(id);
        }
      }
    }
  }

  const items = rows.map((row) => ({
    ...mapAdversaryRow(row),
    favouriteCount: counts[Number(row.id)] ?? 0,
    favourited: myFavourites.has(Number(row.id)),
  }));

  return NextResponse.json({
    items,
    page,
    limit,
    total: count ?? items.length,
    hasMore: offset + items.length < (count ?? items.length),
  });
}
