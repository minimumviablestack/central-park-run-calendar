import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import WeekStrip from './WeekStrip';
import WeatherWidget from './WeatherWidget';

jest.mock('./AQIBadge', () => () => null);

const today = dayjs().format('YYYY-MM-DD');
const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

const period = (date, h, temperature) => ({
  startTime: dayjs(date).hour(h).minute(0).second(0).format(),
  temperature,
  isDaytime: h >= 6 && h < 18,
  shortForecast: 'Sunny',
  windSpeed: '5 mph',
  windDirection: 'W',
  probabilityOfPrecipitation: { value: 10 },
});

const forecast = [period(tomorrow, 6, 32), period(tomorrow, 9, 41), period(tomorrow, 15, 50)];

beforeEach(() => {
  localStorage.clear();
});

test('clicking a day tile shows its time-of-day breakdown', async () => {
  const events = [{ DATE: tomorrow, EVENT_NAME: 'Turkey Trot', START_TIME: '8:00 AM', END_TIME: '10:00 AM' }];
  render(<WeekStrip events={events} hourlyForecast={forecast} />);

  const tile = screen.getByRole('button', { name: /high 50°, low 32°, 1 park event/i });
  expect(tile).toHaveAttribute('aria-pressed', 'false');
  await userEvent.click(tile);
  expect(tile).toHaveAttribute('aria-pressed', 'true');

  expect(screen.getByText('Turkey Trot')).toBeInTheDocument();
  const parts = screen.getAllByRole('listitem');
  expect(parts.map((li) => within(li).getAllByText(/./)[0].textContent)).toEqual(['Early', 'Morning', 'Afternoon']);
  expect(screen.getByText('H 50° · L 32°')).toBeInTheDocument();
});

test('°C toggle in the weather panel converts the week strip', async () => {
  render(
    <>
      <WeatherWidget weather={forecast[0]} weatherLoading={false} />
      <WeekStrip events={[]} hourlyForecast={forecast} />
    </>
  );
  expect(screen.getByRole('button', { name: /high 50°, low 32°/i })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: '°C' }));

  expect(screen.getByRole('button', { name: /high 10°, low 0°/i })).toBeInTheDocument();

  // Units live in a shared module store; restore so other tests see °F.
  await userEvent.click(screen.getByRole('button', { name: '°F' }));
});

test('shows a placeholder when a day has no forecast', () => {
  render(<WeekStrip events={[]} hourlyForecast={[]} />);
  expect(screen.getByText(/hourly forecast not available yet/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: new RegExp(`^Today, ${dayjs(today).format('MMMM D')}, no forecast yet`) })).toHaveAttribute('aria-pressed', 'true');
});
