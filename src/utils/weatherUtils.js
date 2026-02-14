export const fToC = (f) => Math.round((f - 32) * 5 / 9);

export const mphToKph = (mph) => {
  if (typeof mph !== 'string') return `${Math.round(mph * 1.60934)} km/h`;
  
  // Replaces all numbers in the string (e.g. "5 to 10") with converted km/h values
  return mph.replace(/(\d+)/g, (match) => Math.round(parseInt(match) * 1.60934))
            .replace('mph', 'km/h');
};
