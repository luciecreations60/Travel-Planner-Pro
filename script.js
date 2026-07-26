let activeDay = 1;
let currentLang = 'fr';
let tripData = JSON.parse(localStorage.getItem('travelPlannerData')) || {};
let hotelBookings = JSON.parse(localStorage.getItem('hotelBookings')) || [];
let map;
let itemMarkers = [];
let searchMarker = null;
let selectedTransportType = 'Train';
let searchTimeout = null;

const DAYS_SHORT_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const DAYS_SHORT_EN = ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.'];

const CATEGORY_COLORS = {
    hotel: '#f59e0b',
    vol: '#6366f1',
    activ: '#ec4899',
    resto: '#10b981'
};

// TRADUCTIONS COMPLETE POUR LE MODE FR/EN
const i18n = {
    fr: {
        appTitle: "Explorez le monde ✈️",
        appSubtitle: "Préparez votre itinéraire sur-mesure",
        lblStart: "DÉPART",
        lblEnd: "ARRIVÉE",
        lblFrom: "DU",
        lblTo: "AU",
        lblCurrency: "DEVISE",
        lblPax: "VOYAGEURS",
        titleTimeline: "🗓️ Itinéraire",
        btnClear: "🗑️ Tout effacer",
        btnSave: "💾 Sauvegarder",
        btnSearch: "Rechercher",
        chipHotel: "🏨 Hébergement",
        chipTransport: "🚆 Transport",
        chipActiv: "🎟️ Activités",
        chipResto: "🍴 Restaurants",
        titleSearchResults: "Résultats trouvés",
        mapHint: "📍 Cliquez sur la carte pour ajouter un lieu | Les pointeurs offrent des liens GPS (Google, Apple, Waze)",
        lblTotalBudget: "TOTAL DU VOYAGE",
        lblPerPax: "PAR PERSONNE",
        titleCategoryRecap: "🗂️ Synthèse par Catégories",
        catHotels: "🏨 Hébergements",
        catTransports: "🚆 Transports",
        catActivities: "🎟️ Activités",
        catRestaurants: "🍴 Restaurants",
        modalHotelTitle: "🏨 Ajouter un Hébergement",
        lblLabelName: "Libellé personnalisé / Nom",
        lblCheckin: "Check-in",
        lblCheckout: "Check-out",
        lblTotalPrice: "Prix Total",
        lblPaidBy: "Payé par",
        btnCancel: "Annuler",
        lblFromLoc: "Lieu de Départ",
        lblToLoc: "Lieu d'Arrivée",
        lblDepTime: "Départ (Date/Heure)",
        lblArrTime: "Arrivée (Date/Heure)",
        lblCompany: "Compagnie",
        lblCode: "N° Confirmation",
        lblCost: "Coût",
        titleQuickAdd: "Ajouter un élément",
        lblDayTarget: "Jour concerné",
        lblCategory: "Catégorie",
        lblPrice: "Prix",
        lblTime: "Heure",
        btnValidate: "Valider & Ajouter",
        titleEditEvent: "✏️ Modifier l'événement",
        lblNotes: "Notes / Détails",
        btnUpdate: "Mettre à jour"
    },
    en: {
        appTitle: "Explore the World ✈️",
        appSubtitle: "Design your custom trip itinerary",
        lblStart: "START",
        lblEnd: "DESTINATION",
        lblFrom: "FROM",
        lblTo: "TO",
        lblCurrency: "CURRENCY",
        lblPax: "TRAVELERS",
        titleTimeline: "🗓️ Itinerary",
        btnClear: "🗑️ Clear All",
        btnSave: "💾 Save",
        btnSearch: "Search",
        chipHotel: "🏨 Lodging",
        chipTransport: "🚆 Transport",
        chipActiv: "🎟️ Activities",
        chipResto: "🍴 Dining",
        titleSearchResults: "Search Results",
        mapHint: "📍 Click map to add a place | Markers provide GPS directions (Google, Apple, Waze)",
        lblTotalBudget: "TRIP TOTAL",
        lblPerPax: "PER PERSON",
        titleCategoryRecap: "🗂️ Category Summary",
        catHotels: "🏨 Accommodations",
        catTransports: "🚆 Transports",
        catActivities: "🎟️ Activities",
        catRestaurants: "🍴 Restaurants",
        modalHotelTitle: "🏨 Add Accommodation",
        lblLabelName: "Name / Label",
        lblCheckin: "Check-in",
        lblCheckout: "Check-out",
        lblTotalPrice: "Total Price",
        lblPaidBy: "Paid by",
        btnCancel: "Cancel",
        lblFromLoc: "Departure Place",
        lblToLoc: "Arrival Place",
        lblDepTime: "Departure (Date/Time)",
        lblArrTime: "Arrival (Date/Time)",
        lblCompany: "Company",
        lblCode: "Confirmation #",
        lblCost: "Cost",
        titleQuickAdd: "Add New Item",
        lblDayTarget: "Target Day",
        lblCategory: "Category",
        lblPrice: "Price",
        lblTime: "Time",
        btnValidate: "Add Item",
        titleEditEvent: "✏️ Edit Event",
        lblNotes: "Notes / Details",
        btnUpdate: "Update"
    }
};

