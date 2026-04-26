import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

function charIdxForWord(text: string, wordCount: number): number {
  let count = 0, i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length) break;
    while (i < text.length && !/\s/.test(text[i])) i++;
    count++;
    if (count >= wordCount) return i;
  }
  return text.length;
}

function totalWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function renderDraftContent(text: string, charIdx: number): React.ReactNode {
  const displayed = text.slice(0, charIdx);
  const paras = displayed.split('\n\n');
  return paras.map((para, pi) => {
    const parts = para.split(/(→)/g);
    return (
      <p key={pi} style={{ margin: 0, marginTop: pi > 0 ? 20 : 0, whiteSpace: 'pre-wrap' }}>
        {parts.map((part, i) =>
          part === '→' ? <span key={i} style={{ opacity: 0.6 }}>→</span> : part
        )}
      </p>
    );
  });
}
import { useVoiceStore } from '../../store/voiceStore';

type Phase = 'idle' | 'prompt' | 'recording' | 'platform' | 'draft' | 'posting';

interface Props {
  onComplete: () => void;
  initialPhase?: Phase;
}
type SelPhase = 'none' | 'pulse' | 'travel' | 'merge';

// ─── Platform draft copy ──────────────────────────────────────────────────────

const PLATFORM_DRAFTS: Record<string, string> = {
  linkedin: `Just had a realization worth sharing.

Most content advice tells you to post more. Stay consistent. Stay top of mind.

But the posts that actually land? They have one thing in common: clarity.

Here's what I've learned:

→ One idea per post
→ Lead with the insight, not the backstory
→ End with a real question, not a period

What's your approach — volume or depth?`,
  x: `Hot take: most content advice is wrong.

You don't need to post daily. You need to post clearly. One real insight beats 30 filler posts every time. The feed rewards depth — people just don't tell you that.`,
  instagram: `Something shifted for me recently ✨

I stopped trying to say everything and started saying one thing really well.

The posts that connected weren't the polished ones. They were the honest ones.

If you've been feeling like nothing you make is good enough — you're not alone. Start with what's true. The rest follows.

Drop a 🤍 if this resonates`,
  threads: `okay so real talk

been thinking about why some posts land and others disappear into the feed

i think it's just honesty? the ones that feel real because they actually are

anyway that's the whole thought`,
};

// ─── Aurora blobs ─────────────────────────────────────────────────────────────

// Blob positions are computed so they are deliberately asymmetric around the orb
// (center 50% x, 60% y) and no blob drifts behind the headline (28% y).
// Distances from orb center: amber 205px, purple 128px, pink 359px, green 235px — no ring.
const BLOBS = [
  // Amber — bottom-right, far below orb
  { color: 'radial-gradient(ellipse, rgba(255,150,18,0.88) 0%, rgba(255,90,5,0.42) 44%, transparent 70%)', w: 540, h: 460, xPath: ['11%','22%','6%','18%','11%'], yPath: ['53%','61%','46%','57%','53%'], xDur: 31, yDur: 43 },
  // Purple — mid-left, well below headline zone
  { color: 'radial-gradient(ellipse, rgba(98,12,255,0.82) 0%, rgba(68,0,218,0.38) 44%, transparent 70%)', w: 500, h: 460, xPath: ['-42%','-28%','-46%','-34%','-42%'], yPath: ['25%','34%','20%','30%','25%'], xDur: 38, yDur: 27 },
  // Pink — upper-right corner, far from orb
  { color: 'radial-gradient(ellipse, rgba(255,48,148,0.78) 0%, rgba(218,18,110,0.34) 44%, transparent 70%)', w: 440, h: 400, xPath: ['26%','38%','20%','34%','26%'], yPath: ['-4%','6%','-8%','2%','-4%'], xDur: 29, yDur: 47 },
  // Green — far lower-left
  { color: 'radial-gradient(ellipse, rgba(16,212,72,0.68) 0%, rgba(6,168,42,0.28) 44%, transparent 70%)', w: 420, h: 380, xPath: ['-46%','-32%','-50%','-38%','-46%'], yPath: ['57%','66%','51%','62%','57%'], xDur: 35, yDur: 25 },
];

// ─── Platform definitions ─────────────────────────────────────────────────────

// Each platform is a "colored cloud" — two stacked CSS radial-gradient circles
// (halo + dense body) that fade fully to transparent before reaching their bounding
// box, plus a centered logo glyph. No SVG <circle> with a hard edge, no
// mix-blend-mode; the painted region's alpha is round all the way out, so there is
// no rectangle to leak on iOS Safari.

