# Park Run Calendar - Project Context

## Project Overview
**Park Run Calendar** is a web application designed to help runners in Central Park (New York City) plan their runs by avoiding race events. It aggregates event data from multiple sources (NYC Parks, NYRR, NYC Runs) and displays them in a user-friendly calendar interface.

### Tech Stack
*   **Frontend:** React, Material UI (MUI), React Router
*   **Data Processing:** Node.js, Puppeteer (scraping), Cheerio, OpenAI API (data extraction), CSV processing
*   **Deployment:** GitHub Pages

## Architecture & Data Flow
1.  **Data Collection (`scripts/crawlEvents.js`):**
    *   Scrapes event websites using Puppeteer to handle dynamic content.
    *   Uses OpenAI's GPT-4o model to intelligently extract structured event data (name, date, time, location) from raw HTML/text.
    *   Filters events specifically for "Central Park" and "Running" categories.
    *   Deduplicates and saves data to `data/events.csv`.
2.  **Frontend (`src/`):**
    *   React application that likely fetches or imports the `events.csv` file.
    *   Displays events in a list/calendar view.
    *   Key components: `EventList.js` (main display), `About.js`.
3.  **Build Process:**
    *   The build script (`npm run build`) compiles the React app and copies the `data/` directory to the `build/` output, ensuring the CSV data is available to the static site.

## Key Files
*   `src/App.js`: Main React component setting up routing and theme.
*   `scripts/crawlEvents.js`: Core logic for scraping and parsing event data. Requires `OPENAI_API_KEY`.
*   `data/events.csv`: The "database" for the application, storing structured event data.
*   `.github/workflows/`: CI/CD pipelines for updating events and deploying to GitHub Pages.

## Development Workflows

### Prerequisites
*   Node.js (v22+)
*   npm
*   `OPENAI_API_KEY` (for running the crawler locally)

### Common Commands
*   **Start Dev Server:** `npm start` (Runs the React app at http://localhost:3000)
*   **Update Event Data (Original):** `npm run crawl` (Runs the original scraper. **Requires .env file with OPENAI_API_KEY**)
*   **Update Event Data (Smart):** `npm run crawl:smart` (Runs the smart scraper with NYC Open Data API + structured HTML parsing. OpenAI key optional.)
*   **Build for Production:** `npm run build` (Creates static assets in `build/`)
*   **Deploy:** `npm run deploy` (Deploys `build/` folder to GitHub Pages)

### Environment Variables
Create a `.env` file in the root directory for local development if you intend to run the scraper:
```
OPENAI_API_KEY=your_api_key_here
```

## Conventions
*   **Styling:** Material UI (MUI) is the primary styling solution.
*   **Data Source:** The app relies on a static CSV file (`events.csv`) rather than a live backend API. This suggests a "static site generator" approach where data is updated periodically via scripts/CI.
*   **Testing:** Uses `react-testing-library` (standard Create React App setup).
