import type { CharacterWizardData } from "@/app/characters/create/hooks/useCharacterWizard";
import { parseHeritageToIdentity } from "@/lib/character-identity";

export function canAdvanceWizardStep(
  step: number,
  character: CharacterWizardData,
  maxDomainCards: number
) {
  if (step === 1) {
    return Boolean(
      character.campaignId &&
        character.name.trim() &&
        character.class.trim()
    );
  }

  if (step === 2) {
    const identity = parseHeritageToIdentity(character.heritage);
    return Boolean(identity.ancestries.length > 0 && identity.community);
  }

  if (step === 4) {
    const structuredInventory = character.inventoryItems.filter((item) => {
      const kind = item.entityKind;
      const entityId = item.entityId;
      return (
        (kind === "weapon" || kind === "armor") &&
        typeof entityId === "string" &&
        entityId.trim().length > 0 &&
        Boolean(item.isEquipped)
      );
    });

    const hasPrimaryWeapon = structuredInventory.some(
      (entry) => entry.entityKind === "weapon" && entry.equippedSlot === "primary_weapon"
    );
    const hasArmor = structuredInventory.some(
      (entry) => entry.entityKind === "armor" && entry.equippedSlot === "armor"
    );

    return hasPrimaryWeapon && hasArmor;
  }

  if (step === 5) {
    return (
      character.domainCards.length > 0 &&
      character.domainCards.length <= Math.max(1, maxDomainCards)
    );
  }

  return true;
}