const PLATFORMS = [
  { id: 'linkedin',  label: 'LinkedIn',  left: '16.5%', xOffset: '33.5vw', mergeRgb: '10,102,194',  glowRgb: '10,102,194',  bulbInner: '#cfe1f6', bulbOuter: '#0a66c2' },
  { id: 'x',         label: 'X',         left: '39%',   xOffset: '11vw',   mergeRgb: '240,235,230', glowRgb: '90,90,90',    bulbInner: '#ffffff', bulbOuter: '#5a5a5a' },
  { id: 'instagram', label: 'Instagram', left: '61%',   xOffset: '-11vw',  mergeRgb: '225,48,108',  glowRgb: '201,48,102',  bulbInner: '#ffceb6', bulbOuter: '#c93066' },
  { id: 'threads',   label: 'Threads',   left: '83.5%', xOffset: '-33.5vw',mergeRgb: '60,50,70',    glowRgb: '74,58,94',    bulbInner: '#d4c4e6', bulbOuter: '#4a3a5e' },
] as const;

// All logos drawn in a unified 32×32 viewBox so each occupies the same visual area
// inside the cloud — no per-platform size variation.
const PLATFORM_LOGO: Record<string, React.ReactNode> = {
  linkedin: (
    <text x="16" y="22" textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff"
      fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" letterSpacing="-0.4">in</text>
  ),
  x: (
    <g stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none">
      <line x1="9" y1="9" x2="23" y2="23" />
      <line x1="23" y1="9" x2="9" y2="23" />
    </g>
  ),
  instagram: (
    <g fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="20" height="20" rx="5" />
      <circle cx="16" cy="16" r="5" />
      <circle cx="22" cy="10" r="1.2" fill="#fff" stroke="none" />
    </g>
  ),
  threads: (
    <text x="16" y="22" textAnchor="middle" fontSize="22" fontWeight="800" fill="#fff"
      fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">@</text>
  ),
};

// Cloud click-target 64px; halo extends to ~140px around it. Label sits 50px below
// the cloud center.
const BULB = 64;
const LABEL_BELOW = BULB / 2 + 22;

// Unified breathing — same amplitude (0.97↔1.03) for every cloud so all four read as
// the same size at all times. Only the period and phase offset differ, for liveness.
const BREATH = [
  { scalePeriod: 4.2, scaleKeys: [0.97, 1.03, 0.97], driftOffset: 0   },
  { scalePeriod: 4.6, scaleKeys: [0.97, 1.03, 0.97], driftOffset: 1.6 },
  { scalePeriod: 5.0, scaleKeys: [0.97, 1.03, 0.97], driftOffset: 3.2 },
  { scalePeriod: 4.4, scaleKeys: [0.97, 1.03, 0.97], driftOffset: 4.8 },
];

// ─── Orb phase targets ────────────────────────────────────────────────────────

const ORB: Record<Phase, object> = {
  idle:      { width: 200, height: 200, borderRadius: 100, top: '60%',  left: '50%', x: '-50%', y: '-50%', opacity: 1, scale: 1 },
  prompt:    { width: 300, height: 76,  borderRadius: 38,  top: '76%',  left: '50%', x: '-50%', y: '-50%', opacity: 1, scale: 1 },
  recording: { width: 160, height: 160, borderRadius: 80,  top: '52%',  left: '50%', x: '-50%', y: '-50%', opacity: 0, scale: 2.8 },
  platform:  { width: 160, height: 44,  borderRadius: 22,  top: '11%',  left: '50%', x: '-50%', y: '-50%', opacity: 1, scale: 1 },
  draft:     { width: 56,  height: 56,  borderRadius: 28,  top: '88%',  left: '50%', x: '-50%', y: '-50%', opacity: 1, scale: 1 },
  posting:   { width: 56,  height: 56,  borderRadius: 28,  top: '88%',  left: '50%', x: '-50%', y: '-50%', opacity: 0, scale: 0 },
};

const SPRING    = { type: 'spring' as const, stiffness: 80,  damping: 18, mass: 1 };
const SEL_SPRING = { type: 'spring' as const, stiffness: 70,  damping: 20 };
const ENT_SPRING = { type: 'spring' as const, stiffness: 220, damping: 22 };
const EASE: [number,number,number,number] = [0.4, 0.0, 0.6, 1.0];

// ─── Recording canvas ─────────────────────────────────────────────────────────

