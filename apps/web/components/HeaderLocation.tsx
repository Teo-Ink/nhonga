'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconMapPin, IconChevronDown } from './icons';
import type { Province, District } from '../lib/api';

export interface HeaderLocationLabels {
  eyebrow: string; // "Localização"
  all: string; // "Todo o Moçambique"
  whole_region: string; // "Toda a província"
  choose_district: string; // "Escolher distrito"
  back: string; // "Voltar"
  change: string; // aria "Mudar localização"
}

const LS_PROV = 'nhonga:region-prov';
const LS_DIST = 'nhonga:region-dist';

// Amazon/OLX-style "deliver to" pill that fills the header's centre: a region
// label the shopper can change through a province → district drill-down. Picking
// a place jumps to that region's listings and is remembered (localStorage) so the
// pill reflects the last choice across pages. Closes on outside click / Escape.
export function HeaderLocation({
  provinces,
  districts,
  labels,
}: {
  provinces: Province[];
  districts: District[];
  labels: HeaderLocationLabels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // null = top (regions). A province code = showing that province's districts.
  const [view, setView] = useState<string | null>(null);
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  // Restore the remembered region after mount (keeps server markup stable).
  useEffect(() => {
    try {
      setProvince(localStorage.getItem(LS_PROV) ?? '');
      setDistrict(localStorage.getItem(LS_DIST) ?? '');
    } catch {
      /* private mode / blocked storage — fall back to "all" */
    }
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const provName = (code: string) => provinces.find((p) => p.code === code)?.name ?? '';
  const distName = (id: string) => districts.find((d) => d.id === id)?.name ?? '';
  const inProvince = (code: string) => districts.filter((d) => d.province === code);

  const label = district ? distName(district) : province ? provName(province) : labels.all;

  function persist(code: string, id: string) {
    try {
      if (code) localStorage.setItem(LS_PROV, code);
      else localStorage.removeItem(LS_PROV);
      if (id) localStorage.setItem(LS_DIST, id);
      else localStorage.removeItem(LS_DIST);
    } catch {
      /* ignore storage failures */
    }
  }

  function go(code: string, id: string) {
    setProvince(code);
    setDistrict(id);
    persist(code, id);
    setOpen(false);
    const qs = new URLSearchParams();
    if (code) qs.set('province', code);
    if (id) qs.set('district', id);
    const q = qs.toString();
    router.push(q ? `/pesquisa?${q}` : '/pesquisa');
  }

  return (
    <div className="hdrloc" ref={boxRef}>
      <button
        type="button"
        className="hdrloc__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={labels.change}
        onClick={() => {
          setOpen((v) => !v);
          setView(province || null);
        }}
      >
        <IconMapPin className="hdrloc__pin" width={20} height={20} aria-hidden />
        <span className="hdrloc__text">
          <span className="hdrloc__eyebrow">{labels.eyebrow}</span>
          <span className="hdrloc__value">
            {label}
            <IconChevronDown className="hdrloc__caret" width={16} height={16} aria-hidden />
          </span>
        </span>
      </button>

      {open ? (
        <div className="hdrloc__pop locpick__pop" role="dialog">
          {view === null ? (
            <ul className="locpick__list">
              <li>
                <button
                  type="button"
                  className="locpick__row locpick__row--all"
                  onClick={() => go('', '')}
                >
                  {labels.all}
                </button>
              </li>
              {provinces.map((p) => (
                <li key={p.code} className="locpick__regionrow">
                  <button type="button" className="locpick__row" onClick={() => setView(p.code)}>
                    {p.name}
                    <span className="locpick__chev" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <button type="button" className="locpick__back" onClick={() => setView(null)}>
                ‹ {labels.back}
              </button>
              <div className="locpick__head">
                <strong>{provName(view)}</strong>
                <button type="button" className="locpick__whole" onClick={() => go(view, '')}>
                  {labels.whole_region}
                </button>
              </div>
              <p className="locpick__sub">{labels.choose_district}</p>
              <ul className="locpick__list">
                {inProvince(view).map((d) => (
                  <li key={d.id}>
                    <button type="button" className="locpick__row" onClick={() => go(view, d.id)}>
                      {d.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
