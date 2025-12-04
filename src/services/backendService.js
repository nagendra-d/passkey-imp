const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

class BackendService {
  constructor() {
    this.config = null;
    this.loadConfig();
  }

  async loadConfig() {
    try {
      const configPath = path.join(__dirname, '../../config/auth-config.json');
      const configData = await fs.readFile(configPath, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      console.error('Error loading backend service config:', error);
      throw new Error('Backend service configuration not found');
    }
  }

  async ensureConfigLoaded() {
    if (!this.config) {
      await this.loadConfig();
    }
  }

  async authenticateUser(userId) {
    await this.ensureConfigLoaded();

    // Get user credentials from config
    const userCredentials = this.config.userCredentials[userId];
    if (!userCredentials) {
      throw new Error(`No credentials configured for user: ${userId}`);
    }

    const { baseUrl, endpoints, timeout } = this.config.backendApi;
    const signinUrl = `${baseUrl}${endpoints.signin}`;

    try {
      // Make API request to your backend
      const response = await axios.post(
        signinUrl,
        {
          "version": 4,
          "grant_type": "password",
          "product_guid": "9b1b8c63-1354-2078-e053-0100007f2fee",
          username: userCredentials.username,
          password: userCredentials.password
        },
        {
          timeout: timeout || 30000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Passkey-Backend-API/1.0.0'
          }
        }
      );

      // Return the backend response
      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers
      };

    } catch (error) {
      console.error('Backend authentication error:', error.message);

      if (error.response) {
        // Backend responded with error
        return {
          success: false,
          error: {
            message: error.response.data?.message || 'Authentication failed',
            status: error.response.status,
            data: error.response.data
          }
        };
      } else if (error.request) {
        // Network error
        return {
          success: false,
          error: {
            message: 'Unable to connect to backend service',
            status: 503,
            data: null
          }
        };
      } else {
        // Other error
        return {
          success: false,
          error: {
            message: error.message || 'Unknown error occurred',
            status: 500,
            data: null
          }
        };
      }
    }
  }

  async getUserCredentials(userId) {
    await this.ensureConfigLoaded();
    return this.config.userCredentials[userId] || null;
  }

  async updateUserCredentials(userId, credentials) {
    await this.ensureConfigLoaded();

    this.config.userCredentials[userId] = credentials;

    // Save updated config back to file
    const configPath = path.join(__dirname, '../../config/auth-config.json');
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));

    return true;
  }

  async getAvailableUsers() {
    await this.ensureConfigLoaded();
    return Object.keys(this.config.userCredentials);
  }

  async getWebAuthnConfig() {
    await this.ensureConfigLoaded();
    return this.config.webauthn;
  }

  async updateWebAuthnConfig(newConfig) {
    await this.ensureConfigLoaded();

    this.config.webauthn = { ...this.config.webauthn, ...newConfig };

    // Save updated config back to file
    const configPath = path.join(__dirname, '../../config/auth-config.json');
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));

    return this.config.webauthn;
  }
}

// Export singleton instance
module.exports = new BackendService();