let activeDay = 1;
let currentLang = localStorage.getItem('lang') || 'fr';
let tripData = JSON.parse(localStorage.getItem('travelPlannerData')) || {};
let map;
let markers = {};
let itemMarkers = [];
let draggedItemIndex = null;

// 1. INITIALISATION ET CARTE
function initMap(center = [46, 2], zoom = 3) {
    if(map) map.remove();
    map = L.map('map').setView(center, zoom);
    
    const isDark = localStorage.getItem('darkMode') === 'true';
    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, { attribution: '&copy; CARTO' }).addTo(map);
    if(isDark) document.body.classList.add('dark-mode');
}

window.onload = () => {
    ['dateStart', 'dateEnd', 'cityStart', 'cityEnd', 'currency', 'budgetMax', 'pax', 'polarstepsUrl'].forEach(f => { 
        if(localStorage.getItem(f)) document.getElementById(f).value = localStorage.getItem(f); 
    });
    
    initMap(); 
    applyLang(); 
    generateTimeline(); 
    restoreMapMarkers();
};

// 2. GESTION DU MODE SOMBRE
function toggleDarkMode() {
    const body = document.body;
    const isDark = body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark);
    
    const btn = document.getElementById('dark-btn');
    if(btn) btn.innerText = isDark ? "☀️" : "🌙";

    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    
    L.tileLayer(tileUrl, { attribution: '&copy; CARTO' }).addTo(map);
}

// 3. SAUVEGARDE ET CALCULS AVEC REMBOURSEMENTS SPLITWISE
function save() {
    localStorage.setItem('travelPlannerData', JSON.stringify(tripData));
    ['dateStart', 'dateEnd', 'cityStart', 'cityEnd', 'currency', 'budgetMax', 'pax', 'polarstepsUrl'].forEach(f => {
        let el = document.getElementById(f); if(el) localStorage.setItem(f, el.value);
    });
    localStorage.setItem('lang', currentLang);
    updateTotal();
    updateMapMarkers();
}

function saveAndRefresh() { save(); updateTotal(); }

function updateTotal() { 
    let total = 0; 
    let stats = { vol: 0, hotel: 0, activ: 0, resto: 0 };
    let paidByPerson = {};

    const cur = document.getElementById('currency').value;
    const pax = parseInt(document.getElementById('pax').value) || 1;

    Object.values(tripData).forEach(dayBlocks => {
        dayBlocks.forEach(b => {
            let p = parseFloat(b.price) || 0;
            total += p;
            if(stats[b.type] !== undefined) stats[b.type] += p;

            let payer = (b.paidBy || 'Moi').trim();
            paidByPerson[payer] = (paidByPerson[payer] || 0) + p;
        });
    });

    const totalEl = document.getElementById('totalLabel');
    const budgetMax = parseFloat(document.getElementById('budgetMax').value) || 0; 
    const alertEl = document.getElementById('alertLimit'); 
    
    const perPerson = total / pax;
    totalEl.innerText = total.toFixed(2) + cur; 
    
    if (budgetMax > 0 && total > budgetMax) { 
        totalEl.style.color = "#fca5a5"; 
        if(alertEl) alertEl.style.display = "block"; 
    } else { 
        totalEl.style.color = "white"; 
        if(alertEl) alertEl.style.display = "none"; 
    } 

    // Récapitulatif
    const recapList = document.getElementById('recap-list');
    recapList.innerHTML = `
        <div class="recap-item"><strong>Part par personne (${pax} pers.) :</strong> <span><strong>${perPerson.toFixed(2)}${cur}</strong></span></div>
        <hr style="border:0; border-top:1px solid var(--border-color); margin:5px 0;">
        <div class="recap-item"><small><span class="recap-dot" style="background:#6366f1"></span>Vols / Transports</small> <span>${stats.vol.toFixed(2)}${cur}</span></div>
        <div class="recap-item"><small><span class="recap-dot" style="background:#f59e0b"></span>Hébergements</small> <span>${stats.hotel.toFixed(2)}${cur}</span></div>
        <div class="recap-item"><small><span class="recap-dot" style="background:#ec4899"></span>Activités</small> <span>${stats.activ.toFixed(2)}${cur}</span></div>
        <div class="recap-item"><small><span class="recap-dot" style="background:#10b981"></span>Restaurants</small> <span>${stats.resto.toFixed(2)}${cur}</span></div>
    `;

    // Équilibre des comptes (Qui a payé quoi)
    const splitDiv = document.getElementById('split-summary');
    splitDiv.innerHTML = "";

    if (Object.keys(paidByPerson).length === 0) {
        splitDiv.innerHTML = `<small style="color:var(--text-muted);">Aucune dépense enregistrée.</small>`;
    } else {
        Object.entries(paidByPerson).forEach(([person, amount]) => {
            let diff = amount - perPerson;
            let statusColor = diff >= 0 ? "#10b981" : "#ef4444";
            let statusText = diff >= 0 
                ? `+${diff.toFixed(2)}${cur}` 
                : `${diff.toFixed(2)}${cur}`;

            splitDiv.innerHTML += `
                <div style="display:flex; justify-content:space-between;">
                    <span><strong>${person}</strong> (${amount.toFixed(2)}${cur})</span>
                    <span style="color:${statusColor}; font-weight:bold;">${statusText}</span>
                </div>
            `;
        });
    }

    // Lien Polarsteps
    const polarUrl = document.getElementById('polarstepsUrl').value;
    const polarBtn = document.getElementById('btnPolarsteps');
    if (polarUrl) {
        polarBtn.href = polarUrl;
        polarBtn.style.display = "inline-block";
    } else {
        polarBtn.style.display = "none";
    }
}

