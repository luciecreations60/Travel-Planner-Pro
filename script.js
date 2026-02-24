let activeDay = 1;
let currentLang = localStorage.getItem('lang') || 'fr';
let tripData = JSON.parse(localStorage.getItem('travelPlannerData')) || {};
let map;
let markers = {};

function initMap(center = [46, 2], zoom = 3) {
    if(map) map.remove();
    map = L.map('map').setView(center, zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);
}

window.onload = () => {
    ['dateStart', 'dateEnd', 'cityStart', 'cityEnd', 'currency', 'budgetMax', 'pax'].forEach(f => { 
        if(localStorage.getItem(f)) document.getElementById(f).value = localStorage.getItem(f); 
    });
    initMap(); applyLang(); generateTimeline(); restoreMapMarkers();
};

function save() {
    localStorage.setItem('travelPlannerData', JSON.stringify(tripData));
    ['dateStart', 'dateEnd', 'cityStart', 'cityEnd', 'currency', 'budgetMax', 'pax'].forEach(f => {
        let el = document.getElementById(f); if(el) localStorage.setItem(f, el.value);
    });
    localStorage.setItem('lang', currentLang);
    updateTotal();
}

function saveAndRefresh() { save(); updateTotal(); }

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

function searchAPI(type, query) {
    const dest = document.getElementById('cityEnd').value.split(',')[0] || "Destination";
    const startDateStr = document.getElementById('dateStart').value;
    const travelers = document.getElementById('pax').value;
    if (type === 'hotel') {
        let checkin = startDateStr || new Date().toISOString().split('T')[0];
        let d = new Date(checkin); d.setDate(d.getDate() + 1);
        let checkout = d.toISOString().split('T')[0];
        const q = encodeURIComponent(query || dest);
        window.open(`https://www.booking.com/searchresults.fr.html?ss=${q}&ssne=${q}&ssne_untouched=${q}&checkin=${checkin}&checkout=${checkout}&group_adults=${travelers}`, '_blank');
    } else {
        window.open(`https://www.skyscanner.fr/transport/vols/${encodeURIComponent(query || 'CDG')}/`, '_blank');
    }
}

function toggleLang() {
    currentLang = currentLang === 'fr' ? 'en' : 'fr';
    applyLang(); generateTimeline(); save();
}

function initDates() { const start = document.getElementById('dateStart').value; if(start) { let next = new Date(start); next.setDate(next.getDate() + 1); document.getElementById('dateEnd').value = next.toISOString().split('T')[0]; generateTimeline(); } }
function updateDayTitle() { document.getElementById('currentDayTitle').innerText = (currentLang === 'fr' ? 'Jour ' : 'Day ') + activeDay; }
function addBlock(type) { tripData[activeDay].push({ id: Date.now(), type, name: '', price: 0, time: '00:00', address: '', bookingUrl: '', notes: '' }); renderBlocks(); save(); }
async function restoreMapMarkers() { const start = document.getElementById('cityStart').value; const end = document.getElementById('cityEnd').value; if(start) placeMarker(start, 'start'); if(end) placeMarker(end, 'end'); }

