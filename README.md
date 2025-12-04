# Passkey Backend API

A temporary Node.js backend API for managing WebAuthn passkeys with JSON file storage. This service provides **cross-platform** passkey registration, authentication, and backend integration capabilities for **Web**, **Android**, and **iOS** applications.

## Features

- **Cross-Platform Support**: Works seamlessly with Web, Android, and iOS apps
- **Passkey Management**: Create, list, and delete WebAuthn passkeys across all platforms
- **WebAuthn Support**: Full WebAuthn implementation using `@simplewebauthn/server`
- **Platform Detection**: Automatic platform detection with manual override support
- **Mobile-Optimized**: Special handling for Android APK signatures and iOS bundle IDs
- **Backend Integration**: Proxy authentication to your main backend API
- **JSON Storage**: File-based storage for temporary/development use
- **RESTful API**: Clean REST endpoints with proper error handling
- **Configurable**: Easy configuration for different environments and platforms

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Backend Integration

Edit `config/auth-config.json`:

```json
{
  "backendApi": {
    "baseUrl": "https://your-backend-api.com",
    "endpoints": {
      "signin": "/api/auth/signin"
    },
    "timeout": 30000
  },
  "userCredentials": {
    "user1": {
      "username": "user@example.com",
      "password": "your_password_here"
    }
  },
  "webauthn": {
    "rpName": "Your App Name",
    "rpID": "yourdomain.com",
    "origin": "https://yourdomain.com",
    "timeout": 60000,
    "allowedOrigins": [
      "https://yourdomain.com",
      "http://localhost:3000",
      "android:apk-key-hash:YOUR_ANDROID_APP_SIGNATURE_HASH",
      "ios:bundle-id:com.yourcompany.yourapp"
    ]
  }
}
```

### 3. Start the Server

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000` by default.

## Cross-Platform Setup

This API supports passkeys across Web, Android, and iOS platforms. Each platform requires specific configuration:

### Web Applications

For web applications, use standard HTTP/HTTPS origins:

```json
{
  "webauthn": {
    "rpID": "yourdomain.com",
    "origin": "https://yourdomain.com",
    "allowedOrigins": [
      "https://yourdomain.com",
      "https://staging.yourdomain.com",
      "http://localhost:3000"
    ]
  }
}
```

### Android Applications

For Android apps, you need the APK signature hash:

1. **Get your app's signature hash:**
   ```bash
   # Using keytool (from your keystore)
   keytool -list -v -keystore your-app.keystore -alias your-alias

   # Or from APK
   keytool -printcert -jarfile your-app.apk
   ```

2. **Convert SHA256 fingerprint to base64url:**
   ```javascript
   // Example: Convert SHA256 fingerprint to base64url format
   const crypto = require('crypto');
   const fingerprint = 'AB:CD:EF:12:34:56...'; // Your SHA256 fingerprint
   const hash = fingerprint.replace(/:/g, '');
   const buffer = Buffer.from(hash, 'hex');
   const base64url = buffer.toString('base64url');
   console.log(`android:apk-key-hash:${base64url}`);
   ```

3. **Update configuration:**
   ```json
   {
     "webauthn": {
       "allowedOrigins": [
         "android:apk-key-hash:YOUR_BASE64URL_ENCODED_HASH"
       ]
     }
   }
   ```

### iOS Applications

For iOS apps, use your bundle identifier:

```json
{
  "webauthn": {
    "allowedOrigins": [
      "ios:bundle-id:com.yourcompany.yourapp"
    ]
  }
}
```

### Universal Configuration

For supporting all platforms simultaneously:

```json
{
  "webauthn": {
    "rpName": "Your App Name",
    "rpID": "yourdomain.com",
    "origin": "https://yourdomain.com",
    "timeout": 60000,
    "allowedOrigins": [
      "https://yourdomain.com",
      "https://staging.yourdomain.com",
      "http://localhost:3000",
      "android:apk-key-hash:YOUR_ANDROID_HASH",
      "ios:bundle-id:com.yourcompany.yourapp"
    ]
  }
}
```

## API Endpoints

### Health Check

- **GET** `/health` - Server health status

### Passkey Management

#### List Passkeys
- **GET** `/api/passkeys` - List all passkeys
- **GET** `/api/passkeys?userId=user1` - List passkeys for specific user
- **GET** `/api/passkeys/:id` - Get specific passkey details

#### Register Passkey
- **POST** `/api/passkeys/register/begin` - Start passkey registration
- **POST** `/api/passkeys/register/complete` - Complete passkey registration

#### Authenticate with Passkey
- **POST** `/api/passkeys/login/begin` - Start passkey authentication
- **POST** `/api/passkeys/login/complete` - Complete passkey authentication

#### Delete Passkey
- **DELETE** `/api/passkeys/:id` - Delete a specific passkey

### Backend Authentication

#### Sign In
- **POST** `/api/auth/signin` - Sign in using configured backend credentials

#### User Management
- **GET** `/api/auth/users` - List configured users
- **PUT** `/api/auth/users/:userId/credentials` - Update user credentials

#### Configuration
- **GET** `/api/auth/config` - Get WebAuthn configuration
- **PUT** `/api/auth/config` - Update WebAuthn configuration

#### Testing
- **POST** `/api/auth/test/:userId` - Test backend authentication

## Usage Examples

### 1. Register a New Passkey (Cross-Platform)

#### Web Application
```javascript
// Step 1: Begin registration
const beginResponse = await fetch('/api/passkeys/register/begin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user1',
    username: 'john@example.com',
    displayName: 'John Doe',
    platform: 'web' // Optional: will be auto-detected
  })
});

