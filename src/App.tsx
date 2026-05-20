import { Routes, Route, Navigate } from 'react-router-dom';

import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/Login/LoginPage';
import LandingPage from './pages/Landing/LandingPage';
import ForgotPasswordPage from './pages/ForgotPassword/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPassword/ResetPasswordPage';
import ActivateAccountPage from './pages/ActivateAccount/ActivateAccountPage';
import EmployeeListPage from './pages/Admin/EmployeeListPage';
import EmployeeCreatePage from './pages/Admin/EmployeeCreatePage';
import EmployeeEditPage from './pages/Admin/EmployeeEditPage';
import NotFoundPage from './pages/Error/NotFoundPage';
import ForbiddenPage from './pages/Error/ForbiddenPage';
import ServerErrorPage from './pages/Error/ServerErrorPage';

// Celina 2 - Klijentske stranice
import HomePage from './pages/HomePage/HomePage';
import AccountListPage from './pages/Accounts/AccountListPage';
import AccountDetailsPage from './pages/Accounts/AccountDetailsPage';
import BusinessAccountDetailsPage from './pages/Accounts/BusinessAccountDetailsPage';
import NewPaymentPage from './pages/Payments/NewPaymentPage';
import PaymentHistoryPage from './pages/Payments/PaymentHistoryPage';
import RecipientsPage from './pages/Payments/RecipientsPage';
import TransferPage from './pages/Transfers/TransferPage';
import TransferHistoryPage from './pages/Transfers/TransferHistoryPage';
import ExchangePage from './pages/Exchange/ExchangePage';
import CardListPage from './pages/Cards/CardListPage';
import LoanListPage from './pages/Loans/LoanListPage';
import LoanApplicationPage from './pages/Loans/LoanApplicationPage';

// Celina 2 - Employee portal stranice
import CreateAccountPage from './pages/Employee/CreateAccountPage';
import AccountsPortalPage from './pages/Employee/AccountsPortalPage';
import AccountCardsPage from './pages/Employee/AccountCardsPage';
import ClientsPortalPage from './pages/Employee/ClientsPortalPage';
import LoanRequestsPage from './pages/Employee/LoanRequestsPage';
import AllLoansPage from './pages/Employee/AllLoansPage';
import AccountRequestsPage from './pages/Employee/AccountRequestsPage';
import CardRequestsPage from './pages/Employee/CardRequestsPage';

// Celina 3 - Berza
import SecuritiesListPage from './pages/Securities/SecuritiesListPage';
import SecuritiesDetailsPage from './pages/Securities/SecuritiesDetailsPage';
import CreateOrderPage from './pages/Orders/CreateOrderPage';
import OrdersListPage from './pages/Orders/OrdersListPage';
import MyOrdersPage from './pages/Orders/MyOrdersPage';
import PortfolioPage from './pages/Portfolio/PortfolioPage';
import ActuaryManagementPage from './pages/Actuary/ActuaryManagementPage';
import TaxPortalPage from './pages/Tax/TaxPortalPage';
import ExchangesPage from './pages/Exchanges/ExchangesPage';
import MarginAccountsPage from './pages/Margin/MarginAccountsPage';
import SupervisorDashboardPage from './pages/Employee/SupervisorDashboardPage';

// Celina 4 - OTC trgovina (intra-bank)
import OtcHubPage from './pages/Otc/OtcHubPage';
import OtcDiscoveryPage from './pages/Otc/OtcDiscoveryPage';
import OtcNegotiationsPage from './pages/Otc/OtcNegotiationsPage';
import OtcContractsPage from './pages/Otc/OtcContractsPage';
import OtcMyPublicPage from './pages/Otc/OtcMyPublicPage';
import OtcNegotiationHistoryPage from './pages/Otc/OtcNegotiationHistoryPage';

// Celina 4 - Investicioni fondovi
import FundsDiscoveryPage from './pages/Funds/FundsDiscoveryPage';
import FundDetailsPage from './pages/Funds/FundDetailsPage';
import CreateFundPage from './pages/Funds/CreateFundPage';
import BranchesPage from './pages/Branches/BranchesPage';
import WaitingRoomHubPage from './pages/WaitingRoom/WaitingRoomHubPage';
import DinoGamePage from './pages/WaitingRoom/DinoGamePage';
import SolitaireGamePage from './pages/WaitingRoom/SolitaireGamePage';
import ChessGamePage from './pages/WaitingRoom/ChessGamePage';
import Banka2RushGamePage from './pages/WaitingRoom/Banka2RushGamePage';
import ProfitBankPage from './pages/ProfitBank/ProfitBankPage';

