// ==========================================
// Chris The Rocket Guy - Launch Tracker
// script.js - MATCHED TO index.html
// ==========================================

var LL2_API_BASE = "https://ll.thespacedevs.com/2.2.0";
var SNAPI_BASE = "https://api.spaceflightnewsapi.net/v4";
var FLORIDA_LOCATION_IDS = "12,27";
var LAUNCH_FETCH_LIMIT = 50;

var allLaunches = [];
var filteredLaunches = [];
var currentTab = "upcoming";
var currentStatusFilter = "all";
var searchQuery = "";
var launchExtras = {};
var countdownInterval = null;
var nextLaunch = null;
var currentPage = 1;
var perPage = 12;

// ---- INIT ----
document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM ready");
    loadLaunchExtras();
    fetchLaunches();
});

// ---- GLOBAL FUNCTIONS CALLED BY onclick IN HTML ----

function switchTab(tab, evt) {
    currentTab = tab;
    currentPage = 1;

    // Update nav button styling
    var navBtns = document.querySelectorAll("header nav button");
    for (var i = 0; i < navBtns.length; i++) {
        navBtns[i].classList.remove("active");
    }
    if (evt && evt.target) {
        evt.target.classList.add("active");
    }

    // Show/hide controls based on tab
    var searchContainer = document.getElementById("searchContainer");
    var statusFilters = document.getElementById("statusFilters");
    var pagination = document.getElementById("pagination");
    var countdownSection = document.getElementById("countdownSection");

    if (tab === "news") {
        if (searchContainer) searchContainer.style.display = "none";
        if (statusFilters) statusFilters.style.display = "none";
        if (pagination) pagination.style.display = "none";
        if (countdownSection) countdownSection.style.display = "none";
        fetchNews();
    } else {
        if (searchContainer) searchContainer.style.display = "";
        if (statusFilters) statusFilters.style.display = "";
        if (countdownSection) countdownSection.style.display = "";
        applyFilters();
    }
}

function setStatusFilter(status, evt) {
    currentStatusFilter = status;
    currentPage = 1;

    var filterBtns = document.querySelectorAll(".status-filters button");
    for (var i = 0; i < filterBtns.length; i++) {
        filterBtns[i].classList.remove("active");
    }
    if (evt && evt.target) {
        evt.target.classList.add("active");
    }

    applyFilters();
}

function handleSearch() {
    var input = document.getElementById("searchInput");
    searchQuery = input ? input.value.trim().toLowerCase() : "";
    currentPage = 1;
    applyFilters();
}

function changePage(dir) {
    var totalPages = Math.ceil(filteredLaunches.length / perPage);
    currentPage += dir;
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    renderLaunches();
    window.scrollTo(0, 0);
}

function closeModal(evt) {
    if (evt) evt.preventDefault();
    var modal = document.getElementById("modalOverlay");
    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }
}

// ---- DATA LOADING ----

function loadLaunchExtras() {
    fetch("launch-extras.json")
        .then(function (r) {
            if (r.ok) return r.json();
            return {};
        })
        .then(function (data) {
            launchExtras = data || {};
            console.log("Extras loaded");
        })
        .catch(function () {
            launchExtras = {};
        });
}

function fetchLaunches() {
    showLoading();

    var upcomingURL = LL2_API_BASE + "/launch/upcoming/?limit=" + LAUNCH_FETCH_LIMIT + "&location__ids=" + FLORIDA_LOCATION_IDS;
    var previousURL = LL2_API_BASE + "/launch/previous/?limit=" + LAUNCH_FETCH_LIMIT + "&location__ids=" + FLORIDA_LOCATION_IDS;

    console.log("Fetching:", upcomingURL);

    Promise.all([
        fetch(upcomingURL).then(function (r) { return r.json(); }),
        fetch(previousURL).then(function (r) { return r.json(); })
    ])
        .then(function (results) {
            var upcomingData = results[0];
            var previousData = results[1];

            console.log("Upcoming:", upcomingData.results ? upcomingData.results.length : 0);
            console.log("Previous:", previousData.results ? previousData.results.length : 0);

            var upcoming = [];
            if (upcomingData.results) {
                for (var i = 0; i < upcomingData.results.length; i++) {
                    upcomingData.results[i]._tab = "upcoming";
                    upcoming.push(upcomingData.results[i]);
                }
            }

            var previous = [];
            if (previousData.results) {
                for (var j = 0; j < previousData.results.length; j++) {
                    previousData.results[j]._tab = "previous";
                    previous.push(previousData.results[j]);
                }
            }

            allLaunches = upcoming.concat(previous);
            console.log("Total launches:", allLaunches.length);

            // Set next launch for countdown
            if (upcoming.length > 0) {
                upcoming.sort(function (a, b) { return new Date(a.net) - new Date(b.net); });
                nextLaunch = upcoming[0];
                startCountdown();
            }

            applyFilters();
        })
        .catch(function (err) {
            console.error("Fetch error:", err);
            showError("Unable to load launches. " + err.message);
        });
}

