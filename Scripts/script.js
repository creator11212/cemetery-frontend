/**
 * ============================================================================
 * CEMETERY MANAGEMENT SYSTEM - MAIN SCRIPT
 * Architecture: 
 * 1. Global State & Config
 * 2. Auth & User Management (Login, Logout, Change Password)
 * 3. UI & Utility Systems (Plot List, Search, Upload Excel)
 * 4. Plot Detail & Edit Engine (Show, Update, Delete Graves/Plots)
 * 5. Map & Navigation Engine (Leaflet, GPS, Pathfinding)
 * ============================================================================
 */


/* ============================================================================
 * 1. GLOBAL STATE & CONFIGURATION
 * ============================================================================ */
const Toast = Swal.mixin({
    toast: true,
    position: 'top',
    background: "rgba(239, 68, 68, 0.75)",
    showConfirmButton: false,
    timerProgressBar: true,
    customClass: { popup: 'capsule-toast' }
});

const plotCenters = {}; 
let cemeteryMap = null;

// Navigation & GPS Globals
window.isSelectingStart = false; 
let currentRouteStart = null; 
let currentRouteEnd = null;   
let customStartMarker = null; 
let routingNetwork = null;   
let pathFinderEngine = null; 
let networkNodes = null;     
let currentRouteLayer = null;
let gpsMarker = null;


/* ============================================================================
 * 2. AUTH & USER MANAGEMENT (Login, Logout, Change Password)
 * ============================================================================ */

// --- Login Logic ---
const loginLink = document.getElementById('loginBtn');
const workerBox = document.querySelector('.worker');
const loginConfirmBtn = document.getElementById('loginconfbt');
const loginPage = document.querySelector('.loginpage');

loginLink?.addEventListener('click', function(e) {
    e.preventDefault(); 
    workerBox.classList.add('active');
    setTimeout(() => {
        const icons = workerBox.querySelectorAll('i:not(.icon-btn i), p:not(.passfield p)');
        icons.forEach(el => {
            el.style.opacity = '0'; 
            el.style.pointerEvents = 'none';
        });
    }, 400);
});

loginConfirmBtn?.addEventListener('click', async function(e) {
    e.preventDefault();
    const passInput = document.querySelector('.passfield input');
    const password = passInput.value;

    try {
        const response = await fetch('https://cemetery-backend.onrender.com/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password })
        });
        const result = await response.json();

        if (response.ok && result.success) {
            loginPage.classList.add('exit');
            document.body.classList.add('is-mainpage');

            setTimeout(() => {
                loginPage.style.display = 'none';
                const mainPage = document.querySelector('.mainpage');
                mainPage.style.display = 'flex';
                
                setTimeout(() => {
                    mainPage.classList.add('show');
                    initPlotListSystem();
                    initCemeteryMap();
                }, 200); 
            }, 800);
        } else {
            Toast.fire({ icon: 'error', title: 'Password Error', text: result.detail || "please try again.", timer: 4000 });
            passInput.value = "";
        }
    } catch (error) {
        Toast.fire({ icon: 'error', title: 'Server Offline', text: "Please wait a moment.", timer: 2500 });
    }
});

// --- Logout Logic (Long Press Back Button) ---
(function initLogoutSystem() {
    const backBt = document.getElementById('backbt');
    let longPressTimer;

    function performLogout() {
        const mainPage = document.querySelector('.mainpage'); 
        const loginPage = document.querySelector('.loginpage');
        if (!mainPage || !loginPage) return;

        mainPage.classList.remove('show');
        document.body.classList.remove('is-mainpage');

        setTimeout(() => {
            mainPage.style.display = 'none';
            const plotList = document.getElementById('plot-list');
            if(plotList) plotList.innerHTML = '';
            
            loginPage.style.display = 'flex';
            void loginPage.offsetWidth; 
            loginPage.classList.remove('exit'); 
            
            const pwdInput = loginPage.querySelector('input[type="password"]');
            if (pwdInput) pwdInput.value = '';
            
            const loginIcons = loginPage.querySelectorAll('.worker i, .worker p');
            loginIcons.forEach(el => {
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
            });
        }, 800);
    }

    if (backBt) {
        const cancelLongPress = () => clearTimeout(longPressTimer);
        backBt.addEventListener('mousedown', (e) => { if (e.button === 0) longPressTimer = setTimeout(performLogout, 1200); });
        backBt.addEventListener('mouseup', cancelLongPress);
        backBt.addEventListener('mouseleave', cancelLongPress);
        backBt.addEventListener('touchstart', () => longPressTimer = setTimeout(performLogout, 1200));
        backBt.addEventListener('touchend', cancelLongPress);
        backBt.addEventListener('click', (e) => e.preventDefault());
    }
})();

