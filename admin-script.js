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

    if (packageTripTypesContainer) populateCheckboxes(packageTripTypesContainer, ALL_TRIP_TYPES, 'packageTripType');
    if (hotelTripTypesContainer) populateCheckboxes(hotelTripTypesContainer, ALL_TRIP_TYPES, 'hotelTripType');

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

    function populateCheckboxes(container, options, groupName) {
        container.innerHTML = '';
        options.forEach(option => {
            const checkboxId = `${groupName}-${option.replace(/\s+/g, '-')}`;
            const div = document.createElement('div');
            div.innerHTML = `<input type="checkbox" id="${checkboxId}" name="${groupName}" value="${option}"><label for="${checkboxId}">${option}</label>`;
            container.appendChild(div);
        });
    }

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
            ${hotelData?.packagePriceWithHotel ? `<div class="form-group"><label>מחיר חבילה עם מלון זה (מנותח מ-AI):</label><input type="text" disabled readonly value="${hotelData.packagePriceWithHotel}"></div>` : ''}

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

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).catch(err => console.error('Sign out error:', err));
        });
    }

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
        // For combinedHtml and extraHtml, "אין" might be valid if the intention is to store the word "אין".
        // However, if "אין" means "no HTML", then they should also be converted to ''.
        // For now, assuming only dealUrl and imageUrl need special "אין" handling for empty string conversion.
        // If the AI parser now converts "אין" to "" for these HTML fields too, this function is fine as is for manual.

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
                console.error("AI Parsing Error:", err);
                alert("שגיאה בניתוח הטקסט: " + err.message + (err.stack ? "\n" + err.stack.substring(0, 300) : ""));
            } finally {
                btn.disabled = false;
                btn.textContent = orig;
            }
        });
    }
    
    function getValueAfterKey(key, sourceText, options = {}) {
        const { multiLine = false } = options;
        const pattern = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:$/, '')}\\s*:?\\s*(.*)`, "im");
        const match = sourceText.match(pattern);
    
        if (!match) return "";
    
        let value = match[1].trim();
    
        if (multiLine) {
            const lines = sourceText.slice(match.index + match[0].length).split('\n');
            let accumulatedLines = "";
            for (const line of lines) {
                // Stop if we encounter what looks like a new key specific to the known format (e.g., "שם המלון:", "Booking.com:", etc.)
                // or a hotel block ("מלון X:") or a major section ("פרטי הטיסות:", "פרטי מלונות:")
                if (/^\s*((שם דיל|תיאור דיל|מחיר|תאריכים|מדינה|עיר|קישור לתמונה ראשית|פרטי הטיסות|פרטי מלונות|מלון\s*\d+|שם המלון|כוכבים|מחיר החבילה עם המלון|Booking\.com|Agoda|Expedia|טיסת הלוך|טיסת חזור|חברת תעופה|קו|המראה|נחיתה|הערות לטיסה הלוך|הערות לטיסה חזור|קישור לדיל|קישור לתמונה|קישור לתמונה ודיל|קישור למפה ובאנר)\s*:)/.test(line)) {
                    break;
                }
                accumulatedLines += (accumulatedLines ? "\n" : "") + line;
            }
            // If the first line (value) was empty and we accumulated subsequent lines, use those.
            // If the first line had content, and we also accumulated, append.
            if (value === "" && accumulatedLines.trim() !== "") {
                value = accumulatedLines.trim();
            } else if (value !== "" && accumulatedLines.trim() !== "") {
                 // Check if initial value was just a lead-in for multiline that starts on next line.
                 // This part is tricky; often the first line is empty if value truly starts on next.
                 // For simplicity, if key: \n value, then `value` will be `acc`. If `key: val \n val2`, this should combine.
                 // The original simple replace was `if (acc) val = acc.trim();`
                 // This assumes if multiline, value starts on next line.
                 // The example `קישור לתמונה ודיל:\n<HTML>` implies `value` initially empty.
                if (accumulatedLines.trim() !== "") { // Prioritize accumulated if available
                    value = accumulatedLines.trim();
                }
            } else if (value !== "" && accumulatedLines.trim() === "") {
                // Value was on the same line as key, and no further lines.
                // `value` is already correct.
            } else { // Both empty, or initial value empty and no further lines
                // `value` is already correct (empty).
            }
        }
    
        // Specific parsing for time and flight lines can remain or be refactored
        if (options.isTime) return (value.match(/(\d{1,2}:\d{2})/g) || [])[0] || ""; // Take first match if multiple
        if (options.isLine) {
            const parts = value.split(options.lineSeparator || '>').map(s => s.trim());
            return parts.length === 2 ? { origin: parts[0], destination: parts[1] } : { origin: value, destination: "" };
        }
        return value;
    }

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

        data.name = getValueAfterKey("שם דיל", text);
        data.description = getValueAfterKey("תיאור דיל", text, { multiLine: true });
        data.price_text = getValueAfterKey("מחיר", text);
        const datesRaw = getValueAfterKey("תאריכים", text);
        const datesMatch = datesRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})-(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (datesMatch) {
            data.exactDatesRange.start = `${datesMatch[3]}-${datesMatch[2].padStart(2, '0')}-${datesMatch[1].padStart(2, '0')}`;
            data.exactDatesRange.end = `${datesMatch[6]}-${datesMatch[5].padStart(2, '0')}-${datesMatch[4].padStart(2, '0')}`;
        }
        data.destinationCountry = getValueAfterKey("מדינה", text);
        data.destinationCity = getValueAfterKey("עיר", text);
        let rawMainImageUrl = getValueAfterKey("קישור לתמונה ראשית", text);
        data.mainImageUrl = rawMainImageUrl.toLowerCase() === 'אין' ? '' : rawMainImageUrl;

        const flightsBlockMatch = text.match(/פרטי הטיסות:\s*([\s\S]*?)(?=\n\s*פרטי מלונות:|\n\n\S|$)/i);
        if (flightsBlockMatch) {
            const flightsBlock = flightsBlockMatch[1];
            const depBlockMatch = flightsBlock.match(/טיסת הלוך:\s*([\s\S]*?)(?=\n\s*טיסת חזור:|$)/i);
            if (depBlockMatch) {
                const depBlock = depBlockMatch[1];
                data.flightDetails.departureAirline = getValueAfterKey("חברת תעופה", depBlock);
                const depLine = getValueAfterKey("קו", depBlock, { isLine: true, lineSeparator: '>' });
                data.flightDetails.departureOrigin = depLine.origin;
                data.flightDetails.departureDestination = depLine.destination;
                data.flightDetails.departureTime = getValueAfterKey("המראה", depBlock, { isTime: true });
                data.flightDetails.departureLandingTime = getValueAfterKey("נחיתה", depBlock, { isTime: true });
                data.flightDetails.departureNotes = getValueAfterKey("הערות לטיסה הלוך", depBlock, { multiLine: true });
            }
            const retBlockMatch = flightsBlock.match(/טיסת חזור:\s*([\s\S]*)/i);
            if (retBlockMatch) {
                const retBlock = retBlockMatch[1];
                data.flightDetails.returnAirline = getValueAfterKey("חברת תעופה", retBlock);
                const retLine = getValueAfterKey("קו", retBlock, { isLine: true, lineSeparator: '>' });
                data.flightDetails.returnOrigin = retLine.origin;
                data.flightDetails.returnDestination = retLine.destination;
                data.flightDetails.returnTime = getValueAfterKey("המראה", retBlock, { isTime: true });
                data.flightDetails.returnLandingTime = getValueAfterKey("נחיתה", retBlock, { isTime: true });
                data.flightDetails.returnNotes = getValueAfterKey("הערות לטיסה חזור", retBlock, { multiLine: true });
            }
        }
        
        // --- Parse Hotels ---
        const hotelsSectionMatch = text.match(/פרטי מלונות:\s*([\s\S]*)/i);
        if (hotelsSectionMatch) {
            const hotelsSectionText = hotelsSectionMatch[1];
            const hotelRegex = /מלון\s*\d+:\s*([\s\S]*?)(?=(?:מלון\s*\d+:|$))/gi;
            let hotelMatch;
            while ((hotelMatch = hotelRegex.exec(hotelsSectionText)) !== null) {
                const hotelContent = hotelMatch[1].trim();
                const currentHotelData = {
                    name: getValueAfterKey("שם המלון", hotelContent),
                    stars: getValueAfterKey("כוכבים", hotelContent),
                    packagePriceWithHotel: getValueAfterKey("מחיר החבילה עם המלון", hotelContent),
                    affiliateLinks: {
                        booking: {}, agoda: {}, expedia: {}
                    }
                };

                const providers = [
                    { name: "Booking.com", key: "booking" },
                    { name: "Agoda", key: "agoda" },
                    { name: "Expedia", key: "expedia" }
                ];

                let remainingHotelContentForProviders = hotelContent;
                const hotelInfoKeysPattern = /^(שם המלון|כוכבים|מחיר החבילה עם המלון):/im;
                let lastIndex = 0;
                // Find where the general hotel info ends and provider info begins
                // This is a rough way to isolate provider text, might need refinement
                const linesInHotelContent = hotelContent.split('\n');
                let providerTextStartIndex = 0;
                for(let i=0; i<linesInHotelContent.length; i++){
                    if(providers.some(p => linesInHotelContent[i].trim().startsWith(p.name + ":"))){
                        providerTextStartIndex = i;
                        break;
                    }
                    if (i === linesInHotelContent.length -1) providerTextStartIndex = linesInHotelContent.length; // No provider found
                }
                remainingHotelContentForProviders = linesInHotelContent.slice(providerTextStartIndex).join('\n');


                for (const provider of providers) {
                    const providerBlockPattern = new RegExp(`^\\s*${provider.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([\\s\\S]*?)(?=(?:^\\s*(?:Booking\\.com|Agoda|Expedia):|$))`, "im");
                    const providerBlockMatch = remainingHotelContentForProviders.match(providerBlockPattern);
                    let providerText = "";

                    if (providerBlockMatch) {
                         providerText = providerBlockMatch[1].trim();
                    } else {
                        // Fallback if regex fails, try simpler indexOf
                        const pNameWithColon = provider.name + ":";
                        const startIdx = remainingHotelContentForProviders.indexOf(pNameWithColon);
                        if (startIdx > -1) {
                            let endIdx = remainingHotelContentForProviders.length;
                            // Find next provider to define end boundary
                            for(const nextP of providers) {
                                if (nextP.name === provider.name) continue;
                                const nextPStartIdx = remainingHotelContentForProviders.indexOf(nextP.name + ":", startIdx + pNameWithColon.length);
                                if (nextPStartIdx > -1) {
                                    endIdx = Math.min(endIdx, nextPStartIdx);
                                }
                            }
                            providerText = remainingHotelContentForProviders.substring(startIdx + pNameWithColon.length, endIdx).trim();
                        }
                    }

                    if (providerText || providerBlockMatch) { // Ensure provider section was found
                        let dealUrl = getValueAfterKey("קישור לדיל", providerText);
                        let imageUrl = getValueAfterKey("קישור לתמונה", providerText);
                        let combinedHtml = getValueAfterKey("קישור לתמונה ודיל", providerText, { multiLine: true });
                        let extraHtml = getValueAfterKey("קישור למפה ובאנר", providerText, { multiLine: true });

                        currentHotelData.affiliateLinks[provider.key] = {
                            dealUrl: dealUrl.toLowerCase() === 'אין' ? '' : dealUrl,
                            imageUrl: imageUrl.toLowerCase() === 'אין' ? '' : imageUrl,
                            combinedHtml: combinedHtml.toLowerCase() === 'אין' ? '' : combinedHtml,
                            extraHtml: extraHtml.toLowerCase() === 'אין' ? '' : extraHtml
                        };
                    } else {
                         currentHotelData.affiliateLinks[provider.key] = { dealUrl: "", imageUrl: "", combinedHtml: "", extraHtml: "" };
                    }
                }
                data.hotels.push(currentHotelData);
            }
        }
        return data;
    }

    function populatePackageFormWithParsedData(d) {
        resetPackageForm(); // Clears previous data including hotels container
        document.getElementById('package-deal-name').value = d.name || "";
        document.getElementById('package-deal-description').value = d.description || "";
        document.getElementById('package-price-text').value = d.price_text || "";
        document.getElementById('package-start-date').value = d.exactDatesRange.start || "";
        document.getElementById('package-end-date').value = d.exactDatesRange.end || "";
        document.getElementById('package-country').value = d.destinationCountry || "";
        document.getElementById('package-city').value = d.destinationCity || "";
        document.getElementById('package-image-url').value = d.mainImageUrl || ''; // Populate main image URL

        if (d.flightDetails) {
            document.getElementById('package-flight-departure-airline').value = d.flightDetails.departureAirline || "";
            document.getElementById('package-flight-departure-time').value = d.flightDetails.departureTime || "";
            document.getElementById('package-flight-return-airline').value = d.flightDetails.returnAirline || "";
            document.getElementById('package-flight-return-time').value = d.flightDetails.returnTime || "";
            let notes = d.flightDetails.departureNotes || "";
            if (d.flightDetails.returnNotes) notes += (notes ? "\n" : "") + "הערות חזור: " + d.flightDetails.returnNotes;
            document.getElementById('package-flight-notes').value = notes;
        }
        
        // Populate hotels if parsed
        if (d.hotels?.length) {
            d.hotels.forEach(hotelData => {
                addHotelFieldToPackage(hotelData);
            });
        }
    }

    if (packageDealForm) {
        packageDealForm.addEventListener('submit', async e => {
            e.preventDefault();
            const dealId = packageDealIdInput.value;
            const start = document.getElementById('package-start-date').value;
            const end = document.getElementById('package-end-date').value;
            const tripTypes = Array.from(packageTripTypesContainer.querySelectorAll('input:checked')).map(cb => cb.value);
            const hotels = [];
            packageHotelsContainer.querySelectorAll('.hotel-entry').forEach(entry => {
                const sfx = entry.querySelector('.hotel-entry-field-suffix').value;
                // Get the packagePriceWithHotel if it exists (it's a read-only field populated by AI)
                const packagePriceInput = entry.querySelector(`input[disabled][readonly][value]`); // Find the specific input
                const packagePriceWithHotel = packagePriceInput ? packagePriceInput.value : null;

                hotels.push({
                    name: entry.querySelector(`#p-hotel-name${sfx}`).value,
                    stars: entry.querySelector(`#p-hotel-stars${sfx}`).value,
                    packagePriceWithHotel: packagePriceWithHotel, // Store it if available
                    affiliateLinks: {
                        booking: collectAffiliateProviderData(entry, 'p-hotel-booking', sfx),
                        agoda: collectAffiliateProviderData(entry, 'p-hotel-agoda', sfx),
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
                destinationCity: document.getElementById('package-city').value,
                flightDetails: {
                    departureAirline: document.getElementById('package-flight-departure-airline').value,
                    departureTime: document.getElementById('package-flight-departure-time').value,
                    returnAirline: document.getElementById('package-flight-return-airline').value,
                    returnTime: document.getElementById('package-flight-return-time').value,
                    notes: document.getElementById('package-flight-notes').value
                },
                hotels: hotels,
                tripTypes: tripTypes,
                availabilityMonths: calculateAvailabilityMonths(start, end),
                imageUrl: mainImageUrl,
                createdAt: dealId ? undefined : serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await saveData(dealId, dealData, packageModal, packageDealForm, "דיל חבילה");
        });
    }

    if (flightDealForm) {
        flightDealForm.addEventListener('submit', async e => {
            e.preventDefault();
            const dealId = flightDealIdInput.value;
            const start = document.getElementById('flight-start-date').value;
            const end = document.getElementById('flight-end-date').value;
            let imageUrl = document.getElementById('flight-image-url').value.trim();
            if (imageUrl.toLowerCase() === 'אין') imageUrl = '';

            const data = {
                dealType: "flight",
                name: document.getElementById('flight-title').value,
                price_text: document.getElementById('flight-price-text').value,
                exactDatesRange: { start, end },
                flightOrigin: document.getElementById('flight-origin').value,
                flightDestination: document.getElementById('flight-destination').value,
                airline: document.getElementById('flight-airline').value,
                imageUrl: imageUrl,
                flightDetails: { // Ensure consistency for flight deals too
                    notes: document.getElementById('flight-notes-standalone').value
                },
                availabilityMonths: calculateAvailabilityMonths(start, end),
                createdAt: dealId ? undefined : serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await saveData(dealId, data, flightModal, flightDealForm, "דיל טיסה");
        });
    }

    if (hotelDealForm) {
        hotelDealForm.addEventListener('submit', async e => {
            e.preventDefault();
            const dealId = hotelDealIdInput.value;
            const start = document.getElementById('hotel-start-date').value;
            const end = document.getElementById('hotel-end-date').value;
            const tripTypes = Array.from(hotelTripTypesContainer.querySelectorAll('input:checked')).map(cb => cb.value);
            const links = {
                booking: collectAffiliateProviderData(hotelDealForm, 'hotel-booking'),
                agoda: collectAffiliateProviderData(hotelDealForm, 'hotel-agoda'),
                expedia: collectAffiliateProviderData(hotelDealForm, 'hotel-expedia')
            };
            let imageUrl = document.getElementById('hotel-image-url').value.trim();
            if (imageUrl.toLowerCase() === 'אין') imageUrl = '';

            const data = {
                dealType: "hotel",
                name: document.getElementById('hotel-name').value,
                price_text: document.getElementById('hotel-price-text').value,
                exactDatesRange: { start, end },
                destinationCountry: document.getElementById('hotel-country').value,
                destinationCity: document.getElementById('hotel-city').value,
                stars: document.getElementById('hotel-stars').value,
                singleHotelAffiliateLinks: links,
                imageUrl: imageUrl,
                tripTypes: tripTypes,
                availabilityMonths: calculateAvailabilityMonths(start, end),
                createdAt: dealId ? undefined : serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await saveData(dealId, data, hotelModal, hotelDealForm, "דיל מלון");
        });
    }

    async function saveData(id, data, modal, form, itemName) {
        const btn = form.querySelector('button[type="submit"]');
        const orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = "שומר...";
        try {
            if (data.imageUrl !== undefined && data.imageUrl.toLowerCase() === 'אין') {
                data.imageUrl = '';
            }
            if (id) {
                await updateDoc(doc(db, 'deals', id), data);
                alert(`${itemName} עודכן בהצלחה!`);
            } else {
                await addDoc(dealsCollectionRef, data);
                alert(`${itemName} נוסף בהצלחה!`);
            }
            form.reset();
            if (modal === packageModal) resetPackageForm(); // Ensure correct reset
            else if (modal === flightModal) resetFlightForm();
            else if (modal === hotelModal) resetHotelForm();
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

    function resetPackageForm() {
        if (!packageDealForm) return;
        packageDealForm.reset();
        packageDealIdInput.value = '';
        if (packageHotelsContainer) packageHotelsContainer.innerHTML = '';
        packageHotelFieldCount = 0;
        if (packageTripTypesContainer) packageTripTypesContainer.querySelectorAll('input').forEach(cb => cb.checked = false);
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
        if (hotelTripTypesContainer) hotelTripTypesContainer.querySelectorAll('input').forEach(cb => cb.checked = false);
        hotelModalTitle.textContent = 'יצירת דיל מלון';
        hotelSaveButton.textContent = 'שמור דיל מלון';
    }

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
                    const startDate = new Date(item.exactDatesRange.start).toLocaleDateString('he-IL');
                    const endDate = new Date(item.exactDatesRange.end).toLocaleDateString('he-IL');
                    dates = ` | ${startDate} - ${endDate}`;
                }
                html += `<li>
                    <div>
                        <strong>${item.name}</strong><br>
                        <small>סוג: ${getItemTypeDisplay(item.dealType)}${dates} | מחיר: ${item.price_text || 'לא צוין'}</small>
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
                document.getElementById('package-image-url').value = data.imageUrl || '';

                // packageHotelsContainer.innerHTML = ''; // Done by resetPackageForm
                data.hotels?.forEach(h => addHotelFieldToPackage(h));
                
                data.tripTypes?.forEach(t => {
                    const cb = packageTripTypesContainer.querySelector(`input[value="${t}"]`);
                    if (cb) cb.checked = true;
                });
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
                document.getElementById('flight-image-url').value = data.imageUrl || '';
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
                ['booking', 'agoda', 'expedia'].forEach(pr => {
                    const linkData = data.singleHotelAffiliateLinks?.[pr] || {};
                    const formSection = hotelDealForm; // Assuming hotelDealForm is the correct scope
                    if (formSection.querySelector(`#hotel-${pr}-dealurl`)) {
                         formSection.querySelector(`#hotel-${pr}-dealurl`).value = linkData.dealUrl || '';
                    }
                    if (formSection.querySelector(`#hotel-${pr}-imageurl`)) {
                         formSection.querySelector(`#hotel-${pr}-imageurl`).value = linkData.imageUrl || '';
                    }
                    if (formSection.querySelector(`#hotel-${pr}-combinedhtml`)) {
                         formSection.querySelector(`#hotel-${pr}-combinedhtml`).value = linkData.combinedHtml || '';
                    }
                    if (formSection.querySelector(`#hotel-${pr}-extrahtml`)) {
                         formSection.querySelector(`#hotel-${pr}-extrahtml`).value = linkData.extraHtml || '';
                    }
                });
                document.getElementById('hotel-image-url').value = data.imageUrl || '';
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

    if (auth.currentUser) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        adminUserEmailEl.textContent = auth.currentUser.email;
        loadAdminDeals();
    } else {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
});