// ---- FILTERING ----

function applyFilters() {
    filteredLaunches = [];

    for (var i = 0; i < allLaunches.length; i++) {
        var l = allLaunches[i];

        // Tab filter
        if (l._tab !== currentTab) continue;

        // Status filter
        if (currentStatusFilter !== "all") {
            var sAbbrev = (l.status && l.status.abbrev) ? l.status.abbrev.toLowerCase() : "";
            var sName = (l.status && l.status.name) ? l.status.name.toLowerCase() : "";
            var filterVal = currentStatusFilter.toLowerCase();

            if (filterVal === "go") {
                if (sAbbrev !== "go") continue;
            } else if (filterVal === "tbd") {
                if (sAbbrev !== "tbd") continue;
            } else if (filterVal === "tbc") {
                if (sAbbrev !== "tbc") continue;
            } else if (filterVal === "success") {
                if (sAbbrev !== "success" && sName.indexOf("success") === -1) continue;
            } else if (filterVal === "failure") {
                if (sAbbrev !== "failure" && sName.indexOf("failure") === -1) continue;
            }
        }

        // Search filter
        if (searchQuery) {
            var name = (l.name || "").toLowerCase();
            var provider = (l.launch_service_provider && l.launch_service_provider.name) ? l.launch_service_provider.name.toLowerCase() : "";
            var pad = (l.pad && l.pad.name) ? l.pad.name.toLowerCase() : "";
            if (name.indexOf(searchQuery) === -1 && provider.indexOf(searchQuery) === -1 && pad.indexOf(searchQuery) === -1) continue;
        }

        filteredLaunches.push(l);
    }

    // Sort
    if (currentTab === "upcoming") {
        filteredLaunches.sort(function (a, b) { return new Date(a.net) - new Date(b.net); });
    } else {
        filteredLaunches.sort(function (a, b) { return new Date(b.net) - new Date(a.net); });
    }

    console.log("Filtered:", filteredLaunches.length, "tab:", currentTab, "status:", currentStatusFilter);
    renderLaunches();
}

// ---- RENDERING ----

function renderLaunches() {
    var container = document.getElementById("mainContent");
    if (!container) {
        console.error("mainContent not found");
        return;
    }

    if (filteredLaunches.length === 0) {
        container.innerHTML = '<div class="no-results"><h3>No launches found</h3><p>Try adjusting your filters or search.</p></div>';
        updatePagination();
        return;
    }

    var totalPages = Math.ceil(filteredLaunches.length / perPage);
    if (currentPage > totalPages) currentPage = totalPages;

    var startIdx = (currentPage - 1) * perPage;
    var endIdx = startIdx + perPage;
    var pageLaunches = filteredLaunches.slice(startIdx, endIdx);

    var html = '<div class="launch-grid">';

    for (var i = 0; i < pageLaunches.length; i++) {
        try {
            html += buildCard(pageLaunches[i]);
        } catch (e) {
            console.error("Card build error:", e);
        }
    }

    html += '</div>';
    container.innerHTML = html;

    // Attach click handlers
    var cards = container.querySelectorAll(".launch-card");
    for (var j = 0; j < cards.length; j++) {
        (function (card) {
            card.addEventListener("click", function () {
                var id = card.getAttribute("data-id");
                openModal(id);
            });
        })(cards[j]);
    }

    console.log("Rendered", cards.length, "cards, page", currentPage, "of", totalPages);
    updatePagination();
}

function updatePagination() {
    var pagination = document.getElementById("pagination");
    var prevBtn = document.getElementById("prevBtn");
    var nextBtn = document.getElementById("nextBtn");
    var pageInfo = document.getElementById("pageInfo");

    if (!pagination) return;

    var totalPages = Math.ceil(filteredLaunches.length / perPage);

    if (totalPages <= 1) {
        pagination.style.display = "none";
        return;
    }

    pagination.style.display = "";
    if (pageInfo) pageInfo.textContent = "Page " + currentPage + " of " + totalPages;
    if (prevBtn) prevBtn.disabled = (currentPage <= 1);
    if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);
}

