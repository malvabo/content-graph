# up200 Design System

## 1. Design Tokens

### 1.1 Color Tokens

> Source of truth: [`src/tokens.css`](src/tokens.css). Values below are the **light-mode** defaults; dark-mode overrides live in `:root.dark` in the same file. The older `--cg-*` names are kept as aliases mapped to the semantic `--color-*` tokens — prefer the semantic ones in new code.

#### Primitives (palette)
Raw values; avoid referencing directly — use the semantic tokens below.

| Token | Value |
|-------|-------|
| `--p-white` | `#FFFFFF` |
| `--p-black` | `#1A1A1A` |
| `--p-green-500` / `-600` / `-700` | `#0DBF5A` / `#0BAF52` / `#0A9F4A` |
| `--p-red-500` / `-600` / `-700` | `#C93030` / `#B52828` / `#A02020` |
| `--p-amber-500` / `-600` | `#F0D8A0` / `#f59e0b` |
| `--p-neutral-50` / `-100` / `-200` / `-300` | `#F8F9FB` / `#F4F5F7` / `#F1F2F5` / `#E0E0E0` |
| `--p-neutral-350` / `-400` / `-450` / `-500` | `#E3E3E3` / `#D0D0D0` / `#C8C8C8` / `#A3A3A3` |
| `--p-neutral-600` / `-650` / `-700` / `-750` | `#8A8A8A` / `#737373` / `#6D6D6D` / `#545454` |
| `--p-neutral-800` / `-900` / `-950` | `#525252` / `#1A1A1A` / `#1a1a1f` |

#### Surfaces
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-bg` | `#fbfbf9` | `#0f0f0f` | Page/canvas background |
| `--color-bg-surface` | `#F4F5F7` | `#161619` | Elevated surface, hover states |
| `--color-bg-card` | `#FFFFFF` | `#1a1a1e` | Cards, nodes, inputs |
| `--color-bg-popover` | `#F4F5F7` | `#1a1a1e` | Floating panels, menus |
| `--color-bg-subtle` | `#F8F9FB` | `#131316` | Subtle fills |
| `--color-bg-dark` | `#1a1a1f` | `#0a0a0c` | Dark backdrops |
| `--color-bg-hover` | `#EBEBEB` | `#222228` | Generic hover |

#### Text
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-text-primary` | `#1A1A1A` | `#e8e6e3` | Headings, body |
| `--color-text-secondary` | `#545454` | `#a8a6a2` | Secondary copy |
| `--color-text-tertiary` | `#6D6D6D` | `#908e85` | Muted / labels |
| `--color-text-disabled` | `#6A6A6A` | `#78766e` | Disabled state |
| `--color-text-placeholder` | `#737373` | `#8c8a80` | Input placeholders |
| `--color-text-inverse` | — | `#111114` | Text on dark buttons |

#### Borders
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-border-default` | `#E5E7EB` | `#2a2a30` | Standard borders |
| `--color-border-subtle` | `#ECEDF0` | `#242428` | Hairline dividers |
| `--color-border-strong` | `#D1D5DB` | `#4a4a54` | Hover/active, focus rings |
| `--color-border-handle` | `#94a3b8` | `#4a4a54` | React Flow handles |

#### Interactive
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-interactive-default` | `#FFFFFF` | `#1e1e24` | Default button bg |
| `--color-interactive-hover` | `#F4F5F7` | `#262630` | Ghost button hover |
| `--color-interactive-active` | `#E8E8E8` | `#2e2e36` | Pressed state |
| `--color-interactive-focus` | `#0DBF5A` | `#0DBF5A` | Focus rings |

#### Accent
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-accent` | `#0DBF5A` | `#0DBF5A` | Primary/focus, edge flow |
| `--color-accent-hover` | `#0BAF52` | `#0BAF52` | Accent hover |
| `--color-accent-active` | `#0A9F4A` | `#0A9F4A` | Accent pressed |
| `--color-accent-subtle` | `#0A5C2A` | `#4ade80` | Link/underline text |

#### Semantic (success / warning / danger)
| Token | Light | Dark |
|-------|-------|------|
| `--color-success-bg` / `-border` / `-text` | `#F8F9FB` / `#DCDCDC` / `#525252` | `#142418` / `#1e3a24` / `#80d0a0` |
| `--color-warning-bg` / `-border` / `-text` | `#FEF8E8` / `#F0D8A0` / `#6A4A10` | `#2a2616` / `#4a3a16` / `#f0c860` |
| `--color-danger` / `-hover` / `-active` | `#C93030` / `#B52828` / `#A02020` | `#f06060` / `#e04040` / `#d03030` |
| `--color-danger-bg` / `-border` / `-text` | `#FEF4F4` / `#ECC0C0` / `#A83030` | `#2a1616` / `#4a2424` / `#f08080` |

