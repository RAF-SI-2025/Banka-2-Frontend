// TODO: Portal "Porez tracking" - samo za supervizore
// Assignee: sssmarta (Marta)
//
// TODO-1: Tabela sa korisnicima i dugovanjima
//   - Kolone: Ime, Tip (klijent/aktuar), Ukupan profit, Porez, Placeno, Dugovanje
//   - Dugovanje u RSD (konverzija ako je druga valuta)
//   - FIXME: Poziva taxService.getTaxRecords(userType, name)
//
// TODO-2: Filtriranje
//   - Po tipu korisnika: Svi | Klijenti | Aktuari
//   - Po imenu (search)
//
// TODO-3: Dugme "Pokreni obracun"
//   - Pokrece mesecni obracun poreza za SVE korisnike
//   - Konfirmacioni dialog: "Da li ste sigurni? Porez ce biti skinut sa racuna svih korisnika."
//   - FIXME: Poziva taxService.triggerCalculation()
//
// Dizajn: Koristiti ClientsPortalPage kao inspiraciju

export default function TaxPortalPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Porez na kapitalnu dobit</h1>
      <p className="text-muted-foreground">
        Stranica u izradi — pogledaj TODO komentare u kodu.
      </p>
    </div>
  );
}
