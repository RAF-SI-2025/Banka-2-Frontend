// TODO: "Moji nalozi" - korisnik vidi svoje ordere
// Assignee: ekalajdzic13322 (Elena)
//
// TODO-1: Tabela sa korisnikovim orderima
//   - Kolone: Hartija, Tip, Kolicina, Cena, Smer, Status, Datum
//   - Status badge sa bojama
//   - Sortiranje po datumu DESC
//   - FIXME: Poziva orderService.getMy(page, size)
//
// TODO-2: Detalji ordera u dialogu
//   - Remaining portions, provizija, racun
//
// Dizajn: Koristiti PaymentHistoryPage patern

export default function MyOrdersPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Moji nalozi</h1>
      <p className="text-muted-foreground">
        Stranica u izradi — pogledaj TODO komentare u kodu.
      </p>
    </div>
  );
}
