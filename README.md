# LMS Backend API

A comprehensive Learning Management System (LMS) backend built with Node.js, Express, TypeScript, and PostgreSQL. This system provides a complete suite of features for managing courses, assignments, attendance, student profiles, and AI-powered assistance.

## 🚀 Features

### Core Functionality
- **Authentication & Authorization**: JWT-based authentication with role-based access control (Student, Instructor, Admin)
- **User Management**: Comprehensive user profiles with CV uploads, skills tracking, and performance summaries
- **Course Management**: Full CRUD operations for courses with cohort-based organization
- **Content Management**: Support for multiple content types (text, video, documents) with S3 storage
- **Assignment System**: Create, submit, and grade assignments with file uploads
- **Attendance Tracking**: Session-based attendance recording for courses
- **Feedback System**: Instructor feedback on student submissions with ratings
- **Notification System**: Real-time notifications for users with read/unread tracking
- **AI Assistant**: Integrated AI chatbot for student assistance using FastAPI backend
- **Admin Dashboard**: Administrative tools for user and system management

### Advanced Features
- **Vector Embeddings**: User skill vectors for personalized recommendations
- **Chat History**: Persistent AI chat sessions with message history
- **Performance Analytics**: Automated performance summaries with ratings and metrics
- **Soft Deletes**: Non-destructive deletion for courses and users
- **File Upload**: S3-compatible storage (Backblaze B2) for CVs, assignments, and content

## 🛠️ Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: AWS S3-compatible (Backblaze B2)
- **Password Hashing**: bcrypt
- **File Upload**: Multer
- **AI Integration**: Axios (FastAPI backend)
- **Document Parsing**: pdf-parse-new

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn
- Backblaze B2 account (or S3-compatible storage)
- FastAPI backend running (for AI features)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LMS-Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy the example environment file and configure it:
   ```bash
   cp .env.example .env
   ```

4. **Configure your `.env` file**

   ```env
   # Server Configuration
   PORT=3000

   # Database Configuration
   DB_PASSWORD=your_postgres_password
   DATABASE=LMSDB
   DATABASE_URL="postgresql://postgres:your_password@localhost:5432/LMSDB"

   # JWT Secrets (generate using: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
   ACCESS_TOKEN_SECRET=your_access_token_secret
   REFRESH_TOKEN_SECRET=your_refresh_token_secret
   TOKEN_EXPIRE=1d

   # Backblaze B2 / S3 Configuration
   B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
   B2_ACCESS_KEY_ID=your_b2_key_id
   B2_SECRET_ACCESS_KEY=your_b2_secret
   B2_BUCKET_NAME=your_bucket_name
   B2_REGION=us-east-005

   # AI Service URL
   FASTAPI_URL=http://localhost:8000
   ```

5. **Set up the database**
   
   Create the PostgreSQL database:
   ```sql
   CREATE DATABASE LMSDB;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

6. **Run database migrations**
   ```bash
   npx prisma migrate deploy
   ```

7. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```
The server will start with hot-reload on `http://localhost:3000`

