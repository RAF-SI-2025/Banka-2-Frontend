import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { auditService } from './auditService';
import api from './api';

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const emptyPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  number: 0,
  size: 20,
};

describe('auditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({ data: emptyPage });
  });

  it('queryAuditLogs() GETs /audit bez params kad filter prazan', async () => {
    await auditService.queryAuditLogs({});

    expect(mockApi.get).toHaveBeenCalledWith('/audit', { params: {} });
  });

  it('queryAuditLogs() mapira FE filtere na BE @RequestParam imena (actionType, from, to, page, size)', async () => {
    await auditService.queryAuditLogs({
      actionType: 'ORDER_APPROVED',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
      page: 2,
      size: 50,
    });

    expect(mockApi.get).toHaveBeenCalledWith('/audit', {
      params: {
        actionType: 'ORDER_APPROVED',
        // dateFrom/dateTo -> from/to, konvertovano u ISO LocalDateTime
        // (BE radi LocalDateTime.parse -> goli datum bi bacio 400).
        from: '2026-01-01T00:00:00',
        to: '2026-12-31T23:59:59',
        page: 2,
        size: 50,
      },
    });
  });

  it('queryAuditLogs() prosledjuje actorId BE-u (R1 569 — bio tihi no-op preko emaila)', async () => {
    await auditService.queryAuditLogs({
      actionType: 'LIMIT_CHANGED',
      actorId: 42,
      page: 0,
    });

    expect(mockApi.get).toHaveBeenCalledWith('/audit', {
      params: {
        actionType: 'LIMIT_CHANGED',
        actorId: 42,
        page: 0,
      },
    });
    const callArgs = mockApi.get.mock.calls[0]?.[1] as { params: Record<string, unknown> };
    expect(callArgs.params).toHaveProperty('actorId', 42);
    // Email filter vise ne postoji (BE nikad nije imao email filter).
    expect(callArgs.params).not.toHaveProperty('actorEmail');
  });

  it('queryAuditLogs() prosledjuje actorName BE-u (Sc45 — filter po imenu supervizora)', async () => {
    await auditService.queryAuditLogs({
      actorName: 'Nikola Milenkovic',
      page: 0,
    });

    expect(mockApi.get).toHaveBeenCalledWith('/audit', {
      params: {
        actorName: 'Nikola Milenkovic',
        page: 0,
      },
    });
  });

  it('queryAuditLogs() ne salje prazan actorName', async () => {
    await auditService.queryAuditLogs({ actorName: '' });

    expect(mockApi.get).toHaveBeenCalledWith('/audit', { params: {} });
  });

  it('queryAuditLogs() ne salje undefined polja', async () => {
    await auditService.queryAuditLogs({
      actionType: 'LIMIT_CHANGED',
      page: 0,
    });

    expect(mockApi.get).toHaveBeenCalledWith('/audit', {
      params: {
        actionType: 'LIMIT_CHANGED',
        page: 0,
      },
    });
    const callArgs = mockApi.get.mock.calls[0]?.[1] as { params: Record<string, unknown> };
    expect(callArgs.params).not.toHaveProperty('from');
    expect(callArgs.params).not.toHaveProperty('to');
    expect(callArgs.params).not.toHaveProperty('size');
  });

  it('queryAuditLogs() ne salje prazne string filter vrednosti', async () => {
    await auditService.queryAuditLogs({
      dateFrom: '',
      dateTo: '',
    });

    expect(mockApi.get).toHaveBeenCalledWith('/audit', { params: {} });
  });

  it('queryAuditLogs() ne konvertuje vec-pun ISO datetime ponovo', async () => {
    await auditService.queryAuditLogs({
      dateFrom: '2026-01-01T08:15:00',
      dateTo: '2026-01-02T18:45:30',
    });

    expect(mockApi.get).toHaveBeenCalledWith('/audit', {
      params: {
        from: '2026-01-01T08:15:00',
        to: '2026-01-02T18:45:30',
      },
    });
  });

  it('queryAuditLogs() default poziv bez argumenata salje prazne params', async () => {
    await auditService.queryAuditLogs();

    expect(mockApi.get).toHaveBeenCalledWith('/audit', { params: {} });
  });

  it('queryAuditLogs() vraca data property iz axios response-a', async () => {
    const fakePage = {
      content: [
        {
          id: 1,
          actionType: 'ORDER_APPROVED',
          actorId: 42,
          actorEmail: 'marko@banka.rs',
          actorName: 'Marko Petrovic',
          targetType: 'Order',
          targetId: 100,
          oldValue: null,
          newValue: 'APPROVED',
          metadata: null,
          createdAt: '2026-05-25T10:30:00Z',
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    };
    mockApi.get.mockResolvedValueOnce({ data: fakePage });

    const result = await auditService.queryAuditLogs({});

    expect(result).toEqual(fakePage);
    expect(result.content).toHaveLength(1);
  });

  it('queryAuditLogs() propagira gresku iz api.get', async () => {
    const err = new Error('Network down');
    mockApi.get.mockRejectedValueOnce(err);

    await expect(auditService.queryAuditLogs({})).rejects.toThrow('Network down');
  });
});