// --- Change Password Logic ---
(function initChangePassword() {
    const changebt = document.getElementById('changebt');
    const pwdModal = document.querySelector('.changepass');
    const cancelPwdBt = document.getElementById('cancelPwdBt');
    const confirmPwdBt = document.getElementById('confirmPwdBt');
    const chooseContainer = document.querySelector('.Choose');

    if (changebt && pwdModal) {
        let pwdLongPressTimer;
        const showPwdModal = () => {
            pwdModal.classList.add('show');
            if (chooseContainer) chooseContainer.classList.add('hide');
        };
        const cancelPwdLongPress = () => clearTimeout(pwdLongPressTimer);

        changebt.addEventListener('mousedown', (e) => { if (e.button === 0) pwdLongPressTimer = setTimeout(showPwdModal, 1000); });
        changebt.addEventListener('touchstart', () => pwdLongPressTimer = setTimeout(showPwdModal, 1000));
        changebt.addEventListener('mouseup', cancelPwdLongPress);
        changebt.addEventListener('mouseleave', cancelPwdLongPress);
        changebt.addEventListener('touchend', cancelPwdLongPress);
        changebt.addEventListener('click', (e) => e.preventDefault());

        if (cancelPwdBt) {
            cancelPwdBt.addEventListener('click', (e) => {
                e.preventDefault();
                pwdModal.classList.remove('show');
                if (chooseContainer) chooseContainer.classList.remove('hide');
                setTimeout(() => {
                    const inputs = pwdModal.querySelectorAll('input');
                    inputs.forEach(input => input.value = '');
                }, 400); 
            });
        }

        if (confirmPwdBt) {
            confirmPwdBt.addEventListener('click', async (e) => {
                e.preventDefault();
                const inputs = pwdModal.querySelectorAll('input');
                const oldPwd = inputs[0].value;
                const newPwd = inputs[1].value;
                const confirmPwd = inputs[2].value;

                if (!oldPwd || !newPwd || !confirmPwd) return Toast.fire({ icon: 'warning', title: 'Hold on...', text: 'Please fill in all fields.', timer: 4000 });
                if (newPwd !== confirmPwd) {
                    Toast.fire({ icon: 'error', title: 'Oops...', text: 'The new passwords do not match!', timer: 4000 });
                    inputs[1].value = ''; inputs[2].value = ''; inputs[1].focus();
                    return;
                }

                const pwdRegex = /^(?=.*[A-Za-z])(?=.*\d).*$/;
                if (newPwd.length < 6 || !pwdRegex.test(newPwd)) {
                    return Toast.fire({ icon: 'warning', title: 'Weak Password', text: 'Must be at least 6 characters with letters and numbers.', timer: 4000 });
                }

                try {
                    const response = await fetch('https://cemetery-backend.onrender.com/auth/change-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ old_password: oldPwd, new_password: newPwd })
                    });
                    const result = await response.json();
                    
                    if (response.ok && result.success) {
                        Toast.fire({ icon: 'success', title: 'Success!', text: result.message || 'Password updated successfully!', timer: 4000, background: 'rgba(34, 197, 94, 0.75)'});
                        pwdModal.classList.remove('show');
                        if (chooseContainer) chooseContainer.classList.remove('hide');
                        setTimeout(() => inputs.forEach(input => input.value = ''), 400);
                    } else {
                        const errorMsg = Array.isArray(result.detail) ? result.detail[0].msg : result.detail;
                        Toast.fire({ icon: 'error', title: 'Update Failed', text: errorMsg || 'Please try again.', timer: 4000 });
                    }
                } catch (error) {
                    Toast.fire({ icon: 'error', title: 'Server Error', text: 'Cannot connect to the server.', timer: 4000 });
                }
            });
        }
    }
})();


/* ============================================================================
 * 3. UI & UTILITY SYSTEMS (Plot List, Search, Upload)
 * ============================================================================ */

// --- Plot List Scroller ---
function initPlotListSystem() {
    const listContainer = document.getElementById('plot-list');
    const thumb = document.querySelector('.scroll-thumb');
    const track = document.querySelector('.custom-scrollbar');

    if (!listContainer || !thumb || !track) return;

    listContainer.innerHTML = '';
    for (let i = 1; i <= 99; i++) {
        const card = document.createElement('div');
        card.className = 'plot-card';
        card.innerHTML = `
            <i class="fa-solid fa-cross plot-item-icon"></i>
            <span class="plot-label">Plot Number:</span>
            <span class="plot-number">${i}</span>
        `;
        card.addEventListener('click', () => showPlotDetail(i));
        listContainer.appendChild(card);
    }

    const updateThumb = () => {
        const scrollTotal = listContainer.scrollHeight - listContainer.clientHeight;
        const scrollPercent = listContainer.scrollTop / scrollTotal;
        const maxThumbMove = track.clientHeight - thumb.clientHeight;
        const thumbTop = scrollPercent * maxThumbMove;
        if (!isNaN(thumbTop)) thumb.style.transform = `translateY(${thumbTop}px)`;
    };

    let isDragging = false, startY, startScrollTop;

    thumb.addEventListener('mousedown', (e) => {
        isDragging = true;
        thumb.style.transition = 'none';
        startY = e.pageY;
        startScrollTop = listContainer.scrollTop;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaY = e.pageY - startY;
        const scrollRatio = (listContainer.scrollHeight - listContainer.clientHeight) / (track.clientHeight - thumb.clientHeight);
        listContainer.scrollTop = startScrollTop + (deltaY * scrollRatio);
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            thumb.style.transition = 'transform 0.1s ease-out';
        }
    });

    listContainer.addEventListener('scroll', updateThumb);
    window.addEventListener('resize', updateThumb);
    updateThumb();
}

