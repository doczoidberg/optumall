# Repository Guidelines

## Project Structure & Module Organization
Code lives in `backend/licensemanagement` (Lumen 7 API) and `frontend` (Vue 2 SPA). Backend logic sits in `app/`, routes in `routes/web.php`, and contracts in `app/Contracts`. Database work stays in `backend/licensemanagement/database`, with schemas mirrored in `/database/schema.sql`; update both when schemas change. Frontend source is `frontend/src` (`components/`, `store/`, `router/`), assets in `static/`, and bundles in `dist/`. Architecture docs stay in `doc/Design`/`doc/Release`; local DB bootstrap steps live in `doc/DevelopmentDatabase.md`.

## Build, Test, and Development Commands
Backend workflow: `cd backend/licensemanagement && composer install`, `php artisan serve` for the API, `php artisan migrate --seed` to refresh MySQL, and `./vendor/bin/phpunit` for tests. Frontend workflow: from `frontend`, run `npm install`, `npm run dev` for the webpack dev server, `npm run build` for production bundles, `npm run lint` for ESLint, and `npm run test` for Jest + Nightwatch.

## Coding Style & Naming Conventions
Follow PSR-12, 4-space indentation, and PSR-4 namespaces rooted at `App\\` on the backend; controllers/services use StudlyCase and configs stay snake_case. Frontend code follows the Standard ESLint profile (`frontend/.eslintrc.js`), 2-space indentation, single quotes, and PascalCase `.vue` files under `src/components`. Vuex modules mirror their feature folders, while route names stay kebab-case to match URL segments.

## Testing Guidelines
Place backend PHPUnit specs in `backend/licensemanagement/tests`, mirroring `ExampleTest.php` and using factories to isolate state. Cover every new endpoint or job before merging. Frontend unit specs belong in `frontend/test/unit` (Jest + vue-jest) and browser paths in `frontend/test/e2e/specs` (Nightwatch). Name tests after the feature (`UserList.spec.js`) and only push when PHP and JS suites pass locally.

## Commit & Pull Request Guidelines
History (`git log -5 --oneline`) shows concise imperative commits (`update db schema`). Continue writing short, action-focused messages, tagging tickets with `[#123]` when relevant. Pull requests should summarize intent, list verification commands, describe schema/config impacts, and include UI screenshots when UI changes occur. Rebase on `main` before requesting reviews and tag both backend and frontend owners when touching shared contracts.

## Security & Configuration Tips
Never commit `.env`; copy from `backend/licensemanagement/.env.example` and override secrets locally. Store JWT keys, mail creds, and API tokens in the environment or vault tooling. Document new environment variables in `doc/Release` so deployment instructions stay current.

## Infrastructure Diagram & References
Infrastructure diagram lives in `doc/Design/LicenseManagement.7z` (source plus exports). Extract, update it in your preferred editor (e.g., draw.io), export a PDF/PNG back into the archive, and bump the modified date inside `doc/Design`. Call out topology changes in your pull request so ops can validate them.
