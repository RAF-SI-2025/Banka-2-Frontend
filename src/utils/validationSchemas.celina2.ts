import { z } from 'zod';
import { phoneSchema, nameSchema, emailSchema } from './validationSchemas';


// ============================================================
// Validacione seme za Banka 2025 - Celina 2: Osnovno poslovanje
// ============================================================

// --- Helpers ---

const accountNumberSchema = z
  .string()
  .min(1, 'Broj racuna je obavezan')
  .regex(/^\d{18}$/, 'Broj racuna mora imati tacno 18 cifara');

const positiveAmountSchema = z
  .number({ message: 'Iznos mora biti broj' })
  .positive('Iznos mora biti veci od 0')
  .max(999999999999.99, 'Iznos prelazi maksimalnu dozvoljenu vrednost');

const paymentCodeSchema = z
  .string()
  .min(1, 'Sifra placanja je obavezna')
  .regex(/^2\d{2}$/, 'Sifra placanja mora biti u formatu 2xx');

// --- Novo placanje ---

export const newPaymentSchema = z.object({
  fromAccountNumber: accountNumberSchema,
  toAccountNumber: accountNumberSchema,
  amount: positiveAmountSchema,
  recipientName: nameSchema,
  paymentCode: paymentCodeSchema,
  paymentPurpose: z.string().min(1, 'Svrha placanja je obavezna').max(256, 'Maksimalno 256 karaktera'),
  referenceNumber: z.string().optional(),
  model: z.string().optional(),
  callNumber: z.string().optional(),
});
export type NewPaymentFormData = z.infer<typeof newPaymentSchema>;

// --- Prenos izmedju sopstvenih racuna ---

export const transferSchema = z.object({
  fromAccountNumber: accountNumberSchema,
  toAccountNumber: accountNumberSchema,
  amount: positiveAmountSchema,
}).refine((data) => data.fromAccountNumber !== data.toAccountNumber, {
  message: 'Racun posiljaoca i primaoca ne mogu biti isti',
  path: ['toAccountNumber'],
});
export type TransferFormData = z.infer<typeof transferSchema>;

// --- Menjacnica ---

export const exchangeSchema = z.object({
  fromCurrency: z.string().min(1, 'Izaberite valutu'),
  toCurrency: z.string().min(1, 'Izaberite valutu'),
  amount: positiveAmountSchema,
  accountNumber: z.string().optional(),
}).refine((data) => data.fromCurrency !== data.toCurrency, {
  message: 'Valute moraju biti razlicite',
  path: ['toCurrency'],
});
export type ExchangeFormData = z.infer<typeof exchangeSchema>;

// --- Primaoci placanja ---

export const createRecipientSchema = z.object({
  name: nameSchema,
  accountNumber: accountNumberSchema,
});
export type CreateRecipientFormData = z.infer<typeof createRecipientSchema>;

export const editRecipientSchema = z.object({
  name: nameSchema,
  accountNumber: accountNumberSchema,
});
export type EditRecipientFormData = z.infer<typeof editRecipientSchema>;

// --- Kartice ---

export const newCardSchema = z.object({
  accountNumber: accountNumberSchema,
  cardType: z.enum(['VISA', 'MASTERCARD', 'DINACARD', 'AMERICAN_EXPRESS'], {
    message: 'Izaberite tip kartice',
  }),
  authorizedPersonId: z.number().optional(), // Za poslovni racun
});
export type NewCardFormData = z.infer<typeof newCardSchema>;

export const cardLimitSchema = z.object({
  limit: z.number({ message: 'Limit mora biti broj' }).min(0, 'Limit ne moze biti negativan'),
});
export type CardLimitFormData = z.infer<typeof cardLimitSchema>;

// --- Promena limita racuna ---

export const accountLimitSchema = z.object({
  dailyLimit: z.number({ message: 'Limit mora biti broj' }).min(0, 'Limit ne moze biti negativan').optional(),
  monthlyLimit: z.number({ message: 'Limit mora biti broj' }).min(0, 'Limit ne moze biti negativan').optional(),
});
export type AccountLimitFormData = z.infer<typeof accountLimitSchema>;

// --- Promena naziva racuna ---

export const accountRenameSchema = z.object({
  name: z.string().min(1, 'Naziv racuna je obavezan').max(100, 'Maksimalno 100 karaktera'),
});
export type AccountRenameFormData = z.infer<typeof accountRenameSchema>;

// --- Zahtev za kredit ---

// Dozvoljeni periodi otplate po tipu kredita (iz specifikacije)
export const REPAYMENT_PERIODS = {
  GOTOVINSKI: [12, 24, 36, 48, 60, 72, 84],
  STAMBENI: [60, 120, 180, 240, 300, 360],
  AUTO: [12, 24, 36, 48, 60, 72, 84],
  STUDENTSKI: [12, 24, 36, 48, 60],
  REFINANSIRAJUCI: [12, 24, 36, 48, 60, 72, 84],
} as const;

