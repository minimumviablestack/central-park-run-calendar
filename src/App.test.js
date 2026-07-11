import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve('EVENT_NAME,DATE,START_TIME,END_TIME,LOCATION,DESCRIPTION,URL\n'),
      json: () => Promise.resolve({}),
    })
  );
});

test('renders the app tagline', async () => {
  render(<App />);
  expect(
    await screen.findByText(/should i run in central park today/i)
  ).toBeInTheDocument();
});