#### Navigation
| Token | Light | Dark |
|-------|-------|------|
| `--color-nav-bg` | `#eef0eb` | `#1c1c1d` |
| `--color-nav-text` | `#000000` | `#a4a4ad` |
| `--color-nav-item-active` | `#f8fafc` | `#26262a` |
| `--color-nav-item-hover` | `rgba(220,228,240,.55)` | `rgba(230,230,230,.06)` |

#### Node Badge Colors
Light mode values; dark mode mirrors with `--color-badge-*-bg/-text` overrides.

| Category | Background | Text |
|----------|-----------|------|
| Source | `#282828` | `#c0c0c0` |
| Generate | `#222822` | `#a8c8a0` |
| Output | `#282828` | `#c0c0a0` |
| Transform | `#282428` | `#c0a8c0` |

#### Status Colors
Dot colors come from `--p-status-*` primitives; pills reuse the semantic bg/border.

| Status | Dot | Pill |
|--------|-----|------|
| Idle | `#C8C8C8` | `--color-bg-surface` |
| Running | `#F0D8A0` | `--color-warning-bg` / `-border` |
| Complete | `#0DBF5A` | `--color-success-bg` / `-border` |
| Error | `#C93030` | `--color-danger-bg` / `-border` |
| Warning | `#F0D8A0` | `--color-warning-bg` / `-border` |

---

### 1.2 Typography Tokens

#### Font Families
| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | `'Graphik', 'Graphik Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif` | All UI text — Graphik primary, system stack fallback |
| `--font-mono` | `'IBM Plex Mono', ui-monospace, monospace` | Tags, labels, logo, code |

#### Type Scale
| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| `heading` | 16px | 500 | 22px | Modal titles |
| `body` | 15px | 400 | 1.8 | Modal body, voice text |
| `ui` | 14px | 500 | 20px | Buttons, node titles, inputs |
| `ui-body` | 14px | 400 | 1.75 | Node output text |
| `small` | 12px | 500 | 16px | Palette subtitles, category labels |
| `tag` | 11px | 500 | 1 | Field labels (mono), tags |
| `micro` | 10px | — | 1.3 | Carousel slide numbers |

#### Tag Style (mono labels)
```
font: 500 11px/1 var(--font-mono)
color: #6d6d6d
letter-spacing: 0.3em
text-transform: uppercase
```

---

### 1.3 Spacing Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight gaps (gap-1) |
| `space-1.5` | 6px | Button gaps, small margins |
| `space-2` | 8px | Padding-xs, icon gaps |
| `space-2.5` | 10px | Nav item gaps |
| `space-3` | 12px | Palette item padding, button padding |
| `space-4` | 16px | Node padding, section padding |
| `space-5` | 20px | Popover padding |
| `space-6` | 24px | Modal padding |
| `space-8` | 32px | Large section spacing |

---

### 1.4 Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 5px | Micro buttons |
| `radius-md` | 8px | Small buttons, badges |
| `radius-lg` | 10px | Default buttons |
| `radius-xl` | 12px | Nodes, modals |
| `radius-2xl` | 16px | Floating panels, popovers |
| `radius-full` | 100px | Pills, status dots |

---

### 1.5 Shadow Tokens

| Name | Value | Usage |
|------|-------|-------|
| `shadow-sm` | `0 2px 12px rgba(0,0,0,0.08)` | Floating button |
| `shadow-md` | `0 8px 24px rgba(0,0,0,0.08)` | Dropdowns |
| `shadow-lg` | `0 8px 32px rgba(0,0,0,0.08)` | Floating panels |
| `shadow-xl` | `0 8px 32px rgba(0,0,0,0.12)` | Modals |
| `shadow-node` | `0 8px 24px rgba(0,0,0,0.1)` | Selected node |
| `shadow-glow` | `0 0 16px rgba(13,191,90,0.2)` | Run button hover |

---

### 1.6 Animation Tokens

| Name | Duration | Easing | Usage |
|------|----------|--------|-------|
| `transition-fast` | 80ms | ease | Button press scale |
| `transition-base` | 100ms | ease | Background, border, color |
| `transition-medium` | 150ms | ease | Opacity, spotlight |
| `transition-slow` | 200ms | ease | Node selection, dimming |
| `transition-enter` | 300ms | ease | Gradient border fade |
| `pulse` | 1.2s | ease-in-out | Running status dot |
| `done-pulse` | 0.5s | ease-out | Complete status dot |
| `border-rotate` | 3s | linear | Run button gradient |
| `flow-dash` | 0.6s | linear | Edge flow animation |
| `wave-cycle` | 10s | bezier(smoothstep) | Background wave |
| `btn-spin` | 0.65s | linear | Loading spinner |

