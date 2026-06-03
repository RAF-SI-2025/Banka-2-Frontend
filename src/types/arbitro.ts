/**
 * Arbitro asistent — frontend tipovi.
 *
 * Reference: Info o predmetu/LLM_Asistent_Plan.txt v3.3 §8.
 */

export type ArbitroMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';

export interface ArbitroMessage {
  /**
   * Stabilan kljuc za React renderer. Za persistovane poruke koristi BE id;
   * za poruke koje se grade lokalno tokom stream-a koristi privremeni
   * `pending-{timestamp}` ID dok BE ne vrati pravi id u 'done' event-u.
   */
  key: string;
  id?: number;
  role: ArbitroMessageRole;
  content: string;
  /** Tool call indikatori prikazani inline u poruci ('🔍 Wikipedia', itd) */
  toolCalls?: ArbitroToolCallIndicator[];
  /** Source attributions ('Izvor: Wikipedia', 'Izvor: Celina 4 spec') */
  sources?: ArbitroSource[];
  /** Status streaming-a — postavlja se na 'streaming' tokom token event-ova */
  status?: 'pending' | 'streaming' | 'done' | 'error';
  /** Greska ako status='error' */
  errorMessage?: string;
  createdAt?: string;
}

export interface ArbitroToolCallIndicator {
  name: string;
  args?: unknown;
  ok?: boolean;
  summary?: string;
}

export interface ArbitroSource {
  type: 'wikipedia' | 'spec' | 'internal';
  title: string;
  url?: string;
}

export type ArbitroStreamingPhase = 'idle' | 'thinking' | 'tool' | 'writing';

export interface ArbitroPageContext {
  route: string;
  pageName: string;
  uiSummary?: string;
  lastActions: string[];
}

export interface ArbitroChatRequest {
  conversationUuid?: string;
  message: string;
  pageContext?: ArbitroPageContext;
  /** Phase 4 v3.5 — agentic mode toggle. Default false (read-only chat). */
  agenticMode?: boolean;
}

/**
 * SSE event tipovi koje BE salje (plan §7 + §17 agentic mode).
 */
export type ArbitroSseEvent =
  | { type: 'thinking_start' }
  | { type: 'thinking_end' }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; ok: boolean; summary: string }
  | { type: 'token'; text: string }
  | { type: 'source'; sourceType: ArbitroSource['type']; title: string; url?: string }
  | { type: 'done'; messageId: number; conversationUuid: string; totalTokens: number; latencyMs: number; reasoningChars: number }
  | { type: 'error'; code: string; message: string }
  | {
      type: 'action_preview';
      actionUuid: string;
      tool: string;
      summary: string;
      parameters: Record<string, unknown>;
      warnings: string[];
      requiresOtp: boolean;
      expiresAt: string;
      /** Phase 5 multi-step plan info */
      planStepIndex?: number;
      planTotalSteps?: number;
      parentActionUuid?: string;
    }
  | {
      type: 'action_executed';
      actionUuid: string;
      tool: string;
      status: 'EXECUTED' | 'FAILED' | string;
      result?: unknown;
      error?: string;
    }
  | { type: 'action_rejected'; actionUuid: string; reason?: string }
  | {
      type: 'agent_choice';
      wizardId: string;
      toolName: string;
      title: string;
      slotName: string;
      prompt: string;
      slotType: 'CHOICE' | 'TEXT' | 'NUMBER' | 'CONFIRM';
      options: WizardSlotOption[];
      stepIndex: number;
      totalSteps: number;
      previousSelections: WizardPreviousSelection[];
      errorMessage?: string;
    };

/**
 * Phase 4.5 — Wizard slot option (button) emitted in agent_choice event.
 */
export interface WizardSlotOption {
  value: string;
  label: string;
  hint?: string;
}

export interface WizardPreviousSelection {
  slotName: string;
  label: string;
}

/**
 * Phase 4.5 — Active wizard prompt rendered as choice card in chat.
 */
export interface WizardPrompt {
  wizardId: string;
  toolName: string;
  title: string;
  slotName: string;
  prompt: string;
  slotType: 'CHOICE' | 'TEXT' | 'NUMBER' | 'CONFIRM';
  options: WizardSlotOption[];
  stepIndex: number;
  totalSteps: number;
  previousSelections: WizardPreviousSelection[];
  errorMessage?: string;
}

/**
 * Phase 4.5 — Wizard slot-fill REST response.
 */
export interface WizardSlotSelectResponse {
  status: 'AWAITING_NEXT_SLOT' | 'COMPLETED' | 'INVALID' | 'EXPIRED' | 'REJECTED';
  nextSlot?: WizardPrompt;
  actionPreview?: AgentActionPreview;
  errorMessage?: string;
}

/**
 * Phase 4 v3.5 — pending agentic akcija prikazana u confirm modalu.
 */
export interface AgentActionPreview {
  actionUuid: string;
  tool: string;
  summary: string;
  parameters: Record<string, unknown>;
  warnings: string[];
  requiresOtp: boolean;
  expiresAt: string;
  /** Phase 5 multi-step — opciona polja za chain progress indicator. */
  planStepIndex?: number;
  planTotalSteps?: number;
  parentActionUuid?: string;
}

export interface AgentActionResult {
  status: 'EXECUTED' | 'FAILED' | 'REJECTED' | 'EXPIRED' | string;
  result?: unknown;
  error?: string;
  cached?: boolean;
}

export interface ArbitroHealth {
  provider: string;
  model: string;
  llmReachable: boolean;
  wikipediaToolReachable: boolean;
  ragToolReachable: boolean;
  /** Phase 5 — Kokoro TTS sidecar reachability. */
  ttsReachable?: boolean;
}

export interface ArbitroConversation {
  conversationUuid: string;
  title: string | null;
  messageCount: number;
  updatedAt: string;
}
