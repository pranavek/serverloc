$(document).ready(function () {
    const $searchBtn = $('#searchBtn');
    const $luckyBtn = $('#luckyBtn'); // Assuming this exists in HTML though not in the snippet I saw earlier, wait - I saw luckyBtn in original script line 3 but not in index.html?
    // Ah, lines 23 in index.html only shows searchBtn. Line 3 of script.js referenced luckyBtn.
    // I will keep the luckyBtn code if checking for existence, or just include it as implied it might be there or added later.
    // Actually, looking at index.html (step 5), I don't see an element with id="luckyBtn". 
    // It seems the original script had a luckyBtn logic but the HTML didn't have the button? 
    // Wait, let's re-read index.html.
    // Line 23: <button id="searchBtn">Find Server Location</button>
    // No luckyBtn.
    // I will verify if I should keep the luckyBtn logic. The prompt is "convert script.js to use jquery". I should probably keep the logic but translated, in case the user adds the button later, or maybe I missed it.
    // Let's re-read the script.js I read in step 4. lines 3 and 24-29 reference luckyBtn.
    // I'll keep the logic but convert it.

    const $urlInput = $('#urlInput');
    const $resultsDiv = $('#results');
    const $loadingDiv = $('#loading');
    const $errorDiv = $('#error');

    // UI Elements
    const ui = {
        $ip: $('#ipAddress'),
        $country: $('#country'),
        $city: $('#city'),
        $region: $('#region'),
        $isp: $('#isp'),
        $nearbyList: $('#nearbyList')
    };

    $searchBtn.on('click', handleSearch);
    $urlInput.on('keypress', function (e) {
        if (e.which === 13) handleSearch();
    });

    // Determine if luckyBtn exists before attaching event to avoid errors if strict
    // but jQuery handles missing elements gracefully (does nothing).
    $('#luckyBtn').on('click', function () {
        const funSites = ['google.com', 'wikipedia.org', 'bbc.com', 'cnn.com', 'github.com'];
        const randomSite = funSites[Math.floor(Math.random() * funSites.length)];
        $urlInput.val(randomSite);
        handleSearch();
    });

    async function handleSearch() {
        // Reset UI
        $resultsDiv.addClass('hidden');
        $errorDiv.addClass('hidden').text('');
        $loadingDiv.removeClass('hidden');
        ui.$nearbyList.empty(); // Clear previous suggestions

        const rawInput = $urlInput.val().trim();
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
            if (locationData.country_code) {
                await fetchAndDisplayNearby(locationData.country_code);
            }

            $loadingDiv.addClass('hidden');
            $resultsDiv.removeClass('hidden');

        } catch (err) {
            showError(err.message);
        }
    }

    function extractHostname(url) {
        let hostname;
        if (url.indexOf("//") > -1) {
            hostname = url.split('/')[2];
        } else {
            hostname = url.split('/')[0];
        }
        hostname = hostname.split(':')[0];
        hostname = hostname.split('?')[0];
        return hostname;
    }

    function resolveDns(domain) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: `https://dns.google/resolve`,
                data: { name: domain, type: 'A' },
                dataType: 'json',
                success: function (data) {
                    if (data.Status !== 0 || !data.Answer) {
                        resolve(null);
                        return;
                    }
                    const record = data.Answer.find(ans => ans.type === 1);
                    resolve(record ? record.data : null);
                },
                error: function () {
                    // Start of the error handling, previously allowed network errors to propagate or return null?
                    // Original code: await fetch -> if network error, throws.
                    // So we should probably reject or resolve null.
                    // Original code caught errors in handleSearch.
                    // Let's reject to be consistent with await fetch throwing.
                    reject(new Error("DNS resolution failed"));
                }
            });
        });
    }

    function fetchLocation(ip) {
        return $.ajax({
            url: `https://ipapi.co/${ip}/json/`,
            dataType: 'json'
        }).fail(function () {
            throw new Error("GeoIP service unavailable.");
        });
    }

    function fetchAndDisplayNearby(countryCode) {
        // Using return promise to await in handleSearch
        return $.ajax({
            url: `https://restcountries.com/v3.1/alpha/${countryCode}`,
            dataType: 'json'
        }).then(function (countryData) {
            const country = countryData[0];

            if (!country.borders || country.borders.length === 0) {
                $('<li>').text("No bordering countries found (Island nation?)").appendTo(ui.$nearbyList);
                return;
            }

            const borders = country.borders.join(',');
            return $.ajax({
                url: `https://restcountries.com/v3.1/alpha`,
                data: { codes: borders },
                dataType: 'json'
            }).then(function (neighborsData) {
                neighborsData.forEach(neighbor => {
                    $('<li>').text(neighbor.name.common).appendTo(ui.$nearbyList);
                });
            });

        }).catch(function (e) {
            console.error("Error fetching neighbors:", e);
        });
    }

    function updateResultUI(ip, data) {
        ui.$ip.text(ip);
        ui.$country.text(data.country_name || data.country);
        ui.$city.text(data.city);
        ui.$region.text(data.region);
        ui.$isp.text(data.org || data.isp);
    }

    function showError(msg) {
        $loadingDiv.addClass('hidden');
        $errorDiv.removeClass('hidden').text(msg);
    }
});