### Production Build
```bash
npm run build
npm start
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout

### User Profile
- `GET /api/profile` - Get student profile
- `PUT /api/profile` - Update student profile
- `POST /api/profile/cv` - Upload CV
- `GET /api/instructor/profile` - Get instructor profile
- `PUT /api/instructor/profile` - Update instructor profile

### Skills Management
- `GET /api/skills` - Get all skills
- `POST /api/skills` - Add user skill
- `DELETE /api/skills/:id` - Remove user skill

### Courses (Instructor)
- `POST /api/instructor/course` - Create course
- `GET /api/instructor/course` - Get instructor courses
- `PUT /api/instructor/course/:id` - Update course
- `DELETE /api/instructor/course/:id` - Delete course

### Courses (Student)
- `GET /api/student/course` - Get enrolled courses
- `POST /api/student/course/enroll` - Enroll in course

### Course Content
- `POST /api/instructor/courses/content` - Add content
- `GET /api/instructor/courses/content/:courseId` - Get course content
- `PUT /api/instructor/courses/content/:id` - Update content
- `DELETE /api/instructor/courses/content/:id` - Delete content
- `GET /api/student/courses/content/:courseId` - View course content

### Assignments
- `POST /api/instructor/courses/assignment` - Create assignment
- `GET /api/instructor/courses/assignment/:courseId` - Get course assignments
- `PUT /api/instructor/courses/assignment/:id` - Update assignment
- `DELETE /api/instructor/courses/assignment/:id` - Delete assignment
- `GET /api/student/courses/assignment/:courseId` - View assignments

### Submissions
- `POST /api/student/courses/submissions` - Submit assignment
- `GET /api/student/courses/submissions/:assignmentId` - View submission
- `GET /api/instructor/courses/submissions/:assignmentId` - View all submissions
- `PUT /api/instructor/courses/submissions/:id/grade` - Grade submission

### Feedback
- `POST /api/instructor/feedback` - Provide feedback
- `GET /api/instructor/feedback/:submissionId` - Get feedback
- `PUT /api/instructor/feedback/:id` - Update feedback
- `GET /api/student/feedback/:submissionId` - View feedback

### Attendance
- `POST /api/attendance/session` - Create attendance session
- `POST /api/attendance/record` - Record attendance
- `GET /api/attendance/:courseId` - Get attendance records

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `DELETE /api/notifications/:id` - Delete notification

### AI Assistant
- `POST /api/ai/chat` - Send message to AI
- `GET /api/ai/history` - Get chat history
- `DELETE /api/ai/session/:id` - Delete chat session

### Admin
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/statistics` - Get system statistics

## 📁 Project Structure

```
LMS-Backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── src/
│   ├── config/                # Configuration files
│   │   ├── aiClient.ts        # AI service client
│   │   ├── bucket.ts          # S3/B2 storage config
│   │   ├── db.ts             # Database connection
│   │   └── jwt.ts            # JWT configuration
│   ├── controllers/           # Request handlers
│   │   ├── auth.controllers.ts
│   │   ├── courses.controllers.ts
│   │   ├── assignments.controller.ts
│   │   └── ...
│   ├── middlewares/          # Express middlewares
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── multer.middleware.ts
│   ├── routes/               # API routes
│   ├── services/             # Business logic
│   ├── utils/                # Utility functions
│   ├── lib/                  # Libraries
│   ├── generated/            # Prisma generated files
│   ├── app.ts                # Express app setup
│   └── server.ts             # Server entry point
├── .env                      # Environment variables
├── package.json              # Dependencies
└── tsconfig.json            # TypeScript configuration
```

## 💾 Database Schema

### Core Models
- **users**: User accounts with authentication
- **profiles**: Extended user profile information
- **skills**: User skills and competencies
- **cohorts**: Course cohorts/batches
- **courses**: Course information
- **enrollments**: Student-course relationships
- **course_content**: Course materials and resources
- **assignments**: Course assignments
- **submissions**: Student assignment submissions
- **feedback**: Instructor feedback on submissions
- **attendance_sessions**: Attendance tracking sessions
- **attendance_records**: Individual attendance records
- **notifications**: User notifications
- **chat_sessions**: AI chat sessions
- **chat_messages**: AI conversation history
- **performance_summary**: Student performance metrics
- **user_vectors**: Vector embeddings for recommendations

## 🔐 Authentication Flow

1. User registers/logs in with credentials
2. Server validates credentials and generates JWT access token (short-lived) and refresh token (long-lived)
3. Client stores tokens and includes access token in Authorization header for API requests
4. When access token expires, client uses refresh token to get a new access token
5. Server validates refresh token and issues new access token

## 🧪 Testing

```bash
# Add your testing commands here
npm test
```

## 📝 API Documentation

For detailed API documentation with request/response examples, consider setting up:
- Swagger/OpenAPI documentation
- Postman collection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

ISC