---

## 2. Components

### 2.1 Buttons

#### Size Variants
| Class | Height | Padding | Radius |
|-------|--------|---------|--------|
| `.btn-xs` | 24px | 0 8px | 8px |
| `.btn-sm` | 28px | 0 10px | 8px |
| `.btn` | 32px | 0 12px | 10px |
| `.btn-lg` | 36px | 0 14px | 10px |

#### Style Variants
| Class | Background | Border | Text |
|-------|-----------|--------|------|
| `.btn-primary` | `#fff` | `var(--cg-border)` | `var(--cg-ink)` |
| `.btn-outline` | `#fff` | `var(--cg-border)` | `var(--cg-ink)` |
| `.btn-ghost` | transparent | none | `var(--cg-ink)` |
| `.btn-tonal` | `var(--cg-green-lt)` | none | `#0A5C2A` |
| `.btn-destructive` | `var(--cg-red)` | none | `#fff` |
| `.btn-micro` | transparent | `var(--cg-border)` | `#4A6A52` |
| `.btn-pill` | `var(--cg-surface)` | transparent | `#4A6A52` |
| `.btn-link` | transparent | none | `#0A5C2A` |
| `.btn-run` | `#fff` | rotating gradient | `var(--cg-ink)` |

#### Icon Buttons
| Class | Size |
|-------|------|
| `.btn-icon-xs` | 24×24 |
| `.btn-icon-sm` | 28×28 |
| `.btn-icon` | 32×32 |
| `.btn-icon-lg` | 36×36 |

#### States
- **Hover**: background shifts to surface/canvas
- **Active**: `transform: scale(0.975)`
- **Disabled**: `opacity: 0.5`, no pointer events
- **Loading**: text transparent, spinner pseudo-element
- **Focus**: `outline: 2px solid var(--cg-green)`, offset 2px

---

### 2.2 Floating Panels

Shared style for all popovers/floating UI:
```
background: #F7F5F1
border: 1px solid #e6e3dd
border-radius: 16px
box-shadow: 0 8px 32px rgba(0,0,0,0.08)
```

#### Instances
| Panel | Width | Max Height | Position |
|-------|-------|-----------|----------|
| Config Panel | 280px | calc(100% - 24px) | top-3 right-3 |
| Node Palette | 280px | 420px | bottom-4 left-4 (above + button) |
| Select Dropdown | 100% of parent | 200px | below trigger |
| AI Edit Popover | 240px | auto | above selection |

---

### 2.3 Nodes

#### Container
```
width: 480px
border-radius: 12px
padding: 14px 16px
background: var(--cg-card)
border: 1px solid var(--cg-border)
```

#### States
| State | Border | Shadow |
|-------|--------|--------|
| Default | `1px solid var(--cg-border)` | none |
| Selected | `2px solid var(--cg-green)` | `0 8px 24px rgba(0,0,0,0.1)` |
| Error | `1px solid #E8BABA` | none |
| Dimmed (incompatible) | default | none, `opacity: 0.35` |

#### Node Badge
```
width: 26px, height: 26px
border-radius: 8px (rounded-md)
content: SVG icon (16×16)
```

#### Status Pill
```
height: 20px
border-radius: 100px
font: 500 14px var(--font-sans)
gap: 5px (dot + text)
dot: 6×6px circle with status color
```

#### Generate Node Content Area
```
height: 130px
overflow: hidden
```

---

### 2.4 Modals

#### Text Output Modal
```
max-width: 780px
max-height: 85vh
background: #F7F5F1
border: 1px solid #e6e3dd
border-radius: 16px
```
Features: AI Magic button, Edit/Preview toggle, Copy, Download

#### Image Modal (wide)
```
max-width: 1100px
max-height: 90vh
Split: dark left (image) + light right (details 320px)
```
Features: Dimensions, Model, Prompt, Regenerate, Copy, Download

---

### 2.5 Navigation

#### Icon Nav (left sidebar)
```
width: 64px
background: var(--cg-card)
border-right: 1px solid var(--cg-border)
gap: 10px between items
```

#### Nav Item
```
padding: 8px vertical
border-radius: 8px
icon: 18×18 SVG
label: 500 10px/1 var(--font-sans), letter-spacing: 0.03em
active: background var(--cg-green-lt), color #0A5C2A
```