// --- Upload Excel System ---
(function initUploadSystem() {
    const uploadBtn = document.getElementById('uploadbt');
    if (!uploadBtn) return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx, .xls';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const span = uploadBtn.querySelector('span');
        const originalText = span.innerText;
        span.innerText = 'uploading...';
        uploadBtn.style.pointerEvents = 'none';
        uploadBtn.style.opacity = '0.7';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('https://cemetery-backend.onrender.com/edit/upload', { method: 'POST', body: formData });
            const result = await response.json();

            if (response.ok && result.success) {
                Toast.fire({ icon: 'success', title: 'Upload Success!', text: result.message, timer: 2500, background: 'rgba(34, 197, 94, 0.75)' });
            } else {
                Toast.fire({ icon: 'error', title: 'Upload Failed', text: result.detail || result.message || 'Please check your Excel file.', timer: 2500 });
            }
        } catch (error) {
            Toast.fire({ icon: 'error', title: 'Network Error', text: 'Cannot connect to the backend server.', timer: 2500 });
        } finally {
            span.innerText = originalText;
            uploadBtn.style.pointerEvents = 'auto';
            uploadBtn.style.opacity = '1';
            fileInput.value = ''; 
        }
    });
})();
// --- Search System ---
(function initSearchSystem() {
    const searchInput = document.querySelector('.searchpart input[type="search"]');
    const searchBtn = document.getElementById('searchbt');

    if (!searchInput || !searchBtn) return;

    const handleSearch = () => {
        const query = searchInput.value.trim();
        if (!query) {
            return Toast.fire({ icon: 'info', title: 'Input Required', text: 'Please enter a Plot Number.', timer: 2500 });
        }
        showPlotDetail(query);
        searchInput.value = '';
        searchInput.blur();
    };

    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
    });
})();


/* ============================================================================
 * 4. PLOT DETAIL & EDIT ENGINE
 * ============================================================================ */

// --- Show Details ---
async function showPlotDetail(number) {
    const list = document.querySelector('.datadisplay');
    const detail = document.getElementById('plot-detail');
    const title = document.getElementById('detailTitle');
    
    if (!list || !detail || !title) return;
    title.innerText = `Plot #${number}`;

    const occupantsListContainer = document.getElementById('occupantsList');
    document.getElementById('plotStatus').innerText = "Loading...";
    document.getElementById('plotArea').innerText = "---";
    occupantsListContainer.innerHTML = '<p style="text-align:center; margin-top:20px; color:rgba(255,255,255,0.5);">Fetching data...</p>';

    try {
        const plotNo = number.toString().padStart(2, '0'); 
        const response = await fetch(`https://cemetery-backend.onrender.com/edit/plot/${plotNo}`);
        const result = await response.json();

        if (result.success && result.data) {
            const people = result.data;
            document.getElementById('plotStatus').innerText = "Occupied";
            document.getElementById('plotArea').innerText = "Main Section";

            people.sort((a, b) => (parseInt(a["Grave Number"]) || 0) - (parseInt(b["Grave Number"]) || 0));

            const occupantsHTML = people.map(person => `
                <div class="occupant-card" data-grave="${person["Grave Number"] || ''}" style="margin-bottom: 15px;">
                    <div class="occ-header">
                        <span class="occ-pos">Grave ${person["Grave Number"] || 'N/A'}</span>
                    </div>
                    <div class="occ-name" data-field="name">${person["Name of Interned"] || ''}</div>
                    <div class="occ-dates">
                        <div class="date-row"><span class="d-label">Surname:</span> <span class="d-val" data-field="surname">${person["Surname"] || ''}</span></div>
                        <div class="date-row"><span class="d-label">Born:</span> <span class="d-val" data-field="born">${person["Date of Birth"] || ''}</span></div>
                        <div class="date-row"><span class="d-label">Died:</span> <span class="d-val" data-field="died">${person["Date of Death"] || ''}</span></div>
                        <div class="date-row"><span class="d-label">Interred:</span> <span class="d-val" data-field="interred">${person["Date of Interment"] || ''}</span></div>
                    </div>
                </div>
            `).join('');
            occupantsListContainer.innerHTML = occupantsHTML;
        } else {
            document.getElementById('plotStatus').innerText = "Available";
            document.getElementById('plotArea').innerText = "---";
            occupantsListContainer.innerHTML = '<p style="text-align:center; margin-top:20px; color:rgba(255,255,255,0.4);">No Record</p>';
        }
    } catch (error) {
        document.getElementById('plotStatus').innerText = "Error";
        occupantsListContainer.innerHTML = '<p style="text-align:center; margin-top:20px; color:#ff4d4d;">Network Error</p>';
    }

    list.classList.add('hide');
    detail.style.display = 'flex';
    void detail.offsetWidth; 
    detail.classList.add('show');
}

// --- Close Details ---
document.getElementById('closeDetailbt')?.addEventListener('click', () => {
    const list = document.querySelector('.datadisplay');
    const detail = document.getElementById('plot-detail');
    if (!list || !detail) return;

    detail.classList.remove('show');
    setTimeout(() => {
        detail.style.display = 'none';
        list.classList.remove('hide');
    }, 400); 
});

