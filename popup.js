// Create Vue app
const { createApp, h } = Vue;

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
      syncInterval: null
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
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'startTimer',
        minutes: this.minutes,
        seconds: this.seconds,
        mode: this.currentMode,
        totalSeconds: this.totalSeconds,
        remainingSeconds: this.remainingSeconds,
        completedPomodoros: this.completedPomodoros
      });
      
      // Start local interval for UI updates
      this.startSyncInterval();
    },
    
    // Pause timer
    pauseTimer() {
      if (!this.isRunning) return;
      
      this.isRunning = false;
      clearInterval(this.interval);
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'stopTimer'
      });
    },
    
    // Reset timer
    resetTimer() {
      this.pauseTimer();
      
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
      this.pauseTimer();
      this.updateProgressRing();
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
          this.settings = data.productivityKeeperSettings;
          this.applyThemeColor();
          this.resetTimer();
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
      chrome.runtime.sendMessage({ action: 'getTimerState' }, (response) => {
        if (response && response.timerState) {
          const timerState = response.timerState;
          
          this.minutes = timerState.minutes;
          this.seconds = timerState.seconds;
          this.isRunning = timerState.isRunning;
          this.currentMode = timerState.mode;
          this.totalSeconds = timerState.totalSeconds;
          this.remainingSeconds = timerState.remainingSeconds;
          this.completedPomodoros = timerState.completedPomodoros;
          
          this.updateProgressRing();
          
          // If timer is running, start local sync interval
          if (this.isRunning) {
            this.startSyncInterval();
          }
        }
      });
    },
    
    // Start sync interval for UI updates
    startSyncInterval() {
      // Clear any existing interval
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }
      
      // Start new interval
      this.syncInterval = setInterval(() => {
        this.syncWithBackgroundState();
      }, 1000);
    },
    
    // Initialize
    initialize() {
      this.loadSettings();
      this.syncWithBackgroundState();
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