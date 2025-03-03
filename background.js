// Initialize default settings if not already set
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('productivityKeeperSettings', (data) => {
    if (!data.productivityKeeperSettings) {
      const defaultSettings = {
        pomodoroDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        autoStartBreaks: false,
        autoStartPomodoros: false,
        notificationSound: 'bell',
        themeColor: 'blue',
        darkMode: false
      };
      
      chrome.storage.sync.set({ 'productivityKeeperSettings': defaultSettings });
    }
  });
  
  // Initialize timer state
  const initialTimerState = {
    minutes: 25,
    seconds: 0,
    mode: 'pomodoro',
    isRunning: false,
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    completedPomodoros: 0,
    lastUpdated: Date.now()
  };
  
  chrome.storage.local.set({ timerState: initialTimerState });
});

// Global timer variables
let timerInterval = null;

// Function to update the timer
function updateTimer() {
  chrome.storage.local.get('timerState', (data) => {
    if (!data.timerState) {
      console.log('No timer state found in updateTimer');
      return;
    }
    
    if (!data.timerState.isRunning) {
      console.log('Timer is not running in updateTimer');
      return;
    }
    
    const timerState = data.timerState;
    const currentTime = Date.now();
    const elapsedSeconds = Math.floor((currentTime - timerState.lastUpdated) / 1000);
    
    if (elapsedSeconds <= 0) {
      // No time has elapsed, nothing to update
      return;
    }
    
    console.log(`Updating timer: elapsed ${elapsedSeconds}s, remaining: ${timerState.remainingSeconds}s`);
    
    // Update remaining seconds
    timerState.remainingSeconds -= elapsedSeconds;
    
    // Check if timer completed
    if (timerState.remainingSeconds <= 0) {
      console.log('Timer completed in updateTimer');
      timerCompleted();
      return;
    }
    
    // Calculate minutes and seconds
    timerState.minutes = Math.floor(timerState.remainingSeconds / 60);
    timerState.seconds = timerState.remainingSeconds % 60;
    
    // Update last updated time
    timerState.lastUpdated = currentTime;
    
    // Save updated timer state
    chrome.storage.local.set({ timerState }, () => {
      // Update badge
      updateBadge(timerState.minutes, timerState.seconds);
      
      // Ensure the timer alarm still exists
      chrome.alarms.get('pomodoroTimer', (alarm) => {
        if (!alarm && timerState.isRunning) {
          console.log('Timer alarm missing in updateTimer, recreating');
          ensureTimerAlarmExists();
        }
      });
    });
  });
}

// Function to update the badge
function updateBadge(minutes, seconds) {
  const displayMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const displaySeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
  chrome.action.setBadgeText({ text: `${displayMinutes}:${displaySeconds}` });
  
  // Set badge color based on mode
  chrome.storage.local.get('timerState', (data) => {
    if (!data.timerState) return;
    
    const mode = data.timerState.mode;
    let color = '#4dabf7'; // Default blue for pomodoro
    
    if (mode === 'shortBreak' || mode === 'longBreak') {
      color = '#51cf66'; // Green for breaks
    }
    
    chrome.action.setBadgeBackgroundColor({ color });
  });
}

