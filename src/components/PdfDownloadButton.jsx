import { Button } from './Button';

export function PdfDownloadButton({ onClick, children = 'Baixar PDF' }) {
  return <Button onClick={onClick}>{children}</Button>;
}
