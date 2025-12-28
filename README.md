# Server Location Lookup

A simple, minimal website to check the server location, IP address, and ISP of any website URL. It also provides VPN suggestions based on neighboring countries.

## Features
- **Minimalist Design**: Inspired by Google's homepage.
- **Server Details**: IP, Country, City, ISP.
- **VPN Suggestions**: Lists nearby/bordering countries.
- **Client-Side Only**: No backend required, runs entirely in the browser.

## APIs Used
1. **Google Public DNS**: `https://dns.google/resolve` - Resolves domain names to IP addresses.
2. **ipapi.co**: `https://ipapi.co/json/` - Provides Geolocation data for the IP.
3. **REST Countries**: `https://restcountries.com/` - Finds bordering countries for suggestions.


