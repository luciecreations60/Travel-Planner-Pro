let activeDay = 1;
let currentLang = localStorage.getItem('lang') || 'fr';
let tripData = JSON.parse(localStorage.getItem('travelPlannerData')) || {};
let map;
let markers = {};
let itemMarkers = [];
let draggedItemIndex = null;

// 1. INITIALISATION CARTE LEAFLET
function initMap(center = [46, 2], zoom = 3) {
    if(map) map.remove();
    map = L.map('map').setView(center, zoom);
    
    const isDark = localStorage.getItem('darkMode') === 'true';
    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, { attribution: '&copy; OpenStreetMap' }).addTo(map);
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

// 2. MODE SOMBRE
function toggleDarkMode() {
    const body = document.body;
    const isDark = body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark);
    
    const btn = document.getElementById('dark-btn');
    if(btn) btn.innerText = isDark ? "☀️" : "🌙";

    const tileUrl = isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    
    L.tileLayer(tileUrl, { attribution: '&copy; OpenStreetMap' }).addTo(map);
}

// 3. SAUVEGARDE & CALCULS
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
        <div class="recap-item"><small><span class="recap-dot" style="background:var(--vol-color)"></span>Vols / Transports</small> <span>${stats.vol.toFixed(2)}${cur}</span></div>
        <div class="recap-item"><small><span class="recap-dot" style="background:var(--hotel-color)"></span>Hébergements</small> <span>${stats.hotel.toFixed(2)}${cur}</span></div>
        <div class="recap-item"><small><span class="recap-dot" style="background:var(--activ-color)"></span>Activités</small> <span>${stats.activ.toFixed(2)}${cur}</span></div>
        <div class="recap-item"><small><span class="recap-dot" style="background:var(--resto-color)"></span>Restaurants</small> <span>${stats.resto.toFixed(2)}${cur}</span></div>
    `;

    // Équilibre des comptes
    const splitDiv = document.getElementById('split-summary');
    splitDiv.innerHTML = "";

    if (Object.keys(paidByPerson).length === 0) {
        splitDiv.innerHTML = `<small style="color:var(--text-muted);">Aucune dépense enregistrée.</small>`;
    } else {
        Object.entries(paidByPerson).forEach(([person, amount]) => {
            let diff = amount - perPerson;
            let statusColor = diff >= 0 ? "#10b981" : "#ef4444";
            let statusText = diff >= 0 ? `+${diff.toFixed(2)}${cur}` : `${diff.toFixed(2)}${cur}`;

            splitDiv.innerHTML += `
                <div style="display:flex; justify-content:space-between;">
                    <span><strong>${person}</strong> (${amount.toFixed(2)}${cur})</span>
                    <span style="color:${statusColor}; font-weight:bold;">${statusText}</span>
                </div>
            `;
        });
    }

    const polarUrl = document.getElementById('polarstepsUrl').value;
    const polarBtn = document.getElementById('btnPolarsteps');
    if (polarUrl) { polarBtn.href = polarUrl; polarBtn.style.display = "inline-block"; } 
    else { polarBtn.style.display = "none"; }
}

// 4. RECHERCHE CORRIGÉE AVEC DEUX NIVEAUX DE SECOURS (N'EST PLUS JAMAIS VIDE)
async function searchPlacesInApp() {
    const rawQuery = document.getElementById('wanderQuery').value;
    const query = rawQuery.trim().toLowerCase();
    const cityEnd = document.getElementById('cityEnd').value.trim();

    if (!query) return;

    const panel = document.getElementById('search-results-panel');
    const list = document.getElementById('results-list');
    panel.style.display = 'block';
    list.innerHTML = `<div style="display:flex; align-items:center; gap:8px; padding:10px;"><div class="spinner"></div> Recherche en cours...</div>`;

    let data = [];

    // Tentative 1 : Recherche combinée (Lieu + Ville)
    try {
        const searchQuery = cityEnd ? `${query}, ${cityEnd}` : query;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&accept-language=${currentLang}&q=${encodeURIComponent(searchQuery)}&limit=5`);
        data = await res.json();
    } catch(e) {}

    // Tentative 2 (Fallback) : Recherche du terme seul si la tentative 1 est vide
    if (!data || data.length === 0) {
        try {
            const resFallback = await fetch(`https://nominatim.openstreetmap.org/search?format=json&accept-language=${currentLang}&q=${encodeURIComponent(query)}&limit=5`);
            data = await resFallback.json();
        } catch(e) {}
    }

    list.innerHTML = "";

    // Si vraiment aucun résultat n'a été trouvé, on propose de créer le lieu manuellement
    if (!data || data.length === 0) {
        let typeDetected = 'activ';
        if (query.includes('resto') || query.includes('manger') || query.includes('cafe')) typeDetected = 'resto';
        else if (query.includes('hotel') || query.includes('logement')) typeDetected = 'hotel';
        else if (query.includes('vol') || query.includes('gare')) typeDetected = 'vol';

        list.innerHTML = `
            <div style="padding:10px; font-size:0.85rem; color:var(--text-muted);">
                Aucun lieu exact trouvé sur la carte pour "${rawQuery}".
            </div>
            <div class="place-card-result">
                <div>
                    <strong style="font-size:0.85rem;">${rawQuery}</strong><br>
                    <small style="color:var(--text-muted);">Créer un bloc personnalisé</small>
                </div>
                <button class="btn-main" style="width:auto; padding:6px 12px; font-size:0.75rem; background:var(--accent);" onclick="addBlock('${typeDetected}', '${rawQuery.replace(/'/g, "\\'")}')">
                    + Ajouter
                </button>
            </div>
        `;
        return;
    }

    // Affichage des résultats
    data.forEach(place => {
        let typeDetected = 'activ';
        if (place.type === 'restaurant' || place.type === 'cafe' || place.type === 'fast_food') typeDetected = 'resto';
        else if (place.type === 'hotel' || place.type === 'guest_house' || place.type === 'hostel') typeDetected = 'hotel';
        else if (place.type === 'aeroway' || place.type === 'station') typeDetected = 'vol';

        const placeTitle = place.display_name.split(',')[0];
        const placeSub = place.display_name.split(',').slice(1, 3).join(',');

        let div = document.createElement('div');
        div.className = "place-card-result";
        div.innerHTML = `
            <div style="flex:1; padding-right:10px;">
                <strong style="font-size:0.85rem; display:block;">${placeTitle}</strong>
                <small style="font-size:0.75rem; color:var(--text-muted);">${placeSub}</small>
            </div>
            <button class="btn-main" style="width:auto; padding:6px 12px; font-size:0.75rem; background:var(--accent);" onclick="addBlock('${typeDetected}', '${placeTitle.replace(/'/g, "\\'")}', ${place.lat}, ${place.lon})">
                + Ajouter
            </button>
        `;
        list.appendChild(div);
    });
}