// Stedna knjizica
import SavingsListPage from './pages/Savings/SavingsListPage';
import SavingsNewDepositPage from './pages/Savings/SavingsNewDepositPage';
import SavingsDetailsPage from './pages/Savings/SavingsDetailsPage';
import AdminSavingsDepositsPage from './pages/Savings/AdminSavingsDepositsPage';
import AdminSavingsRatesPage from './pages/Savings/AdminSavingsRatesPage';
import WatchlistPage from './pages/Watchlist/WatchlistPage';
import PriceAlertsPage from './pages/PriceAlerts/PriceAlertsPage';

// Celina 6 - Arbitro AI asistent (web only). Phase 5 optimizacija:
// React.lazy + Suspense — Arbitro modul (~250KB sa Liquid Glass CSS-om)
// se ucitava tek kada korisnik prvi put klikne FAB. Tako se inicijalni
// bundle ne uvecava za korisnike koji ne otvore asistenta.
import { lazy, Suspense } from 'react';
const ArbitroOverlay = lazy(() =>
  import('./components/assistant/ArbitroOverlay').then((m) => ({ default: m.ArbitroOverlay }))
);

/*
 * TODO [Razvojni ciklus - registracija novih ruta]
 *
 * Registrovati nove rute prateCI postojeci obrazac sa ProtectedRoute cuvarima.
 * Svaka ruta zahteva kreiranja odgovarajuCe page komponente pre dodavanja.
 *
 * [FE1] NotificationsPage — dostupna svim ulogovanim korisnicima (authenticated):
 *   <Route path="/notifications" element={<NotificationsPage />} />
 *   Smestiti unutar <ProtectedRoute> (nije noAgentOnly ni employeeOnly).
 *
 * [FE2] Watchlist + cenovni alarmi: /watchlist, /price-alerts
 *
 * [FE3] RecurringOrdersPage — authenticated, noAgentOnly (kao ostale trgovinske rute):
 *   <Route element={<ProtectedRoute noAgentOnly />}>
 *     <Route path="/recurring-orders" element={<RecurringOrdersPage />} />
 *   </Route>
 *
 *   AuditLogPage — supervisorOnly ili adminOnly (potvrditi sa BE leadom):
 *   <Route element={<ProtectedRoute supervisorOnly />}>
 *     <Route path="/audit-log" element={<AuditLogPage />} />
 *   </Route>
 *
 * [FE4] OtcNegotiationHistoryPage — noAgentOnly (kao ostale OTC rute u bloku /otc):
 *   Dodati unutar postojeCeg <Route element={<ProtectedRoute noAgentOnly />}> bloka:
 *   <Route path="/otc/negotiation-history" element={<OtcNegotiationHistoryPage />} />
 *
 * Tacne putanje i cuvare finalizuje FE lead pre merge-a feature grane.
 */