function RecordingCanvas({ onStop }: { onStop: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef  = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let t = 0, spread = 88, raf: number;
    let analyser: AnalyserNode | null = null, audioCtx: AudioContext | null = null, stream: MediaStream | null = null;
    const arr = new Uint8Array(128);
    const resize = () => { const dpr = devicePixelRatio||1; canvas.width=innerWidth*dpr; canvas.height=innerHeight*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); };
    resize(); addEventListener('resize', resize);
    navigator.mediaDevices.getUserMedia({audio:true,video:false}).then(s=>{
      stream=s; audioCtx=new AudioContext(); analyser=audioCtx.createAnalyser(); analyser.fftSize=256; analyser.smoothingTimeConstant=0.7;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
    }).catch(()=>{});
    const birthStart = Date.now();
    const BIRTH_MS = 950;
    const draw = () => {
      const w=innerWidth,h=innerHeight,cx=w/2,cy=h*0.52;
      if(analyser){analyser.getByteFrequencyData(arr);let s=0;for(let k=0;k<arr.length;k++)s+=arr[k];levelRef.current=Math.min(1,(s/arr.length)/80);}
      const lv=levelRef.current; spread+=((lv>0.12?10:88)-spread)*0.04;
      // birth: blobs expand from orb center outward over BIRTH_MS, eased out
      const birthFrac = Math.min(1, (Date.now() - birthStart) / BIRTH_MS);
      const birth = Math.pow(birthFrac, 0.45);
      ctx.clearRect(0,0,w,h);
      for(let i=0;i<4;i++){
        const ang=t*0.65+i*(Math.PI*0.5),r=(spread+Math.sin(t*0.45+i*1.1)*20)*birth;
        const px=cx+Math.cos(ang)*r*0.88,py=cy+Math.sin(ang)*r*0.72,sz=(155+Math.sin(t*0.9+i*0.8)*38)*(1+lv*0.5);
        const al=(0.22+lv*0.32)*birth,hue=145+i*5,gr=ctx.createRadialGradient(px,py,0,px,py,sz);
        gr.addColorStop(0,`hsla(${hue},58%,52%,${al.toFixed(2)})`); gr.addColorStop(0.5,`hsla(${hue},50%,48%,${(al*0.28).toFixed(2)})`); gr.addColorStop(1,'transparent');
        ctx.fillStyle=gr; ctx.fillRect(0,0,w,h);
      }
      if(lv>0.05){const g=ctx.createRadialGradient(cx,cy,0,cx,cy,120+lv*80);g.addColorStop(0,`hsla(150,60%,55%,${(lv*0.28).toFixed(2)})`);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
      t+=0.010; raf=requestAnimationFrame(draw);
    };
    draw();
    return ()=>{ cancelAnimationFrame(raf); removeEventListener('resize',resize); stream?.getTracks().forEach(tr=>tr.stop()); audioCtx?.close().catch(()=>{}); };
  }, []);
  return <canvas ref={canvasRef} onClick={onStop} style={{position:'absolute',inset:0,width:'100%',height:'100%',cursor:'pointer',zIndex:20,touchAction:'none'}} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MobileOnboarding({ onComplete, initialPhase }: Props) {
  const [phase, setPhase]       = useState<Phase>(initialPhase ?? 'idle');
  const [selPhase, setSelPhase] = useState<SelPhase>('none');
  const [selId, setSelId]       = useState<string | null>(null);
  const [orbAbsorb, setOrbAbsorb]       = useState(false);
  const [mergeColor, setMergeColor]     = useState<string | null>(null);
  const [draftText, setDraftText]       = useState('');
  const [displayedCharIdx, setDisplayedCharIdx] = useState(0);
  const [typingDone, setTypingDone]             = useState(false);
  const [isEditing, setIsEditing]               = useState(false);
  const [isPosted, setIsPosted]                 = useState(false);
  const [savedPlatformId, setSavedPlatformId]   = useState<string|null>(null);

  useEffect(() => {
    if (phase !== 'draft') {
      setDisplayedCharIdx(0);
      setTypingDone(false);
      setIsEditing(false);
      return;
    }
    const text = draftText;
    const total = totalWords(text);
    let wordNum = 0;
    let tick: ReturnType<typeof setInterval>;
    // Delay start until orb lands (~900ms) and headline appears (~350ms)
    const startTimer = setTimeout(() => {
      tick = setInterval(() => {
        wordNum++;
        setDisplayedCharIdx(charIdxForWord(text, wordNum));
        if (wordNum >= total) { clearInterval(tick); setTypingDone(true); }
      }, 40);
    }, 1250);
    return () => { clearTimeout(startTimer); clearInterval(tick); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'prompt') return;
    const t = setTimeout(startRecording, 1500);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function advance()       { if (phase === 'idle') setPhase('prompt'); }
  function startRecording(){ setPhase('recording'); }
  function goToPlatform()  { setPhase('platform'); }
  function triggerPost() {
    if (phase !== 'draft') return;
    const title = draftText.split('\n').find(l => l.trim()) ?? 'Voice note';
    const kindMap: Record<string, 'linkedin-post'|'twitter-single'> = {
      linkedin: 'linkedin-post', x: 'twitter-single',
      instagram: 'twitter-single', threads: 'twitter-single',
    };
    useVoiceStore.getState().addNote({
      id: crypto.randomUUID(),
      title: title.slice(0, 80),
      transcript: draftText,
      durationMs: 0,
      status: 'ready',
      createdAt: new Date().toISOString(),
      ...(savedPlatformId ? { lastGeneration: { kind: kindMap[savedPlatformId] ?? 'twitter-single', text: draftText, createdAt: new Date().toISOString() } } : {}),
    });
    setPhase('posting');
    // Orb collapses in place (scale→0, opacity→0) at draft position over 700ms
    setTimeout(() => {
      setPhase('idle');
      setIsPosted(true);
      setDraftText('');
      setSavedPlatformId(null);
    }, 700);
    // Hold 1.6 s on success text, then navigate home
    setTimeout(() => { setIsPosted(false); onComplete(); }, 700 + 1600);
  }

  function pickPlatform(id: string) {
    if (selId) return;
    const plat = PLATFORMS.find(p=>p.id===id)!;
    setSavedPlatformId(id);
    setSelId(id);
    setSelPhase('pulse');

    setTimeout(() => setSelPhase('travel'), 150);

    setTimeout(() => {
      setSelPhase('merge');
      setOrbAbsorb(true);
      setMergeColor(plat.mergeRgb);
    }, 150 + 820);

    // Merge flash ends — clear it but keep selId so platforms stay hidden during pill hold
    setTimeout(() => {
      setOrbAbsorb(false);
      setMergeColor(null);
      setDraftText(PLATFORM_DRAFTS[id] ?? '');
    }, 150 + 820 + 420);

    // 300 ms pill hold, then orb travels to bottom — aurora dims simultaneously
    setTimeout(() => {
      setPhase('draft');
      setSelPhase('none');
      setSelId(null);
    }, 150 + 820 + 420 + 300);
  }

  const isIdle          = phase === 'idle';
  const isDraft         = phase === 'draft';
  const isPlatform      = phase === 'platform';
  const isTravelingDown = selPhase === 'travel' || selPhase === 'merge';
  const orbTarget       = isTravelingDown ? ORB.draft
                        : (isPosted ? {...ORB.idle, top: '48%'} : ORB[phase]);

  return (
    <LayoutGroup>
      <div onClick={isIdle ? advance : undefined} className="onb-root"
        style={{position:'relative',width:'100%',height:'100%',overflow:'hidden',userSelect:'none',WebkitUserSelect:'none'}}
      >
        <style>{`
          @property --bg-a { syntax: '<angle>'; initial-value: 155deg; inherits: false; }
          @keyframes bg-drift { to { --bg-a: 205deg; } }
          .onb-root {
            background: linear-gradient(var(--bg-a), #0b0608 0%, #0f0810 55%, #09090f 100%);
            animation: bg-drift 22s linear infinite alternate;
          }
          .onb-draft-ta { caret-color: rgba(255,235,210,0.9); color: rgba(255,255,255,0.92); background:transparent; border:none; outline:none; resize:none; padding:0; margin:0; font-size:var(--text-body-lg); line-height:1.7; letter-spacing:0.01em; }
          .onb-draft-ta::selection { background: rgba(255,220,200,0.25); }
          @keyframes draft-caret-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
          .draft-caret { display:inline-block; width:1.5px; height:1.1em; background:rgba(255,235,210,0.9); vertical-align:text-bottom; margin-left:2px; border-radius:1px; animation:draft-caret-blink 1.2s step-end infinite; }
        `}</style>

        {/* ── Aurora ── */}
        <motion.div
          aria-hidden
          animate={{ opacity: (phase === 'draft' || phase === 'posting') ? 0.30 : 1 }}
          transition={{ duration: 0.6, ease: [0.4, 0.0, 0.6, 1.0] }}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {BLOBS.map((b,i) => (
            <motion.div key={i}
              animate={{x:b.xPath,y:b.yPath}}
              transition={{x:{duration:b.xDur,repeat:Infinity,ease:'easeInOut',repeatType:'loop'},y:{duration:b.yDur,repeat:Infinity,ease:'easeInOut',repeatType:'loop'}}}
              style={{position:'absolute',top:0,left:0,width:b.w,height:b.h,background:b.color,filter:'blur(90px)',willChange:'transform',pointerEvents:'none'}}
            />
          ))}
        </motion.div>

        {/* Grain */}
        <div aria-hidden style={{position:'absolute',inset:0,opacity:0.045,zIndex:1,pointerEvents:'none',backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,backgroundRepeat:'repeat',backgroundSize:'200px 200px'}} />

        {/* ── Orb — single gradient, mix-blend-mode:screen, no hard edge ── */}
        <motion.div
          onClick={(e)=>{ if(phase==='prompt'){e.stopPropagation();startRecording();} if(isDraft){e.stopPropagation();triggerPost();} }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{...orbTarget,...(orbAbsorb?{scale:[1,1.18,1]}:{})}}
          transition={
            phase === 'posting'   ? {duration:0.7,ease:[0.4,0,0.8,1]} :
            phase === 'recording' ? {duration:0.85,ease:[0.16,1,0.3,1]} :
            isTravelingDown       ? {type:'spring',stiffness:55,damping:18,mass:1} :
            SPRING
          }
          style={{position:'absolute',mixBlendMode:'screen',zIndex:12,cursor:(phase==='prompt'||isDraft)?'pointer':'default',pointerEvents:phase==='recording'?'none':'auto'}}
        >
          {/* Overall scale breath — idle and draft */}
          <motion.div
            animate={(isIdle||isDraft)?{scale:[1.04,0.96,1.04]}:{scale:1}}
            transition={(isIdle||isDraft)?{duration:4.5,repeat:Infinity,ease:EASE}:{duration:0.6}}
            style={{position:'absolute',inset:0}}
          >
            {/* Single RGB (255,235,210), alpha-only stops, oklch interpolation = no sRGB banding */}
            <motion.div aria-hidden
              animate={(isIdle||isDraft)?{opacity:[1.0,0.85,1.0]}:{opacity:1}}
              transition={(isIdle||isDraft)?{duration:3.2,repeat:Infinity,ease:EASE}:{duration:0.5}}
              style={{position:'absolute',inset:'-100px',background:'radial-gradient(80px circle at center, rgba(255,235,210,1) 0%, rgba(255,235,210,0.95) 8%, rgba(255,235,210,0.7) 18%, rgba(255,235,210,0.4) 32%, rgba(255,235,210,0.2) 50%, rgba(255,235,210,0.08) 70%, rgba(255,235,210,0.02) 85%, rgba(255,235,210,0) 100%)'}}

            />
            {/* Green disperse tint — blooms as orb dissolves into recording clouds */}
            <motion.div aria-hidden
              animate={phase === 'recording' ? {opacity: 1, scale: 1} : {opacity: 0, scale: 0.6}}
              transition={{duration: 0.7, ease: [0.16, 1, 0.3, 1]}}
              style={{position:'absolute', inset:0, background:'radial-gradient(circle, rgba(16,212,72,0.7) 0%, rgba(6,168,42,0.28) 48%, rgba(16,212,72,0) 80%)', pointerEvents:'none'}}
            />
            {/* Platform color merge flash */}
            {mergeColor && (
              <motion.div aria-hidden
                initial={{opacity:0.65}} animate={{opacity:0}} transition={{duration:0.42}}
                style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at center, rgba(${mergeColor},0.7) 0%, rgba(${mergeColor},0) 65%)`,pointerEvents:'none'}}
              />
            )}
          </motion.div>
        </motion.div>

        {/* ── Recording canvas ── */}
        <AnimatePresence>
          {phase==='recording' && (
            <motion.div key="rec" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.55}} style={{position:'absolute',inset:0,zIndex:20}}>
              <RecordingCanvas onStop={goToPlatform} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Platform light bulbs — circle SVG + circular halo, no mix-blend-mode ── */}
        {isPlatform && PLATFORMS.map((p, i) => {
          const isSelected  = selId === p.id;
          const isDimmed    = selId !== null && !isSelected;
          const isTraveling = isSelected && (selPhase === 'travel' || selPhase === 'merge');
          const isBreathing = !selId;
          const br = BREATH[i];
          const entranceDelay = 0.04 + i * 0.035;

          return (
            <div key={p.id}>
              <motion.div
                onClick={() => pickPlatform(p.id)}
                initial={{ opacity: 0, scale: 0.3, y: 40 }}
                animate={{
                  opacity: isDimmed ? 0 : (isTraveling ? 0 : 1),
                  scale:   isDimmed ? 0.7 : (isSelected && selPhase==='pulse' ? 1.15 : (isTraveling ? 0.35 : 1)),
                  y:       isDimmed ? 20  : (isTraveling ? '28vh' : 0),
                  x:       '0vw',
                  filter:  'saturate(100%)',
                }}
                transition={{
                  opacity: isDimmed ? {duration:0.25} : (isTraveling ? {duration:0.5} : {delay:entranceDelay,...ENT_SPRING}),
                  scale:   isSelected&&(selPhase==='travel'||selPhase==='pulse') ? {duration:selPhase==='pulse'?0.15:0.7,...SEL_SPRING} : (isDimmed ? {duration:0.25} : {delay:entranceDelay,...ENT_SPRING}),
                  y:       isSelected&&selPhase==='travel' ? {type:'spring',stiffness:55,damping:18,mass:1} : (isDimmed ? {duration:0.25} : {delay:entranceDelay,...ENT_SPRING}),
                }}
                style={{
                  position:'absolute', left:p.left, top:'60%',
                  marginLeft: -(BULB/2), marginTop: -(BULB/2),
                  width: BULB, height: BULB,
                  cursor: selId ? 'default' : 'pointer',
                  zIndex: 15,
                }}
              >
                {/* Breathing wrapper — scale + drift */}
                <motion.div
                  animate={isBreathing ? { scale: br.scaleKeys, y: [0,-4,0,4,0] } : { scale:1, y:0 }}
                  transition={{
                    scale: { duration:br.scalePeriod, repeat:isBreathing?Infinity:0, ease:EASE },
                    y: { duration:7, delay:br.driftOffset, repeat:isBreathing?Infinity:0, ease:'easeInOut' },
                  }}
                  style={{ position:'absolute', inset:0 }}
                >
                  {/* Outer halo — large soft cloud, fades fully transparent before the box edge */}
                  <motion.div
                    aria-hidden
                    initial={{ opacity:0, scale:0.5 }}
                    animate={{ opacity:1, scale:1 }}
                    transition={{ delay:entranceDelay+0.03, ...ENT_SPRING }}
                    style={{
                      position:'absolute',
                      left:'50%', top:'50%',
                      width: 140, height: 140,
                      marginLeft: -70, marginTop: -70,
                      borderRadius:'50%',
                      background: `radial-gradient(circle at 50% 50%, rgba(${p.glowRgb},0.32) 0%, rgba(${p.glowRgb},0.10) 38%, rgba(${p.glowRgb},0.03) 60%, rgba(${p.glowRgb},0) 80%)`,
                      filter:'blur(8px)',
                      pointerEvents:'none',
                    }}
                  />
                  {/* Cloud body — colored center, fades to transparent before reaching the round box edge */}
                  <div
                    aria-hidden
                    style={{
                      position:'absolute',
                      left:'50%', top:'50%',
                      width: 84, height: 84,
                      marginLeft: -42, marginTop: -42,
                      borderRadius:'50%',
                      background: `radial-gradient(circle at 50% 45%, ${p.bulbInner} 0%, ${p.bulbOuter} 35%, rgba(${p.glowRgb},0.30) 60%, rgba(${p.glowRgb},0) 88%)`,
                      filter:'blur(3px)',
                      pointerEvents:'none',
                    }}
                  />
                  {/* Logo — same 32×32 bounding box for all four platforms, centered */}
                  <div style={{
                    position:'absolute',
                    left:'50%', top:'50%',
                    width: 32, height: 32,
                    marginLeft: -16, marginTop: -16,
                    pointerEvents:'none',
                  }}>
                    <svg viewBox="0 0 32 32" width="32" height="32" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))' }}>
                      {PLATFORM_LOGO[p.id]}
                    </svg>
                  </div>
                </motion.div>
              </motion.div>

              {/* Label — separate element, never moves, only fades */}
              <motion.div
                initial={{ opacity:0 }}
                animate={{ opacity: selId ? 0 : 0.55 }}
                transition={{ delay: selId ? 0 : entranceDelay+0.04, duration: selId ? 0.25 : 0.28 }}
                style={{
                  position:'absolute', left:p.left, top:`calc(60% + ${LABEL_BELOW}px)`,
                  transform:'translateX(-50%)',
                  fontFamily:'var(--font-sans)', fontSize:'var(--text-caption)', fontWeight:400,
                  color:'rgba(255,255,255,1)', letterSpacing:'0.04em',
                  whiteSpace:'nowrap', pointerEvents:'none', zIndex:14,
                }}
              >
                {p.label}
              </motion.div>
            </div>
          );
        })}

        {/* ── Draft: full-bleed scrim for contrast (no edges, no card) ── */}
        <AnimatePresence>
          {isDraft && (
            <motion.div key="draft-scrim"
              initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              transition={{duration:0.5,ease:[0.4,0,0.6,1]}}
              style={{position:'absolute',inset:0,zIndex:9,pointerEvents:'none',background:'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.15) 100%)'}}
            />
          )}
        </AnimatePresence>

        {/* ── Draft text — no card, no border, text directly on scene ── */}
        <AnimatePresence>
          {isDraft && (
            <motion.div key="draft-content"
              initial={{opacity:0,y:28}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}} transition={SPRING}
              style={{position:'absolute',top:'14%',bottom:'13%',left:'6%',right:'6%',display:'flex',flexDirection:'column',zIndex:10,overflow:'hidden'}}
            >
              {isEditing ? (
                <textarea
                  autoFocus
                  className="onb-draft-ta"
                  value={draftText}
                  onChange={e => setDraftText(e.target.value)}
                  onBlur={() => setIsEditing(false)}
                  style={{flex:1,fontFamily:'var(--font-sans)',width:'100%'}}
                />
              ) : (
                <div
                  onClick={() => { if (typingDone) setIsEditing(true); }}
                  style={{flex:1,fontFamily:'var(--font-sans)',fontSize:'var(--text-body-lg)',lineHeight:1.7,letterSpacing:'0.01em',color:'rgba(255,255,255,0.92)',cursor:typingDone?'text':'default',overflowY:'auto'}}
                >
                  {renderDraftContent(draftText, typingDone ? draftText.length : displayedCharIdx)}
                  {typingDone && <span className="draft-caret" aria-hidden />}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── "Tap the orb to post" label — anchored under the draft orb ── */}
        <AnimatePresence>
          {isDraft && (
            <motion.div key="orb-label"
              initial={{opacity:0}} animate={{opacity:isEditing?0.2:0.4}} exit={{opacity:0}}
              transition={{duration:0.6,delay:isEditing?0:0.5}}
              style={{
                position:'absolute',
                top:'calc(88% + 40px)', // orb center 88% + half-height 28px + gap 12px
                left:0,right:0,
                textAlign:'center',
                fontFamily:'var(--font-sans)',fontSize:'var(--text-caption)',
                color:'rgba(255,255,255,1)',
                letterSpacing:'0.05em',
                pointerEvents:'none',
                zIndex:13,
              }}
            >tap to save to library</motion.div>
          )}
        </AnimatePresence>

        {/* ── Success screen ── */}
        <AnimatePresence>
          {isPosted && (
            <>
              <motion.div key="h-great"
                initial={{opacity:0,scale:0.92}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.96}}
                transition={{duration:0.5,ease:[0.4,0,0.2,1]}}
                style={{position:'absolute',top:'42%',left:0,right:0,textAlign:'center',fontFamily:'var(--font-sans)',fontSize:44,fontWeight:700,color:'rgba(255,255,255,0.94)',letterSpacing:'-0.02em',pointerEvents:'none',zIndex:20}}
              >Great work!</motion.div>
              <motion.div key="h-saved"
                initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}}
                transition={{duration:0.4,delay:0.3,ease:[0.4,0,0.2,1]}}
                style={{position:'absolute',top:'52%',left:0,right:0,textAlign:'center',fontFamily:'var(--font-sans)',fontSize:18,fontWeight:400,color:'rgba(255,255,255,0.6)',letterSpacing:'0.01em',pointerEvents:'none',zIndex:20}}
              >Saved to library.</motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Headlines ── */}
        <AnimatePresence mode="popLayout">
          {phase==='idle' && !isPosted && (
            <motion.div key="h-idle" layoutId="headline"
              initial={{opacity:0,y:20,scale:1.05}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20,scale:0.9}} transition={{duration:0.35,delay:0.12,ease:[0.4,0,0.2,1]}}
              style={{position:'absolute',top:'28%',left:0,right:0,textAlign:'center',fontFamily:'var(--font-sans)',fontSize:'var(--text-display-lg)',fontWeight:600,color:'rgba(255,255,255,0.92)',letterSpacing:'-0.02em',textShadow:'0 0 40px rgba(0,0,0,0.3)',pointerEvents:'none',zIndex:5}}
            >Let's write a post</motion.div>
          )}
          {phase==='prompt' && (
            <motion.div key="h-prompt"
              initial={{opacity:0,y:16,scale:1.04}} animate={{opacity:1,y:0,scale:1,letterSpacing:'-0.02em'}}
              exit={{opacity:0,scale:1.03,letterSpacing:'0.08em',transition:{duration:0.6,ease:[0.4,0,0.2,1]}}}
              transition={{duration:0.4,delay:0.15,ease:[0.4,0,0.2,1]}}
              style={{position:'absolute',top:'28%',left:0,right:0,textAlign:'center',fontFamily:'var(--font-sans)',fontSize:'var(--text-display-lg)',fontWeight:600,color:'rgba(255,255,255,0.92)',letterSpacing:'-0.02em',textShadow:'0 0 40px rgba(0,0,0,0.3)',pointerEvents:'none',zIndex:5}}
            >What's on your mind?</motion.div>
          )}
          {phase==='recording' && (
            <motion.div key="h-rec"
              initial={{opacity:0,scale:0.98}} animate={{opacity:1,scale:1,letterSpacing:'-0.02em'}}
              exit={{opacity:0,scale:1.03,letterSpacing:'0.08em',transition:{duration:0.55,ease:[0.4,0,0.2,1]}}}
              transition={{duration:0.7,delay:0.18,ease:[0.4,0,0.2,1]}}
              style={{position:'absolute',top:'28%',left:0,right:0,textAlign:'center',fontFamily:'var(--font-sans)',fontSize:'var(--text-display-lg)',fontWeight:600,color:'rgba(255,255,255,0.88)',letterSpacing:'-0.02em',textShadow:'0 0 40px rgba(0,0,0,0.3)',pointerEvents:'none',zIndex:5}}
            >Go ahead, I'm listening</motion.div>
          )}
          {phase==='platform' && (
            <motion.div key="h-platform"
              initial={{opacity:0,y:20,scale:1.05}} animate={{opacity:selId?0:0.85,y:0,scale:1}} exit={{opacity:0,y:-20,scale:0.9}} transition={{duration:0.35,delay:selId?0:0.15,ease:[0.4,0,0.2,1]}}
              style={{position:'absolute',top:'28%',left:0,right:0,textAlign:'center',fontFamily:'var(--font-sans)',fontSize:'var(--text-display-lg)',fontWeight:600,color:'rgba(255,255,255,0.92)',letterSpacing:'-0.02em',textShadow:'0 0 40px rgba(0,0,0,0.3)',pointerEvents:'none',zIndex:5}}
            >Where should this go?</motion.div>
          )}
          {isDraft && (
            <motion.div key="h-draft"
              initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-16}}
              transition={{duration:0.4,delay:0.9,ease:[0.4,0,0.2,1]}}
              style={{position:'absolute',top:'6%',left:0,right:0,textAlign:'center',fontFamily:'var(--font-sans)',fontSize:'var(--text-title-sm)',fontWeight:700,color:'rgba(255,255,255,0.88)',letterSpacing:'-0.02em',pointerEvents:'none',zIndex:5}}
            >Continue from where you left off</motion.div>
          )}
        </AnimatePresence>

        {/* ── Hints ── */}
        <AnimatePresence>
          {phase==='recording' && (
            <motion.div key="hint-stop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{delay:1.2,duration:0.8}}
              style={{position:'absolute',bottom:'10%',left:0,right:0,textAlign:'center',fontFamily:'var(--font-sans)',fontSize:'var(--text-caption)',color:'rgba(255,255,255,0.55)',letterSpacing:'0.05em',pointerEvents:'none',zIndex:5}}
            >tap anywhere to continue</motion.div>
          )}
        </AnimatePresence>

        {/* ── Back from recording — floating glass button, top-left, in app style ── */}
        <AnimatePresence>
          {phase==='recording' && (
            <motion.button
              key="back-from-recording"
              onClick={(e) => {
                e.stopPropagation();
                if (initialPhase === 'recording') onComplete();
                else setPhase('prompt');
              }}
              aria-label="Back"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              style={{
                position: 'absolute',
                top: 'calc(var(--space-3) + env(safe-area-inset-top, 0px))',
                left: 16,
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.85)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                zIndex: 30,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Skip — ghosted, bottom-right, 30% opacity ── */}
        <AnimatePresence>
          {isIdle && (
            <motion.button key="skip" initial={{opacity:0}} animate={{opacity:0.35}} exit={{opacity:0}} transition={{delay:1.0,duration:0.6}}
              onClick={(e)=>{e.stopPropagation();onComplete();}}
              style={{position:'absolute',bottom:28,right:24,background:'none',border:'none',fontFamily:'var(--font-sans)',fontSize:'var(--text-caption)',color:'rgba(255,255,255,1)',letterSpacing:'0.08em',cursor:'pointer',padding:'8px 0',zIndex:30}}
            >skip</motion.button>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
