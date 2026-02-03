// MVP 7.1: Bot protection with Turnstile verification before game connection
// Deployment test: 2026-02-03 - Verified new environment setup
import { Game } from './Game';
import { AudioManager } from './AudioManager';
import { WelcomeScreen } from './WelcomeScreen';
import { LoadingOverlay } from './components/LoadingOverlay'; // NEW: Simple loading overlay
import { SettingsManager } from './SettingsManager';
import { TouchControls } from './TouchControls';
import { SessionManager } from './SessionManager'; // MVP 6: Player identity
import { restoreSession, startTokenRefreshTimer, clearAuth, getCurrentUser } from './services/AuthService'; // MVP 16: Session persistence
import { AuthModal } from './components/AuthModal'; // MVP 16: Authentication modals
import { CharacterGrid } from './components/CharacterGrid'; // MVP 16: Character selection
import { CharacterRegistry } from './services/CharacterRegistry'; // MVP 16: Character data
import { VerifyEmailPage } from './pages/VerifyEmail'; // MVP 16: Email verification

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
    // MVP 16: Check for email verification route
    if (VerifyEmailPage.handleVerificationRoute()) {
      return; // Stop game initialization if verifying email
    }

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
        const welcomeBackResult = await welcomeScreen.showWelcomeBack(storedUsername);

        // MVP 16: Handle character switching request
        if (welcomeBackResult.switchCharacter) {
          console.log('[main.ts] User requested character switch');
          savedCharacterId = undefined; // Clear saved ID to trigger selection flow
        } else {
          savedCharacterId = result.characterId;
        }

        await welcomeScreen.hide();
        welcomeScreen.destroy();
        username = storedUsername;
      } else {
        // Username doesn't exist on server anymore - prompt for new username
        welcomeScreen = new WelcomeScreen();
        const welcomeResult = await welcomeScreen.waitForUsername();
        username = welcomeResult.username;
        if (welcomeResult.isGuest) {
          clearAuth();
        }

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
      welcomeScreen = new WelcomeScreen();
      const welcomeResult = await welcomeScreen.waitForUsername();
      username = welcomeResult.username;
      if (welcomeResult.isGuest) {
        clearAuth();
      }

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
      // No saved character - show CharacterGrid (for both Guest and Auth users)
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

    // NEW TWO-OVERLAY ARCHITECTURE
    // STEP 3A: Hide welcome screen
    console.log('[main.ts] Hiding welcome screen...');
    await welcomeScreen.hide();

    // STEP 3B: Show loading overlay
    const loadingOverlay = new LoadingOverlay();
    await loadingOverlay.show();
    console.log('📊 [main.ts] Loading overlay shown');

    // STEP 3C: Load game assets with progress updates
    // Start loading audio
    loadingOverlay.updateProgress(0.1, 'Arranging forest');
    await audioManager.waitForLoad();

    // Initialize game instance (this loads character models, sets up scene, etc.)
    loadingOverlay.updateProgress(0.3, 'Hiding walnuts');
    const game = new Game();
    game.selectedCharacterId = selectedCharacterId;
    game.sessionToken = sessionToken; // MVP 6: Pass session token
    game.username = username; // MVP 6: Pass username
    // MVP 16: Get Turnstile token from WelcomeScreen (verified before user interaction)
    game.turnstileToken = welcomeScreen.getTurnstileToken();
    console.log('🤖 [main.ts] Turnstile token:', game.turnstileToken ? 'Present' : 'Missing');

    // Run game.init() - this loads character model, connects to server, etc.
    loadingOverlay.updateProgress(0.5, 'Finding other players');
    await game.init(canvas, audioManager, settingsManager);

    // Start render loop
    loadingOverlay.updateProgress(0.7, 'Recruiting predators');
    game.start();

    // Show canvas to allow rendering
    canvas.classList.remove('hidden');
    console.log('🎨 [main.ts] Canvas revealed, starting render...');

    // Wait for render frames
    console.log('⏳ [main.ts] Waiting for render frames...');
    await new Promise(resolve => {
      let count = 0;
      const frameWait = () => {
        count++;
        if (count < 5) {
          requestAnimationFrame(frameWait);
        } else {
          resolve(true);
        }
      };
      requestAnimationFrame(frameWait);
    });
    console.log('✅ [main.ts] 5 frames rendered');

    // Show walnut HUD
    if (walnutHud) {
      walnutHud.classList.remove('hidden');
    }

    // Complete
    loadingOverlay.updateProgress(1.0, '');
    await loadingOverlay.showComplete();

    // Hide loading overlay
    console.log('[main.ts] Hiding loading overlay...');
    await loadingOverlay.hide();

    // MVP 16: Ensure DOM fully ready before showing UI
    // Double requestAnimationFrame ensures all layout/rendering is complete after overlays hide
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    console.log('✅ [main.ts] DOM fully ready, UI should be interactive now');

    // MVP 16: Check for unverified email
    const user = getCurrentUser();
    if (user && user.isAuthenticated && !user.emailVerified) {
      // Show verification reminder immediately
      import('./utils/emailReminder').then(({ showEmailVerificationReminder }) => {
        showEmailVerificationReminder();
      });
    }

    // REMOVED: Problematic re-initialization code that was causing issues
    // The UI components are already initialized in game.init() and should work correctly.
    // Re-initializing was causing race conditions, duplicate listeners, and timing issues.
    //
    // If controls still don't work, the issue is elsewhere (blocking elements, CSS, etc.)
    // not in the initialization sequence.

    // MVP 11: Start background audio AFTER welcome screen hide completes
    // Delayed start ensures smooth transition without audio stutter
    console.log('🎵 [main.ts] Starting background audio...');
    audioManager.startBackgroundAudio();
    console.log('✅ [main.ts] Background audio started');

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