// ============================================================
// Tipovi za Banka 2025 - Celina 2: Osnovno poslovanje banke
// ============================================================

// --- Enumi ---

export const AccountType = {
  // Backend vrednosti
  CHECKING: 'CHECKING',   // Tekući
  FOREIGN: 'FOREIGN',     // Devizni
  BUSINESS: 'BUSINESS',   // Poslovni
  MARGIN: 'MARGIN',       // Maržni
  // FE legacy nazivi (zadržani radi kompatibilnosti)
  TEKUCI: 'TEKUCI',
  DEVIZNI: 'DEVIZNI',
  POSLOVNI: 'POSLOVNI',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const AccountSubtype = {
  // Licni racun podvrste
  STANDARDNI: 'STANDARDNI',
  STEDNI: 'STEDNI',
  PENZIONERSKI: 'PENZIONERSKI',
  ZA_MLADE: 'ZA_MLADE',
  STUDENTSKI: 'STUDENTSKI',
  ZA_NEZAPOSLENE: 'ZA_NEZAPOSLENE',
  // Poslovni racun podvrste
  DOO: 'DOO',
  AD: 'AD',
  FONDACIJA: 'FONDACIJA',
} as const;
export type AccountSubtype = (typeof AccountSubtype)[keyof typeof AccountSubtype];

export const AccountStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
} as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export const Currency = {
  RSD: 'RSD',
  EUR: 'EUR',
  CHF: 'CHF',
  USD: 'USD',
  GBP: 'GBP',
  JPY: 'JPY',
  CAD: 'CAD',
  AUD: 'AUD',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const TransactionStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const CardType = {
  VISA: 'VISA',
  MASTERCARD: 'MASTERCARD',
  DINACARD: 'DINACARD',
  AMERICAN_EXPRESS: 'AMERICAN_EXPRESS',
} as const;
export type CardType = (typeof CardType)[keyof typeof CardType];

export const CardStatus = {
  ACTIVE: 'ACTIVE',
  BLOCKED: 'BLOCKED',
  DEACTIVATED: 'DEACTIVATED',
} as const;
export type CardStatus = (typeof CardStatus)[keyof typeof CardStatus];

export const LoanType = {
  GOTOVINSKI: 'GOTOVINSKI',
  STAMBENI: 'STAMBENI',
  AUTO: 'AUTO',
  STUDENTSKI: 'STUDENTSKI',
  REFINANSIRAJUCI: 'REFINANSIRAJUCI',
} as const;
export type LoanType = (typeof LoanType)[keyof typeof LoanType];

export const LoanStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ACTIVE: 'ACTIVE',
  PAID: 'PAID',
  PAID_OFF: 'PAID_OFF',
  LATE: 'LATE',
  CLOSED: 'CLOSED',
} as const;
export type LoanStatus = (typeof LoanStatus)[keyof typeof LoanStatus];

export const InterestRateType = {
  FIKSNI: 'FIKSNI',
  VARIJABILNI: 'VARIJABILNI',
} as const;
export type InterestRateType = (typeof InterestRateType)[keyof typeof InterestRateType];

// --- Interfejsi ---

export interface Account {
  id: number;
  accountNumber: string;        // 18 cifara
  ownerName: string;
  accountType: AccountType;
  accountSubType?: string;       // Backend polje (uppercase T)
  accountSubtype?: AccountSubtype; // Legacy alias
  currency: Currency;
  currencyCode?: string;         // Backend alias za currency
  balance: number;
  availableBalance: number;
  reservedBalance: number;       // FE alias
  reservedFunds?: number;        // Backend polje
  dailyLimit: number;
  monthlyLimit: number;
  dailySpending: number;         // Potroseno danas
  monthlySpending: number;       // Potroseno ovog meseca
  maintenanceFee: number;        // Odrzavanje racuna
  status: AccountStatus;
  createdAt: string;
  expirationDate?: string;
  createdByEmployee?: string;    // Ime zaposlenog koji je kreirao racun
  name?: string;                 // Korisnikov naziv za racun
  company?: CompanyInfo;         // Podaci o firmi (za poslovne racune)
}

export interface CompanyInfo {
  id?: number;
  name: string;
  registrationNumber: string;
  taxNumber: string;
  activityCode: string;
  address?: string;
}

export interface BusinessAccount extends Account {
  firm?: Firm;
}

export interface Firm {
  id?: number;
  companyName: string;
  registrationNumber: string;    // Maticni broj firme
  taxId: string;                 // PIB
  activityCode: string;          // Sifra delatnosti (format xx.xx)
  address?: string;
  city?: string;
  country?: string;
}

export interface Transaction {
  id: number;
  fromAccountNumber: string;
  toAccountNumber: string;
  amount: number;
  currency: Currency;
  description: string;
  referenceNumber?: string;
  paymentCode: string;           // Sifra placanja (2xx format)
  paymentPurpose: string;
  recipientName: string;
  status: TransactionStatus;
  createdAt: string;
  model?: string;                // Model poziva na broj (97, 11, etc.)
  callNumber?: string;           // Poziv na broj
}

export interface Transfer {
  id: number;
  fromAccountNumber: string;
  toAccountNumber: string;
  amount: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  exchangeRate?: number;
  convertedAmount?: number;
  commission?: number;           // Provizija
  status: TransactionStatus;
  createdAt: string;
}