// --- Edit Engine (Save/Delete) ---
(function initEditEngine() {
    const editBtn = document.getElementById('editbt');
    const infoFooter = document.querySelector('.info-footer');
    if (!editBtn || !infoFooter) return;

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancelEditbt';
    cancelBtn.className = 'icon-btn btn-cancel';
    cancelBtn.innerHTML = '<i class="fa-solid fa-xmark"></i><span>cancel</span>';
    
    const saveBtn = document.createElement('button');
    saveBtn.id = 'saveEditbt';
    saveBtn.className = 'icon-btn btn-save';
    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i><span>save</span>';
    
    infoFooter.appendChild(cancelBtn);
    infoFooter.appendChild(saveBtn);
    let originalHTML = '';

    editBtn.addEventListener('click', () => {
        const container = document.getElementById('occupantsList');
        originalHTML = container.innerHTML; 
        infoFooter.classList.add('is-editing');
        const navBt = document.getElementById('navbt');
        if(navBt) navBt.style.display = 'none';
        infoFooter.style.gridTemplateColumns = 'repeat(2, 1fr)';

        // 1. Plot Delete Button
        const detailHeader = document.querySelector('.detail-header');
        detailHeader.style.position = 'relative'; 
        let deletePlotBtn = document.getElementById('deletePlotBtn');
        if (!deletePlotBtn) {
            deletePlotBtn = document.createElement('button');
            deletePlotBtn.id = 'deletePlotBtn';
            deletePlotBtn.className = 'icon-btn';
            deletePlotBtn.style.cssText = 'position: absolute; right: 15px; top: 2px; width: 35px; height: 35px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s;';
            deletePlotBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deletePlotBtn.onmouseover = () => { deletePlotBtn.style.background = 'rgba(239,68,68,0.4)'; deletePlotBtn.style.transform = 'scale(1.1)'; }
            deletePlotBtn.onmouseout = () => { deletePlotBtn.style.background = 'rgba(239,68,68,0.15)'; deletePlotBtn.style.transform = 'scale(1)'; }

            deletePlotBtn.addEventListener('click', async () => {
                const result = await Swal.fire({
                    title: 'Delete Entire Plot?',
                    text: "This will permanently delete ALL records in this plot. You won't be able to revert this!",
                    icon: 'warning',
                    showCancelButton: true,
                    background: 'rgba(20,20,20,0.95)',
                    color: '#fff',
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#6b7280',
                    confirmButtonText: 'Yes, delete it!',
                    heightAuto: false
                });

                if (result.isConfirmed) {
                    const plotText = document.getElementById('detailTitle').innerText;
                    const currentPlotNumber = plotText.replace('Plot #', '').trim();
                    try {
                        const response = await fetch(`https://cemetery-backend.onrender.com/edit/plot/${currentPlotNumber}`, { method: 'DELETE' });
                        const resData = await response.json(); 
                        if (response.ok && resData.success) {  
                            document.getElementById('closeDetailbt').click(); 
                            Toast.fire({ icon: 'success', title: 'Plot Deleted', timer: 2500, background: 'rgba(34, 197, 94, 0.75)' });
                        } else {
                            throw new Error(resData.message || 'Data not found in database');
                        }
                    } catch (error) {
                        Toast.fire({ icon: 'error', title: 'Delete Failed', text: error.message, timer: 3000 });
                    }    
                }
            });
            detailHeader.appendChild(deletePlotBtn);
        }
        
        // 2. Clear Empty Message
        if (container.innerText.includes('No Record')) container.innerHTML = '';

        // 3. Transform Cards to Editable Inputs
        const cards = container.querySelectorAll('.occupant-card');
        cards.forEach(card => {
            card.style.position = 'relative'; 

            // Grave Delete Button
            const removeCardBtn = document.createElement('i');
            removeCardBtn.className = 'fa-solid fa-xmark';
            removeCardBtn.style.cssText = 'position: absolute; right: 12px; top: 12px; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; z-index: 10;';
            removeCardBtn.onmouseover = () => removeCardBtn.style.color = '#ef4444';
            removeCardBtn.onmouseout = () => removeCardBtn.style.color = 'rgba(255,255,255,0.4)';
            
            removeCardBtn.onclick = async () => {
                const currentGrave = card.getAttribute('data-grave');
                if (!currentGrave) return card.remove(); // Unsaved blank card

                const result = await Swal.fire({
                    title: 'Delete this Grave?',
                    text: `You are about to delete Grave ${currentGrave}. This cannot be undone!`,
                    icon: 'warning',
                    showCancelButton: true,
                    background: 'rgba(20,20,20,0.95)',
                    color: '#fff',
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#6b7280',
                    confirmButtonText: 'Yes, delete it!'
                });

                if (result.isConfirmed) {
                    const plotText = document.getElementById('detailTitle').innerText;
                    const currentPlotNumber = plotText.replace('Plot #', '').trim();
                    try {
                        const response = await fetch(`https://cemetery-backend.onrender.com/edit/grave/${currentPlotNumber}/${currentGrave}`, { method: 'DELETE' });
                        const data = await response.json(); 
                        if (response.ok && data.success) {
                            card.remove(); 
                            Toast.fire({ icon: 'success', title: 'Record Deleted', timer: 2500, background: 'rgba(34, 197, 94, 0.75)' });
                        } else {
                            throw new Error(data.message || 'Record not found in database');
                        }
                    } catch (error) {
                        Toast.fire({ icon: 'error', title: 'Delete Failed', text: error.message, timer: 3000 });
                    }
                }
            };
            card.appendChild(removeCardBtn);

            // Populate Inputs
            const posSpan = card.querySelector('.occ-pos');
            if (posSpan) {
                const currentGrave = card.getAttribute('data-grave') || '';
                posSpan.innerHTML = `Grave <input type="number" class="edit-input grave-num-input" value="${currentGrave}">`;
            }

            const nameDiv = card.querySelector('.occ-name');
            if (nameDiv) {
                const cleanName = nameDiv.innerText.trim() === 'N/A' ? '' : nameDiv.innerText.trim();
                nameDiv.innerHTML = `<input type="text" class="edit-input" value="${cleanName}" placeholder="Enter Name">`;
            }

            const dVals = card.querySelectorAll('.d-val');
            dVals.forEach(dVal => {
                const fieldType = dVal.getAttribute('data-field');
                const cleanVal = dVal.innerText.trim() === 'N/A' ? '' : dVal.innerText.trim();
                let inputType = (fieldType === 'surname') ? 'text' : 'date';
                let dateValueAttr = `value="${cleanVal}"`;
                
                if (inputType === 'date' && cleanVal) {
                    const dateMatch = cleanVal.match(/^\d{4}-\d{2}-\d{2}/);
                    dateValueAttr = dateMatch ? `value="${dateMatch[0]}"` : `type="text" value="${cleanVal}"`;
                }
                dVal.innerHTML = `<input type="${inputType}" class="edit-input" ${dateValueAttr} placeholder="...">`;
            });
        });

        // 4. Add "Add New Grave" Button
        const addGraveBtn = document.createElement('button');
        addGraveBtn.className = 'icon-btn';
        addGraveBtn.style.cssText = 'width: 100%; margin-top: 10px; border: 1.5px dashed rgba(255,255,255,0.4); background: rgba(255,255,255,0.05); border-radius: 8px; color: white; transition: all 0.2s;';
        addGraveBtn.innerHTML = '<i class="fa-solid fa-plus"></i><span style="margin-left:8px;">Add New Grave</span>';
        addGraveBtn.onmouseover = () => addGraveBtn.style.background = 'rgba(255,255,255,0.1)';
        addGraveBtn.onmouseout = () => addGraveBtn.style.background = 'rgba(255,255,255,0.05)';
        
        addGraveBtn.addEventListener('click', () => {
            const blankCard = document.createElement('div');
            blankCard.className = 'occupant-card';
            blankCard.style.cssText = 'margin-bottom: 15px; position: relative;';
            blankCard.innerHTML = `
                <i class="fa-solid fa-xmark remove-blank-card" style="position: absolute; right: 12px; top: 12px; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; z-index: 10;"></i>
                <div class="occ-header">
                    <span class="occ-pos">Grave <input type="number" class="edit-input grave-num-input" value="" placeholder="No."></span>
                </div>
                <div class="occ-name"><input type="text" class="edit-input" value="" placeholder="Enter Name"></div>
                <div class="occ-dates">
                    <div class="date-row"><span class="d-label">Surname:</span> <span class="d-val" data-field="surname"><input type="text" class="edit-input" value="" placeholder="..."></span></div>
                    <div class="date-row"><span class="d-label">Born:</span> <span class="d-val" data-field="born"><input type="date" class="edit-input" value="" placeholder="..."></span></div>
                    <div class="date-row"><span class="d-label">Died:</span> <span class="d-val" data-field="died"><input type="date" class="edit-input" value="" placeholder="..."></span></div>
                    <div class="date-row"><span class="d-label">Interred:</span> <span class="d-val" data-field="interred"><input type="date" class="edit-input" value="" placeholder="..."></span></div>
                </div>
            `;
            const removeBtn = blankCard.querySelector('.remove-blank-card');
            removeBtn.onmouseover = () => removeBtn.style.color = '#ef4444';
            removeBtn.onmouseout = () => removeBtn.style.color = 'rgba(255,255,255,0.4)';
            removeBtn.onclick = () => blankCard.remove();
            container.insertBefore(blankCard, addGraveBtn);
        });

        container.appendChild(addGraveBtn);
    });

    cancelBtn.addEventListener('click', () => {
        document.getElementById('occupantsList').innerHTML = originalHTML;
        infoFooter.classList.remove('is-editing');
        const existingDelBtn = document.getElementById('deletePlotBtn');
        if (existingDelBtn) existingDelBtn.remove();
        const navBt = document.getElementById('navbt');
        if(navBt) navBt.style.display = '';
        infoFooter.style.gridTemplateColumns = 'repeat(3, 1fr)';
    });

    saveBtn.addEventListener('click', async () => {
        const container = document.getElementById('occupantsList');
        const cards = container.querySelectorAll('.occupant-card');
        const plotText = document.getElementById('detailTitle').innerText;
        const currentPlotNumber = plotText.replace('Plot #', '').trim();
        const updatePromises = [];

        cards.forEach(card => {
            const graveInput = card.querySelector('.grave-num-input');
            const newGrave = graveInput ? graveInput.value.trim() : card.getAttribute('data-grave');
            const originalGrave = card.getAttribute('data-grave');
            
            const payload = {
                "plot_number": currentPlotNumber,
                "Original Grave Number": originalGrave || null,
                "Grave Number": newGrave || null,
                "Name of Interned": card.querySelector('.occ-name input')?.value.trim() || null,
                "Surname": card.querySelector('.d-val[data-field="surname"] input')?.value.trim() || null,
                "Date of Birth": card.querySelector('.d-val[data-field="born"] input')?.value.trim() || null,
                "Date of Death": card.querySelector('.d-val[data-field="died"] input')?.value.trim() || null,
                "Date of Interment": card.querySelector('.d-val[data-field="interred"] input')?.value.trim() || null
            };

            if (newGrave) { 
                const request = fetch('https://cemetery-backend.onrender.com/edit/update-plot', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                updatePromises.push(request);
            }
        });
        
        try {
            saveBtn.style.opacity = '0.5';
            saveBtn.style.pointerEvents = 'none';

            await Promise.all(updatePromises); 
            infoFooter.classList.remove('is-editing');
            
            const existingDelBtn = document.getElementById('deletePlotBtn');
            if (existingDelBtn) existingDelBtn.remove();

            showPlotDetail(currentPlotNumber); 
            Toast.fire({ icon: 'success', title: 'Saved Successfully', text: 'Data synced to database.', timer: 2500, background: 'rgba(34, 197, 94, 0.75)' });
            const navBt = document.getElementById('navbt');
            if(navBt) navBt.style.display = '';
            infoFooter.style.gridTemplateColumns = 'repeat(3, 1fr)';
        } catch (error) {
            Toast.fire({ icon: 'error', title: 'Save Failed', text: 'Cannot connect to server.', timer: 3000 });
        } finally {
            saveBtn.style.opacity = '';
            saveBtn.style.pointerEvents = '';
        }
    });
})();


/* ============================================================================
 * 5. MAP & NAVIGATION ENGINE (Leaflet, GeoJSON, Pathfinding)
 * ============================================================================ */

function initCemeteryMap() {
    if (cemeteryMap !== null) cemeteryMap.remove();

    cemeteryMap = L.map('map', { minZoom: 19 }).setView([45.4335, -75.5340], 20);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        maxZoom: 22,
        maxNativeZoom: 19,
        attribution: '&copy; CartoDB'
    }).addTo(cemeteryMap);

    setTimeout(() => cemeteryMap.invalidateSize(), 400);

    // Load Polygons
    fetch('geojson/polygon.geojson') 
        .then(res => res.json())
        .then(data => {
            L.geoJSON(data, {
                style: () => ({ fillColor: '#3b82f6', weight: 1, opacity: 1, color: 'white', fillOpacity: 0.3 }),
                onEachFeature: function(feature, layer) {
                    layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.6 }));
                    layer.on('mouseout', () => layer.setStyle({ fillOpacity: 0.3 }));
                    
                    layer.on('click', (e) => {
                        if (window.isSelectingStart) return cemeteryMap.fire('click', e); 
                        const plotId = feature.properties.plot_id; 
                        if (plotId) showPlotDetail(plotId);
                    });

                    if (feature.properties && feature.properties.plot_id) {
                        const center = layer.getBounds().getCenter();
                        plotCenters[feature.properties.plot_id] = center;
                        
                        const labelIcon = L.divIcon({
                            className: 'plot-label-custom',
                            html: `<div class="plot-label-text">${feature.properties.plot_id}</div>`,
                            iconSize: [30, 20],
                            iconAnchor: [15, 10] 
                        });

                        L.marker(center, { icon: labelIcon, interactive: false, zIndexOffset: 1000 }).addTo(cemeteryMap);
                    }
                }
            }).addTo(cemeteryMap);
        }).catch(err => console.error("多边形加载失败:", err));

    // Load Pathlines & Init PathFinder
    fetch('geojson/pathline.geojson')
        .then(res => res.json())
        .then(async data => {
            L.geoJSON(data, { style: { color: '#64748b', weight: 6, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }, interactive: false }).addTo(cemeteryMap);

            let flatNetwork = turf.flatten(data);
            const densifiedFeatures = [];
            turf.featureEach(flatNetwork, function (feature) {
                if (feature.geometry.type === 'LineString') {
                    const coords = feature.geometry.coordinates;
                    const newCoords = [];
                    for (let i = 0; i < coords.length - 1; i++) {
                        newCoords.push(coords[i]); 
                        const dist = turf.distance(turf.point(coords[i]), turf.point(coords[i+1]), { units: 'meters' });
                        if (dist > 2) { 
                            const segments = Math.ceil(dist / 2);
                            for (let j = 1; j < segments; j++) {
                                const segmentPt = turf.along(turf.lineString([coords[i], coords[i+1]]), (dist/segments)*j, { units: 'meters' });
                                newCoords.push(segmentPt.geometry.coordinates);
                            }
                        }
                    }
                    newCoords.push(coords[coords.length - 1]);
                    feature.geometry.coordinates = newCoords;
                }
                densifiedFeatures.push(feature);
            });
            
            routingNetwork = turf.featureCollection(densifiedFeatures);
            networkNodes = turf.explode(routingNetwork);

            try {
                const PathFinderModule = await import('https://esm.sh/geojson-path-finder@1.5.3?bundle');
                const PathFinder = PathFinderModule.default;
                pathFinderEngine = new PathFinder(routingNetwork, { precision: 1e-5 });
            } catch (err) { console.error("❌ fail to load the engine:", err); }
        }).catch(err => console.error("fail to load the pathline:", err));

    // GPS Tracking
    gpsMarker = null;
    let outOfBoundsAlertShown = false; 
    const cemeteryBounds = L.latLngBounds([45.4300, -75.5400], [45.4400, -75.5200]);

    cemeteryMap.locate({ setView: false, watch: true, enableHighAccuracy: true });

    cemeteryMap.on('locationfound', function(e) {
        const userLocation = e.latlng;
        if (!cemeteryBounds.contains(userLocation) && !outOfBoundsAlertShown) {
            Swal.fire({ toast: true, position: 'top', showConfirmButton: false, timer: 5000, timerProgressBar: true, icon: 'warning', title: 'Outside Cemetery', text: 'Real-time navigation may be inaccurate.', background: 'rgba(30, 41, 59, 0.95)', customClass: { popup: 'capsule-toast' } });
            outOfBoundsAlertShown = true;
        }

        if (!gpsMarker) {
            const pulseIcon = L.divIcon({ className: 'gps-pulse', iconSize: [16, 16], iconAnchor: [8, 8] });
            gpsMarker = L.marker(userLocation, { icon: pulseIcon }).addTo(cemeteryMap);
        } else {
            gpsMarker.setLatLng(userLocation);
        }
    });

    cemeteryMap.on('locationerror', function(e) {
        Toast.fire({ icon: 'warning', title: 'GPS Offline', text: 'Please allow location access for on-site features.', timer: 3000 });
    });

    // Map Click (for Manual Route Selection)
    cemeteryMap.on('click', function(e) {
        if (window.isSelectingStart) {
            window.isSelectingStart = false;
            document.body.classList.remove('selecting-start'); 
            currentRouteStart = e.latlng;

            if (customStartMarker) cemeteryMap.removeLayer(customStartMarker);
            customStartMarker = L.marker(currentRouteStart, {
                icon: L.divIcon({ className: 'custom-start-icon', html: '<div></div>', iconSize: [16, 16], iconAnchor: [8, 8] })
            }).addTo(cemeteryMap);

            startRouting(currentRouteStart, currentRouteEnd);
        }
    });
}

