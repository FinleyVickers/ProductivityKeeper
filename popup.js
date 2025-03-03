// Create Vue app
const { createApp, h } = Vue;

// Add event listener for when the popup is about to close
window.addEventListener('beforeunload', () => {
  // Force a sync with the background to ensure timer state is saved
  chrome.runtime.sendMessage({ action: 'getTimerState' });
});

// Add event listener for when the popup is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded, ensuring timer state is loaded');
  // Force a sync with the background to ensure timer state is loaded
  chrome.runtime.sendMessage({ action: 'getTimerState' });
});

const app = createApp({
  data() {
    return {
      minutes: 25,
      seconds: 0,
      isRunning: false,
      currentMode: 'pomodoro',
      interval: null,
      totalSeconds: 25 * 60,
      remainingSeconds: 25 * 60,
      completedPomodoros: 0,
      showSettings: false,
      settings: {
        pomodoroDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        autoStartBreaks: false,
        autoStartPomodoros: false,
        notificationSound: 'bell',
        themeColor: 'blue',
        darkMode: false
      },
      progressOffset: 0,
      syncInterval: null,
      isResettingOrSwitching: false,
      lastSyncTime: Date.now(),
      lastBackgroundSync: Date.now()
    };
  },
  
  computed: {
    progressRingCircumference() {
      return 2 * Math.PI * 100;
    }
  },
  
  methods: {
    // Format time to always show two digits
    formatTime(time) {
      return String(time).padStart(2, '0');
    },
    
    // Start timer
    startTimer() {
      if (this.isRunning) return;
      
      this.isRunning = true;
      this.lastSyncTime = Date.now();
      this.lastBackgroundSync = Date.now();
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'startTimer',
        minutes: this.minutes,
        seconds: this.seconds,
        mode: this.currentMode,
        totalSeconds: this.totalSeconds,
        remainingSeconds: this.remainingSeconds,
        completedPomodoros: this.completedPomodoros
      }, (response) => {
        // Ensure we got a response from the background script
        if (response && response.success) {
          console.log('Timer started in background');
        } else {
          console.error('Failed to start timer in background');
        }
      });
      
      // Start local interval for UI updates
      this.startSyncInterval();
    },
    
    // Pause timer
    pauseTimer() {
      if (!this.isRunning) return;
      
      this.isRunning = false;
      
      // Clear local interval
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'stopTimer'
      }, (response) => {
        // Ensure we got a response from the background script
        if (response && response.success) {
          console.log('Timer stopped in background');
        } else {
          console.error('Failed to stop timer in background');
        }
      });
    },
    
    // Reset timer
    resetTimer() {
      console.log('Resetting timer');
      
      // Set the flag to prevent sync during reset
      this.isResettingOrSwitching = true;
      
      // First, pause the timer and clear any sync intervals
      this.pauseTimer();
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
      
      // Reset sync times
      this.lastSyncTime = Date.now();
      this.lastBackgroundSync = Date.now();
      
      // Set the appropriate duration based on the current mode
      switch (this.currentMode) {
        case 'pomodoro':
          this.minutes = this.settings.pomodoroDuration;
          this.totalSeconds = this.settings.pomodoroDuration * 60;
          break;
        case 'shortBreak':
          this.minutes = this.settings.shortBreakDuration;
          this.totalSeconds = this.settings.shortBreakDuration * 60;
          break;
        case 'longBreak':
          this.minutes = this.settings.longBreakDuration;
          this.totalSeconds = this.settings.longBreakDuration * 60;
          break;
      }
      
      this.seconds = 0;
      this.remainingSeconds = this.totalSeconds;
      this.updateProgressRing();
      
      // Send message to background script to reset timer state
      chrome.runtime.sendMessage({
        action: 'resetTimer',
        minutes: this.minutes,
        seconds: this.seconds,
        mode: this.currentMode,
        totalSeconds: this.totalSeconds,
        remainingSeconds: this.totalSeconds,
        completedPomodoros: this.completedPomodoros
      }, (response) => {
        // After the background has been updated, restart the sync interval
        // with a slight delay to ensure the background state is updated first
        setTimeout(() => {
          console.log('Timer reset complete, restarting sync');
          this.isResettingOrSwitching = false;
          this.startSyncInterval();
        }, 300);
      });
    },
    
    // Update progress ring
    updateProgressRing() {
      const progress = 1 - (this.remainingSeconds / this.totalSeconds);
      this.progressOffset = this.progressRingCircumference - (progress * this.progressRingCircumference);
    },
    
    // Timer completed
    timerCompleted() {
      // This is now handled by the background script
      // We just need to update the UI
      this.isRunning = false;
      clearInterval(this.interval);
      
      // Sync with background state
      this.syncWithBackgroundState();
    },
    
    // Switch timer mode
    switchMode(mode) {
      console.log(`Switching mode to ${mode}`);
      
      // Set the flag to prevent sync during mode switch
      this.isResettingOrSwitching = true;
      
      // First, pause any running timer and clear sync intervals
      this.pauseTimer();
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
      
      // Reset sync times
      this.lastSyncTime = Date.now();
      this.lastBackgroundSync = Date.now();
      
      this.currentMode = mode;
      
      switch (mode) {
        case 'pomodoro':
          this.minutes = this.settings.pomodoroDuration;
          this.totalSeconds = this.settings.pomodoroDuration * 60;
          break;
        case 'shortBreak':
          this.minutes = this.settings.shortBreakDuration;
          this.totalSeconds = this.settings.shortBreakDuration * 60;
          break;
        case 'longBreak':
          this.minutes = this.settings.longBreakDuration;
          this.totalSeconds = this.settings.longBreakDuration * 60;
          break;
      }
      
      this.seconds = 0;
      this.remainingSeconds = this.totalSeconds;
      this.updateProgressRing();
      
      // Send message to background script to update timer mode
      chrome.runtime.sendMessage({
        action: 'switchMode',
        minutes: this.minutes,
        seconds: this.seconds,
        mode: this.currentMode,
        totalSeconds: this.totalSeconds,
        remainingSeconds: this.totalSeconds,
        completedPomodoros: this.completedPomodoros
      }, (response) => {
        // After the background has been updated, restart the sync interval
        // with a slight delay to ensure the background state is updated first
        setTimeout(() => {
          console.log('Mode switch complete, restarting sync');
          this.isResettingOrSwitching = false;
          this.startSyncInterval();
        }, 300);
      });
    },
    
    // Toggle settings panel
    toggleSettings() {
      this.showSettings = !this.showSettings;
    },
    
    // Save settings
    saveSettings() {
      // Convert string values to numbers
      this.settings.pomodoroDuration = parseInt(this.settings.pomodoroDuration, 10);
      this.settings.shortBreakDuration = parseInt(this.settings.shortBreakDuration, 10);
      this.settings.longBreakDuration = parseInt(this.settings.longBreakDuration, 10);
      
      // Save settings to storage
      chrome.storage.sync.set({ 'productivityKeeperSettings': this.settings }, () => {
        // Apply theme color
        this.applyThemeColor();
        
        // Close settings panel
        this.showSettings = false;
        
        // Reset timer with new settings
        this.resetTimer();
      });
    },
    
    // Load settings from storage
    loadSettings() {
      chrome.storage.sync.get('productivityKeeperSettings', (data) => {
        if (data.productivityKeeperSettings) {
          console.log('Loading settings from storage');
          this.settings = data.productivityKeeperSettings;
          this.applyThemeColor();
          
          // Don't reset the timer here, as we'll sync with background state later
          // This prevents the timer from resetting when the popup is opened
        }
      });
    },
    
    // Apply theme color
    applyThemeColor() {
      // Remove all theme classes
      document.body.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-orange');
      
      // Add selected theme class
      if (this.settings.themeColor !== 'blue') {
        document.body.classList.add(`theme-${this.settings.themeColor}`);
      }
      
      // Apply dark mode
      if (this.settings.darkMode) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    },
    
    // Sync with background state
    syncWithBackgroundState() {
      // Add a flag to track if we're currently in the middle of a reset or mode switch
      if (this.isResettingOrSwitching) {
        return;
      }
      
      chrome.runtime.sendMessage({ action: 'getTimerState' }, (response) => {
        if (response && response.timerState) {
          const timerState = response.timerState;
          
          // Only update if there's a significant difference or state change
          // This prevents visual stuttering during normal countdown
          const significantChange = 
            this.isRunning !== timerState.isRunning || 
            this.currentMode !== timerState.mode ||
            this.completedPomodoros !== timerState.completedPomodoros ||
            Math.abs(this.remainingSeconds - timerState.remainingSeconds) > 2;
          
          if (significantChange) {
            console.log('Significant change detected, updating UI from background');
            // Update local state from background
            this.minutes = timerState.minutes;
            this.seconds = timerState.seconds;
            this.isRunning = timerState.isRunning;
            this.currentMode = timerState.mode;
            this.totalSeconds = timerState.totalSeconds;
            this.remainingSeconds = timerState.remainingSeconds;
            this.completedPomodoros = timerState.completedPomodoros;
            
            // Reset sync times to prevent jumps
            this.lastSyncTime = Date.now();
            this.lastBackgroundSync = Date.now();
            
            this.updateProgressRing();
          } else if (this.isRunning) {
            // For running timers, implement a smoother local countdown
            // instead of constantly syncing with the background
            this.updateLocalCountdown();
          }
          
          // If timer is running, ensure we have a local sync interval
          if (timerState.isRunning && !this.syncInterval) {
            console.log('Timer is running but no sync interval, starting sync interval');
            this.startSyncInterval();
          } else if (!timerState.isRunning && this.syncInterval) {
            // If timer is not running but we have an interval, clear it
            console.log('Timer is not running but sync interval exists, clearing interval');
            clearInterval(this.syncInterval);
            this.syncInterval = null;
          }
        } else {
          console.error('Failed to get timer state from background in syncWithBackgroundState');
        }
      });
    },
    
    // Update the local countdown for smoother visual updates
    updateLocalCountdown() {
      // Calculate the current time based on the last sync
      const now = Date.now();
      const elapsedSinceLastSync = (now - this.lastSyncTime) / 1000;
      
      // For smoother updates, we'll update the progress ring on every call
      // but only update the displayed time when a full second has passed
      
      // Calculate the precise remaining seconds (including fractional part)
      const preciseRemainingSeconds = this.remainingSeconds - elapsedSinceLastSync;
      
      // Don't let it go below zero
      if (preciseRemainingSeconds <= 0) {
        // If we've reached zero locally, sync with background to get the next state
        this.syncWithBackgroundState();
        return;
      }
      
      // Update the progress ring with the precise value for smooth animation
      const progress = 1 - (preciseRemainingSeconds / this.totalSeconds);
      this.progressOffset = this.progressRingCircumference - (progress * this.progressRingCircumference);
      
      // Only update the displayed time when a full second has passed
      if (elapsedSinceLastSync >= 1) {
        // Update the last sync time
        this.lastSyncTime = now;
        
        // Decrement the remaining seconds
        this.remainingSeconds = Math.max(0, this.remainingSeconds - Math.floor(elapsedSinceLastSync));
        
        // Calculate minutes and seconds
        this.minutes = Math.floor(this.remainingSeconds / 60);
        this.seconds = this.remainingSeconds % 60;
      }
    },
    
    // Start sync interval for UI updates
    startSyncInterval() {
      // Don't start a new interval if we're in the middle of resetting or switching modes
      if (this.isResettingOrSwitching) {
        return;
      }
      
      // Clear any existing interval
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
      
      // Initialize the last sync time and background sync time
      this.lastSyncTime = Date.now();
      this.lastBackgroundSync = Date.now();
      
      console.log('Starting sync interval for UI updates');
      
      // Start new interval for smooth local updates (runs more frequently)
      this.syncInterval = setInterval(() => {
        // Only update if we're not in the middle of resetting or switching modes
        if (!this.isResettingOrSwitching) {
          if (this.isRunning) {
            // Update the local countdown for smooth visual updates
            this.updateLocalCountdown();
            
            // Sync with background less frequently (every 2 seconds)
            // to avoid visual stuttering but still stay in sync
            const now = Date.now();
            if (now - this.lastBackgroundSync >= 2000) {
              this.lastBackgroundSync = now;
              
              // Get the timer state from the background
              chrome.runtime.sendMessage({ action: 'getTimerState' }, (response) => {
                if (response && response.timerState) {
                  const timerState = response.timerState;
                  
                  // Check if the background timer is still running
                  if (!timerState.isRunning && this.isRunning) {
                    console.log('Background timer stopped but UI thinks it\'s running, updating UI');
                    // Background timer stopped but UI thinks it's running
                    // Update UI to match background
                    this.isRunning = false;
                    if (this.syncInterval) {
                      clearInterval(this.syncInterval);
                      this.syncInterval = null;
                    }
                    
                    // Update all timer values from background
                    this.minutes = timerState.minutes;
                    this.seconds = timerState.seconds;
                    this.remainingSeconds = timerState.remainingSeconds;
                    this.updateProgressRing();
                  } else if (timerState.isRunning && !this.isRunning) {
                    console.log('Background timer running but UI thinks it\'s stopped, updating UI');
                    // Background timer running but UI thinks it's stopped
                    // Update UI to match background
                    this.isRunning = true;
                    
                    // Update all timer values from background
                    this.minutes = timerState.minutes;
                    this.seconds = timerState.seconds;
                    this.remainingSeconds = timerState.remainingSeconds;
                    this.updateProgressRing();
                  } else if (timerState.isRunning && this.isRunning) {
                    // Both running, check if we need to sync values
                    const timeDiff = Math.abs(this.remainingSeconds - timerState.remainingSeconds);
                    if (timeDiff > 2) {
                      console.log(`Syncing with background, time difference: ${timeDiff}s`);
                      // If difference is more than 2 seconds, sync with background
                      this.minutes = timerState.minutes;
                      this.seconds = timerState.seconds;
                      this.remainingSeconds = timerState.remainingSeconds;
                      this.lastSyncTime = Date.now();
                      this.updateProgressRing();
                    }
                  }
                  
                  // Always update completed pomodoros and mode from background
                  if (this.completedPomodoros !== timerState.completedPomodoros) {
                    this.completedPomodoros = timerState.completedPomodoros;
                  }
                  
                  if (this.currentMode !== timerState.mode) {
                    this.currentMode = timerState.mode;
                  }
                }
              });
            }
          } else {
            // If not running, just sync with background once every 2 seconds
            // instead of on every interval to reduce unnecessary calls
            const now = Date.now();
            if (now - this.lastBackgroundSync >= 2000) {
              this.lastBackgroundSync = now;
              this.syncWithBackgroundState();
            }
          }
        }
      }, 100); // Update every 100ms for smooth visuals
    },
    
    // Initialize
    initialize() {
      console.log('Initializing popup');
      
      // First load settings
      this.loadSettings();
      
      // Then sync with background state
      chrome.runtime.sendMessage({ action: 'getTimerState' }, (response) => {
        if (response && response.timerState) {
          const timerState = response.timerState;
          
          console.log('Initializing popup with background state:', timerState);
          
          // Update local state from background
          this.minutes = timerState.minutes;
          this.seconds = timerState.seconds;
          this.isRunning = timerState.isRunning;
          this.currentMode = timerState.mode;
          this.totalSeconds = timerState.totalSeconds;
          this.remainingSeconds = timerState.remainingSeconds;
          this.completedPomodoros = timerState.completedPomodoros;
          
          // Reset sync times
          this.lastSyncTime = Date.now();
          this.lastBackgroundSync = Date.now();
          
          this.updateProgressRing();
          
          // If timer is running, start the sync interval
          if (timerState.isRunning) {
            this.startSyncInterval();
          }
        } else {
          console.error('Failed to get timer state from background');
        }
      });
    }
  },
  
  // When Vue app is mounted
  mounted() {
    this.initialize();
  },
  
  // When Vue app is unmounted
  unmounted() {
    // Clear intervals
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Force a sync with the background to ensure timer state is saved
    if (this.isRunning) {
      console.log('Vue app unmounting, ensuring timer state is saved');
      chrome.runtime.sendMessage({
        action: 'getTimerState'
      });
    }
  },

  // Render function
  render() {
    return h('div', { class: 'container' }, [
      // Header
      h('div', { class: 'header' }, [
        h('h1', { class: 'animate__animated animate__fadeIn' }, 'Productivity Keeper'),
        h('button', { 
          class: 'icon-btn animate__animated animate__fadeIn',
          onClick: this.toggleSettings
        }, [
          h('span', { class: 'material-icons' }, '⚙️')
        ])
      ]),
      
      // Timer container
      h('div', { class: 'timer-container animate__animated animate__fadeIn' }, [
        h('div', { class: 'progress-ring-container' }, [
          // Timer display inside the progress ring container
          h('div', { class: 'timer-display' }, [
            h('span', {}, this.formatTime(this.minutes)),
            h('span', {}, ':'),
            h('span', {}, this.formatTime(this.seconds))
          ]),
          
          h('svg', { class: 'progress-ring', width: 220, height: 220 }, [
            h('circle', { 
              class: 'progress-ring-circle-bg',
              cx: 110,
              cy: 110,
              r: 100
            }),
            h('circle', { 
              class: 'progress-ring-circle',
              cx: 110,
              cy: 110,
              r: 100,
              style: { strokeDashoffset: this.progressOffset }
            })
          ])
        ]),
        
        // Timer controls outside the progress ring container
        h('div', { class: 'timer-controls' }, [
          !this.isRunning ? 
            h('button', { 
              class: 'btn primary-btn',
              onClick: this.startTimer
            }, [
              h('span', { class: 'btn-icon' }, '▶'),
              ' Start'
            ]) :
            h('button', { 
              class: 'btn secondary-btn',
              onClick: this.pauseTimer
            }, [
              h('span', { class: 'btn-icon' }, '⏸'),
              ' Pause'
            ]),
          h('button', { 
            class: 'btn reset-btn',
            onClick: this.resetTimer
          }, [
            h('span', { class: 'btn-icon' }, '↺'),
            ' Reset'
          ])
        ])
      ]),
      
      // Mode selector
      h('div', { class: 'mode-selector animate__animated animate__fadeIn' }, [
        h('button', { 
          class: ['mode-btn', { active: this.currentMode === 'pomodoro' }],
          onClick: () => this.switchMode('pomodoro')
        }, 'Pomodoro'),
        h('button', { 
          class: ['mode-btn', { active: this.currentMode === 'shortBreak' }],
          onClick: () => this.switchMode('shortBreak')
        }, 'Short Break'),
        h('button', { 
          class: ['mode-btn', { active: this.currentMode === 'longBreak' }],
          onClick: () => this.switchMode('longBreak')
        }, 'Long Break')
      ]),
      
      // Pomodoro count
      h('div', { class: 'pomodoro-count animate__animated animate__fadeIn' }, 
        Array.from({ length: 4 }, (_, i) => i + 1).map(n => 
          h('div', { 
            key: n,
            class: ['pomodoro-indicator', { completed: this.completedPomodoros >= n }]
          })
        )
      ),
      
      // Settings panel (with transition)
      this.showSettings ? 
        h('div', { class: 'settings-panel slide-enter-active' }, [
          h('h2', {}, 'Settings'),
          
          // Pomodoro Duration
          h('div', { class: 'setting-item' }, [
            h('label', { for: 'pomodoro-duration' }, 'Pomodoro Duration (minutes):'),
            h('input', { 
              type: 'number',
              id: 'pomodoro-duration',
              value: this.settings.pomodoroDuration,
              min: 1,
              max: 60,
              onInput: (e) => this.settings.pomodoroDuration = e.target.value
            })
          ]),
          
          // Short Break Duration
          h('div', { class: 'setting-item' }, [
            h('label', { for: 'short-break-duration' }, 'Short Break Duration (minutes):'),
            h('input', { 
              type: 'number',
              id: 'short-break-duration',
              value: this.settings.shortBreakDuration,
              min: 1,
              max: 30,
              onInput: (e) => this.settings.shortBreakDuration = e.target.value
            })
          ]),
          
          // Long Break Duration
          h('div', { class: 'setting-item' }, [
            h('label', { for: 'long-break-duration' }, 'Long Break Duration (minutes):'),
            h('input', { 
              type: 'number',
              id: 'long-break-duration',
              value: this.settings.longBreakDuration,
              min: 1,
              max: 60,
              onInput: (e) => this.settings.longBreakDuration = e.target.value
            })
          ]),
          
          // Auto-start breaks
          h('div', { class: 'setting-item checkbox-item' }, [
            h('label', { for: 'auto-start-breaks' }, 'Auto-start breaks:'),
            h('label', { class: 'switch' }, [
              h('input', { 
                type: 'checkbox',
                id: 'auto-start-breaks',
                checked: this.settings.autoStartBreaks,
                onChange: (e) => this.settings.autoStartBreaks = e.target.checked
              }),
              h('span', { class: 'slider round' })
            ])
          ]),
          
          // Auto-start pomodoros
          h('div', { class: 'setting-item checkbox-item' }, [
            h('label', { for: 'auto-start-pomodoros' }, 'Auto-start pomodoros:'),
            h('label', { class: 'switch' }, [
              h('input', { 
                type: 'checkbox',
                id: 'auto-start-pomodoros',
                checked: this.settings.autoStartPomodoros,
                onChange: (e) => this.settings.autoStartPomodoros = e.target.checked
              }),
              h('span', { class: 'slider round' })
            ])
          ]),
          
          // Notification Sound
          h('div', { class: 'setting-item' }, [
            h('label', { for: 'notification-sound' }, 'Notification Sound:'),
            h('select', { 
              id: 'notification-sound',
              class: 'select-styled',
              value: this.settings.notificationSound,
              onChange: (e) => this.settings.notificationSound = e.target.value
            }, [
              h('option', { value: 'bell' }, 'Bell'),
              h('option', { value: 'digital' }, 'Digital'),
              h('option', { value: 'gentle' }, 'Gentle')
            ])
          ]),
          
          // Dark Mode
          h('div', { class: 'setting-item checkbox-item' }, [
            h('label', { for: 'dark-mode' }, 'Dark Mode:'),
            h('label', { class: 'switch' }, [
              h('input', { 
                type: 'checkbox',
                id: 'dark-mode',
                checked: this.settings.darkMode,
                onChange: (e) => this.settings.darkMode = e.target.checked
              }),
              h('span', { class: 'slider round' })
            ])
          ]),
          
          // Theme Color
          h('div', { class: 'setting-item' }, [
            h('label', { for: 'theme-color' }, 'Theme Color:'),
            h('select', { 
              id: 'theme-color',
              class: 'select-styled',
              value: this.settings.themeColor,
              onChange: (e) => this.settings.themeColor = e.target.value
            }, [
              h('option', { value: 'blue' }, 'Blue'),
              h('option', { value: 'green' }, 'Green'),
              h('option', { value: 'purple' }, 'Purple'),
              h('option', { value: 'orange' }, 'Orange')
            ])
          ]),
          
          // Save button
          h('button', { 
            class: 'btn primary-btn save-btn',
            onClick: this.saveSettings
          }, 'Save')
        ]) : null
    ]);
  }
});

// Mount Vue app
app.mount('#app'); 