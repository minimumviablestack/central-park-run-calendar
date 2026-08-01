import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventList from './EventList';

jest.mock('./ParkMap', () => () => <div data-testid="mock-park-map" />);

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve('EVENT_NAME,DATE,START_TIME,END_TIME,LOCATION,DESCRIPTION,URL\n'),
      json: () => Promise.resolve({}),
    })
  );
});

afterEach(() => {
  delete window.matchMedia;
});

function mockIsMobile(matches) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

test('desktop shows Plan Your Route without needing a tab click', async () => {
  mockIsMobile(false);
  render(
    <MemoryRouter>
      <EventList />
    </MemoryRouter>
  );
  expect(await screen.findByText(/plan your route/i)).toBeInTheDocument();
});

test('mobile hides Plan Your Route until the Plan tab is selected', async () => {
  mockIsMobile(true);
  render(
    <MemoryRouter>
      <EventList />
    </MemoryRouter>
  );
  await screen.findByText(/should i run in central park today/i);
  expect(screen.queryByText(/plan your route/i)).not.toBeInTheDocument();
});
