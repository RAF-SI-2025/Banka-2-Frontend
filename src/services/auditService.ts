// ============================================================
// FE3 — Audit log servis (Developer: Elena Kalajdzic / Jovan)
//
// HTTP klijent za audit-log portal, oslanja se na `api` axios instancu.
// Dostupno samo ADMIN + SUPERVISOR rolama (BE vraca 403 inace).
//
// Spec: Zadaci_Frontend.pdf, FE3.
//
// BE kontrakt (gateway rutira /audit -> trading-service AuditLogController,
// @RequestMapping("/audit")):
//   GET /audit?actionType=&actorId=&actorName=&from=&to=&page=&size=
//     - actionType: String (enum naziv)
//     - actorId:    Long  (numericki ID aktera — precizan put)
//     - actorName:  String (Sc45 — IME aktera/supervizora; BE razresi ime ->
//                   actorId-eve preko banka-core i filtrira po njima)
//     - from / to:  String -> LocalDateTime.parse(...) na BE-u, tj. ocekuje
//                   ISO-8601 LOCAL DATE-TIME ("2026-01-01T00:00:00"). Goli
//                   datum ("2026-01-01") baca DateTimeParseException -> 400.
//     - page / size: int
//
// NAPOMENA: gateway /audit -> trading-service (TODO_testovi Sc40/41/43/44/45 su
// trgovinski audit dogadjaji: LIMIT_CHANGED/ORDER_APPROVED/TAX_RUN_TRIGGERED/FUND_*).
// Ovaj servis upituje ISKLJUCIVO /audit (trading-service). Trading
// AuditLogController radi AuditActionType.valueOf(...) nad svojim enum-om, pa bi
// banka-core-only tip (LOAN_*/PAYMENT_*/CARD_*/...) vratio 400 "Unknown
// actionType" — zato FE dropdown nudi samo TRADING_AUDIT_ACTION_TYPES. Bankarski
// audit izvor (/banka-core/audit) nije wired na FE-u (ostaje buducа nadogradnja
// uz source-selector). Akter se filtrira po actorId (ID) ILI actorName (ime).
// ============================================================

import api from './api';
import type {
  AuditFilterParams,
  AuditLogDto,
  AuditPageDto,
} from '../types/audit';

/**
 * Normalizuje FE date-input vrednost u ISO LocalDateTime koji BE
 * `LocalDateTime.parse(...)` prihvata.
 *
 * - Goli datum "YYYY-MM-DD" dobija sufiks vremena (start/kraj dana).
 * - Ako je vec pun ISO datetime, vraca se neizmenjen.
 *
 * @param value FE vrednost (npr. iz <input type="date">), "YYYY-MM-DD".
 * @param boundary 'start' -> 00:00:00, 'end' -> 23:59:59 (inkluzivno do kraja dana).
 */
function toLocalDateTime(value: string, boundary: 'start' | 'end'): string {
  // Vec sadrzi vreme (ima 'T') -> ne diraj.
  if (value.includes('T')) return value;
  // Goli datum -> dodaj granicu dana.
  const time = boundary === 'start' ? '00:00:00' : '23:59:59';
  return `${value}T${time}`;
}

/**
 * Mapira FE filter polja na BE @RequestParam imena, izbacujuci undefined /
 * prazne vrednosti tako da BE ne dobije nerezolvabilne filtere.
 *
 * FE polje  -> BE param
 *   actionType -> actionType
 *   actorId    -> actorId
 *   dateFrom   -> from   (uz konverziju u ISO LocalDateTime, start dana)
 *   dateTo     -> to     (uz konverziju u ISO LocalDateTime, kraj dana)
 *   page       -> page
 *   size       -> size
 */
function buildParams(filter: AuditFilterParams): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (filter.actionType !== undefined) params.actionType = filter.actionType;
  if (filter.actorId !== undefined) params.actorId = filter.actorId;
  // Sc45: ime aktera (supervizora) — BE razresi ime → actorId-eve i filtrira po njima.
  if (filter.actorName !== undefined && filter.actorName !== '') {
    params.actorName = filter.actorName;
  }
  if (filter.dateFrom !== undefined && filter.dateFrom !== '') {
    params.from = toLocalDateTime(filter.dateFrom, 'start');
  }
  if (filter.dateTo !== undefined && filter.dateTo !== '') {
    params.to = toLocalDateTime(filter.dateTo, 'end');
  }
  if (filter.page !== undefined) params.page = filter.page;
  if (filter.size !== undefined) params.size = filter.size;
  return params;
}

export const auditService = {
  /**
   * GET /audit — paginirani upit revizionog dnevnika sa filterima.
   */
  queryAuditLogs: async (
    params: AuditFilterParams = {}
  ): Promise<AuditPageDto<AuditLogDto>> => {
    const { data } = await api.get<AuditPageDto<AuditLogDto>>('/audit', {
      params: buildParams(params),
    });
    return data;
  },
};
