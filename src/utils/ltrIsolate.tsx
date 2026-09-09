import type { ReactNode } from 'react';

export function LtrIsolate({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span dir="ltr" className={`inline-block [unicode-bidi:isolate] ${className}`}>
      {children}
    </span>
  );
}
