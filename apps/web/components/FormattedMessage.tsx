import { Fragment, type ReactNode } from 'react';

// Renders WhatsApp-style markers in a message: *bold*, _italic_, ~strike~, and
// line breaks. Text only (React nodes, no HTML injection), so it is safe for
// user-entered content. Single level — nested markers render literally.
const TOKEN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

export function FormattedMessage({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 ? <br /> : null}
          {renderLine(line)}
        </Fragment>
      ))}
    </>
  );
}

function renderLine(line: string): ReactNode[] {
  return line
    .split(TOKEN)
    .filter((p) => p !== '')
    .map((p, i) => {
      if (/^\*[^*\n]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>;
      if (/^_[^_\n]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
      if (/^~[^~\n]+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>;
      return <Fragment key={i}>{p}</Fragment>;
    });
}
