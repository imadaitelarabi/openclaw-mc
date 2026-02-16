/**
 * Extension Registry
 * 
 * Central registry for managing extensions, their lifecycle, and hook registration.
 */

import type { 
  Extension, 
  ExtensionManifest, 
  ExtensionState,
  ExtensionRegistryEntry,
  ExtensionHooks 
} from '@/types/extension';
import { uiStateStore } from './ui-state-db';

/**
 * Extension Registry Class
 * Manages extension lifecycle and provides hook access
 */
class ExtensionRegistry {
  private extensions: Map<string, ExtensionRegistryEntry> = new Map();
  private initialized = false;

  /**
   * Initialize the registry and load saved extension states
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[ExtensionRegistry] Initializing...');
    
    try {
      // Load saved extension states from IndexedDB
      const savedStates = await uiStateStore.getAllExtensionStates();
      console.log(`[ExtensionRegistry] Found ${savedStates.length} saved extension states`);
      
      // Initialize state for each saved extension
      for (const state of savedStates) {
        if (state.enabled) {
          // Extension is enabled but not loaded yet
          // Will be loaded when extension code is registered
          console.log(`[ExtensionRegistry] Extension "${state.name}" is enabled (not yet loaded)`);
        }
      }

      this.initialized = true;
      console.log('[ExtensionRegistry] Initialization complete');
    } catch (error) {
      console.error('[ExtensionRegistry] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Register an extension
   */
  async register(extension: Extension): Promise<void> {
    const { manifest, state } = extension;
    
    console.log(`[ExtensionRegistry] Registering extension: ${manifest.name}`);
    
    // Validate manifest
    if (!this.validateManifest(manifest)) {
      throw new Error(`Invalid manifest for extension: ${manifest.name}`);
    }

    // Check if already registered
    if (this.extensions.has(manifest.name)) {
      console.warn(`[ExtensionRegistry] Extension "${manifest.name}" already registered`);
      return;
    }

    // Load saved state if exists
    const savedState = await uiStateStore.getExtensionState(manifest.name);
    const finalState: ExtensionState = savedState || state;

    // Create registry entry
    const entry: ExtensionRegistryEntry = {
      extension: {
        ...extension,
        state: finalState
      },
      loaded: false
    };

    // Add to registry
    this.extensions.set(manifest.name, entry);

    // If extension is enabled, load it
    if (finalState.enabled) {
      await this.load(manifest.name);
    }

    console.log(`[ExtensionRegistry] Extension "${manifest.name}" registered successfully`);
  }

  /**
   * Unregister an extension
   */
  async unregister(extensionName: string): Promise<void> {
    console.log(`[ExtensionRegistry] Unregistering extension: ${extensionName}`);
    
    const entry = this.extensions.get(extensionName);
    if (!entry) {
      console.warn(`[ExtensionRegistry] Extension "${extensionName}" not found`);
      return;
    }

    // Unload if loaded
    if (entry.loaded) {
      await this.unload(extensionName);
    }

    // Remove from registry
    this.extensions.delete(extensionName);

    // Clean up state
    await uiStateStore.deleteExtensionState(extensionName);

    console.log(`[ExtensionRegistry] Extension "${extensionName}" unregistered`);
  }

  /**
   * Load an extension (call setup, mark as loaded)
   */
  async load(extensionName: string): Promise<void> {
    const entry = this.extensions.get(extensionName);
    if (!entry) {
      throw new Error(`Extension "${extensionName}" not registered`);
    }

    if (entry.loaded) {
      console.log(`[ExtensionRegistry] Extension "${extensionName}" already loaded`);
      return;
    }

    console.log(`[ExtensionRegistry] Loading extension: ${extensionName}`);

    try {
      // Call setup if provided
      if (entry.extension.setup) {
        await entry.extension.setup();
      }

      // Mark as loaded
      entry.loaded = true;
      entry.loadedAt = Date.now();

      // Update state
      entry.extension.state.enabled = true;
      entry.extension.state.lastUpdated = Date.now();
      await uiStateStore.saveExtensionState(entry.extension.state);

      console.log(`[ExtensionRegistry] Extension "${extensionName}" loaded successfully`);
    } catch (error) {
      console.error(`[ExtensionRegistry] Failed to load extension "${extensionName}":`, error);
      
      // Update error state
      entry.extension.state.error = (error as Error).message;
      entry.extension.state.enabled = false;
      await uiStateStore.saveExtensionState(entry.extension.state);
      
      throw error;
    }
  }

