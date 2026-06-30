export function Select({ children, ...props }) {
  return <select className="select" {...props}>{children}</select>;
}
