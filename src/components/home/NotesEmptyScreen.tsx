import { useRef, useState } from 'react';
import { VoiceRecordSheet } from './CreateHome';
import { useVoiceStore } from '../../store/voiceStore';

const BG = '#1A1513';

export default function NotesEmptyScreen({ onClose }: { onClose: () => void }) {
  const [showVoice, setShowVoice] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const addNote = useVoiceStore(s => s.addNote);

  const handleVoiceSave = (label: string, transcript: string) => {
    addNote({
      id: crypto.randomUUID(),
      title: label,
      durationMs: 0,
      transcript,
      status: 'ready',
      createdAt: new Date().toISOString(),
    });
    onClose();
  };

  const handleAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    addNote({
      id: crypto.randomUUID(),
      title: f.name,
      durationMs: 0,
      transcript: '',
      status: 'ready',
      createdAt: new Date().toISOString(),
    });
    e.target.value = '';
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: BG,
        color: '#fff',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Background tints — same as CreateHome */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'radial-gradient(380px circle at 5% 5%, rgba(140,77,20,0.35), transparent 70%),' +
            'radial-gradient(320px circle at 100% 85%, rgba(77,51,20,0.22), transparent 70%)',
        }}
      />

      {/* Top bar */}
      <div
        style={{
          position: 'relative',
          padding: 'max(20px, env(safe-area-inset-top, 0px) + 14px) 16px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 520,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#fff' }}>Notes</h1>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '0.5px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.65)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Action cards on top */}
      <div
        style={{
          position: 'relative',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 520,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <ActionCard
          label="Import audio recordings"
          icon={<ImportIcon />}
          onClick={() => audioInputRef.current?.click()}
        />
        <ActionCard
          label="Record note"
          icon={<MicIcon />}
          onClick={() => setShowVoice(true)}
        />
      </div>

      {/* Empty area below — matches the "no notes yet" feel */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '32px 24px',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
          No notes yet
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', maxWidth: 280, lineHeight: 1.5 }}>
          Import an audio recording or record a new note to get started.
        </div>
      </div>

      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleAudioFile}
      />

      <VoiceRecordSheet
        isOpen={showVoice}
        onClose={() => setShowVoice(false)}
        onSave={handleVoiceSave}
      />
    </div>
  );
}

function ActionCard({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '16px 18px',
        borderRadius: 18,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: '#fff',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: 16,
        fontWeight: 500,
        textAlign: 'left',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'rgba(217,115,26,0.18)',
          color: 'rgba(255,199,142,0.95)',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="2.2" strokeLinecap="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

function ImportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
      <path d="M8 21h8" />
    </svg>
  );
}
