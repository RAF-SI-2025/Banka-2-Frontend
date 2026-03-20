// TODO: Portal "Moj Portfolio"
// Assignee: antonije3 (Antonije)
//
// Stranica za prikaz hartija od vrednosti u vlasnistvu korisnika.
// Pristup: aktuari i klijenti sa permisijom za trgovinu.
//
// TODO-1: Summary kartica na vrhu
//   - Ukupna vrednost portfolija
//   - Ukupan profit (zeleno ako +, crveno ako -)
//   - Placen porez ove godine
//   - Neplacen porez za tekuci mesec
//   - FIXME: Poziva portfolioService.getSummary()
//
// TODO-2: Tabela sa hartijama
//   - Kolone: Tip, Ticker, Kolicina, Prosecna cena, Trenutna cena, Profit, Profit%, Poslednja izmena
//   - Profit kolona: zeleno za +, crveno za -
//   - FIXME: Poziva portfolioService.getMyPortfolio()
//
// TODO-3: "Prodaj" dugme za svaku hartiju
//   - Navigacija na /orders/new?listingId={id}&direction=SELL
//
// TODO-4: (Samo za akcije) "Ucini javnim" opcija
//   - Slider ili input za broj akcija u javnom rezimu
//   - FIXME: Poziva portfolioService.setPublicQuantity(id, qty)
//   - Tooltip: "Javne akcije su vidljive na OTC portalu za trgovinu"
//
// TODO-5: (Samo za aktuare) "Iskoristi opciju" dugme
//   - Prikazuje se samo ako je opcija in-the-money i settlementDate nije prosao
//   - FIXME: Backend endpoint za exercise opcije (buduci sprint)
//
// Dizajn: Koristiti AccountListPage + HomePage summary kao inspiraciju

export default function PortfolioPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Moj portfolio</h1>
      <p className="text-muted-foreground">
        Stranica u izradi — pogledaj TODO komentare u kodu.
      </p>
    </div>
  );
}
