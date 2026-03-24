# FaSide

A personal budget and finance management desktop app for NZ households, built with React and Tauri.

## Features

- **Income tracking** -- multi-person household income with NZ tax, ACC, KiwiSaver, and student loan calculations
- **Expense management** -- recurring expenses grouped by category, normalised to fortnightly
- **Savings trajectory** -- forward/backward projection anchored to live account balances
- **Financial tracking** -- ad-hoc income/expense logging per fortnight with balance sparkline
- **Wishlist** -- purchase planning with AI timing suggestions
- **Property portfolio** -- property register, tasks, maintenance log, improvement projects, asset register
- **Investment portfolio** -- multi-portfolio holdings, contributions, dividends, performance charts, tax summary
- **Live prices** -- stock prices via Yahoo Finance, crypto via CoinGecko/Binance (no API keys needed)
- **Backup/restore** -- export and import full app state as JSON

## Tech Stack

| Layer       | Technology                                  |
|-------------|---------------------------------------------|
| Desktop     | Tauri 2                                     |
| UI          | React 19 + Vite 7                           |
| State       | Zustand 5 with custom persistence layer     |
| Persistence | localStorage (`budget_v1`)                  |
| Charts      | Recharts 3                                  |
| Validation  | Zod 4                                       |
| Testing     | Vitest + jsdom + Testing Library            |
| HTTP        | @tauri-apps/plugin-http (production), Vite proxy (dev) |

## Development

```bash
# Install dependencies
npm install

# Run in browser (dev mode, with Vite proxy for Yahoo Finance)
npm run dev

# Run as desktop app (Tauri dev mode)
npm run tauri:dev

# Build desktop app
npm run tauri:build

# Run tests
npm test
```

## Project Structure

```
src/              React frontend
src-tauri/        Tauri (Rust) backend
src/store/        Zustand domain stores (finance, people, property, investment)
src/pages/        Feature pages (one per tab)
src/utils/        Finance calculations, price service, validation
src/models/       Plain-object shape constructors
```

All state is stored locally -- no server, no accounts, no telemetry.
