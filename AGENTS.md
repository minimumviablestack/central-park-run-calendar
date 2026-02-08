# AI Agent Guidelines - Central Park Run Calendar

This document provides comprehensive guidelines and context for AI coding agents working on the Central Park Run Calendar project. Following these instructions ensures consistency, maintainability, and alignment with the project's architectural goals.

---

## 1. Project Context

The **Central Park Run Calendar** is a specialized web application designed to help runners in New York City navigate Central Park by providing a clear schedule of events, races, and gatherings that might impact their running routes.

### Core Technology Stack
- **Frontend Framework**: React 19
- **UI Library**: Material UI (MUI) v6
- **Data Storage**: Static CSV file (`data/events.csv`)
- **Data Collection**: Node.js crawler (`scripts/crawlEvents.js`) using Puppeteer and OpenAI GPT-4o
- **Deployment**: GitHub Pages (Static Site Hosting)

### Key Architectural Principles
- **Strictly Static**: This application has **no backend, no server, and no database**. All data is baked into the build or fetched as a static asset.
- **Data-Driven**: The UI is a reflection of the `events.csv` file. Any changes to the data must happen through the crawler or manual CSV edits.
- **Mobile First**: Runners often check the calendar on their phones; the UI must be highly responsive and touch-friendly.

---

## 2. Commands

Use the following commands for development, testing, and data management:

| Command | Description |
| :--- | :--- |
| `npm start` | Starts the local development server (React Scripts). |
| `npm test` | Runs the full test suite using Jest and React Testing Library. |
| `npm test -- <path>` | Runs tests for a specific file (e.g., `npm test -- src/App.test.js`). |
| `npm run crawl` | Executes the event crawler. Requires `OPENAI_API_KEY` in `.env`. |
| `npm run build` | Creates a production build. **Note**: This also copies the `data/` directory. |
| `npm run deploy` | Deploys the current `build/` directory to GitHub Pages. |

---

## 3. Code Style & Conventions

Adhering to these styles ensures that AI-generated code blends seamlessly with the existing codebase.

### Formatting & Syntax
- **Indentation**: 2 spaces.
- **Semicolons**: Always use semicolons.
- **Strings**: Use single quotes (`'`) for JavaScript strings; use double quotes (`"`) for JSX attributes.
- **Trailing Commas**: Use them where supported (ES6+).

### Naming Conventions
- **React Components**: `PascalCase` (e.g., `EventCard.js`, `CalendarView.js`).
- **Functions & Variables**: `camelCase` (e.g., `fetchEvents`, `isEventToday`).
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_EVENTS_DISPLAY`, `API_ENDPOINT`).
- **Files**: Match the component name or use `kebab-case` for utility scripts.

### Import Organization
Follow this specific order for imports:
1. React and core React hooks.
2. Third-party libraries (Material UI, `dayjs`, `papaparse`, etc.).
3. Local components.
4. Local hooks and utilities.
5. Assets and styles (CSS/Images).

### Scripting Style
- **Node.js Scripts**: Use `require()` for module loading in `scripts/`.
- **React Components**: Use ES6 `import`/`export` syntax.
- **Async Code**: Prefer `async/await` over raw Promises. Always wrap in `try...catch` blocks.

### Styling & UI
- **MUI First**: Always prefer Material UI components over custom HTML/CSS.
- **Custom Styles**: Use the MUI `sx` prop for small adjustments. For complex styling, use Emotion's `styled` utility.
- **Theming**: Respect the project's MUI theme defined in `src/theme.js` (if applicable).

### Date & Data Handling
- **Dates**: Use `dayjs` for all date manipulations, formatting, and comparisons.
- **CSV Parsing**: Use `papaparse` for reading and parsing the `events.csv` file in the frontend.

---

## 4. AI Instructions (Critical)

When generating code or suggesting changes, AI agents **must** follow these constraints:

### Architecture Constraints
- **No Backend**: Never suggest adding a backend server, Express API, or database (SQL/NoSQL). The project is intentionally a static site.
- **Static Data Flow**: The flow is: `Crawler Script` -> `data/events.csv` -> `React App`. Do not attempt to bypass this flow or introduce live API calls for event data unless explicitly requested.

### UI & Component Guidelines
- **MUI Consistency**: Before creating a custom component, check the Material UI documentation. If a standard MUI component exists (e.g., `Card`, `List`, `Dialog`), use it.
- **Accessibility**: Ensure all UI elements have proper ARIA labels and are keyboard-navigable. Use MUI's built-in accessibility features.
- **Responsive Design**: Test all UI changes on mobile viewports. Use MUI's `Grid` and `Box` components for layout.

### Data Integrity
- **CSV Format**: Ensure any manual or scripted changes to `data/events.csv` maintain the existing column structure and date formats.
- **Crawler Safety**: When modifying `scripts/crawlEvents.js`, ensure that Puppeteer instances are properly closed and OpenAI API usage is optimized to avoid unnecessary costs.
- **Validation**: Always validate data parsed from CSV before passing it to React components to prevent runtime crashes.

### Build & Deployment
- **Data Persistence**: Any modifications to the build process must ensure that the `data/` directory is correctly copied to the `build/` folder. The app will fail if the CSV is missing in production.
- **GitHub Pages**: Remember that the app is hosted at a subpath (if applicable). Use relative paths for assets.

### Context Awareness
- **Deep Context**: Always refer to `GEMINI.md` for detailed technical history, specific implementation details, and project evolution.
- **Environment**: Remember that `OPENAI_API_KEY` is required for the crawler but should **never** be committed to version control.

---

## 5. Project Structure

Understanding the directory structure is key to making correct changes:

- `data/`: Contains `events.csv`, the primary data source.
- `public/`: Static assets like `index.html`, icons, and manifest.
- `scripts/`: Node.js utility scripts, including the event crawler.
- `src/`: React source code.
  - `components/`: Reusable UI components.
  - `hooks/`: Custom React hooks.
  - `utils/`: Helper functions and constants.
  - `theme.js`: Material UI theme configuration.
- `tests/`: Test files (if not colocated with components).

---

## 6. Error Handling & Logging

- **Frontend**: Use MUI `Alert` or `Snackbar` components to communicate errors to the user. Avoid raw `alert()` calls.
- **Scripts**: Use `console.error` for logging errors in the crawler. Ensure that errors in the crawler do not result in a corrupted `events.csv`.
- **Graceful Degradation**: If the CSV fails to load, show a helpful error message and a retry button if possible.

---

## 7. Testing Guidelines

- **Unit Tests**: Write unit tests for utility functions and hooks.
- **Component Tests**: Use React Testing Library to test component behavior and rendering.
- **Mocking**: Mock external dependencies like `papaparse` or `dayjs` when necessary to ensure tests are deterministic.
- **Coverage**: Aim for high test coverage on critical business logic, especially date parsing and event filtering.

---

## 8. Communication & Collaboration

- **Atomic Commits**: When suggesting or making changes, aim for atomic commits that focus on a single feature or fix.
- **Documentation**: Keep this `AGENTS.md` and `GEMINI.md` updated as the project evolves.
- **Transparency**: Explain the reasoning behind architectural choices, especially when they deviate from standard patterns.

---

*Last Updated: February 2026*

