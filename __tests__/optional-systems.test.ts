import { describe, expect, it } from "vitest";
import {
  DEFAULT_DRUID_FORM_RULES,
  OFFICIAL_DRUID_FORMS,
  resolveDruidForms,
} from "../src/lib/optional-systems";

describe("optional systems", () => {
  it("lets custom druid forms override official forms by id", () => {
    const official = OFFICIAL_DRUID_FORMS[0];
    expect(official).toBeDefined();

    const forms = resolveDruidForms({
      ...DEFAULT_DRUID_FORM_RULES,
      customForms: [
        {
          ...(official ?? OFFICIAL_DRUID_FORMS[1]),
          id: official?.id ?? "agile-scout",
          name: "Campaign Agile Scout",
          evasionBonus: 7,
        },
      ],
    });

    const resolved = forms.find((form) => form.id === (official?.id ?? "agile-scout"));
    expect(resolved?.name).toBe("Campaign Agile Scout");
    expect(resolved?.evasionBonus).toBe(7);
  });

  it("applies disabled form ids after merge", () => {
    const official = OFFICIAL_DRUID_FORMS[0];
    const formId = official?.id ?? "agile-scout";

    const forms = resolveDruidForms({
      ...DEFAULT_DRUID_FORM_RULES,
      disabledFormIds: [formId],
      customForms: [
        {
          ...(official ?? OFFICIAL_DRUID_FORMS[1]),
          id: formId,
          name: "Disabled Override",
        },
      ],
    });

    expect(forms.some((form) => form.id === formId)).toBe(false);
  });
});
