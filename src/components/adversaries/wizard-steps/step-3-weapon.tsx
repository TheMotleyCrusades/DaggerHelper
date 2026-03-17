import type { AdversaryFormValue } from "@/components/adversaries/adversary-form";

const RANGE_OPTIONS = ["Melee", "Very Close", "Close", "Far", "Very Far"];

export function Step3Weapon({
  value,
  onChange,
  dicePoolsInput,
  onDicePoolsChange,
}: {
  value: AdversaryFormValue;
  onChange: (patch: Partial<AdversaryFormValue>) => void;
  dicePoolsInput: string;
  onDicePoolsChange: (next: string) => void;
}) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl text-amber-200">Step 3: Weapon Profile</h2>
        <p className="text-sm text-slate-400">Define the primary attack profile.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-slate-300">
          Weapon Name
          <input
            className="field mt-1"
            value={value.weaponName ?? ""}
            onChange={(event) => onChange({ weaponName: event.target.value })}
          />
        </label>
        <label className="text-sm text-slate-300">
          Range
          <select
            className="field mt-1"
            value={value.weaponRange ?? "Melee"}
            onChange={(event) => onChange({ weaponRange: event.target.value })}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Damage Dice
          <input
            className="field mt-1"
            value={value.damageDice ?? ""}
            onChange={(event) => onChange({ damageDice: event.target.value })}
            placeholder="1d8 + 2"
          />
        </label>
      </div>

      <label className="text-sm text-slate-300">
        Potential Dice Pools (comma separated)
        <input
          className="field mt-1"
          value={dicePoolsInput}
          onChange={(event) => onDicePoolsChange(event.target.value)}
          placeholder="2d8, 1d20"
        />
      </label>
    </section>
  );
}
