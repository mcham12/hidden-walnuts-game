// MVP 7.1: Bot protection with Turnstile verification before game connection
// Deployment test: 2025-10-21 - Verifying Cloudflare preview deployment
import { Game } from './Game';
import { AudioManager } from './AudioManager';
import { LoadingScreen } from './LoadingScreen';
import { WelcomeScreen } from './WelcomeScreen';
import { SettingsManager } from './SettingsManager';
import { TouchControls } from './TouchControls';
import { SessionManager } from './SessionManager'; // MVP 6: Player identity
import { restoreSession, startTokenRefreshTimer } from './services/AuthService'; // MVP 16: Session persistence
import { AuthModal } from './components/AuthModal'; // MVP 16: Authentication modals
import { CharacterGrid } from './components/CharacterGrid'; // MVP 16: Character selection
import { CharacterRegistry } from './services/CharacterRegistry'; // MVP 16: Character data

// MVP 6: API URL from environment (for worker communication)
const API_URL = import.meta.env.VITE_API_URL || '';

// MVP 16: Character selection now handled by CharacterGrid component
// Old dropdown and preview code removed

// MVP 5.7: Global error handler for debugging
window.addEventListener('error', (event) => {
  console.error('🚨 Global error caught:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise
  });
});

/**
 * MVP 6: Check if username exists and link sessionToken
 * FIXED: Pass username as query param (not sessionToken)
 * Returns: { exists: boolean, characterId?: string }
 */
async function checkExistingUsername(username: string, sessionToken: string): Promise<{ exists: boolean; characterId?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/identity?action=check&username=${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken })
    });
    if (!response.ok) {
      console.error(`❌ Check username failed (${response.status}):`, await response.text());
      return { exists: false };
    }
    const data = await response.json();
    return {
      exists: data.exists || false,
      characterId: data.lastCharacterId || undefined
    };
  } catch (error) {
    console.error('❌ Check username error:', error);
    return { exists: false };
  }
}

/**
 * MVP 6: Create new username identity
 * FIXED: Pass username as query param
 */
async function saveUsername(username: string, sessionToken: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/identity?action=set&username=${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, sessionToken })
    });

    if (!response.ok) {
      console.error(`❌ Save username failed (${response.status}):`, await response.text());
    }
  } catch (error) {
    console.error('❌ Save username error:', error);
  }
}

/**
 * MVP 6: Try to load username from localStorage
 * Returns null if not available (private browsing or new user)
 */
function loadStoredUsername(): string | null {
  try {
    return localStorage.getItem('hw_username');
  } catch (e) {
    // Private browsing mode - localStorage unavailable
    return null;
  }
}

/**
 * MVP 6: Save username to localStorage (for convenience)
 */
function storeUsername(username: string): void {
  try {
    localStorage.setItem('hw_username', username);
  } catch (e) {
    // Private browsing mode - can't save
  }
}

/**
 * MVP 6: Update character selection on server
 */
async function updateCharacterSelection(username: string, characterId: string): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/identity?action=updateCharacter&username=${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Update character failed (${response.status}):`, errorText);
      throw new Error(`Failed to save character: ${response.status} ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Update character error:', error);
    throw error; // Re-throw so caller knows it failed
  }
}

