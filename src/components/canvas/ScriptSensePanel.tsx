import { useEffect, useRef } from 'react';

interface Props { initialText?: string }

export default function ScriptSensePanel({ initialText }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (initialText) {
      localStorage.setItem('scriptsense-content', initialText);
    }
  }, [initialText]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--cg-canvas)' }}>
      <iframe
        ref={iframeRef}
        src="/scriptsense/scriptsense.html"
        className="flex-1 w-full border-none"
        title="ScriptSense"
      />
    </div>
  );
}
