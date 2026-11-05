import { Suspense, useEffect, useRef, useState } from 'react';

export function SectionFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8" aria-hidden>
      <div className="mx-auto h-7 w-48 rounded-full skeleton" />
      <div className="mx-auto mt-3 h-4 w-72 max-w-full rounded-full skeleton" />
      <div className="mt-8 h-56 rounded-[1.75rem] skeleton" />
    </div>
  );
}

export default function LazySection({ children, minHeight = 400, fallback = <SectionFallback /> }) {
  const ref = useRef(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: '320px 0px', threshold: 0.01 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} style={show ? undefined : { minHeight }}>
      {show ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  );
}
