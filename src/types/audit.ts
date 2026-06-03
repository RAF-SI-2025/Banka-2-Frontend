// ============================================================
// FE3 — Audit log tipovi (Developer: Elena Kalajdzic / Jovan)
//
// Tipovi za audit-log portal — sve sto koriste AuditLogPage i auditService.
// Spec: Zadaci_Frontend.pdf, FE3.
// Konvencija: pratiti `savings` feature celinu kao sablon.
// ============================================================

/**
 * Diskretne vrednosti tipova akcija koje BE belezi u revizioni dnevnik.
 * Lista je UNIJA `AuditActionType` enum-a oba servisa:
 *   - banka-core (`rs.raf.banka2_bek.audit.model.AuditActionType`)
 *   - trading-service (`rs.raf.trading.audit.model.AuditActionType`)
 * Sluzi za render row-badge labela bez obzira odakle zapis stigne. Za FILTER
 * dropdown koristi `TRADING_AUDIT_ACTION_TYPES` (samo dostizni tipovi) — vidi
 * napomenu uz taj const. Drzati u sinhronu sa BE enumima.
 */
export type AuditActionType =
  // Zajednicki (aktuari / orderi / tax / permisije)
  | 'LIMIT_CHANGED'
  | 'USED_LIMIT_RESET'
  | 'ORDER_APPROVED'
  | 'ORDER_DECLINED'
  | 'PERMISSIONS_CHANGED'
  | 'TAX_RUN_TRIGGERED'
  // banka-core — krediti
  | 'LOAN_APPROVED'
  | 'LOAN_REJECTED'
  | 'LOAN_EARLY_REPAYMENT'
  | 'LOAN_INSTALLMENT_PAID'
  | 'LOAN_INSTALLMENT_FAILED'
  // banka-core — placanja
  | 'PAYMENT_CREATED'
  | 'PAYMENT_ABORTED'
  | 'PAYMENT_QUICK_APPROVED'
  // banka-core — transferi
  | 'TRANSFER_INTERNAL'
  | 'TRANSFER_FX'
  // banka-core — stednja
  | 'SAVINGS_OPENED'
  | 'SAVINGS_WITHDRAWN_EARLY'
  | 'SAVINGS_AUTO_RENEWED'
  // banka-core — kartice
  | 'CARD_BLOCKED'
  | 'CARD_UNBLOCKED'
  | 'CARD_LIMIT_CHANGED'
  | 'CARD_DEACTIVATED'
  // banka-core — racuni
  | 'ACCOUNT_STATUS_CHANGED'
  | 'ACCOUNT_LIMITS_CHANGED'
  // banka-core — zaposleni
  | 'EMPLOYEE_DEACTIVATED'
  // trading — fondovi
  | 'FUND_CREATED'
  | 'FUND_INVEST'
  | 'FUND_WITHDRAW'
  // trading — bulk cron reset aktuarskih limita
  | 'USED_LIMIT_RESET_ALL';

/**
 * Srpske labele tipova akcija (za prikaz u UI).
 */
export const AUDIT_ACTION_LABEL_SR: Record<AuditActionType, string> = {
  LIMIT_CHANGED: 'Promena limita',
  USED_LIMIT_RESET: 'Reset iskoriscenog limita',
  ORDER_APPROVED: 'Order odobren',
  ORDER_DECLINED: 'Order odbijen',
  PERMISSIONS_CHANGED: 'Izmena permisija',
  TAX_RUN_TRIGGERED: 'Pokrenut poreski obracun',
  LOAN_APPROVED: 'Kredit odobren',
  LOAN_REJECTED: 'Kredit odbijen',
  LOAN_EARLY_REPAYMENT: 'Prevremena otplata kredita',
  LOAN_INSTALLMENT_PAID: 'Rata kredita naplacena',
  LOAN_INSTALLMENT_FAILED: 'Naplata rate neuspela',
  PAYMENT_CREATED: 'Placanje kreirano',
  PAYMENT_ABORTED: 'Placanje prekinuto',
  PAYMENT_QUICK_APPROVED: 'Placanje brzo odobreno',
  TRANSFER_INTERNAL: 'Interni transfer',
  TRANSFER_FX: 'Devizni transfer',
  SAVINGS_OPENED: 'Orocena stednja otvorena',
  SAVINGS_WITHDRAWN_EARLY: 'Prevremeno razorocenje',
  SAVINGS_AUTO_RENEWED: 'Automatska obnova stednje',
  CARD_BLOCKED: 'Kartica blokirana',
  CARD_UNBLOCKED: 'Kartica odblokirana',
  CARD_LIMIT_CHANGED: 'Promena limita kartice',
  CARD_DEACTIVATED: 'Kartica deaktivirana',
  ACCOUNT_STATUS_CHANGED: 'Promena statusa racuna',
  ACCOUNT_LIMITS_CHANGED: 'Promena limita racuna',
  EMPLOYEE_DEACTIVATED: 'Zaposleni deaktiviran',
  FUND_CREATED: 'Fond kreiran',
  FUND_INVEST: 'Uplata u fond',
  FUND_WITHDRAW: 'Povlacenje iz fonda',
  USED_LIMIT_RESET_ALL: 'Reset svih limita (cron)',
};

