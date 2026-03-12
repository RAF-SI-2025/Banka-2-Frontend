import { useNavigate } from 'react-router-dom';
import {
  Landmark,
  Shield,
  Users,
  CreditCard,
  ArrowRight,
  BarChart3,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const features = [
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Upravljanje zaposlenima',
    description:
      'Kreiranje, pregled i upravljanje nalozima zaposlenih sa kompletnim sistemom permisija.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Sigurna autentifikacija',
    description:
      'JWT autentifikacija sa access/refresh tokenima, aktivacija naloga putem email-a.',
  },
  {
    icon: <CreditCard className="h-6 w-6" />,
    title: 'Bankarsko poslovanje',
    description:
      'Upravljanje računima, plaćanja, transferi, menjačnica, kartice i krediti.',
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: 'Trgovina hartijama',
    description:
      'Kupovina i prodaja akcija, terminskih ugovora, valutnih parova i opcija na berzi.',
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: 'Sistem permisija',
    description:
      'Granularna kontrola pristupa — od osnovnih bankarskih operacija do administratorskih funkcija.',
  },
  {
    icon: <Landmark className="h-6 w-6" />,
    title: 'Više valuta',
    description:
      'Podrška za RSD, EUR, CHF, USD, GBP, JPY, CAD i AUD sa automatskom konverzijom.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-indigo-950/80 backdrop-blur supports-[backdrop-filter]:bg-indigo-950/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <Landmark className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Banka 2025</span>
          </div>
          <Button
            className="bg-white text-indigo-950 hover:bg-indigo-100"
            onClick={() => navigate('/login')}
          >
            Prijavi se
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-28">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Landmark className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Moderno bankarstvo
            <br />
            <span className="text-indigo-300">na dohvat ruke</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-indigo-200">
            Platforma za upravljanje bankarskim poslovanjem — od korisničkih naloga
            i transakcija do trgovine hartijama od vrednosti.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button
              size="lg"
              className="bg-white text-indigo-950 hover:bg-indigo-100"
              onClick={() => navigate('/login')}
            >
              Prijavi se
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => {
                document
                  .getElementById('features')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Saznaj više
            </Button>
          </div>
        </div>
      </section>

      <Separator className="mx-auto max-w-6xl bg-white/10" />

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Sve što vam je potrebno
          </h2>
          <p className="text-indigo-300 max-w-2xl mx-auto">
            Kompletna platforma za upravljanje bankarskim sistemom sa fokusom na
            sigurnost, efikasnost i jednostavnost korišćenja.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors"
            >
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 mb-2">
                  {feature.icon}
                </div>
                <CardTitle className="text-white">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-indigo-200">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center gap-6 py-12 text-center">
            <h3 className="text-2xl font-bold text-white sm:text-3xl">
              Spremni da počnete?
            </h3>
            <p className="text-indigo-200 max-w-lg">
              Prijavite se na portal za upravljanje bankarskim sistemom i započnite rad.
            </p>
            <Button
              size="lg"
              className="bg-white text-indigo-950 hover:bg-indigo-100"
              onClick={() => navigate('/login')}
            >
              Prijavi se na portal
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-medium text-indigo-300">
                Banka 2025
              </span>
            </div>
            <p className="text-xs text-indigo-400">
              Softversko inženjerstvo — Računarski fakultet, 2025/26
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
