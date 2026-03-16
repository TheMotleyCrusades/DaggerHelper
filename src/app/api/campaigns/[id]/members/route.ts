import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAppUser } from "@/lib/auth";
import { campaignMemberRemoveSchema, mapCampaignMemberRow } from "@/lib/campaigns";
import { supabaseAdmin } from "@/lib/supabase/admin";

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["gm", "player"]).default("player"),
});

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid campaign id");
  }
  return id;
}

async function requireOwnedCampaign(campaignId: number, ownerId: number) {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("id,user_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.user_id !== ownerId) return null;
  return data;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const campaignId = parseId((await params).id);
    const campaign = await requireOwnedCampaign(campaignId, appUser.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const { data: members, error } = await supabaseAdmin
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("joined_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (members ?? []) as Array<Record<string, unknown>>;
    const userIds = rows.map((member) => Number(member.user_id));

    let usersById = new Map<number, { email: string; username: string | null; name: string | null }>();
    if (userIds.length) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id,email,username,name")
        .in("id", userIds);

      usersById = new Map(
        ((users ?? []) as Array<{ id: number; email: string; username: string | null; name: string | null }>).map(
          (user) => [user.id, { email: user.email, username: user.username, name: user.name }]
        )
      );
    }

    return NextResponse.json(
      rows.map((row) => {
        const mapped = mapCampaignMemberRow(row);
        const userId = Number(mapped.userId);
        return {
          ...mapped,
          user: usersById.get(userId) ?? null,
        };
      })
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const campaignId = parseId((await params).id);
    const campaign = await requireOwnedCampaign(campaignId, appUser.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }
    if (!user) {
      return NextResponse.json({ error: "User not found for that email" }, { status: 404 });
    }

    const { error: memberError } = await supabaseAdmin.from("campaign_members").upsert(
      {
        campaign_id: campaignId,
        user_id: user.id,
        role: parsed.data.role,
      },
      { onConflict: "campaign_id,user_id" }
    );

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { appUser } = await requireAppUser();
    const campaignId = parseId((await params).id);
    const campaign = await requireOwnedCampaign(campaignId, appUser.id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = campaignMemberRemoveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    if (parsed.data.userId === appUser.id) {
      return NextResponse.json({ error: "GM cannot remove self" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("campaign_members")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("user_id", parsed.data.userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
