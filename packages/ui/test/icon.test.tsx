import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CloudIcon,
  CloseIcon,
  DropletIcon,
  LayersIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SnowflakeIcon,
  SunIcon,
  SunsetIcon,
} from '../src/components/icon/icons.js';
import { ICON_BASE_CLASS } from '../src/components/icon/icon.const.js';
import type { IconProps } from '../src/components/icon/icon.interface.js';

/** Every icon of the set, so a new icon cannot skip the shared contract. */
const ICONS: readonly {
  readonly name: string;
  readonly Icon: (props: IconProps) => JSX.Element;
}[] = [
  { name: 'SunIcon', Icon: SunIcon },
  { name: 'MoonIcon', Icon: MoonIcon },
  { name: 'SunsetIcon', Icon: SunsetIcon },
  { name: 'LayersIcon', Icon: LayersIcon },
  { name: 'SnowflakeIcon', Icon: SnowflakeIcon },
  { name: 'DropletIcon', Icon: DropletIcon },
  { name: 'CloudIcon', Icon: CloudIcon },
  { name: 'SettingsIcon', Icon: SettingsIcon },
  { name: 'ChevronRightIcon', Icon: ChevronRightIcon },
  { name: 'ChevronDownIcon', Icon: ChevronDownIcon },
  { name: 'PlusIcon', Icon: PlusIcon },
  { name: 'CloseIcon', Icon: CloseIcon },
];

describe('icon set', () => {
  for (const { name, Icon } of ICONS) {
    describe(name, () => {
      it('renders a decorative 24×24 stroke icon', () => {
        const { container } = render(<Icon />);
        const svg = container.querySelector('svg');

        expect(svg).not.toBeNull();
        expect(svg).toHaveAttribute('aria-hidden', 'true');
        expect(svg).toHaveAttribute('focusable', 'false');
        expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
        expect(svg).toHaveAttribute('fill', 'none');
        expect(svg).toHaveAttribute('stroke', 'currentColor');
        expect(svg).toHaveAttribute('stroke-width', '2');
      });

      it('carries the default size class', () => {
        const { container } = render(<Icon />);

        expect(container.querySelector('svg')).toHaveClass(
          ...ICON_BASE_CLASS.split(' '),
        );
      });
    });
  }

  it('merges the caller class after the base class', () => {
    const { container } = render(<SunIcon className="h-6 w-6" />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveClass('h-6', 'w-6');
    expect(svg).not.toHaveClass('h-4', 'w-4');
  });

  it('keeps an unrelated caller class next to the default size', () => {
    const { container } = render(<SunIcon className="text-text-secondary" />);

    expect(container.querySelector('svg')).toHaveClass(
      'text-text-secondary',
      ...ICON_BASE_CLASS.split(' '),
    );
  });
});
