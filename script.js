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
        $nearbyContainer: $('#nearbyContainer')
    };

    $searchBtn.on('click', handleSearch);
    $urlInput.on('keypress', function (e) {
        if (e.which === 13) handleSearch();
    });

    $('#luckyBtn').on('click', function () {
        const funSites = ['google.com', 'wikipedia.org', 'bbc.com', 'cnn.com', 'github.com'];
        const randomSite = funSites[Math.floor(Math.random() * funSites.length)];
        $urlInput.val(randomSite);
        handleSearch();
    });

    async function handleSearch() {
        // Reset UI
        $resultsDiv.addClass('hidden');
        $videoResultsDiv.addClass('hidden');
        $errorDiv.addClass('hidden').text('');
        $loadingDiv.removeClass('hidden');
        ui.$nearbyContainer.empty();

        const rawInput = $urlInput.val().trim();
        if (!rawInput) {
            showError("Please enter a URL.");
            return;
        }

        try {
            let urlToFetch = rawInput;
            if (!urlToFetch.match(/^http/)) {
                urlToFetch = 'http://' + urlToFetch;
            }

            const domain = extractHostname(rawInput);

            // --- 1. Main Domain Logic ---
            const ip = await resolveDns(domain);
            if (!ip) throw new Error("Could not resolve IP address for this domain.");

            const locationData = await fetchLocation(ip);
            if (locationData.error) throw new Error("Location lookup failed: " + locationData.reason);

            updateResultUI(ip, locationData);

            if (locationData.country_code) {
                await fetchAndDisplayNearby(locationData.country_code, "Main Website");
            }

            $resultsDiv.removeClass('hidden');

            // --- 2. Video Detection Logic ---
            try {
                const videoHostname = await findVideoHostname(urlToFetch);
                if (videoHostname) {
                    const videoIp = await resolveDns(videoHostname);
                    if (videoIp) {
                        const videoLocData = await fetchLocation(videoIp);
                        updateVideoResultUI(videoHostname, videoIp, videoLocData);
                        $videoResultsDiv.removeClass('hidden');

                        if (videoLocData.country_code) {
                            await fetchAndDisplayNearby(videoLocData.country_code, "Video Server");
                        }
                    }
                }
            } catch (videoErr) {
                console.warn("Video detection failed:", videoErr);
            }

            $loadingDiv.addClass('hidden');

        } catch (err) {
            showError(err.message);
        }
    }

    async function findVideoHostname(url) {
        try {
            const html = await $.ajax({
                url: `https://corsproxy.io/?` + encodeURIComponent(url),
                dataType: 'text'
            });

            if (!html) return null;

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            let src = "";
            const video = doc.querySelector('video');
            if (video) {
                if (video.src) src = video.src;
                else {
                    const source = video.querySelector('source');
                    if (source && source.src) src = source.src;
                }
            }

            if (!src) {
                const iframes = doc.querySelectorAll('iframe');
                for (let i = 0; i < iframes.length; i++) {
                    const iframe = iframes[i];
                    const fSrc = iframe.src;

                    if (fSrc && iframe.hasAttribute('allowfullscreen')) {
                        src = fSrc;
                        break;
                    }

                    if (fSrc && (fSrc.includes('youtube') || fSrc.includes('vimeo') || fSrc.includes('player') || fSrc.includes('stream') || fSrc.includes('embed') || fSrc.includes('watch'))) {
                        src = fSrc;
                        break;
                    }
                }
            }

            if (src) {
                return extractHostname(src);
            }
            return null;
        } catch (e) {
            console.warn("Proxy fetch failed", e);
            return null;
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
                    resolve(null);
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

    function fetchAndDisplayNearby(countryCode, title) {
        return $.ajax({
            url: `https://restcountries.com/v3.1/alpha/${countryCode}`,
            dataType: 'json'
        }).then(function (countryData) {
            const country = countryData[0];

            // Create Section for this source
            const $group = $('<div class="nearby-group">');
            $('<h4>').text(title + ` (${country.name.common})`).appendTo($group); // Added country name to title for clarity
            const $ul = $('<ul class="nearby-list">').appendTo($group);

            if (!country.borders || country.borders.length === 0) {
                $('<li>').text("No neighboring countries found.").appendTo($ul);
            } else {
                const borders = country.borders.join(',');
                $.ajax({
                    url: `https://restcountries.com/v3.1/alpha`,
                    data: { codes: borders },
                    dataType: 'json'
                }).then(function (neighborsData) {
                    neighborsData.forEach(neighbor => {
                        $('<li>').text(neighbor.name.common).appendTo($ul);
                    });
                });
            }

            $group.appendTo(ui.$nearbyContainer);

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
