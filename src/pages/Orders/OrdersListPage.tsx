// TODO: Portal "Pregled ordera" - supervizor
// Assignee: jkrunic (Jovan)
//
// Stranica za supervizore da pregledaju, odobre ili odbiju ordere.
//
// TODO-1: Tabela sa orderima
//   - Kolone: Agent, Tip ordera, Hartija (tip), Kolicina, CS, Cena, Smer, Preostalo, Status
//   - Status badge: PENDING (zuti), APPROVED (zeleni), DECLINED (crveni), DONE (sivi)
//   - FIXME: Poziva orderService.getAll(status, page, size)
//
// TODO-2: Filtriranje po statusu
//   - Tab bar ili select: Svi | Na cekanju | Odobreni | Odbijeni | Zavrseni
//   - Podrazumevano: "Na cekanju" tab
//
// TODO-3: Approve/Decline dugmici
//   - Prikazuju se samo za PENDING ordere
//   - "Odobri" dugme (zeleno) -> orderService.approve(id)
//   - "Odbij" dugme (crveno) -> orderService.decline(id)
//   - Ako je settlementDate prosao -> samo "Odbij" dugme
//   - Konfirmacioni dialog pre akcije
//   - FIXME: Backend PATCH /orders/{id}/approve i /decline
//
// TODO-4: Detalji ordera
//   - Klik na red ili "Detalji" dugme
//   - Dialog/drawer sa svim podacima ordera
//   - Ukljuciti: ko je postavio, kada, ukupna cena, provizija
//
// TODO-5: Otkazivanje ordera
//   - Dugme "Otkazi" za ordere koji nisu kompletno izvrseni
//   - FIXME: Backend endpoint za otkazivanje (buduci sprint)
//
// Dizajn: Koristiti LoanRequestsPage kao inspiraciju

export default function OrdersListPage() {
  // TODO: Implementirati prema TODO komentarima iznad

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Pregled naloga</h1>
      <p className="text-muted-foreground">
        Stranica u izradi — pogledaj TODO komentare u kodu.
      </p>
    </div>
  );
}
