let activeDay = 1;
let tripData = JSON.parse(localStorage.getItem('travelPlannerData')) || {};
let hotelBookings = JSON.parse(localStorage.getItem('hotelBookings')) || [];
let map;
let itemMarkers = [];
let searchMarker = null;
let selectedTransportType = 'Train';
let searchTimeout = null;

const DAYS_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

// COULEURS SVG PAR CATÉGORIE POUR LES MARQUEURS DE CARTE
const CATEGORY_COLORS = {
    hotel: '#f59e0b', // Orange / Ambre
    vol: '#6366f1',   // Indigo / Bleu
    activ: '#ec4899', // Rose
    resto: '#10b981'  // Vert
};

function createColoredMarkerIcon(colorHex) {
    const svgMarker = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
            <path fill="${colorHex}" stroke="#FFFFFF" stroke-width="1.5" d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z"/>
            <circle cx="12" cy="12" r="4.5" fill="#FFFFFF"/>
        </svg>
    `;
    return L.divIcon({
        className: 'custom-svg-icon',
        html: svgMarker,
        iconSize: [24, 36],
        iconAnchor: [12, 36],
        popupAnchor: [0, -32]
    });
}

// 1. INITIALISATION CARTE
function initMap(center = [46.3068, 4.8314], zoom = 7) {
    if(map) map.remove();
    map = L.map('map').setView(center, zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { 
        attribution: '&copy; OpenStreetMap' 
    }).addTo(map);

    map.on('click', async function(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        let placeName = `Lieu (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
        
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
                headers: { 'User-Agent': 'TravelPlannerApp/1.0' }
            });
            const data = await res.json();
            if (data && data.display_name) {
                placeName = data.display_name.split(',')[0];
            }
        } catch(err) { console.error(err); }

        openQuickAddModal('activ', placeName, lat, lon);
    });
}

window.onload = () => {
    ['dateStart', 'dateEnd', 'cityStart', 'cityEnd', 'currency', 'pax'].forEach(f => { 
        let val = localStorage.getItem(f);
        if(val) document.getElementById(f).value = val; 
    });
    initMap(); 
    generateTimeline(); 
};

function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }

function clearSearchInput(inputId, resultsPanelId = null) {
    document.getElementById(inputId).value = '';
    if (resultsPanelId) {
        document.getElementById(resultsPanelId).style.display = 'none';
    }
}

// 2. RECHERCHE
function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        triggerManualSearch();
    }
}

function triggerManualSearch() {
    const query = document.getElementById('wanderQuery').value.trim();
    if (query) searchPlacesInApp(query);
}

function handleLiveSearch(query) {
    clearTimeout(searchTimeout);
    const panel = document.getElementById('search-results-panel');
    
    if (!query.trim()) {
        panel.style.display = 'none';
        return;
    }

    searchTimeout = setTimeout(() => {
        searchPlacesInApp(query.trim());
    }, 400);
}

async function searchPlacesInApp(query) {
    const panel = document.getElementById('search-results-panel');
    const list = document.getElementById('results-list');
    panel.style.display = 'block';
    list.innerHTML = `<div style="font-size:0.8rem; padding:5px;">🔍 Recherche...</div>`;

    try {
        const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
        const res = await fetch(searchUrl, { headers: { 'User-Agent': 'TravelPlannerApp/1.0' } });
        const data = await res.json();

        list.innerHTML = "";
        if (!data || data.length === 0) {
            list.innerHTML = `<div style="font-size:0.8rem; padding:5px;">Aucun résultat.<br><button class="btn-main btn-primary" style="margin-top:5px; font-size:0.75rem;" onclick="openQuickAddModal('activ', '${query.replace(/'/g, "\\'")}')">Ajouter manuellement</button></div>`;
            return;
        }

        const topResult = data[0];
        const lat = parseFloat(topResult.lat);
        const lon = parseFloat(topResult.lon);
        
        map.setView([lat, lon], 12);
        if (searchMarker) map.removeLayer(searchMarker);
        searchMarker = L.marker([lat, lon]).addTo(map).bindPopup(`<b>${topResult.display_name.split(',')[0]}</b>`).openPopup();

        data.forEach(place => {
            let title = place.display_name.split(',')[0];
            let sub = place.display_name.split(',').slice(1, 3).join(',');
            let div = document.createElement('div');
            div.className = "place-card-result";
            div.innerHTML = `
                <div>
                    <strong>${title}</strong>
                    <div style="font-size:0.7rem; color:var(--text-muted);">${sub}</div>
                </div>
                <button class="btn-main btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="addBlockFromSearch('${title.replace(/'/g, "\\'")}', ${place.lat}, ${place.lon})">Ajouter</button>
            `;
            list.appendChild(div);
        });

    } catch(e) {
        console.error(e);
        list.innerHTML = `<div style="font-size:0.8rem; color:red; padding:5px;">Erreur de recherche.</div>`;
    }
}

