const { kv } = require('@vercel/kv');

class KVStorage {
    constructor() {
        // Prefix keys to separate namespaces
        this.passkeyPrefix = "passkeys:";
        this.userPrefix = "users:";
        this.sessionPrefix = "sessions:";
    }

    // Helper for building KV keys
    key(prefix, id) {
        return `${prefix}${id}`;
    }

    /* -----------------------------
     * PASSKEY OPERATIONS
     * ----------------------------- */

    async getPasskeys(userId = null) {
        const keys = await kv.keys(`${this.passkeyPrefix}*`);
        const passkeys = [];

        for (const key of keys) {
            const item = await kv.get(key);
            if (!userId || item.userId === userId) {
                passkeys.push(item);
            }
        }

        return passkeys;
    }

    async getPasskeyById(passkeyId) {
        return await kv.get(this.key(this.passkeyPrefix, passkeyId));
    }

    async savePasskey(passkeyId, passkeyData) {
        const data = {
            ...passkeyData,
            id: passkeyId,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        };

        await kv.set(this.key(this.passkeyPrefix, passkeyId), data);
        return true;
    }

    async updatePasskeyLastUsed(passkeyId) {
        const passkey = await this.getPasskeyById(passkeyId);
        if (!passkey) return false;

        passkey.lastUsed = new Date().toISOString();
        await kv.set(this.key(this.passkeyPrefix, passkeyId), passkey);
        return true;
    }

    async deletePasskey(passkeyId) {
        await kv.del(this.key(this.passkeyPrefix, passkeyId));
        return true;
    }

    /* -----------------------------
     * USER OPERATIONS
     * ----------------------------- */

    async getUser(userId) {
        return await kv.get(this.key(this.userPrefix, userId));
    }

    async saveUser(userId, userData) {
        const existing = await this.getUser(userId);
        const newData = {
            ...userData,
            id: userId,
            createdAt: existing?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await kv.set(this.key(this.userPrefix, userId), newData);
        return true;
    }

    async getAllUsers() {
        const keys = await kv.keys(`${this.userPrefix}*`);
        const users = [];

        for (const key of keys) {
            users.push(await kv.get(key));
        }

        return users;
    }

    /* -----------------------------
     * SESSION / CHALLENGE OPERATIONS
     * For WebAuthn challenge storage
     * ----------------------------- */

    async saveChallenge(sessionId, challengeData) {
        const session = {
            ...challengeData,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
        };

        // Set key with expiration (5 minutes)
        await kv.set(this.key(this.sessionPrefix, sessionId), session, {
            ex: 5 * 60
        });

        return true;
    }

    async getChallenge(sessionId) {
        return await kv.get(this.key(this.sessionPrefix, sessionId));
    }

    async deleteChallenge(sessionId) {
        await kv.del(this.key(this.sessionPrefix, sessionId));
        return true;
    }

    // Not needed—KV automatically TTLs expired keys
    async cleanupExpiredSessions() {
        return false;
    }
}

module.exports = new KVStorage();