// 4. TIMELINE ET BLOCS AVEC DRAG & DROP
function generateTimeline() {
    const startI = document.getElementById('dateStart').value;
    const endI = document.getElementById('dateEnd').value;
    const area = document.getElementById('timelineArea');
    if(!startI || !endI) return;
    area.innerHTML = "";
    let curr = new Date(startI);
    let d = 1;
    while(curr <= new Date(endI)) {
        if(!tripData[d]) tripData[d] = [];
        let item = document.createElement('div');
        item.className = `day-item ${d === activeDay ? 'active' : ''}`;
        item.onclick = ((day) => () => { activeDay = day; updateDayTitle(); generateTimeline(); })(d);
        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
        const dateStr = curr.toLocaleDateString(currentLang === 'fr' ? 'fr-FR' : 'en-US', dateOptions);
        item.innerHTML = `<span class="day-num">${currentLang === 'fr' ? 'Jour' : 'Day'} ${d}</span> <span class="day-date">${dateStr}</span>`;
        area.appendChild(item);
        curr.setDate(curr.getDate() + 1); d++;
    }
    updateDayTitle(); renderBlocks(); save();
}

function updateDayTitle() { document.getElementById('currentDayTitle').innerText = (currentLang === 'fr' ? 'Jour ' : 'Day ') + activeDay; }

function addBlock(type, name = '', lat = null, lon = null) { 
    if(!tripData[activeDay]) tripData[activeDay] = [];
    tripData[activeDay].push({ 
        id: Date.now(), 
        type, 
        name: name || '', 
        price: 0, 
        time: '10:00', 
        notes: '',
        paidBy: 'Moi',
        bookingUrl: '',
        lat,
        lon
    }); 
    renderBlocks(); 
    save(); 
}

