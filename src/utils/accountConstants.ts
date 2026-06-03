/**
 * R1-837: podrazumevani dnevni/mesecni limiti za samostalno otvaranje LICNOG
 * racuna od strane klijenta. Ranije su bili hardkodirani kao magic-brojevi na
 * vise mesta (AccountListPage, Employee/CreateAccountPage). Jedan izvor istine.
 *
 * NB: ovo su FE default-i koji se salju u zahtevu; BE i dalje ostaje
 * autoritativan za prihvat/odbacivanje limita.
 */
export const DEFAULT_DAILY_LIMIT = 250000;
export const DEFAULT_MONTHLY_LIMIT = 1000000;

/**
 * R1-837: granice slajdera za iznos kredita (LoanApplicationPage). Ranije
 * hardkodirane direktno u `min`/`max`/`step` atributima i u labelama ispod
 * slajdera.
 */
export const LOAN_AMOUNT_MIN = 10000;
export const LOAN_AMOUNT_MAX = 50000000;
export const LOAN_AMOUNT_STEP = 10000;
