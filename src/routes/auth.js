const express = require('express');
const router = express.Router();

const backendService = require('../services/backendService');
const { validateRequest, schemas } = require('../middleware/validation');

// POST /api/auth/signin - Sign in with configured backend credentials
router.post('/signin', validateRequest(schemas.signin), async (req, res, next) => {
  try {
    const { userId, sessionToken } = req.body;

    // Check if user has configured credentials
    const userCredentials = await backendService.getUserCredentials(userId);
    if (!userCredentials) {
      return res.status(404).json({
        error: true,
        message: `No credentials configured for user: ${userId}`,
        availableUsers: await backendService.getAvailableUsers()
      });
    }

    // Authenticate with backend
    const result = await backendService.authenticateUser(userId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Authentication successful',
        userId,
        username: userCredentials.username,
        backendResponse: result.data,
        authenticatedAt: new Date().toISOString(),
        ...(sessionToken && { sessionToken })
      });
    } else {
      res.status(result.error.status || 401).json({
        error: true,
        message: result.error.message || 'Authentication failed',
        details: result.error.data,
        userId
      });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/users - List available configured users
router.get('/users', async (req, res, next) => {
  try {
    const availableUsers = await backendService.getAvailableUsers();
    const userDetails = {};

    for (const userId of availableUsers) {
      const credentials = await backendService.getUserCredentials(userId);
      userDetails[userId] = {
        username: credentials.username,
        hasPassword: !!credentials.password
      };
    }

    res.json({
      success: true,
      users: availableUsers,
      userDetails,
      count: availableUsers.length
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/auth/users/:userId/credentials - Update user credentials (for configuration)
router.put('/users/:userId/credentials', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: true,
        message: 'Both username and password are required'
      });
    }

    await backendService.updateUserCredentials(userId, { username, password });

    res.json({
      success: true,
      message: 'User credentials updated successfully',
      userId,
      username
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/config - Get WebAuthn configuration
router.get('/config', async (req, res, next) => {
  try {
    const config = await backendService.getWebAuthnConfig();

    res.json({
      success: true,
      config
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/auth/config - Update WebAuthn configuration
router.put('/config', async (req, res, next) => {
  try {
    const { rpName, rpID, origin, timeout } = req.body;

    const updates = {};
    if (rpName) updates.rpName = rpName;
    if (rpID) updates.rpID = rpID;
    if (origin) updates.origin = origin;
    if (timeout) updates.timeout = parseInt(timeout);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: true,
        message: 'No valid configuration updates provided'
      });
    }

    const updatedConfig = await backendService.updateWebAuthnConfig(updates);

    res.json({
      success: true,
      message: 'WebAuthn configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/test/:userId - Test backend authentication for a user
router.post('/test/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;

    const result = await backendService.authenticateUser(userId);

    res.json({
      success: result.success,
      message: result.success ? 'Backend authentication test successful' : 'Backend authentication test failed',
      userId,
      result: result.success ? {
        status: result.status,
        data: result.data
      } : {
        error: result.error
      },
      testedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;