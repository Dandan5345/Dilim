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

    const openPackageModalBtn = document.getElementById('open-package-deal-modal-btn');
    const openFlightModalBtn = document.getElementById('open-flight-deal-modal-btn');
    const openHotelModalBtn = document.getElementById('open-hotel-deal-modal-btn');

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

    if (addPackageHotelBtn) { addPackageHotelBtn.addEventListener('click', () => addHotelFieldToPackage()); }

    function addHotelFieldToPackage(hotelData = null) {
        if (!packageHotelsContainer) return;
        packageHotelFieldCount++;
        const hotelEntryDiv = document.createElement('div');
        hotelEntryDiv.className = 'hotel-entry';
        const fieldSuffix = `_entry${packageHotelFieldCount}`; // סיומת ייחודית יותר

        const bookingData = hotelData?.affiliateLinks?.booking || {};
        const agodaData = hotelData?.affiliateLinks?.agoda || {};
        const expediaData = hotelData?.affiliateLinks?.expedia || {};

        hotelEntryDiv.innerHTML = `
            <h5>מלון <span class="hotel-number">${packageHotelsContainer.children.length + 1}</span></h5>
            <input type="hidden" class="hotel-entry-field-suffix" value="${fieldSuffix}">
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
            <div class="form-group"><label for="p-hotel-booking-dealurl${fieldSuffix}">קישור לדיל:</label><input type="url" id="p-hotel-booking-dealurl${fieldSuffix}" value="${bookingData.dealUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-booking-imageurl${fieldSuffix}">קישור לתמונה:</label><input type="url" id="p-hotel-booking-imageurl${fieldSuffix}" value="${bookingData.imageUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-booking-combinedhtml${fieldSuffix}">קוד HTML (קישור+תמונה):</label><textarea id="p-hotel-booking-combinedhtml${fieldSuffix}" rows="2">${bookingData.combinedHtml || ''}</textarea></div>
            <div class="form-group"><label for="p-hotel-booking-extrahtml${fieldSuffix}">קוד HTML (מפה/באנר):</label><textarea id="p-hotel-booking-extrahtml${fieldSuffix}" rows="2">${bookingData.extraHtml || ''}</textarea></div>
            <h6>Agoda:</h6>
            <div class="form-group"><label for="p-hotel-agoda-dealurl${fieldSuffix}">קישור לדיל:</label><input type="url" id="p-hotel-agoda-dealurl${fieldSuffix}" value="${agodaData.dealUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-agoda-imageurl${fieldSuffix}">קישור לתמונה:</label><input type="url" id="p-hotel-agoda-imageurl${fieldSuffix}" value="${agodaData.imageUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-agoda-combinedhtml${fieldSuffix}">קוד HTML (קישור+תמונה):</label><textarea id="p-hotel-agoda-combinedhtml${fieldSuffix}" rows="2">${agodaData.combinedHtml || ''}</textarea></div>
            <div class="form-group"><label for="p-hotel-agoda-extrahtml${fieldSuffix}">קוד HTML (מפה/באנר):</label><textarea id="p-hotel-agoda-extrahtml${fieldSuffix}" rows="2">${agodaData.extraHtml || ''}</textarea></div>
            <h6>Expedia:</h6>
            <div class="form-group"><label for="p-hotel-expedia-dealurl${fieldSuffix}">קישור לדיל:</label><input type="url" id="p-hotel-expedia-dealurl${fieldSuffix}" value="${expediaData.dealUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-expedia-imageurl${fieldSuffix}">קישור לתמונה:</label><input type="url" id="p-hotel-expedia-imageurl${fieldSuffix}" value="${expediaData.imageUrl || ''}"></div>
            <div class="form-group"><label for="p-hotel-expedia-combinedhtml${fieldSuffix}">קוד HTML (קישור+תמונה):</label><textarea id="p-hotel-expedia-combinedhtml${fieldSuffix}" rows="2">${expediaData.combinedHtml || ''}</textarea></div>
            <div class="form-group"><label for="p-hotel-expedia-extrahtml${fieldSuffix}">קוד HTML (מפה/באנר):</label><textarea id="p-hotel-expedia-extrahtml${fieldSuffix}" rows="2">${expediaData.extraHtml || ''}</textarea></div>
            <button type="button" class="remove-hotel-btn">הסר מלון זה</button>
        `;
        packageHotelsContainer.appendChild(hotelEntryDiv);
        hotelEntryDiv.querySelector('.remove-hotel-btn').addEventListener('click', function() {
            hotelEntryDiv.remove();
            packageHotelsContainer.querySelectorAll('.hotel-entry .hotel-number').forEach((span, idx) => {
                span.textContent = idx + 1;
            });
        });
    }

    onAuthStateChanged(auth, user => {
        if (user) {
            console.log('Auth state: User is logged in -', user.email);
            if (loginSection) loginSection.style.display = 'none';
            if (dashboardSection) dashboardSection.style.display = 'block';
            if (adminUserEmailEl) adminUserEmailEl.textContent = user.email;
            loadAdminDeals();
        } else {
            console.log('Auth state: User is logged out');
            if (loginSection) loginSection.style.display = 'block';
            if (dashboardSection) dashboardSection.style.display = 'none';
            if (adminUserEmailEl) adminUserEmailEl.textContent = '';
            if (adminDealsOutput) adminDealsOutput.innerHTML = '<p style="text-align:center;">יש להתחבר כדי לראות ולנהל פריטים.</p>';
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
            if (!auth) {
                loginError.textContent = "שגיאה קריטית: מערכת האימות לא אותחלה.";
                console.error('Firebase auth object is NOT initialized!');
                return;
            }
            loginButton.disabled = true;
            loginButton.textContent = 'מתחבר...';
            signInWithEmailAndPassword(auth, email, password)
                .catch(error => {
                    let friendlyErrorMessage = "שגיאת התחברות. ";
                    switch (error.code) {
                        case 'auth/invalid-email': friendlyErrorMessage += "כתובת האימייל אינה תקינה."; break;
                        case 'auth/user-disabled': friendlyErrorMessage += "המשתמש נחסם."; break;
                        case 'auth/user-not-found': case 'auth/invalid-credential': friendlyErrorMessage += "אימייל או סיסמה שגויים."; break;
                        case 'auth/wrong-password': friendlyErrorMessage += "סיסמה שגויה."; break;
                        default: friendlyErrorMessage += `קוד שגיאה: ${error.code}`;
                    }
                    loginError.textContent = friendlyErrorMessage;
                })
                .finally(() => {
                    loginButton.disabled = false;
                    loginButton.textContent = 'התחבר';
                });
        });
    } else {
        if (!loginButton) console.error('Login button (ID: login-button) not found!');
        if (!adminEmailInput) console.error('Email input (ID: admin-email) not found!');
        if (!adminPasswordInput) console.error('Password input (ID: admin-password) not found!');
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).catch(error => console.error('Sign out error:', error));
        });
    }

    function extractAffiliateDataFromHtml(htmlString) {
        if (!htmlString || typeof htmlString !== 'string' || htmlString.trim() === "") return { linkUrl: null, imageUrl: null, rawHtml: htmlString || null };
        try {
            const tempDiv = document.createElement('div'); tempDiv.innerHTML = htmlString;
            const linkElement = tempDiv.querySelector('a');
            const imgElement = linkElement ? linkElement.querySelector('img') : tempDiv.querySelector('img');
            let linkUrl = linkElement ? linkElement.href : null;
            let imageUrl = imgElement ? imgElement.src : null;
            if (imgElement && !imageUrl && imgElement.srcset) {
                const sources = imgElement.srcset.split(',').map(s => s.trim().split(' ')[0]);
                if (sources.length > 0) imageUrl = sources[0];
            }
            let finalLinkUrl = linkUrl;
            if (imageUrl && !linkUrl && linkElement) finalLinkUrl = linkElement.href;
            else if (!imageUrl && linkElement) finalLinkUrl = linkElement.href;

            if (!finalLinkUrl && htmlString.toLowerCase().startsWith('http')) { try { new URL(htmlString); finalLinkUrl = htmlString; } catch (e) {} }
            return { linkUrl: finalLinkUrl, imageUrl: imageUrl, rawHtml: htmlString };
        } catch (e) {
            let fallbackLinkUrl = null; if (htmlString.toLowerCase().startsWith('http')) { try { new URL(htmlString); fallbackLinkUrl = htmlString; } catch (err) {} }
            return { linkUrl: fallbackLinkUrl, imageUrl: null, rawHtml: htmlString };
        }
    }

    function collectAffiliateProviderData(formElementOrHotelEntry, providerIdPrefix) {
        const dealUrl = formElementOrHotelEntry.querySelector(`#${providerIdPrefix}-dealurl`)?.value.trim() || null;
        const imageUrl = formElementOrHotelEntry.querySelector(`#${providerIdPrefix}-imageurl`)?.value.trim() || null;
        const combinedHtml = formElementOrHotelEntry.querySelector(`#${providerIdPrefix}-combinedhtml`)?.value.trim() || null;
        const extraHtml = formElementOrHotelEntry.querySelector(`#${providerIdPrefix}-extrahtml`)?.value.trim() || null;
        let finalDealUrl = dealUrl;
        let finalImageUrl = imageUrl;
        if (combinedHtml && (!dealUrl || !imageUrl)) {
            const extracted = extractAffiliateDataFromHtml(combinedHtml);
            if (!finalDealUrl && extracted.linkUrl) finalDealUrl = extracted.linkUrl;
            if (!finalImageUrl && extracted.imageUrl) finalImageUrl = extracted.imageUrl;
        }
        if (finalDealUrl || finalImageUrl || combinedHtml || extraHtml) {
            return { dealUrl: finalDealUrl, imageUrl: finalImageUrl, combinedHtml: combinedHtml, extraHtml: extraHtml };
        }
        return null;
    }

    function collectPackageHotelAffiliateProviderData(hotelEntryDiv, providerName, fieldSuffix) {
        const dealUrl = hotelEntryDiv.querySelector(`#p-hotel-${providerName}-dealurl${fieldSuffix}`)?.value.trim() || null;
        const imageUrl = hotelEntryDiv.querySelector(`#p-hotel-${providerName}-imageurl${fieldSuffix}`)?.value.trim() || null;
        const combinedHtml = hotelEntryDiv.querySelector(`#p-hotel-${providerName}-combinedhtml${fieldSuffix}`)?.value.trim() || null;
        const extraHtml = hotelEntryDiv.querySelector(`#p-hotel-${providerName}-extrahtml${fieldSuffix}`)?.value.trim() || null;
        let finalDealUrl = dealUrl;
        let finalImageUrl = imageUrl;
        if (combinedHtml && (!dealUrl || !imageUrl)) {
            const extracted = extractAffiliateDataFromHtml(combinedHtml);
            if (!finalDealUrl && extracted.linkUrl) finalDealUrl = extracted.linkUrl;
            if (!finalImageUrl && extracted.imageUrl) finalImageUrl = extracted.imageUrl;
        }
        if (finalDealUrl || finalImageUrl || combinedHtml || extraHtml) {
            return { dealUrl: finalDealUrl, imageUrl: finalImageUrl, combinedHtml: combinedHtml, extraHtml: extraHtml };
        }
        return null;
    }

    function calculateAvailabilityMonths(startDateStr, endDateStr) {
        const months = [];
        if (startDateStr && endDateStr) {
            try {
                const start = new Date(startDateStr);
                const end = new Date(endDateStr);
                if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
                let current = new Date(start.getFullYear(), start.getMonth(), 1);
                const lastMonthDate = new Date(end.getFullYear(), end.getMonth(), 1);
                while(current <= lastMonthDate) {
                    const year = current.getFullYear();
                    const monthNum = current.getMonth() + 1;
                    const month = monthNum.toString().padStart(2, '0');
                    months.push(`${year}-${month}`);
                    if (monthNum === 12) current = new Date(year + 1, 0, 1);
                    else current = new Date(year, monthNum, 1);
                }
            } catch (e) { console.error("Error calculating availability months:", e); return []; }
        }
        return months;
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
                const fieldSuffix = entry.querySelector('.hotel-entry-field-suffix').value;
                hotelsData.push({
                    name: entry.querySelector(`#p-hotel-name${fieldSuffix}`).value,
                    stars: entry.querySelector(`#p-hotel-stars${fieldSuffix}`).value,
                    affiliateLinks: {
                        booking: collectPackageHotelAffiliateProviderData(entry, `booking`, fieldSuffix),
                        agoda: collectPackageHotelAffiliateProviderData(entry, `agoda`, fieldSuffix),
                        expedia: collectPackageHotelAffiliateProviderData(entry, `expedia`, fieldSuffix)
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

    if (flightDealForm) {
        flightDealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dealId = flightDealIdInput.value;
            const startDate = document.getElementById('flight-start-date').value;
            const endDate = document.getElementById('flight-end-date').value;
            const availabilityMonthsFromDates = calculateAvailabilityMonths(startDate, endDate);
            const dealData = {
                dealType: "flight",
                name: document.getElementById('flight-title').value,
                flightOrigin: document.getElementById('flight-origin').value,
                flightDestination: document.getElementById('flight-destination').value,
                exactDatesRange: { start: startDate, end: endDate },
                airline: document.getElementById('flight-airline').value,
                price_text: document.getElementById('flight-price-text').value,
                imageUrl: document.getElementById('flight-image-url').value || null,
                flightDetails: { notes: document.getElementById('flight-notes-standalone').value || null },
                availabilityMonths: availabilityMonthsFromDates,
                tripTypes: [], // טיסות בדרך כלל לא מקוטלגות לפי סוג טיול באותה צורה
                updatedAt: serverTimestamp()
            };
            if (!dealId) dealData.createdAt = serverTimestamp();
            await saveData(dealId, dealData, flightModal, flightDealForm, "טיסה");
        });
    }

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

    async function saveData(dealId, data, modalToClose, formToReset, itemTypeName) {
        const saveButton = formToReset.querySelector('button[type="submit"]');
        const originalButtonText = saveButton ? saveButton.textContent : "שמור";
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = 'שומר...';
        }
        try {
            if (dealId) {
                const dealDocRef = doc(db, 'deals', dealId);
                await updateDoc(dealDocRef, data);
                alert(`${itemTypeName} עודכן בהצלחה!`);
            } else {
                await addDoc(dealsCollectionRef, data);
                alert(`${itemTypeName} נוסף בהצלחה!`);
            }
            if(formToReset.id === 'package-deal-form') resetPackageForm();
            else if(formToReset.id === 'flight-deal-form') resetFlightForm();
            else if(formToReset.id === 'hotel-deal-form') resetHotelForm();
            closeModal(modalToClose);
            loadAdminDeals();
        } catch (error) {
            console.error(`Error saving ${itemTypeName}:`, error);
            alert(`שגיאה בשמירת ה${itemTypeName.toLowerCase()}: ` + error.message);
        } finally {
            if(saveButton){
                 saveButton.disabled = false;
                 saveButton.textContent = originalButtonText;
            }
        }
    }

    function resetPackageForm() {
        if(packageDealForm) packageDealForm.reset();
        if(packageDealIdInput) packageDealIdInput.value = '';
        if(packageHotelsContainer) packageHotelsContainer.innerHTML = '';
        packageHotelFieldCount = 0;
        if(packageTripTypesContainer) packageTripTypesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        if(packageModalTitle) packageModalTitle.textContent = 'יצירת דיל חדש (חבילה)';
        if(packageSaveButton) packageSaveButton.textContent = "שמור דיל חבילה";
    }
    function resetFlightForm() {
        if(flightDealForm) flightDealForm.reset();
        if(flightDealIdInput) flightDealIdInput.value = '';
        if(flightModalTitle) flightModalTitle.textContent = 'הוספת טיסה שווה';
        if(flightSaveButton) flightSaveButton.textContent = "שמור טיסה";
    }
    function resetHotelForm() {
        if(hotelDealForm) hotelDealForm.reset();
        if(hotelDealIdInput) hotelDealIdInput.value = '';
        if(hotelTripTypesContainer) hotelTripTypesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        if(hotelModalTitle) hotelModalTitle.textContent = 'הוספת מלון שווה';
        if(hotelSaveButton) hotelSaveButton.textContent = "שמור מלון";
    }

    async function loadAdminDeals() {
        if (!adminDealsOutput) {
            console.warn("adminDealsOutput element not found, cannot load deals.");
            return;
        }
        adminDealsOutput.innerHTML = '<p style="text-align:center;">טוען פריטים...</p>';
        try {
            const q = query(dealsCollectionRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                adminDealsOutput.innerHTML = '<p style="text-align:center;">אין פריטים להצגה. הוסף פריט חדש!</p>';
                return;
            }
            let html = '<ul>';
            querySnapshot.forEach((docSnapshot) => {
                const item = docSnapshot.data();
                const id = docSnapshot.id;
                let itemTypeDisplay = getItemTypeDisplay(item.dealType);
                let datesDisplay = '';
                if (item.exactDatesRange?.start && item.exactDatesRange?.end) {
                    try {
                        datesDisplay = ` | ${new Date(item.exactDatesRange.start).toLocaleDateString('he-IL', {day:'2-digit', month:'2-digit', year:'numeric'})} - ${new Date(item.exactDatesRange.end).toLocaleDateString('he-IL', {day:'2-digit', month:'2-digit', year:'numeric'})}`;
                    } catch (e) { datesDisplay = " | תאריכים לא תקינים"; }
                }

                html += `
                    <li>
                        <div>
                            <strong>${item.name || 'פריט ללא שם'}</strong> <br>
                            <small>סוג: ${itemTypeDisplay}${datesDisplay} | מחיר: ${item.price_text || 'לא צוין'}</small>
                            ${item.dealType === 'package' ? `<small>יעד: ${item.destinationCity || ''}, ${item.destinationCountry || ''}</small>` : ''}
                            ${item.dealType === 'flight' ? `<small>קו: ${item.flightOrigin || ''} ←→ ${item.flightDestination || ''} (${item.airline || 'לא צוינה חברה'})</small>` : ''}
                            ${item.dealType === 'hotel' ? `<small>מיקום: ${item.destinationCity || ''}, ${item.destinationCountry || ''} (${item.stars || '?'} כוכבים)</small>` : ''}
                            <small>נוצר: ${item.createdAt?.toDate().toLocaleString('he-IL', {dateStyle: 'short', timeStyle: 'short'}) || 'לא זמין'}</small>
                        </div>
                        <div>
                            <button data-id="${id}" data-type="${item.dealType}" class="edit-item button button-secondary" style="padding:6px 12px; font-size:0.85em; margin-bottom: 5px;">ערוך</button>
                            <button data-id="${id}" class="delete-item" style="background-color:#dc3545; color:white; border:none; border-radius:4px; padding:6px 12px; font-size:0.85em; cursor:pointer;">מחק</button>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            adminDealsOutput.innerHTML = html;

            document.querySelectorAll('.edit-item').forEach(button => {
                button.addEventListener('click', handleEditItem);
            });
            document.querySelectorAll('.delete-item').forEach(button => {
                button.addEventListener('click', handleDeleteItem);
            });

        } catch (error) {
            console.error('Error loading admin items:', error);
            adminDealsOutput.innerHTML = '<p style="text-align:center; color:red;">שגיאה בטעינת הפריטים.</p>';
        }
    }

    function getItemTypeDisplay(dealTypeKey) {
        const types = { flight: 'טיסה', hotel: 'מלון', package: 'חבילה' };
        return types[dealTypeKey] || dealTypeKey || 'לא צוין';
    }

    async function handleEditItem(e) {
        const id = e.target.dataset.id;
        const type = e.target.dataset.type;

        try {
            const itemDocRef = doc(db, 'deals', id);
            const docSnap = await getDoc(itemDocRef);

            if (docSnap.exists()) {
                const itemData = docSnap.data();
                let targetModal, idInput, form, currentModalTitleEl, currentSaveBtnEl, titleText, saveBtnText;

                // קבע את המודאל, הטופס, הכותרת וכפתור השמירה לפי סוג הפריט
                if (type === 'package') {
                    targetModal = packageModal; idInput = packageDealIdInput; form = packageDealForm;
                    currentModalTitleEl = packageModalTitle; currentSaveBtnEl = packageSaveButton;
                    titleText = 'עריכת דיל חבילה'; saveBtnText = 'עדכן דיל חבילה';
                    resetPackageForm();
                    // אכלוס שדות ספציפיים לחבילה
                    document.getElementById('package-deal-name').value = itemData.name || '';
                    document.getElementById('package-deal-description').value = itemData.description || '';
                    document.getElementById('package-price-text').value = itemData.price_text || '';
                    document.getElementById('package-start-date').value = itemData.exactDatesRange?.start || '';
                    document.getElementById('package-end-date').value = itemData.exactDatesRange?.end || '';
                    document.getElementById('package-country').value = itemData.destinationCountry || '';
                    document.getElementById('package-city').value = itemData.destinationCity || '';
                    document.getElementById('package-flight-departure-airline').value = itemData.flightDetails?.departureAirline || '';
                    document.getElementById('package-flight-departure-time').value = itemData.flightDetails?.departureTime || '';
                    document.getElementById('package-flight-return-airline').value = itemData.flightDetails?.returnAirline || '';
                    document.getElementById('package-flight-return-time').value = itemData.flightDetails?.returnTime || '';
                    document.getElementById('package-flight-notes').value = itemData.flightDetails?.notes || '';
                    if(packageHotelsContainer) packageHotelsContainer.innerHTML = ''; packageHotelFieldCount = 0;
                    if (itemData.hotels && Array.isArray(itemData.hotels)) {
                        itemData.hotels.forEach(hotel => addHotelFieldToPackage(hotel));
                    }
                    document.getElementById('package-extra-addons').value = (itemData.extraAddons || []).join(', ');
                    document.getElementById('package-image-url').value = itemData.imageUrl || '';
                    if(packageTripTypesContainer && itemData.tripTypes) itemData.tripTypes.forEach(val => { const cb = packageTripTypesContainer.querySelector(`input[value="${val}"]`); if(cb) cb.checked = true; });

                } else if (type === 'flight') {
                    targetModal = flightModal; idInput = flightDealIdInput; form = flightDealForm;
                    currentModalTitleEl = flightModalTitle; currentSaveBtnEl = flightSaveButton;
                    titleText = 'עריכת טיסה'; saveBtnText = 'עדכן טיסה';
                    resetFlightForm();
                    // אכלוס שדות ספציפיים לטיסה
                    document.getElementById('flight-title').value = itemData.name || '';
                    document.getElementById('flight-origin').value = itemData.flightOrigin || '';
                    document.getElementById('flight-destination').value = itemData.flightDestination || '';
                    document.getElementById('flight-start-date').value = itemData.exactDatesRange?.start || '';
                    document.getElementById('flight-end-date').value = itemData.exactDatesRange?.end || '';
                    document.getElementById('flight-airline').value = itemData.airline || '';
                    document.getElementById('flight-price-text').value = itemData.price_text || '';
                    document.getElementById('flight-image-url').value = itemData.imageUrl || '';
                    document.getElementById('flight-notes-standalone').value = itemData.flightDetails?.notes || '';

                } else if (type === 'hotel') {
                    targetModal = hotelModal; idInput = hotelDealIdInput; form = hotelDealForm;
                    currentModalTitleEl = hotelModalTitle; currentSaveBtnEl = hotelSaveButton;
                    titleText = 'עריכת מלון'; saveBtnText = 'עדכן מלון';
                    resetHotelForm();
                    // אכלוס שדות ספציפיים למלון
                    document.getElementById('hotel-name').value = itemData.name || '';
                    document.getElementById('hotel-description').value = itemData.description || '';
                    document.getElementById('hotel-stars').value = itemData.stars || '';
                    document.getElementById('hotel-country').value = itemData.destinationCountry || '';
                    document.getElementById('hotel-city').value = itemData.destinationCity || '';
                    document.getElementById('hotel-start-date').value = itemData.exactDatesRange?.start || '';
                    document.getElementById('hotel-end-date').value = itemData.exactDatesRange?.end || '';
                    document.getElementById('hotel-price-text').value = itemData.price_text || '';
                    const affiliateLinks = itemData.singleHotelAffiliateLinks || {};
                    ['booking', 'agoda', 'expedia'].forEach(provider => {
                        const providerData = affiliateLinks[provider] || {};
                        document.getElementById(`hotel-${provider}-dealurl`).value = providerData.dealUrl || '';
                        document.getElementById(`hotel-${provider}-imageurl`).value = providerData.imageUrl || '';
                        document.getElementById(`hotel-${provider}-combinedhtml`).value = providerData.combinedHtml || '';
                        document.getElementById(`hotel-${provider}-extrahtml`).value = providerData.extraHtml || '';
                    });
                    document.getElementById('hotel-image-url').value = itemData.imageUrl || '';
                    if(hotelTripTypesContainer && itemData.tripTypes) itemData.tripTypes.forEach(val => { const cb = hotelTripTypesContainer.querySelector(`input[value="${val}"]`); if(cb) cb.checked = true; });
                } else {
                    alert("סוג פריט לא ידוע לעריכה.");
                    return;
                }

                if (idInput) idInput.value = id;
                if (currentModalTitleEl) currentModalTitleEl.textContent = titleText;
                if (currentSaveBtnEl) currentSaveBtnEl.textContent = saveBtnText;
                if (targetModal) openModal(targetModal);

            } else {
                alert("לא נמצא פריט לעריכה.");
            }
        } catch (error) {
            console.error("Error fetching item for edit:", error);
            alert("שגיאה בטעינת הפריט לעריכה: " + error.message);
        }
    }

    async function handleDeleteItem(e) {
        const id = e.target.dataset.id;
        if (confirm('האם אתה בטוח שברצונך למחוק פריט זה? הפעולה אינה הפיכה.')) {
            try {
                const itemDocRef = doc(db, 'deals', id);
                await deleteDoc(itemDocRef);
                alert('הפריט נמחק בהצלחה!');
                loadAdminDeals();
            } catch (error) {
                console.error('Error deleting item:', error);
                alert('שגיאה במחיקת הפריט: ' + error.message);
            }
        }
    }

    if (auth.currentUser) {
        loadAdminDeals();
    }
});
