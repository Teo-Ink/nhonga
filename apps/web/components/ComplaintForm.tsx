'use client';

import { useState } from 'react';

// Formal complaint form (LEG-02). The person gets a reference to quote; the
// record is kept 5 years (Decreto 59/2023, art. 45).
const SUBJECTS: ReadonlyArray<readonly [string, string]> = [
  ['payment', 'Pagamento, carteira ou reembolso'],
  ['listing', 'Um anúncio ou um vendedor'],
  ['account', 'A minha conta'],
  ['privacy', 'Privacidade e dados pessoais'],
  ['advertising', 'Publicidade'],
  ['other', 'Outro assunto'],
];

type State =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'done'; reference: string }
  | { kind: 'error'; message: string };

export function ComplaintForm() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [subject, setSubject] = useState('payment');
  const [body, setBody] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: 'saving' });
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, contact, subject, body }),
      });
      const data = (await res.json().catch(() => ({}))) as { reference?: string };
      if (res.ok && data.reference) {
        setState({ kind: 'done', reference: data.reference });
        return;
      }
      setState({
        kind: 'error',
        message:
          res.status === 429
            ? 'Já enviou várias reclamações há pouco. Tente de novo dentro de uma hora.'
            : res.status === 400
              ? 'Confirme os campos: o nome, o contacto e uma descrição com pelo menos 10 letras.'
              : 'Não foi possível enviar agora. Tente de novo dentro de momentos.',
      });
    } catch {
      setState({ kind: 'error', message: 'Sem ligação. Verifique a Internet e tente de novo.' });
    }
  }

  if (state.kind === 'done') {
    return (
      <div className="legal__draft" role="status">
        <p>
          Reclamação recebida. A sua referência é <strong>{state.reference}</strong>. Guarde-a:
          vamos responder para o contacto que indicou.
        </p>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <label className="field">
        <span className="field__label">Nome</span>
        <input
          className="field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          autoComplete="name"
          required
        />
      </label>
      <label className="field">
        <span className="field__label">Telemóvel ou email para a resposta</span>
        <input
          className="field__input"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={160}
          required
        />
      </label>
      <label className="field">
        <span className="field__label">Assunto</span>
        <select
          className="field__input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          {SUBJECTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">O que aconteceu</span>
        <textarea
          className="field__input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          minLength={10}
          maxLength={4000}
          required
        />
        <span className="field__hint">
          Diga a data, o anúncio ou o pagamento em causa. Não escreva o seu PIN.
        </span>
      </label>
      {state.kind === 'error' ? (
        <p role="alert" className="field__error">
          {state.message}
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn" disabled={state.kind === 'saving'}>
          {state.kind === 'saving' ? 'A enviar…' : 'Enviar reclamação'}
        </button>
      </div>
    </form>
  );
}