const { options, sessionId, platform } = await beginResponse.json();

// Step 2: Use WebAuthn API (browser side)
const credential = await navigator.credentials.create({
  publicKey: options
});

// Step 3: Complete registration
const completeResponse = await fetch('/api/passkeys/register/complete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user1',
    sessionId,
    credential,
    origin: window.location.origin, // Optional: auto-detected from headers
    platform: 'web' // Optional: auto-detected
  })
});
```

#### Android Application
```kotlin
// Step 1: Begin registration
val requestBody = JSONObject().apply {
    put("userId", "user1")
    put("username", "john@example.com")
    put("displayName", "John Doe")
    put("platform", "android")
}

val beginResponse = httpClient.post("/api/passkeys/register/begin") {
    contentType(ContentType.Application.Json)
    setBody(requestBody.toString())
}

val beginData = Json.decodeFromString<RegistrationBeginResponse>(beginResponse.bodyAsText())

// Step 2: Use Android Credential Manager
val createPublicKeyCredentialRequest = CreatePublicKeyCredentialRequest(
    requestJson = Json.encodeToString(beginData.options)
)

val credential = credentialManager.createCredential(
    context = context,
    request = createPublicKeyCredentialRequest
) as CreatePublicKeyCredentialResponse

// Step 3: Complete registration
val completeBody = JSONObject().apply {
    put("userId", "user1")
    put("sessionId", beginData.sessionId)
    put("credential", JSONObject(credential.registrationResponseJson))
    put("origin", "android:apk-key-hash:YOUR_HASH")
    put("platform", "android")
}

val completeResponse = httpClient.post("/api/passkeys/register/complete") {
    contentType(ContentType.Application.Json)
    setBody(completeBody.toString())
}
```

#### iOS Application
```swift
// Step 1: Begin registration
let requestBody: [String: Any] = [
    "userId": "user1",
    "username": "john@example.com",
    "displayName": "John Doe",
    "platform": "ios"
]

let beginResponse = try await httpClient.post("/api/passkeys/register/begin", body: requestBody)
let beginData = try JSONDecoder().decode(RegistrationBeginResponse.self, from: beginResponse)

// Step 2: Use ASAuthorization
let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: "yourdomain.com")
let request = provider.createCredentialRegistrationRequest(
    challenge: Data(base64URLEncoded: beginData.options.challenge)!,
    name: "john@example.com",
    userID: Data("user1".utf8)
)

let authController = ASAuthorizationController(authorizationRequests: [request])
// ... handle authorization result

// Step 3: Complete registration
let completeBody: [String: Any] = [
    "userId": "user1",
    "sessionId": beginData.sessionId,
    "credential": credentialData,
    "origin": "ios:bundle-id:com.yourcompany.yourapp",
    "platform": "ios"
]

let completeResponse = try await httpClient.post("/api/passkeys/register/complete", body: completeBody)
```

### 2. Authenticate with Passkey (Cross-Platform)

#### Web Application
```javascript
// Step 1: Begin authentication
const beginResponse = await fetch('/api/passkeys/login/begin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user1',  // Optional for usernameless flow
    platform: 'web'   // Optional: auto-detected
  })
});

