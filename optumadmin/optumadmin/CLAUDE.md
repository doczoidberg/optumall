# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Angular 12 admin application with Firebase backend (Firestore + Cloud Functions) for managing Google Cloud Platform VMs and customer projects. The application handles VM provisioning, usage tracking, credit calculation, and customer management.

## Development Commands

### Frontend (Angular)
- **Start dev server**: `npm start` (runs on http://localhost:4200)
  - Note: Uses `NODE_OPTIONS=--openssl-legacy-provider` for compatibility with Angular 12 and Node versions
- **Build**: `npm run build` (outputs to `dist/optumadmin`)
- **Build with watch**: `npm run watch`
- **Run tests**: `npm test` (executes Karma/Jasmine tests)
- **Generate component**: `ng generate component component-name`

### Backend (Firebase Cloud Functions)
- **Local emulator**: `cd functions && npm run serve`
- **Deploy functions**: `cd functions && npm run deploy`
- **View logs**: `cd functions && npm run logs`
- **Firebase shell**: `cd functions && npm run shell`

### Firebase Hosting
- **Deploy frontend**: `firebase deploy --only hosting`

## Architecture

### Frontend Structure
- **Framework**: Angular 12 with strict mode disabled, SCSS styling, Material Design
- **Authentication**: Firebase Auth via `ngx-auth-firebaseui` with custom guards
- **State Management**: Direct Firestore subscriptions in components (no centralized state)
- **Routing**: Route guards (`LoggedInGuard`) protect authenticated pages

### Key Components
- **dashboard**: Overview with recent projects, entries, and logs
- **customers**: List and manage customer accounts
- **customer**: Customer detail/edit with nested project management
- **usage**: Usage tracking and credit calculations
- **vms/vmdetails**: VM listing and individual VM management
- **logs**: System activity logs
- **settings**: Application configuration
- **testrunner**: Testing/debugging utilities

### Backend (Cloud Functions)
Located in `functions/index.js` (~5636 lines), key endpoints include:
- **VM Operations**: `listVMs`, `getVM`, `startVM`, `stopVM`, `createcluster`
- **VM Management**: `setmachinestate`, `waitVM`, `testInstance`
- **Metadata**: `machinetypes`, `listmachinetypes`, `getImage`
- **Logging**: `addlog`, `addcustomerevent`
- **Scheduled**: `scheduledFunction` (runs every 1 minute for automated tasks)
- **Firestore Trigger**: `logslisten` (responds to Firestore changes)

### Database (Firestore)
Collections:
- `projects`: Customer projects/accounts
- `entries`: Usage entries/records
- `logs`: System activity logs
- `machines`: VM instances and state
- `users`: User accounts (synced via ngx-auth-firebaseui)

### Google Cloud Integration
- Uses `@google-cloud/compute` API for VM provisioning/management
- Default zone: `us-central1-a`
- Machine types include c2-standard series (4, 16, 30, 60 vCPUs)

## Important Notes

### Environment Configuration
- Firebase config is in `src/environments/environment.ts` (dev) and `environment.prod.ts` (prod)
- Environment files are replaced during production builds via `angular.json` fileReplacements
- Firebase project: `optum-80593`

### Legacy Dependencies
- Uses Angular 12 with Node.js legacy OpenSSL provider
- Some strict TypeScript checks are disabled in `tsconfig.json` and `angular.json`
- Bootstrap 4.6 alongside Angular Material

### Bundle Size
- Production budgets: 10MB warning, 25MB error for initial bundle
- Component styles: 120KB warning, 140KB error

### CORS
All Cloud Functions use CORS with `origin: true` to allow frontend requests

### Custom Pipes
- `AmountPipe`: Format monetary amounts
- `ProjectbyidPipe`: Lookup project details by ID

### Firebase Hosting
- Deploys to `dist/optumadmin`
- Single-page app routing: all requests rewrite to `/index.html`

## Development Workflow

1. Run frontend: `npm start`
2. For backend changes: work in `functions/index.js` and test with emulator (`cd functions && npm run serve`)
3. Firestore data accessed directly via `AngularFirestore` in components
4. Add routes in `src/app/app-routing.module.ts` with `LoggedInGuard` for protected routes
5. Material Design components from `@angular/material` used throughout