// --- Navigation Go! Button ---
document.getElementById('navbt')?.addEventListener('click', async () => {
    const plotText = document.getElementById('detailTitle').innerText;
    const targetPlotId = plotText.replace('Plot #', '').trim();
    currentRouteEnd = plotCenters[targetPlotId];

    if (!currentRouteEnd) return Toast.fire({ icon: 'error', title: 'Location Error', text: 'Can not find the coordinates of the plot' });

    const result = await Swal.fire({
        title: 'Set Starting Point',
        text: 'How do you want to set the startpoint?',
        icon: 'question',
        background: 'rgba(20,20,20,0.95)',
        color: '#fff',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-crosshairs"></i> Automatic GPS',
        denyButtonText: '<i class="fa-solid fa-map-pin"></i> Manually',
        confirmButtonColor: '#3b82f6',
        denyButtonColor: '#8b5cf6',
        heightAuto: false 
    });

    if (result.isConfirmed) {
        if (typeof gpsMarker !== 'undefined' && gpsMarker) {
            currentRouteStart = gpsMarker.getLatLng();
            startRouting(currentRouteStart, currentRouteEnd);
        } else {
            Swal.fire({ title: 'GPS Offline', text: 'GPS not ready', icon: 'warning', heightAuto: false });
        }
    } else if (result.isDenied) {
        window.isSelectingStart = true;
        document.body.classList.add('selecting-start');

        if (currentRouteLayer) {
            cemeteryMap.removeLayer(currentRouteLayer);
            currentRouteLayer = null;
        }
        if (customStartMarker) {
            cemeteryMap.removeLayer(customStartMarker);
            customStartMarker = null;
        }

        Toast.fire({ icon: 'info', title: 'Selection Mode', text: 'Please select the start point', timer: 3000 });
    }
});

