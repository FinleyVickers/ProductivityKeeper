# Productivity Keeper

A Chrome extension featuring a Pomodoro timer to help you stay productive with a beautiful, modern UI.

## Features

- **Pomodoro Timer**: 25-minute work sessions followed by breaks
- **Customizable Durations**: Set your own work and break durations
- **Visual Progress**: Circular progress indicator with gradient shows time remaining
- **Multiple Timer Modes**: Pomodoro, Short Break, and Long Break
- **Notifications**: Get notified when a timer completes
- **Auto-start Options**: Automatically start the next work session or break
- **Theme Options**: Choose from multiple color themes
- **Clean, Modern UI**: Beautiful interface with gradients and animations
- **Pomodoro Counter**: Visual indicator of completed pomodoros

## Technologies Used

- **Vue.js**: For reactive UI components and state management
- **CSS Animations**: Smooth transitions and visual feedback
- **CSS Gradients**: Modern, attractive color schemes
- **Chrome Extension API**: For notifications, storage, and alarms

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the directory containing this extension
5. The Productivity Keeper extension should now appear in your extensions list

## Usage

1. Click on the Productivity Keeper icon in your Chrome toolbar
2. Select a timer mode (Pomodoro, Short Break, or Long Break)
3. Click "Start" to begin the timer
4. Work until the timer completes
5. Take a break when prompted
6. Repeat the cycle to maintain productivity

## Customization

Click the settings icon (⚙️) to customize:

- Pomodoro duration (default: 25 minutes)
- Short break duration (default: 5 minutes)
- Long break duration (default: 15 minutes)
- Auto-start options for breaks and work sessions
- Notification sounds
- Color theme (Blue, Green, Purple, Orange)

## The Pomodoro Technique

The Pomodoro Technique is a time management method developed by Francesco Cirillo in the late 1980s. It uses a timer to break work into intervals, traditionally 25 minutes in length, separated by short breaks. Each interval is known as a "pomodoro," the Italian word for tomato, after the tomato-shaped kitchen timer Cirillo used as a university student.

The technique works as follows:
1. Decide on the task to be done
2. Set the timer for 25 minutes (one pomodoro)
3. Work on the task until the timer rings
4. Take a short break (5 minutes)
5. After four pomodoros, take a longer break (15-30 minutes)

## Project Structure

- `popup.html`: The main extension popup interface
- `popup.js`: Main application logic using Vue.js
- `background.js`: Background service worker for timer management
- `styles.css`: Main stylesheet for the extension
- `manifest.json`: Chrome extension manifest file
- `lib/`: Directory containing third-party libraries
  - `lib/vue/`: Vue.js framework files with its own LICENSE
- `images/`: Icons and images used in the extension
- `sounds/`: Notification sounds

## Third-Party Libraries

This project uses the following third-party libraries:

- **Vue.js**: A progressive JavaScript framework for building user interfaces
  - Located in: `lib/vue/`
  - License: MIT
  - Website: [vuejs.org](https://vuejs.org/)

- **Animate.css**: A library of ready-to-use CSS animations
  - Located in: `lib/animate-css/`
  - License: MIT
  - Website: [animate.style](https://animate.style/)

## License

MIT License - See the LICENSE file for details. 