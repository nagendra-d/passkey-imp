const express = require('express');
const router = express.Router();

const webauthnService = require('../services/webauthnService');
const storage = require('../utils/kv-storage');
const backendService = require('../services/backendService');
const { validateRequest, schemas } = require('../middleware/validation');

// GET /api/passkeys - List all passkeys or passkeys for a specific user
router.get('/', async (req, res, next) => {
  try {
    const { userId } = req.query;
    const passkeys = await storage.getPasskeys(userId);

    // Remove sensitive data before sending
    const sanitizedPasskeys = passkeys.map(passkey => ({
      id: passkey.id,
      userId: passkey.userId,
      username: passkey.username,
      displayName: passkey.displayName,
      credentialDeviceType: passkey.credentialDeviceType,
      credentialBackedUp: passkey.credentialBackedUp,
      transports: passkey.transports,
      platform: passkey.platform || 'web',
      registeredFrom: passkey.registeredFrom,
      createdAt: passkey.createdAt,
      lastUsed: passkey.lastUsed,
      counter: passkey.counter
    }));

    res.json({
      success: true,
      passkeys: sanitizedPasskeys,
      count: sanitizedPasskeys.length,
      filteredBy: userId ? { userId } : null
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/passkeys/:id - Get specific passkey details
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const passkey = await storage.getPasskeyById(id);

    if (!passkey) {
      return res.status(404).json({
        error: true,
        message: 'Passkey not found'
      });
    }

    // Remove sensitive data
    const sanitizedPasskey = {
      id: passkey.id,
      userId: passkey.userId,
      username: passkey.username,
      displayName: passkey.displayName,
      credentialDeviceType: passkey.credentialDeviceType,
      credentialBackedUp: passkey.credentialBackedUp,
      transports: passkey.transports,
      createdAt: passkey.createdAt,
      lastUsed: passkey.lastUsed,
      counter: passkey.counter
    };

    res.json({
      success: true,
      passkey: sanitizedPasskey
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/passkeys/register/begin - Start passkey registration
router.post('/register/begin', validateRequest(schemas.registerBegin), async (req, res, next) => {
  try {
    const { userId, username, displayName, platform } = req.body;

    // Detect platform from request
    const userAgent = req.get('User-Agent') || '';
    const detectedPlatform = webauthnService.detectPlatform(userAgent, platform);

    const result = await webauthnService.generateRegistrationOptions(
      userId,
      username,
      displayName,
      detectedPlatform
    );

    res.json({
      success: true,
      ...result.options,
      userId: result.options.user.id,
      username: result.options.user.name,
      displayName: result.options.user.displayName,
      sessionId: result.sessionId,
      platform: detectedPlatform,
      message: 'Registration options generated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/passkeys/register/complete - Complete passkey registration
router.post('/register/complete', validateRequest(schemas.registerComplete), async (req, res, next) => {
  try {
    const { userId, sessionId, credential, origin, platform } = req.body;

    // Get origin from request if not provided
    const requestOrigin = "nagender.in";

    // Detect platform from request
    const userAgent = req.get('User-Agent') || '';
    const detectedPlatform = webauthnService.detectPlatform(userAgent, platform);

    const result = await webauthnService.verifyRegistration(
      sessionId,
      credential,
      userId,
      requestOrigin,
      detectedPlatform
    );

    if (result.verified) {
      res.json({
        success: true,
        message: 'Passkey registered successfully',
        passkeyId: result.passkeyId,
        passkey: {
          id: result.passkey.id,
          userId: result.passkey.userId,
          username: result.passkey.username,
          displayName: result.passkey.displayName,
          credentialDeviceType: result.passkey.credentialDeviceType,
          credentialBackedUp: result.passkey.credentialBackedUp,
          transports: result.passkey.transports,
          createdAt: result.passkey.createdAt
        }
      });
    } else {
      res.status(400).json({
        error: true,
        message: 'Passkey registration failed'
      });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/passkeys/login/begin - Start passkey authentication
router.post('/login/begin', validateRequest(schemas.loginBegin), async (req, res, next) => {
  try {
    const { userId, username, platform } = req.body;

    // If username provided, find userId
    let targetUserId = userId;
    if (!targetUserId && username) {
      const allUsers = await storage.getAllUsers();
      const user = allUsers.find(u => u.username === username);
      targetUserId = user?.id;
    }

    // Detect platform from request
    const userAgent = req.get('User-Agent') || '';
    const detectedPlatform = webauthnService.detectPlatform(userAgent, platform);

    const result = await webauthnService.generateAuthenticationOptions(targetUserId, detectedPlatform);

    res.json({
      success: true,
      ...result.options,
      sessionId: result.sessionId,
      platform: detectedPlatform,
      message: 'Authentication options generated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/passkeys/login/complete - Complete passkey authentication
router.post('/login/complete', validateRequest(schemas.loginComplete), async (req, res, next) => {
  try {
    const { sessionId, credential, origin, skipBackendAuth } = req.body;

    // Get origin from request if not provided
    const requestOrigin = origin || req.get('Origin') || req.get('Referer');

    const result = await webauthnService.verifyAuthentication(sessionId, credential, requestOrigin);

    if (result.verified) {
      const authenticatedAt = new Date().toISOString();

      // Prepare base response
      const baseResponse = {
        success: true,
        message: 'Authentication successful',
        user: {
          userId: result.userId,
          username: result.username,
          passkeyId: result.passkeyId
        },
        authenticatedAt
      };

      // Check if backend authentication should be skipped
      if (skipBackendAuth) {
        // Skip backend authentication, return passkey success only
        res.json({
          ...baseResponse,
          backendAuthentication: {
            skipped: true,
            message: 'Backend authentication skipped by request'
          }
        });
        return;
      }

      // Attempt backend authentication
      try {
        console.log(`Attempting backend signin for user: ${result.userId}`);
        const backendResult = await backendService.authenticateUser(result.userId);

        if (backendResult.success) {
          // Backend signin successful - include backend response
          res.json({
            ...baseResponse,
            backendAuthentication: {
              success: true,
              message: 'Backend signin successful',
              data: backendResult.data,
              status: backendResult.status
            }
          });
        } else {
          // Backend signin failed - still return successful passkey auth but with backend error
          res.json({
            ...baseResponse,
            backendAuthentication: {
              success: false,
              message: 'Backend signin failed',
              error: backendResult.error
            },
            warning: 'Passkey authentication successful but backend signin failed'
          });
        }
      } catch (backendError) {
        console.error('Backend authentication error:', backendError.message);

        // Backend service error - check if user has configured credentials
        try {
          const userCredentials = await backendService.getUserCredentials(result.userId);

          if (!userCredentials) {
            // No credentials configured
            res.json({
              ...baseResponse,
              backendAuthentication: {
                success: false,
                message: `No backend credentials configured for user: ${result.userId}`,
                availableUsers: await backendService.getAvailableUsers()
              },
              warning: 'Passkey authentication successful but no backend credentials configured'
            });
          } else {
            // Credentials exist but backend call failed
            res.json({
              ...baseResponse,
              backendAuthentication: {
                success: false,
                message: 'Backend service error',
                error: backendError.message
              },
              warning: 'Passkey authentication successful but backend service unavailable'
            });
          }
        } catch (credentialError) {
          // Complete backend service failure
          res.json({
            ...baseResponse,
            backendAuthentication: {
              success: false,
              message: 'Backend service unavailable',
              error: credentialError.message
            },
            warning: 'Passkey authentication successful but backend service unavailable'
          });
        }
      }
    } else {
      res.status(401).json({
        error: true,
        message: 'Authentication failed'
      });
    }
  } catch (error) {
    next(error);
  }
});

// DELETE /api/passkeys/:id - Delete a specific passkey
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if passkey exists
    const existingPasskey = await storage.getPasskeyById(id);
    if (!existingPasskey) {
      return res.status(404).json({
        error: true,
        message: 'Passkey not found'
      });
    }

    const deleted = await storage.deletePasskey(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Passkey deleted successfully',
        deletedPasskey: {
          id: existingPasskey.id,
          userId: existingPasskey.userId,
          username: existingPasskey.username,
          deletedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        error: true,
        message: 'Failed to delete passkey'
      });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/passkeys/cleanup - Cleanup expired sessions (maintenance endpoint)
router.post('/cleanup', async (req, res, next) => {
  try {
    const cleaned = await storage.cleanupExpiredSessions();

    res.json({
      success: true,
      message: cleaned ? 'Expired sessions cleaned up' : 'No expired sessions to clean',
      cleanedUp: cleaned
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
