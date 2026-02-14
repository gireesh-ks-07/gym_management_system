# Gym Management System

This project contains a backend API for managing multiple gyms and a React Native mobile application for Gym Admins and Trainers.

## Project Structure

- `backend/`: Node.js + Express + Sequelize (SQLite) REST API.
- `mobile_app/`: React Native (Expo) application code.
- `API_DOCUMENTATION.md`: Detailed list of API endpoints.

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
3. Start the server:
   ```bash
   npm start
   ```
   The server runs on `http://localhost:3000`.
   
   **Default Credentials:**
   - Superadmin Email: `super@admin.com`
   - Superadmin Password: `admin123`

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