// --- Core Pathfinding Execution ---
function startRouting(start, end) {
    if (!pathFinderEngine || !networkNodes) return Swal.fire('Error', 'The engine is loading, please try again!', 'error');

    if (currentRouteLayer) cemeteryMap.removeLayer(currentRouteLayer);

    const startPt = turf.point([start.lng, start.lat]);
    const endPt = turf.point([end.lng, end.lat]);

    const snappedStart = turf.nearestPoint(startPt, networkNodes);
    const snappedEnd = turf.nearestPoint(endPt, networkNodes);

    const path = pathFinderEngine.findPath(snappedStart, snappedEnd);

    if (path && path.path) {
        const routeCoordinates = path.path.map(coord => [coord[1], coord[0]]);
        
        currentRouteLayer = L.polyline(routeCoordinates, {
            color: '#ef4444', weight: 5, opacity: 0.9, dashArray: '10, 10', 
            lineCap: 'round', lineJoin: 'round', className: 'route-animation'
        }).addTo(cemeteryMap);

        cemeteryMap.fitBounds(currentRouteLayer.getBounds(), { padding: [50, 50], animate: true, duration: 1.5 });
        Toast.fire({ icon: 'success', title: `Route Found! Distance: ${(path.weight * 1000).toFixed(0)}m` });
    } else {
        Swal.fire('No Route', 'Fail to generate the route. Please check if there is road network connection nearby.', 'error');
    }
}

