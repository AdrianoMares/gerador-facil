import { Button } from './Button';

export function PdfDownloadButton({ onClick, children = 'Baixar PDF', ...props }) {
  return <Button onClick={onClick} {...props}>{children}</Button>;
}