function buildCard(launch) {
    var name = launch.name || "Unknown";
    var parts = name.split("|");
    var mission = parts[0].trim();
    var payload = parts.length > 1 ? parts[1].trim() : "";
    var provider = (launch.launch_service_provider && launch.launch_service_provider.name) || "Unknown";
    var padName = (launch.pad && launch.pad.name) || "Unknown Pad";
    var statusName = (launch.status && launch.status.name) || "Unknown";
    var statusAbbrev = (launch.status && launch.status.abbrev) || "UNK";
    var img = launch.image || "";
    var netDate = launch.net ? new Date(launch.net) : null;
    var dateStr = netDate ? formatDate(netDate) : "TBD";
    var flags = getAutoFlags(launch);
    var trajectory = getTrajectory(launch);

    var h = '<div class="launch-card" data-id="' + escapeAttr(String(launch.id)) + '">';

    if (img) {
        h += '<div class="card-image" style="background-image:url(\'' + escapeAttr(img) + '\')"></div>';
    } else {
        h += '<div class="card-image card-image-placeholder">🚀</div>';
    }

    h += '<div class="card-body">';

    // Status + flags row
    h += '<div class="card-status-row">';
    h += '<span class="status-badge status-' + escapeAttr(statusAbbrev.toLowerCase()) + '">' + escapeHTML(statusName) + '</span>';
    for (var f = 0; f < flags.length; f++) {
        h += ' <span class="flag-badge">' + escapeHTML(flags[f]) + '</span>';
    }
    h += '</div>';

    h += '<h3 class="card-title">' + escapeHTML(mission) + '</h3>';
    if (payload) {
        h += '<p class="card-payload">' + escapeHTML(payload) + '</p>';
    }

    h += '<div class="card-meta">';
    h += '<span>🏢 ' + escapeHTML(provider) + '</span>';
    h += '<span>📍 ' + escapeHTML(padName) + '</span>';
    h += '<span>📅 ' + escapeHTML(dateStr) + '</span>';
    h += '</div>';

    if (trajectory) {
        h += '<div class="card-trajectory">🧭 ' + escapeHTML(trajectory) + '</div>';
    }

    if (netDate && currentTab === "upcoming") {
        var cd = getCountdownText(netDate);
        if (cd) {
            h += '<div class="card-countdown">⏱️ ' + escapeHTML(cd) + '</div>';
        }
    }

    h += '</div></div>';
    return h;
}

// ---- COUNTDOWN ----

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);

    updateCountdownDisplay();
    countdownInterval = setInterval(updateCountdownDisplay, 1000);
}

function updateCountdownDisplay() {
    if (!nextLaunch || !nextLaunch.net) return;

    var nameEl = document.getElementById("countdownName");
    var daysEl = document.getElementById("cd-days");
    var hoursEl = document.getElementById("cd-hours");
    var minsEl = document.getElementById("cd-mins");
    var secsEl = document.getElementById("cd-secs");

    if (nameEl) {
        var lName = (nextLaunch.name || "").split("|")[0].trim();
        nameEl.textContent = "Next Launch: " + lName;
    }

    var diff = new Date(nextLaunch.net) - new Date();

    if (diff <= 0) {
        if (daysEl) daysEl.textContent = "00";
        if (hoursEl) hoursEl.textContent = "00";
        if (minsEl) minsEl.textContent = "00";
        if (secsEl) secsEl.textContent = "00";
        return;
    }

    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    var secs = Math.floor((diff % 60000) / 1000);

    if (daysEl) daysEl.textContent = padZero(days);
    if (hoursEl) hoursEl.textContent = padZero(hours);
    if (minsEl) minsEl.textContent = padZero(mins);
    if (secsEl) secsEl.textContent = padZero(secs);
}

function padZero(n) {
    return n < 10 ? "0" + n : String(n);
}

// ---- MODAL ----