// ==========================================
// 📱 移动端交互核心引擎 (底部抽屉 + 自定义滑块)
// ==========================================

// 1. 全局：锁死页面底板，防止 iOS/Android 橡皮筋回弹
document.body.style.overscrollBehavior = 'none';

// ==========================================
// 模块 A: 底部抽屉 (Bottom Sheet) 升降手势逻辑
// ==========================================
const drawer = document.querySelector('.datapart');
let touchStartY = 0;

if (drawer) {
    // 监听触摸开始：记录手指按下的初始坐标
    drawer.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    // 监听触摸移动：拦截抽屉顶部的滑动，防止带动整个页面
    drawer.addEventListener('touchmove', (e) => {
        const touchY = e.touches[0].clientY;
        const drawerTop = drawer.getBoundingClientRect().top;
        
        // 如果手指是在抽屉顶部 50px 区域（小白条附近）滑动的
        if (touchY - drawerTop < 50) {
            // 彻底切断浏览器对页面的拖拽动作，防止页面乱跑
            if (e.cancelable) e.preventDefault(); 
        }
    }, { passive: false }); 

    // 监听触摸结束：根据滑动距离和方向，决定“变高”还是“变矮”
    drawer.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const swipeDistance = touchStartY - touchEndY;
        const threshold = 60; // 划动超过 60px 才触发

        if (swipeDistance > threshold) {
            // 🚀 向上划：变全屏
            drawer.classList.remove('is-collapsed');
            drawer.classList.add('is-expanded');
        } else if (swipeDistance < -threshold) {
            // 🚀 向下拉
            if (drawer.classList.contains('is-expanded')) {
                // 如果原本是全屏，拉一下变回“中间默认”状态（即移除所有状态类）
                drawer.classList.remove('is-expanded');
            } else {
                // 如果原本是中间状态，拉一下缩成底部极简小条
                drawer.classList.add('is-collapsed');
            }
        }
    }, { passive: true });
}