function renderBlocks() { 
    const list = document.getElementById('blocksList'); 
    list.innerHTML = ""; 
    const cur = document.getElementById('currency').value; 

    (tripData[activeDay] || []).forEach((b, index) => { 
        let div = document.createElement('div'); 
        div.className = `trip-block block-${b.type}`; 
        div.setAttribute('draggable', 'true');
        div.dataset.index = index;

        let icon = b.type === 'vol' ? '✈️' : b.type === 'hotel' ? '🏨' : b.type === 'resto' ? '🍴' : '🎟️';
        
        let extra = `<div style="margin-top:8px; display:grid; gap:5px;">
            <div style="display:flex; gap:10px;">
                <input type="text" placeholder="${currentLang === 'fr' ? 'Notes / Adresse' : 'Notes / Address'}" value="${b.notes || ''}" style="flex:1;" onchange="updateB(${b.id}, 'notes', this.value)">
                <input type="text" placeholder="Payé par" value="${b.paidBy || 'Moi'}" style="width:90px;" onchange="updateB(${b.id}, 'paidBy', this.value)">
            </div>
            ${b.type === 'hotel' ? `<input type="text" placeholder="Lien de réservation" value="${b.bookingUrl || ''}" onchange="updateB(${b.id}, 'bookingUrl', this.value)">` : ''}
        </div>`; 

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="cursor:grab; font-size:1.1rem; color:var(--text-muted);" title="Glisser pour réordonner">☰</span>
                <input type="time" style="width:75px" value="${b.time}" onchange="updateB(${b.id}, 'time', this.value)">
                <div style="font-size:1.2rem">${icon}</div>
                <input type="text" style="flex:1; font-weight:bold;" value="${b.name}" placeholder="Nom" onchange="updateB(${b.id}, 'name', this.value)">
                <input type="number" style="width:65px" value="${b.price}" oninput="updateB(${b.id}, 'price', this.value)">${cur}
                <button onclick="delB(${b.id})" style="border:none; background:none; cursor:pointer; color:var(--text-muted);">✕</button>
            </div>${extra}`; 

        // Drag & Drop
        div.addEventListener('dragstart', (e) => {
            draggedItemIndex = index;
            div.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        div.addEventListener('dragend', () => {
            div.classList.remove('dragging');
            document.querySelectorAll('.trip-block').forEach(el => el.classList.remove('drag-over'));
        });

        div.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            div.classList.add('drag-over');
        });

        div.addEventListener('dragleave', () => {
            div.classList.remove('drag-over');
        });

        div.addEventListener('drop', (e) => {
            e.preventDefault();
            div.classList.remove('drag-over');
            const targetIndex = parseInt(div.dataset.index, 10);
            if (draggedItemIndex !== null && draggedItemIndex !== targetIndex) {
                const movedItem = tripData[activeDay].splice(draggedItemIndex, 1)[0];
                tripData[activeDay].splice(targetIndex, 0, movedItem);
                save();
                renderBlocks();
            }
        });

        list.appendChild(div); 
    }); 
    updateTotal(); 
}

async function updateB(id, f, v) { 
    let block = tripData[activeDay].find(x => x.id === id); 
    if(!block) return; 
    block[f] = f === 'price' ? parseFloat(v) : v; 
    save(); 
}

// 5. FONCTIONS DE REDIRECTIONS EXTÉRIEURES (SKYSCANNER, BOOKING, GETYOURGUIDE)
function openFlightSearch() {
    const startCity = document.getElementById('cityStart').value;
    const endCity = document.getElementById('cityEnd').value;
    const startDate = document.getElementById('dateStart').value;

    if (!startCity || !endCity) {
        alert(currentLang === 'fr' ? "Indique une ville de départ et d'arrivée." : "Please fill in start and end cities.");
        return;
    }

    let travelDate = startDate;
    if (startDate) {
        let d = new Date(startDate);
        d.setDate(d.getDate() + (activeDay - 1));
        travelDate = d.toISOString().split('T')[0];
    }

    const skyscannerUrl = `https://www.skyscanner.fr/transports/vols/${encodeURIComponent(startCity)}/${encodeURIComponent(endCity)}/${travelDate}/`;
    window.open(skyscannerUrl, '_blank');

    addBlock('vol', `Vol ${startCity} ➔ ${endCity}`);
}

function openHotelSearch() {
    const endCity = document.getElementById('cityEnd').value;
    const startDate = document.getElementById('dateStart').value;

    if (!endCity) {
        alert(currentLang === 'fr' ? "Indique d'abord ta destination." : "Please fill in destination.");
        return;
    }

    let checkin = startDate;
    if (startDate) {
        let d = new Date(startDate);
        d.setDate(d.getDate() + (activeDay - 1));
        checkin = d.toISOString().split('T')[0];
    }

    const bookingUrl = `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(endCity)}&checkin=${checkin}`;
    window.open(bookingUrl, '_blank');

    addBlock('hotel', `Hôtel à ${endCity}`);
}

// 6. RECHERCHE ET SUGGESTIONS SUR CARTE & LIENS
async function findPlaces(category = 'resto', filter = 'all') {
    const endCity = document.getElementById('cityEnd').value;
    if (!endCity) {
        alert(currentLang === 'fr' ? "Indique d'abord ta destination." : "Please select a destination first.");
        return;
    }

    const panel = document.getElementById('search-results-panel');
    const listDiv = document.getElementById('results-list');
    const titleEl = document.getElementById('search-results-title');
    const bannerEl = document.getElementById('external-link-banner');
    const filtersEl = document.getElementById('resto-filters');

    panel.style.display = 'block';
    filtersEl.style.display = category === 'resto' ? 'flex' : 'none';

    if (category === 'activ') {
        titleEl.innerText = "🎟️ Activités & Visites";
        const gygUrl = `https://www.getyourguide.fr/s/?q=${encodeURIComponent(endCity)}`;
        bannerEl.innerHTML = `
            <a href="${gygUrl}" target="_blank" class="btn-main" style="background:#ff5533; text-decoration:none;">
                🎟️ Chercher des billets sur GetYourGuide (${endCity}) ↗
            </a>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px; text-align:center;">Ou choisis parmi les lieux ci-dessous :</div>
        `;
    } else {
        titleEl.innerText = "🍴 Restaurants & Cafés";
        const tripUrl = `https://www.tripadvisor.fr/Search?q=${encodeURIComponent(endCity)}`;
        bannerEl.innerHTML = `
            <a href="${tripUrl}" target="_blank" class="btn-main" style="background:#00af87; text-decoration:none;">
                🍴 Voir sur TripAdvisor (${endCity}) ↗
            </a>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px; text-align:center;">Ou explore les cartes aux alentours :</div>
        `;
    }

    if (!markers['end']) {
        listDiv.innerHTML = `<p style="padding:10px; font-size:0.8rem; color:var(--text-muted);">Sélectionne la ville dans la recherche pour charger les lieux sur la carte.</p>`;
        return;
    }

    const lat = markers['end'].getLatLng().lat;
    const lng = markers['end'].getLatLng().lng;

    listDiv.innerHTML = `<div style="display:flex; align-items:center; padding:15px;"><div class="spinner"></div> Recherche...</div>`;

    let overpassFilter = category === 'resto' 
        ? `node["amenity"~"restaurant|cafe"]${filter !== 'all' ? `["cuisine"~"${filter}"]` : ''}(around:3000,${lat},${lng});`
        : `node["tourism"~"attraction|museum|viewpoint|gallery"](around:3000,${lat},${lng});`;

    const query = `[out:json];${overpassFilter}out 10;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        listDiv.innerHTML = "";

        if (!data.elements || data.elements.length === 0) {
            listDiv.innerHTML = `<p style="padding:10px; font-size:0.8rem;">Aucun lieu trouvé à proximité.</p>`;
            return;
        }

        data.elements.forEach(item => {
            const name = item.tags.name || (category === 'resto' ? "Restaurant" : "Attraction");
            const sub = item.tags.cuisine || item.tags.tourism || "";
            const btn = document.createElement('button');
            btn.className = "btn-api";
            btn.style = "text-align:left; background:var(--bg-app); width:100%; justify-content:space-between; color:var(--text-main); border:1px solid var(--border-color);";
            btn.innerHTML = `<span><strong>${name}</strong><br><small style="color:var(--text-muted);">${sub}</small></span><span style="color:var(--accent); font-weight:bold;">+ Ajouter</span>`;
            btn.onclick = () => {
                addBlock(category === 'resto' ? 'resto' : 'activ', name, item.lat, item.lon);
                btn.innerHTML = "✅ Ajouté";
                btn.disabled = true;
            };
            listDiv.appendChild(btn);
        });
    } catch (e) { listDiv.innerHTML = "Erreur de chargement des lieux."; }
}

function findRestaurants(filter = 'all') { findPlaces('resto', filter); }
function findActivities() { findPlaces('activ', 'all'); }

// 7. CARTE ET MARQUEURS INTERACTIFS AVEC LIEN GOOGLE MAPS
function updateMapMarkers() {
    itemMarkers.forEach(m => map.removeLayer(m));
    itemMarkers = [];

    (tripData[activeDay] || []).forEach(b => {
        if (b.lat && b.lon) {
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lon}`;
            const popupContent = `
                <div style="font-family:sans-serif; text-align:center;">
                    <strong style="font-size:1rem;">${b.name}</strong><br>
                    <small>${b.notes || ''}</small><br><br>
                    <a href="${googleMapsUrl}" target="_blank" style="background:#3b82f6; color:white; padding:5px 10px; border-radius:6px; text-decoration:none; font-size:0.8rem;">
                        🗺️ Ouvrir dans Google Maps
                    </a>
                </div>
            `;
            let m = L.marker([b.lat, b.lon]).addTo(map).bindPopup(popupContent);
            itemMarkers.push(m);
        }
    });
}

