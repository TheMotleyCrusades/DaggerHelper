"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { VisibilitySurface } from "@/lib/campaign-metadata";
import { TRAIT_KEYS } from "@/lib/constants/classes";
import type {
  HomebrewConditionRecord,
  HomebrewEntityRecord,
  HomebrewResourceTemplateRecord,
  HomebrewSkillRecord,
  HomebrewSubclassRecord,
} from "@/lib/homebrew-library";

type LibraryTabId =
  | "classes"
  | "subclasses"
  | "ancestries"
  | "communities"
  | "items"
  | "skills"
  | "conditions"
  | "resourceTemplates";

type EntityFormState = {
  name: string;
  description: string;
  tags: string;
};

type SubclassFormState = {
  name: string;
  description: string;
  tags: string;
  classId: string;
  spellcastTrait: string;
};

type SkillFormState = {
  label: string;
  helperText: string;
  traits: string[];
};

type ConditionFormState = {
  name: string;
  description: string;
  playerToggle: boolean;
  visibleToPlayers: boolean;
};

type ResourceTemplateFormState = {
  label: string;
  defaultCurrent: number;
  defaultMax: number;
  min: number;
  max: number;
  format: "current_max" | "single" | "checkbox";
  playerEditable: boolean;
  allowPermanentShift: boolean;
  allowTemporaryModifiers: boolean;
  visibleOn: VisibilitySurface;
};

const TAB_LABELS: Array<{ id: LibraryTabId; label: string }> = [
  { id: "classes", label: "Classes" },
  { id: "subclasses", label: "Subclasses" },
  { id: "ancestries", label: "Ancestries" },
  { id: "communities", label: "Communities" },
  { id: "items", label: "Items" },
  { id: "skills", label: "Skills" },
  { id: "conditions", label: "Conditions" },
  { id: "resourceTemplates", label: "Resource Templates" },
];

const EMPTY_ENTITY_FORM: EntityFormState = {
  name: "",
  description: "",
  tags: "",
};

const EMPTY_SUBCLASS_FORM: SubclassFormState = {
  name: "",
  description: "",
  tags: "",
  classId: "",
  spellcastTrait: "",
};

const EMPTY_SKILL_FORM: SkillFormState = {
  label: "",
  helperText: "",
  traits: ["instinct"],
};

const EMPTY_CONDITION_FORM: ConditionFormState = {
  name: "",
  description: "",
  playerToggle: true,
  visibleToPlayers: true,
};

const EMPTY_VISIBILITY: VisibilitySurface = {
  builder: true,
  sheet: true,
  editor: true,
  pdf: true,
  share: true,
};

const EMPTY_RESOURCE_TEMPLATE_FORM: ResourceTemplateFormState = {
  label: "",
  defaultCurrent: 0,
  defaultMax: 0,
  min: 0,
  max: 99,
  format: "current_max",
  playerEditable: true,
  allowPermanentShift: false,
  allowTemporaryModifiers: true,
  visibleOn: { ...EMPTY_VISIBILITY },
};

function parseTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function tagsToInput(tags: string[]) {
  return tags.join(", ");
}

function readApiError(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;

  const payload = data as {
    error?:
      | string
      | {
          formErrors?: string[];
          fieldErrors?: Record<string, string[]>;
        };
  };

  if (typeof payload.error === "string") {
    return payload.error;
  }

  const formError = payload.error?.formErrors?.[0];
  if (formError) return formError;

  const fieldError = payload.error?.fieldErrors
    ? Object.values(payload.error.fieldErrors)
        .flat()
        .find((entry) => typeof entry === "string" && entry.trim())
    : null;
  if (fieldError) return fieldError;

  return fallback;
}

function normalizedIncludes(haystack: string, search: string) {
  if (!search) return true;
  return haystack.toLowerCase().includes(search);
}

function sortedByName<T extends { name: string }>(records: T[]) {
  return [...records].sort((left, right) => left.name.localeCompare(right.name));
}

function sortedByLabel<T extends { label: string }>(records: T[]) {
  return [...records].sort((left, right) => left.label.localeCompare(right.label));
}

function isOwnedRecord(
  campaignId: number,
  record: { isOfficial?: boolean; campaignId?: number | null }
) {
  return !record.isOfficial && record.campaignId === campaignId;
}

function ensurePositiveInt(value: number, fallback = 0) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value));
}

