/**
 * Arbitro SSE klijent.
 *
 * Koristi nativni `fetch` + `ReadableStream` (NE EventSource — EventSource ne
 * podrzava custom headers kao Authorization). Parsira SSE format
 * `event: <name>\ndata: <json>\n\n` linijski iz stream body-ja.
 *
 * Reference: Info o predmetu/LLM_Asistent_Plan.txt v3.3 §8.
 */

import type {
  AgentActionResult,
  ArbitroChatRequest,
  ArbitroConversation,
  ArbitroHealth,
  ArbitroMessage,
  ArbitroSseEvent,
  WizardSlotSelectResponse,
} from '../types/arbitro';
import { getApiUrl } from '../config/runtime';

// Runtime config: cita window._env_.API_URL pri svakom pozivu (lazy).
// Wrapper funkcija da bi svaki fetch dobio svezu vrednost u k8s deploy-u.
function getApiBase(): string {
  return getApiUrl();
}

interface PersistedMessageDto {
  id: number;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  pageRoute?: string;
  pageName?: string;
  createdAt?: string;
}

function getAccessToken(): string | null {
  return (
    sessionStorage.getItem('accessToken') ||
    localStorage.getItem('accessToken') ||
    null
  );
}

/** Vrati `Authorization: Bearer ...` header object ako token postoji, inace prazan. */
function authHeader(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Otvara SSE konekciju ka /assistant/chat. Vraca AbortController da pozivac
 * moze otkazati stream (npr. 'Stop generating' dugme).
 */
/**
 * Cita SSE frame-ove iz response.body, parsuje ih i predaje svakog
 * preko `onEvent`. Posle 'done' event-a, BE zatvara stream sto na nekim
 * platformama (Tomcat SseEmitter, nginx proxy) izaziva read failure —
 * vraca {chatDone:true} pre nego sto se baci.
 *
 * Resolves normally na kraju stream-a; reject samo ako je read greska
 * legitimna (PRE 'done' event-a). Caller je duzan da prosledi
 * `controller.signal.aborted` da bi razlikovao otkaz od greske.
 */
async function consumeSseStream(
  response: Response,
  contextLabel: string,
  onEvent: (event: ArbitroSseEvent) => void,
): Promise<{ chatDone: boolean }> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${contextLabel} HTTP ${response.status}: ${text || response.statusText}`);
  }
  if (!response.body) {
    throw new Error(`${contextLabel}: prazan response body`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let chatDone = false;

  const parseAndEmit = (frame: string) => {
    parseFrame(frame, (eventName, data) => {
      const parsed = parseSseEvent(eventName, data);
      if (parsed) {
        if (parsed.type === 'done') chatDone = true;
        onEvent(parsed);
      }
    });
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (;;) {
        const frameEnd = buffer.indexOf('\n\n');
        if (frameEnd === -1) break;
        const frame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd + 2);
        parseAndEmit(frame);
      }
    }
  } catch (readErr) {
    // Pre nego sto reportujemo gresku, pokusaj parsanje preostalog buffer-a —
    // moze biti da je sidecar/BE poslao finalni `event:done` ali server-side
    // chunked encoding terminator je izgubljen (ERR_INCOMPLETE_CHUNKED_ENCODING
    // u browseru). Bez ovog, status bi ostao 'streaming' i UI bi pokazao
    // plain text umesto markdown render-a.
    if (buffer.trim().length > 0) {
      parseAndEmit(buffer.trim());
      buffer = '';
    }
    if (!chatDone) throw readErr;
  }

  // Normalan stream end: server ucinio TCP FIN, ali poslednji event je mozda
  // bez trailing `\n\n` separator-a (Spring SseEmitter.complete() ne forsira
  // separator pre close-a). Parsiramo bilo sta sto je ostalo u buffer-u.
  if (buffer.trim().length > 0) {
    parseAndEmit(buffer.trim());
  }

  return { chatDone };
}

export function streamChat(
  request: ArbitroChatRequest,
  onEvent: (event: ArbitroSseEvent) => void,
  onError: (error: Error) => void,
  onComplete: () => void,
): AbortController {
  const controller = new AbortController();
  let chatDone = false;

  fetch(`${getApiBase()}/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...authHeader(),
    },
    body: JSON.stringify(request),
    signal: controller.signal,
  })
    .then(async (response) => {
      const result = await consumeSseStream(response, 'Arbitro chat', onEvent);
      chatDone = result.chatDone;
      onComplete();
    })
    .catch((err) => {
      if (controller.signal.aborted || chatDone) {
        onComplete();
        return;
      }
      onError(err instanceof Error ? err : new Error(String(err)));
    });

  return controller;
}

function parseFrame(frame: string, emit: (eventName: string, data: string) => void): void {
  const lines = frame.split(/\r?\n/);
  let eventName: string | null = null;
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (eventName != null && dataLines.length > 0) {
    emit(eventName, dataLines.join('\n'));
  }
}