async function placeMarker(query, type) { 
    try { 
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&accept-language=${currentLang}&q=${encodeURIComponent(query)}&limit=1`); 
        const data = await res.json(); 
        if(data.length > 0) { 
            if(markers[type]) map.removeLayer(markers[type]); 
            markers[type] = L.marker([data[0].lat, data[0].lon]).addTo(map).bindPopup(query); 
            map.flyTo([data[0].lat, data[0].lon], type === 'hotel' ? 14 : 6); 
        } 
    } catch(e) {} 
}

function renderBlocks() { 
    const list = document.getElementById('blocksList'); 
    list.innerHTML = ""; 
    const cur = document.getElementById('currency').value; 
    document.querySelectorAll('.cur-symbol').forEach(el => el.innerText = cur); 
    (tripData[activeDay] || []).sort((a,b) => a.time.localeCompare(b.time)).forEach(b => { 
        let div = document.createElement('div'); 
        div.className = `trip-block block-${b.type}`; 
        let extra = b.type === 'hotel' ? `<div class="hotel-extra-fields"><div class="full-width"><input type="text" placeholder="Lien" value="${b.bookingUrl || ''}" onchange="updateB(${b.id}, 'bookingUrl', this.value)"></div><div><input type="text" placeholder="Adresse" value="${b.address || ''}" onchange="updateB(${b.id}, 'address', this.value)"></div><div><input type="text" placeholder="Notes" value="${b.notes || ''}" onchange="updateB(${b.id}, 'notes', this.value)"></div></div>` : ''; 
        div.innerHTML = `<div class="block-main"><input type="time" class="time-input" value="${b.time}" onchange="updateB(${b.id}, 'time', this.value)"><div style="font-size:1.3rem">${b.type==='vol'?'✈️':b.type==='hotel'?'🏨':'🎟️'}</div><input type="text" style="flex:1; font-weight:bold;" placeholder="Nom" value="${b.name}" onchange="updateB(${b.id}, 'name', this.value)"><input type="number" class="price-input" value="${b.price}" oninput="updateB(${b.id}, 'price', this.value)">${cur}<button class="btn-api" onclick="searchAPI('${b.type}', '${b.name}')">🔍 ${currentLang === 'fr' ? 'Chercher' : 'Search'}</button><button onclick="delB(${b.id})" style="border:none; background:none; cursor:pointer; color:#cbd5e1; font-size:1.2rem;">✕</button></div>${extra}`; 
        list.appendChild(div); 
    }); 
    updateTotal(); 
}

async function updateB(id, f, v) { 
    let block = tripData[activeDay].find(x => x.id === id); 
    if(!block) return; 
    block[f] = f === 'price' ? parseFloat(v) : v; 
    if(f === 'bookingUrl' && v.includes('booking.com')) { 
        try { 
            const url = new URL(v); 
            let path = url.pathname.split('/'); 
            let hotelPart = path[path.length - 1].replace('.fr.html', '').replace('.html', '').split('?')[0]; 
            if (hotelPart) block.name = hotelPart.split('-').filter(w => !['hotel','fr','en'].includes(w)).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); 
            let city = url.searchParams.get('ss') || document.getElementById('cityEnd').value; 
            if(block.name) placeMarker(block.name + ', ' + city, 'hotel'); 
            renderBlocks(); 
        } catch(e) {} 
    } 
    if(f === 'time') renderBlocks(); 
    save(); 
}

function updateTotal() { 
    let total = 0; 
    let stats = { vol: 0, hotel: 0, activ: 0 };
    const cur = document.getElementById('currency').value;
    Object.values(tripData).forEach(dayBlocks => {
        dayBlocks.forEach(b => {
            let p = parseFloat(b.price) || 0;
            total += p;
            if(stats[b.type] !== undefined) stats[b.type] += p;
        });
    });
    const totalEl = document.getElementById('totalLabel');
    const budgetMax = parseFloat(document.getElementById('budgetMax').value) || 0; 
    const alertEl = document.getElementById('alertLimit'); 
    totalEl.innerText = total.toFixed(2) + cur; 
    if (budgetMax > 0 && total > budgetMax) { totalEl.style.color = "#f87171"; alertEl.style.display = "block"; } 
    else { totalEl.style.color = "var(--accent-2)"; alertEl.style.display = "none"; } 
    const recapList = document.getElementById('recap-list');
    const labels = currentLang === 'fr' ? { vol: 'Vols', hotel: 'Hébergements', activ: 'Activités' } : { vol: 'Flights', hotel: 'Stays', activ: 'Activities' };
    recapList.innerHTML = `
        <div class="recap-item"><small><span class="recap-dot" style="background:#6366f1"></span>${labels.vol}</small> <span>${stats.vol}${cur}</span></div>
        <div class="recap-item"><small><span class="recap-dot" style="background:#f59e0b"></span>${labels.hotel}</small> <span>${stats.hotel}${cur}</span></div>
        <div class="recap-item"><small><span class="recap-dot" style="background:#ec4899"></span>${labels.activ}</small> <span>${stats.activ}${cur}</span></div>
    `;
}

async function handleSearch(q, type) { 
    const sugg = document.getElementById(type === 'start' ? 'suggestionsStart' : 'suggestionsEnd'); 
    if(q.length < 3) return; 
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

function delB(id) { tripData[activeDay] = tripData[activeDay].filter(x => x.id !== id); renderBlocks(); save(); }

function applyLang() { 
    const texts = { 
        fr: { title: "Explorez le monde ✈️", subtitle: "Créez votre itinéraire sur-mesure et maîtrisez chaque dépense", start: "DÉPART", end: "ARRIVÉE", from: "DU", to: "AU", cur: "DEVISE", total: "TOTAL DU VOYAGE", budget: "Budget estimé :", pdf: "📄 Télécharger en PDF", vol: "Vol", hotel: "Hôtel", activ: "Activité", alert: "⚠️ Budget dépassé !", pax: "VOYAGEURS" }, 
        en: { title: "Explore the World ✈️", subtitle: "Create your custom itinerary and master every expense", start: "FROM", end: "TO", from: "START", to: "END", cur: "CURRENCY", total: "TRIP TOTAL", budget: "Estimated budget:", pdf: "📄 Download PDF", vol: "Flight", hotel: "Hotel", activ: "Activity", alert: "⚠️ Budget exceeded!", pax: "TRAVELERS" } 
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
    document.getElementById('alertLimit').innerText = t.alert; 
    document.querySelectorAll('.t-vol').forEach(el => el.innerText = t.vol); 
    document.querySelectorAll('.t-hotel').forEach(el => el.innerText = t.hotel); 
    document.querySelectorAll('.t-activ').forEach(el => el.innerText = t.activ); 
    renderBlocks(); 
}

function toggleFocus() {
    const isHidden = document.body.classList.toggle('header-hidden');
    const icon = document.getElementById('focus-icon');
    const text = document.getElementById('focus-text');
    icon.innerText = isHidden ? "🔽" : "🔼";
    text.innerText = isHidden ? (currentLang === 'fr' ? "Afficher l'en-tête" : "Show Header") : (currentLang === 'fr' ? "Masquer l'en-tête" : "Hide Header");
    setTimeout(() => { map.invalidateSize(); }, 300);
}

function clearAll() { if(confirm(currentLang === 'fr' ? "Tout effacer ?" : "Clear all?")) { localStorage.clear(); location.reload(); } }

function downloadData() {
    const data = { tripData, settings: { cityStart: document.getElementById('cityStart').value, cityEnd: document.getElementById('cityEnd').value, dateStart: document.getElementById('dateStart').value, dateEnd: document.getElementById('dateEnd').value, budgetMax: document.getElementById('budgetMax').value, currency: document.getElementById('currency').value, pax: document.getElementById('pax').value } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Voyage.json`; a.click();
}

function importData(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            tripData = imported.tripData;
            Object.keys(imported.settings).forEach(key => { if(document.getElementById(key)) document.getElementById(key).value = imported.settings[key]; });
            save(); location.reload();
        } catch (err) { alert("Erreur."); }
    };
    reader.readAsText(file);
}


