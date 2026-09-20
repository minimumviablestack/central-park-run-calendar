# Park Run Calendar

A webapp to check for events in the Central Park to avoid running into a race you are not participating...

## Features

- Route planner: pick a target distance and get ranked loop suggestions on a schematic map of the park, with routes affected by today's events flagged
- View today's park events with special highlighting
- See upcoming events for the week, plus a 7-day strip with weather and AQI at a glance
- "Best window to run" suggestion combining event end times and hourly forecast
- Sunrise/sunset times and live weather integration from NWS
- Air Quality Index badge (Open-Meteo)
- Live traffic camera feed from NYC DOT
- Share button and calendar export (ICS / Google Calendar) for events
- Installable as a PWA (Add to Home Screen)
- Mobile-friendly interface with a clean, calendar-like design

## Getting Started

### Prerequisites

- Node.js (v22 or later)
- npm

### Installation

1. Clone the repository:
 ```
git clone https://github.com/minimumviablestack/central-park-run-calendar.git
cd central-park-run-calendar
```

2. Install dependencies:
```
npm install
```

3. (Optional) Set up environment variables for the crawler:
```
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

4. Start the development server:
```
npm start
```

5. Open your browser and go to `http://localhost:3000` to view the app.

## Event Crawler

The project includes two crawler scripts:

| Command | Description |
|---------|-------------|
| `npm run crawl` | Original crawler using LLM extraction |
| `npm run crawl:smart` | Smart crawler with NYC Open Data API + structured HTML parsing |

The smart crawler (`crawl:smart`) is recommended as it:
- Uses NYC Open Data API for official event data
- Parses structured HTML using microformats (no LLM needed for NYC Parks)
- Supports pagination (gets all 9+ pages of events)
- Falls back to LLM only for NYRR and NYCRUNS

## Deployment

Hosted on GitHub Pages via two workflows:

| Workflow | Trigger | What it does |
|----------|---------|---------------|
| `update-events.yml` | Weekly (Mondays 00:00 UTC) + manual | Crawls events, builds, deploys to `gh-pages` |
| `deploy-only.yml` | Manual | Builds and deploys without re-crawling |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.