// ==========================================
// 模块 B: 自定义滑块 (Scrollbar) 触摸拖拽逻辑
// ==========================================
const scrollContainer = document.querySelector('.scroll-container');
const scrollBar = document.querySelector('.custom-scrollbar');
// 🚨 这里已经修正了类名，确保 JS 能精准抓到你的白色小滑块
const scrollThumb = document.querySelector('.scroll-thumb');

if (scrollThumb && scrollContainer && scrollBar) {
    let isDraggingThumb = false;
    let startY, startScrollTop;

    // 1. 监听手指直接按住白色的滑块本体
    scrollThumb.addEventListener('touchstart', (e) => {
        isDraggingThumb = true;
        startY = e.touches[0].pageY;
        startScrollTop = scrollContainer.scrollTop;
        
        // 视觉反馈：按住时变成纯白色，提示用户已抓住
        scrollThumb.style.background = "#ffffff"; 
    }, { passive: true });

    // 2. 监听手指在屏幕上滑动
    document.addEventListener('touchmove', (e) => {
        if (!isDraggingThumb) return;
        
        const deltaY = e.touches[0].pageY - startY;
        
        // 精准计算“齿轮比”：内容可滚动的空间 / 滑块可滑动的空间
        const trackHeight = scrollBar.clientHeight;
        const thumbHeight = scrollThumb.clientHeight;
        const scrollableSpace = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        const thumbTravelSpace = Math.max(trackHeight - thumbHeight, 1); 
        
        const ratio = scrollableSpace / thumbTravelSpace;
        
        // 强制列表跟随滑块同比例滚动
        scrollContainer.scrollTop = startScrollTop + (deltaY * ratio);
        
        // 杀掉浏览器原生动作，防止拖滑块时整个页面被拽跑
        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    // 3. 手指松开，结束拖拽
    document.addEventListener('touchend', () => {
        isDraggingThumb = false;
        // 恢复滑块稍暗的默认颜色
        scrollThumb.style.background = "rgba(255, 255, 255, 0.8)"; 
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const darkModeBtn = document.getElementById('darkmodebt');
    const darkModeIcon = darkModeBtn ? darkModeBtn.querySelector('i') : null;

    // 1. 【初始化】检查浏览器是否存过“深色模式”
    const savedTheme = localStorage.getItem('theme');
    
    // 如果之前设过深色，或者之前没设过但系统偏好深色
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (darkModeIcon) {
            darkModeIcon.classList.replace('fa-sun', 'fa-moon'); // 变成月亮
        }
    }

    // 2. 【点击事件】
    if (darkModeBtn && darkModeIcon) {
        darkModeBtn.addEventListener('click', () => {
            // 切换 body 的类名
            document.body.classList.toggle('dark-theme');
            
            // 判断当前是什么模式，并存入“记忆”
            if (document.body.classList.contains('dark-theme')) {
                localStorage.setItem('theme', 'dark');
                darkModeIcon.classList.replace('fa-sun', 'fa-moon'); // 切换到月亮图标
            } else {
                localStorage.setItem('theme', 'light');
                darkModeIcon.classList.replace('fa-moon', 'fa-sun'); // 切换回太阳图标
            }

            // 增加一个小小的点击动效（可选）
            darkModeBtn.style.transform = 'scale(0.9)';
            setTimeout(() => darkModeBtn.style.transform = 'none', 150);
        });
    }
});