function openModal(launchId) {
    console.log("Opening modal:", launchId);

    var modal = document.getElementById("modalOverlay");
    var modalImg = document.getElementById("modalImage");
    var modalTitle = document.getElementById("modalTitle");
    var modalBody = document.getElementById("modalBody");

    if (!modal || !modalBody) {
        console.error("Modal elements not found");
        return;
    }

    var launch = null;
    for (var i = 0; i < allLaunches.length; i++) {
        if (String(allLaunches[i].id) === String(launchId)) {
            launch = allLaunches[i];
            break;
        }
    }

    if (!launch) {
        console.error("Launch not found:", launchId);
        return;
    }

    var name = launch.name || "Unknown";
    var parts = name.split("|");
    var mission = parts[0].trim();
    var payload = parts.length > 1 ? parts[1].trim() : "";
    var provider = (launch.launch_service_provider && launch.launch_service_provider.name) || "Unknown";
    var rocket = (launch.rocket && launch.rocket.configuration && launch.rocket.configuration.full_name) || "Unknown";
    var padName = (launch.pad && launch.pad.name) || "Unknown";
    var statusName = (launch.status && launch.status.name) || "Unknown";
    var statusAbbrev = (launch.status && launch.status.abbrev) || "UNK";
    var img = launch.image || "";
    var netDate = launch.net ? new Date(launch.net) : null;
    var dateStr = netDate ? formatDate(netDate) : "TBD";
    var desc = (launch.mission && launch.mission.description) || "";
    var trajectory = getTrajectory(launch);
    var flags = getAutoFlags(launch);

    // Set modal image
    if (modalImg) {
        if (img) {
            modalImg.src = img;
            modalImg.style.display = "";
        } else {
            modalImg.style.display = "none";
        }
    }

    // Set title
    if (modalTitle) {
        modalTitle.textContent = mission;
    }

    // Build body
    var h = '';

    // Status row
    h += '<div class="modal-status-row">';
    h += '<span class="status-badge status-' + escapeAttr(statusAbbrev.toLowerCase()) + '">' + escapeHTML(statusName) + '</span>';
    for (var f = 0; f < flags.length; f++) {
        h += ' <span class="flag-badge">' + escapeHTML(flags[f]) + '</span>';
    }
    h += '</div>';

    if (payload) {
        h += '<p class="modal-payload">' + escapeHTML(payload) + '</p>';
    }

    // Details
    h += '<div class="modal-details">';
    h += '<div class="detail-row"><span class="detail-label">🏢 Provider</span><span>' + escapeHTML(provider) + '</span></div>';
    h += '<div class="detail-row"><span class="detail-label">🚀 Vehicle</span><span>' + escapeHTML(rocket) + '</span></div>';
    h += '<div class="detail-row"><span class="detail-label">📍 Pad</span><span>' + escapeHTML(padName) + '</span></div>';
    h += '<div class="detail-row"><span class="detail-label">📅 Date</span><span>' + escapeHTML(dateStr) + '</span></div>';
    h += '</div>';

    if (desc) {
        h += '<div class="modal-section"><h3>📋 Mission Overview</h3><p>' + escapeHTML(desc) + '</p></div>';
    }

    if (trajectory) {
        h += '<div class="modal-section"><h3>🧭 Trajectory</h3><p>' + escapeHTML(trajectory) + '</p></div>';
    }

    // Countdown
    if (netDate && launch._tab === "upcoming") {
        var cd = getCountdownText(netDate);
        if (cd) {
            h += '<div class="modal-section"><h3>⏱️ Countdown</h3><p class="countdown-display">' + escapeHTML(cd) + '</p></div>';
        }
    }

    // Viewing tips
    var tips = getViewingTips(launch);
    if (tips.length > 0) {
        h += '<div class="modal-section"><h3>👀 Viewing Tips</h3><ul class="tips-list">';
        for (var t = 0; t < tips.length; t++) {
            h += '<li>' + escapeHTML(tips[t]) + '</li>';
        }
        h += '</ul></div>';
    }

    // Viewing spots
    var spots = getViewingSpots();
    h += '<div class="modal-section"><h3>📍 Best Viewing Spots</h3><ul class="spots-list">';
    for (var s = 0; s < spots.length; s++) {
        h += '<li>' + spots[s].icon + ' <strong>' + escapeHTML(spots[s].name) + '</strong> (' + spots[s].dist + ') – ' + escapeHTML(spots[s].note) + '</li>';
    }
    h += '</ul></div>';

    // Video links
    var vidURLs = getVideoURLs(launch);
    if (vidURLs.length > 0) {
        h += '<div class="modal-section"><h3>📡 Live Feeds</h3><ul class="live-feeds-list">';
        for (var u = 0; u < vidURLs.length; u++) {
            var url = vidURLs[u];
            var label = "Live Stream";
            var icon = "📺";
            if (url.indexOf("youtube") !== -1 || url.indexOf("youtu.be") !== -1) { label = "YouTube"; icon = "▶️"; }
            else if (url.indexOf("nasa") !== -1) { label = "NASA TV"; icon = "🛰️"; }
            else if (url.indexOf("spacex") !== -1) { label = "SpaceX"; icon = "🚀"; }
            h += '<li>' + icon + ' <a href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' + escapeHTML(label) + '</a></li>';
        }
        h += '</ul></div>';
    }

    h += '<div id="modalNewsSection"></div>';

    modalBody.innerHTML = h;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    // Fetch related news
    fetchLaunchNews(launch);
}

