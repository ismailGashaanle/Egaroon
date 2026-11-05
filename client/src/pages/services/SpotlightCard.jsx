import { memo, useCallback, useRef } from 'react';

function SpotlightCard({ children, className = '', as: Tag = 'div', ...props }) {
  const ref = useRef(null);

  const onMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    el.style.setProperty('--sx', `${e.clientX - box.left}px`);
    el.style.setProperty('--sy', `${e.clientY - box.top}px`);
  }, []);

  return (
    <Tag ref={ref} onMouseMove={onMove} className={`svc-spot relative overflow-hidden ${className}`} {...props}>
      <div className="relative z-10 h-full">{children}</div>
    </Tag>
  );
}

export default memo(SpotlightCard);
