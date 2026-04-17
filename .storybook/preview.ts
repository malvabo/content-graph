import type { Preview } from '@storybook/react-vite'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'Canvas',
      values: [
        { name: 'Canvas', value: '#F2EFE9' },
        { name: 'Surface', value: '#F7F5F1' },
        { name: 'Card', value: '#FFFFFF' },
        { name: 'Dark', value: '#111114' },
      ],
    },
    a11y: {
      test: 'todo'
    }
  },
};

export default preview;