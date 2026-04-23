import { useEffect, useRef, useState } from 'react';

/* ─── Helpers ──────────────────────────────────────── */

function Token({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, color: copied ? 'var(--color-accent)' : 'var(--color-text-tertiary)', letterSpacing: '0.01em', textAlign: 'left', lineHeight: 1.4 }}
    >{copied ? 'copied!' : children}</button>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>{children}</div>;
}

function SectionTitle({ children }: { children: string }) {
  return <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-lg)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>{children}</h2>;
}

function SectionDesc({ children }: { children: string }) {
  return <p style={{ margin: '0 0 28px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', lineHeight: 1.6 }}>{children}</p>;
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '48px 0' }} />;
}

function CardWrap({ label, children, style }: { label?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 16, ...style }}>
      {label && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 16, letterSpacing: '0.02em' }}>{label}</div>}
      {children}
    </div>
  );
}

/* ─── Color swatch ──────────────────────────────────── */

function Swatch({ token, label, height = 72 }: { token: string; label: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hex, setHex] = useState('');
  useEffect(() => {
    if (!ref.current) return;
    const raw = getComputedStyle(ref.current).backgroundColor;
    const m = raw.match(/\d+/g);
    if (m && m.length >= 3) {
      setHex('#' + [m[0], m[1], m[2]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('').toUpperCase());
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div ref={ref} style={{ height, borderRadius: 'var(--radius-lg)', background: `var(${token})`, border: '1px solid rgba(0,0,0,0.06)' }} />
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Token>{token}</Token>
        {hex && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-disabled)' }}>{hex}</span>}
      </div>
    </div>
  );
}

function SwatchGroup({ title, swatches, height }: { title: string; swatches: { token: string; label: string }[]; height?: number }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 12, letterSpacing: '0.02em' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 14 }}>
        {swatches.map(s => <Swatch key={s.token} {...s} height={height} />)}
      </div>
    </div>
  );
}

/* ─── Radius sample ─────────────────────────────────── */

function RadiusSample({ token, label, value }: { token: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <div style={{ width: 72, height: 72, background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: `var(${token})`, boxShadow: 'var(--shadow-sm)' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-disabled)', marginBottom: 2 }}>{value}</div>
        <Token>{token}</Token>
      </div>
    </div>
  );
}

/* ─── Shadow sample ─────────────────────────────────── */

function ShadowSample({ token, label }: { token: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 88, height: 72, background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: `var(${token})` }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>{label}</div>
        <Token>{token}</Token>
      </div>
    </div>
  );
}

/* ─── Spacing sample ────────────────────────────────── */

function SpacingSample({ token, label, px }: { token: string; label: string; px: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div style={{ width: `var(${token})`, height: 4, background: 'var(--color-accent)', borderRadius: 2, flexShrink: 0 }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-disabled)', minWidth: 28, flexShrink: 0 }}>{px}</span>
        <Token>{token}</Token>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{label}</span>
      </div>
    </div>
  );
}

/* ─── Motion sample ─────────────────────────────────── */

function MotionSample({ token, label, ms }: { token: string; label: string; ms: string }) {
  const [active, setActive] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 14, borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        style={{
          width: 32, height: 32, borderRadius: 'var(--radius-md)',
          background: active ? 'var(--color-accent)' : 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          transition: `background var(${token}) ease`,
          flexShrink: 0, cursor: 'default',
        }}
      />
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-disabled)', minWidth: 36, flexShrink: 0 }}>{ms}</span>
        <Token>{token}</Token>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{label}</span>
      </div>
    </div>
  );
}

/* ─── Z-Index row ───────────────────────────────────── */