// HELPER: FORMATEUR DE DATES (JJ/MM/AAAA vs MM/JJ/AAAA)
function formatDateString(dateInput) {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return currentLang === 'fr' ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
}

// HELPER: OBTENIR LA DATE EXACTE À PARTIR DU NUMÉRO DE JOUR
function getDateForDayNumber(dayNum) {
    const startDateInput = document.getElementById('dateStart').value;
    if (!startDateInput) return null;
    let d = new Date(startDateInput);
    d.setDate(d.getDate() + (dayNum - 1));
    return d;
}

function toggleLang() {
    currentLang = currentLang === 'fr' ? 'en' : 'fr';
    applyLanguage();
    generateTimeline();
    renderCategoriesRecap();
}

function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[currentLang][key]) {
            el.innerText = i18n[currentLang][key];
        }
    });
}

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

    const daysArr = currentLang === 'fr' ? DAYS_SHORT_FR : DAYS_SHORT_EN;
    const locale = currentLang === 'fr' ? 'fr-FR' : 'en-US';

    while(curr <= endDate) {
        if(!tripData[d]) tripData[d] = [];
        let item = document.createElement('div');
        item.className = `day-item ${d === activeDay ? 'active' : ''}`;
        let currentDayNum = d;
        item.onclick = () => { activeDay = currentDayNum; updateDayTitle(); generateTimeline(); };
        
        const dayOfWeek = daysArr[curr.getDay()];
        const dateStr = curr.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
        
        item.innerHTML = `<span class="day-item-tag">J${d}</span> <span>${dayOfWeek} ${dateStr}</span>`;
        area.appendChild(item);
        curr.setDate(curr.getDate() + 1); 
        d++;
    }
    updateDayTitle(); populateDaySelector(); renderBlocks(); save();
}

function updateDayTitle() { 
    document.getElementById('currentDayTitle').innerText = (currentLang === 'fr' ? 'Jour ' : 'Day ') + activeDay; 
}

function populateDaySelector() {
    const select = document.getElementById('quickAddDaySelect');
    if (!select) return;
    select.innerHTML = "";
    const totalDays = Object.keys(tripData).length || 1;
    for (let i = 1; i <= Math.max(totalDays, 14); i++) {
        let opt = document.createElement('option');
        opt.value = i;
        opt.innerText = (currentLang === 'fr' ? 'Jour ' : 'Day ') + i;
        if (i === activeDay) opt.selected = true;
        select.appendChild(opt);
    }
}

