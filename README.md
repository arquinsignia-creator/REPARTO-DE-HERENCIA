# HerenciaJusta AI ⚖️

An intelligent inheritance partitioner that optimizes asset distribution and calculates financial compensations among heirs using Gemini AI.

## Project Evolution & Correction Plan

The project has been refactored from a flat-file structure to a modern **Next.js 14** architecture following Viaki structural principles.

### Key Improvements:
1.  **Framework Migration**: Moved from loose files to a structured Next.js App Router project.
2.  **Security**: AI logic moved to a secure **Server-Side API Route** (`/api/logic/partition`). This prevents API key exposure on the client.
3.  **Aesthetics**: Implemented a **Premium UI Design** using Vanilla CSS with modern tokens, glassmorphism, and responsive layouts.
4.  **Type Safety**: Centralized and standardized TypeScript types.
5.  **Modern AI Engine**: Upgraded to use `gemini-2.0-flash-exp` for faster and more consistent structured JSON results.

### Structure:
- `src/app/`: Next.js App Router and API routes.
- `src/components/`: Reusable UI components.
- `src/lib/`: Business logic, constants, and utilities.
- `src/styles/`: Global styles and design system tokens.
- `src/types/`: Shared TypeScript interfaces.

### Setup:
1.  Duplicate `.env.example` as `.env`.
2.  Add your `GOOGLE_API_KEY`.
3.  Run `npm install` and `npm run dev`.

### Compliance with Viaki Global Rules:
- **RESTful API Architecture**: Implemented via Next.js Route Handlers.
- **Parametric Workflow**: The app follows a phased approach (Config -> Assets -> Calculation).
- **Rich Aesthetics**: High-end visual design with refined typography and micro-interactions.
