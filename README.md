# Informejo

A modern, full-featured IT support ticket management system built with Next.js, TypeScript, Tailwind CSS, and PostgreSQL.

## Features

### For Users
- ✅ Self-registration with email/password
- ✅ Create, view, and track support tickets
- ✅ Add comments to tickets
- ✅ Upload file attachments (up to 10MB)
- ✅ Real-time updates via WebSocket
- ✅ Email notifications for ticket updates
- ✅ Personal dashboard with ticket statistics
- ✅ Filter and search tickets
- ✅ View ticket history and status changes

### For IT Admins
- ✅ SSO authentication via Keycloak OIDC
- ✅ System-wide ticket management dashboard
- ✅ Assign tickets to admins or pick from pending pool
- ✅ Set ticket status (Open, In Progress, Waiting, Resolved, Closed)
- ✅ Set ticket priority (Low, Medium, High, Critical)
- ✅ Add internal notes (not visible to users)
- ✅ View all tickets across the organization
- ✅ Filter by status, priority, assignment, and more
- ✅ Real-time notifications for new tickets
- ✅ Track average resolution times
- ✅ Switch between admin and user views

### Technical Features
- 🔐 Dual authentication: Credentials (users) + Keycloak OIDC (admins)
- 🔄 Real-time updates with Socket.io
- 📧 Email notifications with Nodemailer
- 📁 File upload support with local storage
- 🎨 Modern, responsive UI with Tailwind CSS
- 🔒 Role-based access control
- 🚀 Optimized for self-hosting with nginx
- 📊 Comprehensive dashboard statistics
- 🔍 Advanced filtering and search

## Tech Stack

- **Frontend/Backend**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: NextAuth.js with Keycloak OIDC
- **Real-time**: Socket.io
- **Email**: Nodemailer
- **Icons**: Lucide React
- **Notifications**: React Hot Toast

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Keycloak server (for admin SSO)
- SMTP server (for email notifications)

## Quick Start

### 1. Clone and Install

```bash
cd /path/to/tickets
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ticketdb?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# Keycloak OIDC
KEYCLOAK_ID="your-client-id"
KEYCLOAK_SECRET="your-client-secret"
KEYCLOAK_ISSUER="https://keycloak.example.com/realms/your-realm"

# Email
SMTP_HOST="localhost"
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-password"
SMTP_FROM="IT Support <support@example.com>"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Generate a secure NextAuth secret:
```bash
openssl rand -base64 32
```

### 3. Setup Database

```bash
# Run migrations
npx prisma migrate dev

# Or for production
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Create First User

