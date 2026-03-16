import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export type AppUser = {
  id: number;
  email: string;
  username: string | null;
  name: string | null;
  role: string | null;
};

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

const APP_USER_SELECT = "id,email,username,name,role";

async function findAppUserByEmail(email: string): Promise<AppUser | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(APP_USER_SELECT)
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch app user: ${error.message}`);
  }

  return (data as AppUser | null) ?? null;
}

async function waitForAppUserByEmail(email: string) {
  const backoffMs = [40, 120, 240, 500];
  for (const delayMs of backoffMs) {
    const existing = await findAppUserByEmail(email);
    if (existing) {
      return existing;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

export async function getSessionUser(): Promise<User | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) return null;
  return user;
}

export async function getOrCreateAppUser(authUser: User): Promise<AppUser> {
  const email = authUser.email?.toLowerCase().trim();
  if (!email) {
    throw new AuthError("Authenticated user has no email", 400);
  }

  const existing = await findAppUserByEmail(email);
  if (existing) return existing;

  const nameFromMeta =
    (authUser.user_metadata?.name as string | undefined) ??
    (authUser.user_metadata?.full_name as string | undefined) ??
    null;

  const { data: created, error: insertError } = await supabaseAdmin
    .from("users")
    .insert({
      email,
      name: nameFromMeta,
      role: "user",
      last_signed_in: new Date().toISOString(),
    })
    .select(APP_USER_SELECT)
    .single();

  if (insertError?.code === "23505" || insertError?.message.includes("users_email_key")) {
    // Another request created the user row concurrently; wait for replication/visibility.
    const concurrentExisting = await waitForAppUserByEmail(email);
    if (concurrentExisting) {
      return concurrentExisting;
    }

    // Last-resort reconciliation: ignore duplicates, then refetch.
    const { error: reconcileInsertError } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          email,
          name: nameFromMeta,
          role: "user",
          last_signed_in: new Date().toISOString(),
        },
        { onConflict: "email", ignoreDuplicates: true }
      )
      .select("id");

    if (reconcileInsertError) {
      throw new Error(reconcileInsertError.message);
    }

    const reconciled = await waitForAppUserByEmail(email);
    if (!reconciled) {
      throw new Error("Failed to fetch app user after concurrent creation");
    }

    return reconciled;
  }

  if (insertError || !created) {
    throw new Error(insertError?.message ?? "Failed to create app user");
  }

  return created as AppUser;
}

export async function requireAppUser() {
  const authUser = await getSessionUser();
  if (!authUser) {
    throw new AuthError("Unauthorized", 401);
  }

  const appUser = await getOrCreateAppUser(authUser);
  return { authUser, appUser };
}
