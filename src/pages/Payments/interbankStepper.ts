// Cista logika za inter-bank 2PC stepper (Spec Celina 5 (Nova) §75-90).
// Izdvojeno iz NewPaymentPage.tsx da bi (a) bilo direktno unit-testabilno bez
// renderovanja cele stranice i (b) izbegao react-refresh/only-export-components
// warning kad bi se cista funkcija eksportovala iz komponente.

// Spec Celina 5 (Nova) 2PC flow — 4 faze koje user vidi u stepper-u:
//   1. Inicijalizacija (INITIATED)
//   2. Prepare (PREPARING / PREPARED) — Banka A salje, Banka B priprema
//   3. Commit (COMMITTING) — sredstva idu sa A na B
//   4. Zavrseno (COMMITTED)
//
// Terminal statusi ABORTED i STUCK markiraju gde je flow stao + prikazuju
// failureReason ako BE pruzi.
export const INTERBANK_STEPS = [
  { key: 'INITIATED', label: 'Inicijalizacija', description: 'Transakcija pokrenuta' },
  { key: 'PREPARED', label: 'Prepare', description: 'Banka primaoca proverava racun' },
  { key: 'COMMITTING', label: 'Commit', description: 'Prenos sredstava' },
  { key: 'COMMITTED', label: 'Zavrseno', description: 'Sredstva preneta primaocu' },
] as const;

export type InterbankStepState = 'pending' | 'active' | 'done' | 'failed';

/** Faze koje su STVARNO zavrsene izvodimo iz BE timestamp-ova (preparedAt /
 *  committedAt), ne iz terminal statusa. Bez ovih signala fallback je samo
 *  status (npr. test fixture bez timestamp-ova). */
export interface InterbankStepProgress {
  preparedAt?: string | null;
  committedAt?: string | null;
}

export function getInterbankStepState(
  stepKey: string,
  status: string,
  progress: InterbankStepProgress = {}
): InterbankStepState {
  // Mapa: koji step-index ce biti "active" za svaki status
  const stepIndex: Record<string, number> = {
    INITIATED: 0,
    PREPARING: 1,
    PREPARED: 1,
    COMMITTING: 2,
    ABORTING: 2,
    COMMITTED: 3,
    ABORTED: -1, // failed at last active step
    STUCK: -1,
  };
  const targetKeys: readonly string[] = INTERBANK_STEPS.map((s) => s.key);
  const stepKeyIndex = targetKeys.indexOf(stepKey);
  const activeIndex = stepIndex[status] ?? 0;

  if (status === 'COMMITTED') {
    return 'done'; // svi koraci zavrseni
  }

  if (status === 'ABORTED' || status === 'STUCK') {
    // R3-1624: NE bojimo korake u "done" (zeleno) samo zato sto je flow terminalan.
    // Korak je zavrsen iskljucivo ako ga BE potvrdi timestamp-om: INITIATED je
    // implicitno zavrsen (transakcija je kreirana), PREPARED tek ako postoji
    // preparedAt, COMMITTED tek ako postoji committedAt. Prvi NEzavrseni korak na
    // putanji je "failed" marker (gde je 2PC stao), ostali ostaju "pending".
    const prepareDone = !!progress.preparedAt;
    const commitDone = !!progress.committedAt; // ne bi smelo biti set kod ABORTED/STUCK

    const stepDone: boolean[] = [
      true, // INITIATED — transakcija je svakako kreirana
      prepareDone, // PREPARED — samo ako je Banka B potvrdila prepare
      commitDone, // COMMITTING — samo ako je commit zaista presao
      false, // COMMITTED — nikad kod ABORTED/STUCK
    ];

    if (stepDone[stepKeyIndex]) return 'done';
    // Prvi korak koji NIJE zavrsen je mesto gde je flow stao → "failed".
    const firstUndone = stepDone.indexOf(false);
    if (stepKeyIndex === firstUndone) return 'failed';
    return 'pending';
  }

  if (stepKeyIndex < activeIndex) return 'done';
  if (stepKeyIndex === activeIndex) return 'active';
  return 'pending';
}