const { options, sessionId, platform } = await beginResponse.json();

// Step 2: Use WebAuthn API (browser side)
const credential = await navigator.credentials.get({
  publicKey: options
});

// Step 3: Complete authentication
const completeResponse = await fetch('/api/passkeys/login/complete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId,
    credential,
    origin: window.location.origin // Optional: auto-detected
  })
});

const { user } = await completeResponse.json();
```

#### Android Application
```kotlin
// Step 1: Begin authentication
val requestBody = JSONObject().apply {
    put("userId", "user1") // Optional for usernameless
    put("platform", "android")
}

val beginResponse = httpClient.post("/api/passkeys/login/begin") {
    contentType(ContentType.Application.Json)
    setBody(requestBody.toString())
}

val beginData = Json.decodeFromString<AuthenticationBeginResponse>(beginResponse.bodyAsText())

// Step 2: Use Android Credential Manager
val getPublicKeyCredentialOption = GetPublicKeyCredentialOption(
    requestJson = Json.encodeToString(beginData.options)
)

val getCredRequest = GetCredentialRequest(
    credentialOptions = listOf(getPublicKeyCredentialOption)
)

val credentialResponse = credentialManager.getCredential(
    context = context,
    request = getCredRequest
) as GetPublicKeyCredentialResponse

// Step 3: Complete authentication
val completeBody = JSONObject().apply {
    put("sessionId", beginData.sessionId)
    put("credential", JSONObject(credentialResponse.authenticationResponseJson))
    put("origin", "android:apk-key-hash:YOUR_HASH")
}

val completeResponse = httpClient.post("/api/passkeys/login/complete") {
    contentType(ContentType.Application.Json)
    setBody(completeBody.toString())
}
```

#### iOS Application
```swift
// Step 1: Begin authentication
let requestBody: [String: Any] = [
    "userId": "user1", // Optional for usernameless
    "platform": "ios"
]

let beginResponse = try await httpClient.post("/api/passkeys/login/begin", body: requestBody)
let beginData = try JSONDecoder().decode(AuthenticationBeginResponse.self, from: beginResponse)

// Step 2: Use ASAuthorization
let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: "yourdomain.com")
let request = provider.createCredentialAssertionRequest(
    challenge: Data(base64URLEncoded: beginData.options.challenge)!
)

let authController = ASAuthorizationController(authorizationRequests: [request])
// ... handle authorization result

// Step 3: Complete authentication
let completeBody: [String: Any] = [
    "sessionId": beginData.sessionId,
    "credential": credentialData,
    "origin": "ios:bundle-id:com.yourcompany.yourapp"
]

let completeResponse = try await httpClient.post("/api/passkeys/login/complete", body: completeBody)
```

### 3. Enhanced Authentication Flow (Passkey + Backend)

When passkey authentication is successful, the API automatically attempts to sign the user into your backend system using their configured credentials. This creates a seamless single-step authentication process.

#### Successful Flow Response
```json
{
  "success": true,
  "message": "Authentication successful",
  "user": {
    "userId": "user1",
    "username": "john@example.com",
    "passkeyId": "abc123"
  },
  "authenticatedAt": "2024-01-01T00:00:00.000Z",
  "backendAuthentication": {
    "success": true,
    "message": "Backend signin successful",
    "data": {
      "token": "jwt_token_here",
      "user": { /* backend user data */ }
    },
    "status": 200
  }
}
```

#### Failed Backend Authentication
```json
{
  "success": true,
  "message": "Authentication successful",
  "user": { /* passkey user data */ },
  "authenticatedAt": "2024-01-01T00:00:00.000Z",
  "backendAuthentication": {
    "success": false,
    "message": "Backend signin failed",
    "error": { /* backend error details */ }
  },
  "warning": "Passkey authentication successful but backend signin failed"
}
```

#### Skip Backend Authentication
```javascript
// If you want only passkey authentication without backend signin:
const completeResponse = await fetch('/api/passkeys/login/complete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId,
    credential,
    skipBackendAuth: true // Skip automatic backend signin
  })
});
```

### 4. Manual Backend Sign In

```javascript
const response = await fetch('/api/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user1'
  })
});

