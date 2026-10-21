import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Textarea } from '../src/components/textarea/Textarea.js';

describe('Textarea', () => {
  it('associates the label with the field', () => {
    render(<Textarea id="description" label="Leírás" />);

    expect(screen.getByLabelText('Leírás')).toHaveAttribute('id', 'description');
  });

  it('accepts multi-line typed input', async () => {
    render(<Textarea id="description" label="Leírás" />);

    await userEvent.type(screen.getByLabelText('Leírás'), 'első sor');

    expect(screen.getByLabelText('Leírás')).toHaveValue('első sor');
  });

  it('renders the hint and links it through aria-describedby', () => {
    render(<Textarea id="description" label="Leírás" hint="Legfeljebb 2000 karakter" />);

    const field = screen.getByLabelText('Leírás');

    expect(field).toHaveAttribute('aria-describedby', 'description-hint');
    expect(screen.getByText('Legfeljebb 2000 karakter')).toHaveAttribute('id', 'description-hint');
  });

  it('marks the field invalid and shows the error instead of the hint', () => {
    render(<Textarea id="description" label="Leírás" hint="Súgó" error="Túl hosszú" />);

    const field = screen.getByLabelText('Leírás');

    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('aria-describedby', 'description-error');
    expect(field.className).toContain('border-danger');
    expect(screen.getByText('Túl hosszú')).toHaveAttribute('id', 'description-error');
    expect(screen.queryByText('Súgó')).not.toBeInTheDocument();
  });

  it('omits aria attributes when there is neither hint nor error', () => {
    render(<Textarea id="description" label="Leírás" />);

    const field = screen.getByLabelText('Leírás');

    expect(field).not.toHaveAttribute('aria-invalid');
    expect(field).not.toHaveAttribute('aria-describedby');
  });

  it('renders the invalid recipe when invalid is set without a message', () => {
    render(<Textarea id="description" label="Leírás" invalid />);

    expect(screen.getByLabelText('Leírás').className).toContain('border-danger');
  });

  it('defaults to four rows and accepts an explicit row count', () => {
    render(
      <>
        <Textarea id="default-rows" label="Alap" />
        <Textarea id="tall" label="Magas" rows={8} />
      </>,
    );

    expect(screen.getByLabelText('Alap')).toHaveAttribute('rows', '4');
    expect(screen.getByLabelText('Magas')).toHaveAttribute('rows', '8');
  });

  it('forwards native textarea attributes and the disabled state', () => {
    render(<Textarea id="description" label="Leírás" placeholder="Opcionális" disabled />);

    const field = screen.getByLabelText('Leírás');

    expect(field).toHaveAttribute('placeholder', 'Opcionális');
    expect(field).toBeDisabled();
  });
});
