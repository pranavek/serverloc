$(document).ready(function () {
    const $searchBtn = $('#searchBtn');
    const $luckyBtn = $('#luckyBtn');
    const $urlInput = $('#urlInput');
    const $resultsDiv = $('#results');
    const $loadingDiv = $('#loading');
    const $errorDiv = $('#error');

    // Video Results UI
    const $videoResultsDiv = $('#videoResults');
    const videoUi = {
        $url: $('#videoUrl'),
        $ip: $('#videoIp'),
        $country: $('#videoCountry'),
        $city: $('#videoCity'),
        $region: $('#videoRegion'),
        $isp: $('#videoIsp')
    };

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

    async function handleSearch() {
        // Reset UI
        $resultsDiv.addClass('hidden');
        $videoResultsDiv.addClass('hidden');
        $errorDiv.addClass('hidden').text('');
        $loadingDiv.removeClass('hidden');
        ui.$nearbyList.empty();

        const rawInput = $urlInput.val().trim();
        if (!rawInput) {
            showError("Please enter a URL.");
            return;
        }

        try {
            // Ensure input has protocol for fetching
            let urlToFetch = rawInput;
            if (!urlToFetch.match(/^http/)) {
                urlToFetch = 'http://' + urlToFetch;
            }

            const domain = extractHostname(rawInput);

            // Parallel start: 
            // 1. Main Domain Location (original logic)
            // 2. Video Detection (new logic)

            // We can wait for both, or just await main sequentially then video.
            // Let's do main first to show results fast, then video.

            // --- 1. Main Domain Logic ---
            const ip = await resolveDns(domain);
            if (!ip) throw new Error("Could not resolve IP address for this domain.");

            const locationData = await fetchLocation(ip);
            if (locationData.error) throw new Error("Location lookup failed: " + locationData.reason);

            updateResultUI(ip, locationData);

            if (locationData.country_code) {
                await fetchAndDisplayNearby(locationData.country_code);
            }

            $resultsDiv.removeClass('hidden'); // Show main results immediately

            // --- 2. Video Detection Logic ---
            try {
                // Fetch page content via proxy to find video sources
                const videoHostname = await findVideoHostname(urlToFetch);
                if (videoHostname) {
                    const videoIp = await resolveDns(videoHostname);
                    if (videoIp) {
                        const videoLocData = await fetchLocation(videoIp);
                        updateVideoResultUI(videoHostname, videoIp, videoLocData);
                        $videoResultsDiv.removeClass('hidden');
                    }
                }
            } catch (videoErr) {
                console.warn("Video detection failed:", videoErr);
                // Fail silently for video part, don't break main flow
            }

            $loadingDiv.addClass('hidden');

        } catch (err) {
            showError(err.message);
        }
    }

    async function findVideoHostname(url) {
        // Use AllOrigins proxy to bypass CORS
        const response = await $.getJSON(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        if (!response.contents) return null;

        const html = response.contents;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Strategy 1: Look for <video> src
        let src = "";
        const video = doc.querySelector('video');
        if (video) {
            if (video.src) src = video.src;
            else {
                const source = video.querySelector('source');
                if (source && source.src) src = source.src;
            }
        }

        // Strategy 2: Look for <iframe> src if it looks like a video provider (youtube, vimeo)
        // or just the first iframe? "From that video is getting streamed" implies we find THE video.
        if (!src) {
            const iframes = doc.querySelectorAll('iframe');
            for (let i = 0; i < iframes.length; i++) {
                const fSrc = iframes[i].src;
                if (fSrc && (fSrc.includes('youtube') || fSrc.includes('vimeo') || fSrc.includes('player') || fSrc.includes('stream'))) {
                    src = fSrc;
                    break;
                }
            }
        }

        if (src) {
            return extractHostname(src);
        }
        return null;
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
                    resolve(null); // Resolve null instead of reject for smoother flow
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
        return $.ajax({
            url: `https://restcountries.com/v3.1/alpha/${countryCode}`,
            dataType: 'json'
        }).then(function (countryData) {
            const country = countryData[0];

            if (!country.borders || country.borders.length === 0) {
                // Only modify if we are still active? 
                // jQuery appends are safe.
                if (ui.$nearbyList.is(':empty')) {
                    $('<li>').text("No bordering countries found (Island nation?)").appendTo(ui.$nearbyList);
                }
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

    function updateVideoResultUI(hostname, ip, data) {
        videoUi.$url.text(hostname);
        videoUi.$ip.text(ip);
        videoUi.$country.text(data.country_name || data.country);
        videoUi.$city.text(data.city);
        videoUi.$region.text(data.region);
        videoUi.$isp.text(data.org || data.isp);
    }

    function showError(msg) {
        $loadingDiv.addClass('hidden');
        $errorDiv.removeClass('hidden').text(msg);
    }
});