export interface PaymentRecipient {
  id: number;
  name: string;
  accountNumber: string;
  createdAt?: string;
}

export interface Card {
  id: number;
  cardNumber: string;            // 16 cifara (prikazuje se maskirano)
  cardType?: CardType;
  cardName?: string;             // Backend: "Visa Debit" itd.
  accountId?: number;            // Backend ID racuna
  accountNumber: string;
  holderName?: string;
  ownerName?: string;            // Backend polje za ime vlasnika
  expirationDate: string;
  cvv?: string;                  // 3 cifre, prikazuje se samo pri kreiranju
  status: CardStatus;
  limit?: number;                // FE legacy
  cardLimit?: number;            // Backend polje za limit
  createdAt: string;
}

export interface AuthorizedPerson {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phoneNumber: string;
  address: string;
}

export interface ExchangeRate {
  currency: Currency;
  buyRate: number;
  sellRate: number;
  middleRate: number;
  date: string;
}

export interface Loan {
  id: number;
  loanNumber?: string;           // Broj kredita (razlicit od id-a)
  loanType: LoanType | string;
  amount: number;
  repaymentPeriod: number;       // U mesecima
  interestRateType?: InterestRateType;
  interestType?: string;         // BE vraca 'FIXED' / 'VARIABLE'
  nominalRate: number;           // Nominalna kamatna stopa
  effectiveRate: number;         // EKS
  monthlyPayment: number;
  startDate: string;
  endDate: string;
  remainingDebt: number;
  currency: Currency | string;
  status: LoanStatus;
  accountNumber: string;
  loanPurpose?: string;          // Svrha kredita
  createdAt?: string;
}

export interface Installment {
  id: number;
  amount: number;
  principalAmount: number;       // Iznos glavnice
  interestAmount: number;        // Iznos kamatne stope
  interestRate: number;          // Kamatna stopa za tu ratu
  currency: Currency;
  expectedDueDate: string;       // Ocekivani datum dospeca
  actualDueDate?: string;        // Pravi datum dospeca
  paid: boolean;
}

export interface LoanRequest {
  id: number;
  loanType: LoanType | string;
  interestRateType?: InterestRateType;
  interestType?: string;         // BE vraca 'FIXED' / 'VARIABLE'
  amount: number;
  currency: Currency | string;
  loanPurpose: string;
  repaymentPeriod: number;
  accountNumber: string;
  phoneNumber: string;
  employmentStatus?: string;
  monthlyIncome?: number;
  permanentEmployment?: boolean;
  employmentPeriod?: number;
  status: LoanStatus;
  createdAt: string;
  clientEmail?: string;
  clientName?: string;
}

// --- Request/Response tipovi ---

export interface NewPaymentRequest {
  fromAccountNumber: string;
  toAccountNumber: string;
  amount: number;
  recipientName: string;
  paymentCode: string;
  paymentPurpose: string;
  referenceNumber?: string;
  model?: string;
  callNumber?: string;
}

export interface TransferRequest {
  fromAccountNumber: string;
  toAccountNumber: string;
  amount: number;
}

export interface ExchangeRequest {
  fromCurrency: string | Currency;
  toCurrency: string | Currency;
  amount: number;
  accountNumber?: string;
}

export interface NewCardRequest {
  accountId: number;
  cardLimit?: number;
}

export interface LoanApplicationRequest {
  loanType: LoanType | string;
  interestRateType: InterestRateType | string;
  amount: number;
  currency: Currency | string;
  loanPurpose: string;
  repaymentPeriod: number;
  accountNumber: string;
  phoneNumber: string;
  employmentStatus?: string;
  monthlyIncome?: number;
  permanentEmployment?: boolean;
  employmentPeriod?: number;
}

export interface CreateAccountRequest {
  ownerEmail: string;
  accountType: AccountType;
  accountSubtype?: AccountSubtype;
  currency: Currency;
  initialDeposit?: number;
  createCard?: boolean;          // Checkbox "Napravi karticu"
  // Za poslovni racun - podaci o firmi
  companyName?: string;
  registrationNumber?: string;
  taxId?: string;
  activityCode?: string;
  firmAddress?: string;
  firmCity?: string;
  firmCountry?: string;
}

export interface ChangeLimitRequest {
  dailyLimit?: number;
  monthlyLimit?: number;
}

export interface CreateRecipientRequest {
  name: string;
  accountNumber: string;
}

export interface UpdateRecipientRequest {
  name?: string;
  accountNumber?: string;
}

export interface TransactionFilters {
  accountNumber?: string;
  status?: TransactionStatus;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  page?: number;
  limit?: number;
}

export interface AccountFilters {
  ownerEmail?: string;
  ownerName?: string;            // Pretraga po imenu vlasnika
  accountType?: AccountType;
  status?: AccountStatus;
  page?: number;
  limit?: number;
}

export interface LoanFilters {
  loanType?: LoanType | string;
  status?: LoanStatus | string;
  accountNumber?: string;        // Filter po broju racuna
  page?: number;
  limit?: number;
}

export interface ClientFilters {
  firstName?: string;
  lastName?: string;
  email?: string;
  page?: number;
  limit?: number;
}

export interface VerificationRequest {
  transactionId: number;
  code: string;
}


