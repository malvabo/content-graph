import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../index.css';
import { ImageModal, ModalShell, ModalHeader, ModalFooter } from '../components/modals/Modals';
import ContentModal from '../components/modals/ContentModal';
const sampleText = 'This is what nobody talks about.\n\nAfter diving deep into this topic, here are the 3 things that stood out:\n\n1. The core insight challenges conventional thinking.\n\n2. The implications go far beyond what most people realize.\n\n3. The practical takeaway: start small, iterate fast.';
function TextTrigger() { const [o, setO] = useState(false); return <><button className="btn btn-primary" onClick={() => setO(true)}>Open Text Modal</button>{o && <ContentModal subtype="linkedin-post" title="LinkedIn Post" text={sampleText} onClose={() => setO(false)} />}</>; }
function ImageTrigger() { const [o, setO] = useState(false); return <><button className="btn btn-primary" onClick={() => setO(true)}>Open Image Modal</button>{o && <ImageModal src={'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect fill="var(--color-bg-surface)" width="1024" height="1024"/></svg>')} prompt="A cinematic photograph of mountains" onClose={() => setO(false)} />}</>; }
function ShellTrigger() { const [o, setO] = useState(false); return <><button className="btn btn-primary" onClick={() => setO(true)}>Open Shell</button>{o && <ModalShell onClose={() => setO(false)}><ModalHeader title="Custom Modal" subtitle="Composable shell" onClose={() => setO(false)} /><div style={{ padding: 'var(--space-6)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>Custom content.</div><ModalFooter><button className="btn-xs btn-outline" onClick={() => setO(false)}>Cancel</button><div style={{ flex: 1 }} /><button className="btn-xs btn-primary" onClick={() => setO(false)}>Confirm</button></ModalFooter></ModalShell>}</>; }
const meta: Meta = { title: 'Components/Surfaces/Modal', component: TextTrigger, tags: ['autodocs'] };
export default meta;
export const TextOutput: StoryObj = { render: () => <TextTrigger /> };
export const ImageWide: StoryObj = { name: 'Image Wide', render: () => <ImageTrigger /> };
export const ComposableShell: StoryObj = { name: 'Composable Shell', render: () => <ShellTrigger /> };
