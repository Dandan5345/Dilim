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
    const loginSection = document.getElementById('admin-login');
    const dashboardSection = document.getElementById('admin-dashboard');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const loginError = document.getElementById('login-error');
    const adminUserEmailEl = document.getElementById('admin-user-email');
    const adminDealsOutput = document.getElementById('admin-deals-output');
    const dealsCollectionRef = collection(db, 'deals');

    const packageModal = document.getElementById('package-deal-modal');
    const flightModal = document.getElementById('flight-deal-modal');
    const hotelModal = document.getElementById('hotel-deal-modal');

    const openPackageModalBtn = document.getElementById('open-package-deal-modal-btn');
    const openFlightModalBtn = document.getElementById('open-flight-deal-modal-btn');
    const openHotelModalBtn = document.getElementById('open-hotel-deal-modal-btn');
    
    const closeButtons = document.querySelectorAll('.close-modal-btn');

    const packageDealForm = document.getElementById('package-deal-form');
    const packageDealIdInput = document.getElementById('package-deal-id');
    const flightDealForm = document.getElementById('flight-deal-form');
    const flightDealIdInput = document.getElementById('flight-deal-id');
    const hotelDealForm = document.getElementById('hotel-deal-form');
    const hotelDealIdInput = document.getElementById('hotel-deal-id');

    const packageTripTypesContainer = document.getElementById('package-trip-types-checkboxes');
    const hotelTripTypesContainer = document.getElementById('hotel-trip-types-checkboxes');
    
    if(packageTripTypesContainer) populateCheckboxes(packageTripTypesContainer, ALL_TRIP_TYPES, 'packageTripType');
    if(hotelTripTypesContainer) populateCheckboxes(hotelTripTypesContainer, ALL_TRIP_TYPES, 'hotelTripType');
    
    function openModal(modalElement) {
        if (modalElement) {
            document.body.style.overflow = 'hidden';
            modalElement.style.display = 'flex'; 
            setTimeout(() => { modalElement.classList.add('active'); }, 10);
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

    if(openPackageModalBtn) openPackageModalBtn.addEventListener('click', () => { resetPackageForm(); openModal(packageModal); });
    if(openFlightModalBtn) openFlightModalBtn.addEventListener('click', () => { resetFlightForm(); openModal(flightModal); });
    if(openHotelModalBtn) openHotelModalBtn.addEventListener('click', () => { resetHotelForm(); openModal(hotelModal); });

    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.dataset.modalId;
            closeModal(document.getElementById(modalId));
        });
    });

    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal') && event.target.classList.contains('active')) {
            closeModal(event.target);
        }
    });
    
    function populateCheckboxes(container, options, groupName) {
        if(!container) return;
        container.innerHTML = '';
        options.forEach(option => {
            const item = typeof option === 'string' ? { value: option, label: option } : option;
            const checkboxId = `${groupName}-${item.value.replace(/\s+/g, '-')}`;
            const div = document.createElement('div');
            div.innerHTML = `<input type="checkbox" id="${checkboxId}" name="${groupName}" value="${item.value}"><label for="${checkboxId}">${item.label}</label>`;
            container.appendChild(div);
        });
    }

    const packageHotelsContainer = document.getElementById('package-hotels-container');
    const addPackageHotelBtn = document.getElementById('add-package-hotel-btn');
    let packageHotelFieldCount = 0;

    if (addPackageHotelBtn) {
        addPackageHotelBtn.addEventListener('click', () => addHotelFieldToPackage());
    }

    function addHotelFieldToPackage(hotelData = null) {
        if (!packageHotelsContainer) return;
        packageHotelFieldCount++; // זה בסדר אם האינדקס לא רציף במחיקה, הוא רק לייחודיות ID
        const hotelEntryDiv = document.createElement('div');
        hotelEntryDiv.className = 'hotel-entry';
        const fieldSuffix = `-${packageHotelFieldCount}`; // סיומת ייחודית לשדות המלון הנוכחי

        hotelEntryDiv.innerHTML = `
            <h5>מלון <span class="hotel-number">${packageHotelsContainer.children.length + 1}</span></h5>
            <div class="form-group">
                <label for="p-hotel-name${fieldSuffix}">שם המלון:</label>
                <input type="text" id="p-hotel-name${fieldSuffix}" value="${hotelData?.name || ''}" required>
            </div>
            <div class="form-group">
                <label for="p-hotel-stars${fieldSuffix}">כוכבים (1-5):</label>
                <select id="p-hotel-stars${fieldSuffix}">
                    <option value="">לא צוין</option>
                    <option value="1" ${hotelData?.stars == '1' ? 'selected' : ''}>⭐</option>
                    <option value="2" ${hotelData?.stars == '2' ? 'selected' : ''}>⭐⭐</option>
                    <option value="3" ${hotelData?.stars == '3' ? 'selected' : ''}>⭐⭐⭐</option>
                    <option value="4" ${hotelData?.stars == '4' ? 'selected' : ''}>⭐⭐⭐⭐</option>
                    <option value="5" ${hotelData?.stars == '5' ? 'selected' : ''}>⭐⭐⭐⭐⭐</option>
                </select>
            </div>
            <h6>Booking.com:</h6>
            <div class="form-group"><label for="p-hotel-booking-dealurl${fieldSuffix}">קישור לדיל:</label><input type="url" id="p-hotel-booking-dealurl${fieldSuffix}" value="${hotelData?.affiliateLinks?.booking?.dealUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-booking-imageurl${fieldSuffix}">קישור לתמונה:</label><input type="url" id="p-hotel-booking-imageurl${fieldSuffix}" value="${hotelData?.affiliateLinks?.booking?.imageUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-booking-combinedhtml${fieldSuffix}">קוד HTML (קישור+תמונה):</label><textarea id="p-hotel-booking-combinedhtml${fieldSuffix}" rows="2">${hotelData?.affiliateLinks?.booking?.combinedHtml || ''}</textarea></div>
            <div class="form-group"><label for="p-hotel-booking-extrahtml${fieldSuffix}">קוד HTML (מפה/באנר):</label><textarea id="p-hotel-booking-extrahtml${fieldSuffix}" rows="2">${hotelData?.affiliateLinks?.booking?.extraHtml || ''}</textarea></div>
            
            <h6>Agoda:</h6>
            <div class="form-group"><label for="p-hotel-agoda-dealurl${fieldSuffix}">קישור לדיל:</label><input type="url" id="p-hotel-agoda-dealurl${fieldSuffix}" value="${hotelData?.affiliateLinks?.agoda?.dealUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-agoda-imageurl${fieldSuffix}">קישור לתמונה:</label><input type="url" id="p-hotel-agoda-imageurl${fieldSuffix}" value="${hotelData?.affiliateLinks?.agoda?.imageUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-agoda-combinedhtml${fieldSuffix}">קוד HTML (קישור+תמונה):</label><textarea id="p-hotel-agoda-combinedhtml${fieldSuffix}" rows="2">${hotelData?.affiliateLinks?.agoda?.combinedHtml || ''}</textarea></div>
            <div class="form-group"><label for="p-hotel-agoda-extrahtml${fieldSuffix}">קוד HTML (מפה/באנר):</label><textarea id="p-hotel-agoda-extrahtml${fieldSuffix}" rows="2">${hotelData?.affiliateLinks?.agoda?.extraHtml || ''}</textarea></div>
            
            <h6>Expedia:</h6>
            <div class="form-group"><label for="p-hotel-expedia-dealurl${fieldSuffix}">קישור לדיל:</label><input type="url" id="p-hotel-expedia-dealurl${fieldSuffix}" value="${hotelData?.affiliateLinks?.expedia?.dealUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-expedia-imageurl${fieldSuffix}">קישור לתמונה:</label><input type="url" id="p-hotel-expedia-imageurl${fieldSuffix}" value="${hotelData?.affiliateLinks?.expedia?.imageUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-expedia-combinedhtml${fieldSuffix}">קוד HTML (קישור+תמונה):</label><textarea id="p-hotel-expedia-combinedhtml${fieldSuffix}" rows="2">${hotelData?.affiliateLinks?.expedia?.combinedHtml || ''}</textarea></div>
            <div class="form-group"><label for="p-hotel-expedia-extrahtml${fieldSuffix}">קוד HTML (מפה/באנר):</label><textarea id="p-hotel-expedia-extrahtml${fieldSuffix}" rows="2">${hotelData?.affiliateLinks?.expedia?.extraHtml || ''}</textarea></div>
            
            <button type="button" class="remove-hotel-btn">הסר מלון זה</button>
        `;
        packageHotelsContainer.appendChild(hotelEntryDiv);
        hotelEntryDiv.querySelector('.remove-hotel-btn').addEventListener('click', function() { 
            hotelEntryDiv.remove();
            // עדכון מספור המלונות
            packageHotelsContainer.querySelectorAll('.hotel-entry .hotel-number').forEach((span, idx) => {
                span.textContent = idx + 1;
            });
        });
    }
    
    onAuthStateChanged(auth, user => { /* ... כמו קודם ... */ });
    if (loginButton) { /* ... כמו קודם ... */ }
    if (logoutButton) { /* ... כמו קודם ... */ }

    function extractAffiliateDataFromHtml(htmlString) {
        if (!htmlString || typeof htmlString !== 'string' || htmlString.trim() === "") {
            return { linkUrl: null, imageUrl: null, rawHtml: htmlString || null };
        }
        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlString;
            const linkElement = tempDiv.querySelector('a');
            const imgElement = linkElement ? linkElement.querySelector('img') : tempDiv.querySelector('img');
            let linkUrl = linkElement ? linkElement.href : null;
            let imageUrl = imgElement ? imgElement.src : null;
            if (imgElement && !imageUrl && imgElement.srcset) {
                const sources = imgElement.srcset.split(',').map(s => s.trim().split(' ')[0]);
                if (sources.length > 0) imageUrl = sources[0];
            }
            if (imageUrl && !linkUrl && linkElement) finalLinkUrl = linkElement.href;
            else if (!imageUrl && linkElement) finalLinkUrl = linkElement.href;
            else finalLinkUrl = linkUrl; // שימוש ב-linkUrl אם נמצא או נשאר null

            if (!finalLinkUrl && htmlString.toLowerCase().startsWith('http')) {
                try { new URL(htmlString); finalLinkUrl = htmlString; } catch (e) {}
            }
            return { linkUrl: finalLinkUrl, imageUrl: imageUrl, rawHtml: htmlString };
        } catch (e) {
            let fallbackLinkUrl = null;
            if (htmlString.toLowerCase().startsWith('http')) {
                try { new URL(htmlString); fallbackLinkUrl = htmlString; } catch (e) {}
            }
            return { linkUrl: fallbackLinkUrl, imageUrl: null, rawHtml: htmlString };
        }
    }
    
    function collectAffiliateProviderData(formElementOrHotelEntry, providerPrefix, isPackageHotel = false, hotelIndex = null) {
        const suffix = isPackageHotel && hotelIndex !== null ? `-${hotelIndex}` : '';
        const dealUrl = formElementOrHotelEntry.querySelector(`#${providerPrefix}-dealurl${suffix}`)?.value.trim() || null;
        const imageUrl = formElementOrHotelEntry.querySelector(`#${providerPrefix}-imageurl${suffix}`)?.value.trim() || null;
        const combinedHtml = formElementOrHotelEntry.querySelector(`#${providerPrefix}-combinedhtml${suffix}`)?.value.trim() || null;
        const extraHtml = formElementOrHotelEntry.querySelector(`#${providerPrefix}-extrahtml${suffix}`)?.value.trim() || null;

        let finalDealUrl = dealUrl;
        let finalImageUrl = imageUrl;

        if (combinedHtml && (!dealUrl || !imageUrl)) {
            const extracted = extractAffiliateDataFromHtml(combinedHtml);
            if (!finalDealUrl && extracted.linkUrl) finalDealUrl = extracted.linkUrl;
            if (!finalImageUrl && extracted.imageUrl) finalImageUrl = extracted.imageUrl;
        }
        
        if (finalDealUrl || finalImageUrl || combinedHtml || extraHtml) {
            return {
                dealUrl: finalDealUrl,
                imageUrl: finalImageUrl,
                combinedHtml: combinedHtml,
                extraHtml: extraHtml,
            };
        }
        return null;
    }


    if (packageDealForm) {
        packageDealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dealId = packageDealIdInput.value;
            const startDate = document.getElementById('package-start-date').value;
            const endDate = document.getElementById('package-end-date').value;
            const selectedTripTypes = Array.from(packageTripTypesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            const hotelsData = [];
            packageHotelsContainer.querySelectorAll('.hotel-entry').forEach(entry => {
                const hotelIndex = entry.dataset.hotelIndex; // קבל את האינדקס הייחודי
                hotelsData.push({
                    name: entry.querySelector(`#p-hotel-name-${hotelIndex}`).value,
                    stars: entry.querySelector(`#p-hotel-stars-${hotelIndex}`).value,
                    affiliateLinks: {
                        booking: collectAffiliateProviderData(entry, `p-hotel-booking`, true, hotelIndex),
                        agoda: collectAffiliateProviderData(entry, `p-hotel-agoda`, true, hotelIndex),
                        expedia: collectAffiliateProviderData(entry, `p-hotel-expedia`, true, hotelIndex)
                    }
                });
            });
            const extraAddonsText = document.getElementById('package-extra-addons').value;
            const availabilityMonthsFromDates = calculateAvailabilityMonths(startDate, endDate);

            const dealData = {
                dealType: "package",
                name: document.getElementById('package-deal-name').value,
                description: document.getElementById('package-deal-description').value,
                price_text: document.getElementById('package-price-text').value,
                exactDatesRange: { start: startDate, end: endDate },
                destinationCountry: document.getElementById('package-country').value,
                destinationCity: document.getElementById('package-city').value,
                flightDetails: {
                    departureAirline: document.getElementById('package-flight-departure-airline').value || null,
                    departureTime: document.getElementById('package-flight-departure-time').value || null,
                    returnAirline: document.getElementById('package-flight-return-airline').value || null,
                    returnTime: document.getElementById('package-flight-return-time').value || null,
                    notes: document.getElementById('package-flight-notes').value || null,
                },
                hotels: hotelsData,
                extraAddons: extraAddonsText ? extraAddonsText.split(',').map(s => s.trim()).filter(s => s) : [],
                imageUrl: document.getElementById('package-image-url').value,
                tripTypes: selectedTripTypes,
                availabilityMonths: availabilityMonthsFromDates,
                updatedAt: serverTimestamp()
            };
            if (!dealId) dealData.createdAt = serverTimestamp();
            await saveData(dealId, dealData, packageModal, packageDealForm, "דיל חבילה");
        });
    }

    if (flightDealForm) { /* ... כמו קודם, רק לוודא שאין התייחסות ל-availabilityMonths מהטופס ... */ }
    
    if (hotelDealForm) {
        hotelDealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dealId = hotelDealIdInput.value;
            const startDate = document.getElementById('hotel-start-date').value;
            const endDate = document.getElementById('hotel-end-date').value;
            const availabilityMonthsFromDates = calculateAvailabilityMonths(startDate, endDate);
            const selectedTripTypes = Array.from(hotelTripTypesContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            const dealData = {
                dealType: "hotel",
                name: document.getElementById('hotel-name').value,
                description: document.getElementById('hotel-description').value,
                stars: document.getElementById('hotel-stars').value || null,
                destinationCountry: document.getElementById('hotel-country').value,
                destinationCity: document.getElementById('hotel-city').value,
                exactDatesRange: { start: startDate, end: endDate },
                price_text: document.getElementById('hotel-price-text').value,
                singleHotelAffiliateLinks: {
                    booking: collectAffiliateProviderData(hotelDealForm, 'hotel-booking'),
                    agoda: collectAffiliateProviderData(hotelDealForm, 'hotel-agoda'),
                    expedia: collectAffiliateProviderData(hotelDealForm, 'hotel-expedia')
                },
                imageUrl: document.getElementById('hotel-image-url').value,
                tripTypes: selectedTripTypes,
                availabilityMonths: availabilityMonthsFromDates,
                updatedAt: serverTimestamp()
            };
            if (!dealId) dealData.createdAt = serverTimestamp();
            await saveData(dealId, dealData, hotelModal, hotelDealForm, "מלון");
        });
    }

    async function saveData(dealId, data, modalToClose, formToReset, itemTypeName) { /* ... כמו קודם ... */ }
    function resetPackageForm() { /* ... כמו קודם, אין שדה חודשים לאפס ... */ }
    function resetFlightForm() { /* ... כמו קודם ... */ }
    function resetHotelForm() { /* ... כמו קודם ... */ }
    async function loadAdminDeals() { /* ... כמו קודם ... */ }
    function getItemTypeDisplay(dealTypeKey) { /* ... כמו קודם ... */ }
    async function handleEditItem(e) { /* ... כמו קודם, אבל צריך לוודא שמילוי השדות של ה-Affiliate תואם את המבנה החדש ... */
        // לדוגמה, בעת עריכת מלון יחיד:
        /*
        if (type === 'hotel') {
            // ...
            const affiliateLinks = itemData.singleHotelAffiliateLinks || {};
            const bookingData = affiliateLinks.booking || {};
            document.getElementById('hotel-booking-dealurl').value = bookingData.dealUrl || '';
            document.getElementById('hotel-booking-imageurl').value = bookingData.imageUrl || '';
            document.getElementById('hotel-booking-combinedhtml').value = bookingData.combinedHtml || '';
            document.getElementById('hotel-booking-extrahtml').value = bookingData.extraHtml || '';
            // וכך הלאה ל-agoda ו-expedia
            // ...
        }
        // הפונקציה addHotelFieldToPackage כבר אמורה לאכלס נכון את השדות במלונות בחבילה
        */
    }
    async function handleDeleteItem(e) { /* ... כמו קודם ... */ }
    
    if (auth.currentUser) { loadAdminDeals(); }
});