const result = await response.json();
// result.backendResponse contains the response from your backend API
```

## Data Storage

The API uses JSON files for storage:

- `data/passkeys.json` - Passkey credentials and metadata
- `data/users.json` - User information
- `data/sessions.json` - Temporary session data for WebAuthn challenges

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)
- `ALLOWED_ORIGINS` - CORS allowed origins (comma-separated)

### WebAuthn Configuration

Update the WebAuthn settings in `config/auth-config.json`:

- `rpName` - Relying Party name (your app name)
- `rpID` - Relying Party ID (your domain)
- `origin` - Expected origin for WebAuthn operations
- `timeout` - Timeout for WebAuthn operations (ms)

## Security Considerations

This is a **temporary solution** for development/testing:

- Uses file-based storage (not suitable for production)
- Stores credentials in plain text config files
- No rate limiting or advanced security features
- Intended for development and testing only

## Project Structure

```
passkey-node/
├── src/
│   ├── controllers/     # Route handlers (future use)
│   ├── middleware/      # Express middleware
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── server.js        # Main server file
├── config/              # Configuration files
├── data/                # JSON data storage
└── package.json
```

## Dependencies

### Main Dependencies
- `express` - Web framework
- `@simplewebauthn/server` - WebAuthn server implementation
- `axios` - HTTP client for backend integration
- `cors` - CORS middleware
- `helmet` - Security middleware
- `joi` - Request validation
- `uuid` - UUID generation

### Development Dependencies
- `nodemon` - Development server with auto-restart

## API Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Error responses:

```json
{
  "error": true,
  "message": "Error description",
  "details": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Maintenance

### Cleanup Expired Sessions

```bash
curl -X POST http://localhost:3000/api/passkeys/cleanup
```

### Monitor Data Files

Check the `data/` directory for JSON files:
- Monitor file sizes
- Backup important data
- Clean up old session data

## Migration Notes

When moving to a production backend:

1. Export passkey data from JSON files
2. Import into your production database
3. Update client-side code to use new endpoints
4. Implement proper user management
5. Add security features (rate limiting, encryption, etc.)

## Platform-Specific Notes

### Web Applications
- **HTTPS Required**: Passkeys require HTTPS in production (localhost HTTP is allowed for development)
- **User Activation**: WebAuthn requires user activation (user gesture like click)
- **Browser Support**: Modern browsers support WebAuthn (Chrome 67+, Firefox 60+, Safari 14+)

### Android Applications
- **Minimum API**: Android 9 (API level 28) or higher for native passkey support
- **Credential Manager**: Use `androidx.credentials:credentials` for best compatibility
- **App Signature**: Ensure your APK signature hash is correctly configured
- **Play Services**: Google Play Services 23.0+ required for passkey functionality

#### Android Dependencies
```gradle
implementation "androidx.credentials:credentials:1.2.0"
implementation "androidx.credentials:credentials-play-services-auth:1.2.0"
```

### iOS Applications
- **iOS Version**: iOS 16.0+ for full passkey support (iOS 15.0+ for basic WebAuthn)
- **Entitlements**: Add webcredentials entitlement to your app
- **Associated Domains**: Configure associated domains in your app and website
- **Bundle ID**: Ensure your bundle ID exactly matches the configuration

#### iOS Entitlements
```xml
<key>com.apple.developer.web-credentials</key>
<array>
    <string>yourdomain.com</string>
</array>
```

#### Associated Domains
```xml
<key>com.apple.developer.associated-domains</key>
<array>
    <string>webcredentials:yourdomain.com</string>
</array>
```

## Troubleshooting

### Common Issues

1. **WebAuthn not working**: Check `rpID` and `origin` in config
2. **Backend authentication failing**: Verify credentials in config file
3. **CORS errors**: Update `ALLOWED_ORIGINS` environment variable
4. **Port conflicts**: Change `PORT` environment variable
5. **Android signature mismatch**: Verify APK signature hash in allowedOrigins
6. **iOS bundle ID mismatch**: Ensure bundle ID matches exactly in config
7. **Mobile origin errors**: Check platform-specific origin formatting

### Platform-Specific Debugging

#### Web
- Check browser console for WebAuthn errors
- Verify HTTPS requirements
- Test user activation requirements

#### Android
- Use `adb logcat` to see credential manager logs
- Verify Google Play Services version
- Check app signature with `keytool`

#### iOS
- Check Xcode console for ASAuthorization errors
- Verify associated domains configuration
- Test on physical device (simulator has limitations)

### Debug Mode

Set `NODE_ENV=development` for detailed error messages and stack traces.

## License

MIT License - This is a temporary development tool.