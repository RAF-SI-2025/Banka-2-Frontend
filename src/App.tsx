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
import OtcTrgovinaPage from './pages/Otc/OtcTrgovinaPage';
import OtcOffersAndContractsPage from './pages/Otc/OtcOffersAndContractsPage';

// Celina 4 - Investicioni fondovi
import FundsDiscoveryPage from './pages/Funds/FundsDiscoveryPage';
import FundDetailsPage from './pages/Funds/FundDetailsPage';
import CreateFundPage from './pages/Funds/CreateFundPage';
import ProfitBankPage from './pages/ProfitBank/ProfitBankPage';

export default function App() {
  return (
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
            <Route path="/employee/orders" element={<OrdersListPage />} />
            <Route path="/employee/actuaries" element={<ActuaryManagementPage />} />
            <Route path="/employee/tax" element={<TaxPortalPage />} />
            <Route path="/employee/exchanges" element={<ExchangesPage />} />
          </Route>

          {/* Berza */}
          <Route path="/securities" element={<SecuritiesListPage />} />
          <Route path="/securities/:id" element={<SecuritiesDetailsPage />} />
          <Route path="/orders/new" element={<CreateOrderPage />} />
          <Route path="/orders/my" element={<MyOrdersPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />

          {/* OTC trgovina (Celina 4 intra-bank) */}
          <Route path="/otc" element={<OtcTrgovinaPage />} />
          <Route path="/otc/offers" element={<OtcOffersAndContractsPage />} />

          {/* Investicioni fondovi (Celina 4) */}
          <Route path="/funds" element={<FundsDiscoveryPage />} />
          <Route path="/funds/create" element={<CreateFundPage />} />
          <Route path="/funds/:id" element={<FundDetailsPage />} />
          <Route path="/employee/profit-bank" element={<ProfitBankPage />} />
        </Route>
      </Route>

      {/* 404 catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
