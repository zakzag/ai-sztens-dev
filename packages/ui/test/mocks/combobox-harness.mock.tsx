import { useState } from 'react';
import { Combobox } from '../../src/components/combobox/Combobox.js';
import type { ComboboxOption } from '../../src/components/combobox/combobox.interface.js';

/** Props of {@link ComboboxHarness}. */
export interface ComboboxHarnessProps {
  /** Options rendered by the combobox. */
  readonly options: readonly ComboboxOption[];
  /** Optional spy forwarded to the real `onSelect`. */
  readonly onSelect?: (value: string) => void;
  /** Renders the input disabled. */
  readonly disabled?: boolean;
}

/**
 * Stateful wrapper for the controlled `Combobox`.
 *
 * The primitive owns no selection state (decision D5), so a test that wants to
 * observe a real selection has to supply the state — that harness lives here,
 * not in the test file.
 *
 * @param props - see {@link ComboboxHarnessProps}.
 */
export function ComboboxHarness({
  options,
  onSelect,
  disabled = false,
}: ComboboxHarnessProps) {
  const [value, setValue] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  return (
    <div>
      <Combobox
        id="role"
        options={options}
        value={value}
        inputValue={inputValue}
        disabled={disabled}
        onInputValueChange={setInputValue}
        onSelect={(nextValue) => {
          setValue(nextValue);
          onSelect?.(nextValue);
        }}
      />
      <p data-testid="selected-value">{value ?? 'nincs'}</p>
    </div>
  );
}