// Filtres rapides pour la recherche automatique par catégorie
async function filterPlaces(type) {
    if (type === 'vol') document.getElementById('wanderQuery').value = "Gare";
    else if (type === 'hotel') document.getElementById('wanderQuery').value = "Hôtel";
    else if (type === 'activ') document.getElementById('wanderQuery').value = "Musée";
    else if (type === 'resto') document.getElementById('wanderQuery').value = "Restaurant";

    searchPlacesInApp();
}

function closeResults() {
    document.getElementById('search-results-panel').style.display = 'none';
}

// 5. TIMELINE ET GESTION DES BLOCS
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
        lat: lat ? parseFloat(lat) : null,
        lon: lon ? parseFloat(lon) : null
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
        
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="cursor:grab; font-size:1.1rem; color:var(--text-muted);" title="Glisser pour déplacer">☰</span>
                <input type="time" style="width:75px" value="${b.time}" onchange="updateB(${b.id}, 'time', this.value)">
                <div style="font-size:1.2rem">${icon}</div>
                <input type="text" style="flex:1; font-weight:bold;" value="${b.name}" placeholder="Nom du lieu" onchange="updateB(${b.id}, 'name', this.value)">
                <input type="number" style="width:65px" value="${b.price}" oninput="updateB(${b.id}, 'price', this.value)">${cur}
                <button onclick="delB(${b.id})" style="border:none; background:none; cursor:pointer; color:var(--text-muted);">✕</button>
            </div>
            <div style="margin-top:8px; display:flex; gap:10px;">
                <input type="text" placeholder="${currentLang === 'fr' ? 'Notes / Adresse' : 'Notes / Address'}" value="${b.notes || ''}" style="flex:1;" onchange="updateB(${b.id}, 'notes', this.value)">
                <input type="text" placeholder="Payé par" value="${b.paidBy || 'Moi'}" style="width:90px;" onchange="updateB(${b.id}, 'paidBy', this.value)">
            </div>
        `; 

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

// 6. GESTION DES MARQUEURS SUR LA CARTE
function updateMapMarkers() {
    itemMarkers.forEach(m => map.removeLayer(m));
    itemMarkers = [];

    (tripData[activeDay] || []).forEach(b => {
        if (b.lat && b.lon) {
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lon}`;
            const popupContent = `
                <div style="font-family:sans-serif; text-align:center;">
                    <strong style="font-size:0.95rem;">${b.name}</strong><br>
                    <small>${b.notes || ''}</small><br><br>
                    <a href="${googleMapsUrl}" target="_blank" style="background:#3b82f6; color:white; padding:4px 8px; border-radius:6px; text-decoration:none; font-size:0.75rem;">
                        🗺️ Voir dans Google Maps
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

// 7. FONCTIONS ANNEXES
function toggleLang() { currentLang = currentLang === 'fr' ? 'en' : 'fr'; applyLang(); generateTimeline(); save(); }

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
        fr: { title: "Explorez le monde ✈️", subtitle: "Préparez votre itinéraire sur-mesure", start: "DÉPART", end: "ARRIVÉE", from: "DU", to: "AU", cur: "DEVISE", total: "TOTAL DU VOYAGE", budget: "Budget estimé :", pdf: "📄 Télécharger en PDF", pax: "VOYAGEURS" }, 
        en: { title: "Explore the World ✈️", subtitle: "Plan your custom itinerary", start: "FROM", end: "TO", from: "START", to: "END", cur: "CURRENCY", total: "TRIP TOTAL", budget: "Estimated budget:", pdf: "📄 Download PDF", pax: "TRAVELERS" } 
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
