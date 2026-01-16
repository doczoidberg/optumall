# CLAUDE.md - OptumAdmin Angular Application

## Project Overview

OptumAdmin is an Angular 18 admin dashboard for managing VM operations. It replaces the previous Firebase-based customer system with integration to the SourceToOptumCE PHP backend's account/identity system.

## Architecture

### Technology Stack
- **Frontend:** Angular 18 (standalone components)
- **State Management:** Angular Signals
- **HTTP Client:** Angular HttpClient with interceptors
- **Routing:** Angular Router with guards
- **Styling:** SCSS

### Key Features
- JWT-based authentication from PHP backend
- Account management (replaces Firebase customers)
- Credit balance and transaction tracking
- Role-based access control (User, Admin, SuperAdmin)

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── accounts/          # Account list (replaces customers)
│   │   ├── account-detail/    # Account detail view
│   │   ├── dashboard/         # Admin dashboard
│   │   ├── login/             # JWT login
│   │   └── unauthorized/      # Access denied page
│   ├── guards/
│   │   ├── auth.guard.ts      # Authentication guard
│   │   ├── admin.guard.ts     # Admin role guard
│   │   └── guest.guard.ts     # Redirect if authenticated
│   ├── interceptors/
│   │   └── auth.interceptor.ts # JWT token & API key injection
│   ├── models/
│   │   ├── account.model.ts   # Account interfaces
│   │   ├── user.model.ts      # User/Auth interfaces
│   │   ├── credits.model.ts   # Credit system interfaces
│   │   └── api-response.model.ts
│   ├── services/
│   │   ├── auth.service.ts    # JWT authentication
│   │   └── accounts.service.ts # Account API calls
│   ├── app.component.ts       # Root component with nav
│   └── app.routes.ts          # Application routes
├── environments/
│   ├── environment.ts         # Development config
│   └── environment.prod.ts    # Production config
└── styles.scss                # Global styles
```

## Authentication Flow

1. User logs in at `/login` with email/password
2. `AuthService.login()` calls `POST /api/auth/login` on PHP backend
3. PHP returns JWT token and user data
4. Token stored in localStorage, injected via `authInterceptor`
5. Guards check `AuthService.isAuthenticated()` for route access

### API Key Authentication

For OptumAdmin-specific endpoints (`/api/optumadmin/*`), the interceptor also adds:
```
X-Api-Key: {environment.apiKey}
```

## Key Migration: Customers → Accounts

The Firebase `customers` collection is replaced by:

| Old (Firebase)           | New (PHP API)                        |
|--------------------------|--------------------------------------|
| `customers` collection   | `GET /api/optumadmin/accounts`       |
| `customers/{id}`         | `GET /api/optumadmin/accounts/{id}`  |
| `customers.credits`      | `GET /api/optumadmin/credits/balance/{id}` |
| `customers.transactions` | `GET /api/optumadmin/credits/transactions/{id}` |

### Account Types (from PHP)
- `0` = Individual
- `1` = Organization
- `3` = University

### User Roles
- `0` = Regular User
- `1` = Admin
- `2` = SuperAdmin

## API Endpoints Used

### Authentication
- `POST /api/auth/login` - Login with `user_name` and `password`
- `GET /api/profile` - Get current user profile

### OptumAdmin API (API Key protected)
- `GET /api/optumadmin/accounts` - List all accounts
- `GET /api/optumadmin/accounts/{id}` - Get account with members/groups
- `GET /api/optumadmin/users` - List all users
- `GET /api/optumadmin/users/{id}` - Get user details
- `GET /api/optumadmin/groups` - List all groups
- `GET /api/optumadmin/stats` - System statistics
- `GET /api/optumadmin/search?q=query` - Search accounts/users
- `GET /api/optumadmin/credits/balance/{accountId}` - Credit balance
- `GET /api/optumadmin/credits/transactions/{accountId}` - Transaction history

## Development

### Prerequisites
- Node.js 18+
- npm 9+

### Running the App

```bash
cd optumadmin/optumadmin
npm install
npm start
# Runs on http://localhost:4200
```

### Environment Configuration

Edit `src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  licenseManagementApiUrl: 'http://localhost:8000',
  apiKey: 'your-api-key-here'
};
```

### Building for Production

```bash
npm run build
# Output in dist/optumadmin
```

## Testing Credentials

Use the test account from SourceToOptumCE:
- **Email:** `daniel.zuidinga@googlemail.com`
- **Password:** `test123`
- **Role:** SuperAdmin

## Important Notes

1. **Login uses `user_name` NOT `email`** - The PHP API expects the field to be `user_name`
2. **API Key required** - OptumAdmin endpoints require the `X-Api-Key` header
3. **JWT expiration** - The interceptor handles 401 errors by logging out
4. **Signals** - This app uses Angular Signals for reactive state management
5. **Standalone components** - No NgModules, all components are standalone
