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

// הגדרות קבועות
const ALL_TRIP_TYPES = [
    "בטן גב", "נופים וטבע", "עיר אירופאית", "ארצות הברית", "מזרח רחוק", 
    "שווקי קריסמס", "סקי", "טרקים", "קרוז", "ספארי", "ירח דבש", "משפחות"
];

function getNextMonthsAvailability(numberOfMonths = 12) {
    const months = [];
    const currentDate = new Date();
    for (let i = 0; i < numberOfMonths; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // חודש ב-2 ספרות
        const monthName = date.toLocaleString('he-IL', { month: 'long' });
        months.push({ value: `${year}-${month}`, label: `${monthName} ${year}` });
    }
    return months;
}
const AVAILABLE_MONTHS_OPTIONS = getNextMonthsAvailability(24); // שנתיים קדימה

document.addEventListener('DOMContentLoaded', function () {
    // ... (קוד קיים של הגדרת משתנים כמו loginSection, dashboardSection וכו' - ללא שינוי)
    const loginSection = document.getElementById('admin-login');
    const dashboardSection = document.getElementById('admin-dashboard');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const loginError = document.getElementById('login-error');
    const adminUserEmailEl = document.getElementById('admin-user-email');

    const dealForm = document.getElementById('deal-form');
    const formTitle = document.getElementById('form-title');
    const dealIdInput = document.getElementById('deal-id');
    const dealNameInput = document.getElementById('deal-name');
    const dealDescriptionInput = document.getElementById('deal-description');
    const dealPriceTextInput = document.getElementById('deal-price-text');
    const dealTypeSelect = document.getElementById('deal-type-select');
    const dealImageUrlInput = document.getElementById('deal-image-url');
    
    const tripTypesCheckboxesContainer = document.getElementById('trip-types-checkboxes');
    const availabilityMonthsCheckboxesContainer = document.getElementById('availability-months-checkboxes');
    
    const flightDetailsSection = document.getElementById('flight-details-section');
    const flightNotesInput = document.getElementById('flight-notes');
    const singleHotelAffiliatesSection = document.getElementById('single-hotel-affiliates-section');
    const singleAffiliateBookingInput = document.getElementById('single-affiliate-booking');
    const singleAffiliateAgodaInput = document.getElementById('single-affiliate-agoda');
    const singleAffiliateExpediaInput = document.getElementById('single-affiliate-expedia');

    const multipleHotelsSection = document.getElementById('multiple-hotels-section');
    const hotelsContainer = document.getElementById('hotels-container');
    const addHotelBtn = document.getElementById('add-hotel-btn');

    const saveDealButton = document.getElementById('save-deal-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const adminDealsOutput = document.getElementById('admin-deals-output');

    const dealsCollectionRef = collection(db, 'deals');

    // פונקציה לאתחול Checkboxes
    function populateCheckboxes(container, options, groupName) {
        container.innerHTML = '';
        options.forEach(option => {
            const item = typeof option === 'string' ? { value: option, label: option } : option;
            const checkboxId = `${groupName}-${item.value.replace(/\s+/g, '-')}`;
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
                <input type="checkbox" id="${checkboxId}" name="${groupName}" value="${item.value}">
                <label for="${checkboxId}">${item.label}</label>
            `;
            container.appendChild(div);
        });
    }

    // אתחול Checkboxes לסוגי טיול וחודשי זמינות
    populateCheckboxes(tripTypesCheckboxesContainer, ALL_TRIP_TYPES, 'tripType');
    populateCheckboxes(availabilityMonthsCheckboxesContainer, AVAILABLE_MONTHS_OPTIONS, 'availabilityMonth');

    // הצג/הסתר שדות לפי סוג הדיל
    dealTypeSelect.addEventListener('change', adjustFormFields);
    function adjustFormFields() {
        const selectedType = dealTypeSelect.value;
        
        flightDetailsSection.classList.toggle('hidden-field', selectedType !== 'flight' && selectedType !== 'package');
        singleHotelAffiliatesSection.classList.toggle('hidden-field', selectedType !== 'hotel');
        multipleHotelsSection.classList.toggle('hidden-field', selectedType !== 'package');

        if (selectedType === 'hotel') { // אם זה דיל "מלון בלבד", אולי נרצה לנקות את המלונות המרובים
            hotelsContainer.innerHTML = ''; 
        }
        if (selectedType === 'package' && hotelsContainer.children.length === 0) {
            addHotelField(); // הוסף אוטומטית שדה מלון ראשון לחבילה אם אין
        }
    }

    // ניהול מלונות מרובים
    let hotelFieldCount = 0;
    if (addHotelBtn) {
        addHotelBtn.addEventListener('click', addHotelField);
    }

    function addHotelField(hotelData = null) {
        hotelFieldCount++;
        const hotelEntryDiv = document.createElement('div');
        hotelEntryDiv.className = 'hotel-entry';
        hotelEntryDiv.dataset.hotelIndex = hotelFieldCount;

        hotelEntryDiv.innerHTML = `
            <h5>מלון ${hotelFieldCount}</h5>
            <div class="form-group">
                <label for="hotel-name-${hotelFieldCount}">שם המלון:</label>
                <input type="text" id="hotel-name-${hotelFieldCount}" name="hotelName" value="${hotelData?.name || ''}" required>
            </div>
            <div class="form-group">
                <label for="hotel-description-${hotelFieldCount}">תיאור קצר למלון:</label>
                <textarea id="hotel-description-${hotelFieldCount}" name="hotelDescription" rows="2">${hotelData?.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label for="hotel-booking-${hotelFieldCount}">קישור Booking.com:</label>
                <input type="text" id="hotel-booking-${hotelFieldCount}" name="hotelBookingLink" value="${hotelData?.affiliateLinks?.booking || ''}">
            </div>
            <div class="form-group">
                <label for="hotel-agoda-${hotelFieldCount}">קישור Agoda:</label>
                <input type="text" id="hotel-agoda-${hotelFieldCount}" name="hotelAgodaLink" value="${hotelData?.affiliateLinks?.agoda || ''}">
            </div>
            <div class="form-group">
                <label for="hotel-expedia-${hotelFieldCount}">קישור Expedia:</label>
                <input type="text" id="hotel-expedia-${hotelFieldCount}" name="hotelExpediaLink" value="${hotelData?.affiliateLinks?.expedia || ''}">
            </div>
            <button type="button" class="remove-hotel-btn">הסר מלון זה</button>
        `;
        hotelsContainer.appendChild(hotelEntryDiv);

        hotelEntryDiv.querySelector('.remove-hotel-btn').addEventListener('click', function() {
            hotelEntryDiv.remove();
            // אין צורך לעדכן hotelFieldCount כאן כי זה רק אינדקס לשמות השדות.
        });
    }
    
    // --- התחלה: קוד אימות והתחברות (קיים) ---
    onAuthStateChanged(auth, user => {
        if (user) {
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            if (adminUserEmailEl) adminUserEmailEl.textContent = user.email;
            loadAdminDeals();
            adjustFormFields(); // קריאה ראשונית להתאמת הטופס
        } else {
            loginSection.style.display = 'block';
            dashboardSection.style.display = 'none';
            if (adminUserEmailEl) adminUserEmailEl.textContent = '';
        }
    });

    if (loginButton) {
        loginButton.addEventListener('click', () => {
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            loginError.textContent = '';
            signInWithEmailAndPassword(auth, email, password)
                .catch(error => {
                    loginError.textContent = "שגיאת התחברות: " + error.message;
                });
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth);
        });
    }
    // --- סוף: קוד אימות והתחברות ---

    // שמירת דיל (הוספה או עדכון)
    if (dealForm) {
        dealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dealId = dealIdInput.value;

            // איסוף סוגי טיול שנבחרו
            const selectedTripTypes = [];
            tripTypesCheckboxesContainer.querySelectorAll('input[name="tripType"]:checked').forEach(cb => {
                selectedTripTypes.push(cb.value);
            });

            // איסוף חודשי זמינות שנבחרו
            const selectedAvailabilityMonths = [];
            availabilityMonthsCheckboxesContainer.querySelectorAll('input[name="availabilityMonth"]:checked').forEach(cb => {
                selectedAvailabilityMonths.push(cb.value);
            });
            
            // איסוף נתוני מלונות (אם רלוונטי)
            const hotelsData = [];
            if (dealTypeSelect.value === 'package') {
                hotelsContainer.querySelectorAll('.hotel-entry').forEach(entry => {
                    const index = entry.dataset.hotelIndex;
                    hotelsData.push({
                        name: entry.querySelector(`#hotel-name-${index}`).value,
                        description: entry.querySelector(`#hotel-description-${index}`).value,
                        affiliateLinks: {
                            booking: entry.querySelector(`#hotel-booking-${index}`).value || null,
                            agoda: entry.querySelector(`#hotel-agoda-${index}`).value || null,
                            expedia: entry.querySelector(`#hotel-expedia-${index}`).value || null,
                        }
                    });
                });
            }
            
            let singleHotelAffiliateLinksData = null;
            if (dealTypeSelect.value === 'hotel') {
                singleHotelAffiliateLinksData = {
                    booking: singleAffiliateBookingInput.value || null,
                    agoda: singleAffiliateAgodaInput.value || null,
                    expedia: singleAffiliateExpediaInput.value || null,
                };
            }


            const dealData = {
                name: dealNameInput.value,
                description: dealDescriptionInput.value,
                price_text: dealPriceTextInput.value,
                dealType: dealTypeSelect.value, // שונה מ-type ל-dealType
                imageUrl: dealImageUrlInput.value,
                tripTypes: selectedTripTypes,
                availabilityMonths: selectedAvailabilityMonths,
                flightDetails: (dealTypeSelect.value === 'flight' || dealTypeSelect.value === 'package') ? { notes: flightNotesInput.value } : null,
                hotels: (dealTypeSelect.value === 'package') ? hotelsData : [], // למלון בודד, הנתונים ב-singleHotelAffiliateLinks
                singleHotelAffiliateLinks: singleHotelAffiliateLinksData, // לדיל "מלון בלבד"
                updatedAt: serverTimestamp()
            };

            if (!dealId) {
                dealData.createdAt = serverTimestamp();
            }

            try {
                saveDealButton.disabled = true;
                saveDealButton.textContent = 'שומר...';

                if (dealId) {
                    const dealDocRef = doc(db, 'deals', dealId);
                    await updateDoc(dealDocRef, dealData);
                    alert('הדיל עודכן בהצלחה!');
                } else {
                    await addDoc(dealsCollectionRef, dealData);
                    alert('הדיל נוסף בהצלחה!');
                }
                resetForm();
                loadAdminDeals();
            } catch (error) {
                console.error('Error saving deal:', error);
                alert('שגיאה בשמירת הדיל: ' + error.message);
            } finally {
                saveDealButton.disabled = false;
                // הטקסט של הכפתור יתעדכן בפונקציית resetForm או handleEditDeal
            }
        });
    }
    
    function resetForm() {
        dealForm.reset();
        dealIdInput.value = '';
        formTitle.textContent = 'הוסף דיל חדש';
        saveDealButton.textContent = 'שמור דיל';
        cancelEditButton.style.display = 'none';
        hotelsContainer.innerHTML = ''; // נקה שדות מלון
        hotelFieldCount = 0;
        // נקה checkboxes
        tripTypesCheckboxesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        availabilityMonthsCheckboxesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        adjustFormFields(); // התאם מחדש את השדות הנראים
    }


    // טעינת דילים להצגה בניהול
    async function loadAdminDeals() {
        // ... (קוד קיים, אולי נצטרך להתאים את התצוגה כאן כדי להראות חלק מהשדות החדשים)
        if (!adminDealsOutput) return;
        adminDealsOutput.innerHTML = '<p>טוען דילים...</p>';
        try {
            const q = query(dealsCollectionRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                adminDealsOutput.innerHTML = '<p>אין דילים להצגה. הוסף דיל חדש!</p>';
                return;
            }
            let html = '<ul>';
            querySnapshot.forEach((docSnapshot) => {
                const deal = docSnapshot.data();
                const id = docSnapshot.id;
                html += `
                    <li>
                        <div>
                            <strong>${deal.name}</strong> <br>
                            <small>סוג דיל: ${getDealTypeDisplay(deal.dealType)} | מחיר: ${deal.price_text}</small><br>
                            <small>סוגי טיול: ${deal.tripTypes?.join(', ') || 'לא צוין'}</small><br>
                            <small>נוצר: ${deal.createdAt?.toDate().toLocaleString('he-IL') || 'לא זמין'}</small>
                        </div>
                        <div>
                            <button data-id="${id}" class="edit-deal button-secondary" style="padding:5px 10px; font-size:0.8em;">ערוך</button>
                            <button data-id="${id}" class="delete-deal" style="background-color:#dc3545; padding:5px 10px; font-size:0.8em;">מחק</button>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            adminDealsOutput.innerHTML = html;

            document.querySelectorAll('.edit-deal').forEach(button => {
                button.addEventListener('click', handleEditDeal);
            });
            document.querySelectorAll('.delete-deal').forEach(button => {
                button.addEventListener('click', handleDeleteDeal);
            });

        } catch (error) {
            console.error('Error loading admin deals:', error);
            adminDealsOutput.innerHTML = '<p>שגיאה בטעינת הדילים.</p>';
        }
    }

    // טיפול בעריכת דיל
    async function handleEditDeal(e) {
        const id = e.target.dataset.id;
        try {
            const dealDocRef = doc(db, 'deals', id);
            const docSnap = await getDoc(dealDocRef);

            if (docSnap.exists()) {
                const deal = docSnap.data();
                resetForm(); // איפוס ראשוני של הטופס כולל checkboxes

                formTitle.textContent = 'ערוך דיל קיים';
                dealIdInput.value = id;
                dealNameInput.value = deal.name || '';
                dealDescriptionInput.value = deal.description || '';
                dealPriceTextInput.value = deal.price_text || '';
                dealTypeSelect.value = deal.dealType || 'package';
                dealImageUrlInput.value = deal.imageUrl || '';

                // שחזור בחירת סוגי טיול
                if (deal.tripTypes && Array.isArray(deal.tripTypes)) {
                    deal.tripTypes.forEach(typeValue => {
                        const checkbox = tripTypesCheckboxesContainer.querySelector(`input[value="${typeValue}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                }
                // שחזור בחירת חודשי זמינות
                if (deal.availabilityMonths && Array.isArray(deal.availabilityMonths)) {
                    deal.availabilityMonths.forEach(monthValue => {
                        const checkbox = availabilityMonthsCheckboxesContainer.querySelector(`input[value="${monthValue}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                }
                
                flightNotesInput.value = deal.flightDetails?.notes || '';
                
                // שחזור קישורי Affiliate למלון יחיד
                if (deal.dealType === 'hotel' && deal.singleHotelAffiliateLinks) {
                    singleAffiliateBookingInput.value = deal.singleHotelAffiliateLinks.booking || '';
                    singleAffiliateAgodaInput.value = deal.singleHotelAffiliateLinks.agoda || '';
                    singleAffiliateExpediaInput.value = deal.singleHotelAffiliateLinks.expedia || '';
                }


                // שחזור מלונות מרובים
                hotelsContainer.innerHTML = ''; // נקה מלונות קיימים מהטופס
                hotelFieldCount = 0; // אפס את המונה הגלובלי לפני הוספה מחדש
                if (deal.dealType === 'package' && deal.hotels && Array.isArray(deal.hotels)) {
                    deal.hotels.forEach(hotelData => {
                        addHotelField(hotelData);
                    });
                }
                
                adjustFormFields(); // התאם את השדות הנראים לפי סוג הדיל שנטען

                saveDealButton.textContent = 'עדכן דיל';
                cancelEditButton.style.display = 'inline-block';
                dealForm.scrollIntoView({ behavior: 'smooth' });
            }
        } catch (error) {
            console.error("Error fetching deal for edit:", error);
            alert("שגיאה בטעינת הדיל לעריכה.");
        }
    }
    
    // ביטול עריכה
    if(cancelEditButton) {
        cancelEditButton.addEventListener('click', resetForm);
    }

    // טיפול במחיקת דיל (קוד קיים)
    async function handleDeleteDeal(e) {
        const id = e.target.dataset.id;
        if (confirm('האם אתה בטוח שברצונך למחוק דיל זה? הפעולה אינה הפיכה.')) {
            try {
                const dealDocRef = doc(db, 'deals', id);
                await deleteDoc(dealDocRef);
                alert('הדיל נמחק בהצלחה!');
                loadAdminDeals();
            } catch (error) {
                console.error('Error deleting deal:', error);
                alert('שגיאה במחיקת הדיל.');
            }
        }
    }

    function getDealTypeDisplay(dealTypeKey) {
        if (dealTypeKey === 'flight') return 'טיסה';
        if (dealTypeKey === 'hotel') return 'מלון';
        if (dealTypeKey === 'package') return 'חבילה';
        return dealTypeKey || 'לא צוין';
    }
    
    // קריאה ראשונית להתאמת הטופס (אם המשתמש כבר מחובר והטופס מוצג)
    if (auth.currentUser) {
        adjustFormFields();
    }

});
