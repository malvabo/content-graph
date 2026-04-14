import { useEffect, useState } from 'react';

interface Props { initialText?: string }

export default function ScriptSensePanel({ initialText }: Props) {
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    if (initialText) {
      localStorage.setItem('scriptsense-content', initialText);
      setIframeKey((k) => k + 1);
    }
  }, [initialText]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--cg-canvas)' }}>
      <iframe
        key={iframeKey}
        src="/scriptsense/scriptsense.html"
        className="flex-1 w-full border-none"
        title="ScriptSense"
      />
    </div>
  );
}