function addBlockFromSearch(name, lat, lon) {
    openQuickAddModal('activ', name, lat, lon);
    closeResults();
}

function closeResults() { document.getElementById('search-results-panel').style.display = 'none'; }

function handleModalLiveSearch(query, resultsContainerId, selectCallback) {
    clearTimeout(searchTimeout);
    const container = document.getElementById(resultsContainerId);

    if (!query.trim()) {
        container.style.display = 'none';
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4`, {
                headers: { 'User-Agent': 'TravelPlannerApp/1.0' }
            });
            const data = await res.json();

            container.innerHTML = "";
            if (data && data.length > 0) {
                container.style.display = 'block';
                data.forEach(place => {
                    let title = place.display_name.split(',')[0];
                    let div = document.createElement('div');
                    div.className = 'modal-live-item';
                    div.innerText = place.display_name;
                    div.onclick = () => selectCallback(title, place.lat, place.lon, resultsContainerId);
                    container.appendChild(div);
                });
            } else {
                container.style.display = 'none';
            }
        } catch(e) { console.error(e); }
    }, 300);
}

function selectHotelAddress(name, lat, lon, containerId) {
    document.getElementById('hotelName').value = name;
    document.getElementById('hotelLat').value = lat;
    document.getElementById('hotelLon').value = lon;
    document.getElementById(containerId).style.display = 'none';
}

function selectQuickAddAddress(name, lat, lon, containerId) {
    document.getElementById('quickAddName').value = name;
    document.getElementById('quickAddLat').value = lat;
    document.getElementById('quickAddLon').value = lon;
    document.getElementById(containerId).style.display = 'none';
}

function handleCategoryChange(selectedCategory) {
    const currentName = document.getElementById('quickAddName').value;
    const currentLat = document.getElementById('quickAddLat').value;
    const currentLon = document.getElementById('quickAddLon').value;

    if (selectedCategory === 'hotel') {
        closeModal('quickAddModal');
        openHotelModal(currentName, currentLat, currentLon);
    } else if (selectedCategory === 'vol') {
        closeModal('quickAddModal');
        openTransportModal('Transport', '🚆', currentName);
    }
}

// 3. TIMELINE
function generateTimeline() {
    const startI = document.getElementById('dateStart').value;
    const endI = document.getElementById('dateEnd').value;
    const area = document.getElementById('timelineArea');
    if(!startI || !endI) return;
    area.innerHTML = "";
    
    let curr = new Date(startI);
    let endDate = new Date(endI);
    let d = 1;

    while(curr <= endDate) {
        if(!tripData[d]) tripData[d] = [];
        let item = document.createElement('div');
        item.className = `day-item ${d === activeDay ? 'active' : ''}`;
        let currentDayNum = d;
        item.onclick = () => { activeDay = currentDayNum; updateDayTitle(); generateTimeline(); };
        
        const dayOfWeek = DAYS_SHORT[curr.getDay()];
        const dateStr = curr.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        
        item.innerHTML = `<strong style="color:var(--accent);">${dayOfWeek} J${d}</strong> <small>(${dateStr})</small>`;
        area.appendChild(item);
        curr.setDate(curr.getDate() + 1); 
        d++;
    }
    updateDayTitle(); populateDaySelector(); renderBlocks(); save();
}

function updateDayTitle() { document.getElementById('currentDayTitle').innerText = 'Jour ' + activeDay; }

function populateDaySelector() {
    const select = document.getElementById('quickAddDaySelect');
    if (!select) return;
    select.innerHTML = "";
    const totalDays = Object.keys(tripData).length || 1;
    for (let i = 1; i <= Math.max(totalDays, 14); i++) {
        let opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `Jour ${i}`;
        if (i === activeDay) opt.selected = true;
        select.appendChild(opt);
    }
}

// 4. HÔTEL ET TRANSPORTS
function openHotelModal(defaultName = '', lat = null, lon = null) {
    document.getElementById('hotelName').value = defaultName;
    document.getElementById('hotelLat').value = lat || '';
    document.getElementById('hotelLon').value = lon || '';

    const startDateInput = document.getElementById('dateStart').value;
    if (startDateInput) {
        let d = new Date(startDateInput);
        d.setDate(d.getDate() + (activeDay - 1));
        const formattedDate = d.toISOString().split('T')[0];
        document.getElementById('hotelStart').value = formattedDate;
        
        d.setDate(d.getDate() + 1);
        document.getElementById('hotelEnd').value = d.toISOString().split('T')[0];
    }

    document.getElementById('hotelModal').style.display = 'flex';
}

function saveHotel() {
    const name = document.getElementById('hotelName').value || 'Hôtel';
    const start = document.getElementById('hotelStart').value;
    const end = document.getElementById('hotelEnd').value;
    const price = parseFloat(document.getElementById('hotelPrice').value) || 0;
    const payer = document.getElementById('hotelPayer').value || 'Moi';
    const lat = parseFloat(document.getElementById('hotelLat').value) || null;
    const lon = parseFloat(document.getElementById('hotelLon').value) || null;

    if (!start || !end) { alert("Indiquez les dates de début et de fin."); return; }

    const startDate = new Date(start);
    const endDate = new Date(end);
    const tripStart = new Date(document.getElementById('dateStart').value || Date.now());

    const bookingId = Date.now();
    const totalNights = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const pricePerNight = price / totalNights;

    hotelBookings.push({
        id: bookingId,
        name,
        totalPrice: price,
        start, end,
        startDay: Math.max(1, Math.round((startDate - tripStart) / (1000 * 60 * 60 * 24)) + 1),
        lat, lon
    });

    let curr = new Date(startDate);
    while (curr < endDate) {
        let dayNum = Math.round((curr - tripStart) / (1000 * 60 * 60 * 24)) + 1;
        if (dayNum >= 1) {
            if (!tripData[dayNum]) tripData[dayNum] = [];
            tripData[dayNum].push({
                id: Date.now() + Math.random(),
                bookingId: bookingId,
                type: 'hotel',
                name: `🏨 ${name}`,
                price: pricePerNight,
                time: '15:00',
                notes: `Nuitée (${start} au ${end})`,
                paidBy: payer,
                lat, lon
            });
        }
        curr.setDate(curr.getDate() + 1);
    }

    closeModal('hotelModal');
    renderBlocks();
    save();
}

function toggleTransportMenu() {
    const menu = document.getElementById('transportMenu');
    menu.style.display = menu.style.display === 'none' ? 'grid' : 'none';
}

function openTransportModal(type = 'Train', icon = '🚆', destinationName = '') {
    selectedTransportType = type;
    document.getElementById('transportModalTitle').innerText = `${icon} Transport (${type})`;
    document.getElementById('transportMenu').style.display = 'none';
    if (destinationName) document.getElementById('transTo').value = destinationName;
    document.getElementById('transportModal').style.display = 'flex';
}

function saveTransport() {
    const from = document.getElementById('transFrom').value || 'Départ';
    const to = document.getElementById('transTo').value || 'Arrivée';
    const dateStart = document.getElementById('transDateStart').value;
    const company = document.getElementById('transCompany').value;
    const code = document.getElementById('transCode').value;
    const cost = parseFloat(document.getElementById('transCost').value) || 0;
    const payer = document.getElementById('transPayer').value || 'Moi';

    let icon = selectedTransportType === 'Ferry' ? '⛴️' : selectedTransportType === 'Bus' ? '🚌' : selectedTransportType === 'Avion' ? '✈️' : '🚆';

    if (!tripData[activeDay]) tripData[activeDay] = [];
    tripData[activeDay].push({
        id: Date.now(),
        type: 'vol',
        name: `${icon} ${selectedTransportType}: ${from} ➔ ${to}`,
        price: cost,
        time: dateStart ? dateStart.split('T')[1] || '08:00' : '08:00',
        notes: `Compagnie: ${company || 'N/A'} | Code: ${code || 'Aucun'}`,
        paidBy: payer
    });

    closeModal('transportModal');
    renderBlocks();
    save();
}

function openQuickAddModal(defaultType = 'activ', name = '', lat = null, lon = null) {
    if (defaultType === 'hotel') {
        openHotelModal(name, lat, lon);
        return;
    }

    populateDaySelector();
    document.getElementById('quickAddType').value = defaultType;
    document.getElementById('quickAddName').value = name;
    document.getElementById('quickAddLat').value = lat || '';
    document.getElementById('quickAddLon').value = lon || '';
    document.getElementById('quickAddModal').style.display = 'flex';
}

function saveQuickAdd() {
    const targetDay = parseInt(document.getElementById('quickAddDaySelect').value) || activeDay;
    const type = document.getElementById('quickAddType').value;
    let name = document.getElementById('quickAddName').value || 'Élément';
    const price = parseFloat(document.getElementById('quickAddPrice').value) || 0;
    const time = document.getElementById('quickAddTime').value || '12:00';
    const lat = parseFloat(document.getElementById('quickAddLat').value) || null;
    const lon = parseFloat(document.getElementById('quickAddLon').value) || null;

    if (type === 'hotel') {
        closeModal('quickAddModal');
        openHotelModal(name, lat, lon);
        return;
    }

    const icons = { vol: '🚆 ', activ: '🎟️ ', resto: '🍴 ' };
    if (!name.match(/^(🏨|🚆|🎟️|🍴)/)) {
        name = (icons[type] || '') + name;
    }

    if (!tripData[targetDay]) tripData[targetDay] = [];
    tripData[targetDay].push({
        id: Date.now(),
        type,
        name,
        price,
        time,
        notes: '',
        paidBy: 'Moi',
        lat, lon
    });

    closeModal('quickAddModal');
    renderBlocks();
    save();
}

// 5. FONCTIONS D'ÉDITION CORRIGÉES
function openEditModal(id, day, bookingId = null) {
    document.getElementById('editId').value = id || '';
    document.getElementById('editDay').value = day;
    document.getElementById('editBookingId').value = bookingId || '';

    if (bookingId) {
        const booking = hotelBookings.find(b => b.id === bookingId);
        if (booking) {
            document.getElementById('editName').value = booking.name;
            document.getElementById('editPrice').value = booking.totalPrice;
            document.getElementById('editTime').value = "15:00";
            document.getElementById('editPaidBy').value = "Moi";
            document.getElementById('editNotes').value = `Hébergement (${booking.start} au ${booking.end})`;
        }
    } else {
        const item = (tripData[day] || []).find(x => x.id === id);
        if (item) {
            document.getElementById('editName').value = item.name;
            document.getElementById('editPrice').value = item.price;
            document.getElementById('editTime').value = item.time || "12:00";
            document.getElementById('editPaidBy').value = item.paidBy || "Moi";
            document.getElementById('editNotes').value = item.notes || "";
        }
    }
    document.getElementById('editModal').style.display = 'flex';
}

function saveEdit() {
    const id = document.getElementById('editId').value ? parseFloat(document.getElementById('editId').value) : null;
    const day = parseInt(document.getElementById('editDay').value);
    const bookingId = document.getElementById('editBookingId').value ? parseFloat(document.getElementById('editBookingId').value) : null;
    
    const newName = document.getElementById('editName').value;
    const newPrice = parseFloat(document.getElementById('editPrice').value) || 0;
    const newTime = document.getElementById('editTime').value;
    const newPaidBy = document.getElementById('editPaidBy').value;
    const newNotes = document.getElementById('editNotes').value;

    if (bookingId) {
        let booking = hotelBookings.find(b => b.id === bookingId);
        if (booking) {
            booking.name = newName;
            booking.totalPrice = newPrice;
        }
        Object.keys(tripData).forEach(d => {
            tripData[d].forEach(item => {
                if (item.bookingId === bookingId) {
                    item.name = `🏨 ${newName}`;
                    item.paidBy = newPaidBy;
                }
            });
        });
    } else if (id) {
        let item = (tripData[day] || []).find(x => x.id === id);
        if (item) {
            item.name = newName;
            item.price = newPrice;
            item.time = newTime;
            item.paidBy = newPaidBy;
            item.notes = newNotes;
        }
    }

    closeModal('editModal');
    renderBlocks();
    save();
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// 6. RENDU ET SYNTHÈSE
function renderBlocks() {
    const list = document.getElementById('blocksList');
    list.innerHTML = "";
    const cur = document.getElementById('currency').value;

    (tripData[activeDay] || []).forEach(b => {
        let div = document.createElement('div');
        div.className = `trip-block block-${b.type}`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:0.85rem;">${b.name}</strong>
                <div class="block-actions">
                    <span style="font-weight:bold; color:var(--accent); margin-right:4px;">${b.price.toFixed(2)}${cur}</span>
                    <button class="btn-icon" onclick="openEditModal(${b.id}, ${activeDay}, ${b.bookingId || 'null'})" title="Modifier">✏️</button>
                    <button class="btn-icon" onclick="delB(${b.id}, ${b.bookingId || 'null'})" title="Supprimer">✕</button>
                </div>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
                ⏱️ ${b.time} | 👤 ${b.paidBy || 'Moi'}
            </div>
            ${b.notes ? `<div style="font-size:0.75rem; background:var(--bg-app); padding:4px 6px; border-radius:4px; margin-top:4px;">${b.notes}</div>` : ''}
        `;
        list.appendChild(div);
    });

    updateTotal();
    updateMapMarkers();
    renderCategoriesRecap();
}

