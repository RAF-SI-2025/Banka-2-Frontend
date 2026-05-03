import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageHeader from './PageHeader';
import { PiggyBank } from 'lucide-react';

describe('PageHeader', () => {
  it('renderuje naslov i ikonu', () => {
    render(<PageHeader icon={<PiggyBank data-testid="ph-icon" />} title="Investicioni fondovi" />);
    expect(screen.getByText('Investicioni fondovi')).toBeInTheDocument();
    expect(screen.getByTestId('ph-icon')).toBeInTheDocument();
  });

  it('renderuje opciono description ispod naslova', () => {
    render(
      <PageHeader
        icon={<PiggyBank />}
        title="Naslov"
        description="Detaljan opis"
      />,
    );
    expect(screen.getByText('Detaljan opis')).toBeInTheDocument();
  });

  it('NE renderuje description kad nije proslijedjen', () => {
    const { container } = render(<PageHeader icon={<PiggyBank />} title="Naslov" />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  it('renderuje actions slot sa desne strane', () => {
    render(
      <PageHeader
        icon={<PiggyBank />}
        title="Naslov"
        actions={<button>Akcija</button>}
      />,
    );
    expect(screen.getByText('Akcija')).toBeInTheDocument();
  });

  it('size=md koristi manje klase za ikonu i naslov', () => {
    const { container } = render(
      <PageHeader icon={<PiggyBank />} title="Naslov" size="md" />,
    );
    expect(container.querySelector('.h-9')).toBeTruthy();
    expect(container.querySelector('h1')).toHaveClass('text-2xl');
  });

  it('size=lg (default) koristi vece klase', () => {
    const { container } = render(
      <PageHeader icon={<PiggyBank />} title="Naslov" />,
    );
    expect(container.querySelector('.h-10')).toBeTruthy();
    expect(container.querySelector('h1')).toHaveClass('text-3xl');
  });
});
