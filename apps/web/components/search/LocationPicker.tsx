'use client';
import { useEffect, useRef, useState } from 'react';
import { IconMapPin, IconChevronDown } from '../icons';
import type { Province, District } from '../../lib/api';

export interface LocationLabels {
  all: string; // "Todo o país"
  whole_region: string; // "Toda a província"
  choose_district: string; // "Escolher distrito"
  back: string; // "Voltar"
}

// OLX-style hierarchical location picker: province → district drill-down, with a
// "Voltar" step and a "whole province" shortcut. It drives two hidden inputs
// (province + district) so the surrounding GET search form submits the choice;
// no client routing of its own. Closes on outside click / Escape.
export function LocationPicker({
  provinces,
  districts,
  labels,
  initialProvince = '',
  initialDistrict = '',
}: {
  provinces: Province[];
  districts: District[];
  labels: LocationLabels;
  initialProvince?: string;
  initialDistrict?: string;
}) {
  const [open, setOpen] = useState(false);
  // null = top (regions). A province code = showing that province's districts.
  const [view, setView] = useState<string | null>(null);
  const [province, setProvince] = useState(initialProvince);
  const [district, setDistrict] = useState(initialDistrict);
  const boxRef = useRef<HTMLDivElement>(null);

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
  const hasSelection = Boolean(province || district);

  function pickWholeProvince(code: string) {
    setProvince(code);
    setDistrict('');
    setOpen(false);
  }
  function pickDistrict(code: string, id: string) {
    setProvince(code);
    setDistrict(id);
    setOpen(false);
  }
  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    setProvince('');
    setDistrict('');
    setView(null);
  }

  return (
    <div className="locpick" ref={boxRef}>
      {/* The actual values submitted by the search form. */}
      <input type="hidden" name="province" value={province} />
      <input type="hidden" name="district" value={district} />

      <button
        type="button"
        className={`locpick__trigger ${hasSelection ? 'is-selected' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setView(province || null);
        }}
      >
        <IconMapPin width={18} height={18} aria-hidden />
        <span className={`locpick__label ${hasSelection ? '' : 'is-placeholder'}`}>{label}</span>
        {hasSelection ? (
          <span className="locpick__clear" role="button" aria-label="×" onClick={clear}>
            ✕
          </span>
        ) : null}
        <IconChevronDown className="locpick__caret" width={20} height={20} aria-hidden />
      </button>

      {open ? (
        <div className="locpick__pop" role="dialog">
          {view === null ? (
            <ul className="locpick__list">
              <li>
                <button
                  type="button"
                  className="locpick__row locpick__row--all"
                  onClick={() => {
                    setProvince('');
                    setDistrict('');
                    setOpen(false);
                  }}
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
                <button
                  type="button"
                  className="locpick__whole"
                  onClick={() => pickWholeProvince(view)}
                >
                  {labels.whole_region}
                </button>
              </div>
              <p className="locpick__sub">{labels.choose_district}</p>
              <ul className="locpick__list">
                {inProvince(view).map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className="locpick__row"
                      onClick={() => pickDistrict(view, d.id)}
                    >
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