// Function to handle timer completion
function timerCompleted() {
  // Get settings and timer state
  chrome.storage.sync.get('productivityKeeperSettings', (settingsData) => {
    chrome.storage.local.get('timerState', (stateData) => {
      if (!settingsData.productivityKeeperSettings || !stateData.timerState) return;
      
      const settings = settingsData.productivityKeeperSettings;
      const timerState = stateData.timerState;
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'Productivity Keeper',
        message: `${timerState.mode === 'pomodoro' ? 'Pomodoro' : 'Break'} completed!`,
        silent: false
      });
      
      // Update timer state
      if (timerState.mode === 'pomodoro') {
        timerState.completedPomodoros++;
        
        // After 4 pomodoros, take a long break
        if (timerState.completedPomodoros % 4 === 0) {
          if (settings.autoStartBreaks) {
            timerState.mode = 'longBreak';
            timerState.minutes = settings.longBreakDuration;
            timerState.seconds = 0;
            timerState.totalSeconds = settings.longBreakDuration * 60;
            timerState.remainingSeconds = timerState.totalSeconds;
            timerState.isRunning = true;
            timerState.lastUpdated = Date.now();
          } else {
            timerState.mode = 'longBreak';
            timerState.minutes = settings.longBreakDuration;
            timerState.seconds = 0;
            timerState.totalSeconds = settings.longBreakDuration * 60;
            timerState.remainingSeconds = timerState.totalSeconds;
            timerState.isRunning = false;
          }
        } else {
          if (settings.autoStartBreaks) {
            timerState.mode = 'shortBreak';
            timerState.minutes = settings.shortBreakDuration;
            timerState.seconds = 0;
            timerState.totalSeconds = settings.shortBreakDuration * 60;
            timerState.remainingSeconds = timerState.totalSeconds;
            timerState.isRunning = true;
            timerState.lastUpdated = Date.now();
          } else {
            timerState.mode = 'shortBreak';
            timerState.minutes = settings.shortBreakDuration;
            timerState.seconds = 0;
            timerState.totalSeconds = settings.shortBreakDuration * 60;
            timerState.remainingSeconds = timerState.totalSeconds;
            timerState.isRunning = false;
          }
        }
      } else {
        if (settings.autoStartPomodoros) {
          timerState.mode = 'pomodoro';
          timerState.minutes = settings.pomodoroDuration;
          timerState.seconds = 0;
          timerState.totalSeconds = settings.pomodoroDuration * 60;
          timerState.remainingSeconds = timerState.totalSeconds;
          timerState.isRunning = true;
          timerState.lastUpdated = Date.now();
        } else {
          timerState.mode = 'pomodoro';
          timerState.minutes = settings.pomodoroDuration;
          timerState.seconds = 0;
          timerState.totalSeconds = settings.pomodoroDuration * 60;
          timerState.remainingSeconds = timerState.totalSeconds;
          timerState.isRunning = false;
        }
      }
      
      // Save updated timer state
      chrome.storage.local.set({ timerState });
      
      // Update badge
      updateBadge(timerState.minutes, timerState.seconds);
      
      // If timer should continue running, ensure the alarm is set
      if (timerState.isRunning) {
        ensureTimerAlarmExists();
      } else {
        // If timer should stop, clear the alarm
        chrome.alarms.clear('pomodoroTimer');
      }
    });
  });
}

// Start background timer using Chrome alarms instead of setInterval
function startBackgroundTimer() {
  console.log('Starting background timer with Chrome alarms');
  
  // Clear any existing intervals (legacy approach)
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Make sure the timer state is set to running
  chrome.storage.local.get('timerState', (data) => {
    if (data.timerState) {
      const timerState = data.timerState;
      if (!timerState.isRunning) {
        timerState.isRunning = true;
        timerState.lastUpdated = Date.now();
        chrome.storage.local.set({ timerState });
      }
      
      // Create an alarm that fires every second
      ensureTimerAlarmExists();
      
      // Update badge
      updateBadge(timerState.minutes, timerState.seconds);
    }
  });
}

// Ensure the timer alarm exists
function ensureTimerAlarmExists() {
  console.log('Ensuring timer alarm exists');
  
  // First check if the alarm already exists
  chrome.alarms.get('pomodoroTimer', (alarm) => {
    if (alarm) {
      console.log('Timer alarm already exists, no need to recreate');
      return;
    }
    
    // Clear any existing alarm first to be safe
    chrome.alarms.clear('pomodoroTimer', (wasCleared) => {
      console.log(`Timer alarm cleared: ${wasCleared}`);
      
      // Create a new alarm that fires every second
      chrome.alarms.create('pomodoroTimer', { 
        periodInMinutes: 1/60, // Every second
        when: Date.now() + 1000 // Start in 1 second
      });
      
      // Verify the alarm was created
      setTimeout(() => {
        chrome.alarms.get('pomodoroTimer', (alarm) => {
          if (!alarm) {
            console.error('Failed to create timer alarm, retrying');
            chrome.alarms.create('pomodoroTimer', { 
              periodInMinutes: 1/60 // Every second
            });
          } else {
            console.log('Timer alarm created successfully');
          }
        });
      }, 500);
    });
  });
}

