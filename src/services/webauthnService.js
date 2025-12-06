const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { v4: uuidv4 } = require('uuid');

const storage = require('../utils/kv-storage');
const backendService = require('./backendService');

class WebAuthnService {
  constructor() {
    this.rpName = 'Passkey Backend API';
    this.rpID = 'localhost';
    this.origin = 'http://localhost:3000';
    this.timeout = 60000;

    // Cross-platform origins for mobile apps
    this.allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      'android:apk-key-hash:REPLACE_WITH_YOUR_ANDROID_APP_SIGNATURE_HASH',
      'ios:bundle-id:REPLACE_WITH_YOUR_IOS_BUNDLE_ID'
    ];

    this.initializeConfig();
  }

  async initializeConfig() {
    try {
      const config = await backendService.getWebAuthnConfig();
      this.rpName = config.rpName || this.rpName;
      this.rpID = config.rpID || this.rpID;
      this.origin = config.origin || this.origin;
      this.timeout = config.timeout || this.timeout;
      this.allowedOrigins = config.allowedOrigins || this.allowedOrigins;
    } catch (error) {
      console.warn('Using default WebAuthn config:', error.message);
    }
  }

  // Platform-specific authenticator selection
  getAuthenticatorSelection(platform) {
    const baseSelection = {
      residentKey: 'preferred',
      userVerification: 'preferred',
    };

    switch (platform.toLowerCase()) {
      case 'android':
        return {
          ...baseSelection,
          authenticatorAttachment: 'platform', // Prefer platform authenticators
          requireResidentKey: false,
        };
      case 'ios':
        return {
          ...baseSelection,
          authenticatorAttachment: 'platform', // Face ID, Touch ID
          requireResidentKey: false,
        };
      case 'web':
      default:
        return {
          ...baseSelection,
          // Don't specify authenticatorAttachment for web to allow both platform and cross-platform
          requireResidentKey: false,
        };
    }
  }

  // Platform-specific transport configurations
  getTransportsForPlatform(originalTransports, platform) {
    const allTransports = ['usb', 'nfc', 'ble', 'smart-card', 'hybrid', 'internal'];

    switch (platform.toLowerCase()) {
      case 'android':
        // Android supports all transports but prioritize internal and hybrid
        return originalTransports || ['internal', 'hybrid', 'nfc', 'ble', 'usb'];
      case 'ios':
        // iOS primarily uses internal (Face ID/Touch ID) and hybrid
        return originalTransports || ['internal', 'hybrid'];
      case 'web':
      default:
        // Web supports all transports
        return originalTransports || ['internal', 'hybrid', 'usb', 'nfc', 'ble'];
    }
  }

  // Determine platform from user agent or explicit parameter
  detectPlatform(userAgent = '', explicitPlatform = null) {
    if (explicitPlatform) {
      return explicitPlatform.toLowerCase();
    }

    const ua = userAgent.toLowerCase();

    if (ua.includes('android')) {
      return 'android';
    } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
      return 'ios';
    } else {
      return 'web';
    }
  }

  // Validate origin based on platform
  isValidOrigin(origin, platform) {
    if (this.allowedOrigins.includes(origin)) {
      return true;
    }

    switch (platform.toLowerCase()) {
      case 'android':
        return origin.startsWith('android:apk-key-hash:');
      case 'ios':
        return origin.startsWith('ios:bundle-id:');
      case 'web':
        return origin.startsWith('http://') || origin.startsWith('https://');
      default:
        return false;
    }
  }

  async generateRegistrationOptions(userId, username, displayName, platform = 'web') {
    await this.initializeConfig();

    // Get existing passkeys for this user
    const existingPasskeys = await storage.getPasskeys(userId);
    const excludeCredentials = existingPasskeys.map(passkey => ({
      id: passkey.credentialID,
      type: 'public-key',
      transports: this.getTransportsForPlatform(passkey.transports, platform),
    }));

    // Platform-specific authenticator selection
    const authenticatorSelection = this.getAuthenticatorSelection(platform);

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: userId,
      userName: username,
      userDisplayName: displayName || username,
      timeout: this.timeout,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection,
      supportedAlgorithmIDs: [-7, -257, -35, -36, -37, -38, -39], // ES256, RS256, ES384, ES512, PS256, PS384, PS512
    });

    // Store challenge for verification
    const sessionId = uuidv4();
    await storage.saveChallenge(sessionId, {
      challenge: options.challenge,
      userId,
      username,
      displayName,
      platform,
      type: 'registration'
    });
