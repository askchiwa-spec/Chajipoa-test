# ⚡ ChajiPoa - Power Bank Rental Platform

A comprehensive, scalable power bank rental platform built with modern technologies for Tanzania's digital economy.

## 🚀 Features

- **Multi-channel Access**: Web, Mobile App, USSD, Admin Dashboard
- **QR Code Activation**: Instant device rental with QR scanning
- **Mobile Money Integration**: Full AzamPay support for all Tanzanian providers (M-Pesa, Tigo Pesa, Airtel Money, Halo Pesa)
- **Real-time Monitoring**: Device tracking, station management, and analytics
- **Secure Authentication**: Multi-factor authentication with phone verification and Gmail sign-up
- **Scalable Architecture**: Microservices design supporting 10,000+ concurrent users

## 🏗️ Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Databases**: PostgreSQL (ACID), MongoDB (flexible), Redis (caching)
- **API**: RESTful with Swagger documentation
- **Security**: JWT, bcrypt, rate limiting, input validation

### External Integrations
- **Payment**: AzamPay API
- **SMS**: Local SMS provider
- **QR Codes**: QRCode library
- **Monitoring**: ELK Stack (planned)

## 📋 Project Structure

```
ChajiPoa/
├── src/                    # Source code
│   ├── config/              # Database, logger, Redis configs
│   ├── controllers/         # Business logic
│   ├── middleware/          # Auth, error handling, rate limiting
│   ├── models/              # MongoDB schemas
│   ├── routes/              # API endpoints
│   ├── services/            # External integrations
│   ├── utils/               # Helper functions
│   ├── validators/          # Joi validation schemas
│   └── server.js            # Main application entry
├── docs/                    # Documentation
├── __tests__/               # Test suite
├── scripts/                 # Utility scripts
├── public/                  # Static assets
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
├── package.json            # Dependencies and scripts
└── README.md               # Project documentation
```

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd chajipoa
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start Development Server**
```bash
npm run dev
```

## 🚦 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server
- `npm test` - Run tests
- `npm run check` - Run system status check

## 🔐 Authentication Flow

The system supports multiple authentication methods:

### Phone Registration
1. User enters phone number, name, and optional email/NIDA
2. System sends OTP via SMS
3. User enters OTP to verify phone
4. Account is activated with JWT token

### Gmail Registration
1. User enters Gmail address and personal information
2. Optional phone number for notifications
3. Account is created with Google OAuth verification

## 📱 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/verify-phone` - Phone verification
- `POST /api/v1/auth/resend-otp` - Resend verification code

### User Management
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update profile
- `GET /api/v1/users/rentals` - Rental history

### Rental Operations
- `POST /api/v1/rentals/start` - Start rental
- `GET /api/v1/rentals/active` - Active rental info
- `POST /api/v1/rentals/:id/end` - End rental
- `POST /api/v1/rentals/:id/extend` - Extend rental

### Monitoring
- `GET /health` - System health
- `GET /api/v1/monitoring/metrics` - Performance metrics

## 📊 Security Features

- JWT token-based authentication
- Rate limiting (100 requests per 15 minutes)
- Input validation with Joi schemas
- Password hashing with bcrypt
- SQL injection prevention
- XSS protection with Helmet
- CORS configuration
- Audit logging

## 📈 Database Schema

The system uses PostgreSQL for structured data:
- `users` - User accounts and profiles
- `devices` - Power bank devices
- `stations` - Rental stations
- `rentals` - Rental transactions
- `transactions` - Payment records
- `partners` - Station partners
- `maintenance_logs` - Device maintenance records

## 🚀 Deployment

For production deployment, see `docs/DEPLOYMENT.md`

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@chajipoa.com or join our Slack channel.

---

**ChajiPoa** - Powering Tanzania, one charge at a time ⚡