export const loanApplicationSchema = z.object({
  loanType: z.enum(['GOTOVINSKI', 'STAMBENI', 'AUTO', 'STUDENTSKI', 'REFINANSIRAJUCI'], {
    message: 'Izaberite tip kredita',
  }),
  interestRateType: z.enum(['FIKSNI', 'VARIJABILNI'], {
    message: 'Izaberite tip kamatne stope',
  }),
  amount: positiveAmountSchema,
  currency: z.string().min(1, 'Izaberite valutu'),
  loanPurpose: z.string().min(1, 'Svrha kredita je obavezna').max(500, 'Maksimalno 500 karaktera'),
  repaymentPeriod: z
    .number({ message: 'Period otplate mora biti broj' })
    .int('Period mora biti ceo broj')
    .min(1, 'Minimalno 1 mesec')
    .max(360, 'Maksimalno 360 meseci'),
  accountNumber: accountNumberSchema,
  phoneNumber: phoneSchema,
  employmentStatus: z.string().optional(),
  monthlyIncome: z.number().positive().optional(),
  permanentEmployment: z.boolean().optional(),
  employmentPeriod: z.number().int().min(0).optional(),
});
export type LoanApplicationFormData = z.infer<typeof loanApplicationSchema>;

// --- Kreiranje racuna (employee) ---

const personalSubtypes = ['STANDARDNI', 'STEDNI', 'PENZIONERSKI', 'ZA_MLADE', 'STUDENTSKI', 'ZA_NEZAPOSLENE'];
const businessSubtypes = ['DOO', 'AD', 'FONDACIJA'];
const foreignCurrencies = ['EUR', 'CHF', 'USD', 'GBP', 'JPY', 'CAD', 'AUD'];

export const createAccountSchema = z
  .object({
    ownerEmail: emailSchema,
    accountType: z.enum(['TEKUCI', 'DEVIZNI', 'POSLOVNI'], { message: 'Izaberite tip racuna' }),
    accountSubtype: z.string().min(1, 'Izaberite podvrstu racuna'),
    currency: z.string().min(1, 'Izaberite valutu'),
    initialDeposit: z.number().min(0, 'Depozit ne moze biti negativan').max(999999999999.99, 'Depozit prelazi maksimalnu dozvoljenu vrednost').optional(),
    createCard: z.boolean().optional(),
    // Polja za poslovni racun - firma
    companyName: z.string().optional(),
    registrationNumber: z.string().optional(),
    taxId: z.string().optional(),
    activityCode: z
      .string()
      .regex(/^\d{2}\.\d{2}$/, 'Format mora biti xx.xx (npr. 62.01)')
      .optional()
      .or(z.literal('')),
    firmAddress: z.string().optional(),
    firmCity: z.string().optional(),
    firmCountry: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accountType === 'TEKUCI') {
      if (!personalSubtypes.includes(data.accountSubtype)) {
        ctx.addIssue({ code: 'custom', path: ['accountSubtype'], message: 'Neispravna podvrsta za tekuci racun' });
      }
      if (data.currency !== 'RSD') {
        ctx.addIssue({ code: 'custom', path: ['currency'], message: 'Tekuci racun moze biti samo u RSD valuti' });
      }
    }

    if (data.accountType === 'DEVIZNI') {
      if (!personalSubtypes.includes(data.accountSubtype)) {
        ctx.addIssue({ code: 'custom', path: ['accountSubtype'], message: 'Neispravna podvrsta za devizni racun' });
      }
      if (!foreignCurrencies.includes(data.currency)) {
        ctx.addIssue({ code: 'custom', path: ['currency'], message: 'Devizni racun podrzava samo strane valute' });
      }
    }

    if (data.accountType === 'POSLOVNI') {
      if (!businessSubtypes.includes(data.accountSubtype)) {
        ctx.addIssue({ code: 'custom', path: ['accountSubtype'], message: 'Neispravna podvrsta za poslovni racun' });
      }
      if (!data.companyName?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['companyName'], message: 'Naziv firme je obavezan' });
      }
      if (!data.registrationNumber?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['registrationNumber'], message: 'Maticni broj je obavezan' });
      }
      if (!data.taxId?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['taxId'], message: 'PIB je obavezan' });
      }
      if (!data.activityCode?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['activityCode'], message: 'Sifra delatnosti je obavezna' });
      }
      if (!data.firmAddress?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['firmAddress'], message: 'Adresa firme je obavezna' });
      }
      if (!data.firmCity?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['firmCity'], message: 'Grad firme je obavezan' });
      }
      if (!data.firmCountry?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['firmCountry'], message: 'Drzava firme je obavezna' });
      }
    }
  });
export type CreateAccountFormData = z.infer<typeof createAccountSchema>;

// --- Izmena klijenta (employee portal) ---

export const editClientSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phoneNumber: phoneSchema,
  address: z.string().min(1, 'Adresa je obavezna'),
  dateOfBirth: z.string().min(1, 'Datum rodjenja je obavezan'),
  gender: z.string().min(1, 'Pol je obavezan'),
});
export type EditClientFormData = z.infer<typeof editClientSchema>;

// --- Verifikacija transakcije ---

export const verificationSchema = z.object({
  code: z
    .string()
    .min(1, 'Verifikacioni kod je obavezan')
    .regex(/^\d{6}$/, 'Kod mora biti tačno 6 cifara'),
});
export type VerificationFormData = z.infer<typeof verificationSchema>;

// --- Filter seme ---

export const transactionFilterSchema = z.object({
  accountNumber: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  amountMin: z.number().optional(),
  amountMax: z.number().optional(),
});
export type TransactionFilterFormData = z.infer<typeof transactionFilterSchema>;


