# TODO - Next Steps

## High Priority

- [ ] **Deploy SourceToOptumCE backend to production** - Currently only running locally on `localhost:8000`. Need a hosted URL so Cloud Functions can call it.
- [ ] **Update Firebase config with production API URL** - Once backend is deployed:
  ```bash
  firebase functions:config:set licenseapi.url="https://your-production-url.com/api/optumadmin"
  firebase functions:config:set licenseapi.key="your-real-api-key"
  firebase deploy --only functions
  ```
- [ ] **Map Firestore customers to MySQL accounts** - Add `account_id` field to Firestore `customers` documents to link them to MySQL `account.id`. Without this, the credit deduction uses the Firestore document ID as account_id.
- [ ] **Migrate `functions.config()` to environment params** - Firebase deprecated `functions.config()`, deadline March 2026. Run `firebase functions:config:export` to migrate.

## Medium Priority

- [ ] **Add credits to account-users detail view** - The `/accounts/:id` component should show credit balance and usage logs for the selected account.
- [ ] **Add "Add Credits" button in Angular admin** - Allow admins to manually add credits to an account from the Angular UI (calls existing `/api/credits/add-manual` endpoint).
- [ ] **Show VM usage logs in Angular** - Fetch and display `/api/optumadmin/vm/usage-logs/{accountId}` in the account detail view.
- [ ] **Remove old Firestore customer components entirely** - Currently commented out in routing. Delete the component files once migration is confirmed stable:
  - `optumadmin/optumadmin/src/app/customers/`
  - `optumadmin/optumadmin/src/app/customer/`
- [ ] **Update `.env` API key** - Ensure `OPTUMADMIN_API_KEY` in SourceToOptumCE `.env` matches what's set in Firebase config.

## Low Priority

- [ ] **Remove dual-write to Firestore** - Once MySQL credits are confirmed working, stop updating `customers.creditsused` in Firestore (stopVM function).
- [ ] **Add credit purchase from Angular admin** - Integrate Stripe checkout directly in the admin app for adding credits.
- [ ] **Dashboard widget for credit usage** - Show total credits consumed across all accounts on the dashboard.
- [ ] **Fix Node engine version** - `package.json` specifies Node 20 but local environment runs Node 22. Either update the requirement or downgrade Node.
- [ ] **Firebase SDK upgrade path** - Plan migration from firebase-functions 4.x to 5.x+ (requires code changes for `functions.config()` removal).
- [ ] **Production CORS config** - Ensure SourceToOptumCE API allows requests from the Firebase Functions domain.
