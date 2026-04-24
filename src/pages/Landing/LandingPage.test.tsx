import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LandingPage from './LandingPage';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockSetTheme = vi.fn();
let currentTheme: 'light' | 'dark' | 'system' = 'light';

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: currentTheme,
    setTheme: mockSetTheme,
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  currentTheme = 'light';
  mockFetch.mockResolvedValue({ ok: true });

  const mockIntersectionObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn().mockImplementation((el: Element) => {
      callback([{ isIntersecting: true, target: el }]);
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: mockIntersectionObserver,
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────
// Napomena: hero naslov je podeljen preko <br/> i <span>-ova, zato
// koristimo pod-elementne upite (getByText matcher funkcija ili
// getAllByText sa cinonim prisustvom dela stringa).

describe('LandingPage', () => {
  it('renders the hero heading fragments', () => {
    render(<LandingPage />);
    // "Moderno", "bankarstvo", "na dohvat ruke" su u razdvojenim elementima
    expect(screen.getByText('Moderno')).toBeInTheDocument();
    expect(screen.getByText('bankarstvo')).toBeInTheDocument();
    expect(screen.getByText('na dohvat ruke')).toBeInTheDocument();
  });

  it('renders the hero subtitle', () => {
    render(<LandingPage />);
    expect(
      screen.getByText(/Kompletna platforma za upravljanje racunima/i),
    ).toBeInTheDocument();
  });

  it('renders CTA buttons', () => {
    render(<LandingPage />);
    const loginButtons = screen.getAllByText(/Prijavi se/);
    expect(loginButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('navigates to /login when hero CTA is clicked', () => {
    render(<LandingPage />);
    const loginButtons = screen.getAllByText(/Prijavi se/);
    fireEvent.click(loginButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('renders "Saznaj vise" button', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Saznaj vise/)).toBeInTheDocument();
  });

  it('renders all 6 feature cards', () => {
    render(<LandingPage />);
    expect(screen.getByText('Upravljanje zaposlenima')).toBeInTheDocument();
    expect(screen.getByText('Sigurna autentifikacija')).toBeInTheDocument();
    expect(screen.getByText('Bankarsko poslovanje')).toBeInTheDocument();
    expect(screen.getByText('Trgovina hartijama')).toBeInTheDocument();
    expect(screen.getByText('Sistem permisija')).toBeInTheDocument();
    expect(screen.getByText('Više valuta')).toBeInTheDocument();
  });

  it('renders feature descriptions', () => {
    render(<LandingPage />);
    expect(
      screen.getByText(/Kompletni CRUD nad nalozima/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/JWT access\/refresh tokeni, OTP verifikacija/),
    ).toBeInTheDocument();
  });

  it('renders the 4-step section copy', () => {
    render(<LandingPage />);
    // Stranica ima 4 koraka umesto eksplicitnog "Mogucnosti" headinga
    expect(screen.getByText('Registracija')).toBeInTheDocument();
    expect(screen.getByText('Otvaranje racuna')).toBeInTheDocument();
    expect(screen.getByText('Transakcije')).toBeInTheDocument();
    expect(screen.getByText('Berza')).toBeInTheDocument();
    expect(screen.getByText('4 koraka do cilja')).toBeInTheDocument();
  });

  it('renders the CTA section copy', () => {
    render(<LandingPage />);
    expect(screen.getByText('Spremni da')).toBeInTheDocument();
    expect(screen.getByText('pocnete?')).toBeInTheDocument();
    // "Prijavi se na portal" se nalazi i u hero-u i u CTA sekciji
    expect(screen.getAllByText('Prijavi se na portal').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates to /login from CTA section button', () => {
    render(<LandingPage />);
    const portalButtons = screen.getAllByText('Prijavi se na portal');
    // Zadnji je u CTA sekciji
    fireEvent.click(portalButtons[portalButtons.length - 1]);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('renders the logo in navbar, CTA, and footer', () => {
    const { container } = render(<LandingPage />);
    // logo.svg se koristi na 3 mesta (navbar, CTA, footer). Slika je
    // dekorativna (alt=""), pa biramo po src atributu.
    const logos = container.querySelectorAll('img[src="/logo.svg"]');
    expect(logos.length).toBe(3);
  });

  it('renders the "BANKA 2025" branding text', () => {
    render(<LandingPage />);
    // Brendiranje je u navbaru i footeru, "BANKA" + "2025" su razdvojeni
    // spanovima zbog gradient text efekta.
    const brands = screen.getAllByText('BANKA', { exact: false });
    expect(brands.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the currency ticker with all currency pairs', () => {
    render(<LandingPage />);
    // Ticker je zapisan u `<currency>/<currency>` formatu (npr. EUR/RSD)
    // i duplikovan 4 puta radi seamless scroll animacije.
    expect(screen.getAllByText(/EUR\/RSD/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/USD\/RSD/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/GBP\/RSD/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CHF\/RSD/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/JPY\/RSD/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CAD\/RSD/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/AUD\/RSD/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders stock tickers in the ticker strip', () => {
    render(<LandingPage />);
    expect(screen.getAllByText(/AAPL/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/MSFT/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/TSLA/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the theme toggle button', () => {
    render(<LandingPage />);
    const themeButton = screen.getByTitle('Tema');
    expect(themeButton).toBeInTheDocument();
    expect(themeButton).toHaveAttribute('aria-label', 'Promeni temu');
  });

  it('cycles theme on toggle click: light -> dark', () => {
    currentTheme = 'light';
    render(<LandingPage />);
    fireEvent.click(screen.getByTitle('Tema'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('cycles theme from dark to system', () => {
    currentTheme = 'dark';
    render(<LandingPage />);
    fireEvent.click(screen.getByTitle('Tema'));
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('cycles theme from system to light', () => {
    currentTheme = 'system';
    render(<LandingPage />);
    fireEvent.click(screen.getByTitle('Tema'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('displays backend status checking initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<LandingPage />);
    expect(screen.getByText('Provera servera...')).toBeInTheDocument();
  });

  it('renders the footer with university info', () => {
    render(<LandingPage />);
    expect(
      screen.getByText(/Softversko inzenjerstvo .* Racunarski fakultet/),
    ).toBeInTheDocument();
  });

  it('renders the scroll indicator', () => {
    const { container } = render(<LandingPage />);
    const scrollIndicator = container.querySelector('.animate-float');
    expect(scrollIndicator).not.toBeNull();
  });

  it('renders the sticky navbar', () => {
    render(<LandingPage />);
    const nav = document.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav!.className).toContain('sticky');
  });
});