function parseSseEvent(eventName: string, data: string): ArbitroSseEvent | null {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }
  switch (eventName) {
    case 'thinking_start':
      return { type: 'thinking_start' };
    case 'thinking_end':
      return { type: 'thinking_end' };
    case 'tool_call':
      return {
        type: 'tool_call',
        name: String(payload.name ?? ''),
        args: payload.args ?? {},
      };
    case 'tool_result':
      return {
        type: 'tool_result',
        name: String(payload.name ?? ''),
        ok: Boolean(payload.ok),
        summary: String(payload.summary ?? ''),
      };
    case 'token':
      return { type: 'token', text: String(payload.text ?? '') };
    case 'source':
      return {
        type: 'source',
        sourceType: (payload.type as 'wikipedia' | 'spec' | 'internal') ?? 'internal',
        title: String(payload.title ?? ''),
        url: typeof payload.url === 'string' ? payload.url : undefined,
      };
    case 'done':
      return {
        type: 'done',
        messageId: Number(payload.messageId ?? -1),
        conversationUuid: String(payload.conversationUuid ?? ''),
        totalTokens: Number(payload.totalTokens ?? 0),
        latencyMs: Number(payload.latencyMs ?? 0),
        reasoningChars: Number(payload.reasoningChars ?? 0),
      };
    case 'error':
      return {
        type: 'error',
        code: String(payload.code ?? 'unknown'),
        message: String(payload.message ?? ''),
      };
    case 'action_preview':
      return {
        type: 'action_preview',
        actionUuid: String(payload.actionUuid ?? ''),
        tool: String(payload.tool ?? ''),
        summary: String(payload.summary ?? ''),
        parameters:
          (payload.parameters as Record<string, unknown> | undefined) ?? {},
        warnings: Array.isArray(payload.warnings)
          ? (payload.warnings as string[])
          : [],
        requiresOtp: Boolean(payload.requiresOtp),
        expiresAt: String(payload.expiresAt ?? ''),
        planStepIndex: typeof payload.planStepIndex === 'number' ? payload.planStepIndex : undefined,
        planTotalSteps: typeof payload.planTotalSteps === 'number' ? payload.planTotalSteps : undefined,
        parentActionUuid: typeof payload.parentActionUuid === 'string' ? payload.parentActionUuid : undefined,
      };
    case 'action_executed':
      return {
        type: 'action_executed',
        actionUuid: String(payload.actionUuid ?? ''),
        tool: String(payload.tool ?? ''),
        status: String(payload.status ?? ''),
        result: payload.result,
        error: typeof payload.error === 'string' ? payload.error : undefined,
      };
    case 'action_rejected':
      return {
        type: 'action_rejected',
        actionUuid: String(payload.actionUuid ?? ''),
        reason: typeof payload.reason === 'string' ? payload.reason : undefined,
      };
    case 'agent_choice':
      return {
        type: 'agent_choice',
        wizardId: String(payload.wizardId ?? ''),
        toolName: String(payload.toolName ?? ''),
        title: String(payload.title ?? ''),
        slotName: String(payload.slotName ?? ''),
        prompt: String(payload.prompt ?? ''),
        slotType: (payload.type as 'CHOICE' | 'TEXT' | 'NUMBER' | 'CONFIRM') ?? 'CHOICE',
        options: Array.isArray(payload.options)
          ? (payload.options as Array<{ value: string; label: string; hint?: string }>)
          : [],
        stepIndex: Number(payload.stepIndex ?? 1),
        totalSteps: Number(payload.totalSteps ?? 1),
        previousSelections: Array.isArray(payload.previousSelections)
          ? (payload.previousSelections as Array<{ slotName: string; label: string }>)
          : [],
        errorMessage: typeof payload.errorMessage === 'string' ? payload.errorMessage : undefined,
      };
    default:
      return null;
  }
}

/* ============================== REST endpoints ============================== */

async function authedJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeader(),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchHealth(): Promise<ArbitroHealth> {
  return authedJson<ArbitroHealth>('/assistant/health');
}

export function fetchConversations(): Promise<ArbitroConversation[]> {
  return authedJson<ArbitroConversation[]>('/assistant/conversations');
}

export async function fetchMessages(uuid: string): Promise<ArbitroMessage[]> {
  const messages = await authedJson<PersistedMessageDto[]>(
    `/assistant/conversations/${uuid}/messages`
  );
  return messages.map<ArbitroMessage>((m) => ({
    key: `db-${m.id}`,
    id: m.id,
    role: m.role,
    content: m.content,
    status: 'done',
    createdAt: m.createdAt,
  }));
}

export function deleteConversation(uuid: string): Promise<void> {
  return authedJson<void>(`/assistant/conversations/${uuid}`, { method: 'DELETE' });
}

