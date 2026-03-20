// TODO: Portal "Upravljanje aktuarima" - samo za supervizore
// Assignee: sssmarta (Marta)
//
// TODO-1: Tabela sa agentima
//   - Kolone: Ime, Prezime, Email, Pozicija, Limit, Iskorisceno, Need Approval
//   - Progress bar za limit iskoriscenost (usedLimit / dailyLimit)
//   - FIXME: Poziva actuaryService.getAgents(email, firstName, lastName)
//
// TODO-2: Filtriranje
//   - Search po email, imenu, prezimenu
//   - Debounce 300ms
//
// TODO-3: Promena limita
//   - Klik na "Izmeni" otvara dialog
//   - Input za novi dailyLimit (number)
//   - Checkbox za needApproval
//   - FIXME: Poziva actuaryService.updateLimit(employeeId, data)
//
// TODO-4: Reset dugme
//   - "Resetuj limit" dugme za svakog agenta
//   - Postavlja usedLimit na 0
//   - Konfirmacioni dialog
//   - FIXME: Poziva actuaryService.resetLimit(employeeId)
//
// Dizajn: Koristiti EmployeeListPage kao inspiraciju

export default function ActuaryManagementPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Upravljanje aktuarima</h1>
      <p className="text-muted-foreground">
        Stranica u izradi — pogledaj TODO komentare u kodu.
      </p>
    </div>
  );
}
