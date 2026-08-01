import { act, renderHook } from '@testing-library/react';
import useRouteAnimation from './useRouteAnimation';

const PATH = [
  [40.77, -73.97],
  [40.78, -73.96],
  [40.79, -73.95],
];

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('starts at progress 0 with only the first point', () => {
  const { result } = renderHook(() => useRouteAnimation(PATH, 1000));
  expect(result.current.progress).toBe(0);
  expect(result.current.animatedPath).toEqual([PATH[0]]);
});

test('reaches progress 1 and the full path once duration elapses', () => {
  const { result } = renderHook(() => useRouteAnimation(PATH, 1000));
  act(() => {
    jest.advanceTimersByTime(1100);
  });
  expect(result.current.progress).toBe(1);
  expect(result.current.animatedPath).toEqual(PATH);
});

test('empty path yields empty animatedPath and progress 0', () => {
  const { result } = renderHook(() => useRouteAnimation([], 1000));
  expect(result.current.progress).toBe(0);
  expect(result.current.animatedPath).toEqual([]);
});

test('restarts animation from 0 when the path reference changes', () => {
  const { result, rerender } = renderHook(({ path }) => useRouteAnimation(path, 1000), {
    initialProps: { path: PATH },
  });
  act(() => {
    jest.advanceTimersByTime(1100);
  });
  expect(result.current.progress).toBe(1);

  const NEW_PATH = [
    [40.8, -73.94],
    [40.81, -73.93],
  ];
  rerender({ path: NEW_PATH });
  expect(result.current.progress).toBe(0);
});