/* ============================== AGENTIC MODE (Phase 4 v3.5) ============================== */

/**
 * Potvrdi pending agentic akciju. Ako akcija zahteva OTP, otpCode mora biti prosleđen.
 * editedParameters je opciono — FE moze poslati samo izmenjena polja iz inline edit-a.
 */
export function confirmAgentAction(
  actionUuid: string,
  options?: { otpCode?: string; editedParameters?: Record<string, unknown> }
): Promise<AgentActionResult> {
  return authedJson<AgentActionResult>(`/assistant/actions/${actionUuid}/confirm`, {
    method: 'POST',
    body: JSON.stringify({
      otpCode: options?.otpCode,
      editedParameters: options?.editedParameters,
    }),
  });
}

export function rejectAgentAction(actionUuid: string): Promise<AgentActionResult> {
  return authedJson<AgentActionResult>(`/assistant/actions/${actionUuid}/reject`, {
    method: 'POST',
  });
}

/* ============================== WIZARD (Phase 4.5) ============================== */

/**
 * Apply user's choice in active wizard. Returns either next slot prompt
 * (AWAITING_NEXT_SLOT) or action preview (COMPLETED).
 */
export function selectWizardSlot(
  wizardId: string,
  slotName: string,
  value: string
): Promise<WizardSlotSelectResponse> {
  return authedJson<WizardSlotSelectResponse>(`/assistant/wizard/${wizardId}/select`, {
    method: 'POST',
    body: JSON.stringify({ slotName, value }),
  });
}

/** Cancel an active wizard session. */
export function cancelWizard(wizardId: string): Promise<void> {
  return authedJson<void>(`/assistant/wizard/${wizardId}/cancel`, { method: 'POST' });
}

/* ============================== Multimodal media (Phase 5) ============================== */

/**
 * Streaming multipart chat — sluzi za upload audio/sliku + tekstualne poruke.
 *
 * Voice INPUT flow: MediaRecorder snimi audio Blob (WebM/Opus) → ovaj
 * helper salje Blob preko `media` multipart polja → BE base64-encoduje i
 * ubacuje u Ollama `messages.images` polje → Gemma 4 native multimodal
 * (ASR za audio, vision za slike) transkribuje + odgovara u istom turn-u.
 *
 * `request.message` moze biti prazan string ako je samo audio.
 */
export function streamChatWithMedia(
  request: ArbitroChatRequest,
  mediaBlob: Blob,
  onEvent: (event: ArbitroSseEvent) => void,
  onError: (error: Error) => void,
  onComplete: () => void
): AbortController {
  const controller = new AbortController();
  let chatDone = false;

  const formData = new FormData();
  formData.append('message', request.message ?? '');
  // Blob mora ici sa filename-om inace neki Spring serveri parsiraju
  // multipart kao plain text polje. WebM/Opus default extension.
  const filename =
    mediaBlob.type.includes('webm') ? 'audio.webm'
      : mediaBlob.type.includes('ogg') ? 'audio.ogg'
        : mediaBlob.type.includes('mp4') ? 'audio.mp4'
          : mediaBlob.type.startsWith('image/') ? `image.${mediaBlob.type.split('/')[1]}`
            : 'media.bin';
  formData.append('media', mediaBlob, filename);
  if (request.conversationUuid) formData.append('conversationUuid', request.conversationUuid);
  if (request.agenticMode !== undefined) formData.append('agenticMode', String(request.agenticMode));
  if (request.pageContext) {
    // Page context kao JSON multipart part — BE moze opciono parsirati
    formData.append('pageContext', JSON.stringify(request.pageContext));
  }

  fetch(`${getApiBase()}/assistant/chat-multipart`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      ...authHeader(),
    },
    body: formData,
    signal: controller.signal,
  })
    .then(async (response) => {
      const result = await consumeSseStream(response, 'Multipart chat', onEvent);
      chatDone = result.chatDone;
      onComplete();
    })
    .catch((err) => {
      if (controller.signal.aborted || chatDone) {
        onComplete();
        return;
      }
      onError(err instanceof Error ? err : new Error(String(err)));
    });

  return controller;
}

/* ============================== TTS (Phase 5) ============================== */

/**
 * POST /assistant/tts — vraca audio/wav blob koji FE moze da prikaze
 * preko <audio> tag-a sa Blob URL-om.
 *
 * Vrati null ako BE nije reachable ili je TTS disabled — caller treba da
 * tretira to kao no-op (ne reproduktuje audio).
 */
export async function fetchTtsAudio(
  text: string,
  voice?: string,
  lang?: string,
  speed?: number
): Promise<Blob | null> {
  try {
    const response = await fetch(`${getApiBase()}/assistant/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/wav',
        ...authHeader(),
      },
      body: JSON.stringify({ text, voice, lang, speed }),
    });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}