async function handleSearch(q, type) { 
    const sugg = document.getElementById(type === 'start' ? 'suggestionsStart' : 'suggestionsEnd'); 
    if(q.length < 3) { sugg.style.display = 'none'; return; }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&accept-language=${currentLang}&q=${q}&limit=3`); 
    const data = await res.json(); 
    sugg.innerHTML = ""; 
    data.forEach(p => { 
        let d = document.createElement('div'); d.className = "suggest-item"; d.innerText = p.display_name; 
        d.onclick = () => { 
            document.getElementById(type === 'start' ? 'cityStart' : 'cityEnd').value = p.display_name; 
            sugg.style.display = 'none'; placeMarker(p.display_name, type); save(); 
        }; 
        sugg.appendChild(d); 
    }); 
    sugg.style.display = 'block'; 
}

async function placeMarker(query, type) { 
    try { 
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`); 
        const data = await res.json(); 
        if(data.length > 0) { 
            if(markers[type]) map.removeLayer(markers[type]); 
            markers[type] = L.marker([data[0].lat, data[0].lon]).addTo(map).bindPopup(query); 
            map.flyTo([data[0].lat, data[0].lon], type === 'end' ? 12 : 6); 
        } 
    } catch(e) {} 
}

async function restoreMapMarkers() { 
    const start = document.getElementById('cityStart').value; 
    const end = document.getElementById('cityEnd').value; 
    if(start) placeMarker(start, 'start'); 
    if(end) placeMarker(end, 'end'); 
}