/**
 * Lista svih AuditActionType vrednosti (cela unija oba servisa). Koristi se za
 * row-badge rendering — zapis moze stici sa bilo kog audit izvora.
 * Izvedeno iz labela tako da nikad ne ostane van sinhrona sa unijom tipova.
 */
export const AUDIT_ACTION_TYPES: AuditActionType[] = Object.keys(
  AUDIT_ACTION_LABEL_SR
) as AuditActionType[];

/**
 * Tipovi DOSTIZNI preko FE audit upita.
 *
 * Gateway rutira `GET /audit` -> trading-service `AuditLogController`, koji radi
 * `AuditActionType.valueOf(actionType)` nad SVOJIM enum-om (samo 10 vrednosti).
 * Bilo koji banka-core-only tip (LOAN_x/PAYMENT_x/CARD_x/...) baca
 * `IllegalArgumentException` -> 400 "Unknown actionType". Zato filter dropdown
 * sme da nudi SAMO ove tipove — inace bi izbor garantovano vratio 400.
 *
 * Mirror: `rs.raf.trading.audit.model.AuditActionType` (10 vrednosti).
 */
export const TRADING_AUDIT_ACTION_TYPES: AuditActionType[] = [
  'LIMIT_CHANGED',
  'USED_LIMIT_RESET',
  'USED_LIMIT_RESET_ALL',
  'ORDER_APPROVED',
  'ORDER_DECLINED',
  'PERMISSIONS_CHANGED',
  'TAX_RUN_TRIGGERED',
  'FUND_CREATED',
  'FUND_INVEST',
  'FUND_WITHDRAW',
];

/**
 * Audit log zapis sa svih BE polja.
 *
 * `metadata` moze biti slobodan JSON objekat ili string (BE moze cuvati
 * razlicite tipove vrednosti — primer: stara/nova limita, lista permisija,
 * razlog odbijanja order-a).
 */
export interface AuditLogDto {
  id: number;
  actionType: AuditActionType;
  actorId: number;
  actorEmail?: string | null;
  actorName?: string | null;
  targetType?: string | null;
  targetId?: number | string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: string | Record<string, unknown> | null;
  createdAt: string; // ISO 8601
}

/**
 * Filteri za audit-log upite. Sva polja su opciona; servis salje samo
 * non-undefined vrednosti BE-u i mapira ih na BE @RequestParam imena
 * (vidi `auditService.buildParams`):
 *   actionType -> actionType
 *   dateFrom   -> from  (konvertuje se u ISO LocalDateTime)
 *   dateTo     -> to    (konvertuje se u ISO LocalDateTime)
 *   page/size  -> page/size
 *
 * AKTER (Sc44/Sc45): dva nacina filtriranja po akteru:
 *   - `actorId` (Long): numericki ID aktera (precizan, postojeci put).
 *   - `actorName` (String): IME aktera (Sc45 "unese ime supervizora u filter").
 *     trading-service razresi ime → actorId-eve preko banka-core i filtrira po njima.
 * Ako su oba prisutna, BE daje prednost numerickom `actorId`.
 */
export interface AuditFilterParams {
  actionType?: AuditActionType;
  /** BE /audit filtrira aktera po numerickom ID-ju (actorId). */
  actorId?: number;
  /** Sc45: BE razresava ime aktera (supervizora) → actorId-eve i filtrira po njima. */
  actorName?: string;
  dateFrom?: string; // ISO date YYYY-MM-DD
  dateTo?: string;
  page?: number; // 0-based
  size?: number;
}

/**
 * Paginirani odgovor — paritet sa `savings.PageDto<T>` (Spring Page format).
 */
export interface AuditPageDto<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // trenutna strana (0-based)
  size: number;
}