function updateTotal() {
    let total = 0;
    const cur = document.getElementById('currency').value;
    const paxCount = Math.max(1, parseInt(document.getElementById('pax').value) || 1);

    Object.values(tripData).forEach(dayBlocks => {
        dayBlocks.forEach(b => total += (parseFloat(b.price) || 0));
    });

    const perPax = total / paxCount;

    document.getElementById('totalLabel').innerText = total.toFixed(2) + cur;
    document.getElementById('perPaxLabel').innerText = perPax.toFixed(2) + cur;
}

function renderCategoriesRecap() {
    const categories = { vol: [], activ: [], resto: [] };
    const cur = document.getElementById('currency').value;

    Object.entries(tripData).forEach(([dayNum, items]) => {
        items.forEach(item => {
            if (item.type !== 'hotel' && categories[item.type]) {
                categories[item.type].push({ ...item, dayNum });
            }
        });
    });

    // 1. Catégorie Hébergements
    const hotelContainer = document.getElementById('cat-list-hotel');
    hotelContainer.innerHTML = "";
    if (hotelBookings.length === 0) {
        hotelContainer.innerHTML = `<small style="color:var(--text-muted); font-size:0.75rem; padding:4px;">Aucun hébergement</small>`;
    } else {
        hotelBookings.forEach(booking => {
            let div = document.createElement('div');
            div.className = 'cat-item';
            div.innerHTML = `
                <div class="cat-item-content" onclick="goToDay(${booking.startDay}, ${booking.lat}, ${booking.lon})">
                    <span>🏨 ${booking.name} <small style="color:var(--text-muted);">(du ${booking.start} au ${booking.end})</small></span>
                </div>
                <div>
                    <strong style="margin-right:6px;">${booking.totalPrice.toFixed(0)}${cur}</strong>
                    <button class="btn-icon" onclick="openEditModal(null, ${booking.startDay}, ${booking.id})">✏️</button>
                </div>
            `;
            hotelContainer.appendChild(div);
        });
    }

    // 2. Transports, Activités & Restaurants
    ['vol', 'activ', 'resto'].forEach(cat => {
        const catContainer = document.getElementById(`cat-list-${cat}`);
        catContainer.innerHTML = "";
        
        if (categories[cat].length === 0) {
            catContainer.innerHTML = `<small style="color:var(--text-muted); font-size:0.75rem; padding:4px;">Aucun élément</small>`;
            return;
        }

        categories[cat].forEach(item => {
            let div = document.createElement('div');
            div.className = 'cat-item';
            div.innerHTML = `
                <div class="cat-item-content" onclick="goToDay(${item.dayNum}, ${item.lat}, ${item.lon})">
                    <span>${item.name} <small style="color:var(--text-muted);">(J${item.dayNum})</small></span>
                </div>
                <div>
                    <strong style="margin-right:6px;">${item.price.toFixed(0)}${cur}</strong>
                    <button class="btn-icon" onclick="openEditModal(${item.id}, ${item.dayNum})">✏️</button>
                </div>
            `;
            catContainer.appendChild(div);
        });
    });
}

