// admin-script.js
import { auth, db } from './firebase-init.js';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

const ALL_TRIP_TYPES = [
    "בטן גב", "נופים וטבע", "עיר אירופאית", "ארצות הברית", "מזרח רחוק",
    "שווקי קריסמס", "סקי", "טרקים", "קרוז", "ספארי", "ירח דבש", "משפחות"
];

document.addEventListener('DOMContentLoaded', function () {
    // --- DOM Elements ---
    const loginSection = document.getElementById('admin-login');
    const dashboardSection = document.getElementById('admin-dashboard');
    const loginButton = document.getElementById('login-button');
    const adminEmailInput = document.getElementById('admin-email');
    const adminPasswordInput = document.getElementById('admin-password');
    const loginError = document.getElementById('login-error');
    const adminUserEmailEl = document.getElementById('admin-user-email');
    const logoutButton = document.getElementById('logout-button');
    const adminDealsOutput = document.getElementById('admin-deals-output');
    const dealsCollectionRef = collection(db, 'deals');

    const packageModal = document.getElementById('package-deal-modal');
    const flightModal = document.getElementById('flight-deal-modal');
    const hotelModal = document.getElementById('hotel-deal-modal');
    const addDealChoiceModal = document.getElementById('add-deal-choice-modal');
    const aiPasteModal = document.getElementById('ai-paste-modal');

    const openAddDealChoiceModalBtn = document.getElementById('open-add-deal-choice-modal-btn');
    const openFlightModalBtn = document.getElementById('open-flight-deal-modal-btn');
    const openHotelModalBtn = document.getElementById('open-hotel-deal-modal-btn');
    const addDealManuallyBtn = document.getElementById('add-deal-manually-btn');
    const addDealAiPasteBtn = document.getElementById('add-deal-ai-paste-btn');

    const closeButtons = document.querySelectorAll('.close-modal-btn');

    const packageDealForm = document.getElementById('package-deal-form');
    const packageDealIdInput = document.getElementById('package-deal-id');
    const packageModalTitle = document.getElementById('package-modal-title');
    const packageSaveButton = document.getElementById('package-save-button');

    const flightDealForm = document.getElementById('flight-deal-form');
    const flightDealIdInput = document.getElementById('flight-deal-id');
    const flightModalTitle = document.getElementById('flight-modal-title');
    const flightSaveButton = document.getElementById('flight-save-button');

    const hotelDealForm = document.getElementById('hotel-deal-form');
    const hotelDealIdInput = document.getElementById('hotel-deal-id');
    const hotelModalTitle = document.getElementById('hotel-modal-title');
    const hotelSaveButton = document.getElementById('hotel-save-button');

    const aiPasteForm = document.getElementById('ai-paste-form');
    const aiTextInput = document.getElementById('ai-text-input');

    const packageTripTypesContainer = document.getElementById('package-trip-types-checkboxes');
    const hotelTripTypesContainer = document.getElementById('hotel-trip-types-checkboxes');

    // Populate trip-type checkboxes
    if (packageTripTypesContainer) populateCheckboxes(packageTripTypesContainer, ALL_TRIP_TYPES, 'packageTripType');
    if (hotelTripTypesContainer) populateCheckboxes(hotelTripTypesContainer, ALL_TRIP_TYPES, 'hotelTripType');

    // Modal open/close
    function openModal(modalElement) {
        if (modalElement) {
            document.body.style.overflow = 'hidden';
            modalElement.style.display = 'flex';
            setTimeout(() => modalElement.classList.add('active'), 10);
        }
    }
    function closeModal(modalElement) {
        if (modalElement) {
            modalElement.classList.remove('active');
            document.body.style.overflow = '';
            setTimeout(() => {
                if (!modalElement.classList.contains('active')) {
                    modalElement.style.display = 'none';
                }
            }, 350);
        }
    }

    // Open/close button listeners
    if (openAddDealChoiceModalBtn) openAddDealChoiceModalBtn.addEventListener('click', () => openModal(addDealChoiceModal));
    if (addDealManuallyBtn) addDealManuallyBtn.addEventListener('click', () => {
        closeModal(addDealChoiceModal);
        resetPackageForm();
        openModal(packageModal);
    });
    if (addDealAiPasteBtn) addDealAiPasteBtn.addEventListener('click', () => {
        closeModal(addDealChoiceModal);
        if (aiTextInput) aiTextInput.value = '';
        openModal(aiPasteModal);
    });
    if (openFlightModalBtn) openFlightModalBtn.addEventListener('click', () => {
        resetFlightForm();
        openModal(flightModal);
    });
    if (openHotelModalBtn) openHotelModalBtn.addEventListener('click', () => {
        resetHotelForm();
        openModal(hotelModal);
    });
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modalId;
            closeModal(document.getElementById(modalId));
        });
    });
    window.addEventListener('click', event => {
        if (event.target.classList.contains('modal') && event.target.classList.contains('active')) {
            closeModal(event.target);
        }
    });

    // Helper: populate checkboxes
    function populateCheckboxes(container, options, groupName) {
        container.innerHTML = '';
        options.forEach(option => {
            const checkboxId = `${groupName}-${option.replace(/\s+/g, '-')}`;
            const div = document.createElement('div');
            div.innerHTML = `<input type="checkbox" id="${checkboxId}" name="${groupName}" value="${option}"><label for="${checkboxId}">${option}</label>`;
            container.appendChild(div);
        });
    }

    // --- Package: dynamic hotel entries ---
    const packageHotelsContainer = document.getElementById('package-hotels-container');
    const addPackageHotelBtn = document.getElementById('add-package-hotel-btn');
    let packageHotelFieldCount = 0;
    if (addPackageHotelBtn) addPackageHotelBtn.addEventListener('click', () => addHotelFieldToPackage());

    function addHotelFieldToPackage(hotelData = null) {
        if (!packageHotelsContainer) return;
        packageHotelFieldCount++;
        const suffix = `_h${packageHotelFieldCount}`;
        const bookingData = hotelData?.affiliateLinks?.booking || {};
        const agodaData = hotelData?.affiliateLinks?.agoda || {};
        const expediaData = hotelData?.affiliateLinks?.expedia || {};

        const div = document.createElement('div');
        div.className = 'hotel-entry';
        div.innerHTML = `
            <h5>מלון <span class="hotel-number">${packageHotelsContainer.children.length + 1}</span></h5>
            <input type="hidden" class="hotel-entry-field-suffix" value="${suffix}">
            <div class="form-group">
                <label for="p-hotel-name${suffix}">שם המלון:</label>
                <input type="text" id="p-hotel-name${suffix}" value="${hotelData?.name || ''}" required>
            </div>
            <div class="form-group">
                <label for="p-hotel-stars${suffix}">כוכבים (1-5):</label>
                <select id="p-hotel-stars${suffix}">
                    <option value="">לא צוין</option>
                    <option value="1" ${hotelData?.stars == '1' ? 'selected' : ''}>⭐</option>
                    <option value="2" ${hotelData?.stars == '2' ? 'selected' : ''}>⭐⭐</option>
                    <option value="3" ${hotelData?.stars == '3' ? 'selected' : ''}>⭐⭐⭐</option>
                    <option value="4" ${hotelData?.stars == '4' ? 'selected' : ''}>⭐⭐⭐⭐</option>
                    <option value="5" ${hotelData?.stars == '5' ? 'selected' : ''}>⭐⭐⭐⭐⭐</option>
                </select>
            </div>
            ${hotelData?.packagePriceWithHotel ? `<div class="form-group"><label>מחיר חבילה עם מלון זה:</label><input type="text" disabled readonly value="${hotelData.packagePriceWithHotel}"></div>` : ''}

            <h6>Booking.com:</h6>
            <div class="form-group"><label for="p-hotel-booking-dealurl${suffix}">קישור לדיל:</label><input type="text" id="p-hotel-booking-dealurl${suffix}" value="${bookingData.dealUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-booking-imageurl${suffix}">קישור לתמונה:</label><input type="text" id="p-hotel-booking-imageurl${suffix}" value="${bookingData.imageUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-booking-combinedhtml${suffix}">קוד HTML (קישור+תמונה):</label><textarea id="p-hotel-booking-combinedhtml${suffix}" rows="2">${bookingData.combinedHtml || ''}</textarea></div>
            <div class="form-group"><label for="p-hotel-booking-extrahtml${suffix}">קוד HTML (מפה/באנר):</label><textarea id="p-hotel-booking-extrahtml${suffix}" rows="2">${bookingData.extraHtml || ''}</textarea></div>

            <h6>Agoda:</h6>
            <div class="form-group"><label for="p-hotel-agoda-dealurl${suffix}">קישור לדיל:</label><input type="text" id="p-hotel-agoda-dealurl${suffix}" value="${agodaData.dealUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-agoda-imageurl${suffix}">קישור לתמונה:</label><input type="text" id="p-hotel-agoda-imageurl${suffix}" value="${agodaData.imageUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-agoda-combinedhtml${suffix}">קוד HTML (קישור+תמונה):</label><textarea id="p-hotel-agoda-combinedhtml${suffix}" rows="2">${agodaData.combinedHtml || ''}</textarea></div>
            <div class="form-group"><label for="p-hotel-agoda-extrahtml${suffix}">קוד HTML (מפה/באנר):</label><textarea id="p-hotel-agoda-extrahtml${suffix}" rows="2">${agodaData.extraHtml || ''}</textarea></div>

            <h6>Expedia:</h6>
            <div class="form-group"><label for="p-hotel-expedia-dealurl${suffix}">קישור לדיל:</label><input type="text" id="p-hotel-expedia-dealurl${suffix}" value="${expediaData.dealUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-expedia-imageurl${suffix}">קישור לתמונה:</label><input type="text" id="p-hotel-expedia-imageurl${suffix}" value="${expediaData.imageUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-expedia-combinedhtml${suffix}">קוד HTML (קישור+תמונה):</label><textarea id="p-hotel-expedia-combinedhtml${suffix}" rows="2">${expediaData.combinedHtml || ''}</textarea></div>
            <div class="form-group"><label for="p-hotel-expedia-extrahtml${suffix}">קוד HTML (מפה/באנר):</label><textarea id="p-hotel-expedia-extrahtml${suffix}" rows="2">${expediaData.extraHtml || ''}</textarea></div>

            <button type="button" class="remove-hotel-btn">הסר מלון זה</button>
        `;
        packageHotelsContainer.appendChild(div);
        div.querySelector('.remove-hotel-btn').addEventListener('click', () => {
            div.remove();
            packageHotelsContainer.querySelectorAll('.hotel-number').forEach((el, idx) => el.textContent = idx + 1);
        });
    }

    // --- Authentication state ---
    onAuthStateChanged(auth, user => {
        if (user) {
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            adminUserEmailEl.textContent = user.email;
            loadAdminDeals();
        } else {
            loginSection.style.display = 'block';
            dashboardSection.style.display = 'none';
            adminUserEmailEl.textContent = '';
            adminDealsOutput.innerHTML = '<p style="text-align:center;">יש להתחבר כדי לראות ולנהל פריטים.</p>';
        }
    });

    // --- Login ---
    if (loginButton && adminEmailInput && adminPasswordInput) {
        loginButton.addEventListener('click', () => {
            const email = adminEmailInput.value.trim();
            const password = adminPasswordInput.value;
            loginError.textContent = '';
            if (!email || !password) {
                loginError.textContent = "אנא הזן אימייל וסיסמה.";
                return;
            }
            loginButton.disabled = true;
            loginButton.textContent = 'מתחבר...';
            signInWithEmailAndPassword(auth, email, password)
                .catch(error => {
                    let msg = "שגיאת התחברות. ";
                    switch (error.code) {
                        case 'auth/invalid-email': msg += "כתובת האימייל אינה תקינה."; break;
                        case 'auth/user-disabled': msg += "המשתמש נחסם."; break;
                        case 'auth/user-not-found': case 'auth/invalid-credential': msg += "אימייל או סיסמה שגויים."; break;
                        case 'auth/wrong-password': msg += "סיסמה שגויה."; break;
                        default: msg += error.code;
                    }
                    loginError.textContent = msg;
                })
                .finally(() => {
                    loginButton.disabled = false;
                    loginButton.textContent = 'התחבר';
                });
        });
    }

    // --- Logout ---
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).catch(err => console.error('Sign out error:', err));
        });
    }

    // --- Helpers for affiliate HTML parsing ---
    function extractAffiliateDataFromHtml(html) {
        if (!html) return { linkUrl: null, imageUrl: null, rawHtml: html };
        const div = document.createElement('div');
        div.innerHTML = html;
        const a = div.querySelector('a');
        const img = a ? a.querySelector('img') : div.querySelector('img');
        return {
            linkUrl: a?.href || null,
            imageUrl: img?.src || null,
            rawHtml: html
        };
    }

    function collectAffiliateProviderData(formOrEntry, prefix, suffix = '') {
        let dealUrl = formOrEntry.querySelector(`#${prefix}-dealurl${suffix}`)?.value.trim() || '';
        let imageUrl = formOrEntry.querySelector(`#${prefix}-imageurl${suffix}`)?.value.trim() || '';
        const combinedHtml = formOrEntry.querySelector(`#${prefix}-combinedhtml${suffix}`)?.value.trim() || '';
        const extraHtml = formOrEntry.querySelector(`#${prefix}-extrahtml${suffix}`)?.value.trim() || '';

        if (dealUrl.toLowerCase() === 'אין') dealUrl = '';
        if (imageUrl.toLowerCase() === 'אין') imageUrl = '';

        return { dealUrl, imageUrl, combinedHtml, extraHtml };
    }

    function calculateAvailabilityMonths(start, end) {
        const months = [];
        if (!start || !end) return months;
        const s = new Date(start), e = new Date(end);
        if (isNaN(s)||isNaN(e)||e<s) return months;
        let cur = new Date(s.getFullYear(), s.getMonth(), 1);
        const last = new Date(e.getFullYear(), e.getMonth(), 1);
        while (cur<=last) {
            const m = String(cur.getMonth()+1).padStart(2,'0');
            months.push(`${cur.getFullYear()}-${m}`);
            cur.setMonth(cur.getMonth()+1);
        }
        return months;
    }

    // --- AI paste parsing ---
    if (aiPasteForm) {
        aiPasteForm.addEventListener('submit', async e => {
            e.preventDefault();
            const text = aiTextInput.value.trim();
            if (!text) return alert("אנא הדבק את ההודעה מה-AI.");
            const btn = aiPasteForm.querySelector('button[type="submit"]');
            const orig = btn.textContent;
            btn.disabled = true;
            btn.textContent = "מנתח...";
            try {
                const parsed = parseAiTextMessage(text);
                if (parsed.name) {
                    populatePackageFormWithParsedData(parsed);
                    closeModal(aiPasteModal);
                    openModal(packageModal);
                } else {
                    alert("לא נמצא שם לדיל. אנא בדוק את הפורמט.");
                }
            } catch (err) {
                console.error(err);
                alert("שגיאה בניתוח הטקסט: " + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = orig;
            }
        });
    }

    // --- Parse AI text into structured data ---
    function parseAiTextMessage(text) {
        const data = {
            name: "", description: "", price_text: "",
            exactDatesRange: { start: "", end: "" },
            destinationCountry: "", destinationCity: "",
            flightDetails: {
                departureAirline: "", departureOrigin: "", departureDestination: "", departureTime: "", departureLandingTime: "", departureNotes: "",
                returnAirline: "", returnOrigin: "", returnDestination: "", returnTime: "", returnLandingTime: "", returnNotes: ""
            },
            mainImageUrl: "", hotels: []
        };
        function getValueAfterKey(key, src = text, opts = {}) {
            const { multiLine=false, isTime=false, isLine=false, lineSeparator='>' } = opts;
            const pattern = new RegExp(`^\\s*${key.replace(/:$/,'')}\\s*:?\\s*(.+)`, "im");
            let m = src.match(pattern);
            if (!m) return "";
            let val = m[1].trim();
            if (multiLine) {
                const rest = src.slice(m.index + m[0].length).split('\n');
                let acc = "";
                for (const line of rest) {
                    if (/^\s*[א-ת0-9\s\.\-]+:/.test(line)) break; // Stop if new key-value pair starts
                    acc += (acc?"\n":"") + line;
                }
                if (acc) val = acc.trim(); // Use accumulated multi-line value
            }
            if (isTime) return (val.match(/(\d{1,2}:\d{2})/)||[])[1]||"";
            if (isLine) {
                const parts = val.split(lineSeparator).map(s=>s.trim());
                return parts.length===2 ? { origin:parts[0], destination:parts[1] } : { origin:val, destination:"" };
            }
            return val;
        }

        data.name               = getValueAfterKey("שם דיל");
        data.description        = getValueAfterKey("תיאור דיל", text, {multiLine:true});
        data.price_text         = getValueAfterKey("מחיר");
        const dates             = getValueAfterKey("תאריכים").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})-(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dates) {
            data.exactDatesRange.start = `${dates[3]}-${dates[2].padStart(2,'0')}-${dates[1].padStart(2,'0')}`;
            data.exactDatesRange.end   = `${dates[6]}-${dates[5].padStart(2,'0')}-${dates[4].padStart(2,'0')}`;
        }
        data.destinationCountry = getValueAfterKey("מדינה");
        data.destinationCity    = getValueAfterKey("עיר");
        
        let rawMainImageUrl     = getValueAfterKey("קישור לתמונה ראשית");
        data.mainImageUrl       = rawMainImageUrl.toLowerCase() === 'אין' ? '' : rawMainImageUrl;


        const flightsBlock = text.match(/פרטי הטיסות:\s*([\s\S]*?)(?=\n\n|\n\s*מלונות:|$)/i)?.[1]||"";
        const depBlock     = flightsBlock.match(/טיסת הלוך:\s*([\s\S]*?)(?=\n\s*טיסת חזור:|$)/i)?.[1]||"";
        const retBlock     = flightsBlock.match(/טיסת חזור:\s*([\s\S]*)/i)?.[1]||"";

        if (depBlock) {
            data.flightDetails.departureAirline      = getValueAfterKey("חברת תעופה", depBlock);
            const depLine = getValueAfterKey("קו", depBlock, {isLine:true});
            data.flightDetails.departureOrigin       = depLine.origin;
            data.flightDetails.departureDestination  = depLine.destination;
            data.flightDetails.departureTime         = getValueAfterKey("המראה", depBlock, {isTime:true});
            data.flightDetails.departureLandingTime  = getValueAfterKey("נחיתה", depBlock, {isTime:true});
            data.flightDetails.departureNotes        = getValueAfterKey("הערות לטיסה הלוך", depBlock, {multiLine:true});
        }
        if (retBlock) {
            data.flightDetails.returnAirline         = getValueAfterKey("חברת תעופה", retBlock);
            const retLine = getValueAfterKey("קו", retBlock, {isLine:true});
            data.flightDetails.returnOrigin          = retLine.origin;
            data.flightDetails.returnDestination     = retLine.destination;
            data.flightDetails.returnTime            = getValueAfterKey("המראה", retBlock, {isTime:true});
            data.flightDetails.returnLandingTime     = getValueAfterKey("נחיתה", retBlock, {isTime:true});
            data.flightDetails.returnNotes           = getValueAfterKey("הערות לטיסה חזור", retBlock, {multiLine:true});
        }

        // Hotels parsing (Example - if you add it later, apply 'אין' logic to URLs)
        // const hotelsSection = text.match(/מלונות:\s*([\s\S]*?)(?=\n\n|$)/i)?.[1] || "";
        // if (hotelsSection) {
        //     // Placeholder for more complex hotel parsing logic
        //     // For each hotel, parse its details including affiliate links
        //     // Example for one hotel's booking link:
        //     // let hotelBookingUrl = getValueAfterKey("קישור בוקינג למלון X", hotelsSection);
        //     // hotel.bookingUrl = hotelBookingUrl.toLowerCase() === 'אין' ? '' : hotelBookingUrl;
        // }
        return data;
    }

    // --- Populate package form from AI data ---
    function populatePackageFormWithParsedData(d) {
        resetPackageForm();
        document.getElementById('package-deal-name').value        = d.name        || "";
        document.getElementById('package-deal-description').value = d.description || "";
        document.getElementById('package-price-text').value       = d.price_text || "";
        document.getElementById('package-start-date').value       = d.exactDatesRange.start || "";
        document.getElementById('package-end-date').value         = d.exactDatesRange.end   || "";
        document.getElementById('package-country').value          = d.destinationCountry || "";
        document.getElementById('package-city').value             = d.destinationCity    || "";
        document.getElementById('package-flight-departure-airline').value = d.flightDetails.departureAirline || "";
        document.getElementById('package-flight-departure-time').value    = d.flightDetails.departureTime    || "";
        document.getElementById('package-flight-return-airline').value    = d.flightDetails.returnAirline    || "";
        document.getElementById('package-flight-return-time').value       = d.flightDetails.returnTime       || "";
        let notes = d.flightDetails.departureNotes || "";
        if (d.flightDetails.returnNotes) notes += (notes ? "\n" : "") + "הערות חזור: " + d.flightDetails.returnNotes;
        document.getElementById('package-flight-notes').value = notes;
        document.getElementById('package-image-url').value = d.mainImageUrl || ''; // Populate main image URL

        // If AI parsing includes hotels, you would populate them here
        // d.hotels?.forEach(h => addHotelFieldToPackage(h)); // Make sure 'h' structure matches addHotelFieldToPackage
    }

    // --- Package save ---
    if (packageDealForm) {
        packageDealForm.addEventListener('submit', async e => {
            e.preventDefault();
            const dealId = packageDealIdInput.value;
            const start = document.getElementById('package-start-date').value;
            const end   = document.getElementById('package-end-date').value;
            const tripTypes = Array.from(packageTripTypesContainer.querySelectorAll('input:checked')).map(cb=>cb.value);
            const hotels = [];
            packageHotelsContainer.querySelectorAll('.hotel-entry').forEach(entry => {
                const sfx = entry.querySelector('.hotel-entry-field-suffix').value;
                hotels.push({
                    name: entry.querySelector(`#p-hotel-name${sfx}`).value,
                    stars: entry.querySelector(`#p-hotel-stars${sfx}`).value,
                    affiliateLinks: {
                        booking: collectAffiliateProviderData(entry, 'p-hotel-booking', sfx),
                        agoda:   collectAffiliateProviderData(entry, 'p-hotel-agoda',   sfx),
                        expedia: collectAffiliateProviderData(entry, 'p-hotel-expedia', sfx)
                    }
                });
            });
            let mainImageUrl = document.getElementById('package-image-url').value.trim();
            if (mainImageUrl.toLowerCase() === 'אין') mainImageUrl = '';

            const dealData = {
                dealType: "package",
                name: document.getElementById('package-deal-name').value,
                description: document.getElementById('package-deal-description').value,
                price_text: document.getElementById('package-price-text').value,
                exactDatesRange: { start, end },
                destinationCountry: document.getElementById('package-country').value,
                destinationCity:    document.getElementById('package-city').value,
                flightDetails: {
                    departureAirline: document.getElementById('package-flight-departure-airline').value,
                    departureTime:    document.getElementById('package-flight-departure-time').value,
                    returnAirline:    document.getElementById('package-flight-return-airline').value,
                    returnTime:       document.getElementById('package-flight-return-time').value,
                    notes:            document.getElementById('package-flight-notes').value
                },
                hotels: hotels,
                tripTypes: tripTypes,
                availabilityMonths: calculateAvailabilityMonths(start, end),
                imageUrl: mainImageUrl,
                createdAt: dealId? undefined : serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await saveData(dealId, dealData, packageModal, packageDealForm, "דיל חבילה");
        });
    }

    // --- Flight save ---
    if (flightDealForm) {
        flightDealForm.addEventListener('submit', async e => {
            e.preventDefault();
            const dealId = flightDealIdInput.value;
            const start = document.getElementById('flight-start-date').value;
            const end   = document.getElementById('flight-end-date').value;
            let imageUrl = document.getElementById('flight-image-url').value.trim();
            if (imageUrl.toLowerCase() === 'אין') imageUrl = '';

            const data = {
                dealType: "flight",
                name:        document.getElementById('flight-title').value,
                price_text:  document.getElementById('flight-price-text').value,
                exactDatesRange: { start, end },
                flightOrigin:      document.getElementById('flight-origin').value,
                flightDestination: document.getElementById('flight-destination').value,
                airline:           document.getElementById('flight-airline').value,
                imageUrl:          imageUrl,
                flightDetails: {
                    notes: document.getElementById('flight-notes-standalone').value
                },
                availabilityMonths: calculateAvailabilityMonths(start, end),
                createdAt: dealId? undefined : serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await saveData(dealId, data, flightModal, flightDealForm, "דיל טיסה");
        });
    }

    // --- Hotel save ---
    if (hotelDealForm) {
        hotelDealForm.addEventListener('submit', async e => {
            e.preventDefault();
            const dealId = hotelDealIdInput.value;
            const start = document.getElementById('hotel-start-date').value;
            const end   = document.getElementById('hotel-end-date').value;
            const tripTypes = Array.from(hotelTripTypesContainer.querySelectorAll('input:checked')).map(cb=>cb.value);
            const links = { // collectAffiliateProviderData already handles 'אין'
                booking: collectAffiliateProviderData(hotelDealForm, 'hotel-booking'),
                agoda:   collectAffiliateProviderData(hotelDealForm, 'hotel-agoda'),
                expedia: collectAffiliateProviderData(hotelDealForm, 'hotel-expedia')
            };
            let imageUrl = document.getElementById('hotel-image-url').value.trim();
            if (imageUrl.toLowerCase() === 'אין') imageUrl = '';

            const data = {
                dealType: "hotel",
                name:        document.getElementById('hotel-name').value,
                price_text:  document.getElementById('hotel-price-text').value,
                exactDatesRange: { start, end },
                destinationCountry: document.getElementById('hotel-country').value,
                destinationCity:    document.getElementById('hotel-city').value,
                stars: document.getElementById('hotel-stars').value,
                singleHotelAffiliateLinks: links,
                imageUrl: imageUrl,
                tripTypes: tripTypes,
                availabilityMonths: calculateAvailabilityMonths(start, end),
                createdAt: dealId? undefined : serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await saveData(dealId, data, hotelModal, hotelDealForm, "דיל מלון");
        });
    }

    // --- Save / Update to Firestore ---
    async function saveData(id, data, modal, form, itemName) {
        const btn = form.querySelector('button[type="submit"]');
        const orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = "שומר...";
        try {
            // Ensure all relevant URL fields are cleaned if they were not processed by collectAffiliateProviderData
            // This is mostly for main image URLs which are direct inputs
            if (data.imageUrl !== undefined && data.imageUrl.toLowerCase() === 'אין') {
                data.imageUrl = '';
            }
            // For package hotels, collectAffiliateProviderData should have handled it.
            // For singleHotelAffiliateLinks, collectAffiliateProviderData should have handled it.

            if (id) {
                await updateDoc(doc(db, 'deals', id), data);
                alert(`${itemName} עודכן בהצלחה!`);
            } else {
                await addDoc(dealsCollectionRef, data);
                alert(`${itemName} נוסף בהצלחה!`);
            }
            form.reset();
            resetPackageForm();
            resetFlightForm();
            resetHotelForm();
            closeModal(modal);
            loadAdminDeals();
        } catch (err) {
            console.error(err);
            alert(`שגיאה בשמירת ${itemName}: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = orig;
        }
    }

    // --- Reset forms ---
    function resetPackageForm() {
        if (!packageDealForm) return;
        packageDealForm.reset();
        packageDealIdInput.value = '';
        if(packageHotelsContainer) packageHotelsContainer.innerHTML = ''; // Check for null
        packageHotelFieldCount = 0;
        if(packageTripTypesContainer) packageTripTypesContainer.querySelectorAll('input').forEach(cb => cb.checked = false); // Check for null
        packageModalTitle.textContent = 'יצירת דיל חדש (חבילה)';
        packageSaveButton.textContent = 'שמור דיל חבילה';
    }
    function resetFlightForm() {
        if (!flightDealForm) return;
        flightDealForm.reset();
        flightDealIdInput.value = '';
        flightModalTitle.textContent = 'יצירת דיל טיסה';
        flightSaveButton.textContent = 'שמור דיל טיסה';
    }
    function resetHotelForm() {
        if (!hotelDealForm) return;
        hotelDealForm.reset();
        hotelDealIdInput.value = '';
        if(hotelTripTypesContainer) hotelTripTypesContainer.querySelectorAll('input').forEach(cb => cb.checked = false); // Check for null
        hotelModalTitle.textContent = 'יצירת דיל מלון';
        hotelSaveButton.textContent = 'שמור דיל מלון';
    }

    // --- Load and display existing deals ---
    async function loadAdminDeals() {
        adminDealsOutput.innerHTML = '<p style="text-align:center;">טוען פריטים...</p>';
        try {
            const q = query(dealsCollectionRef, orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            if (snap.empty) {
                adminDealsOutput.innerHTML = '<p style="text-align:center;">אין פריטים להצגה.</p>';
                return;
            }
            let html = '<ul>';
            snap.forEach(docSnap => {
                const item = docSnap.data();
                const id = docSnap.id;
                let dates = '';
                if (item.exactDatesRange?.start && item.exactDatesRange?.end) {
                    dates = ` | ${new Date(item.exactDatesRange.start).toLocaleDateString('he-IL')} - ${new Date(item.exactDatesRange.end).toLocaleDateString('he-IL')}`;
                }
                html += `<li>
                    <div>
                        <strong>${item.name}</strong><br>
                        <small>סוג: ${getItemTypeDisplay(item.dealType)}${dates} | מחיר: ${item.price_text}</small>
                    </div>
                    <div>
                        <button data-id="${id}" data-type="${item.dealType}" class="edit-item">ערוך</button>
                        <button data-id="${id}" class="delete-item">מחק</button>
                    </div>
                </li>`;
            });
            html += '</ul>';
            adminDealsOutput.innerHTML = html;
            document.querySelectorAll('.edit-item').forEach(btn => btn.addEventListener('click', handleEditItem));
            document.querySelectorAll('.delete-item').forEach(btn => btn.addEventListener('click', handleDeleteItem));
        } catch (err) {
            console.error(err);
            adminDealsOutput.innerHTML = '<p style="text-align:center; color:red;">שגיאה בטעינת הפריטים.</p>';
        }
    }

    function getItemTypeDisplay(key) {
        return { flight: 'טיסה', hotel: 'מלון', package: 'חבילה' }[key] || key;
    }

    // --- Edit existing item ---
    async function handleEditItem(e) {
        const id = e.target.dataset.id;
        const type = e.target.dataset.type;
        try {
            const snap = await getDoc(doc(db, 'deals', id));
            if (!snap.exists()) return alert('פריט לא נמצא.');
            const data = snap.data();
            if (type === 'package') {
                resetPackageForm();
                packageDealIdInput.value = id;
                document.getElementById('package-deal-name').value = data.name || '';
                document.getElementById('package-deal-description').value = data.description || '';
                document.getElementById('package-price-text').value = data.price_text || '';
                document.getElementById('package-start-date').value = data.exactDatesRange?.start || '';
                document.getElementById('package-end-date').value = data.exactDatesRange?.end || '';
                document.getElementById('package-country').value = data.destinationCountry || '';
                document.getElementById('package-city').value = data.destinationCity || '';
                document.getElementById('package-flight-departure-airline').value = data.flightDetails?.departureAirline || '';
                document.getElementById('package-flight-departure-time').value = data.flightDetails?.departureTime || '';
                document.getElementById('package-flight-return-airline').value = data.flightDetails?.returnAirline || '';
                document.getElementById('package-flight-return-time').value = data.flightDetails?.returnTime || '';
                document.getElementById('package-flight-notes').value = data.flightDetails?.notes || '';
                packageHotelsContainer.innerHTML = ''; // Clear before adding
                data.hotels?.forEach(h => addHotelFieldToPackage(h)); // addHotelFieldToPackage will set values including empty for URLs
                data.tripTypes?.forEach(t => {
                    const cb = packageTripTypesContainer.querySelector(`input[value="${t}"]`);
                    if (cb) cb.checked = true;
                });
                document.getElementById('package-image-url').value = data.imageUrl || ''; // Will be empty if 'אין' was used
                packageModalTitle.textContent = 'עריכת דיל חבילה';
                packageSaveButton.textContent = 'עדכן דיל חבילה';
                openModal(packageModal);
            }
            else if (type === 'flight') {
                resetFlightForm();
                flightDealIdInput.value = id;
                document.getElementById('flight-title').value = data.name || '';
                document.getElementById('flight-price-text').value = data.price_text || '';
                document.getElementById('flight-start-date').value = data.exactDatesRange?.start || '';
                document.getElementById('flight-end-date').value = data.exactDatesRange?.end || '';
                document.getElementById('flight-origin').value = data.flightOrigin || '';
                document.getElementById('flight-destination').value = data.flightDestination || '';
                document.getElementById('flight-airline').value = data.airline || '';
                document.getElementById('flight-image-url').value = data.imageUrl || ''; // Will be empty if 'אין' was used
                document.getElementById('flight-notes-standalone').value = data.flightDetails?.notes || '';
                flightModalTitle.textContent = 'עריכת דיל טיסה';
                flightSaveButton.textContent = 'עדכן דיל טיסה';
                openModal(flightModal);
            }
            else if (type === 'hotel') {
                resetHotelForm();
                hotelDealIdInput.value = id;
                document.getElementById('hotel-name').value = data.name || '';
                document.getElementById('hotel-price-text').value = data.price_text || '';
                document.getElementById('hotel-start-date').value = data.exactDatesRange?.start || '';
                document.getElementById('hotel-end-date').value = data.exactDatesRange?.end || '';
                document.getElementById('hotel-country').value = data.destinationCountry || '';
                document.getElementById('hotel-city').value = data.destinationCity || '';
                document.getElementById('hotel-stars').value = data.stars || '';
                ['booking','agoda','expedia'].forEach(pr => {
                    const link = data.singleHotelAffiliateLinks?.[pr] || {};
                    // Values will be empty if 'אין' was used and processed by collectAffiliateProviderData
                    hotelDealForm.querySelector(`#hotel-${pr}-dealurl`)   .value = link.dealUrl   || '';
                    hotelDealForm.querySelector(`#hotel-${pr}-imageurl`)  .value = link.imageUrl  || '';
                    hotelDealForm.querySelector(`#hotel-${pr}-combinedhtml`).value = link.combinedHtml || '';
                    hotelDealForm.querySelector(`#hotel-${pr}-extrahtml`)   .value = link.extraHtml    || '';
                });
                document.getElementById('hotel-image-url').value = data.imageUrl || ''; // Will be empty if 'אין' was used
                data.tripTypes?.forEach(t => {
                    const cb = hotelTripTypesContainer.querySelector(`input[value="${t}"]`);
                    if (cb) cb.checked = true;
                });
                hotelModalTitle.textContent = 'עריכת דיל מלון';
                hotelSaveButton.textContent = 'עדכן דיל מלון';
                openModal(hotelModal);
            }
        } catch (err) {
            console.error(err);
            alert('שגיאה בטעינת הפריט לעריכה.');
        }
    }

    // --- Delete item ---
    async function handleDeleteItem(e) {
        const id = e.target.dataset.id;
        if (!confirm('האם למחוק את הפריט?')) return;
        try {
            await deleteDoc(doc(db, 'deals', id));
            alert('הפריט נמחק.');
            loadAdminDeals();
        } catch (err) {
            console.error(err);
            alert('שגיאה במחיקת הפריט.');
        }
    }

    // Initial load if already logged in
    if (auth.currentUser) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        adminUserEmailEl.textContent = auth.currentUser.email; // Ensure this updates on initial load
        loadAdminDeals();
    } else {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
});

