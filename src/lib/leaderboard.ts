import { supabaseAdmin } from "@/lib/supabase/admin";

type PublicAdversaryRow = {
  id: number;
  name: string;
  tier: number;
  type: string;
  user_id: number;
  updated_at: string | null;
};

type UserRow = {
  id: number;
  email: string | null;
  username: string | null;
  name: string | null;
};

export type TopLikedContribution = {
  id: number;
  name: string;
  tier: number;
  type: string;
  likeCount: number;
  creatorName: string;
};

export type TopContributor = {
  userId: number;
  name: string;
  contributionCount: number;
  totalLikes: number;
};

function displayName(user: UserRow | undefined) {
  if (!user) return "Unknown";
  return user.name?.trim() || user.username?.trim() || user.email?.split("@")[0] || "Unknown";
}

function toTimestamp(value: string | null) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export async function getHomepageLeaderboard(limit = 5): Promise<{
  topLiked: TopLikedContribution[];
  topContributors: TopContributor[];
}> {
  try {
    const { data: adversaryRaw, error: adversaryError } = await supabaseAdmin
      .from("adversaries")
      .select("id,name,tier,type,user_id,updated_at")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .range(0, 999);

    if (adversaryError) {
      return { topLiked: [], topContributors: [] };
    }

    const adversaries = (adversaryRaw ?? []) as PublicAdversaryRow[];
    if (!adversaries.length) {
      return { topLiked: [], topContributors: [] };
    }

    const adversaryIds = Array.from(new Set(adversaries.map((adversary) => Number(adversary.id))));
    const userIds = Array.from(new Set(adversaries.map((adversary) => Number(adversary.user_id))));

    const [favouritesResult, usersResult] = await Promise.all([
      adversaryIds.length
        ? supabaseAdmin
            .from("adversary_favourites")
            .select("adversary_id")
            .in("adversary_id", adversaryIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? supabaseAdmin
            .from("users")
            .select("id,email,username,name")
            .in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const likeCountByAdversary = new Map<number, number>();
    for (const row of (favouritesResult.data ?? []) as Array<{ adversary_id: number }>) {
      const id = Number(row.adversary_id);
      likeCountByAdversary.set(id, (likeCountByAdversary.get(id) ?? 0) + 1);
    }

    const usersById = new Map<number, UserRow>();
    for (const user of (usersResult.data ?? []) as UserRow[]) {
      usersById.set(Number(user.id), user);
    }

    const topLiked = adversaries
      .map((adversary) => {
        const id = Number(adversary.id);
        const creatorId = Number(adversary.user_id);
        return {
          id,
          name: adversary.name,
          tier: Number(adversary.tier),
          type: adversary.type,
          likeCount: likeCountByAdversary.get(id) ?? 0,
          creatorName: displayName(usersById.get(creatorId)),
          updatedAt: toTimestamp(adversary.updated_at),
        };
      })
      .sort((a, b) => b.likeCount - a.likeCount || b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        tier: entry.tier,
        type: entry.type,
        likeCount: entry.likeCount,
        creatorName: entry.creatorName,
      }));

    const contributorMap = new Map<number, TopContributor>();
    for (const adversary of adversaries) {
      const userId = Number(adversary.user_id);
      const current = contributorMap.get(userId) ?? {
        userId,
        name: displayName(usersById.get(userId)),
        contributionCount: 0,
        totalLikes: 0,
      };

      current.contributionCount += 1;
      current.totalLikes += likeCountByAdversary.get(Number(adversary.id)) ?? 0;
      contributorMap.set(userId, current);
    }

    const topContributors = Array.from(contributorMap.values())
      .sort(
        (a, b) =>
          b.contributionCount - a.contributionCount ||
          b.totalLikes - a.totalLikes ||
          a.name.localeCompare(b.name)
      )
      .slice(0, limit);

    return { topLiked, topContributors };
  } catch {
    return { topLiked: [], topContributors: [] };
  }
}
