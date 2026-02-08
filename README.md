# Park Run Calendar

A webapp to check for events in the Central Park to avoid running into a race you are not participating...

## Features

- View today's park events with special highlighting
- See upcoming events for the week
- Mobile-friendly interface with a clean, calendar-like design
- Live weather integration from NWS
- Live traffic camera feed from NYC DOT

## Getting Started

### Prerequisites

- Node.js (v22 or later)
- npm

### Installation

1. Clone the repository:
 ```
git clone https://github.com/minimumviablestack/park-run-calendar.git
cd park-run-calendar
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

## Deployment Options

This project supports multiple hosting platforms:

| Platform | Workflow | Requirements |
|----------|----------|--------------|
| GitHub Pages | `deploy-only.yml` | Public repo |
| Netlify | `deploy-netlify.yml` | `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` |
| Cloudflare Pages | `deploy-cloudflare.yml` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.
