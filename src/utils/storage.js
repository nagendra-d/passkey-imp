const fs = require('fs').promises;
const path = require('path');

class JSONStorage {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.passkeyFile = path.join(this.dataDir, 'passkeys.json');
    this.userFile = path.join(this.dataDir, 'users.json');
    this.sessionFile = path.join(this.dataDir, 'sessions.json');

    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataDir, { recursive: true });

      // Initialize files if they don't exist
      await this.initializeFile(this.passkeyFile, {});
      await this.initializeFile(this.userFile, {});
      await this.initializeFile(this.sessionFile, {});
    } catch (error) {
      console.error('Error initializing storage:', error);
    }
  }

  async initializeFile(filePath, defaultData) {
    try {
      await fs.access(filePath);
    } catch {
      // File doesn't exist, create it
      await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
    }
  }

  async readJSON(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error);
      return {};
    }
  }

  async writeJSON(filePath, data) {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Error writing ${filePath}:`, error);
      return false;
    }
  }

  // Passkey operations
  async getPasskeys(userId = null) {
    const passkeys = await this.readJSON(this.passkeyFile);

    if (userId) {
      return Object.values(passkeys).filter(passkey => passkey.userId === userId);
    }

    return Object.values(passkeys);
  }

  async getPasskeyById(passkeyId) {
    const passkeys = await this.readJSON(this.passkeyFile);
    return passkeys[passkeyId] || null;
  }

  async savePasskey(passkeyId, passkeyData) {
    const passkeys = await this.readJSON(this.passkeyFile);
    passkeys[passkeyId] = {
      ...passkeyData,
      id: passkeyId,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    return await this.writeJSON(this.passkeyFile, passkeys);
  }

  async deletePasskey(passkeyId) {
    const passkeys = await this.readJSON(this.passkeyFile);

    if (passkeys[passkeyId]) {
      delete passkeys[passkeyId];
      return await this.writeJSON(this.passkeyFile, passkeys);
    }

    return false;
  }

  async updatePasskeyLastUsed(passkeyId) {
    const passkeys = await this.readJSON(this.passkeyFile);

    if (passkeys[passkeyId]) {
      passkeys[passkeyId].lastUsed = new Date().toISOString();
      return await this.writeJSON(this.passkeyFile, passkeys);
    }

    return false;
  }

  // User operations
  async getUser(userId) {
    const users = await this.readJSON(this.userFile);
    return users[userId] || null;
  }

  async saveUser(userId, userData) {
    const users = await this.readJSON(this.userFile);
    users[userId] = {
      ...userData,
      id: userId,
      createdAt: users[userId]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return await this.writeJSON(this.userFile, users);
  }

  async getAllUsers() {
    const users = await this.readJSON(this.userFile);
    return Object.values(users);
  }

  // Challenge/Session operations (for WebAuthn)
  async saveChallenge(sessionId, challengeData) {
    const sessions = await this.readJSON(this.sessionFile);
    sessions[sessionId] = {
      ...challengeData,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
    };

    return await this.writeJSON(this.sessionFile, sessions);
  }

  async getChallenge(sessionId) {
    const sessions = await this.readJSON(this.sessionFile);
    const session = sessions[sessionId];

    if (!session) return null;

    // Check if expired
    if (new Date() > new Date(session.expiresAt)) {
      await this.deleteChallenge(sessionId);
      return null;
    }

    return session;
  }

  async deleteChallenge(sessionId) {
    const sessions = await this.readJSON(this.sessionFile);

    if (sessions[sessionId]) {
      delete sessions[sessionId];
      return await this.writeJSON(this.sessionFile, sessions);
    }

    return false;
  }

  // Cleanup expired sessions
  async cleanupExpiredSessions() {
    const sessions = await this.readJSON(this.sessionFile);
    const now = new Date();
    let cleaned = false;

    for (const [sessionId, session] of Object.entries(sessions)) {
      if (new Date(session.expiresAt) < now) {
        delete sessions[sessionId];
        cleaned = true;
      }
    }

    if (cleaned) {
      await this.writeJSON(this.sessionFile, sessions);
    }

    return cleaned;
  }
}

// Export singleton instance
module.exports = new JSONStorage();