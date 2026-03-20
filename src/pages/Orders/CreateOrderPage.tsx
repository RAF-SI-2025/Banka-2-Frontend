// TODO: Kreiranje ordera (BUY/SELL)
// Assignee: ekalajdzic13322 (Elena)
//
// Stranica za kreiranje novog naloga za kupovinu/prodaju hartije.
// Pristup: aktuari i klijenti sa permisijom za trgovinu.
//
// TODO-1: Forma sa poljima
//   - Hartija: dolazi iz query parametra ?listingId={id} ili select
//   - Smer: BUY / SELL radio buttons
//   - Kolicina: number input (min 1, default 1)
//   - Tip ordera: select (Market | Limit | Stop | Stop-Limit)
//     - Ako Market: nema dodatnih polja
//     - Ako Limit: prikazati Limit Value input
//     - Ako Stop: prikazati Stop Value input
//     - Ako Stop-Limit: prikazati oba inputa
//   - All or None: checkbox
//   - Margin: checkbox (samo ako korisnik ima permisiju)
//   - Racun: select sa listom korisnikovih racuna
//     - Klijent: njegovi racuni
//     - Zaposleni: bankini racuni
//     - FIXME: Koristiti accountService.getMyAccounts() ili getAll()
//
// TODO-2: Prikaz priblizne cene
//   - approximatePrice = contractSize * pricePerUnit * quantity
//   - pricePerUnit zavisi od tipa ordera i smera
//   - Prikazati proviziju: Market = min(14%, $7), Limit = min(24%, $12)
//   - Prikazati ukupno = approximatePrice + provizija
//
// TODO-3: Konfirmacioni dialog pre slanja
//   - Prikazati sve detalje ordera
//   - Dugme "Potvrdi" i "Odustani"
//   - FIXME: Poziva orderService.create(request)
//
// TODO-4: Upozorenja
//   - Ako je berza zatvorena: "Berza je trenutno zatvorena"
//   - Ako je after-hours: "Berza se zatvara uskoro, izvrsavanje ce biti sporije"
//   - Koristiti shadcn Alert komponentu
//
// TODO-5: Validacija (zod schema)
//   - Kolicina >= 1
//   - Limit/Stop vrednost > 0 ako je odabran taj tip
//   - Racun je obavezan
//
// Dizajn: Koristiti NewPaymentPage/LoanApplicationPage kao inspiraciju

export default function CreateOrderPage() {
  // TODO: Implementirati prema TODO komentarima iznad

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Novi nalog</h1>
      <p className="text-muted-foreground">
        Stranica u izradi — pogledaj TODO komentare u kodu.
      </p>
    </div>
  );
}
