'use client';
import { useEffect, useRef, useState } from 'react';
import { IconSearch, IconMic, IconCamera } from '../icons';

interface Cat {
  slug: string;
  label: string;
}
interface Sug {
  slug: string;
  title: string;
}
type Item =
  | { kind: 'cat'; slug: string; label: string }
  | { kind: 'prod'; slug: string; title: string };

/** Labels for the AI voice + image search tools. When omitted, they're hidden. */
export interface SearchTools {
  voice: string;
  image: string;
  listening: string;
  thinking: string;
  unsupported: string;
  error: string;
  unconfigured: string;
}

// Downscale + JPEG-encode a picked image to a small data URL before it's sent,
// so image search stays light on 3G — the same spirit as the listing uploader.
async function compress(file: File, maxDim = 1024, quality = 0.7): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return url;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Search input with an autocomplete dropdown: matching categories (filtered
// from the known list) + live listing-title suggestions from the API. Enter
// with nothing highlighted runs a normal /pesquisa search; arrows + Enter pick a
// suggestion. Works as the header search and the hero search.
export function SearchBox({
  placeholder,
  categories,
  variant = 'header',
  initialQuery = '',
  submitLabel,
  tools,
}: {
  placeholder: string;
  categories: Cat[];
  variant?: 'header' | 'hero';
  initialQuery?: string;
  submitLabel?: string;
  tools?: SearchTools;
}) {
  const [q, setQ] = useState(initialQuery);
  const [sugs, setSugs] = useState<Sug[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [aiState, setAiState] = useState<
    'idle' | 'listening' | 'thinking' | 'unsupported' | 'error' | 'unconfigured'
  >('idle');
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Go to the results page for an AI-derived query (+ category).
  function goSearch(query: string, category?: string) {
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (category) p.set('category', category);
    window.location.href = `/pesquisa?${p.toString()}`;
  }

  // Send speech text or a photo to the AI search endpoint and navigate.
  async function runAiSearch(payload: { text?: string; image?: string }) {
    setAiState('thinking');
    try {
      const res = await fetch('/api/search/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        query?: string;
        category?: string;
        configured?: boolean;
      };
      if (!res.ok) {
        setAiState('error');
        return;
      }
      if (!data.configured) {
        // Voice still works without AI (raw transcript); image needs AI.
        if (payload.text) {
          goSearch(payload.text);
          return;
        }
        setAiState('unconfigured');
        return;
      }
      goSearch(data.query ?? payload.text ?? '', data.category);
    } catch {
      setAiState('error');
    }
  }

  function startVoice() {
    type SR = {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      start: () => void;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
    };
    const w = window as unknown as {
      SpeechRecognition?: new () => SR;
      webkitSpeechRecognition?: new () => SR;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setAiState('unsupported');
      return;
    }
    const rec = new Ctor();
    rec.lang = 'pt-PT';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i]![0]!.transcript;
      text = text.trim();
      setQ(text);
      if (text) void runAiSearch({ text });
    };
    rec.onerror = () => setAiState('idle');
    rec.onend = () => setAiState((s) => (s === 'listening' ? 'idle' : s));
    setAiState('listening');
    rec.start();
  }

  async function onPickImage(file: File | null) {
    if (!file) return;
    const image = await compress(file);
    void runAiSearch({ image });
  }

  const term = q.trim();
  const catMatches: Cat[] =
    term.length >= 2
      ? categories.filter((c) => c.label.toLowerCase().includes(term.toLowerCase())).slice(0, 4)
      : [];
  const items: Item[] = [
    ...catMatches.map((c) => ({ kind: 'cat' as const, slug: c.slug, label: c.label })),
    ...sugs.map((s) => ({ kind: 'prod' as const, slug: s.slug, title: s.title })),
  ];

  useEffect(() => {
    if (term.length < 2) {
      setSugs([]);
      return;
    }
    const ctrl = new AbortController();
    const id = window.setTimeout(() => {
      void fetch(`/api/suggest?q=${encodeURIComponent(term)}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })
        .then((r) => r.json())
        .then((d: Sug[]) => setSugs(Array.isArray(d) ? d : []))
        .catch(() => undefined);
    }, 220);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [term]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function go(item: Item) {
    window.location.href =
      item.kind === 'cat' ? `/categoria/${item.slug}` : `/produto/${item.slug}`;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      go(items[active]!);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showDrop = open && term.length >= 2 && items.length > 0;

  return (
    <div className={`searchbox searchbox--${variant}`} ref={boxRef}>
      <form
        className={variant === 'hero' ? 'herofind__search' : 'wlsearch'}
        role="search"
        action="/pesquisa"
        method="get"
        autoComplete="off"
      >
        <IconSearch
          width={variant === 'hero' ? 22 : 20}
          height={variant === 'hero' ? 22 : 20}
          aria-hidden
        />
        <label htmlFor={`sb-${variant}`} className="sr-only">
          {placeholder}
        </label>
        <input
          id={`sb-${variant}`}
          name="q"
          placeholder={placeholder}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDrop}
          aria-controls={`sbdrop-${variant}`}
        />
        {tools ? (
          <>
            <button
              type="button"
              className={`searchbox__tool ${aiState === 'listening' ? 'is-on' : ''}`}
              onClick={startVoice}
              disabled={aiState === 'listening' || aiState === 'thinking'}
              aria-label={tools.voice}
              title={tools.voice}
            >
              <IconMic width={18} height={18} />
            </button>
            <button
              type="button"
              className="searchbox__tool"
              onClick={() => fileRef.current?.click()}
              disabled={aiState === 'thinking'}
              aria-label={tools.image}
              title={tools.image}
            >
              <IconCamera width={18} height={18} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void onPickImage(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </>
        ) : null}
        {variant === 'hero' && submitLabel ? (
          <button type="submit" className="btn btn--cta herofind__btn">
            {submitLabel}
          </button>
        ) : null}
      </form>

      {tools && aiState !== 'idle' && !showDrop ? (
        <p
          className={`searchbox__aistatus ${aiState === 'error' || aiState === 'unsupported' ? 'is-err' : ''}`}
          role="status"
        >
          {aiState === 'listening'
            ? tools.listening
            : aiState === 'thinking'
              ? tools.thinking
              : aiState === 'unsupported'
                ? tools.unsupported
                : aiState === 'unconfigured'
                  ? tools.unconfigured
                  : tools.error}
        </p>
      ) : null}

      {showDrop ? (
        <ul className="searchbox__drop" id={`sbdrop-${variant}`} role="listbox">
          {items.map((it, i) => (
            <li key={`${it.kind}-${it.slug}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={`searchbox__opt ${i === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(it);
                }}
              >
                <IconSearch width={15} height={15} aria-hidden />
                <span className="searchbox__optlabel">
                  {it.kind === 'cat' ? it.label : it.title}
                </span>
                {it.kind === 'cat' ? <span className="searchbox__opttag">categoria</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
