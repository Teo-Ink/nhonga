import type { ReactNode } from 'react';

// Shared layout for /termos and /privacidade. While `draft` is true the page
// carries a visible "draft — under legal review" banner; set it to false only
// once a lawyer has approved the text and the [bracketed] placeholders are
// filled in (company name, NUIT, address, contacts).
export function LegalPage({
  title,
  updated,
  draft,
  children,
}: {
  title: string;
  updated: string;
  draft: boolean;
  children: ReactNode;
}) {
  return (
    <main className="container legal">
      <h1 className="section__title">{title}</h1>
      <p className="legal__updated">Última atualização: {updated}</p>
      {draft ? (
        <p className="legal__draft" role="note">
          Rascunho em revisão jurídica. Este texto ainda não é a versão final e pode mudar antes do
          lançamento.
        </p>
      ) : null}
      <div className="legal__body">{children}</div>
    </main>
  );
}
