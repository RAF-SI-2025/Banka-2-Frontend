// TODO: Portal "Hartije od vrednosti" - lista svih hartija
// Assignee: lukastojiljkovic
//
// Ova stranica prikazuje hartije od vrednosti dostupne za trgovinu.
// Klijenti vide samo STOCK i FUTURES, aktuari vide sve.
//
// TODO-1: Tab navigacija po tipu hartije (Akcije | Futures | Forex)
//   - Koristiti shadcn Tabs komponente
//   - Klijent nema Forex tab (proveriti role iz AuthContext)
//   - Podrazumevano prikazati Akcije tab
//
// TODO-2: Tabela sa hartijama
//   - Kolone: Ticker, Naziv, Cena, Promena, Promena%, Volume, Initial Margin Cost
//   - Promena zelena ako >0, crvena ako <0
//   - Koristiti shadcn Table + skeleton loading
//   - FIXME: Poziva listingService.getAll(type, search, page, size)
//
// TODO-3: Pretraga i filtriranje
//   - Search input za ticker ili naziv (debounce 300ms)
//   - Filteri: Exchange (prefix), Price range, Volume range
//   - Za Futures/Options: Settlement Date filter
//   - Sortiranje po: price, volume, maintenance margin
//
// TODO-4: Dugme "Osvezi cene"
//   - Poziva listingService.refresh()
//   - FIXME: Backend POST /listings/refresh
//   - Toast poruka "Cene uspesno osvezene"
//
// TODO-5: Klik na red -> navigacija na /securities/{id} (detalji)
//
// TODO-6: Paginacija (shadcn Pagination ili infinite scroll)
//
// Dizajn: Koristiti isti patern kao AccountListPage/EmployeeListPage
// - Page header sa ikonom + naslov
// - Skeleton loading
// - Empty state sa ikonom

export default function SecuritiesListPage() {
  // TODO: Implementirati prema TODO komentarima iznad

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Hartije od vrednosti</h1>
      <p className="text-muted-foreground">
        Stranica u izradi — pogledaj TODO komentare u kodu.
      </p>
    </div>
  );
}
