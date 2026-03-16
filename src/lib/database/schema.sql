-- Runtime schema migration for equipment library + inventory/loadout system.
-- This migration is non-destructive and compatible with existing integer-based ids.

create extension if not exists pgcrypto;

-- Equipment scope and inventory enums.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'equipment_scope') then
    create type equipment_scope as enum ('official', 'personal', 'campaign');
  end if;
  if not exists (select 1 from pg_type where typname = 'weapon_category') then
    create type weapon_category as enum ('primary', 'secondary');
  end if;
  if not exists (select 1 from pg_type where typname = 'item_rarity') then
    create type item_rarity as enum ('common', 'uncommon', 'rare', 'legendary');
  end if;
  if not exists (select 1 from pg_type where typname = 'item_category') then
    create type item_category as enum ('loot', 'recipe', 'relic', 'attachment', 'tool', 'wearable', 'utility');
  end if;
  if not exists (select 1 from pg_type where typname = 'consumable_category') then
    create type consumable_category as enum ('potion', 'poison', 'salve', 'bomb', 'food', 'scroll', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'inventory_entity_kind') then
    create type inventory_entity_kind as enum ('weapon', 'armor', 'item', 'consumable');
  end if;
  if not exists (select 1 from pg_type where typname = 'inventory_equipped_slot') then
    create type inventory_equipped_slot as enum ('primary_weapon', 'secondary_weapon', 'armor');
  end if;
  if not exists (select 1 from pg_type where typname = 'hud_session_status') then
    create type hud_session_status as enum ('idle', 'active', 'paused', 'complete');
  end if;
  if not exists (select 1 from pg_type where typname = 'hud_instance_visibility') then
    create type hud_instance_visibility as enum ('active', 'hidden', 'escaped', 'defeated');
  end if;
end $$;

-- Weapons (v2 table shape; preserves legacy columns if present).
create table if not exists weapons (
  id uuid primary key default gen_random_uuid()
);

alter table weapons add column if not exists lineage_key text;
alter table weapons add column if not exists scope equipment_scope default 'campaign';
alter table weapons add column if not exists owner_user_id bigint null;
alter table weapons add column if not exists campaign_id bigint null;
alter table weapons add column if not exists parent_id uuid null;
alter table weapons add column if not exists slug text;
alter table weapons add column if not exists name text;
alter table weapons add column if not exists tier integer default 1;
alter table weapons add column if not exists weapon_category weapon_category default 'primary';
alter table weapons add column if not exists weapon_subtype text default 'standard';
alter table weapons add column if not exists requires_spellcast boolean default false;
alter table weapons add column if not exists burden_hands integer default 1;
alter table weapons add column if not exists default_profile jsonb default '{}'::jsonb;
alter table weapons add column if not exists alternate_profiles jsonb default '[]'::jsonb;
alter table weapons add column if not exists sheet_modifiers jsonb default '{}'::jsonb;
alter table weapons add column if not exists feature_name text null;
alter table weapons add column if not exists feature_text text default '';
alter table weapons add column if not exists tags jsonb default '[]'::jsonb;
alter table weapons add column if not exists source_book text default 'Custom';
alter table weapons add column if not exists source_page integer null;
alter table weapons add column if not exists is_archived boolean default false;
alter table weapons add column if not exists created_at timestamptz default now();
alter table weapons add column if not exists updated_at timestamptz default now();

-- Armor (v2 table shape).
create table if not exists armor (
  id uuid primary key default gen_random_uuid()
);

alter table armor add column if not exists lineage_key text;
alter table armor add column if not exists scope equipment_scope default 'campaign';
alter table armor add column if not exists owner_user_id bigint null;
alter table armor add column if not exists campaign_id bigint null;
alter table armor add column if not exists parent_id uuid null;
alter table armor add column if not exists slug text;
alter table armor add column if not exists name text;
alter table armor add column if not exists tier integer default 1;
alter table armor add column if not exists base_major_threshold integer default 0;
alter table armor add column if not exists base_severe_threshold integer default 0;
alter table armor add column if not exists base_armor_score integer default 0;
alter table armor add column if not exists sheet_modifiers jsonb default '{}'::jsonb;
alter table armor add column if not exists feature_name text null;
alter table armor add column if not exists feature_text text default '';
alter table armor add column if not exists tags jsonb default '[]'::jsonb;
alter table armor add column if not exists source_book text default 'Custom';
alter table armor add column if not exists source_page integer null;
alter table armor add column if not exists is_archived boolean default false;
alter table armor add column if not exists created_at timestamptz default now();
alter table armor add column if not exists updated_at timestamptz default now();