// 4. HÔTEL ET TRANSPORTS (RÉINITIALISATION CHAMPS AVANT OUVERTURE)
function openHotelModal(defaultName = '', lat = null, lon = null) {
    // Réinitialisation des anciens champs
    document.getElementById('hotelName').value = defaultName;
    document.getElementById('hotelPrice').value = '';
    document.getElementById('hotelPayer').value = 'Moi';
    document.getElementById('hotelLat').value = lat || '';
    document.getElementById('hotelLon').value = lon || '';
    document.getElementById('hotelModalResults').style.display = 'none';

    const startDateInput = document.getElementById('dateStart').value;
    if (startDateInput) {
        let d = new Date(startDateInput);
        d.setDate(d.getDate() + (activeDay - 1));
        const formattedDate = d.toISOString().split('T')[0];
        document.getElementById('hotelStart').value = formattedDate;
        
        d.setDate(d.getDate() + 1);
        document.getElementById('hotelEnd').value = d.toISOString().split('T')[0];
    } else {
        document.getElementById('hotelStart').value = '';
        document.getElementById('hotelEnd').value = '';
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

    const startDay = Math.max(1, Math.round((startDate - tripStart) / (1000 * 60 * 60 * 24)) + 1);
    const endDay = startDay + totalNights - 1;

    hotelBookings.push({
        id: bookingId,
        name,
        totalPrice: price,
        start, end,
        startDay, endDay,
        paidBy: payer,
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
                notes: `Nuitée (${formatDateString(start)} au ${formatDateString(end)})`,
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

    // Réinitialisation des champs
    document.getElementById('transFrom').value = '';
    document.getElementById('transTo').value = destinationName || '';
    document.getElementById('transDateStart').value = '';
    document.getElementById('transDateEnd').value = '';
    document.getElementById('transCompany').value = '';
    document.getElementById('transCode').value = '';
    document.getElementById('transCost').value = '';
    document.getElementById('transPayer').value = 'Moi';

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
    
    // Réinitialisation des anciens champs
    document.getElementById('quickAddType').value = defaultType;
    document.getElementById('quickAddName').value = name || '';
    document.getElementById('quickAddPrice').value = '';
    document.getElementById('quickAddTime').value = '12:00';
    document.getElementById('quickAddLat').value = lat || '';
    document.getElementById('quickAddLon').value = lon || '';
    document.getElementById('quickAddModalResults').style.display = 'none';

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

// 5. FONCTIONS D'ÉDITION
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
            document.getElementById('editPaidBy').value = booking.paidBy || "Moi";
            document.getElementById('editNotes').value = `Hébergement (${formatDateString(booking.start)} au ${formatDateString(booking.end)})`;
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
            booking.paidBy = newPaidBy;
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

// 6. RENDU ET SYNTHÈSE (AVEC TRI CHRONOLOGIQUE ET FORMATAGE DE DATE DÉDIÉ)
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
    const payerTotals = {};

    hotelBookings.forEach(booking => {
        const payer = booking.paidBy || 'Moi';
        payerTotals[payer] = (payerTotals[payer] || 0) + booking.totalPrice;
    });

    Object.values(tripData).forEach(dayBlocks => {
        dayBlocks.forEach(b => {
            if (b.type !== 'hotel') {
                const payer = b.paidBy || 'Moi';
                payerTotals[payer] = (payerTotals[payer] || 0) + (parseFloat(b.price) || 0);
            }
        });
    });

    total = Object.values(payerTotals).reduce((a, b) => a + b, 0);
    const perPax = total / paxCount;

    document.getElementById('totalLabel').innerText = total.toFixed(2) + cur;
    document.getElementById('perPaxLabel').innerText = perPax.toFixed(2) + cur;

    const breakdownContainer = document.getElementById('payerBreakdownContainer');
    breakdownContainer.innerHTML = "";

    if (Object.keys(payerTotals).length > 0) {
        Object.entries(payerTotals).forEach(([payer, amount]) => {
            let chip = document.createElement('div');
            chip.className = 'payer-chip';
            chip.innerText = `👤 ${payer} : ${amount.toFixed(2)}${cur}`;
            breakdownContainer.appendChild(chip);
        });
    }
}

// RENDU DE LA SYNTHÈSE : TRI CHRONOLOGIQUE ET FORMAT DE DATE AMÉLIORÉ
function renderCategoriesRecap() {
    const categories = { vol: [], activ: [], resto: [] };
    const cur = document.getElementById('currency').value;

    Object.entries(tripData).forEach(([dayNum, items]) => {
        const num = parseInt(dayNum);
        items.forEach(item => {
            if (item.type !== 'hotel' && categories[item.type]) {
                const itemDate = getDateForDayNumber(num);
                categories[item.type].push({ 
                    ...item, 
                    dayNum: num,
                    dateObj: itemDate
                });
            }
        });
    });

    // --- 1. RENDU HÔTELS (TRIÉS PAR DATE DE DÉBUT) ---
    const hotelContainer = document.getElementById('cat-list-hotel');
    hotelContainer.innerHTML = "";
    
    // Tri par date
    const sortedHotels = [...hotelBookings].sort((a, b) => new Date(a.start) - new Date(b.start));

    if (sortedHotels.length === 0) {
        hotelContainer.innerHTML = `<small style="color:var(--text-muted); font-size:0.75rem; padding:4px;">Aucun hébergement</small>`;
    } else {
        sortedHotels.forEach(booking => {
            let div = document.createElement('div');
            div.className = 'cat-item';
            
            const startDateFormatted = formatDateString(booking.start);
            const endDateFormatted = formatDateString(booking.end);
            
            const datePrefix = currentLang === 'fr' ? 'Du' : 'From';
            const dateTo = currentLang === 'fr' ? 'au' : 'to';
            const dayPrefix = currentLang === 'fr' ? 'J' : 'Day ';
            
            const dayRangeStr = booking.startDay === booking.endDay 
                ? `${dayPrefix}${booking.startDay}` 
                : `${dayPrefix}${booking.startDay} ${currentLang === 'fr' ? 'à' : 'to'} ${dayPrefix}${booking.endDay}`;

            div.innerHTML = `
                <div class="cat-item-content" onclick="goToDay(${booking.startDay}, ${booking.lat}, ${booking.lon})">
                    <span>🏨 ${booking.name} <br><small style="color:var(--text-muted);">${datePrefix} ${startDateFormatted} ${dateTo} ${endDateFormatted} (${dayRangeStr})</small></span>
                </div>
                <div>
                    <strong style="margin-right:6px;">${booking.totalPrice.toFixed(0)}${cur}</strong>
                    <button class="btn-icon" onclick="openEditModal(null, ${booking.startDay}, ${booking.id})">✏️</button>
                </div>
            `;
            hotelContainer.appendChild(div);
        });
    }

    // --- 2. RENDU VOL, ACTIVITÉS, RESTAURANTS (TRIÉS PAR DATE + HEURE) ---
    ['vol', 'activ', 'resto'].forEach(cat => {
        const catContainer = document.getElementById(`cat-list-${cat}`);
        catContainer.innerHTML = "";
        
        // Tri chronologique
        categories[cat].sort((a, b) => {
            const timeA = a.time || '00:00';
            const timeB = b.time || '00:00';
            const dateA = a.dateObj ? new Date(`${a.dateObj.toISOString().split('T')[0]}T${timeA}`) : 0;
            const dateB = b.dateObj ? new Date(`${b.dateObj.toISOString().split('T')[0]}T${timeB}`) : 0;
            return dateA - dateB;
        });

        if (categories[cat].length === 0) {
            catContainer.innerHTML = `<small style="color:var(--text-muted); font-size:0.75rem; padding:4px;">Aucun élément</small>`;
            return;
        }

        categories[cat].forEach(item => {
            let div = document.createElement('div');
            div.className = 'cat-item';

            const dateStr = item.dateObj ? formatDateString(item.dateObj) : '';
            const atStr = currentLang === 'fr' ? 'à' : 'at';
            const dayTag = currentLang === 'fr' ? `J${item.dayNum}` : `Day ${item.dayNum}`;
            const timeStr = item.time ? `${atStr} ${item.time}` : '';

            div.innerHTML = `
                <div class="cat-item-content" onclick="goToDay(${item.dayNum}, ${item.lat}, ${item.lon})">
                    <span>${item.name} <br><small style="color:var(--text-muted);">${dateStr} ${timeStr} (${dayTag})</small></span>
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

// 7. POP-UP CARTE
function updateMapMarkers() {
    itemMarkers.forEach(m => map.removeLayer(m));
    itemMarkers = [];

    const processedBookingIds = new Set();

    Object.entries(tripData).forEach(([dayNum, items]) => {
        items.forEach(b => {
            if (b.lat && b.lon) {
                if (b.bookingId) {
                    if (processedBookingIds.has(b.bookingId)) return;
                    processedBookingIds.add(b.bookingId);
                }

                let dayLabel = `Jour ${dayNum}`;
                
                if (b.bookingId) {
                    const booking = hotelBookings.find(h => h.id === b.bookingId);
                    if (booking) {
                        dayLabel = (booking.startDay === booking.endDay) ? `Jour ${booking.startDay}` : `Jours ${booking.startDay} ➔ ${booking.endDay}`;
                    }
                }

                const title = encodeURIComponent(b.name.replace(/^(🏨|🚆|🎟️|🍴)\s*/, ''));
                const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lon}`;
                const appleUrl = `https://maps.apple.com/?q=${title}&ll=${b.lat},${b.lon}`;
                const wazeUrl = `https://waze.com/ul?ll=${b.lat},${b.lon}&navigate=yes`;

                let popupContent = `
                    <div style="font-size:0.85rem; font-weight:bold;">${b.name}</div>
                    <div style="font-size:0.75rem; color:gray; margin-top:2px;">${dayLabel} - ${b.time}</div>
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
