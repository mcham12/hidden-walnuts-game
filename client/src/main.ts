// MVP 7.1: Bot protection with Turnstile verification before game connection
// Deployment test: 2025-10-21 - Verifying Cloudflare preview deployment
import { Game } from './Game';
import { AudioManager } from './AudioManager';
// LoadingScreen removed - using WelcomeScreen back face for loading progress
import { WelcomeScreen } from './WelcomeScreen';
import { SettingsManager } from './SettingsManager';
import { TouchControls } from './TouchControls';
import { SessionManager } from './SessionManager'; // MVP 6: Player identity
import { restoreSession, startTokenRefreshTimer, isAuthenticated } from './services/AuthService'; // MVP 16: Session persistence
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
    // MVP 16: Keep reference to welcomeScreen to retrieve Turnstile token later
    let welcomeScreen: WelcomeScreen;

    if (storedUsername) {
      // Found username in localStorage - check if it still exists on server
      const result = await checkExistingUsername(storedUsername, sessionToken);

      if (result.exists) {
        // Username exists on server - show welcome back and link sessionToken
        welcomeScreen = new WelcomeScreen();
        await welcomeScreen.showWelcomeBack(storedUsername);
        await welcomeScreen.hide();
        username = storedUsername;
        savedCharacterId = result.characterId;
      } else {
        // Username doesn't exist on server anymore - prompt for new username
        welcomeScreen = new WelcomeScreen();
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
      }
    } else {
      // No stored username (new user or private browsing) - prompt for username
      welcomeScreen = new WelcomeScreen();
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
    } else if (!isAuthenticated()) {
      // Guest player - auto-assign Squirrel and skip CharacterGrid
      selectedCharacterId = 'squirrel';
      console.log('🐿️ Guest player detected - auto-assigned Squirrel character');
    } else {
      // MVP 16: Authenticated user with no saved character - show CharacterGrid
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

    // MVP 16: STEP 3 - Load game assets while showing progress on Welcome Screen back face
    // NOTE: welcomeScreen is still visible, showing back face with progress bar

    // Start loading audio
    welcomeScreen.updateLoadingProgress(0.1, 'Loading audio...');
    await audioManager.waitForLoad();

    // Initialize game instance (this loads character models, sets up scene, etc.)
    welcomeScreen.updateLoadingProgress(0.3, 'Loading game world...');
    const game = new Game();
    game.selectedCharacterId = selectedCharacterId;
    game.sessionToken = sessionToken; // MVP 6: Pass session token
    game.username = username; // MVP 6: Pass username
    // MVP 16: Get Turnstile token from WelcomeScreen (verified before user interaction)
    game.turnstileToken = welcomeScreen.getTurnstileToken();
    console.log('🤖 [main.ts] Turnstile token:', game.turnstileToken ? 'Present' : 'Missing');

    // Run game.init() - this loads character model, connects to server, etc.
    welcomeScreen.updateLoadingProgress(0.5, 'Connecting to server...');
    await game.init(canvas, audioManager, settingsManager);

    // Start render loop (but canvas still hidden)
    welcomeScreen.updateLoadingProgress(0.8, 'Preparing scene...');
    game.start();

    // CRITICAL: Show canvas WHILE hidden to allow rendering to start
    // The canvas needs to be in the DOM and visible (not display:none) for WebGL to render
    canvas.classList.remove('hidden');
    // But keep welcome screen on top (z-index 10000 vs canvas z-index 0)

    // Wait 5 render frames to ensure scene is actually rendered and painted
    await new Promise(resolve => requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            requestAnimationFrame(resolve)
          )
        )
      )
    ));

    // Show walnut HUD
    if (walnutHud) {
      walnutHud.classList.remove('hidden');
    }

    // Gradual progress steps to show smooth loading (prevent rushing to 100%)
    welcomeScreen.updateLoadingProgress(0.85, 'Rendering trees...');
    await new Promise(resolve => setTimeout(resolve, 300));

    welcomeScreen.updateLoadingProgress(0.9, 'Placing walnuts...');
    await new Promise(resolve => setTimeout(resolve, 300));

    welcomeScreen.updateLoadingProgress(0.95, 'Final touches...');
    await new Promise(resolve => setTimeout(resolve, 300));

    // NOW everything is ready - scene has been rendered
    welcomeScreen.updateLoadingProgress(1.0, '');
    await welcomeScreen.finishLoading(); // Show "Forest ready!" and pause (1500ms)

    // Wait longer to let user see the loading complete and ensure scene is fully rendered
    await new Promise(resolve => setTimeout(resolve, 1000));

    // NOW hide welcome screen - canvas has been rendering underneath and is ready
    await welcomeScreen.hide();

    // MVP 16: Ensure DOM fully ready before showing UI
    // Double requestAnimationFrame ensures all layout/rendering is complete after overlays hide
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    console.log('✅ [main.ts] DOM fully ready, UI should be interactive now');

    // REMOVED: Problematic re-initialization code that was causing issues
    // The UI components are already initialized in game.init() and should work correctly.
    // Re-initializing was causing race conditions, duplicate listeners, and timing issues.
    //
    // If controls still don't work, the issue is elsewhere (blocking elements, CSS, etc.)
    // not in the initialization sequence.

    // MVP 11: Start background audio (ambient forest sounds + music)
    audioManager.startBackgroundAudio();

    // MVP 5: Show persistent control guide (desktop only)
    // Note: control-guide and touch-controls-hint elements were removed from HTML
    // in a previous refactor. This code is kept for reference but will be skipped
    // due to null checks. Tutorial system now uses the contextual tips system instead.
    const controlGuide = document.getElementById('control-guide');
    const controlGuideClose = document.getElementById('control-guide-close');

    // MVP 5.7: Use TouchControls.isMobile() for consistent, reliable detection
    // This properly detects modern iPads (which report as Mac in user agent)
    const isMobile = TouchControls.isMobile();

    if (isMobile) {
      // Show touch controls hint on mobile (if element exists)
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
      } else {
        console.log('ℹ️ [main.ts] touch-controls-hint element not found (expected - using contextual tips instead)');
      }

      // MVP 5.7: Show mobile action buttons on mobile
      const mobileActions = document.getElementById('mobile-actions');
      if (mobileActions) {
        mobileActions.classList.add('visible');
      } else {
        console.warn('⚠️ [main.ts] mobile-actions element not found');
      }
    } else {
      // Show desktop control guide (if element exists)
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
      } else {
        console.log('ℹ️ [main.ts] control-guide element not found (expected - using contextual tips instead)');
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