-- Items (v2 table shape).
do $$
declare
  items_id_type text;
begin
  select data_type
    into items_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'items'
    and column_name = 'id';

  if items_id_type = 'integer' then
    drop table if exists items;
  end if;
end $$;

create table if not exists items (
  id uuid primary key default gen_random_uuid()
);

alter table items add column if not exists lineage_key text;
alter table items add column if not exists scope equipment_scope default 'campaign';
alter table items add column if not exists owner_user_id bigint null;
alter table items add column if not exists campaign_id bigint null;
alter table items add column if not exists parent_id uuid null;
alter table items add column if not exists slug text;
alter table items add column if not exists name text;
alter table items add column if not exists rarity item_rarity default 'common';
alter table items add column if not exists roll_value integer null;
alter table items add column if not exists item_category item_category default 'utility';
alter table items add column if not exists can_equip boolean default false;
alter table items add column if not exists equip_label text null;
alter table items add column if not exists stack_limit integer default 1;
alter table items add column if not exists sheet_modifiers jsonb default '{}'::jsonb;
alter table items add column if not exists usage_payload jsonb default '{}'::jsonb;
alter table items add column if not exists rules_text text default '';
alter table items add column if not exists tags jsonb default '[]'::jsonb;
alter table items add column if not exists source_book text default 'Custom';
alter table items add column if not exists source_page integer null;
alter table items add column if not exists is_archived boolean default false;
alter table items add column if not exists created_at timestamptz default now();
alter table items add column if not exists updated_at timestamptz default now();

