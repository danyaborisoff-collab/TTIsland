# Third-party notices

The MIT license in this folder applies to the independently implemented TTIsland source, not to external services or all components of a packaged runtime.

Electron, Chromium, Node.js, electron-builder, bundled fonts/codecs and their transitive dependencies retain their own licenses and notices. Preserve the LICENSE and LICENSES.chromium.html files and all applicable notices produced by the packaging tools. A release distributor must audit the exact resolved dependency versions before distributing a compiled installer.

Yandex, VK, SoundCloud, Spotify, DeepSeek, Claude, Gemini and Alice are third-party services. Names are descriptive; this project is not affiliated with them. Accounts, content, subscriptions and availability are governed by each service.

Architecture inspiration: HeyyCzer/windows-dynamic-island and FlorianButz/DynamicWin. Their GPL/CC BY-SA source, assets, branding and animation implementations are NOT included. Bluetooth linking and transport logic here are independent implementations using Windows/Electron APIs.

IMAPFlow 2.11.0 by Postal Systems OÜ is used for the optional mail integration under its MIT license; see IMAPFLOW-LICENSE.txt. Its transitive npm dependencies have their own licenses; preserve their notices in redistributed packages.

### Open-Meteo weather data
The optional city search and weather forecast use Open-Meteo (https://open-meteo.com/). Forecast data is provided by Open-Meteo and its underlying weather-model providers. The city entered and selected coordinates are sent to Open-Meteo only when using that forecast feature. See https://open-meteo.com/en/terms for service terms and attribution.


## TTIsland 0.14.0 Living
Идеи поведения: публичное описание https://github.com/exuupery/island. Исходный код и ресурсы этого приложения не включены. living.js, living.css, system-controls.cjs и рисунок Бири — самостоятельная реализация для TTIsland под лицензией проекта.


## TTIsland 0.15.0
Новые контроллеры Wi-Fi, Core Audio и внутренние панели — самостоятельный код TTIsland. Используются системные Windows WLAN API, Windows Runtime, Core Audio и штатные VPN/Power средства ОС. Чужие исходники не переносились.
