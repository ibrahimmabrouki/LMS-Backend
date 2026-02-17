# TS CRUD APIs

A RESTful CRUD API built with **Node.js**, **Express**, **TypeScript**, and **MongoDB (Mongoose)**.
This project demonstrates clean API structure, data modeling, validation, and best practices for scalable backend development.

---

## Features

* CRUD operations for users
* RESTful routing and controllers
* MongoDB integration using Mongoose
* TypeScript with strict typing
* Environment variable management with dotenv
* Centralized error handling
---

## Tech Stack

* **Node.js**
* **Express.js**
* **TypeScript**
* **MongoDB + Mongoose**
* **Nodemon** (development)

---

## Project Structure

```
ts-crud-apis/
├── src/
│   ├── config/          # Database connection
│   │   └── db.ts
│   ├── controllers/     # Business logic
│   │   └── user.controller.ts
│   ├── models/          # Mongoose schemas
│   │   └── user.model.ts
│   ├── routes/          # API routes
│   │   └── user.routes.ts
│   ├── middlewares/     # Custom middlewares
│   │   ├── error.middleware.ts
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server bootstrap
├── .env                 # Environment variables
├── tsconfig.json
├── package.json
└── README.md
```

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone git@github.com:RimDH/ts-crud-apis.git
cd ts-crud-apis
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

Create a `.env` file in the root directory:

```env
PORT=3000
MONGO_URI=YOUR_MONGO_URI
```

---

## Available Scripts

```json
"scripts": {
  "dev": "nodemon --exec ts-node server.ts",
  "build": "tsc",
  "start": "node dist/server.js"
}
```

* **npm run dev** – Start development server with hot reload
* **npm run build** – Compile TypeScript to JavaScript
* **npm start** – Run compiled production build

---

## API Endpoints

Base URL: `http://localhost:3000/api/users`

| Method | Endpoint | Description    |
| -----: | -------- | -------------- |
|   POST | `/`      | Create a user  |
|    GET | `/`      | Get all users  |
|    GET | `/:id`   | Get user by ID |
|    PUT | `/:id`   | Update user    |
| DELETE | `/:id`   | Delete user    |

---

## Error Handling

All errors are handled by a global error middleware:

* Centralized error responses
* Prevents application crashes
* Returns consistent JSON error format

---

## License

This project is open-source and free to use for learning and development purposes.
