document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const luckyBtn = document.getElementById('luckyBtn');
    const urlInput = document.getElementById('urlInput');
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');

    // UI Elements to update
    const ui = {
        ip: document.getElementById('ipAddress'),
        country: document.getElementById('country'),
        city: document.getElementById('city'),
        region: document.getElementById('region'),
        isp: document.getElementById('isp'),
        nearbyList: document.getElementById('nearbyList')
    };

    searchBtn.addEventListener('click', handleSearch);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    luckyBtn.addEventListener('click', () => {
        const funSites = ['google.com', 'wikipedia.org', 'bbc.com', 'cnn.com', 'github.com'];
        const randomSite = funSites[Math.floor(Math.random() * funSites.length)];
        urlInput.value = randomSite;
        handleSearch();
    });

    async function handleSearch() {
        // Reset UI
        resultsDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';
        loadingDiv.classList.remove('hidden');
        ui.nearbyList.innerHTML = ''; // Clear previous suggestions

        const rawInput = urlInput.value.trim();
        if (!rawInput) {
            showError("Please enter a URL.");
            return;
        }

        try {
            const domain = extractHostname(rawInput);

            // 1. Resolve DNS
            const ip = await resolveDns(domain);
            if (!ip) throw new Error("Could not resolve IP address for this domain.");

            // 2. Get Location
            const locationData = await fetchLocation(ip);
            if (locationData.error) throw new Error("Location lookup failed: " + locationData.reason);

            // 3. Update Basic UI
            updateResultUI(ip, locationData);

            // 4. Get Nearby Countries (Borders)
            if (locationData.country_code) { // ipapi.co returns 2-letter code usually, but let's check
                await fetchAndDisplayNearby(locationData.country_code); // ipapi sometimes uses country, sometimes country_code
            }

            loadingDiv.classList.add('hidden');
            resultsDiv.classList.remove('hidden');

        } catch (err) {
            showError(err.message);
        }
    }

    function extractHostname(url) {
        let hostname;
        // Find & remove protocol (http, ftp, etc.) and get hostname
        if (url.indexOf("//") > -1) {
            hostname = url.split('/')[2];
        } else {
            hostname = url.split('/')[0];
        }
        // Find & remove port number
        hostname = hostname.split(':')[0];
        // Find & remove "?"
        hostname = hostname.split('?')[0];

        return hostname;
    }

    async function resolveDns(domain) {
        // specific to IPv4 (type A record = 1)
        const response = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
        const data = await response.json();

        if (data.Status !== 0 || !data.Answer) {
            return null;
        }

        // Return the first A record data (IP address)
        const record = data.Answer.find(ans => ans.type === 1);
        return record ? record.data : null;
    }

    async function fetchLocation(ip) {
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!response.ok) throw new Error("GeoIP service unavailable.");
        return await response.json();
    }

    async function fetchAndDisplayNearby(countryCode) {
        try {
            // First get the country details to find border codes
            // ipapi.co provides A 2-letter ISO code. restcountries supports 2 or 3 letter lookup.
            const countryRes = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}`);
            if (!countryRes.ok) return; // Fail silently for suggestions

            const countryData = await countryRes.json();
            const country = countryData[0];

            if (!country.borders || country.borders.length === 0) {
                const li = document.createElement('li');
                li.textContent = "No bordering countries found (Island nation?)";
                ui.nearbyList.appendChild(li);
                return;
            }

            // Now resolve the border codes (3-letter) to full names
            const borders = country.borders.join(',');
            const neighborsRes = await fetch(`https://restcountries.com/v3.1/alpha?codes=${borders}`);
            const neighborsData = await neighborsRes.json();

            // Populate list
            neighborsData.forEach(neighbor => {
                const li = document.createElement('li');
                li.textContent = neighbor.name.common; // + " " + neighbor.flag;
                ui.nearbyList.appendChild(li);
            });

        } catch (e) {
            console.error("Error fetching neighbors:", e);
            // Optionally append a "Could not load suggestions" message
        }
    }

    function updateResultUI(ip, data) {
        ui.ip.textContent = ip;
        ui.country.textContent = data.country_name || data.country;
        ui.city.textContent = data.city;
        ui.region.textContent = data.region;
        ui.isp.textContent = data.org || data.isp;
    }

    function showError(msg) {
        loadingDiv.classList.add('hidden');
        errorDiv.classList.remove('hidden');
        errorDiv.textContent = msg;
    }
});