console.log(options);
    return {
      options,
      sessionId
    };
  }

  async verifyRegistration(sessionId, credential, userId, origin = null, platform = 'web') {
    await this.initializeConfig();

    // Get stored challenge
    const challengeData = await storage.getChallenge(sessionId);
    if (!challengeData || challengeData.type !== 'registration') {
      throw new Error('Invalid or expired registration session');
    }

    if (challengeData.userId !== userId) {
      throw new Error('User ID mismatch');
    }

    // Determine expected origin
    let expectedOrigin = origin || this.origin;

    // For mobile platforms, we need to validate against allowed origins
    if (platform !== 'web' && origin) {
      if (!this.isValidOrigin(origin, platform)) {
        throw new Error(`Invalid origin for ${platform} platform: ${origin}`);
      }
      expectedOrigin = origin;
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: expectedOrigin,
      expectedRPID: this.rpID,
    });

    if (!verification.verified) {
      throw new Error('Registration verification failed');
    }

    // Save the passkey
    const passkeyId = uuidv4();
    const passkeyData = {
      userId: challengeData.userId,
      username: challengeData.username,
      displayName: challengeData.displayName,
      credentialID: verification.registrationInfo.credentialID,
      credentialPublicKey: verification.registrationInfo.credentialPublicKey,
      counter: verification.registrationInfo.counter,
      credentialDeviceType: verification.registrationInfo.credentialDeviceType,
      credentialBackedUp: verification.registrationInfo.credentialBackedUp,
      transports: credential.response.transports || this.getTransportsForPlatform(null, challengeData.platform || platform),
      aaguid: verification.registrationInfo.aaguid,
      platform: challengeData.platform || platform,
      registeredFrom: expectedOrigin,
    };

    await storage.savePasskey(passkeyId, passkeyData);

    // Save user info
    await storage.saveUser(challengeData.userId, {
      username: challengeData.username,
      displayName: challengeData.displayName,
    });

    // Clean up challenge
    await storage.deleteChallenge(sessionId);

    return {
      verified: true,
      passkeyId,
      passkey: passkeyData
    };
  }

  async generateAuthenticationOptions(userId = null, platform = 'web') {
    await this.initializeConfig();

    let allowCredentials = [];

    if (userId) {
      // Get passkeys for specific user
      const userPasskeys = await storage.getPasskeys(userId);
      allowCredentials = userPasskeys.map(passkey => ({
        id: passkey.credentialID,
        type: 'public-key',
        transports: this.getTransportsForPlatform(passkey.transports, platform),
      }));
    } else {
      // Get all passkeys for usernameless authentication
      const allPasskeys = await storage.getPasskeys();
      allowCredentials = allPasskeys.map(passkey => ({
        id: passkey.credentialID,
        type: 'public-key',
        transports: this.getTransportsForPlatform(passkey.transports, platform),
      }));
    }

    const options = await generateAuthenticationOptions({
      timeout: this.timeout,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'preferred',
      rpID: this.rpID,
    });

    // Store challenge for verification
    const sessionId = uuidv4();
    await storage.saveChallenge(sessionId, {
      challenge: options.challenge,
      userId,
      platform,
      type: 'authentication'
    });

    return {
      options,
      sessionId
    };
  }

  async verifyAuthentication(sessionId, credential, origin = null) {
    await this.initializeConfig();

    // Get stored challenge
    const challengeData = await storage.getChallenge(sessionId);
    if (!challengeData || challengeData.type !== 'authentication') {
      throw new Error('Invalid or expired authentication session');
    }

    // Find the passkey by credential ID
    const allPasskeys = await storage.getPasskeys();
    const passkey = allPasskeys.find(p =>
      Buffer.from(p.credentialID).equals(Buffer.from(credential.id, 'base64url'))
    );

    if (!passkey) {
      throw new Error('Passkey not found');
    }

    // Determine expected origin
    const platform = challengeData.platform || 'web';
    let expectedOrigin = origin || this.origin;

    // For mobile platforms, validate origin
    if (platform !== 'web' && origin) {
      if (!this.isValidOrigin(origin, platform)) {
        throw new Error(`Invalid origin for ${platform} platform: ${origin}`);
      }
      expectedOrigin = origin;
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: expectedOrigin,
      expectedRPID: this.rpID,
      authenticator: {
        credentialID: passkey.credentialID,
        credentialPublicKey: passkey.credentialPublicKey,
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });

    if (!verification.verified) {
      throw new Error('Authentication verification failed');
    }

    // Update counter and last used
    await storage.savePasskey(passkey.id, {
      ...passkey,
      counter: verification.authenticationInfo.newCounter,
    });
    await storage.updatePasskeyLastUsed(passkey.id);

    // Clean up challenge
    await storage.deleteChallenge(sessionId);

    return {
      verified: true,
      userId: passkey.userId,
      username: passkey.username,
      passkeyId: passkey.id,
      passkey
    };
  }
}

// Export singleton instance
module.exports = new WebAuthnService();