async function main() {
  try {
    // MVP 16: STEP 0 - Load character registry (required for character selection and game)
    await CharacterRegistry.loadCharacters();

    // MVP 16: STEP 0A - Restore authentication session if exists
    // This checks if user has valid tokens and refreshes if needed
    await restoreSession();

    // MVP 16: STEP 0B - Start automatic token refresh timer
    // Refreshes access token 5 days before expiration (every 25 days)
    startTokenRefreshTimer();

    // MVP 16: STEP 0C - Initialize AuthModal for signup/login flows
    const authModal = new AuthModal({
      onAuthSuccess: (userData) => {
        console.log('✅ User authenticated:', userData);
        // Reload page to refresh character availability and session
        window.location.reload();
      },
      onClose: () => {
        console.log('🚪 Auth modal closed');
      }
    });

    // MVP 16: STEP 0D - Handle /reset-password route
    if (window.location.pathname === '/reset-password') {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      if (token) {
        authModal.open('reset-password');
        // Don't continue with game initialization
        return;
      }
    }

    // MVP 6: STEP 0E - Initialize session management
    const sessionManager = new SessionManager();
    const sessionToken = sessionManager.getToken();

    // MVP 6: STEP 1 - Try to load username from localStorage
    const storedUsername = loadStoredUsername();

    let username: string;
    let savedCharacterId: string | undefined;

    if (storedUsername) {
      // Found username in localStorage - check if it still exists on server
      const result = await checkExistingUsername(storedUsername, sessionToken);

      if (result.exists) {
        // Username exists on server - show welcome back and link sessionToken
        const welcomeScreen = new WelcomeScreen();
        await welcomeScreen.showWelcomeBack(storedUsername);
        await welcomeScreen.hide();
        welcomeScreen.destroy();
        username = storedUsername;
        savedCharacterId = result.characterId;
      } else {
        // Username doesn't exist on server anymore - prompt for new username
        const welcomeScreen = new WelcomeScreen();
        username = await welcomeScreen.show();

        // Check if this new username exists or create it
        const newResult = await checkExistingUsername(username, sessionToken);
        if (!newResult.exists) {
          await saveUsername(username, sessionToken);
        }
        savedCharacterId = newResult.characterId;

        // Store new username locally
        storeUsername(username);

        await welcomeScreen.hide();
        welcomeScreen.destroy();
      }
    } else {
      // No stored username (new user or private browsing) - prompt for username
      const welcomeScreen = new WelcomeScreen();
      username = await welcomeScreen.show();

      // Check if username exists on server (private browsing case!)
      const result = await checkExistingUsername(username, sessionToken);

      if (result.exists) {
        // Username exists! This is a returning user in private browsing
        savedCharacterId = result.characterId;
        // Session already linked by checkExistingUsername call
      } else {
        // New username - create identity
        await saveUsername(username, sessionToken);
      }

      // Store username locally (for convenience next time)
      storeUsername(username);

      await welcomeScreen.hide();
      welcomeScreen.destroy();
    }

    // MVP 6: STEP 2 - Character selection (skip if returning user with saved character)
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const walnutHud = document.getElementById('walnut-hud') as HTMLDivElement;

    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    canvas.classList.add('hidden');

    // Initialize audio manager (don't load sounds yet - will load when game starts)
    const audioManager = new AudioManager();

    // MVP 16: Initialize settings manager with auth modal callbacks
    const settingsManager = new SettingsManager(audioManager, {
      onSignUpClick: () => authModal.open('signup'),
      onLoginClick: () => authModal.open('login')
    });

    let selectedCharacterId: string;

    // Check if user has saved character
    if (savedCharacterId) {
      // Returning user with saved character - skip selection!
      selectedCharacterId = savedCharacterId;
    } else {
      // MVP 16: New user or no saved character - show CharacterGrid
      const selectDiv = document.getElementById('character-select') as HTMLDivElement;

      // Show character selection container
      selectDiv.classList.remove('hidden');

      // Wait for character selection using CharacterGrid
      selectedCharacterId = await new Promise<string>((resolve) => {
        new CharacterGrid(selectDiv, {
          onCharacterSelect: async (charId: string) => {
            // MVP 5: Unlock audio on character selection
            await audioManager.unlock();

            // MVP 5: Play UI sound
            audioManager.playSound('ui', 'button_click');

            // Save character selection to server
            await updateCharacterSelection(username, charId);

            // Hide character selection
            selectDiv.classList.add('hidden');

            resolve(charId);
          },
          onSignUpClick: () => {
            authModal.open('signup');
          },
          onLoginClick: () => {
            authModal.open('login');
          },
          selectedCharacterId: undefined // No pre-selected character for new users
        });
      });
    }

    // MVP 6: STEP 3 - Show SINGLE loading screen and load ALL game assets
    const loadingScreen = new LoadingScreen();
    await loadingScreen.show(); // Sets to 0% immediately

    // Start loading audio
    loadingScreen.updateProgress(0.1, 'Loading audio...');
    await audioManager.waitForLoad();

    // Initialize game instance (this loads character models, sets up scene, etc.)
    loadingScreen.updateProgress(0.3, 'Loading game world...');
    const game = new Game();
    game.selectedCharacterId = selectedCharacterId;
    game.sessionToken = sessionToken; // MVP 6: Pass session token
    game.username = username; // MVP 6: Pass username
    game.turnstileToken = loadingScreen.getTurnstileToken(); // MVP 7.1: Pass Turnstile token for bot protection

    // Run game.init() - this loads character model, connects to server, etc.
    loadingScreen.updateProgress(0.5, 'Connecting to server...');
    await game.init(canvas, audioManager, settingsManager);

    // Start render loop (but canvas still hidden)
    loadingScreen.updateProgress(0.8, 'Preparing scene...');
    game.start();

    // Wait 2 render frames to ensure scene is actually rendered
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // NOW everything is ready - show the game!
    loadingScreen.updateProgress(1.0, 'Ready!');
    await new Promise(resolve => setTimeout(resolve, 200));

    // Hide loading screen
    loadingScreen.hide();
    loadingScreen.destroy();

    // Show game canvas (now guaranteed to have content)
    canvas.classList.remove('hidden');

    // Show walnut HUD
    if (walnutHud) {
      walnutHud.classList.remove('hidden');
    }

    // MVP 16: Ensure DOM fully ready before UI initialization (P0 fix)
    // Double requestAnimationFrame ensures all layout/rendering is complete
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    console.log('✅ [main.ts] DOM fully ready, re-initializing UI components...');

    // Re-initialize UI components to ensure event listeners are properly attached
    // This fixes the issue where buttons weren't clickable after WebSocket auth changes
    if (typeof (game as any).initLeaderboard === 'function') {
      console.log('🔧 [main.ts] Re-initializing leaderboard...');
      (game as any).initLeaderboard();
    }
    if (typeof (game as any).initChatAndEmotes === 'function') {
      console.log('🔧 [main.ts] Re-initializing chat and emotes...');
      (game as any).initChatAndEmotes();
    }
    if (typeof (game as any).initSettingsMenu === 'function') {
      console.log('🔧 [main.ts] Re-initializing settings menu...');
      (game as any).initSettingsMenu();
    }
    console.log('✅ [main.ts] UI components re-initialized successfully');

    // MVP 11: Start background audio (ambient forest sounds + music)
    audioManager.startBackgroundAudio();

    // MVP 5: Show persistent control guide (desktop only)
    const controlGuide = document.getElementById('control-guide');
    const controlGuideClose = document.getElementById('control-guide-close');

    // MVP 5.7: Use TouchControls.isMobile() for consistent, reliable detection
    // This properly detects modern iPads (which report as Mac in user agent)
    const isMobile = TouchControls.isMobile();

    if (isMobile) {
      // Show touch controls hint on mobile
      const touchHint = document.getElementById('touch-controls-hint');
      if (touchHint) {
        const touchHintDismissed = localStorage.getItem('touchHintDismissed');
        if (!touchHintDismissed) {
          touchHint.classList.remove('hidden');

          // Add click handler to dismiss
          touchHint.addEventListener('click', () => {
            touchHint.classList.add('hidden');
            localStorage.setItem('touchHintDismissed', 'true');
            audioManager.playSound('ui', 'button_click');
          });
        }
      }

      // MVP 5.7: Show mobile action buttons on mobile
      const mobileActions = document.getElementById('mobile-actions');
      if (mobileActions) {
        mobileActions.classList.add('visible');
      }
    } else {
      // Show desktop control guide
      if (controlGuide) {
        const dismissed = localStorage.getItem('controlGuideDismissed');
        if (!dismissed) {
          controlGuide.classList.remove('hidden');
        }

        // Add close button handler
        if (controlGuideClose) {
          controlGuideClose.addEventListener('click', () => {
            controlGuide.classList.add('hidden');
            localStorage.setItem('controlGuideDismissed', 'true');
            audioManager.playSound('ui', 'button_click');
          });
        }
      }
    }

    // Show settings button after game starts
    settingsManager.show();
  } catch (error) {
    console.error('🚨 Fatal error in main():', error);
    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(255,0,0,0.9);color:white;padding:20px;border-radius:8px;font-family:Arial;text-align:center;z-index:10000;';
    errorDiv.innerHTML = `
      <h2>Error Loading Game</h2>
      <p>Please try refreshing the page.</p>
      <p style="font-size:12px;opacity:0.8;">${error instanceof Error ? error.message : 'Unknown error'}</p>
    `;
    document.body.appendChild(errorDiv);
  }
}

main().catch((error) => {
  console.error('🚨 Unhandled error in main():', error);
});