function ZRow({ token, label, value }: { token: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div style={{ width: 48, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', flexShrink: 0 }}>{value}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Token>{token}</Token>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{label}</span>
      </div>
    </div>
  );
}

/* ─── Nav ───────────────────────────────────────────── */

const SECTIONS = ['Color', 'Typography', 'Spacing', 'Radius', 'Shadows', 'Buttons', 'Forms', 'Badges', 'Motion', 'Z-Index'];

function SideNav({ active, onNav }: { active: string; onNav: (s: string) => void }) {
  return (
    <div style={{ position: 'sticky', top: 32, display: 'flex', flexDirection: 'column', gap: 2, width: 148, flexShrink: 0 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 8, padding: '0 10px' }}>Foundations</div>
      {SECTIONS.map(s => (
        <button key={s} onClick={() => onNav(s)}
          style={{ textAlign: 'left', background: active === s ? 'var(--color-bg-card)' : 'transparent', color: active === s ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', border: 'none', padding: '6px 10px', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: active === s ? 500 : 400, cursor: 'pointer', transition: 'background 100ms, color 100ms', boxShadow: active === s ? 'var(--shadow-sm)' : 'none' }}
          onMouseEnter={e => { if (active !== s) e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          onMouseLeave={e => { if (active !== s) e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
        >{s}</button>
      ))}
    </div>
  );
}

/* ─── Main ──────────────────────────────────────────── */

export default function DesignSystemPanel() {
  const [activeSection, setActiveSection] = useState('Color');
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollTo = (section: string) => {
    setActiveSection(section);
    const el = document.getElementById(`ds-${section.toLowerCase().replace('-', '')}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = () => {
      let current = SECTIONS[0];
      for (const s of SECTIONS) {
        const sec = document.getElementById(`ds-${s.toLowerCase().replace('-', '')}`);
        if (sec && sec.getBoundingClientRect().top <= 140) current = s;
      }
      setActiveSection(current);
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <div style={{ width: 180, flexShrink: 0, padding: '32px 16px', borderRight: '1px solid var(--color-border-subtle)', overflowY: 'auto' }}>
        <SideNav active={activeSection} onNav={scrollTo} />
      </div>

      {/* Content */}
      <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '32px 48px 80px', scrollbarWidth: 'thin' }}>
        <div style={{ maxWidth: 860 }}>

          {/* Header */}
          <div style={{ marginBottom: 52 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: 10 }}>up · design system</div>
            <h1 style={{ margin: '0 0 10px', fontSize: 30, fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}>Foundations</h1>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', lineHeight: 1.6, maxWidth: 540 }}>
              Design tokens, components, and patterns that make up the up product UI. All tokens are CSS custom properties — click any to copy.
            </p>
          </div>

          {/* ── COLOR ───────────────────────────────── */}
          <section id="ds-color" style={{ paddingTop: 8, paddingBottom: 48 }}>
            <Eyebrow>01 — Color</Eyebrow>
            <SectionTitle>Color</SectionTitle>
            <SectionDesc>Semantic tokens mapped from primitives. Always use semantic tokens — never raw hex values.</SectionDesc>

            <SwatchGroup title="Brand" height={96} swatches={[
              { token: '--color-accent', label: 'Accent' },
              { token: '--color-accent-hover', label: 'Accent hover' },
              { token: '--color-accent-active', label: 'Accent active' },
              { token: '--color-accent-subtle', label: 'Accent subtle' },
            ]} />

            <SwatchGroup title="Background" swatches={[
              { token: '--color-bg', label: 'Canvas' },
              { token: '--color-bg-surface', label: 'Surface' },
              { token: '--color-bg-card', label: 'Card' },
              { token: '--color-bg-subtle', label: 'Subtle' },
              { token: '--color-bg-popover', label: 'Popover' },
              { token: '--color-bg-hover', label: 'Hover' },
              { token: '--color-nav-bg', label: 'Nav' },
            ]} />

            <SwatchGroup title="Text" swatches={[
              { token: '--color-text-primary', label: 'Primary' },
              { token: '--color-text-secondary', label: 'Secondary' },
              { token: '--color-text-tertiary', label: 'Tertiary' },
              { token: '--color-text-disabled', label: 'Disabled' },
              { token: '--color-text-placeholder', label: 'Placeholder' },
            ]} />

            <SwatchGroup title="Border" swatches={[
              { token: '--color-border-subtle', label: 'Subtle' },
              { token: '--color-border-default', label: 'Default' },
              { token: '--color-border-strong', label: 'Strong' },
              { token: '--color-border-handle', label: 'Handle' },
            ]} />

            <SwatchGroup title="Status" swatches={[
              { token: '--color-success-bg', label: 'Success bg' },
              { token: '--color-success-border', label: 'Success border' },
              { token: '--color-warning-bg', label: 'Warning bg' },
              { token: '--color-warning-border', label: 'Warning border' },
              { token: '--color-danger-bg', label: 'Danger bg' },
              { token: '--color-danger-border', label: 'Danger border' },
              { token: '--color-danger', label: 'Danger' },
            ]} />

            <SwatchGroup title="Node categories" swatches={[
              { token: '--color-badge-source-bg', label: 'Source bg' },
              { token: '--color-badge-generate-bg', label: 'Generate bg' },
              { token: '--color-badge-transform-bg', label: 'Transform bg' },
              { token: '--color-badge-output-bg', label: 'Output bg' },
            ]} />

            <SwatchGroup title="Edge" swatches={[
              { token: '--color-edge', label: 'Default' },
              { token: '--color-edge-source', label: 'Source' },
              { token: '--color-edge-generate', label: 'Generate' },
              { token: '--color-edge-transform', label: 'Transform' },
              { token: '--color-edge-output', label: 'Output' },
            ]} />
          </section>

          <Divider />

          {/* ── TYPOGRAPHY ──────────────────────────── */}
          <section id="ds-typography" style={{ paddingBottom: 48 }}>
            <Eyebrow>02 — Typography</Eyebrow>
            <SectionTitle>Typography</SectionTitle>
            <SectionDesc>Two font families, five sizes. Use Graphik for UI text; IBM Plex Mono for code, tokens, and labels.</SectionDesc>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {[
                { token: '--font-sans', label: 'Sans', value: 'Graphik', sample: 'The quick brown fox' },
                { token: '--font-mono', label: 'Mono', value: 'IBM Plex Mono', sample: 'const x = "hello"' },
              ].map(f => (
                <CardWrap key={f.token}>
                  <Token>{f.token}</Token>
                  <div style={{ marginTop: 10, fontSize: 22, fontFamily: `var(${f.token})`, color: 'var(--color-text-primary)', lineHeight: 1.3, fontWeight: 500 }}>{f.sample}</div>
                  <div style={{ marginTop: 6, fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{f.value}</div>
                </CardWrap>
              ))}
            </div>

            <CardWrap label="Type scale" style={{ marginBottom: 16 }}>
              {[
                { token: '--text-xs', label: 'xs', px: '12px' },
                { token: '--text-sm', label: 'sm', px: '14px' },
                { token: '--text-md', label: 'md', px: '16px' },
                { token: '--text-lg', label: 'lg', px: '20px' },
                { token: '--text-xl', label: 'xl', px: '24px' },
              ].map((t, i, arr) => (
                <div key={t.token} style={{ display: 'flex', alignItems: 'baseline', gap: 16, paddingBottom: 12, marginBottom: i < arr.length - 1 ? 12 : 0, borderBottom: i < arr.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', width: 28, flexShrink: 0 }}>{t.px}</span>
                  <span style={{ fontSize: `var(${t.token})`, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: 1.4, flex: 1 }}>Content workflow builder</span>
                  <Token>{t.token}</Token>
                </div>
              ))}
            </CardWrap>

            <CardWrap label="Utility classes">
              {[
                { cls: 'text-eyebrow', label: 'Eyebrow', sample: 'Section label', note: 'Uppercase sans, accent color' },
                { cls: 'text-tag', label: 'Tag', sample: 'v1.0.0', note: 'Uppercase mono, tertiary' },
                { cls: 'text-label', label: 'Label', sample: 'Field name', note: 'Uppercase sans, tertiary' },
              ].map((t, i, arr) => (
                <div key={t.cls} style={{ display: 'flex', alignItems: 'center', gap: 24, paddingBottom: 12, marginBottom: i < arr.length - 1 ? 12 : 0, borderBottom: i < arr.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                  <span className={t.cls} style={{ minWidth: 80, flexShrink: 0 }}>{t.sample}</span>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', background: 'var(--color-bg-surface)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}>.{t.cls}</code>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-disabled)' }}>{t.note}</span>
                </div>
              ))}
            </CardWrap>
          </section>

          <Divider />

          {/* ── SPACING ─────────────────────────────── */}
          <section id="ds-spacing" style={{ paddingBottom: 48 }}>
            <Eyebrow>03 — Spacing</Eyebrow>
            <SectionTitle>Spacing</SectionTitle>
            <SectionDesc>4px base unit. All spacing is a multiple of 4px. Never use arbitrary pixel values.</SectionDesc>

            <CardWrap>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { token: '--space-1', label: 'xs', px: '4px' },
                  { token: '--space-2', label: 'sm', px: '8px' },
                  { token: '--space-3', label: 'md', px: '12px' },
                  { token: '--space-4', label: 'lg', px: '16px' },
                  { token: '--space-5', label: 'xl', px: '20px' },
                  { token: '--space-6', label: '2xl', px: '24px' },
                  { token: '--space-8', label: '3xl', px: '32px' },
                  { token: '--space-10', label: '4xl', px: '40px' },
                  { token: '--space-12', label: '5xl', px: '48px' },
                ].map(s => <SpacingSample key={s.token} {...s} />)}
              </div>
            </CardWrap>
          </section>

          <Divider />

          {/* ── RADIUS ──────────────────────────────── */}
          <section id="ds-radius" style={{ paddingBottom: 48 }}>
            <Eyebrow>04 — Radius</Eyebrow>
            <SectionTitle>Border Radius</SectionTitle>
            <SectionDesc>Five steps from sharp to pill. Use lg for cards and panels, md for controls, sm for badges.</SectionDesc>

            <CardWrap>
              <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {[
                  { token: '--radius-sm', label: 'sm', value: '3px' },
                  { token: '--radius-md', label: 'md', value: '6px' },
                  { token: '--radius-lg', label: 'lg', value: '8px' },
                  { token: '--radius-xl', label: 'xl', value: '10px' },
                  { token: '--radius-full', label: 'full', value: '9999px' },
                ].map(r => <RadiusSample key={r.token} {...r} />)}
              </div>
            </CardWrap>
          </section>

          <Divider />

          {/* ── SHADOWS ─────────────────────────────── */}
          <section id="ds-shadows" style={{ paddingBottom: 48 }}>
            <Eyebrow>05 — Shadows</Eyebrow>
            <SectionTitle>Elevation</SectionTitle>
            <SectionDesc>Use sm for cards, md for popovers and dropdowns, lg for modals, panel for the main content surface.</SectionDesc>

            {/* Surface tile so shadows are visible against the content bg */}
            <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', padding: '32px 40px', display: 'flex', gap: 48, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { token: '--shadow-sm', label: 'Small' },
                { token: '--shadow-md', label: 'Medium' },
                { token: '--shadow-lg', label: 'Large' },
                { token: '--shadow-panel', label: 'Panel' },
                { token: '--shadow-glow', label: 'Glow' },
              ].map(s => <ShadowSample key={s.token} {...s} />)}
            </div>
          </section>

          <Divider />

          {/* ── BUTTONS ─────────────────────────────── */}
          <section id="ds-buttons" style={{ paddingBottom: 48 }}>
            <Eyebrow>06 — Buttons</Eyebrow>
            <SectionTitle>Buttons</SectionTitle>
            <SectionDesc>Seven variants, five sizes, icon buttons, and special-purpose controls.</SectionDesc>

            <CardWrap label="Variants">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <button className="btn btn-primary">Primary</button>
                <button className="btn btn-outline">Outline</button>
                <button className="btn btn-ghost">Ghost</button>
                <button className="btn btn-tonal">Tonal</button>
                <button className="btn btn-destructive">Destructive</button>
                <button className="btn btn-ghost-dest">Ghost danger</button>
                <button className="btn btn-run">▶ Run</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto auto auto', gap: '6px 16px' }}>
                {[
                  { label: 'Primary', note: 'Default action. White on light, elevated on dark.' },
                  { label: 'Outline', note: 'Secondary actions alongside a Primary.' },
                  { label: 'Ghost', note: 'Tertiary actions, icon toolbars, inline controls.' },
                  { label: 'Tonal', note: 'Soft accent. Highlight a secondary CTA.' },
                  { label: 'Destructive', note: 'Irreversible actions: delete, remove.' },
                  { label: 'Ghost danger', note: 'Destructive option in a crowded layout.' },
                  { label: 'Run', note: 'Animated gradient. Reserved for workflow execution.' },
                ].map(v => (
                  <span key={v.label} style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)', gridColumn: 'span 1' }}>
                    <strong style={{ color: 'var(--color-text-secondary)', display: 'block', marginBottom: 1 }}>{v.label}</strong>
                    {v.note}
                  </span>
                ))}
              </div>
            </CardWrap>

            <CardWrap label="Sizes">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn-xl btn-primary">Extra large</button>
                <button className="btn-lg btn-primary">Large</button>
                <button className="btn btn-primary">Default</button>
                <button className="btn-sm btn-primary">Small</button>
                <button className="btn-xs btn-primary">X-Small</button>
              </div>
            </CardWrap>

            <CardWrap label="States">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn btn-primary">Default</button>
                <button className="btn btn-primary loading">Loading</button>
                <button className="btn btn-primary" disabled>Disabled</button>
              </div>
            </CardWrap>

            <CardWrap label="Special">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn-micro">Micro</button>
                <button className="btn-pill">Pill</button>
                <button className="btn-pill active">Pill active</button>
                <button className="btn-pill warn">Warning</button>
                <button className="btn-pill error">Error</button>
                <button className="btn-link">Link button</button>
                <button className="btn btn-icon btn-outline">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                </button>
                <button className="btn btn-icon-sm btn-outline">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </CardWrap>
          </section>

          <Divider />

          {/* ── FORMS ───────────────────────────────── */}
          <section id="ds-forms" style={{ paddingBottom: 48 }}>
            <Eyebrow>07 — Forms</Eyebrow>
            <SectionTitle>Form Controls</SectionTitle>
            <SectionDesc>Inputs, textareas, and selects. Focus ring uses the accent color. Error state uses danger border.</SectionDesc>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <CardWrap label="Input">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input className="form-input" placeholder="Default" defaultValue="" />
                  <input className="form-input" placeholder="With value" defaultValue="Some input text" />
                  <input className="form-input form-error" placeholder="Error state" defaultValue="Invalid value" />
                  <input className="form-input" disabled placeholder="Disabled" />
                </div>
              </CardWrap>

              <CardWrap label="Select & Textarea">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select className="form-input" defaultValue="">
                    <option value="" disabled>Select an option…</option>
                    <option>Option A</option>
                    <option>Option B</option>
                  </select>
                  <textarea className="form-textarea" placeholder="Textarea default" rows={4} defaultValue="" />
                </div>
              </CardWrap>
            </div>
          </section>

          <Divider />

          {/* ── BADGES ──────────────────────────────── */}
          <section id="ds-badges" style={{ paddingBottom: 48 }}>
            <Eyebrow>08 — Badges</Eyebrow>
            <SectionTitle>Badges & Status</SectionTitle>
            <SectionDesc>Node category labels and execution status indicators used throughout the canvas.</SectionDesc>

            <CardWrap label="Node categories">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Source', bg: '--color-badge-source-bg', text: '--color-badge-source-text' },
                  { label: 'Generate', bg: '--color-badge-generate-bg', text: '--color-badge-generate-text' },
                  { label: 'Transform', bg: '--color-badge-transform-bg', text: '--color-badge-transform-text' },
                  { label: 'Output', bg: '--color-badge-output-bg', text: '--color-badge-output-text' },
                ].map(b => (
                  <div key={b.label} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 11px', borderRadius: 'var(--radius-md)', background: `var(${b.bg})`, color: `var(${b.text})`, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500 }}>{b.label}</div>
                ))}
              </div>
            </CardWrap>

            <CardWrap label="Execution status">
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: 'Idle', color: 'var(--color-border-strong)' },
                  { label: 'Running', color: 'var(--color-warning-border)' },
                  { label: 'Complete', color: 'var(--color-accent)' },
                  { label: 'Error', color: 'var(--color-danger)' },
                  { label: 'Stale', color: 'var(--color-warning-border)', dashed: true },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0, outline: s.dashed ? `2px dashed ${s.color}` : 'none', outlineOffset: 2 }} />
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </CardWrap>
          </section>

          <Divider />

          {/* ── MOTION ──────────────────────────────── */}
          <section id="ds-motion" style={{ paddingBottom: 48 }}>
            <Eyebrow>09 — Motion</Eyebrow>
            <SectionTitle>Motion</SectionTitle>
            <SectionDesc>Hover each row to preview the transition speed. Use faster durations for immediate feedback, slower for layout shifts.</SectionDesc>

            <CardWrap>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { token: '--duration-fast', label: 'Fast — micro-interactions, button press', ms: '80ms' },
                  { token: '--duration-base', label: 'Base — most hover / color transitions', ms: '100ms' },
                  { token: '--duration-medium', label: 'Medium — panel state changes', ms: '150ms' },
                  { token: '--duration-slow', label: 'Slow — nav expand, drawer open', ms: '200ms' },
                  { token: '--duration-enter', label: 'Enter — page transitions, modals', ms: '300ms' },
                ].map(m => <MotionSample key={m.token} {...m} />)}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 2 }}>
                  <div style={{ width: 32, height: 32, flexShrink: 0 }} />
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-disabled)', minWidth: 36, flexShrink: 0 }}>ease</span>
                    <Token>--ease-default</Token>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>Easing — default for all transitions</span>
                  </div>
                </div>
              </div>
            </CardWrap>
          </section>

          <Divider />

          {/* ── Z-INDEX ──────────────────────────────── */}
          <section id="ds-zindex" style={{ paddingBottom: 80 }}>
            <Eyebrow>10 — Z-Index</Eyebrow>
            <SectionTitle>Z-Index</SectionTitle>
            <SectionDesc>Fixed stacking order. Never use an arbitrary z-index — always use a token.</SectionDesc>

            <CardWrap>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { token: '--z-dropdown', value: '50', label: 'Dropdowns, menus' },
                  { token: '--z-sticky', value: '100', label: 'Sticky headers, toolbars' },
                  { token: '--z-modal', value: '1000', label: 'Modal dialogs' },
                  { token: '--z-sheet', value: '1100', label: 'Side sheets, drawers' },
                  { token: '--z-toast', value: '1200', label: 'Toast notifications' },
                  { token: '--z-popover', value: '1300', label: 'Popovers, tooltips (always on top)' },
                ].map(z => <ZRow key={z.token} {...z} />)}
              </div>
            </CardWrap>
          </section>

        </div>
      </div>
    </div>
  );
}
