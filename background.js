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
    if (!data.timerState || !data.timerState.isRunning) return;
    
    const timerState = data.timerState;
    const currentTime = Date.now();
    const elapsedSeconds = Math.floor((currentTime - timerState.lastUpdated) / 1000);
    
    if (elapsedSeconds <= 0) return;
    
    // Update remaining seconds
    timerState.remainingSeconds -= elapsedSeconds;
    
    // Check if timer completed
    if (timerState.remainingSeconds <= 0) {
      timerCompleted();
      return;
    }
    
    // Calculate minutes and seconds
    timerState.minutes = Math.floor(timerState.remainingSeconds / 60);
    timerState.seconds = timerState.remainingSeconds % 60;
    
    // Update last updated time
    timerState.lastUpdated = currentTime;
    
    // Save updated timer state
    chrome.storage.local.set({ timerState });
    
    // Update badge
    updateBadge(timerState.minutes, timerState.seconds);
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
    });
  });
}

// Start background timer
function startBackgroundTimer() {
  // Clear any existing intervals
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Start new interval that runs every second
  timerInterval = setInterval(updateTimer, 1000);
}

// Stop background timer
function stopBackgroundTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startTimer') {
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
    
    chrome.storage.local.set({ timerState });
    
    // Start background timer
    startBackgroundTimer();
    
    // Update badge
    updateBadge(minutes, seconds);
    
    sendResponse({ success: true });
  } else if (message.action === 'stopTimer') {
    // Update timer state
    chrome.storage.local.get('timerState', (data) => {
      if (data.timerState) {
        const timerState = data.timerState;
        timerState.isRunning = false;
        chrome.storage.local.set({ timerState });
      }
    });
    
    // Clear badge
    chrome.action.setBadgeText({ text: '' });
    
    sendResponse({ success: true });
  } else if (message.action === 'getTimerState') {
    // Get current timer state
    chrome.storage.local.get('timerState', (data) => {
      if (data.timerState) {
        // If timer is running, update it first
        if (data.timerState.isRunning) {
          const timerState = data.timerState;
          const currentTime = Date.now();
          const elapsedSeconds = Math.floor((currentTime - timerState.lastUpdated) / 1000);
          
          if (elapsedSeconds > 0) {
            // Update remaining seconds
            timerState.remainingSeconds -= elapsedSeconds;
            
            // Check if timer completed
            if (timerState.remainingSeconds <= 0) {
              timerCompleted();
              return;
            }
            
            // Calculate minutes and seconds
            timerState.minutes = Math.floor(timerState.remainingSeconds / 60);
            timerState.seconds = timerState.remainingSeconds % 60;
            
            // Update last updated time
            timerState.lastUpdated = currentTime;
            
            // Save updated timer state
            chrome.storage.local.set({ timerState });
          }
        }
        
        sendResponse({ timerState: data.timerState });
      } else {
        sendResponse({ timerState: null });
      }
    });
    
    return true; // Keep the message channel open for async response
  }
  
  return true; // Keep the message channel open for async response
});

// Start background timer when extension is loaded
startBackgroundTimer();

// Keep service worker alive in Manifest V3
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // This alarm keeps the service worker alive
    updateTimer();
  }
}); 