function applyNumberInput(value: string, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

async function parseResponseData(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function HomebrewLibraryManagement({ campaignId }: { campaignId: number }) {
  const [activeTab, setActiveTab] = useState<LibraryTabId>("classes");
  const [search, setSearch] = useState("");
  const [showOfficial, setShowOfficial] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [classes, setClasses] = useState<HomebrewEntityRecord[]>([]);
  const [subclasses, setSubclasses] = useState<HomebrewSubclassRecord[]>([]);
  const [ancestries, setAncestries] = useState<HomebrewEntityRecord[]>([]);
  const [communities, setCommunities] = useState<HomebrewEntityRecord[]>([]);
  const [items, setItems] = useState<HomebrewEntityRecord[]>([]);
  const [skills, setSkills] = useState<HomebrewSkillRecord[]>([]);
  const [conditions, setConditions] = useState<HomebrewConditionRecord[]>([]);
  const [resourceTemplates, setResourceTemplates] = useState<HomebrewResourceTemplateRecord[]>(
    []
  );

  const [classForm, setClassForm] = useState<EntityFormState>(EMPTY_ENTITY_FORM);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  const [subclassForm, setSubclassForm] = useState<SubclassFormState>(EMPTY_SUBCLASS_FORM);
  const [editingSubclassId, setEditingSubclassId] = useState<string | null>(null);

  const [ancestryForm, setAncestryForm] = useState<EntityFormState>(EMPTY_ENTITY_FORM);
  const [editingAncestryId, setEditingAncestryId] = useState<string | null>(null);

  const [communityForm, setCommunityForm] = useState<EntityFormState>(EMPTY_ENTITY_FORM);
  const [editingCommunityId, setEditingCommunityId] = useState<string | null>(null);

  const [itemForm, setItemForm] = useState<EntityFormState>(EMPTY_ENTITY_FORM);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [skillForm, setSkillForm] = useState<SkillFormState>(EMPTY_SKILL_FORM);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  const [conditionForm, setConditionForm] = useState<ConditionFormState>(EMPTY_CONDITION_FORM);
  const [editingConditionId, setEditingConditionId] = useState<string | null>(null);

  const [resourceTemplateForm, setResourceTemplateForm] = useState<ResourceTemplateFormState>(
    EMPTY_RESOURCE_TEMPLATE_FORM
  );
  const [editingResourceTemplateId, setEditingResourceTemplateId] = useState<string | null>(null);

  const classNameById = useMemo(
    () => new Map(classes.map((item) => [item.id, item.name])),
    [classes]
  );

  const showOfficialToggle =
    activeTab === "classes" ||
    activeTab === "subclasses" ||
    activeTab === "ancestries" ||
    activeTab === "communities";

  const loadLibraries = useCallback(async () => {
    setLoading(true);
    try {
      const query = `?campaignId=${campaignId}`;
      const responses = await Promise.all([
        fetch(`/api/classes${query}`, { cache: "no-store" }),
        fetch(`/api/subclasses${query}`, { cache: "no-store" }),
        fetch(`/api/ancestries${query}`, { cache: "no-store" }),
        fetch(`/api/communities${query}`, { cache: "no-store" }),
        fetch(`/api/items${query}`, { cache: "no-store" }),
        fetch(`/api/skills${query}`, { cache: "no-store" }),
        fetch(`/api/conditions${query}`, { cache: "no-store" }),
        fetch(`/api/resource-templates${query}`, { cache: "no-store" }),
      ]);

      const payloads = await Promise.all(responses.map((response) => parseResponseData(response)));
      const failedIndex = responses.findIndex((response) => !response.ok);

      if (failedIndex >= 0) {
        const message = readApiError(payloads[failedIndex], "Failed to load homebrew library");
        throw new Error(message);
      }

      setClasses(Array.isArray(payloads[0]) ? sortedByName(payloads[0]) : []);
      setSubclasses(Array.isArray(payloads[1]) ? sortedByName(payloads[1]) : []);
      setAncestries(Array.isArray(payloads[2]) ? sortedByName(payloads[2]) : []);
      setCommunities(Array.isArray(payloads[3]) ? sortedByName(payloads[3]) : []);
      setItems(Array.isArray(payloads[4]) ? sortedByName(payloads[4]) : []);
      setSkills(Array.isArray(payloads[5]) ? sortedByLabel(payloads[5]) : []);
      setConditions(Array.isArray(payloads[6]) ? sortedByName(payloads[6]) : []);
      setResourceTemplates(Array.isArray(payloads[7]) ? sortedByLabel(payloads[7]) : []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load homebrew library");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadLibraries();
  }, [loadLibraries]);

  async function runMutation(
    url: string,
    method: "POST" | "PUT" | "DELETE",
    body: Record<string, unknown> | null,
    fallbackError: string
  ) {
    setBusy(true);

    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await parseResponseData(response);
      if (!response.ok) {
        throw new Error(readApiError(data, fallbackError));
      }

      await loadLibraries();
      setError(null);
      return true;
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : fallbackError);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const filteredClasses = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return classes.filter((record) => {
      if (!showOfficial && record.isOfficial) return false;
      return (
        normalizedIncludes(record.name, normalized) ||
        normalizedIncludes(record.description, normalized) ||
        record.tags.some((tag) => normalizedIncludes(tag, normalized))
      );
    });
  }, [classes, search, showOfficial]);

  const filteredSubclasses = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return subclasses.filter((record) => {
      if (!showOfficial && record.isOfficial) return false;
      return (
        normalizedIncludes(record.name, normalized) ||
        normalizedIncludes(record.description, normalized) ||
        normalizedIncludes(record.className, normalized) ||
        record.tags.some((tag) => normalizedIncludes(tag, normalized))
      );
    });
  }, [search, showOfficial, subclasses]);

  const filteredAncestries = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return ancestries.filter((record) => {
      if (!showOfficial && record.isOfficial) return false;
      return (
        normalizedIncludes(record.name, normalized) ||
        normalizedIncludes(record.description, normalized) ||
        record.tags.some((tag) => normalizedIncludes(tag, normalized))
      );
    });
  }, [ancestries, search, showOfficial]);

  const filteredCommunities = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return communities.filter((record) => {
      if (!showOfficial && record.isOfficial) return false;
      return (
        normalizedIncludes(record.name, normalized) ||
        normalizedIncludes(record.description, normalized) ||
        record.tags.some((tag) => normalizedIncludes(tag, normalized))
      );
    });
  }, [communities, search, showOfficial]);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return items.filter((record) => {
      return (
        normalizedIncludes(record.name, normalized) ||
        normalizedIncludes(record.description, normalized) ||
        record.tags.some((tag) => normalizedIncludes(tag, normalized))
      );
    });
  }, [items, search]);

  const filteredSkills = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return skills.filter((record) => {
      return (
        normalizedIncludes(record.label, normalized) ||
        normalizedIncludes(record.helperText, normalized) ||
        record.traits.some((trait) => normalizedIncludes(trait, normalized))
      );
    });
  }, [search, skills]);

  const filteredConditions = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return conditions.filter((record) => {
      return (
        normalizedIncludes(record.name, normalized) ||
        normalizedIncludes(record.description, normalized)
      );
    });
  }, [conditions, search]);

  const filteredResourceTemplates = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return resourceTemplates.filter((record) => {
      return (
        normalizedIncludes(record.label, normalized) ||
        normalizedIncludes(record.id, normalized)
      );
    });
  }, [resourceTemplates, search]);

  function beginEntityEdit(
    type: "class" | "ancestry" | "community" | "item",
    record: HomebrewEntityRecord
  ) {
    const nextForm = {
      name: record.name,
      description: record.description,
      tags: tagsToInput(record.tags),
    };

    if (type === "class") {
      setClassForm(nextForm);
      setEditingClassId(record.id);
      return;
    }
    if (type === "ancestry") {
      setAncestryForm(nextForm);
      setEditingAncestryId(record.id);
      return;
    }
    if (type === "community") {
      setCommunityForm(nextForm);
      setEditingCommunityId(record.id);
      return;
    }

    setItemForm(nextForm);
    setEditingItemId(record.id);
  }

  function cancelEntityEdit(type: "class" | "ancestry" | "community" | "item") {
    if (type === "class") {
      setClassForm(EMPTY_ENTITY_FORM);
      setEditingClassId(null);
      return;
    }
    if (type === "ancestry") {
      setAncestryForm(EMPTY_ENTITY_FORM);
      setEditingAncestryId(null);
      return;
    }
    if (type === "community") {
      setCommunityForm(EMPTY_ENTITY_FORM);
      setEditingCommunityId(null);
      return;
    }

    setItemForm(EMPTY_ENTITY_FORM);
    setEditingItemId(null);
  }
  async function submitClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: classForm.name.trim(),
      description: classForm.description.trim(),
      tags: parseTags(classForm.tags),
      ...(editingClassId ? {} : { campaignId }),
    };

    const saved = await runMutation(
      editingClassId ? `/api/classes/${editingClassId}` : "/api/classes",
      editingClassId ? "PUT" : "POST",
      payload,
      "Failed to save class"
    );

    if (saved) {
      setClassForm(EMPTY_ENTITY_FORM);
      setEditingClassId(null);
    }
  }

  async function submitAncestry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: ancestryForm.name.trim(),
      description: ancestryForm.description.trim(),
      tags: parseTags(ancestryForm.tags),
      ...(editingAncestryId ? {} : { campaignId }),
    };

    const saved = await runMutation(
      editingAncestryId ? `/api/ancestries/${editingAncestryId}` : "/api/ancestries",
      editingAncestryId ? "PUT" : "POST",
      payload,
      "Failed to save ancestry"
    );

    if (saved) {
      setAncestryForm(EMPTY_ENTITY_FORM);
      setEditingAncestryId(null);
    }
  }

  async function submitCommunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: communityForm.name.trim(),
      description: communityForm.description.trim(),
      tags: parseTags(communityForm.tags),
      ...(editingCommunityId ? {} : { campaignId }),
    };

    const saved = await runMutation(
      editingCommunityId
        ? `/api/communities/${editingCommunityId}`
        : "/api/communities",
      editingCommunityId ? "PUT" : "POST",
      payload,
      "Failed to save community"
    );

    if (saved) {
      setCommunityForm(EMPTY_ENTITY_FORM);
      setEditingCommunityId(null);
    }
  }

  async function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: itemForm.name.trim(),
      description: itemForm.description.trim(),
      tags: parseTags(itemForm.tags),
      ...(editingItemId ? {} : { campaignId }),
    };

    const saved = await runMutation(
      editingItemId ? `/api/items/${editingItemId}` : "/api/items",
      editingItemId ? "PUT" : "POST",
      payload,
      "Failed to save item"
    );

    if (saved) {
      setItemForm(EMPTY_ENTITY_FORM);
      setEditingItemId(null);
    }
  }

  async function submitSubclass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subclassForm.classId.trim()) {
      setError("Select a parent class for the subclass.");
      return;
    }

    const payload = {
      name: subclassForm.name.trim(),
      description: subclassForm.description.trim(),
      tags: parseTags(subclassForm.tags),
      classId: subclassForm.classId.trim(),
      spellcastTrait: subclassForm.spellcastTrait.trim() || undefined,
      ...(editingSubclassId ? {} : { campaignId }),
    };

    const saved = await runMutation(
      editingSubclassId ? `/api/subclasses/${editingSubclassId}` : "/api/subclasses",
      editingSubclassId ? "PUT" : "POST",
      payload,
      "Failed to save subclass"
    );

    if (saved) {
      setSubclassForm(EMPTY_SUBCLASS_FORM);
      setEditingSubclassId(null);
    }
  }

  async function submitSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (skillForm.traits.length === 0) {
      setError("Select at least one trait for this skill.");
      return;
    }

    const payload = {
      label: skillForm.label.trim(),
      helperText: skillForm.helperText.trim(),
      traits: skillForm.traits,
      ...(editingSkillId ? {} : { campaignId }),
    };

    const saved = await runMutation(
      editingSkillId ? `/api/skills/${editingSkillId}` : "/api/skills",
      editingSkillId ? "PUT" : "POST",
      payload,
      "Failed to save skill"
    );

    if (saved) {
      setSkillForm(EMPTY_SKILL_FORM);
      setEditingSkillId(null);
    }
  }

  async function submitCondition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: conditionForm.name.trim(),
      description: conditionForm.description.trim(),
      playerToggle: conditionForm.playerToggle,
      visibleToPlayers: conditionForm.visibleToPlayers,
      ...(editingConditionId ? {} : { campaignId }),
    };

    const saved = await runMutation(
      editingConditionId
        ? `/api/conditions/${editingConditionId}`
        : "/api/conditions",
      editingConditionId ? "PUT" : "POST",
      payload,
      "Failed to save condition"
    );

    if (saved) {
      setConditionForm(EMPTY_CONDITION_FORM);
      setEditingConditionId(null);
    }
  }

  async function submitResourceTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      label: resourceTemplateForm.label.trim(),
      defaultCurrent: ensurePositiveInt(resourceTemplateForm.defaultCurrent),
      defaultMax: ensurePositiveInt(resourceTemplateForm.defaultMax),
      min: ensurePositiveInt(resourceTemplateForm.min),
      max: ensurePositiveInt(resourceTemplateForm.max),
      format: resourceTemplateForm.format,
      playerEditable: resourceTemplateForm.playerEditable,
      allowPermanentShift: resourceTemplateForm.allowPermanentShift,
      allowTemporaryModifiers: resourceTemplateForm.allowTemporaryModifiers,
      visibleOn: resourceTemplateForm.visibleOn,
      ...(editingResourceTemplateId ? {} : { campaignId }),
    };

    const saved = await runMutation(
      editingResourceTemplateId
        ? `/api/resource-templates/${editingResourceTemplateId}`
        : "/api/resource-templates",
      editingResourceTemplateId ? "PUT" : "POST",
      payload,
      "Failed to save resource template"
    );

    if (saved) {
      setResourceTemplateForm(EMPTY_RESOURCE_TEMPLATE_FORM);
      setEditingResourceTemplateId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-300">Loading homebrew library...</p>;
  }

  return (
    <section className="space-y-4">
      <h3 className="text-lg text-amber-200">Homebrew Library Management</h3>
      <p className="text-sm text-slate-300">
        Manage campaign-ready classes, subclasses, ancestries, communities, items, skills,
        conditions, and resource templates with direct forms and list editors.
      </p>

      <div className="grid gap-2 rounded-lg border border-slate-700/50 bg-slate-900/60 p-2 sm:grid-cols-2 lg:grid-cols-4">
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.id}
            className={`min-h-11 rounded-md px-3 py-2 text-sm ${
              activeTab === tab.id
                ? "bg-amber-700/35 text-amber-100"
                : "bg-slate-800/70 text-slate-300"
            }`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="field"
          placeholder="Search current tab"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {showOfficialToggle ? (
          <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showOfficial}
              onChange={(event) => setShowOfficial(event.target.checked)}
            />
            Show official references
          </label>
        ) : (
          <p className="rounded-md border border-slate-700/50 bg-slate-900/65 px-3 py-2 text-sm text-slate-400">
            This tab contains campaign-owned records only.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {activeTab === "classes" && (
        <section className="space-y-3">
          <form
            className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3"
            onSubmit={submitClass}
          >
            <h4 className="text-sm text-amber-100">
              {editingClassId ? "Edit Class" : "Create Class"}
            </h4>
            <label className="block text-xs text-slate-300">
              Name
              <input
                className="field mt-1"
                required
                value={classForm.name}
                onChange={(event) =>
                  setClassForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="block text-xs text-slate-300">
              Description
              <textarea
                className="field mt-1 min-h-24"
                value={classForm.description}
                onChange={(event) =>
                  setClassForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <label className="block text-xs text-slate-300">
              Tags (comma separated)
              <input
                className="field mt-1"
                value={classForm.tags}
                onChange={(event) =>
                  setClassForm((current) => ({ ...current, tags: event.target.value }))
                }
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary min-h-11 px-3 py-2 text-xs" disabled={busy}>
                {busy
                  ? "Saving..."
                  : editingClassId
                    ? "Save Class"
                    : "Create Class"}
              </button>
              {editingClassId && (
                <button
                  className="btn-outline min-h-11 px-3 py-2 text-xs"
                  onClick={() => cancelEntityEdit("class")}
                  type="button"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredClasses.map((record) => {
              const canEdit = isOwnedRecord(campaignId, record);
              return (
                <article
                  key={record.id}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3"
                >
                  <p className="text-sm text-amber-100">{record.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {record.isOfficial ? "Official" : "Campaign"} | {record.id}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">{record.description}</p>
                  {record.tags.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Tags: {record.tags.join(", ")}
                    </p>
                  )}
                  {canEdit && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-md border border-slate-500/45 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                        onClick={() => beginEntityEdit("class", record)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-red-400/45 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
                        onClick={() =>
                          void runMutation(
                            `/api/classes/${record.id}`,
                            "DELETE",
                            null,
                            "Failed to delete class"
                          )
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {!filteredClasses.length && (
            <p className="text-sm text-slate-300">No classes match this filter.</p>
          )}
        </section>
      )}

      {activeTab === "subclasses" && (
        <section className="space-y-3">
          <form
            className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3"
            onSubmit={submitSubclass}
          >
            <h4 className="text-sm text-amber-100">
              {editingSubclassId ? "Edit Subclass" : "Create Subclass"}
            </h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs text-slate-300">
                Name
                <input
                  className="field mt-1"
                  required
                  value={subclassForm.name}
                  onChange={(event) =>
                    setSubclassForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label className="block text-xs text-slate-300">
                Parent Class
                <select
                  className="field mt-1"
                  required
                  value={subclassForm.classId}
                  onChange={(event) =>
                    setSubclassForm((current) => ({ ...current, classId: event.target.value }))
                  }
                >
                  <option value="">Select class</option>
                  {classes.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs text-slate-300">
              Description
              <textarea
                className="field mt-1 min-h-24"
                value={subclassForm.description}
                onChange={(event) =>
                  setSubclassForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs text-slate-300">
                Tags (comma separated)
                <input
                  className="field mt-1"
                  value={subclassForm.tags}
                  onChange={(event) =>
                    setSubclassForm((current) => ({ ...current, tags: event.target.value }))
                  }
                />
              </label>
              <label className="block text-xs text-slate-300">
                Spellcast Trait (optional)
                <input
                  className="field mt-1"
                  value={subclassForm.spellcastTrait}
                  onChange={(event) =>
                    setSubclassForm((current) => ({
                      ...current,
                      spellcastTrait: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary min-h-11 px-3 py-2 text-xs" disabled={busy}>
                {busy
                  ? "Saving..."
                  : editingSubclassId
                    ? "Save Subclass"
                    : "Create Subclass"}
              </button>
              {editingSubclassId && (
                <button
                  className="btn-outline min-h-11 px-3 py-2 text-xs"
                  onClick={() => {
                    setSubclassForm(EMPTY_SUBCLASS_FORM);
                    setEditingSubclassId(null);
                  }}
                  type="button"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredSubclasses.map((record) => {
              const canEdit = isOwnedRecord(campaignId, record);
              const classLabel = classNameById.get(record.classId) ?? record.className;
              return (
                <article
                  key={record.id}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3"
                >
                  <p className="text-sm text-amber-100">{record.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {record.isOfficial ? "Official" : "Campaign"} | Class: {classLabel}
                  </p>
                  {record.spellcastTrait && (
                    <p className="text-[11px] text-slate-400">
                      Spellcast Trait: {record.spellcastTrait}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-300">{record.description}</p>
                  {record.tags.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Tags: {record.tags.join(", ")}
                    </p>
                  )}
                  {canEdit && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-md border border-slate-500/45 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                        onClick={() => {
                          setSubclassForm({
                            name: record.name,
                            description: record.description,
                            tags: tagsToInput(record.tags),
                            classId: record.classId,
                            spellcastTrait: record.spellcastTrait ?? "",
                          });
                          setEditingSubclassId(record.id);
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-red-400/45 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
                        onClick={() =>
                          void runMutation(
                            `/api/subclasses/${record.id}`,
                            "DELETE",
                            null,
                            "Failed to delete subclass"
                          )
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {!filteredSubclasses.length && (
            <p className="text-sm text-slate-300">No subclasses match this filter.</p>
          )}
        </section>
      )}
      {activeTab === "ancestries" && (
        <section className="space-y-3">
          <form
            className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3"
            onSubmit={submitAncestry}
          >
            <h4 className="text-sm text-amber-100">
              {editingAncestryId ? "Edit Ancestry" : "Create Ancestry"}
            </h4>
            <label className="block text-xs text-slate-300">
              Name
              <input
                className="field mt-1"
                required
                value={ancestryForm.name}
                onChange={(event) =>
                  setAncestryForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="block text-xs text-slate-300">
              Description
              <textarea
                className="field mt-1 min-h-24"
                value={ancestryForm.description}
                onChange={(event) =>
                  setAncestryForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block text-xs text-slate-300">
              Tags (comma separated)
              <input
                className="field mt-1"
                value={ancestryForm.tags}
                onChange={(event) =>
                  setAncestryForm((current) => ({ ...current, tags: event.target.value }))
                }
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary min-h-11 px-3 py-2 text-xs" disabled={busy}>
                {busy
                  ? "Saving..."
                  : editingAncestryId
                    ? "Save Ancestry"
                    : "Create Ancestry"}
              </button>
              {editingAncestryId && (
                <button
                  className="btn-outline min-h-11 px-3 py-2 text-xs"
                  onClick={() => cancelEntityEdit("ancestry")}
                  type="button"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredAncestries.map((record) => {
              const canEdit = isOwnedRecord(campaignId, record);
              return (
                <article
                  key={record.id}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3"
                >
                  <p className="text-sm text-amber-100">{record.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {record.isOfficial ? "Official" : "Campaign"} | {record.id}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">{record.description}</p>
                  {record.tags.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Tags: {record.tags.join(", ")}
                    </p>
                  )}
                  {canEdit && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-md border border-slate-500/45 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                        onClick={() => beginEntityEdit("ancestry", record)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-red-400/45 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
                        onClick={() =>
                          void runMutation(
                            `/api/ancestries/${record.id}`,
                            "DELETE",
                            null,
                            "Failed to delete ancestry"
                          )
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {!filteredAncestries.length && (
            <p className="text-sm text-slate-300">No ancestries match this filter.</p>
          )}
        </section>
      )}

      {activeTab === "communities" && (
        <section className="space-y-3">
          <form
            className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3"
            onSubmit={submitCommunity}
          >
            <h4 className="text-sm text-amber-100">
              {editingCommunityId ? "Edit Community" : "Create Community"}
            </h4>
            <label className="block text-xs text-slate-300">
              Name
              <input
                className="field mt-1"
                required
                value={communityForm.name}
                onChange={(event) =>
                  setCommunityForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="block text-xs text-slate-300">
              Description
              <textarea
                className="field mt-1 min-h-24"
                value={communityForm.description}
                onChange={(event) =>
                  setCommunityForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block text-xs text-slate-300">
              Tags (comma separated)
              <input
                className="field mt-1"
                value={communityForm.tags}
                onChange={(event) =>
                  setCommunityForm((current) => ({ ...current, tags: event.target.value }))
                }
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary min-h-11 px-3 py-2 text-xs" disabled={busy}>
                {busy
                  ? "Saving..."
                  : editingCommunityId
                    ? "Save Community"
                    : "Create Community"}
              </button>
              {editingCommunityId && (
                <button
                  className="btn-outline min-h-11 px-3 py-2 text-xs"
                  onClick={() => cancelEntityEdit("community")}
                  type="button"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCommunities.map((record) => {
              const canEdit = isOwnedRecord(campaignId, record);
              return (
                <article
                  key={record.id}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3"
                >
                  <p className="text-sm text-amber-100">{record.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {record.isOfficial ? "Official" : "Campaign"} | {record.id}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">{record.description}</p>
                  {record.tags.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Tags: {record.tags.join(", ")}
                    </p>
                  )}
                  {canEdit && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-md border border-slate-500/45 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                        onClick={() => beginEntityEdit("community", record)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-red-400/45 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
                        onClick={() =>
                          void runMutation(
                            `/api/communities/${record.id}`,
                            "DELETE",
                            null,
                            "Failed to delete community"
                          )
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {!filteredCommunities.length && (
            <p className="text-sm text-slate-300">No communities match this filter.</p>
          )}
        </section>
      )}

      {activeTab === "items" && (
        <section className="space-y-3">
          <form
            className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3"
            onSubmit={submitItem}
          >
            <h4 className="text-sm text-amber-100">
              {editingItemId ? "Edit Item" : "Create Item"}
            </h4>
            <label className="block text-xs text-slate-300">
              Name
              <input
                className="field mt-1"
                required
                value={itemForm.name}
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="block text-xs text-slate-300">
              Description
              <textarea
                className="field mt-1 min-h-24"
                value={itemForm.description}
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <label className="block text-xs text-slate-300">
              Tags (comma separated)
              <input
                className="field mt-1"
                value={itemForm.tags}
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, tags: event.target.value }))
                }
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary min-h-11 px-3 py-2 text-xs" disabled={busy}>
                {busy ? "Saving..." : editingItemId ? "Save Item" : "Create Item"}
              </button>
              {editingItemId && (
                <button
                  className="btn-outline min-h-11 px-3 py-2 text-xs"
                  onClick={() => cancelEntityEdit("item")}
                  type="button"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((record) => {
              const canEdit = isOwnedRecord(campaignId, record);
              return (
                <article
                  key={record.id}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3"
                >
                  <p className="text-sm text-amber-100">{record.name}</p>
                  <p className="text-[11px] text-slate-400">{record.id}</p>
                  <p className="mt-1 text-xs text-slate-300">{record.description}</p>
                  {record.tags.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Tags: {record.tags.join(", ")}
                    </p>
                  )}
                  {canEdit && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-md border border-slate-500/45 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                        onClick={() => beginEntityEdit("item", record)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-red-400/45 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
                        onClick={() =>
                          void runMutation(
                            `/api/items/${record.id}`,
                            "DELETE",
                            null,
                            "Failed to delete item"
                          )
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {!filteredItems.length && (
            <p className="text-sm text-slate-300">No items match this filter.</p>
          )}
        </section>
      )}
      {activeTab === "skills" && (
        <section className="space-y-3">
          <form
            className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3"
            onSubmit={submitSkill}
          >
            <h4 className="text-sm text-amber-100">
              {editingSkillId ? "Edit Skill" : "Create Skill"}
            </h4>
            <label className="block text-xs text-slate-300">
              Label
              <input
                className="field mt-1"
                required
                value={skillForm.label}
                onChange={(event) =>
                  setSkillForm((current) => ({ ...current, label: event.target.value }))
                }
              />
            </label>
            <label className="block text-xs text-slate-300">
              Helper Text
              <input
                className="field mt-1"
                value={skillForm.helperText}
                onChange={(event) =>
                  setSkillForm((current) => ({
                    ...current,
                    helperText: event.target.value,
                  }))
                }
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {TRAIT_KEYS.map((trait) => {
                const selected = skillForm.traits.includes(trait);
                return (
                  <label
                    key={trait}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        setSkillForm((current) => ({
                          ...current,
                          traits: selected
                            ? current.traits.filter((item) => item !== trait)
                            : [...current.traits, trait],
                        }))
                      }
                    />
                    {trait}
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary min-h-11 px-3 py-2 text-xs" disabled={busy}>
                {busy ? "Saving..." : editingSkillId ? "Save Skill" : "Create Skill"}
              </button>
              {editingSkillId && (
                <button
                  className="btn-outline min-h-11 px-3 py-2 text-xs"
                  onClick={() => {
                    setSkillForm(EMPTY_SKILL_FORM);
                    setEditingSkillId(null);
                  }}
                  type="button"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredSkills.map((record) => {
              const canEdit = isOwnedRecord(campaignId, record);
              return (
                <article
                  key={record.id}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3"
                >
                  <p className="text-sm text-amber-100">{record.label}</p>
                  <p className="text-[11px] text-slate-400">{record.id}</p>
                  <p className="mt-1 text-xs text-slate-300">{record.helperText}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Traits: {record.traits.join(", ")}
                  </p>
                  {canEdit && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-md border border-slate-500/45 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                        onClick={() => {
                          setSkillForm({
                            label: record.label,
                            helperText: record.helperText,
                            traits: [...record.traits],
                          });
                          setEditingSkillId(record.id);
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-red-400/45 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
                        onClick={() =>
                          void runMutation(
                            `/api/skills/${record.id}`,
                            "DELETE",
                            null,
                            "Failed to delete skill"
                          )
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {!filteredSkills.length && (
            <p className="text-sm text-slate-300">No skills match this filter.</p>
          )}
        </section>
      )}

      {activeTab === "conditions" && (
        <section className="space-y-3">
          <form
            className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3"
            onSubmit={submitCondition}
          >
            <h4 className="text-sm text-amber-100">
              {editingConditionId ? "Edit Condition" : "Create Condition"}
            </h4>
            <label className="block text-xs text-slate-300">
              Name
              <input
                className="field mt-1"
                required
                value={conditionForm.name}
                onChange={(event) =>
                  setConditionForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block text-xs text-slate-300">
              Description
              <textarea
                className="field mt-1 min-h-24"
                value={conditionForm.description}
                onChange={(event) =>
                  setConditionForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={conditionForm.playerToggle}
                  onChange={(event) =>
                    setConditionForm((current) => ({
                      ...current,
                      playerToggle: event.target.checked,
                    }))
                  }
                />
                Player can toggle
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={conditionForm.visibleToPlayers}
                  onChange={(event) =>
                    setConditionForm((current) => ({
                      ...current,
                      visibleToPlayers: event.target.checked,
                    }))
                  }
                />
                Visible to players
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary min-h-11 px-3 py-2 text-xs" disabled={busy}>
                {busy
                  ? "Saving..."
                  : editingConditionId
                    ? "Save Condition"
                    : "Create Condition"}
              </button>
              {editingConditionId && (
                <button
                  className="btn-outline min-h-11 px-3 py-2 text-xs"
                  onClick={() => {
                    setConditionForm(EMPTY_CONDITION_FORM);
                    setEditingConditionId(null);
                  }}
                  type="button"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredConditions.map((record) => {
              const canEdit = isOwnedRecord(campaignId, record);
              return (
                <article
                  key={record.id}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3"
                >
                  <p className="text-sm text-amber-100">{record.name}</p>
                  <p className="text-[11px] text-slate-400">{record.id}</p>
                  <p className="mt-1 text-xs text-slate-300">{record.description}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Player toggle: {record.playerToggle ? "Yes" : "No"} | Visible: {" "}
                    {record.visibleToPlayers ? "Yes" : "No"}
                  </p>
                  {canEdit && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-md border border-slate-500/45 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                        onClick={() => {
                          setConditionForm({
                            name: record.name,
                            description: record.description,
                            playerToggle: record.playerToggle,
                            visibleToPlayers: record.visibleToPlayers,
                          });
                          setEditingConditionId(record.id);
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-red-400/45 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
                        onClick={() =>
                          void runMutation(
                            `/api/conditions/${record.id}`,
                            "DELETE",
                            null,
                            "Failed to delete condition"
                          )
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {!filteredConditions.length && (
            <p className="text-sm text-slate-300">No conditions match this filter.</p>
          )}
        </section>
      )}
      {activeTab === "resourceTemplates" && (
        <section className="space-y-3">
          <form
            className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/65 p-3"
            onSubmit={submitResourceTemplate}
          >
            <h4 className="text-sm text-amber-100">
              {editingResourceTemplateId
                ? "Edit Resource Template"
                : "Create Resource Template"}
            </h4>
            <label className="block text-xs text-slate-300">
              Label
              <input
                className="field mt-1"
                required
                value={resourceTemplateForm.label}
                onChange={(event) =>
                  setResourceTemplateForm((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-xs text-slate-300">
                Default Current
                <input
                  className="field mt-1"
                  type="number"
                  value={resourceTemplateForm.defaultCurrent}
                  onChange={(event) =>
                    setResourceTemplateForm((current) => ({
                      ...current,
                      defaultCurrent: applyNumberInput(
                        event.target.value,
                        current.defaultCurrent
                      ),
                    }))
                  }
                />
              </label>
              <label className="text-xs text-slate-300">
                Default Max
                <input
                  className="field mt-1"
                  type="number"
                  value={resourceTemplateForm.defaultMax}
                  onChange={(event) =>
                    setResourceTemplateForm((current) => ({
                      ...current,
                      defaultMax: applyNumberInput(event.target.value, current.defaultMax),
                    }))
                  }
                />
              </label>
              <label className="text-xs text-slate-300">
                Min
                <input
                  className="field mt-1"
                  type="number"
                  value={resourceTemplateForm.min}
                  onChange={(event) =>
                    setResourceTemplateForm((current) => ({
                      ...current,
                      min: applyNumberInput(event.target.value, current.min),
                    }))
                  }
                />
              </label>
              <label className="text-xs text-slate-300">
                Max
                <input
                  className="field mt-1"
                  type="number"
                  value={resourceTemplateForm.max}
                  onChange={(event) =>
                    setResourceTemplateForm((current) => ({
                      ...current,
                      max: applyNumberInput(event.target.value, current.max),
                    }))
                  }
                />
              </label>
              <label className="text-xs text-slate-300">
                Format
                <select
                  className="field mt-1"
                  value={resourceTemplateForm.format}
                  onChange={(event) =>
                    setResourceTemplateForm((current) => ({
                      ...current,
                      format: event.target.value as ResourceTemplateFormState["format"],
                    }))
                  }
                >
                  <option value="current_max">Current / Max</option>
                  <option value="single">Single Value</option>
                  <option value="checkbox">Checkbox Slots</option>
                </select>
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={resourceTemplateForm.playerEditable}
                  onChange={(event) =>
                    setResourceTemplateForm((current) => ({
                      ...current,
                      playerEditable: event.target.checked,
                    }))
                  }
                />
                Player editable
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={resourceTemplateForm.allowPermanentShift}
                  onChange={(event) =>
                    setResourceTemplateForm((current) => ({
                      ...current,
                      allowPermanentShift: event.target.checked,
                    }))
                  }
                />
                Permanent shift
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={resourceTemplateForm.allowTemporaryModifiers}
                  onChange={(event) =>
                    setResourceTemplateForm((current) => ({
                      ...current,
                      allowTemporaryModifiers: event.target.checked,
                    }))
                  }
                />
                Temporary modifiers
              </label>
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-300">Visibility surfaces</p>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {Object.entries(resourceTemplateForm.visibleOn).map(([surface, value]) => (
                  <label
                    key={surface}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-700/50 px-3 py-2 text-xs text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) =>
                        setResourceTemplateForm((current) => ({
                          ...current,
                          visibleOn: {
                            ...current.visibleOn,
                            [surface]: event.target.checked,
                          },
                        }))
                      }
                    />
                    {surface}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary min-h-11 px-3 py-2 text-xs" disabled={busy}>
                {busy
                  ? "Saving..."
                  : editingResourceTemplateId
                    ? "Save Template"
                    : "Create Template"}
              </button>
              {editingResourceTemplateId && (
                <button
                  className="btn-outline min-h-11 px-3 py-2 text-xs"
                  onClick={() => {
                    setResourceTemplateForm(EMPTY_RESOURCE_TEMPLATE_FORM);
                    setEditingResourceTemplateId(null);
                  }}
                  type="button"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredResourceTemplates.map((record) => {
              const canEdit = isOwnedRecord(campaignId, record);
              return (
                <article
                  key={record.id}
                  className="rounded-lg border border-slate-700/50 bg-slate-900/65 p-3"
                >
                  <p className="text-sm text-amber-100">{record.label}</p>
                  <p className="text-[11px] text-slate-400">{record.id}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {record.format} | {record.defaultCurrent}/{record.defaultMax} | min{" "}
                    {record.min} max {record.max}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Editable: {record.playerEditable ? "Yes" : "No"} | Permanent shift:{" "}
                    {record.allowPermanentShift ? "Yes" : "No"}
                  </p>
                  {canEdit && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-md border border-slate-500/45 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                        onClick={() => {
                          setResourceTemplateForm({
                            label: record.label,
                            defaultCurrent: record.defaultCurrent,
                            defaultMax: record.defaultMax,
                            min: record.min,
                            max: record.max,
                            format: record.format,
                            playerEditable: record.playerEditable,
                            allowPermanentShift: record.allowPermanentShift,
                            allowTemporaryModifiers: record.allowTemporaryModifiers,
                            visibleOn: { ...record.visibleOn },
                          });
                          setEditingResourceTemplateId(record.id);
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-red-400/45 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
                        onClick={() =>
                          void runMutation(
                            `/api/resource-templates/${record.id}`,
                            "DELETE",
                            null,
                            "Failed to delete resource template"
                          )
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {!filteredResourceTemplates.length && (
            <p className="text-sm text-slate-300">No resource templates match this filter.</p>
          )}
        </section>
      )}
    </section>
  );
}