-- Consumables (new).
create table if not exists consumables (
  id uuid primary key default gen_random_uuid(),
  lineage_key text not null,
  scope equipment_scope not null default 'campaign',
  owner_user_id bigint null,
  campaign_id bigint null,
  parent_id uuid null,
  slug text not null,
  name text not null,
  rarity item_rarity not null default 'common',
  roll_value integer null,
  consumable_category consumable_category not null default 'other',
  stack_limit integer not null default 5,
  usage_payload jsonb not null default '{}'::jsonb,
  rules_text text not null default '',
  tags jsonb not null default '[]'::jsonb,
  source_book text not null default 'Custom',
  source_page integer null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Character inventory entries (new canonical loadout/inventory store).
create table if not exists character_inventory_entries (
  id uuid primary key default gen_random_uuid(),
  character_id bigint not null,
  entity_kind inventory_entity_kind not null,
  entity_id uuid not null,
  quantity integer not null default 1,
  is_equipped boolean not null default false,
  equipped_slot inventory_equipped_slot null,
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Campaign GM HUD runtime state.
create table if not exists campaign_hud_states (
  campaign_id bigint primary key,
  source_encounter_id bigint null,
  encounter_name text null,
  status hud_session_status not null default 'idle',
  settings jsonb not null default '{}'::jsonb,
  scene_notes text null,
  updated_by_user_id bigint null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_hud_character_overlays (
  campaign_id bigint not null,
  character_id bigint not null,
  tracked_fields jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  gm_notes text null,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, character_id)
);

create table if not exists campaign_hud_adversary_instances (
  id uuid primary key default gen_random_uuid(),
  campaign_id bigint not null,
  adversary_id bigint not null,
  source_encounter_id bigint null,
  display_name text not null,
  hp_current integer null,
  stress_current integer null,
  conditions jsonb not null default '[]'::jsonb,
  gm_notes text null,
  visibility hud_instance_visibility not null default 'active',
  wave_label text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes for catalog and inventory lookups.
create index if not exists idx_weapons_scope_campaign on weapons(scope, campaign_id);
create index if not exists idx_weapons_owner on weapons(owner_user_id);
create index if not exists idx_weapons_lineage on weapons(lineage_key);
create index if not exists idx_weapons_archived on weapons(is_archived);

create index if not exists idx_armor_scope_campaign on armor(scope, campaign_id);
create index if not exists idx_armor_owner on armor(owner_user_id);
create index if not exists idx_armor_lineage on armor(lineage_key);
create index if not exists idx_armor_archived on armor(is_archived);

create index if not exists idx_items_scope_campaign on items(scope, campaign_id);
create index if not exists idx_items_owner on items(owner_user_id);
create index if not exists idx_items_lineage on items(lineage_key);
create index if not exists idx_items_archived on items(is_archived);

create index if not exists idx_consumables_scope_campaign on consumables(scope, campaign_id);
create index if not exists idx_consumables_owner on consumables(owner_user_id);
create index if not exists idx_consumables_lineage on consumables(lineage_key);
create index if not exists idx_consumables_archived on consumables(is_archived);

create index if not exists idx_inventory_character on character_inventory_entries(character_id);
create index if not exists idx_inventory_entity on character_inventory_entries(entity_kind, entity_id);
create index if not exists idx_inventory_equipped on character_inventory_entries(character_id, is_equipped, equipped_slot);
create index if not exists idx_inventory_sort on character_inventory_entries(character_id, sort_order);

create index if not exists idx_hud_char_overlays_campaign on campaign_hud_character_overlays(campaign_id);
create index if not exists idx_hud_instances_campaign on campaign_hud_adversary_instances(campaign_id, sort_order);
create index if not exists idx_hud_instances_adversary on campaign_hud_adversary_instances(adversary_id);
create index if not exists idx_hud_states_updated on campaign_hud_states(updated_at);

-- Content platform foundation enums.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'publisher_type') then
    create type publisher_type as enum ('official', 'creator');
  end if;
  if not exists (select 1 from pg_type where typname = 'product_access') then
    create type product_access as enum ('free', 'paid');
  end if;
  if not exists (select 1 from pg_type where typname = 'catalog_visibility') then
    create type catalog_visibility as enum ('draft', 'listed', 'delisted');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_visibility') then
    create type document_visibility as enum ('public_teaser', 'entitled_full');
  end if;
  if not exists (select 1 from pg_type where typname = 'entitlement_status') then
    create type entitlement_status as enum ('active', 'revoked');
  end if;
  if not exists (select 1 from pg_type where typname = 'entitlement_source') then
    create type entitlement_source as enum ('claim', 'purchase', 'grant', 'import');
  end if;
  if not exists (select 1 from pg_type where typname = 'install_suggestion_status') then
    create type install_suggestion_status as enum ('pending', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'content_report_status') then
    create type content_report_status as enum ('open', 'resolved', 'dismissed');
  end if;
  if not exists (select 1 from pg_type where typname = 'moderation_action_type') then
    create type moderation_action_type as enum ('dismiss', 'warn', 'delist', 'restrict');
  end if;
end $$;

-- Generic creator content table for metadata-driven entities.
create table if not exists homebrew_entities (
  id uuid primary key default gen_random_uuid(),
  lineage_key text not null,
  entity_kind text not null,
  scope equipment_scope not null default 'personal',
  owner_user_id bigint null,
  campaign_id bigint null,
  slug text not null,
  name text not null,
  description text not null default '',
  payload jsonb not null default '{}'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  source_product_id uuid null,
  source_product_version_id uuid null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Product and version catalogs.
create table if not exists content_products (
  id uuid primary key default gen_random_uuid(),
  owner_user_id bigint null,
  publisher publisher_type not null default 'creator',
  access product_access not null default 'free',
  visibility catalog_visibility not null default 'draft',
  title text not null,
  slug text not null,
  summary text not null default '',
  cover_image_url text null,
  teaser text not null default '',
  is_hidden boolean not null default false,
  stripe_product_id text null,
  stripe_account_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  version_number integer not null default 1,
  version_label text not null default '',
  release_notes text not null default '',
  is_published boolean not null default false,
  published_at timestamptz null,
  snapshot_payload jsonb not null default '{}'::jsonb,
  stripe_price_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_bundle_items (
  id uuid primary key default gen_random_uuid(),
  product_version_id uuid not null,
  entity_kind text not null,
  source_entity_id uuid null,
  source_table text null,
  lineage_key text null,
  payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists content_documents (
  id uuid primary key default gen_random_uuid(),
  product_version_id uuid not null,
  parent_document_id uuid null,
  slug text not null,
  title text not null,
  body_markdown text not null default '',
  teaser_markdown text not null default '',
  visibility document_visibility not null default 'entitled_full',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_content_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null,
  product_id uuid not null,
  product_version_id uuid null,
  source entitlement_source not null default 'claim',
  status entitlement_status not null default 'active',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists campaign_content_installs (
  id uuid primary key default gen_random_uuid(),
  campaign_id bigint not null,
  product_id uuid not null,
  product_version_id uuid not null,
  installed_by_user_id bigint not null,
  install_order integer not null default 0,
  source text not null default 'install',
  is_archived boolean not null default false,
  archived_at timestamptz null,
  snapshot_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_install_suggestions (
  id uuid primary key default gen_random_uuid(),
  campaign_id bigint not null,
  suggested_by_user_id bigint not null,
  product_id uuid not null,
  product_version_id uuid null,
  note text not null default '',
  status install_suggestion_status not null default 'pending',
  reviewed_by_user_id bigint null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bundle_reactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  user_id bigint not null,
  reaction text not null default 'like',
  created_at timestamptz not null default now(),
  unique (product_id, user_id, reaction)
);

create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id bigint not null,
  product_id uuid null,
  entity_kind text null,
  entity_id uuid null,
  reason text not null,
  details text not null default '',
  status content_report_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid null,
  target_product_id uuid null,
  target_entity_kind text null,
  target_entity_id uuid null,
  action moderation_action_type not null,
  note text not null default '',
  acted_by_user_id bigint not null,
  created_at timestamptz not null default now()
);

-- Content foundation indexes.
create index if not exists idx_homebrew_entities_scope_owner on homebrew_entities(scope, owner_user_id);
create index if not exists idx_homebrew_entities_scope_campaign on homebrew_entities(scope, campaign_id);
create index if not exists idx_homebrew_entities_kind on homebrew_entities(entity_kind);
create index if not exists idx_homebrew_entities_lineage on homebrew_entities(lineage_key);
create index if not exists idx_homebrew_entities_archived on homebrew_entities(is_archived);

create index if not exists idx_content_products_owner on content_products(owner_user_id);
create index if not exists idx_content_products_visibility on content_products(visibility, access);
create unique index if not exists idx_content_products_slug_unique on content_products(lower(slug));

create index if not exists idx_content_versions_product on content_product_versions(product_id, version_number desc);
create unique index if not exists idx_content_versions_unique on content_product_versions(product_id, version_number);
create index if not exists idx_content_versions_published on content_product_versions(product_id, is_published, published_at desc);

create index if not exists idx_bundle_items_version on content_bundle_items(product_version_id, sort_order);
create index if not exists idx_documents_version on content_documents(product_version_id, sort_order);
create index if not exists idx_documents_parent on content_documents(parent_document_id);

create index if not exists idx_entitlements_user on user_content_entitlements(user_id, status);
create index if not exists idx_entitlements_product on user_content_entitlements(product_id, status);

create index if not exists idx_campaign_installs_campaign on campaign_content_installs(campaign_id, install_order);
create index if not exists idx_campaign_installs_product on campaign_content_installs(product_id, product_version_id);
create index if not exists idx_campaign_installs_archived on campaign_content_installs(campaign_id, is_archived);

create index if not exists idx_install_suggestions_campaign on campaign_install_suggestions(campaign_id, status);
create index if not exists idx_install_suggestions_user on campaign_install_suggestions(suggested_by_user_id, status);

create index if not exists idx_bundle_reactions_product on bundle_reactions(product_id);
create index if not exists idx_content_reports_status on content_reports(status, created_at desc);
create index if not exists idx_moderation_actions_report on moderation_actions(report_id, created_at desc);

-- NOTE:
-- baseEvasion is stored inside character metadata JSON (characters.description envelope),
-- and therefore does not require a dedicated SQL column migration.