  /**
   * Unload an extension (call cleanup, mark as unloaded)
   */
  async unload(extensionName: string): Promise<void> {
    const entry = this.extensions.get(extensionName);
    if (!entry) {
      throw new Error(`Extension "${extensionName}" not registered`);
    }

    if (!entry.loaded) {
      console.log(`[ExtensionRegistry] Extension "${extensionName}" not loaded`);
      return;
    }

    console.log(`[ExtensionRegistry] Unloading extension: ${extensionName}`);

    try {
      // Call cleanup if provided
      if (entry.extension.cleanup) {
        await entry.extension.cleanup();
      }

      // Mark as unloaded
      entry.loaded = false;
      entry.loadedAt = undefined;

      // Update state
      entry.extension.state.enabled = false;
      entry.extension.state.lastUpdated = Date.now();
      await uiStateStore.saveExtensionState(entry.extension.state);

      console.log(`[ExtensionRegistry] Extension "${extensionName}" unloaded successfully`);
    } catch (error) {
      console.error(`[ExtensionRegistry] Failed to unload extension "${extensionName}":`, error);
      throw error;
    }
  }

  /**
   * Enable an extension
   */
  async enable(extensionName: string): Promise<void> {
    console.log(`[ExtensionRegistry] Enabling extension: ${extensionName}`);
    await this.load(extensionName);
  }

  /**
   * Disable an extension
   */
  async disable(extensionName: string): Promise<void> {
    console.log(`[ExtensionRegistry] Disabling extension: ${extensionName}`);
    await this.unload(extensionName);
  }

  /**
   * Get extension by name
   */
  get(extensionName: string): Extension | undefined {
    return this.extensions.get(extensionName)?.extension;
  }

  /**
   * Get all registered extensions
   */
  getAll(): Extension[] {
    return Array.from(this.extensions.values()).map(entry => entry.extension);
  }

  /**
   * Get all enabled extensions
   */
  getEnabled(): Extension[] {
    return Array.from(this.extensions.values())
      .filter(entry => entry.loaded && entry.extension.state.enabled)
      .map(entry => entry.extension);
  }

  /**
   * Get extensions by hook type
   */
  getByHook(hookType: 'status-bar' | 'chat-input' | 'onboarding'): Extension[] {
    return this.getEnabled().filter(ext => 
      ext.manifest.hooks.includes(hookType)
    );
  }

  /**
   * Check if extension is loaded
   */
  isLoaded(extensionName: string): boolean {
    return this.extensions.get(extensionName)?.loaded ?? false;
  }

  /**
   * Check if extension is enabled
   */
  isEnabled(extensionName: string): boolean {
    const entry = this.extensions.get(extensionName);
    return entry?.loaded && entry.extension.state.enabled || false;
  }

  /**
   * Validate extension manifest
   */
  private validateManifest(manifest: ExtensionManifest): boolean {
    if (!manifest.name || typeof manifest.name !== 'string') {
      console.error('[ExtensionRegistry] Invalid manifest: missing name');
      return false;
    }

    if (!manifest.version || typeof manifest.version !== 'string') {
      console.error('[ExtensionRegistry] Invalid manifest: missing version');
      return false;
    }

    if (!Array.isArray(manifest.hooks) || manifest.hooks.length === 0) {
      console.error('[ExtensionRegistry] Invalid manifest: must have at least one hook');
      return false;
    }

    if (!Array.isArray(manifest.permissions)) {
      console.error('[ExtensionRegistry] Invalid manifest: permissions must be an array');
      return false;
    }

    return true;
  }

  /**
   * Update extension state
   */
  async updateState(extensionName: string, updates: Partial<ExtensionState>): Promise<void> {
    const entry = this.extensions.get(extensionName);
    if (!entry) {
      throw new Error(`Extension "${extensionName}" not registered`);
    }

    // Update state
    entry.extension.state = {
      ...entry.extension.state,
      ...updates,
      lastUpdated: Date.now()
    };

    // Persist to IndexedDB
    await uiStateStore.saveExtensionState(entry.extension.state);
  }

  /**
   * Mark extension onboarding as complete
   */
  async completeOnboarding(extensionName: string): Promise<void> {
    await this.updateState(extensionName, { onboarded: true });
  }

  /**
   * Check if extension needs onboarding
   */
  async needsOnboarding(extensionName: string): Promise<boolean> {
    const entry = this.extensions.get(extensionName);
    if (!entry || !entry.extension.hooks.onboarding) {
      return false;
    }

    // Check saved state first
    if (entry.extension.state.onboarded) {
      return false;
    }

    // Call extension's isRequired check
    try {
      return await entry.extension.hooks.onboarding.isRequired();
    } catch (error) {
      console.error(`[ExtensionRegistry] Failed to check onboarding for "${extensionName}":`, error);
      return true; // Default to requiring onboarding if check fails
    }
  }
}

// Export singleton instance
export const extensionRegistry = new ExtensionRegistry();