export default function App() {
  return (
    <>
    <Routes>
      {/* Javne rute */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/activate-account" element={<ActivateAccountPage />} />

      {/* Error stranice */}
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/500" element={<ServerErrorPage />} />

      {/* Zasticene rute - zahtevaju login */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          {/* Legacy ruta - Dashboard preusmeren na novu početnu */}
          <Route path="/dashboard" element={<Navigate to="/home" replace />} />

          {/* Celina 2 - Klijentske rute */}
          <Route path="/home" element={<HomePage />} />
          <Route path="/accounts" element={<AccountListPage />} />
          <Route path="/accounts/:id" element={<AccountDetailsPage />} />
          <Route path="/accounts/:id/business" element={<BusinessAccountDetailsPage />} />
          <Route path="/payments/new" element={<NewPaymentPage />} />
          <Route path="/payments/history" element={<PaymentHistoryPage />} />
          <Route path="/payments/recipients" element={<RecipientsPage />} />
          <Route path="/transfers" element={<TransferPage />} />
          <Route path="/transfers/history" element={<TransferHistoryPage />} />
          <Route path="/exchange" element={<ExchangePage />} />
          <Route path="/cards" element={<CardListPage />} />
          <Route path="/loans" element={<LoanListPage />} />
          <Route path="/loans/apply" element={<LoanApplicationPage />} />
          <Route path="/margin-accounts" element={<MarginAccountsPage />} />

          {/* Admin-only rute */}
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/admin/employees" element={<EmployeeListPage />} />
            <Route path="/admin/employees/new" element={<EmployeeCreatePage />} />
            <Route path="/admin/employees/:id" element={<EmployeeEditPage />} />
          </Route>

          {/* Employee portal rute (svi zaposleni - ADMIN i EMPLOYEE role) */}
          <Route element={<ProtectedRoute employeeOnly />}>
            <Route path="/employee/dashboard" element={<SupervisorDashboardPage />} />
            <Route path="/employee/accounts" element={<AccountsPortalPage />} />
            <Route path="/employee/accounts/new" element={<CreateAccountPage />} />
            <Route path="/employee/accounts/:id/cards" element={<AccountCardsPage />} />
            <Route path="/employee/cards" element={<AccountCardsPage />} />
            <Route path="/employee/card-requests" element={<CardRequestsPage />} />
            <Route path="/employee/account-requests" element={<AccountRequestsPage />} />
            <Route path="/employee/clients" element={<ClientsPortalPage />} />
            <Route path="/employee/clients/:id" element={<ClientsPortalPage />} />
            <Route path="/employee/loan-requests" element={<LoanRequestsPage />} />
            <Route path="/employee/loans" element={<AllLoansPage />} />
            <Route path="/employee/exchanges" element={<ExchangesPage />} />
          </Route>

          {/* Supervisor-only rute (Celina 3 + Celina 4 (Nova) Profit Banke) */}
          <Route element={<ProtectedRoute supervisorOnly />}>
            <Route path="/employee/orders" element={<OrdersListPage />} />
            <Route path="/employee/actuaries" element={<ActuaryManagementPage />} />
            <Route path="/employee/tax" element={<TaxPortalPage />} />
            <Route path="/employee/profit-bank" element={<ProfitBankPage />} />
            <Route path="/funds/create" element={<CreateFundPage />} />
          </Route>

          {/* Berza */}
          <Route path="/securities" element={<SecuritiesListPage />} />
          <Route path="/securities/:id" element={<SecuritiesDetailsPage />} />
          <Route path="/orders/new" element={<CreateOrderPage />} />
          <Route path="/orders/my" element={<MyOrdersPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/price-alerts" element={<PriceAlertsPage />} />

          {/* OTC trgovina (Celina 4 intra+inter-bank) — agenti nemaju pristup po §137-141 */}
          <Route element={<ProtectedRoute noAgentOnly />}>
            <Route path="/otc" element={<OtcHubPage />} />
            <Route path="/otc/discovery" element={<OtcDiscoveryPage />} />
            <Route path="/otc/pregovori" element={<OtcNegotiationsPage />} />
            <Route path="/otc/ugovori" element={<OtcContractsPage />} />
            <Route path="/otc/moje" element={<OtcMyPublicPage />} />
          </Route>

          {/* OTC istorija pregovora (FE4 7.3) — admin/supervizor portal;
              B10 lista (/otc/negotiation-history) je admin/supervizor-only */}
          <Route element={<ProtectedRoute supervisorOnly />}>
            <Route path="/otc/negotiation-history" element={<OtcNegotiationHistoryPage />} />
          </Route>

          {/* Investicioni fondovi (Celina 4) — discovery i details su za sve */}
          <Route path="/funds" element={<FundsDiscoveryPage />} />
          <Route path="/funds/:id" element={<FundDetailsPage />} />

          {/* Mapa lokacija (ekspoziture + bankomati) — svi role-ovi */}
          <Route path="/branches" element={<BranchesPage />} />

          {/* Soba za cekanje — svi role-ovi */}
          <Route path="/soba-za-cekanje" element={<WaitingRoomHubPage />} />
          <Route path="/soba-za-cekanje/dino" element={<DinoGamePage />} />
          <Route path="/soba-za-cekanje/solitaire" element={<SolitaireGamePage />} />
          <Route path="/soba-za-cekanje/sah" element={<ChessGamePage />} />
          <Route path="/soba-za-cekanje/banka-rush" element={<Banka2RushGamePage />} />

          {/* Stedna knjizica — klijent rute (noAgentOnly) */}
          <Route element={<ProtectedRoute noAgentOnly />}>
            <Route path="/savings" element={<SavingsListPage />} />
            <Route path="/savings/new" element={<SavingsNewDepositPage />} />
            <Route path="/savings/:id" element={<SavingsDetailsPage />} />
          </Route>

          {/* Stedna knjizica — admin/supervisor rute */}
          <Route element={<ProtectedRoute supervisorOnly />}>
            <Route path="/admin/savings/deposits" element={<AdminSavingsDepositsPage />} />
          </Route>
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/admin/savings/rates" element={<AdminSavingsRatesPage />} />
          </Route>
        </Route>
      </Route>

      {/* 404 catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    {/* Suspense fallback je null — FAB nije kriticno za prvi paint, mozemo
        ga sakriti dok se chunk ucita. */}
    <Suspense fallback={null}>
      <ArbitroOverlay />
    </Suspense>
    </>
  );
}
