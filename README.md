# Gym Management System

A multi-tenant facility (gym) management platform: a REST API, a web dashboard for
Superadmins / Gym Admins / Staff, and a companion mobile app.

## Project Structure

- `backend/`: Node.js + Express + Sequelize (PostgreSQL) REST API.
- `frontend/`: React (Vite) web dashboard.
- `mobile_app/`: React Native (Expo) application code.

## Setup Instructions

### Backend
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file (see the required keys below), then start the server:
   ```bash
   npm start
   ```
   The server runs on `http://localhost:3000`.

   **Required environment variables** (`backend/.env`):
   - `SECRET_KEY` — JWT signing secret (required; server refuses to start without it).
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — PostgreSQL connection (or a single `DATABASE_URL`).
   - `ENCRYPTION_KEY` — 64-hex-char key for AES-256-GCM PII encryption (optional; encryption is disabled if unset).
   - `SUPERADMIN_EMAIL`, `SUPERADMIN_DEFAULT_PASSWORD` — seeded on first run. In production the server **refuses to start** if the password is left at the insecure default.
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — AutoPay integration (optional).
   - `NODE_ENV`, `ALLOWED_ORIGIN`, `DB_SSL_REJECT_UNAUTHORIZED` — deployment settings.

   On first run a superadmin is seeded from `SUPERADMIN_EMAIL` / `SUPERADMIN_DEFAULT_PASSWORD`
   (defaults to `super@admin.com` / `admin123` for local development only — change these before deploying).

### Frontend (Web Dashboard)
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```
   Configure the API base URL via `VITE_API_BASE_URL` (see `.env.local` / `.env.production`).

### Mobile App
1. Navigate to the `mobile_app` directory:
   ```bash
   cd mobile_app
   ```
2. Install dependencies (requires Node.js):
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   npx expo start
   ```
   - Press `a` to run on Android Emulator (if set up).
   - Press `w` to run in Web Browser.
   - Scan QR code with Expo Go app on your phone.

## Features
- **Superadmin**: Create Gyms, Create Gym Admins.
- **Gym Admin**: Add Trainers, Add Clients, View Clients.
- **Trainer**: Add Clients, View Clients.
- **Client Management**: Name, Email, Phone, Height, Weight, Joining Date.
