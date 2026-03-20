// TODO: Detaljan prikaz hartije od vrednosti
// Assignee: lukastojiljkovic
//
// Ova stranica prikazuje detalje jedne hartije sa grafikom promene cene.
//
// TODO-1: Grafik promene cene
//   - Koristiti recharts ili lightweight-charts biblioteku
//   - Periodi: 1D | 1W | 1M | 1Y | 5Y | Sve (dugmici)
//   - X osa: datum, Y osa: cena
//   - FIXME: Poziva listingService.getHistory(id, period)
//
// TODO-2: Tabela sa osnovnim podacima
//   - Ticker, Naziv, Berza, Tip
//   - Cena, Ask, Bid, Volume, Promena, Promena%
//   - Initial Margin Cost, Maintenance Margin
//   - Za STOCK: Market Cap, Outstanding Shares, Dividend Yield
//   - Za FOREX: Base Currency, Quote Currency, Liquidity
//   - Za FUTURES: Contract Size, Contract Unit, Settlement Date
//   - FIXME: Poziva listingService.getById(id)
//
// TODO-3: Dugme "Kupi" -> navigacija na /orders/new?listingId={id}&direction=BUY
//
// TODO-4: (Samo za akcije) Sekcija sa opcijama
//   - Prikaz opcija u Call/Put tabeli grupisano po settlement date
//   - In-the-money (zeleno) / Out-of-money (crveno/belo) bojenje
//   - Shared Price (market price) kao centralni red
//   - Filter za broj strike-ova (min 1, max koliko ima)
//   - FIXME: Backend endpoint za opcije (buduci sprint)
//
// Dizajn: Koristiti AccountDetailsPage kao inspiraciju
// - Breadcrumb navigacija (Hartije > {ticker})
// - Card za grafik, Card za podatke

export default function SecuritiesDetailsPage() {
  // TODO: Implementirati prema TODO komentarima iznad

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Detalji hartije</h1>
      <p className="text-muted-foreground">
        Stranica u izradi — pogledaj TODO komentare u kodu.
      </p>
    </div>
  );
}
