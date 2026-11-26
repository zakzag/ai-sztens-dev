import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from '../src/components/checkbox/Checkbox.js';
import { Combobox } from '../src/components/combobox/Combobox.js';
import { DatePicker } from '../src/components/date-picker/DatePicker.js';
import { FormActions } from '../src/components/form-actions/FormActions.js';
import { FormField } from '../src/components/form-field/FormField.js';
import { FormSection } from '../src/components/form-section/FormSection.js';
import { NumberInput } from '../src/components/number-input/NumberInput.js';
import { RadioGroup } from '../src/components/radio-group/RadioGroup.js';
import { Select } from '../src/components/select/Select.js';
import { Switch } from '../src/components/switch/Switch.js';
import {
  FORM_COMBOBOX_OPTIONS,
  FORM_OPTIONS,
  FORM_RADIO_OPTIONS,
} from './mocks/form-options.mock.js';
import { ICON_RADIO_OPTIONS } from './mocks/icon-options.mock.js';
import { AXE_JSDOM_OPTIONS } from './mocks/axe-options.mock.js';

/**
 * Runs axe-core over a rendered tree and fails with the violation list.
 *
 * Asserting on `results.violations` directly (instead of the `toHaveNoViolations`
 * matcher) keeps the assertion type-safe under Vitest 3 and prints the offending
 * node in the failure output.
 */
async function expectNoViolations(container: HTMLElement): Promise<void> {
  const results = await axe(container, AXE_JSDOM_OPTIONS);

  expect(results.violations).toEqual([]);
}

/**
 * Accessibility gate for the whole form primitive set.
 *
 * Every primitive is rendered inside `FormField` because none of them carries
 * its own label — an unlabelled control is a violation by definition, and the
 * point of the gate is to catch wiring mistakes, not to fail on the documented
 * division of labour.
 */
describe('form primitives a11y', () => {
  it('passes axe in the default state', async () => {
    const { container } = render(
      <form>
        <FormSection legend="Alapadatok">
          <FormField id="role" label="Szerep">
            {(field) => (
              <Select
                id={field.id}
                invalid={field.invalid}
                describedBy={field.describedBy}
                options={FORM_OPTIONS}
                placeholder="Válassz szerepet"
              />
            )}
          </FormField>
          <FormField id="amount" label="Összeg">
            {(field) => (
              <NumberInput
                id={field.id}
                invalid={field.invalid}
                describedBy={field.describedBy}
                min={0}
              />
            )}
          </FormField>
          <FormField id="due" label="Határidő">
            {(field) => (
              <DatePicker
                id={field.id}
                invalid={field.invalid}
                describedBy={field.describedBy}
                value=""
                onChange={vi.fn()}
              />
            )}
          </FormField>
          <Checkbox id="active" label="Aktív" />
          <Switch id="notify" label="Értesítés" />
          <RadioGroup
            name="visibility"
            legend="Láthatóság"
            options={FORM_RADIO_OPTIONS}
            value="owner"
            onChange={vi.fn()}
          />
        </FormSection>
        <FormActions onCancel={vi.fn()} />
      </form>,
    );

    await expectNoViolations(container);
  });

  it('passes axe in the error state', async () => {
    const { container } = render(
      <form>
        <FormField id="role" label="Szerep" error="Kötelező mező">
          {(field) => (
            <Select
              id={field.id}
              invalid={field.invalid}
              describedBy={field.describedBy}
              options={FORM_OPTIONS}
            />
          )}
        </FormField>
        <Checkbox
          id="active"
          label="Aktív"
          invalid
          describedBy="active-error"
        />
      </form>,
    );

    await expectNoViolations(container);
  });

  it('passes axe in the hint state', async () => {
    const { container } = render(
      <form>
        <FormField id="amount" label="Összeg" hint="Forintban, kerekítve">
          {(field) => (
            <NumberInput
              id={field.id}
              invalid={field.invalid}
              describedBy={field.describedBy}
            />
          )}
        </FormField>
      </form>,
    );

    await expectNoViolations(container);
  });

  it('passes axe in the disabled state', async () => {
    const { container } = render(
      <form>
        <FormField id="role" label="Szerep">
          {(field) => (
            <Select
              id={field.id}
              invalid={field.invalid}
              describedBy={field.describedBy}
              options={FORM_OPTIONS}
              disabled
            />
          )}
        </FormField>
        <Checkbox id="active" label="Aktív" disabled />
        <Switch id="notify" label="Értesítés" disabled />
        <RadioGroup
          name="visibility"
          legend="Láthatóság"
          options={FORM_RADIO_OPTIONS}
          value="owner"
          onChange={vi.fn()}
          disabled
        />
      </form>,
    );

    await expectNoViolations(container);
  });

  it('passes axe with the combobox listbox open', async () => {
    const { container } = render(
      <form>
        <FormField id="role" label="Szerep">
          {(field) => (
            <Combobox
              id={field.id}
              invalid={field.invalid}
              describedBy={field.describedBy}
              options={FORM_COMBOBOX_OPTIONS}
              value={null}
              inputValue=""
              onSelect={vi.fn()}
              onInputValueChange={vi.fn()}
            />
          )}
        </FormField>
      </form>,
    );

    await userEvent.click(screen.getByRole('combobox'));

    await expectNoViolations(container);
  });

  it('passes axe with option icons', async () => {
    const { container } = render(
      <form>
        <FormSection legend="Megjelenés">
          <RadioGroup
            name="theme"
            legend="Téma"
            options={ICON_RADIO_OPTIONS}
            value="light"
            onChange={vi.fn()}
          />
        </FormSection>
      </form>,
    );

    await expectNoViolations(container);
  });
});