function getVideoURLs(launch) {
    var urls = [];
    var sources = [launch.vid_urls, launch.vidURLs];
    for (var s = 0; s < sources.length; s++) {
        if (sources[s]) {
            for (var v = 0; v < sources[s].length; v++) {
                var item = sources[s][v];
                if (typeof item === "string") {
                    urls.push(item);
                } else if (item && item.url) {
                    urls.push(item.url);
                }
            }
        }
    }
    return urls;
}

// ---- NEWS TAB ----

function fetchNews() {
    var container = document.getElementById("mainContent");
    if (!container) return;

    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading space news...</p></div>';

    fetch(SNAPI_BASE + "/articles/?limit=20")
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (!data.results || data.results.length === 0) {
                container.innerHTML = '<div class="no-results"><h3>No news found</h3></div>';
                return;
            }

            var h = '<div class="news-grid">';
            for (var i = 0; i < data.results.length; i++) {
                var article = data.results[i];
                h += '<a href="' + escapeAttr(article.url) + '" target="_blank" rel="noopener" class="news-card">';
                if (article.image_url) {
                    h += '<div class="card-image" style="background-image:url(\'' + escapeAttr(article.image_url) + '\')"></div>';
                }
                h += '<div class="card-body">';
                h += '<h3>' + escapeHTML(article.title) + '</h3>';
                h += '<p>' + escapeHTML((article.summary || "").substring(0, 150)) + '</p>';
                h += '<span class="news-source">' + escapeHTML(article.news_site || "") + '</span>';
                h += '</div></a>';
            }
            h += '</div>';
            container.innerHTML = h;
        })
        .catch(function (e) {
            console.error("News error:", e);
            container.innerHTML = '<div class="error-message"><p>Unable to load news.</p></div>';
        });
}

function fetchLaunchNews(launch) {
    var q = (launch.name || "").split("|")[0].trim();
    fetch(SNAPI_BASE + "/articles/?limit=5&search=" + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var section = document.getElementById("modalNewsSection");
            if (section && data.results && data.results.length > 0) {
                var nh = '<div class="modal-section"><h3>📰 Related News</h3><ul class="news-list">';
                for (var n = 0; n < data.results.length; n++) {
                    nh += '<li><a href="' + escapeAttr(data.results[n].url) + '" target="_blank" rel="noopener">' + escapeHTML(data.results[n].title) + '</a></li>';
                }
                nh += '</ul></div>';
                section.innerHTML = nh;
            }
        })
        .catch(function () {});
}

// ---- AUTO FLAGS ----

function getAutoFlags(launch) {
    var flags = [];
    var name = (launch.name || "").toLowerCase();
    var prov = (launch.launch_service_provider && launch.launch_service_provider.name) ? launch.launch_service_provider.name.toLowerCase() : "";

    if (name.indexOf("crew") !== -1) flags.push("👨‍🚀 Crew");
    if (name.indexOf("falcon heavy") !== -1) flags.push("🔥 Falcon Heavy");
    if (name.indexOf("starship") !== -1) flags.push("⭐ Starship");
    if (name.indexOf("starlink") !== -1) flags.push("🛰️ Starlink");

    var extras = launchExtras[launch.id];
    if (extras && extras.flags) {
        for (var i = 0; i < extras.flags.length; i++) {
            flags.push(extras.flags[i]);
        }
    }

    return flags;
}

// ---- TRAJECTORY ----

