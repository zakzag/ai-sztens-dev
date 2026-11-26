import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroup } from '../src/components/radio-group/RadioGroup.js';
import { FORM_RADIO_OPTIONS } from './mocks/form-options.mock.js';
import {
  ICON_RADIO_OPTIONS,
  ICON_RADIO_OPTIONS_WITH_DESCRIPTION,
} from './mocks/icon-options.mock.js';

describe('RadioGroup', () => {
  it('renders the legend and every option', () => {
    render(
      <RadioGroup
        name="role"
        legend="Szerep"
        options={FORM_RADIO_OPTIONS}
        value="owner"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Szerep')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(
      FORM_RADIO_OPTIONS.length,
    );
  });

  it('checks the option matching the value', () => {
    render(
      <RadioGroup
        name="role"
        legend="Szerep"
        options={FORM_RADIO_OPTIONS}
        value="admin"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Adminisztrátor' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Tulajdonos' })).not.toBeChecked();
  });

  it('reports the clicked option', async () => {
    const onChange = vi.fn();

    render(
      <RadioGroup
        name="role"
        legend="Szerep"
        options={FORM_RADIO_OPTIONS}
        value="owner"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Megtekintő' }));

    expect(onChange).toHaveBeenCalledWith('viewer');
  });

  it('moves the selection down with ArrowDown', async () => {
    const onChange = vi.fn();

    render(
      <RadioGroup
        name="role"
        legend="Szerep"
        options={FORM_RADIO_OPTIONS}
        value="owner"
        onChange={onChange}
      />,
    );

    screen.getByRole('radio', { name: 'Tulajdonos' }).focus();
    await userEvent.keyboard('{ArrowDown}');

    expect(onChange).toHaveBeenCalledWith('admin');
  });

  it('wraps the selection upward with ArrowUp', async () => {
    const onChange = vi.fn();

    render(
      <RadioGroup
        name="role"
        legend="Szerep"
        options={FORM_RADIO_OPTIONS}
        value="owner"
        onChange={onChange}
      />,
    );

    screen.getByRole('radio', { name: 'Tulajdonos' }).focus();
    await userEvent.keyboard('{ArrowUp}');

    expect(onChange).toHaveBeenCalledWith('viewer');
  });

  it('marks the group invalid and links the message', () => {
    render(
      <RadioGroup
        name="role"
        legend="Szerep"
        options={FORM_RADIO_OPTIONS}
        value=""
        onChange={vi.fn()}
        invalid
        describedBy="role-error"
      />,
    );

    const group = screen.getByRole('group', { name: 'Szerep' });

    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAttribute('aria-describedby', 'role-error');
  });

  it('disables every radio when the group is disabled', () => {
    render(
      <RadioGroup
        name="role"
        legend="Szerep"
        options={FORM_RADIO_OPTIONS}
        value="owner"
        onChange={vi.fn()}
        disabled
      />,
    );

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });

  it('lays the options out horizontally when asked', () => {
    render(
      <RadioGroup
        name="role"
        legend="Szerep"
        options={FORM_RADIO_OPTIONS}
        value="owner"
        onChange={vi.fn()}
        orientation="horizontal"
      />,
    );

    expect(screen.getByRole('group', { name: 'Szerep' })).toBeInTheDocument();
  });
});

describe('RadioGroup with option icons', () => {
  it('renders the icon and the label text inside the option label', () => {
    render(
      <RadioGroup
        name="theme"
        legend="Téma"
        options={ICON_RADIO_OPTIONS}
        value="light"
        onChange={vi.fn()}
      />,
    );

    const label = screen.getByText('Világos').closest('label');

    expect(label).not.toBeNull();
    expect(label?.querySelector('svg')).not.toBeNull();
    expect(label?.textContent).toBe('Világos');
  });

  it('hides the icon and its wrapper from assistive technology', () => {
    render(
      <RadioGroup
        name="theme"
        legend="Téma"
        options={ICON_RADIO_OPTIONS}
        value="light"
        onChange={vi.fn()}
      />,
    );

    const icon = screen.getByText('Sötét').closest('label')?.querySelector('svg');

    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon?.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the accessible name limited to the label text', () => {
    render(
      <RadioGroup
        name="theme"
        legend="Téma"
        options={ICON_RADIO_OPTIONS}
        value="light"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Világos' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sötét' })).toBeInTheDocument();
  });

  it('checks the option matching the value', () => {
    render(
      <RadioGroup
        name="theme"
        legend="Téma"
        options={ICON_RADIO_OPTIONS}
        value="dark"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Sötét' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Világos' })).not.toBeChecked();
  });

  it('reports the option picked by clicking its icon label', async () => {
    const onChange = vi.fn();

    render(
      <RadioGroup
        name="theme"
        legend="Téma"
        options={ICON_RADIO_OPTIONS}
        value="light"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByText('Sötét'));

    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('does not select a disabled icon option', async () => {
    const onChange = vi.fn();

    render(
      <RadioGroup
        name="theme"
        legend="Téma"
        options={ICON_RADIO_OPTIONS}
        value="light"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByText('Ambient'));

    expect(screen.getByRole('radio', { name: 'Ambient' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves the selection with the arrow keys', async () => {
    const onChange = vi.fn();

    render(
      <RadioGroup
        name="theme"
        legend="Téma"
        options={ICON_RADIO_OPTIONS}
        value="light"
        onChange={onChange}
      />,
    );

    screen.getByRole('radio', { name: 'Világos' }).focus();
    await userEvent.keyboard('{ArrowDown}');

    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('keeps the description on its own line under the icon label', () => {
    render(
      <RadioGroup
        name="theme"
        legend="Téma"
        options={ICON_RADIO_OPTIONS_WITH_DESCRIPTION}
        value="light"
        onChange={vi.fn()}
      />,
    );

    const label = screen.getByText('Világos').closest('label');
    const description = screen.getByText('Nappali, nagy kontrasztú téma');

    expect(label?.querySelector('svg')).not.toBeNull();
    expect(description).toHaveClass('block');
    expect(description.parentElement).toBe(label);
  });
});
