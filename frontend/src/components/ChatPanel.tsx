import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, ReportStatus, sendReport } from '../api';
import type { LatLngPoint } from './NoiseMap';

type Msg = { id: number; from: 'user' | 'bot'; text: string; status?: ReportStatus; tips?: string[] };

const GREETING: Msg = {
  id: 0,
  from: 'bot',
  text: 'Cześć! Opisz hałas, który słyszysz, i wskaż miejsce na mapie. Sprawdzę, czy nie jest to zaplanowane wydarzenie.',
};

const STATUS_BADGE: Record<ReportStatus, { label: string; cls: string }> = {
  incident: { label: 'Do weryfikacji', cls: 'bg-amber-100 text-amber-800' },
  planned: { label: 'Zaplanowane', cls: 'bg-violet-100 text-violet-700' },
  needs_info: { label: 'Potrzebne szczegóły', cls: 'bg-slate-100 text-slate-700' },
};

// --- Mowa: Web Speech API działa w przeglądarce (Chrome, Edge, Safari); w Firefoxie rozpoznawania mowy brak ---
const VOICE_LANG = 'pl-PL';

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function speak(text: string) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel(); // przerywamy poprzednią wypowiedź
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = VOICE_LANG;
  window.speechSynthesis.speak(utterance);
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Wysłano już dużo zgłoszeń. Spróbuj ponownie za godzinę.';
    if (err.status === 400) return 'Zgłoszenie jest nieprawidłowe — opisz hałas (min. 3 znaki) i wskaż miejsce na mapie.';
  }
  return 'Nie udało się wysłać zgłoszenia. Spróbuj ponownie.';
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickMode: boolean;
  onPickModeChange: (pick: boolean) => void;
  reportPoint: LatLngPoint | null;
  onClearPoint: () => void;
};

/** Pływający czat do zgłaszania hałasu — przycisk w lewym górnym rogu mapy, okno rozwija się w dół i w prawo. */
export default function ChatPanel({ open, onOpenChange, pickMode, onPickModeChange, reportPoint, onClearPoint }: Props) {
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const recognitionCtor = useMemo(getRecognitionCtor, []);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const nextId = useRef(1);
  const listEnd = useRef<HTMLDivElement>(null);

  // po każdej nowej wiadomości przewijamy listę na dół
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' });
  }, [messages, open]);

  // przy zamknięciu panelu (odmontowaniu) przerywamy nasłuch i czytanie
  useEffect(
    () => () => {
      recognition.current?.stop();
      if (canSpeak()) window.speechSynthesis.cancel();
    },
    [],
  );

  const push = (msg: Omit<Msg, 'id'>) => setMessages((m) => [...m, { ...msg, id: nextId.current++ }]);

  // Mikrofon: wynik rozpoznawania dopisujemy do pola tekstowego, więc można go jeszcze poprawić przed wysłaniem
  const toggleListening = () => {
    if (!recognitionCtor) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const rec = new recognitionCtor();
    rec.lang = VOICE_LANG;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim();
      if (transcript) setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      push({
        from: 'bot',
        text:
          e.error === 'not-allowed'
            ? 'Brak dostępu do mikrofonu — zezwól na niego w ustawieniach przeglądarki.'
            : 'Nie udało się rozpoznać mowy. Spróbuj ponownie.',
      });
    };
    rec.onend = () => setListening(false);
    recognition.current = rec;
    rec.start();
    setListening(true);
  };

  const canSend = !busy && text.trim().length >= 3 && reportPoint !== null;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend || !reportPoint) return;
    const message = text.trim();
    push({ from: 'user', text: message });
    setText('');
    setBusy(true);
    try {
      const result = await sendReport(message, reportPoint.lat, reportPoint.lng);
      push({ from: 'bot', text: result.reply, status: result.status, tips: result.tips });
      if (speakReplies) speak(result.reply);
      onClearPoint(); // kolejne zgłoszenie wymaga ponownego wskazania miejsca
    } catch (err) {
      push({ from: 'bot', text: errorText(err) });
      setText(message); // nie tracimy treści po błędzie
    } finally {
      setBusy(false);
    }
  };

  // Enter wysyła, Shift+Enter wstawia nowy wiersz
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="absolute left-14 top-3 z-20 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
      >
        {open ? 'Zamknij czat' : 'Zgłoś hałas'}
      </button>

      {pickMode && (
        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow">
          Kliknij na mapie miejsce, w którym słychać hałas
          <button type="button" onClick={() => onPickModeChange(false)} className="rounded border border-white/40 px-2 py-0.5 hover:bg-white/10">
            Anuluj
          </button>
        </div>
      )}

      {/* okno zostaje zamontowane (hidden), żeby rozmowa nie znikała przy zamknięciu / wyborze miejsca */}
      <div
        className={`absolute left-14 top-14 z-20 flex max-h-[calc(100%-4.5rem)] w-[22rem] max-w-[calc(100%-4.5rem)] flex-col rounded-lg bg-white shadow-lg ${
          open && !pickMode ? '' : 'hidden'
        }`}
      >
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {messages.map((m) => (
            <div key={m.id} className={m.from === 'user' ? 'flex justify-end' : 'flex'}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.from === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.status && (
                  <span className={`mb-1 inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[m.status].cls}`}>
                    {STATUS_BADGE[m.status].label}
                  </span>
                )}
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.tips && m.tips.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                    {m.tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="text-xs text-slate-400">Chatbot analizuje zgłoszenie…</div>}
          <div ref={listEnd} />
        </div>

        <form onSubmit={submit} className="space-y-2 border-t p-3">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
            <span className="whitespace-nowrap">
              {reportPoint ? `Miejsce: ${reportPoint.lat.toFixed(5)}, ${reportPoint.lng.toFixed(5)}` : 'Miejsce: nie wybrano'}
            </span>
            <span className="flex gap-2">
              {reportPoint && (
                <button type="button" onClick={onClearPoint} className="whitespace-nowrap text-slate-500 hover:text-slate-800">
                  Usuń
                </button>
              )}
              <button
                type="button"
                onClick={() => onPickModeChange(true)}
                className="whitespace-nowrap rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50"
              >
                {reportPoint ? 'Zmień miejsce' : 'Wskaż na mapie'}
              </button>
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={1000}
            placeholder="Opisz hałas, np. „głośna muzyka z imprezy od 22:00”"
            className="w-full resize-none rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
            {recognitionCtor ? (
              <button
                type="button"
                onClick={toggleListening}
                aria-pressed={listening}
                className={`whitespace-nowrap rounded border px-2 py-1 ${
                  listening ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                {listening ? 'Słucham… (zatrzymaj)' : 'Mów zamiast pisać'}
              </button>
            ) : (
              <span className="whitespace-nowrap text-slate-400">Rozpoznawanie mowy niedostępne</span>
            )}
            {canSpeak() && (
              <label className="flex cursor-pointer items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={speakReplies} onChange={(e) => setSpeakReplies(e.target.checked)} />
                Czytaj odpowiedzi
              </label>
            )}
          </div>
          <button
            type="submit"
            disabled={!canSend}
            className="w-full whitespace-nowrap rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
          </button>
        </form>
      </div>
    </>
  );
}