function getTrajectory(launch) {
    var name = (launch.name || "").toLowerCase();
    var orbit = "";
    if (launch.mission && launch.mission.orbit && launch.mission.orbit.abbrev) {
        orbit = launch.mission.orbit.abbrev.toUpperCase();
    }

    var extras = launchExtras[launch.id];
    if (extras && extras.trajectory) return extras.trajectory;

    if (orbit === "GTO" || orbit === "GEO") return "East over the Atlantic \u2013 geostationary transfer arc";
    if (orbit === "SSO") return "South-Southeast along the coast \u2013 sun-synchronous";
    if (orbit === "ISS" || name.indexOf("iss") !== -1 || name.indexOf("station") !== -1) return "Northeast \u2013 ISS rendezvous trajectory";
    if (name.indexOf("starlink") !== -1) return "East-Northeast \u2013 Starlink deployment";
    if (orbit === "LEO") return "East over the Atlantic \u2013 low Earth orbit";
    if (name.indexOf("lunar") !== -1 || name.indexOf("moon") !== -1 || name.indexOf("artemis") !== -1) return "East \u2013 translunar injection";

    return "";
}

// ---- VIEWING TIPS ----

function getViewingTips(launch) {
    var tips = [];
    var netDate = launch.net ? new Date(launch.net) : null;
    if (netDate) {
        tips.push("Sunset at Cape Canaveral: ~" + getSunsetTime(netDate) + " ET");
    }
    var name = (launch.name || "").toLowerCase();
    if (name.indexOf("falcon heavy") !== -1) tips.push("Triple booster separation and dual landing burns!");
    if (name.indexOf("starlink") !== -1) tips.push("Watch for satellite train 15-30 min after launch");
    if (name.indexOf("crew") !== -1) tips.push("Crew mission \u2013 expect larger crowds, arrive early");
    if (name.indexOf("starship") !== -1) tips.push("Most powerful rocket ever \u2013 intense sound and vibration!");
    return tips;
}

function getSunsetTime(date) {
    var lat = 28.3922;
    var lng = -80.6077;
    var start = new Date(date.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((date - start) / 86400000);
    var declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
    var latRad = lat * Math.PI / 180;
    var decRad = declination * Math.PI / 180;
    var hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(decRad)) * 180 / Math.PI;
    var b = (360 / 365) * (dayOfYear - 81) * Math.PI / 180;
    var eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    var solarNoon = 12 - (lng / 15) - (eot / 60);
    var sunsetUTC = solarNoon + (hourAngle / 15);
    var year = date.getFullYear();
    var mar = new Date(year, 2, 8 + (7 - new Date(year, 2, 8).getDay()) % 7);
    var nov = new Date(year, 10, 1 + (7 - new Date(year, 10, 1).getDay()) % 7);
    var dst = (date >= mar && date < nov) ? 1 : 0;
    var sunsetLocal = sunsetUTC - 5 + dst;
    var hrs = Math.floor(sunsetLocal);
    var mins = Math.round((sunsetLocal - hrs) * 60);
    return hrs + ":" + (mins < 10 ? "0" : "") + mins;
}

function getViewingSpots() {
    return [
        { name: "Jetty Park Beach", icon: "🏖️", dist: "~6 mi", note: "Great for families, parking available" },
        { name: "Playalinda Beach", icon: "🏝️", dist: "~3 mi", note: "Closest public beach \u2013 arrive very early" },
        { name: "Space View Park", icon: "🌳", dist: "~12 mi", note: "Free, iconic spot in Titusville" },
        { name: "Max Brewer Bridge", icon: "🌉", dist: "~12 mi", note: "Elevated view, can get crowded" },
        { name: "KSC Visitor Complex", icon: "🚀", dist: "Varies", note: "Official viewing \u2013 tickets required" }
    ];
}

// ---- HELPERS ----

function getCountdownText(target) {
    var diff = target - new Date();
    if (diff <= 0) return "";
    var days = Math.floor(diff / 86400000);
    var hrs = Math.floor((diff % 86400000) / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return "T-" + days + "d " + hrs + "h " + mins + "m";
    if (hrs > 0) return "T-" + hrs + "h " + mins + "m";
    return "T-" + mins + "m";
}

function formatDate(d) {
    try {
        return d.toLocaleDateString("en-US", {
            weekday: "short", year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit", timeZoneName: "short"
        });
    } catch (e) {
        return d.toString();
    }
}

function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showLoading() {
    var el = document.getElementById("mainContent");
    if (el) {
        el.innerHTML = '<div class="loading"><div class="spinner"></div><p>Fetching launch data from the cosmos...</p></div>';
    }
}

function showError(msg) {
    var el = document.getElementById("mainContent");
    if (el) {
        el.innerHTML = '<div class="error-message"><p>' + escapeHTML(msg) + '</p></div>';
    }
}

// ---- KEYBOARD ----

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        closeModal(e);
    }
});
