/**
 * Secure Storage for Extension Credentials
 * 
 * Provides encrypted storage for sensitive extension data (tokens, API keys).
 * Uses Web Crypto API for encryption in the browser.
 */

/**
 * Secure storage interface for extensions
 */
export class SecureStorage {
  private static readonly STORAGE_KEY_PREFIX = 'ext_secure_';
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  
  /**
   * Generate or retrieve encryption key for an extension
   */
  private static async getEncryptionKey(extensionName: string): Promise<CryptoKey> {
    // In browser: use IndexedDB to store key material
    // For now, we'll generate a key from a password (extension name + machine ID)
    // In production, this should use a more secure key derivation
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(extensionName + '_mission_control'),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('openclaw_mc_salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  /**
   * Encrypt and store sensitive data
   */
  static async setItem(extensionName: string, key: string, value: string): Promise<void> {
    if (typeof window === 'undefined' || !crypto.subtle) {
      throw new Error('Secure storage not available in this environment');
    }
    
    try {
      const encryptionKey = await this.getEncryptionKey(extensionName);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encodedValue = new TextEncoder().encode(value);
      
      const encrypted = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv },
        encryptionKey,
        encodedValue
      );
      
      // Store IV + encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      // Convert to base64 and store in localStorage
      const base64 = btoa(String.fromCharCode(...combined));
      localStorage.setItem(
        `${this.STORAGE_KEY_PREFIX}${extensionName}_${key}`,
        base64
      );
    } catch (error) {
      console.error('[SecureStorage] Encryption failed:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }
  
  /**
   * Retrieve and decrypt sensitive data
   */
  static async getItem(extensionName: string, key: string): Promise<string | null> {
    if (typeof window === 'undefined' || !crypto.subtle) {
      throw new Error('Secure storage not available in this environment');
    }
    
    try {
      const stored = localStorage.getItem(
        `${this.STORAGE_KEY_PREFIX}${extensionName}_${key}`
      );
      
      if (!stored) {
        return null;
      }
      
      // Decode base64
      const combined = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const encryptionKey = await this.getEncryptionKey(extensionName);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv },
        encryptionKey,
        encrypted
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('[SecureStorage] Decryption failed:', error);
      return null;
    }
  }
  
  /**
   * Remove encrypted data
   */
  static removeItem(extensionName: string, key: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    
    localStorage.removeItem(
      `${this.STORAGE_KEY_PREFIX}${extensionName}_${key}`
    );
  }
  
  /**
   * Clear all data for an extension
   */
  static clearExtension(extensionName: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    
    const prefix = `${this.STORAGE_KEY_PREFIX}${extensionName}_`;
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
  
  /**
   * Check if encrypted data exists
   */
  static hasItem(extensionName: string, key: string): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    
    return localStorage.getItem(
      `${this.STORAGE_KEY_PREFIX}${extensionName}_${key}`
    ) !== null;
  }
}
