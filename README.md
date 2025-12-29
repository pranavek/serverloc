# Server Location Lookup

A simple, minimal website to check the server location, IP address, and ISP of any website URL. It also intelligently detects embedded video streams to find *where the video is actually streaming from*.

## APIs Used
1. **Google Public DNS** (`https://dns.google/resolve`): Resolves domain names to IP addresses.
2. **ipapi.co** (`https://ipapi.co/json/`): Provides Geolocation data for the IP.
3. **REST Countries** (`https://restcountries.com/`): Finds bordering countries for suggestions.
4. **CORS Proxy** (`https://corsproxy.io/`): Used to fetch page content securely to inspect for video embeds.

## How it works
1. The user enters a URL.
2. The app resolves the DNS of the URL to get the main server IP.
3. It fetches the location data for that IP.
4. Concurrently, it fetches the page HTML via a proxy to look for `<video>` tags or video player `<iframe>`s (like YouTube, Vimeo, or custom players).
5. If a video source is found, it resolves *that* domain's location as well.
6. Finally, it displays nearby countries for all detected locations to help with e.g. VPN routing choices.
