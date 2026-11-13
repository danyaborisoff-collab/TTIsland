# TTIsland backlog after 0.11

Implemented: separate music/AI choices and sessions, ContainerId battery lookup with PnP fallback, local voice recording/transcription capability, adjustable dimensions and draggable grip, MIT license for our source.

Not implemented in this release:
- Phone notification relay / AirDrop-style transfer: requires a separate phone companion, explicit pairing, encryption and Android/iOS-specific permissions. No relay is secretly active.
- Donation payments: no payment address was provided; no invented donation link is included.
- Fully tested Spotify DRM and Google OAuth in embedded Electron. A normal browser fallback is present, but external browser sessions/playback are not controlled by the current embedded player adapter.
- Universal native SMTC player bridge and replacement of all PowerShell system helpers.
- Bundled universal Russian speech model. Windows System.Speech availability is checked; Win+H can be used manually in the note field.
- Production distribution: source archive is shareable under MIT for our code; signed Windows installer and reproducible Windows hardware tests remain required.