1. Navigate to [http://localhost:3000/register](http://localhost:3000/register)
2. Register a new user account
3. Use this account to create tickets

### 6. Admin Login (Keycloak SSO)

1. Navigate to [http://localhost:3000/login](http://localhost:3000/login)
2. Click "IT Admin Login (SSO)"
3. Login with your Keycloak credentials
4. Admins are automatically identified via Keycloak

## Production Deployment

For production deployment on Ubuntu with nginx, see [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

Quick summary:
1. Install Node.js, PostgreSQL, nginx
2. Configure environment variables
3. Build application: `npm run build`
4. Run with PM2: `pm2 start ecosystem.config.js`
5. Configure nginx as reverse proxy
6. Setup SSL with Let's Encrypt

## Project Structure

```
tickets/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── (auth)/            # Authentication pages
│   │   ├── (user)/            # User pages (dashboard, tickets)
│   │   ├── (admin)/           # Admin pages
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth & registration
│   │   │   ├── tickets/       # Ticket CRUD
│   │   │   ├── stats/         # Dashboard statistics
│   │   │   └── users/         # User management
│   │   └── layout.tsx
│   ├── components/            # Reusable UI components
│   │   ├── Navbar.tsx
│   │   ├── TicketCard.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── PriorityBadge.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── email.ts           # Email utilities
│   │   └── socket.ts          # Socket.io configuration
│   └── types/
│       └── index.ts           # TypeScript types
├── public/
├── uploads/                   # File uploads (created at runtime)
├── .env                       # Environment variables (not in git)
├── package.json
└── README.md
```

## Database Schema

### Users
- Dual authentication support (credentials + Keycloak SSO)
- Role-based access (USER, ADMIN)
- Department tracking

### Tickets
- Complete lifecycle management
- Priority and category classification
- Assignment tracking
- Automatic timestamps

### Comments
- Support for internal admin notes
- Full conversation history
- User attribution

### Attachments
- File metadata storage
- Size and type tracking
- Upload attribution

## API Routes

### Authentication
- `POST /api/auth/register` - User registration
- `GET/POST /api/auth/[...nextauth]` - NextAuth handlers

### Tickets
- `GET /api/tickets` - List tickets (filtered by role)
- `POST /api/tickets` - Create ticket
- `GET /api/tickets/[id]` - Get ticket details
- `PATCH /api/tickets/[id]` - Update ticket
- `DELETE /api/tickets/[id]` - Delete ticket (admin only)

### Comments & Attachments
- `POST /api/tickets/[id]/comments` - Add comment
- `POST /api/tickets/[id]/attachments` - Upload file

### Statistics
- `GET /api/stats` - Dashboard statistics

### Users
- `GET /api/users` - List users (admin only)

## Configuration

### Keycloak Setup

1. Create a new client in Keycloak
   - Client ID: `it-tickets`
   - Access Type: `confidential`
   - Valid Redirect URIs: `http://localhost:3000/api/auth/callback/keycloak`

2. Copy client secret to `.env`

3. Ensure Keycloak users have email addresses

### SMTP Configuration

For development, you can use:
- Local SMTP server (Postfix on Ubuntu)
- Gmail with app password
- Mailtrap for testing

For production:
- Organization SMTP server
- SendGrid
- AWS SES
- Mailgun

### File Upload Configuration

Configure in `.env`:
```env
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="10485760"  # 10MB in bytes
```

## Development

### Run in Development Mode

```bash
npm run dev
```

### Build for Production

```bash
npm run build
npm start
```

### Database Operations

```bash
# Create migration
npx prisma migrate dev --name description

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Linting

```bash
npm run lint
```

## Features in Detail

### Real-time Updates

The application uses Socket.io for real-time updates:
- New ticket notifications for admins
- Status change notifications
- New comment notifications
- Automatic UI updates without refresh

### Email Notifications

Automated emails are sent for:
- Ticket creation confirmation
- New ticket alerts to admins
- Ticket assignment to admins
- Status changes
- New comments

### File Uploads

- Maximum file size: 10MB (configurable)
- Stored locally in `uploads/` directory
- Organized by ticket ID
- Metadata stored in database
- Secure download links

### Security

- Password hashing with bcrypt
- JWT-based sessions
- Role-based access control
- Protected API routes
- Input validation with Zod
- SQL injection prevention (Prisma)
- XSS protection (React)

## Customization

### Styling

Edit Tailwind configuration in `tailwind.config.ts`:
```typescript
theme: {
  extend: {
    colors: {
      primary: { /* your colors */ },
    },
  },
}
```

### Email Templates

Customize email templates in `src/lib/email.ts`

### Ticket Categories

Add or modify categories in `prisma/schema.prisma`:
```prisma
enum TicketCategory {
  HARDWARE
  SOFTWARE
  NETWORK
  ACCESS
  YOUR_CATEGORY
  OTHER
}
```

Then run: `npx prisma migrate dev`

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U your_user -d ticketdb
```

### Email Not Sending
- Check SMTP credentials
- Verify SMTP server allows connections
- Check firewall rules
- Review application logs

### Real-time Updates Not Working
- Ensure Socket.io connection is established
- Check browser console for errors
- Verify WebSocket connections aren't blocked

### File Upload Failing
- Check `uploads/` directory exists and is writable
- Verify `MAX_FILE_SIZE` setting
- Check disk space

## Contributing

This is a private project for your organization. For modifications:

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Update documentation
5. Deploy to staging first

## Support

For issues or questions:
1. Check logs: `pm2 logs it-tickets`
2. Review nginx logs: `/var/log/nginx/tickets-error.log`
3. Check database logs
4. Contact your system administrator

## License

Proprietary - Internal use only

## Changelog

### Version 1.0.0 (Initial Release)
- User registration and authentication
- Admin SSO via Keycloak
- Ticket creation and management
- Real-time updates
- Email notifications
- File attachments
- Dashboard statistics
- Advanced filtering and search

---

Built with ❤️ for efficient IT support management