function goToDay(dayNum, lat = null, lon = null) {
    activeDay = parseInt(dayNum) || 1;
    generateTimeline();
    if (lat && lon) map.setView([lat, lon], 14);
}

// 7. CARTE AVEC MARQUEURS COLORÉS PAR CATÉGORIE
function updateMapMarkers() {
    itemMarkers.forEach(m => map.removeLayer(m));
    itemMarkers = [];

    Object.entries(tripData).forEach(([dayNum, items]) => {
        items.forEach(b => {
            if (b.lat && b.lon) {
                const title = encodeURIComponent(b.name.replace(/^(🏨|🚆|🎟️|🍴)\s*/, ''));
                const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lon}`;
                const appleUrl = `https://maps.apple.com/?q=${title}&ll=${b.lat},${b.lon}`;
                const wazeUrl = `https://waze.com/ul?ll=${b.lat},${b.lon}&navigate=yes`;

                let popupContent = `
                    <div style="font-size:0.8rem; font-weight:bold;">${b.name}</div>
                    <div style="font-size:0.7rem; color:gray;">Jour ${dayNum} - ${b.time}</div>
                    <div class="map-popup-actions">
                        <a href="${gmapsUrl}" target="_blank" class="map-popup-btn btn-gmaps">Google</a>
                        <a href="${appleUrl}" target="_blank" class="map-popup-btn btn-apple">Apple</a>
                        <a href="${wazeUrl}" target="_blank" class="map-popup-btn btn-waze">Waze</a>
                    </div>
                `;

                const markerColor = CATEGORY_COLORS[b.type] || '#ff7e5f';
                const customIcon = createColoredMarkerIcon(markerColor);

                let m = L.marker([b.lat, b.lon], { icon: customIcon }).addTo(map).bindPopup(popupContent);
                itemMarkers.push(m);
            }
        });
    });
}

function delB(id, bookingId = null) {
    if (bookingId) {
        hotelBookings = hotelBookings.filter(b => b.id !== bookingId);
        Object.keys(tripData).forEach(d => {
            tripData[d] = tripData[d].filter(x => x.bookingId !== bookingId);
        });
    } else {
        tripData[activeDay] = tripData[activeDay].filter(x => x.id !== id);
    }
    renderBlocks();
    save();
}

function save() {
    localStorage.setItem('travelPlannerData', JSON.stringify(tripData));
    localStorage.setItem('hotelBookings', JSON.stringify(hotelBookings));
    ['dateStart', 'dateEnd', 'cityStart', 'cityEnd', 'currency', 'pax'].forEach(f => {
        let el = document.getElementById(f); if(el) localStorage.setItem(f, el.value);
    });
}

function saveAndRefresh() { save(); renderBlocks(); }
function clearAll() { if(confirm("Supprimer l'intégralité du planning ?")) { localStorage.clear(); location.reload(); } }
function downloadData() {
    const blob = new Blob([JSON.stringify({ tripData, hotelBookings }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Voyage.json`; a.click();
}
