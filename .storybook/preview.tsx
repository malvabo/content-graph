import type { Preview } from '@storybook/react-vite';
import '../src/tokens.css';
import '../src/index.css';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color mode',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || 'light';
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.body.style.overflow = 'auto';
      return (
        <div style={{ background: 'var(--color-bg)', padding: 24 }}>
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
    a11y: { test: 'todo' },
  },
};

export default preview;
