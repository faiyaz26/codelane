# Codelane Website

This directory contains the codebase for the Codelane website, built with [Next.js](https://nextjs.org/).

## Getting Started

Because this project is part of the Codelane monorepo, dependencies are managed at the root level using `pnpm`.

### Installation

If you haven't already, install the dependencies from the root of the repository:

```bash
# Run this from the root of the repository
pnpm install
```

### Development Server

To start the local development server, run the following command from within this `website` directory:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Build and Production

To build the application for production:

```bash
pnpm build
```

To start the production server after building:

```bash
pnpm start
```

### Linting and Typechecking

To run the linter:

```bash
pnpm lint
```

To run TypeScript typechecking:

```bash
pnpm typecheck
```
