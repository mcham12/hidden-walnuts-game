// ===================================================================
// COMPREHENSIVE DIAGNOSTIC SCRIPT FOR ON-SCREEN CONTROL FAILURES
// ===================================================================
// Copy this entire script and paste into browser console
// Run it AFTER the game has fully loaded

console.log('%c═══════════════════════════════════════════════', 'color: cyan; font-weight: bold');
console.log('%c  CONTROL SYSTEM DIAGNOSTIC  ', 'color: cyan; font-weight: bold; font-size: 16px');
console.log('%c═══════════════════════════════════════════════', 'color: cyan; font-weight: bold');

// ===== TEST 1: DOM Element Existence =====
console.log('\n%c[TEST 1] DOM ELEMENT EXISTENCE', 'color: yellow; font-weight: bold');
const elements = {
  leaderboardBtn: document.getElementById('leaderboard-toggle'),
  settingsBtn: document.getElementById('settings-toggle'),
  quickChat: document.getElementById('quick-chat'),
  emotes: document.getElementById('emotes'),
  mobileActions: document.getElementById('mobile-actions'),
  canvas: document.getElementById('gameCanvas')
};

Object.entries(elements).forEach(([name, el]) => {
  if (el) {
    console.log(`✅ ${name}: EXISTS`, el);
  } else {
    console.log(`❌ ${name}: NOT FOUND`);
  }
});

// ===== TEST 2: Visibility Check =====
console.log('\n%c[TEST 2] VISIBILITY CHECK', 'color: yellow; font-weight: bold');
Object.entries(elements).forEach(([name, el]) => {
  if (!el) return;

  const computed = window.getComputedStyle(el);
  const isVisible = {
    display: computed.display !== 'none',
    visibility: computed.visibility !== 'hidden',
    opacity: parseFloat(computed.opacity) > 0,
    hasHiddenClass: el.classList.contains('hidden')
  };

  const fullyVisible = isVisible.display && isVisible.visibility && isVisible.opacity && !isVisible.hasHiddenClass;

  console.log(`${fullyVisible ? '✅' : '❌'} ${name}:`, isVisible);
});

// ===== TEST 3: Z-Index & Stacking Context =====
console.log('\n%c[TEST 3] Z-INDEX & STACKING CONTEXT', 'color: yellow; font-weight: bold');
Object.entries(elements).forEach(([name, el]) => {
  if (!el) return;

  const computed = window.getComputedStyle(el);
  console.log(`${name}:`, {
    zIndex: computed.zIndex,
    position: computed.position,
    pointerEvents: computed.pointerEvents,
    top: computed.top,
    left: computed.left,
    right: computed.right,
    bottom: computed.bottom
  });
});