function exportPDF() { html2pdf().from(document.body).save('Itineraire.pdf'); }

async function findRestaurants() {
    // On récupère la position du marqueur de destination
    if (!markers['end']) {
        alert(currentLang === 'fr' ? "Veuillez d'abord choisir une destination." : "Please select a destination first.");
        return;
    }
    const lat = markers['end'].getLatLng().lat;
    const lng = markers['end'].getLatLng().lng;

    // Requête Overpass : cherche les "amenity=restaurant" autour de ces coordonnées
    const query = `[out:json];node["amenity"~"restaurant|cafe"](around:1500,${lat},${lng});out;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.elements.length === 0) {
            alert("Aucun restaurant trouvé à proximité.");
            return;
        }

        // On prend les 5 premiers résultats et on les ajoute comme activités
        data.elements.slice(0, 5).forEach(item => {
            const name = item.tags.name || "Restaurant";
            const cuisine = item.tags.cuisine ? ` (${item.tags.cuisine})` : "";
            
            tripData[activeDay].push({
                id: Date.now() + Math.random(),
                type: 'activ',
                name: `🍴 ${name}${cuisine}`,
                price: 0,
                time: '12:00',
                address: '',
                bookingUrl: '',
                notes: 'Trouvé via OpenStreetMap'
            });
        });

        renderBlocks();
        save();
    } catch (error) {
        console.error("Erreur Overpass:", error);
    }
}