---

### 2.6 Form Controls

#### Select (custom dropdown)
```
height: 32px
border-radius: 8px
border: 1px solid var(--cg-border)
background: #fff
font: 14px var(--font-sans)
chevron: 12×12 SVG, opacity 0.4
```

#### Text Input
```
height: 32px
border-radius: 8px
border: 1px solid var(--cg-border)
focus: border-color var(--cg-green)
```

#### Textarea
```
min-height: varies (60-120px)
border-radius: 8px
border: 1px solid var(--cg-border)
font: 14px/relaxed var(--font-sans)
```

#### Toggle
```
width: 32px, height: 18px
border-radius: full
on: #4f46e5 (note: should be var(--cg-green))
off: #d1d5db
thumb: 14×14 white circle
```

#### Stepper
```
buttons: 24×24, border, rounded
value: 14px medium, centered
label: 11px #78716c
```

---

### 2.7 Canvas Elements

#### Background Dots
```
variant: dots
gap: 14px
size: 1.5px radius
color: #D5D0C8
```

#### Cursor Spotlight
```
160×160px div
radial-gradient with rgba(0,0,0,0.12)
mix-blend-mode: color-burn
follows cursor via transform
```

#### Wave Overlay (Run All)
```
Panel inside ReactFlow, z-index: 1
dots: 14px gap, 1.3px radius
color: rgba(13,191,90, 0.35 peak)
band: 250px wide, smoothstep easing
cycle: 10 seconds
min display: 5 seconds
```

#### Edge Styles
```
default: stroke #D5D0C8, width 1.5, dash "5 4"
animated (running): stroke var(--cg-green), width 2, flow-dash animation
```

---

### 2.8 Floating Action Button

```
width: 48px, height: 48px
border-radius: 16px
background: rgba(255,255,255,0.85)
backdrop-filter: blur(12px)
border: 1px solid var(--cg-border)
icon: "+" at 26px, weight 500
position: absolute bottom-4 left-4
```

---

### 2.9 AI Edit Popover

#### Sparkle Trigger
```
28×28px rounded-lg
hover: var(--cg-surface) background
icon: 16×16 sparkle SVG, stroke var(--cg-green)
```

#### Edit Panel
```
width: 240px
sections: prompt input + send button, quick actions
quick actions: btn-xs btn-outline ("✨ More engaging", "↕ Expand", "⇕ Condense")
```

#### Preview State
```
edited text preview in var(--cg-surface) rounded box
actions: "↩ Revert" (outline) + "✓ Accept" (primary)
```

---

## 3. Layout

### 3.1 App Shell
```
height: 100vh
flex column
├── Toolbar (absolute, workflow only)
└── flex row
    ├── IconNav (64px fixed)
    └── Content area (flex-1)
        ├── Workflow: Canvas + floating panels
        ├── Voice: Full shader background
        └── ScriptSense: iframe
```

### 3.2 Workflow Canvas
```
position: relative, flex-1
├── Background (React Flow SVG dots)
├── ReactFlow (nodes, edges, controls)
│   └── RunWaveOverlay (Panel, z-index 1)
├── Cursor Spotlight (absolute div)
├── ConfigPanel (absolute top-3 right-3)
├── NodePalette (absolute bottom-4 left-4)
├── CanvasToolbar (absolute top-0)
├── EmptyCanvasOverlay (centered, z-10)
└── NodeSpotlight (absolute, on double-click)
```

---

## 4. Iconography

All icons are inline SVGs at 16×16 or 18×18, stroke-based, 1.5px stroke width.

### Node Icons
| Node | Icon Description |
|------|-----------------|
| Text Source | Document with text lines |
| File Source | Document with upload arrow |
| Image Source | Landscape with circle |
| LinkedIn Post | Profile + connections |
| Twitter Thread | List lines |
| Twitter Single | Chat bubble |
| IG Carousel | Grid squares |
| Blog Article | Pen/edit |
| Newsletter | Envelope |
| Infographic | Chart/graph line |
| Quote Card | Quotation marks |
| Image Prompt | Image with sparkle |
| Export | Download arrow |
| Refine | Moon/polish |

### UI Icons
| Icon | Size | Usage |
|------|------|-------|
| Sparkle | 16×16 | AI edit trigger |
| Trash | 14×14 | Delete node (config panel) |
| Chevron | 12×12 | Dropdown indicator |
| Close (✕) | 16-18px | Modal/panel close |
| Plus (+) | 26px | FAB add node |
