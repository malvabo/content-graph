import { useEffect, useRef, useState } from 'react';

/* ─── Helpers ──────────────────────────────────────── */

function useComputedTokens(tokens: string[]) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const map: Record<string, string> = {};
    tokens.forEach(t => { map[t] = style.getPropertyValue(t).trim(); });
    setValues(map);
  }, []);
  return values;
}

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

/* ─── Color swatch ──────────────────────────────────── */

function Swatch({ token, label, dark }: { token: string; label: string; dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hex, setHex] = useState('');
  useEffect(() => {
    if (!ref.current) return;
    const raw = getComputedStyle(ref.current).backgroundColor;
    const m = raw.match(/\d+/g);
    if (m && m.length >= 3) {
      const h = [m[0], m[1], m[2]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
      setHex('#' + h);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div ref={ref} style={{ height: 48, borderRadius: 'var(--radius-lg)', background: `var(${token})`, border: '1px solid rgba(0,0,0,0.06)' }} />
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Token>{token}</Token>
        {hex && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-disabled)' }}>{hex.toUpperCase()}</span>}
      </div>
    </div>
  );
}

function SwatchGroup({ title, swatches }: { title: string; swatches: { token: string; label: string }[] }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 12, letterSpacing: '0.02em' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
        {swatches.map(s => <Swatch key={s.token} {...s} />)}
      </div>
    </div>
  );
}

/* ─── Radius sample ─────────────────────────────────── */

function RadiusSample({ token, label, value }: { token: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <div style={{ width: 64, height: 64, background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: `var(${token})`, boxShadow: 'var(--shadow-sm)' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</div>
        <Token>{token}</Token>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-disabled)' }}>{value}</div>
      </div>
    </div>
  );
}

/* ─── Shadow sample ─────────────────────────────────── */

function ShadowSample({ token, label }: { token: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <div style={{ width: 80, height: 64, background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: `var(${token})` }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</div>
        <Token>{token}</Token>
      </div>
    </div>
  );
}

/* ─── Spacing sample ────────────────────────────────── */

function SpacingSample({ token, label, px }: { token: string; label: string; px: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 32, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ height: 2, width: `var(${token})`, maxWidth: 80, background: 'var(--color-accent)', borderRadius: 1, minWidth: 2 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)', minWidth: 24 }}>{label}</span>
        <Token>{token}</Token>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-disabled)' }}>{px}</span>
      </div>
    </div>
  );
}

/* ─── Nav ───────────────────────────────────────────── */

const SECTIONS = ['Color', 'Typography', 'Spacing', 'Radius', 'Shadows', 'Buttons', 'Forms', 'Badges'];

function SideNav({ active, onNav }: { active: string; onNav: (s: string) => void }) {
  return (
    <div style={{ position: 'sticky', top: 32, display: 'flex', flexDirection: 'column', gap: 2, width: 140, flexShrink: 0 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 8, padding: '0 10px' }}>Foundations</div>
      {SECTIONS.map(s => (
        <button key={s} onClick={() => onNav(s)}
          style={{ textAlign: 'left', background: active === s ? 'var(--color-bg-card)' : 'transparent', color: active === s ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', border: 'none', padding: '6px 10px', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: active === s ? 500 : 400, cursor: 'pointer', transition: 'background 100ms, color 100ms', boxShadow: active === s ? 'var(--shadow-sm)' : 'none' }}
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
    const el = document.getElementById(`ds-${section.toLowerCase()}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = () => {
      for (const s of SECTIONS) {
        const sec = document.getElementById(`ds-${s.toLowerCase()}`);
        if (sec && sec.getBoundingClientRect().top <= 120) setActiveSection(s);
      }
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <div style={{ width: 172, flexShrink: 0, padding: '32px 16px', borderRight: '1px solid var(--color-border-subtle)', overflowY: 'auto' }}>
        <SideNav active={activeSection} onNav={scrollTo} />
      </div>

      {/* Content */}
      <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '32px 48px 80px', scrollbarWidth: 'thin' }}>
        <div style={{ maxWidth: 840 }}>

          {/* Header */}
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', marginBottom: 8 }}>up · design system</div>
            <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}>Foundations</h1>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', lineHeight: 1.6, maxWidth: 520 }}>
              Design tokens, components, and patterns that make up the up product UI. All tokens are CSS custom properties—click any to copy.
            </p>
          </div>

          {/* ── COLOR ───────────────────────────────── */}
          <section id="ds-color" style={{ paddingTop: 8, paddingBottom: 48 }}>
            <Eyebrow>01 — Color</Eyebrow>
            <SectionTitle>Color</SectionTitle>
            <SectionDesc>Semantic color tokens mapped from primitives. Use semantic tokens, not raw values.</SectionDesc>

            <SwatchGroup title="Brand" swatches={[
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
            <SectionDesc>Two font families, five sizes, three utility classes.</SectionDesc>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              {[
                { token: '--font-sans', label: 'Sans', value: 'Graphik', sample: 'The quick brown fox' },
                { token: '--font-mono', label: 'Mono', value: 'IBM Plex Mono', sample: 'const x = "hello"' },
              ].map(f => (
                <div key={f.token} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                  <Token>{f.token}</Token>
                  <div style={{ marginTop: 8, fontSize: 22, fontFamily: `var(${f.token})`, color: 'var(--color-text-primary)', lineHeight: 1.3, fontWeight: 500 }}>{f.sample}</div>
                  <div style={{ marginTop: 6, fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{f.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 24 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 16, letterSpacing: '0.02em' }}>Type scale</div>
              {[
                { token: '--text-xs', label: 'xs', px: '12px' },
                { token: '--text-sm', label: 'sm', px: '14px' },
                { token: '--text-md', label: 'md', px: '16px' },
                { token: '--text-lg', label: 'lg', px: '20px' },
                { token: '--text-xl', label: 'xl', px: '24px' },
              ].map(t => (
                <div key={t.token} style={{ display: 'flex', alignItems: 'baseline', gap: 16, paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', width: 24, flexShrink: 0 }}>{t.px}</span>
                  <span style={{ fontSize: `var(${t.token})`, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: 1.4, flex: 1 }}>Content workflow builder</span>
                  <Token>{t.token}</Token>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 16, letterSpacing: '0.02em' }}>Utility classes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { cls: 'text-eyebrow', label: 'Eyebrow', sample: 'Section label' },
                  { cls: 'text-tag', label: 'Tag', sample: 'v1.0.0' },
                  { cls: 'text-label', label: 'Label', sample: 'Field name' },
                ].map(t => (
                  <div key={t.cls} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <span className={t.cls}>{t.sample}</span>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', background: 'var(--color-bg-surface)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>.{t.cls}</code>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <Divider />

          {/* ── SPACING ─────────────────────────────── */}
          <section id="ds-spacing" style={{ paddingBottom: 48 }}>
            <Eyebrow>03 — Spacing</Eyebrow>
            <SectionTitle>Spacing</SectionTitle>
            <SectionDesc>4px base unit. All spacing uses multiples of 4.</SectionDesc>

            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { token: '--space-1', label: '1', px: '4px' },
                { token: '--space-2', label: '2', px: '8px' },
                { token: '--space-3', label: '3', px: '12px' },
                { token: '--space-4', label: '4', px: '16px' },
                { token: '--space-5', label: '5', px: '20px' },
                { token: '--space-6', label: '6', px: '24px' },
                { token: '--space-8', label: '8', px: '32px' },
                { token: '--space-10', label: '10', px: '40px' },
                { token: '--space-12', label: '12', px: '48px' },
              ].map(s => <SpacingSample key={s.token} {...s} />)}
            </div>
          </section>

          <Divider />

          {/* ── RADIUS ──────────────────────────────── */}
          <section id="ds-radius" style={{ paddingBottom: 48 }}>
            <Eyebrow>04 — Radius</Eyebrow>
            <SectionTitle>Border Radius</SectionTitle>
            <SectionDesc>Five steps from sharp to pill.</SectionDesc>

            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {[
                { token: '--radius-sm', label: 'sm', value: '3px' },
                { token: '--radius-md', label: 'md', value: '6px' },
                { token: '--radius-lg', label: 'lg', value: '8px' },
                { token: '--radius-xl', label: 'xl', value: '10px' },
                { token: '--radius-full', label: 'full', value: '9999px' },
              ].map(r => <RadiusSample key={r.token} {...r} />)}
            </div>
          </section>

          <Divider />

          {/* ── SHADOWS ─────────────────────────────── */}
          <section id="ds-shadows" style={{ paddingBottom: 48 }}>
            <Eyebrow>05 — Shadows</Eyebrow>
            <SectionTitle>Elevation</SectionTitle>
            <SectionDesc>Three levels of elevation. Use sm for cards, md for popovers, lg for modals.</SectionDesc>

            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-end', padding: '24px 0' }}>
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
            <SectionDesc>Seven variants, five sizes, icon buttons, and special states.</SectionDesc>

            {/* Variants */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 16, letterSpacing: '0.02em' }}>Variants</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-primary">Primary</button>
                <button className="btn btn-outline">Outline</button>
                <button className="btn btn-ghost">Ghost</button>
                <button className="btn btn-tonal">Tonal</button>
                <button className="btn btn-destructive">Destructive</button>
                <button className="btn btn-ghost-dest">Ghost danger</button>
                <button className="btn btn-run">▶ Run</button>
              </div>
            </div>

            {/* Sizes */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 16, letterSpacing: '0.02em' }}>Sizes</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn-xl btn-primary">Extra large</button>
                <button className="btn btn-lg btn-primary">Large</button>
                <button className="btn btn-primary">Default</button>
                <button className="btn btn-sm btn-primary">Small</button>
                <button className="btn-xs btn-primary">XSmall</button>
              </div>
            </div>

            {/* States */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 16, letterSpacing: '0.02em' }}>States</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn btn-primary">Default</button>
                <button className="btn btn-primary loading">Loading</button>
                <button className="btn btn-primary" disabled>Disabled</button>
              </div>
            </div>

            {/* Special */}
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 16, letterSpacing: '0.02em' }}>Special</div>
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
            </div>
          </section>

          <Divider />

          {/* ── FORMS ───────────────────────────────── */}
          <section id="ds-forms" style={{ paddingBottom: 48 }}>
            <Eyebrow>07 — Forms</Eyebrow>
            <SectionTitle>Form Controls</SectionTitle>
            <SectionDesc>Inputs, textareas, and selects. Focus ring uses the accent color.</SectionDesc>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', letterSpacing: '0.02em' }}>Input</div>
                <input className="form-input" placeholder="Default" defaultValue="" />
                <input className="form-input" placeholder="With value" defaultValue="Some input text" />
                <input className="form-input form-error" placeholder="Error state" defaultValue="Invalid value" />
                <input className="form-input" disabled placeholder="Disabled" />
              </div>

              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', letterSpacing: '0.02em' }}>Select & Textarea</div>
                <select className="form-input" defaultValue="">
                  <option value="" disabled>Select an option…</option>
                  <option>Option A</option>
                  <option>Option B</option>
                </select>
                <textarea className="form-textarea" placeholder="Textarea default" rows={3} defaultValue="" />
              </div>
            </div>
          </section>

          <Divider />

          {/* ── BADGES ──────────────────────────────── */}
          <section id="ds-badges" style={{ paddingBottom: 48 }}>
            <Eyebrow>08 — Badges</Eyebrow>
            <SectionTitle>Badges & Status</SectionTitle>
            <SectionDesc>Node category badges and execution status indicators.</SectionDesc>

            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 16, letterSpacing: '0.02em' }}>Node categories</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Source', bg: '--color-badge-source-bg', text: '--color-badge-source-text' },
                  { label: 'Generate', bg: '--color-badge-generate-bg', text: '--color-badge-generate-text' },
                  { label: 'Transform', bg: '--color-badge-transform-bg', text: '--color-badge-transform-text' },
                  { label: 'Output', bg: '--color-badge-output-bg', text: '--color-badge-output-text' },
                ].map(b => (
                  <div key={b.label} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 'var(--radius-md)', background: `var(${b.bg})`, color: `var(${b.text})`, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500 }}>{b.label}</div>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 16, letterSpacing: '0.02em' }}>Execution status</div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: 'Idle', color: 'var(--color-border-strong)' },
                  { label: 'Running', color: 'var(--color-warning-border)' },
                  { label: 'Complete', color: 'var(--color-accent)' },
                  { label: 'Error', color: 'var(--color-danger)' },
                  { label: 'Stale', color: 'var(--color-warning-border)' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