function delB(id) { tripData[activeDay] = tripData[activeDay].filter(x => x.id !== id); renderBlocks(); save(); }

// 8. FONCTIONS ANNEXES
function toggleLang() {
    currentLang = currentLang === 'fr' ? 'en' : 'fr';
    applyLang(); generateTimeline(); save();
}

function initDates() { 
    const start = document.getElementById('dateStart').value; 
    if(start) { 
        let next = new Date(start); 
        next.setDate(next.getDate() + 1); 
        document.getElementById('dateEnd').value = next.toISOString().split('T')[0]; 
        generateTimeline(); 
    } 
}

function applyLang() { 
    const texts = { 
        fr: { title: "Explorez le monde ✈️", subtitle: "Préparez votre itinéraire sur-mesure", start: "DÉPART", end: "ARRIVÉE", from: "DU", to: "AU", cur: "DEVISE", total: "TOTAL DU VOYAGE", budget: "Budget estimé :", pdf: "📄 Télécharger en PDF", vol: "Chercher Vol / Transport (Skyscanner)", hotel: "Chercher Hôtel (Booking)", activ: "Activités & Visites", resto: "Restaurants & Cafés", pax: "VOYAGEURS" }, 
        en: { title: "Explore the World ✈️", subtitle: "Plan your custom itinerary", start: "FROM", end: "TO", from: "START", to: "END", cur: "CURRENCY", total: "TRIP TOTAL", budget: "Estimated budget:", pdf: "📄 Download PDF", vol: "Search Flights / Transit (Skyscanner)", hotel: "Search Hotels (Booking)", activ: "Activities & Tours", resto: "Restaurants & Cafes", pax: "TRAVELERS" } 
    }; 
    const t = texts[currentLang]; 
    document.getElementById('txt-title').innerText = t.title; 
    document.getElementById('txt-subtitle').innerText = t.subtitle; 
    document.getElementById('lbl-start').innerText = t.start; 
    document.getElementById('lbl-end').innerText = t.end; 
    document.getElementById('lbl-from').innerText = t.from; 
    document.getElementById('lbl-to').innerText = t.to; 
    document.getElementById('lbl-cur').innerText = t.cur; 
    document.getElementById('lbl-pax').innerText = t.pax; 
    document.getElementById('txt-total-lbl').innerText = t.total; 
    document.getElementById('txt-budget-lbl').innerText = t.budget; 
    document.getElementById('btn-pdf').innerText = t.pdf; 
    document.querySelectorAll('.t-vol').forEach(el => el.innerText = t.vol); 
    document.querySelectorAll('.t-hotel').forEach(el => el.innerText = t.hotel); 
    document.querySelectorAll('.t-activ').forEach(el => el.innerText = t.activ); 
    document.querySelectorAll('.t-resto').forEach(el => el.innerText = t.resto);
    renderBlocks(); 
}

function toggleFocus() {
    const isHidden = document.body.classList.toggle('header-hidden');
    const icon = document.getElementById('focus-icon');
    const text = document.getElementById('focus-text');
    icon.innerText = isHidden ? "🔽" : "🔼";
    if (text) text.innerText = isHidden ? (currentLang === 'fr' ? "Afficher l'en-tête" : "Show Header") : (currentLang === 'fr' ? "Masquer l'en-tête" : "Hide Header");
    setTimeout(() => { map.invalidateSize(); }, 300);
}

function clearAll() { if(confirm("Tout effacer ?")) { localStorage.clear(); location.reload(); } }

function downloadData() {
    const data = { tripData, settings: { cityStart: document.getElementById('cityStart').value, cityEnd: document.getElementById('cityEnd').value, dateStart: document.getElementById('dateStart').value, dateEnd: document.getElementById('dateEnd').value, budgetMax: document.getElementById('budgetMax').value, currency: document.getElementById('currency').value, pax: document.getElementById('pax').value, polarstepsUrl: document.getElementById('polarstepsUrl').value } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Voyage.json`; a.click();
}

function exportPDF() { html2pdf().from(document.body).save('Itineraire.pdf'); }