// Stop background timer
function stopBackgroundTimer() {
  console.log('Stopping background timer');
  
  // Clear any existing intervals (legacy approach)
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Clear the timer alarm
  chrome.alarms.clear('pomodoroTimer');
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startTimer') {
    console.log('Received startTimer message', message);
    
    const { minutes, seconds, mode, totalSeconds, remainingSeconds, completedPomodoros } = message;
    
    // Save current timer state
    const timerState = {
      minutes,
      seconds,
      mode,
      isRunning: true,
      totalSeconds,
      remainingSeconds,
      completedPomodoros,
      lastUpdated: Date.now()
    };
    
    chrome.storage.local.set({ timerState }, () => {
      // Start background timer after state is saved
      startBackgroundTimer();
      
      // Update badge
      updateBadge(minutes, seconds);
      
      sendResponse({ success: true });
    });
    
    return true; // Keep the message channel open for async response
  } else if (message.action === 'stopTimer') {
    console.log('Received stopTimer message');
    
    // Update timer state
    chrome.storage.local.get('timerState', (data) => {
      if (data.timerState) {
        const timerState = data.timerState;
        timerState.isRunning = false;
        chrome.storage.local.set({ timerState }, () => {
          // Stop background timer after state is saved
          stopBackgroundTimer();
          
          // Clear badge
          chrome.action.setBadgeText({ text: '' });
          
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: false, error: 'No timer state found' });
      }
    });
    
    return true; // Keep the message channel open for async response
  } else if (message.action === 'resetTimer') {
    console.log('Received resetTimer message', message);
    
    const { minutes, seconds, mode, totalSeconds, remainingSeconds, completedPomodoros } = message;
    
    // Save reset timer state
    const timerState = {
      minutes,
      seconds,
      mode,
      isRunning: false,
      totalSeconds,
      remainingSeconds,
      completedPomodoros,
      lastUpdated: Date.now()
    };
    
    chrome.storage.local.set({ timerState }, () => {
      // Stop background timer
      stopBackgroundTimer();
      
      // Update badge with reset time
      const displayMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
      const displaySeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
      chrome.action.setBadgeText({ text: `${displayMinutes}:${displaySeconds}` });
      
      // Set badge color based on mode
      let color = '#4dabf7'; // Default blue for pomodoro
      if (mode === 'shortBreak' || mode === 'longBreak') {
        color = '#51cf66'; // Green for breaks
      }
      chrome.action.setBadgeBackgroundColor({ color });
      
      sendResponse({ success: true });
    });
    
    return true; // Keep the message channel open for async response
  } else if (message.action === 'switchMode') {
    console.log('Received switchMode message', message);
    
    const { minutes, seconds, mode, totalSeconds, remainingSeconds, completedPomodoros } = message;
    
    // Save switched mode timer state
    const timerState = {
      minutes,
      seconds,
      mode,
      isRunning: false,
      totalSeconds,
      remainingSeconds,
      completedPomodoros,
      lastUpdated: Date.now()
    };
    
    chrome.storage.local.set({ timerState }, () => {
      // Stop background timer
      stopBackgroundTimer();
      
      // Update badge with new mode time
      const displayMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
      const displaySeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
      chrome.action.setBadgeText({ text: `${displayMinutes}:${displaySeconds}` });
      
      // Set badge color based on mode
      let color = '#4dabf7'; // Default blue for pomodoro
      if (mode === 'shortBreak' || mode === 'longBreak') {
        color = '#51cf66'; // Green for breaks
      }
      chrome.action.setBadgeBackgroundColor({ color });
      
      sendResponse({ success: true });
    });
    
    return true; // Keep the message channel open for async response
  } else if (message.action === 'getTimerState') {
    console.log('Received getTimerState message');
    
    // Get current timer state
    chrome.storage.local.get('timerState', (data) => {
      if (data.timerState) {
        // If timer is running, update it first
        if (data.timerState.isRunning) {
          const timerState = data.timerState;
          const currentTime = Date.now();
          const elapsedSeconds = Math.floor((currentTime - timerState.lastUpdated) / 1000);
          
          console.log(`getTimerState: timer is running, elapsed ${elapsedSeconds}s, remaining: ${timerState.remainingSeconds}s`);
          
          if (elapsedSeconds > 0) {
            // Update remaining seconds
            timerState.remainingSeconds -= elapsedSeconds;
            
            // Check if timer completed
            if (timerState.remainingSeconds <= 0) {
              console.log('Timer completed in getTimerState');
              timerCompleted();
              return;
            }
            
            // Calculate minutes and seconds
            timerState.minutes = Math.floor(timerState.remainingSeconds / 60);
            timerState.seconds = timerState.remainingSeconds % 60;
            
            // Update last updated time
            timerState.lastUpdated = currentTime;
            
            // Save updated timer state
            chrome.storage.local.set({ timerState }, () => {
              // Ensure the timer alarm exists if the timer is running
              if (timerState.isRunning) {
                ensureTimerAlarmExists();
              }
              
              console.log('Sending updated timer state to popup:', timerState);
              sendResponse({ timerState: timerState });
            });
            
            return; // We'll send the response after saving
          }
        }
        
        // If we're here, either the timer is not running or no time has elapsed
        // Ensure the timer alarm exists if the timer is running
        if (data.timerState.isRunning) {
          ensureTimerAlarmExists();
        }
        
        console.log('Sending timer state to popup:', data.timerState);
        sendResponse({ timerState: data.timerState });
      } else {
        console.error('No timer state found in getTimerState');
        sendResponse({ timerState: null });
      }
    });
    
    return true; // Keep the message channel open for async response
  }
  
  return true; // Keep the message channel open for async response
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoroTimer') {
    // Update the timer
    console.log('Pomodoro timer alarm fired');
    updateTimer();
    
    // Double-check that the alarm still exists for the next tick
    chrome.alarms.get('pomodoroTimer', (alarm) => {
      if (!alarm) {
        console.log('Pomodoro timer alarm missing, recreating');
        chrome.storage.local.get('timerState', (data) => {
          if (data.timerState && data.timerState.isRunning) {
            ensureTimerAlarmExists();
          }
        });
      }
    });
  } else if (alarm.name === 'keepAlive') {
    // This alarm keeps the service worker alive
    console.log('Keep alive alarm fired');
    chrome.storage.local.get('timerState', (data) => {
      if (data.timerState && data.timerState.isRunning) {
        console.log('Timer is running, ensuring alarm exists and updating timer');
        // Ensure the timer alarm exists
        ensureTimerAlarmExists();
        // Update the timer
        updateTimer();
      }
    });
  }
});

// Keep service worker alive in Manifest V3 - run more frequently
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 }); // Every 30 seconds

// When the extension starts up, check if we need to restart the timer
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension starting up');
  chrome.storage.local.get('timerState', (data) => {
    if (data.timerState && data.timerState.isRunning) {
      console.log('Extension started, resuming timer');
      startBackgroundTimer();
    }
  });
});

// Initialize when the service worker loads
chrome.storage.local.get('timerState', (data) => {
  console.log('Service worker loaded, checking timer state');
  if (data.timerState && data.timerState.isRunning) {
    console.log('Service worker loaded, resuming timer');
    startBackgroundTimer();
  }
});

// Listen for when the service worker is about to be terminated
chrome.runtime.onSuspend.addListener(() => {
  console.log('Service worker is being suspended');
  chrome.storage.local.get('timerState', (data) => {
    if (data.timerState && data.timerState.isRunning) {
      console.log('Saving timer state before suspension');
      const timerState = data.timerState;
      timerState.lastUpdated = Date.now();
      chrome.storage.local.set({ timerState });
    }
  });
}); 