// ===== TEST 4: Element At Point (Blocking Check) =====
console.log('\n%c[TEST 4] ELEMENT AT POINT (Blocking Check)', 'color: yellow; font-weight: bold');
['leaderboardBtn', 'settingsBtn'].forEach(btnName => {
  const btn = elements[btnName];
  if (!btn) return;

  const rect = btn.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const elementAtCenter = document.elementFromPoint(centerX, centerY);

  const isBlocked = elementAtCenter !== btn;
  console.log(`${isBlocked ? '❌ BLOCKED' : '✅ CLEAR'} ${btnName}:`);
  console.log(`  Button position: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
  console.log(`  Element at that point:`, elementAtCenter);
  console.log(`  Is it the button?`, elementAtCenter === btn);

  if (isBlocked && elementAtCenter) {
    const blocker = window.getComputedStyle(elementAtCenter);
    console.log(`  Blocker z-index:`, blocker.zIndex);
    console.log(`  Blocker pointer-events:`, blocker.pointerEvents);
  }
});

// ===== TEST 5: Event Listeners Check (Chrome Only) =====
console.log('\n%c[TEST 5] EVENT LISTENERS CHECK', 'color: yellow; font-weight: bold');
if (typeof getEventListeners === 'function') {
  ['leaderboardBtn', 'settingsBtn'].forEach(btnName => {
    const btn = elements[btnName];
    if (!btn) return;

    const listeners = getEventListeners(btn);
    console.log(`${btnName} listeners:`, listeners);

    if (listeners.click) {
      console.log(`  ✅ Has ${listeners.click.length} click listener(s)`);
    } else {
      console.log(`  ❌ NO CLICK LISTENERS ATTACHED!`);
    }
  });
} else {
  console.log('⚠️ getEventListeners() not available (Chrome DevTools only)');
  console.log('   Open Chrome DevTools Elements tab → Event Listeners panel to inspect manually');
}

// ===== TEST 6: Manual Click Test =====
console.log('\n%c[TEST 6] MANUAL CLICK TEST', 'color: yellow; font-weight: bold');
const testBtn = elements.leaderboardBtn;
if (testBtn) {
  // Add test listener
  const testListener = function(e) {
    console.log('%c🎯 TEST LISTENER FIRED!', 'color: lime; font-weight: bold; font-size: 14px');
    console.log('  Event:', e);
    console.log('  Target:', e.target);
    console.log('  CurrentTarget:', e.currentTarget);
    console.log('  Event phase:', e.eventPhase === 1 ? 'CAPTURING' : e.eventPhase === 2 ? 'AT_TARGET' : 'BUBBLING');
    console.log('  Default prevented?', e.defaultPrevented);
    console.log('  Propagation stopped?', e.cancelBubble);
  };

  testBtn.addEventListener('click', testListener, { capture: true, once: true });
  console.log('✅ Test listener added to leaderboard button (capture phase, one-time)');
  console.log('👆 Now try clicking the leaderboard button...');

  // Auto-test after 2 seconds
  setTimeout(() => {
    console.log('\n%c[AUTO-TEST] Programmatically clicking button...', 'color: orange');
    testBtn.click();

    setTimeout(() => {
      const leaderboard = document.getElementById('leaderboard');
      const isVisible = leaderboard && !leaderboard.classList.contains('hidden');
      console.log(isVisible ? '✅' : '❌', 'Leaderboard visible after click?', isVisible);
    }, 100);
  }, 2000);
}

// ===== TEST 7: Check for Global Click Blockers =====
console.log('\n%c[TEST 7] GLOBAL CLICK HANDLERS', 'color: yellow; font-weight: bold');
console.log('Checking for global click handlers that might block events...');

// Can't easily inspect all global handlers, but we can test
let globalClickFired = false;
const globalTestHandler = (e) => {
  globalClickFired = true;
  console.log('  Global window click handler fired, target:', e.target);
};

window.addEventListener('click', globalTestHandler, { capture: true, once: true });
console.log('✅ Added test global handler');
console.log('   Click anywhere to test if global handlers are working');

// ===== TEST 8: Game Instance Check =====
console.log('\n%c[TEST 8] GAME INSTANCE & INITIALIZATION FLAGS', 'color: yellow; font-weight: bold');
// Try to find game instance
let gameInstance = null;

// Check common patterns
if (typeof window.game !== 'undefined') {
  gameInstance = window.game;
}

if (gameInstance) {
  console.log('✅ Game instance found on window.game');
  console.log('  Leaderboard initialized?', gameInstance.leaderboardInitialized);
  console.log('  Chat/Emotes initialized?', gameInstance.chatEmotesInitialized);
  console.log('  Settings initialized?', gameInstance.settingsInitialized);
} else {
  console.log('⚠️ Game instance not exposed on window');
  console.log('   Cannot check initialization flags');
}

// ===== FINAL SUMMARY =====
setTimeout(() => {
  console.log('\n%c═══════════════════════════════════════════════', 'color: cyan; font-weight: bold');
  console.log('%c  DIAGNOSTIC COMPLETE  ', 'color: cyan; font-weight: bold; font-size: 16px');
  console.log('%c═══════════════════════════════════════════════', 'color: cyan; font-weight: bold');

  console.log('\n%c📋 SUMMARY:', 'color: white; font-weight: bold');
  console.log('1. Check TEST 1-3 for basic element issues');
  console.log('2. Check TEST 4 for blocking elements');
  console.log('3. Check TEST 5 for missing event listeners');
  console.log('4. Check TEST 6 - did manual click work?');
  console.log('5. If nothing works, try the NUCLEAR OPTIONS below');

  console.log('\n%c🚨 NUCLEAR OPTIONS:', 'color: red; font-weight: bold');
  console.log('%c Option 1: Force re-attach listeners', 'color: yellow');
  console.log('   Copy and paste this into console:');
  console.log('%c   document.getElementById("leaderboard-toggle").addEventListener("click", () => { document.getElementById("leaderboard").classList.toggle("hidden"); });', 'color: lightblue');

  console.log('\n%c Option 2: Clone elements to remove ALL listeners', 'color: yellow');
  console.log('   [If you need this, ask for help]');

}, 3000);
