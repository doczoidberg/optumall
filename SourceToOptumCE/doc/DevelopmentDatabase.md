# Development Database Setup

Use these steps to create a clean MySQL schema for local development and wire the API to it.

## Requirements
- MySQL 8.0+ or MariaDB 10.6+
- Access to the `mysql` CLI (part of every MySQL installation)

## 1. Create the database and user
```sh
mysql -u root -p <<'SQL'
CREATE DATABASE IF NOT EXISTS license_local
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'license_user'@'localhost' IDENTIFIED BY 'license_pass';
GRANT ALL PRIVILEGES ON license_local.* TO 'license_user'@'localhost';
FLUSH PRIVILEGES;
SQL
```
Feel free to change the database name, user, or password—just keep them in sync with `.env`.

## 2. Load the base schema snapshot
Import the schema dump shipped with the repo:
```sh
mysql -u license_user -p license_local < database/schema.sql
```
This gives you the same tables as production. You can also run `php artisan migrate --seed` later to apply incremental migrations.

## 3. Configure Lumen for localhost
```sh
cp backend/licensemanagement/.env.example backend/licensemanagement/.env
php -r "echo bin2hex(random_bytes(32));"    # copy the output into APP_KEY
php -r "echo bin2hex(random_bytes(32));"    # copy the output into JWT_SECRET
```
Edit `.env` if you chose different database credentials. Keep `DB_HOST=127.0.0.1` when using a local MySQL instance.

## 4. Run migrations and seeders (optional but recommended)
```sh
cd backend/licensemanagement
php artisan migrate --seed
```
This runs the migrations in `database/migrations` on top of the imported schema and executes any seeders under `database/seeds`.

## 5. Verify the connection
```sh
php artisan migrate:status
```
If the command succeeds and lists the migration table, the API can reach your local database. Point the Vue frontend at the API (`APP_URL`) and continue development.
