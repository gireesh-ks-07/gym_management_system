# Gym Management System API Documentation

## Overview
This document lists the APIs for the Gym Management System. The system supports multiple gyms and role-based access (Superadmin, Admin, Trainer).

## Base URL
`http://localhost:3000/api`

## Authentication
All protected routes require a generic Bearer Token (JWT).
Header: `Authorization: Bearer <token>`

## Roles
- **Superadmin**: Can create gyms and manage system-wide settings.
- **Admin**: Manager of a specific gym. Can manage trainers and clients.
- **Trainer**: Can add clients for their assigned gym.
- **User (Client)**: The end customer.

## Endpoints

### Auth
- `POST /auth/login`
  - Body: `{ "email": "string", "password": "string" }`
  - Returns: `{ "token": "string", "user": { ... } }`

### Gyms (Superadmin Only)
- `POST /gyms`
  - Body: `{ "name": "string", "address": "string", "adminEmail": "string", "adminPassword": "string" }`
  - Returns: Created gym object and initial admin.
- `GET /gyms`
  - Returns: List of all gyms.

### Clients (Admin, Trainer)
- `POST /clients`
  - Body: 
    ```json
    {
      "name": "string",
      "email": "string",
      "phone": "string",
      "height": "number", // in cm
      "weight": "number", // in kg
      "joiningDate": "YYYY-MM-DD" // Optional, defaults to today
    }
    ```
  - Returns: Created client object.
- `GET /clients`
  - Returns: List of clients in the gym.

### Staff (Admin Only)
- `POST /staff`
  - Body: `{ "name": "string", "email": "string", "password": "string", "role": "trainer" }`
  - Returns: Created staff member (Trainer).
- `GET /staff`
  - Returns: List of trainers in the gym.
