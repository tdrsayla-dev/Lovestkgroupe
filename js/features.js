// ─────────────────────────────────────────────────────────────────────────────
// js/features.js - Time Scanner, Company Settings Editor & Detail Modals
// ─────────────────────────────────────────────────────────────────────────────

let deletedSubsidiaries = [];

/* =====================================================================
 * 📌 ส่วนที่ 20: SCANNER & CHECK-IN (ฟังก์ชันแสกน QR Code และเข้างาน)
 * - ควบคุมกล้องสำหรับแสกน QR และจัดการบันทึกเวลาเข้า/ออก
 * ===================================================================== */
function loadTodayAttendance() {
    const empInput = document.getElementById('manualEmpId');
    if (!empInput) return;

    let empId = empInput.value.trim().toUpperCase();
    if (!empId) {
        try {
            const session = JSON.parse(localStorage.getItem('hr_user_session') || '{}');
            empId = String(session.empId || session.employeeId || '').trim().toUpperCase();
            if (empId) empInput.value = empId;
        } catch (e) { }
    }

    if (typeof updateScanEmployeeDisplay === 'function') {
        updateScanEmployeeDisplay();
    }

    const checkInEl = document.getElementById('display-checkin');
    const checkOutEl = document.getElementById('display-checkout');
    const statusEl = document.getElementById('display-status');
    const scanBtn = document.getElementById('scan-submit-btn') || document.querySelector('button[onclick*="handleManualScan"]');
    const radioIn = document.querySelector('input[name="scanType"][value="IN"]');
    const radioOut = document.querySelector('input[name="scanType"][value="OUT"]');
    const scanNote = document.getElementById('scan-status-note');

    if (!empId) {
        if (checkInEl) checkInEl.innerText = '-';
        if (checkOutEl) checkOutEl.innerText = '-';
        if (statusEl) statusEl.innerText = 'Enter employee ID';
        if (scanBtn) scanBtn.disabled = false;
        if (radioIn) { radioIn.checked = true; radioIn.disabled = false; }
        if (radioOut) radioOut.disabled = false;
        if (scanNote) { scanNote.textContent = ''; scanNote.className = ''; }
        return;
    }

    google.script.run
        .withSuccessHandler(res => {
            if (!res || !res.success) {
                if (statusEl) statusEl.innerText = 'Unable to load';
                if (scanBtn) scanBtn.disabled = false;
                return;
            }
            const data = res.data || {};
            if (checkInEl) checkInEl.innerText = data.checkIn || '-';
            if (checkOutEl) checkOutEl.innerText = data.checkOut || '-';
            if (statusEl) statusEl.innerText = data.status || '-';

            // ── อัปเดต Radio Buttons ตามสถานะวันนี้ (จำกัด Check-In 1 ครั้ง และ Check-Out 1 ครั้งต่อวัน) ──
            const hasIn = data.checkIn && data.checkIn !== '-';
            const hasOut = data.checkOut && data.checkOut !== '-';

            if (radioIn && radioOut) {
                if (!hasIn && !hasOut) {
                    radioIn.disabled = false;
                    radioIn.checked = true;
                    radioOut.disabled = true;
                    radioOut.checked = false;
                    if (scanBtn) scanBtn.disabled = false;
                    if (scanNote) {
                        scanNote.textContent = 'พร้อมลงเวลา Check-In';
                        scanNote.className = 'text-xs font-semibold text-gray-500 mt-1 block';
                    }
                } else if (hasIn && !hasOut) {
                    radioIn.disabled = true;
                    radioIn.checked = false;
                    radioOut.disabled = false;
                    radioOut.checked = true;
                    if (scanBtn) scanBtn.disabled = false;
                    if (scanNote) {
                        scanNote.textContent = '✅ Check-In แล้วเวลา ' + data.checkIn + ' น. (พร้อมลงเวลา Check-Out)';
                        scanNote.className = 'text-xs font-semibold text-emerald-600 mt-1 block';
                    }
                } else if (hasIn && hasOut) {
                    radioIn.disabled = true;
                    radioIn.checked = false;
                    radioOut.disabled = true;
                    radioOut.checked = false;
                    if (scanBtn) scanBtn.disabled = true;
                    if (scanNote) {
                        scanNote.textContent = '🔒 บันทึกเวลาครบแล้ววันนี้ (IN: ' + data.checkIn + ' / OUT: ' + data.checkOut + ')';
                        scanNote.className = 'text-xs font-semibold text-gray-500 mt-1 block';
                    }
                }
            }
        })
        .withFailureHandler(err => {
            if (statusEl) statusEl.innerText = 'Connection failed';
            showToast('Connection failed: ' + err.message, 'error');
        })
        .getTodayAttendance(empId);
}

function initScanner() {
    try {
        const gpsCoordsEl = document.getElementById('gps-coords');
        if (gpsCoordsEl) {
            gpsCoordsEl.innerHTML = 'Locating GPS <i class="fa-solid fa-spinner fa-spin"></i>';
        }

        try {
            if (!map) {
                map = L.map('map').setView([BRANCHES[0].lat, BRANCHES[0].lng], 16);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
                }).addTo(map);

                let bounds = [];
                BRANCHES.forEach(b => {
                    L.circle([b.lat, b.lng], { color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.2, radius: b.radius }).addTo(map).bindPopup(b.name);
                    L.marker([b.lat, b.lng]).addTo(map).bindTooltip(b.name, { permanent: true, direction: 'top' });
                    bounds.push([b.lat, b.lng]);
                });

                if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
            }
            setTimeout(() => { if (map) map.invalidateSize(); }, 400);
        } catch (error) {
            console.error("Leaflet Map Load Error:", error);
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    try {
                        const lat = pos.coords.latitude, lng = pos.coords.longitude;

                        let currentBranch = null;
                        let minDistance = Infinity;
                        let nearestBranch = BRANCHES[0];

                        BRANCHES.forEach(b => {
                            let dist = calculateDistance(lat, lng, b.lat, b.lng);
                            if (dist <= b.radius && dist < minDistance) {
                                minDistance = dist;
                                currentBranch = b;
                            } else if (dist < minDistance) {
                                minDistance = dist;
                                nearestBranch = b;
                            }
                        });

                        const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
                        let role = 'Staff';
                        if (sessionStr) { try { role = JSON.parse(sessionStr).role || 'Staff'; } catch (e) { } }
                        const isSuperAdmin = String(role).trim().toLowerCase() === 'super admin' || String(role).trim().toLowerCase() === 'superadmin';

                        const gpsText = document.getElementById('gps-coords');
                        if (gpsText) {
                            if (currentBranch) {
                                gpsText.innerHTML = `<span class="text-emerald-600 font-bold"><i class="fa-solid fa-circle-check text-emerald-500 mr-1"></i>อยู่ในพื้นที่ (${currentBranch.name})</span> <span class="text-gray-400 text-[10px] ml-1">(Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)})</span>`;
                            } else if (isSuperAdmin) {
                                gpsText.innerHTML = `<span class="text-purple-700 font-bold"><i class="fa-solid fa-user-shield text-purple-600 mr-1"></i>Super Admin: ลงเวลาได้ทุกสถานที่ (ห่าง ${Math.round(minDistance)}ม. จาก ${nearestBranch ? nearestBranch.name : 'สาขา'})</span>`;
                            } else {
                                gpsText.innerHTML = `<span class="text-red-500 font-bold"><i class="fa-solid fa-circle-xmark text-red-500 mr-1"></i>อยู่นอกพื้นที่เช็คอิน (ห่าง ${Math.round(minDistance)}ม. จาก ${nearestBranch ? nearestBranch.name : 'สาขา'})</span>`;
                            }
                        }

                        if (userMarker) { userMarker.setLatLng([lat, lng]); }
                        else if (map) {
                            const userIcon = L.divIcon({ className: 'custom-div-icon', html: "<div class='bg-brandindigo rounded-full w-5 h-5 border-2 border-white shadow-lg'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
                            userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map).bindPopup('You are here').openPopup();
                        }
                    } catch (eInner) {
                        console.error("Error in GPS success handler:", eInner);
                    }
                },
                err => {
                    const gpsText = document.getElementById('gps-coords');
                    if (gpsText) {
                        gpsText.innerHTML = '<span class="text-red-500 font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>ไม่สามารถดึงตำแหน่ง GPS ได้</span>';
                    }
                },
                { enableHighAccuracy: true }
            );
        }

        updateScanEmployeeDisplay();
    } catch (error) {
        console.error("Error in initScanner:", error);
        window.dispatchEvent(new ErrorEvent('error', { error: error, message: "initScanner: " + error.message }));
    }
}

function updateScanEmployeeDisplay() {
    try {
        const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
        let role = 'Staff';
        let loggedInEmpId = '';
        let loggedInUser = '';
        if (sessionStr) {
            try {
                const sessionData = JSON.parse(sessionStr);
                role = sessionData.role || 'Staff';
                loggedInEmpId = String(sessionData.empId || sessionData.employeeId || '').trim().toUpperCase();
                loggedInUser = sessionData.username || '';
            } catch (e) { }
        }

        const isSuperAdmin = String(role).trim().toLowerCase() === 'super admin' || String(role).trim().toLowerCase() === 'superadmin';
        const empInput = document.getElementById('manualEmpId');
        const textDisplay = document.getElementById('scan-emp-text-display');
        const idLabel = document.getElementById('scan-emp-id-label');
        const nameLabel = document.getElementById('scan-emp-name-label');

        if (!empInput) return;

        if (isSuperAdmin) {
            // Super Admin: สามารถพิมพ์/ค้นหา Employee ID ของใครก็ได้
            if (textDisplay) textDisplay.classList.add('hidden');
            empInput.classList.remove('hidden');
            empInput.readOnly = false;
            empInput.classList.remove('cursor-not-allowed', 'text-gray-500', 'bg-gray-100');
            empInput.classList.add('bg-transparent', 'text-gray-900');
            if (!empInput.value && loggedInEmpId) empInput.value = loggedInEmpId;
        } else {
            // Non-Super Admin: โชว์เป็น Text ธรรมดากดไม่ได้ ล็อคเฉพาะ ID ของตนเอง
            empInput.value = loggedInEmpId || loggedInUser;
            empInput.readOnly = true;
            empInput.classList.add('hidden');
            if (textDisplay) {
                textDisplay.classList.remove('hidden');
                if (idLabel) idLabel.textContent = loggedInEmpId || loggedInUser || '-';

                // ดึงชื่อเต็มของพนักงานจาก staff cache หรือ session
                let fullName = '';
                if (typeof tableCache !== 'undefined' && tableCache['staff'] && Array.isArray(tableCache['staff'].data)) {
                    const staffRow = tableCache['staff'].data.find(s => String(s.Employee_ID || s.employee_id || '').trim().toUpperCase() === loggedInEmpId);
                    if (staffRow) {
                        fullName = ((staffRow.First_Name || staffRow.first_name || '') + ' ' + (staffRow.Last_Name || staffRow.last_name || '')).trim();
                    }
                }
                if (!fullName && typeof getEmployeeFullName === 'function') {
                    fullName = getEmployeeFullName(loggedInEmpId);
                }
                if (!fullName && loggedInUser) {
                    fullName = loggedInUser.split('@')[0];
                }
                if (nameLabel) nameLabel.textContent = fullName ? ` - ${fullName}` : '';
            }
        }
    } catch (e) {
        console.warn('updateScanEmployeeDisplay error:', e);
    }
}

function handleManualScan(e) {
    e.preventDefault();
    if (typeof isProcessingScan !== 'undefined' && isProcessingScan) return;
    isProcessingScan = true;

    const empInput = document.getElementById('manualEmpId');
    const empId = empInput ? empInput.value : '';

    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let loggedInEmpId = '';
    let role = 'Staff';
    if (sessionStr) {
        try {
            const sData = JSON.parse(sessionStr);
            loggedInEmpId = String(sData.empId || sData.employeeId || '').trim().toUpperCase();
            role = sData.role || 'Staff';
        } catch (e) { }
    }

    const isSuperAdmin = String(role).trim().toLowerCase() === 'super admin' || String(role).trim().toLowerCase() === 'superadmin';
    const targetEmpId = String(empId || loggedInEmpId || '').trim().toUpperCase();

    // หากเป็น Super Admin และพิมพ์รหัสพนักงานคนอื่นที่ไม่ใช่ของตัวเอง -> ถือเป็น Manual Entry by Admin
    let scannedText = 'Scanned via App';
    if (isSuperAdmin && targetEmpId && loggedInEmpId && targetEmpId !== loggedInEmpId) {
        scannedText = 'Manual Entry by Admin';
    }

    processAttendance(targetEmpId, scannedText);
}

function processAttendance(empId, scannedText = null) {
    const cleanEmpId = String(empId || '').trim().toUpperCase();
    if (!cleanEmpId) {
        showToast("Please specify Employee ID", "error");
        isProcessingScan = false;
        return;
    }

    const scanTypeRadio = document.querySelector('input[name="scanType"]:checked');
    const scanType = scanTypeRadio ? scanTypeRadio.value : 'IN';
    let locationText = "Unknown Location";

    if (scannedText && scannedText !== 'Manual Entry by Admin') {
        let foundBranch = BRANCHES.find(b => b.id === scannedText || b.name === scannedText);
        if (foundBranch) {
            locationText = foundBranch.name;
        } else {
            locationText = scannedText;
        }
    } else if (scannedText === 'Manual Entry by Admin') {
        locationText = scannedText;
    }

    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff';
    if (sessionStr) { try { role = JSON.parse(sessionStr).role || 'Staff'; } catch (e) { } }

    const isSuperAdmin = String(role).trim().toLowerCase() === 'super admin' || String(role).trim().toLowerCase() === 'superadmin';
    const isManualAdminEntry = scannedText === 'Manual Entry by Admin';

    const executeRecord = (lat, lng, locStr) => {
        toggleLoading(true, `SAVING RECORD...`);
        google.script.run
            .withSuccessHandler(res => {
                toggleLoading(false);
                if (res && res.success) {
                    if (typeof tableCache !== 'undefined') {
                        delete tableCache['Fingerprint_Logs'];
                        delete tableCache['fingerprint_logs'];
                    }
                    if (window.tableCache) {
                        delete window.tableCache['Fingerprint_Logs'];
                        delete window.tableCache['fingerprint_logs'];
                    }
                    if (window.tableQueryCache) {
                        delete window.tableQueryCache['Fingerprint_Logs'];
                        delete window.tableQueryCache['fingerprint_logs'];
                    }
                    showSuccessModal("Scan Successful!", `Your attendance has been recorded.<br><span class="text-xs text-gray-500 mt-3 block font-medium">Loc: ${locStr}</span>`);
                    loadTodayAttendance();
                    if (role !== 'Staff') {
                        const input = document.getElementById('manualEmpId');
                        if (input) input.value = '';
                    }
                } else {
                    showToast((res && res.message) || 'Failed to record attendance', 'error');
                }
                setTimeout(() => { isProcessingScan = false; }, 2000);
            })
            .withFailureHandler(err => {
                showToast('Connection failed: ' + (err.message || err), 'error');
                toggleLoading(false);
                setTimeout(() => { isProcessingScan = false; }, 2000);
            })
            .recordAttendance(cleanEmpId, scanType, lat, lng, locStr);
    };

    toggleLoading(true, `CHECKING GPS...`);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            let currentBranch = null;
            let minDistance = Infinity;
            let nearestBranch = BRANCHES[0];

            BRANCHES.forEach(branch => {
                let dist = calculateDistance(lat, lng, branch.lat, branch.lng);
                if (dist <= branch.radius && dist < minDistance) {
                    minDistance = dist;
                    currentBranch = branch;
                } else if (dist < minDistance) {
                    minDistance = dist;
                    nearestBranch = branch;
                }
            });

            // ❌ ตรวจสอบเงื่อนไข Geofence: หากผู้ใช้ไม่ใช่ Super Admin และอยู่นอกวงรัศมีสาขา -> บล็อกการ Check In/Out 100%
            if (!currentBranch && !isSuperAdmin) {
                toggleLoading(false);
                isProcessingScan = false;
                showToast(`ไม่อนุญาตให้ลงเวลา: คุณอยู่นอกพื้นที่ที่กำหนด (ห่าง ${Math.round(minDistance)} ม.)`, "error");
                showConfirmModal(
                    "❌ ไม่อนุญาตให้ลงเวลาทำงาน",
                    `<div class="text-left space-y-2">
                        <p class="font-bold text-red-600">คุณอยู่นอกวงรัศมีที่กำหนดให้เช็คอิน-เช็คเอาท์!</p>
                        <p class="text-xs text-gray-600">ตำแหน่งปัจจุบันของคุณอยู่ห่างจาก <b>${nearestBranch ? nearestBranch.name : 'สาขา'}</b> ประมาณ <b>${Math.round(minDistance)} เมตร</b> (รัศมีที่อนุญาต: <b>${nearestBranch ? nearestBranch.radius : 20} เมตร</b>)</p>
                        <p class="text-xs text-red-500 font-bold mt-2">⛔ ระบบจะล็อกไม่ให้ลงเวลาจนกว่าคุณจะเข้าสู่พื้นที่สาขาที่กำหนด</p>
                    </div>`,
                    null, null, true, "เข้าใจแล้ว", ""
                );
                return;
            }

            let finalLocation = currentBranch ? currentBranch.name : `${locationText} (SuperAdmin Override/GPS)`;
            executeRecord(lat, lng, finalLocation);
        }, err => {
            console.warn("GPS lookup failed/unavailable:", err);
            if (!isSuperAdmin) {
                toggleLoading(false);
                isProcessingScan = false;
                showToast("ไม่สามารถตรวจสอบตำแหน่ง GPS ได้ กรุณาเปิดระบบระบุตำแหน่ง", "error");
                showConfirmModal(
                    "❌ ไม่สามารถระบุตำแหน่ง GPS",
                    "ระบบต้องการตำแหน่ง GPS เพื่อตรวจสอบว่าคุณอยู่ในพื้นที่เช็คอิน-เช็คเอาท์ที่กำหนดไว้ กรุณาเปิด GPS และลองใหม่อีกครั้ง",
                    null, null, true, "เข้าใจแล้ว", ""
                );
                return;
            }
            let finalLocation = `${locationText} (Manual)`;
            executeRecord(null, null, finalLocation);
        }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
    } else {
        if (!isSuperAdmin) {
            toggleLoading(false);
            isProcessingScan = false;
            showToast("อุปกรณ์นี้ไม่รองรับระบบระบุตำแหน่ง GPS", "error");
            return;
        }
        let finalLocation = `${locationText} (Manual)`;
        executeRecord(null, null, finalLocation);
    }
}

/* =====================================================================
 * 📌 ส่วนที่ 22: COMPANY SETTINGS (ระบบแก้ไขข้อมูลหน้าแรก)
 * ===================================================================== */
function loadCompanySettings() {
    toggleLoading(true, 'LOADING COMPANY INFO...');
    google.script.run.withSuccessHandler(res => {
        toggleLoading(false);
        if (res.success) {
            deletedSubsidiaries = [];
            const infoMap = {};
            if (Array.isArray(res.info)) {
                res.info.forEach(row => {
                    infoMap[row.key] = row.value;
                });
            }

            document.getElementById('comp-about-title').value = infoMap['about_title'] || '';
            document.getElementById('comp-about-desc').value = infoMap['about_desc'] || '';
            document.getElementById('comp-vision').value = infoMap['vision'] || '';
            document.getElementById('comp-values').value = infoMap['values_desc'] || '';
            document.getElementById('comp-subsidiaries-desc').value = infoMap['subsidiaries_desc'] || '';
            document.getElementById('comp-mission-mastering').value = infoMap['mission_mastering'] || '';
            document.getElementById('comp-mission-commanding').value = infoMap['mission_commanding'] || '';
            document.getElementById('comp-mission-unifying').value = infoMap['mission_unifying'] || '';

            const logoUrl = infoMap['company_logo'] || '';
            const preview = document.getElementById('comp-logo-preview');
            const placeholder = document.getElementById('comp-logo-placeholder');
            const urlInput = document.getElementById('comp-logo-url');

            urlInput.value = logoUrl;
            if (logoUrl && logoUrl.trim() !== '') {
                preview.src = logoUrl;
                preview.classList.remove('hidden');
                placeholder.classList.add('hidden');
            } else {
                preview.src = '';
                preview.classList.add('hidden');
                placeholder.classList.remove('hidden');
            }

            renderSubsidiariesSettingsList(res.subsidiaries || []);

            let jobs = [];
            try {
                jobs = JSON.parse(infoMap['careers'] || '[]');
            } catch (e) {
                console.error('Failed to parse careers JSON', e);
            }
            renderJobsSettingsList(jobs);

            let heroSlides = [];
            try {
                heroSlides = JSON.parse(infoMap['hero_slides'] || localStorage.getItem('stk_hero_slides') || '[]');
            } catch (e) {}
            renderHeroSlidesSettingsList(heroSlides);

            document.getElementById('comp-address').value = infoMap['contact_address'] || '';
            document.getElementById('comp-facebook').value = infoMap['contact_facebook'] || '';
            document.getElementById('comp-instagram').value = infoMap['contact_instagram'] || '';
            document.getElementById('comp-line').value = infoMap['contact_line'] || '';

            document.getElementById('comp-map-lat').value = infoMap['map_lat'] || '';
            document.getElementById('comp-map-lng').value = infoMap['map_lng'] || '';
            document.getElementById('comp-map-label').value = infoMap['map_label'] || '';

        } else {
            showToast(res.message || 'Failed to load company profile data', 'error');
        }
    }).getCompanyProfile();
}

/** 📌 Render Hero Slider Manager Cards */
function renderHeroSlidesSettingsList(slidesList) {
    const container = document.getElementById('hero-slides-list-container');
    if (!container) return;

    if (!slidesList || slidesList.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-sm text-center py-4">ไม่มีรูปภาพสไลด์แบนเนอร์</p>`;
        return;
    }

    container.innerHTML = slidesList.map((slide, i) => {
        const slideId = slide.id || `SLIDE-${i}-${Date.now()}`;
        const imgUrl = slide.image || slide.url || '';
        const safeTitle = String(slide.title || '').replace(/"/g, '&quot;');
        const safeSubtitle = String(slide.subtitle || '').replace(/"/g, '&quot;');
        const safeImgUrl = String(imgUrl).replace(/"/g, '&quot;');

        return `
            <div class="p-4 border border-gray-200 rounded-xl space-y-3 bg-gray-50/50 hover:border-indigo-200 transition-all" data-slide-id="${slideId}">
                <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span class="text-xs font-bold text-gray-600"><i class="fa-solid fa-image text-brandindigo mr-1"></i> รูปภาพสไลด์ #${i + 1}</span>
                    <button type="button" onclick="removeHeroSlideCard('${slideId}')" class="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 transition-colors">
                        <i class="fa-solid fa-trash-can"></i> ลบรูปสไลด์
                    </button>
                </div>

                <div class="flex flex-col sm:flex-row items-center gap-4">
                    <div class="relative w-full sm:w-44 h-24 rounded-xl border border-gray-200 bg-gray-900 flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                        <img class="w-full h-full object-cover slide-preview-img" src="${safeImgUrl}" style="${imgUrl ? '' : 'display:none;'}" />
                        <div class="text-gray-400 text-xs font-bold text-center p-2 slide-placeholder" style="${imgUrl ? 'display:none;' : ''}">ไม่มีรูปสไลด์</div>
                    </div>
                    <div class="space-y-2 w-full">
                        <div class="flex flex-wrap gap-2">
                            <button type="button" onclick="triggerHeroSlideUpload('${slideId}')" class="bg-white border border-gray-300 hover:bg-gray-50 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors text-gray-700">
                                <i class="fa-solid fa-upload mr-1 text-brandindigo"></i>เลือก/อัปโหลดรูปภาพ
                            </button>
                            <button type="button" onclick="clearHeroSlide('${slideId}')" class="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-1.5 px-3 rounded-lg transition-colors">
                                <i class="fa-solid fa-xmark mr-1"></i>ลบรูปภาพ
                            </button>
                        </div>
                        <input type="file" id="slide-file-${slideId}" accept="image/*" class="hidden" onchange="previewHeroSlide('${slideId}', this)" />
                        <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2 slide-url-input" placeholder="หรือวางลิงก์รูปภาพ URL (http...)" value="${safeImgUrl}">
                        
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2 slide-title-input" placeholder="หัวข้อบนสไลด์ (Heading Title)" value="${safeTitle}">
                            <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2 slide-subtitle-input" placeholder="คำอธิบายย่อย (Subtitle)" value="${safeSubtitle}">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function addNewHeroSlideCard() {
    const container = document.getElementById('hero-slides-list-container');
    if (!container) return;

    const emptyPlaceholder = container.querySelector('p.text-gray-500');
    if (emptyPlaceholder) emptyPlaceholder.remove();

    const slideId = `SLIDE-NEW-${Date.now()}`;
    const count = container.querySelectorAll('[data-slide-id]').length + 1;

    const cardHtml = `
        <div class="p-4 border border-dashed border-indigo-300 rounded-xl space-y-3 bg-indigo-50/20 hover:border-indigo-400 transition-all" data-slide-id="${slideId}">
            <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                <span class="text-xs font-bold text-brandindigo"><i class="fa-solid fa-image mr-1"></i> รูปภาพสไลด์ #${count} (ใหม่)</span>
                <button type="button" onclick="removeHeroSlideCard('${slideId}')" class="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 transition-colors">
                    <i class="fa-solid fa-trash-can"></i> ลบรูปสไลด์
                </button>
            </div>

            <div class="flex flex-col sm:flex-row items-center gap-4">
                <div class="relative w-full sm:w-44 h-24 rounded-xl border border-gray-200 bg-gray-900 flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                    <img class="w-full h-full object-cover slide-preview-img" src="" style="display:none;" />
                    <div class="text-gray-400 text-xs font-bold text-center p-2 slide-placeholder">ไม่มีรูปสไลด์</div>
                </div>
                <div class="space-y-2 w-full">
                    <div class="flex flex-wrap gap-2">
                        <button type="button" onclick="triggerHeroSlideUpload('${slideId}')" class="bg-white border border-gray-300 hover:bg-gray-50 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors text-gray-700">
                            <i class="fa-solid fa-upload mr-1 text-brandindigo"></i>เลือก/อัปโหลดรูปภาพ
                        </button>
                        <button type="button" onclick="clearHeroSlide('${slideId}')" class="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-1.5 px-3 rounded-lg transition-colors">
                            <i class="fa-solid fa-xmark mr-1"></i>ลบรูปภาพ
                        </button>
                    </div>
                    <input type="file" id="slide-file-${slideId}" accept="image/*" class="hidden" onchange="previewHeroSlide('${slideId}', this)" />
                    <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2 slide-url-input" placeholder="หรือวางลิงก์รูปภาพ URL (http...)" value="">
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2 slide-title-input" placeholder="หัวข้อบนสไลด์ (Heading Title)" value="">
                        <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2 slide-subtitle-input" placeholder="คำอธิบายย่อย (Subtitle)" value="">
                    </div>
                </div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHtml);
}

function removeHeroSlideCard(slideId) {
    const card = document.querySelector(`[data-slide-id="${slideId}"]`);
    if (card) {
        card.remove();
        const container = document.getElementById('hero-slides-list-container');
        if (container && container.querySelectorAll('[data-slide-id]').length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-sm text-center py-4">ไม่มีรูปภาพสไลด์แบนเนอร์</p>`;
        }
    }
}

// compressImageFile is globally defined in js/utils.js

function triggerHeroSlideUpload(slideId) {
    const input = document.getElementById(`slide-file-${slideId}`);
    if (input) input.click();
}

async function previewHeroSlide(slideId, input) {
    const file = input.files[0];
    if (file) {
        showToast('กำลังบีบอัดและประมวลผลรูปภาพ...', 'info');
        const compressedBase64 = await compressImageFile(file, 1920, 1080, 0.82);
        const card = document.querySelector(`[data-slide-id="${slideId}"]`);
        if (card) {
            const preview = card.querySelector('.slide-preview-img');
            const placeholder = card.querySelector('.slide-placeholder');
            const urlInput = card.querySelector('.slide-url-input');

            preview.src = compressedBase64;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
            urlInput.value = compressedBase64;
        }
    }
}

function clearHeroSlide(slideId) {
    const card = document.querySelector(`[data-slide-id="${slideId}"]`);
    if (card) {
        const preview = card.querySelector('.slide-preview-img');
        const placeholder = card.querySelector('.slide-placeholder');
        const urlInput = card.querySelector('.slide-url-input');
        const fileInput = document.getElementById(`slide-file-${slideId}`);

        preview.src = '';
        preview.style.display = 'none';
        placeholder.style.display = 'block';
        urlInput.value = '';
        if (fileInput) fileInput.value = '';
    }
}

window.renderHeroSlidesSettingsList = renderHeroSlidesSettingsList;
window.addNewHeroSlideCard = addNewHeroSlideCard;
window.removeHeroSlideCard = removeHeroSlideCard;
window.triggerHeroSlideUpload = triggerHeroSlideUpload;
window.previewHeroSlide = previewHeroSlide;
window.clearHeroSlide = clearHeroSlide;

async function previewCompanyLogo(input) {
    const file = input.files[0];
    if (file) {
        const compressedBase64 = await compressImageFile(file, 800, 800, 0.85);
        const preview = document.getElementById('comp-logo-preview');
        const placeholder = document.getElementById('comp-logo-placeholder');
        const urlInput = document.getElementById('comp-logo-url');

        preview.src = compressedBase64;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        urlInput.value = compressedBase64;
    }
}

function clearCompanyLogo() {
    const preview = document.getElementById('comp-logo-preview');
    const placeholder = document.getElementById('comp-logo-placeholder');
    const urlInput = document.getElementById('comp-logo-url');
    const fileInput = document.getElementById('comp-logo-file');

    preview.src = '';
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    urlInput.value = '';
    fileInput.value = '';
}

function triggerSubLogoUpload(subId) {
    const input = document.getElementById(`sub-file-${subId}`);
    if (input) input.click();
}

function previewSubLogo(subId, input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const card = document.querySelector(`[data-sub-id="${subId}"]`);
            if (card) {
                const preview = card.querySelector('.sub-logo-preview');
                const placeholder = card.querySelector('.sub-logo-placeholder');
                const valInput = document.getElementById(`sub-val-${subId}`);

                preview.src = e.target.result;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
                valInput.value = e.target.result;
            }
        };
        reader.readAsDataURL(file);
    }
}

function clearSubLogo(subId) {
    const card = document.querySelector(`[data-sub-id="${subId}"]`);
    if (card) {
        const preview = card.querySelector('.sub-logo-preview');
        const placeholder = card.querySelector('.sub-logo-placeholder');
        const valInput = document.getElementById(`sub-val-${subId}`);
        const fileInput = document.getElementById(`sub-file-${subId}`);

        preview.src = '';
        preview.style.display = 'none';
        placeholder.innerHTML = '🏢';
        placeholder.style.display = 'block';
        valInput.value = '🏢';
        fileInput.value = '';
    }
}

function renderSubsidiariesSettingsList(subsList) {
    const container = document.getElementById('subsidiaries-list-container');
    if (!container) return;

    if (!subsList || subsList.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-sm text-center py-4">ไม่มีข้อมูลบริษัทในเครือ</p>`;
        return;
    }

    container.innerHTML = subsList.map((sub, i) => {
        const isUrl = sub.emoji && (sub.emoji.startsWith('http') || sub.emoji.startsWith('data:image'));
        return `
                <div class="p-5 border border-gray-200 rounded-xl space-y-4 bg-gray-50/50 shadow-inner hover:border-indigo-200 transition-all" data-sub-id="${sub.id}">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-3">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold px-2 py-1 bg-brandindigo/10 text-brandindigo rounded-md uppercase tracking-wider">${sub.id}</span>
                            <span class="text-sm font-bold text-gray-700">ลำดับ:</span>
                            <input type="number" class="w-16 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-1 text-center font-bold sub-sort-order" value="${sub.sort_order || (i + 1)}">
                        </div>
                        
                        <div class="flex items-center gap-3 w-full sm:w-auto">
                            <div class="relative w-12 h-12 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                                <img class="w-full h-full object-contain p-1 sub-logo-preview" src="${isUrl ? sub.emoji : ''}" style="${isUrl ? '' : 'display:none;'}" />
                                <div class="text-gray-400 text-xs font-bold uppercase tracking-wider text-center p-1 sub-logo-placeholder" style="${isUrl ? 'display:none;' : ''}">${sub.emoji || '🏢'}</div>
                            </div>
                            <div class="flex flex-col gap-1 w-full sm:w-auto">
                                <div class="flex gap-2">
                                    <button type="button" onclick="triggerSubLogoUpload('${sub.id}')" class="bg-white border border-gray-300 hover:bg-gray-50 text-[10px] font-bold py-1 px-2.5 rounded-lg shadow-sm transition-colors text-gray-700">
                                        <i class="fa-solid fa-upload mr-1"></i>อัปโหลดโลโก้
                                    </button>
                                    <button type="button" onclick="clearSubLogo('${sub.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold py-1 px-2.5 rounded-lg transition-colors">
                                        <i class="fa-solid fa-trash-can mr-1"></i>ลบ
                                    </button>
                                </div>
                                <input type="file" id="sub-file-${sub.id}" accept="image/*" class="hidden" onchange="previewSubLogo('${sub.id}', this)" />
                                <input type="text" class="w-full sm:w-64 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-1 px-2 sub-emoji" value="${sub.emoji || '🏢'}" id="sub-val-${sub.id}">
                            </div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-xs font-bold text-gray-600">ชื่อบริษัท (Name)</label>
                            <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 sub-name" value="${sub.name || ''}">
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-bold text-gray-600">สโลแกน / หัวข้อย่อย (Title)</label>
                            <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 sub-title" value="${sub.title || ''}">
                        </div>
                    </div>
                    
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-gray-600">คำอธิบายรายละเอียด (Description)</label>
                        <textarea rows="3" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 sub-desc">${sub.description || ''}</textarea>
                    </div>
                    
                    <div class="flex justify-end pt-1 border-t border-gray-100/50">
                        <button type="button" onclick="deleteSubsidiaryCard('${sub.id}')" class="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1.5 transition-colors">
                            <i class="fa-solid fa-trash-can"></i> ลบข้อมูลบริษัทนี้
                        </button>
                    </div>
                </div>
                `;
    }).join('');
}

function renderJobsSettingsList(jobsList) {
    const container = document.getElementById('jobs-list-container');
    if (!container) return;

    if (!jobsList || jobsList.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-sm text-center py-4 col-span-2">ไม่มีข้อมูลตำแหน่งงานที่เปิดรับ</p>`;
        return;
    }

    container.innerHTML = jobsList.map((job, i) => {
        const tempId = `JOB-${i}-${Date.now()}`;
        return `
                <div class="p-4 border border-gray-200 rounded-xl space-y-3 bg-gray-50/50 hover:border-indigo-200 transition-all relative" data-job-id="${tempId}">
                    <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                        <span class="text-xs font-bold text-gray-500"><i class="fa-solid fa-briefcase mr-1"></i> ตำแหน่งงาน #${i + 1}</span>
                        <button type="button" onclick="removeJobPositionCard('${tempId}')" class="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 transition-colors">
                            <i class="fa-solid fa-trash-can"></i> ลบ
                        </button>
                    </div>
                    <div class="space-y-2">
                        <div class="space-y-1">
                            <label class="text-[11px] font-bold text-gray-500">ชื่อตำแหน่ง (Job Title)</label>
                            <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 job-title" value="${escapeHtml(job.title || '')}" placeholder="เช่น นักพัฒนาซอฟต์แวร์">
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div class="space-y-1">
                                <label class="text-[11px] font-bold text-gray-500">แผนก (Department)</label>
                                <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 job-dept" value="${escapeHtml(job.dept || '')}" placeholder="เช่น แผนกเทคโนโลยี">
                            </div>
                            <div class="space-y-1">
                                <label class="text-[11px] font-bold text-gray-500">จำนวนที่เปิดรับ (Badge)</label>
                                <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 job-badge" value="${escapeHtml(job.badge || '')}" placeholder="เช่น 2 อัตรา">
                            </div>
                        </div>
                    </div>
                </div>
                `;
    }).join('');
}

function addNewJobPositionCard() {
    const container = document.getElementById('jobs-list-container');
    if (!container) return;

    const emptyPlaceholder = container.querySelector('p.text-gray-500');
    if (emptyPlaceholder) emptyPlaceholder.remove();

    const tempId = `JOB-NEW-${Date.now()}`;
    const count = container.querySelectorAll('[data-job-id]').length + 1;

    const cardHtml = `
            <div class="p-4 border border-dashed border-indigo-300 rounded-xl space-y-3 bg-indigo-50/10 hover:border-indigo-400 transition-all relative" data-job-id="${tempId}">
                <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span class="text-xs font-bold text-brandindigo"><i class="fa-solid fa-briefcase mr-1"></i> ตำแหน่งงาน #${count} (ใหม่)</span>
                    <button type="button" onclick="removeJobPositionCard('${tempId}')" class="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 transition-colors">
                        <i class="fa-solid fa-trash-can"></i> ลบ
                    </button>
                </div>
                <div class="space-y-2">
                    <div class="space-y-1">
                        <label class="text-[11px] font-bold text-gray-500">ชื่อตำแหน่ง (Job Title)</label>
                        <input type="text" class="w-full bg-white border border-indigo-200 text-gray-900 text-sm rounded-lg p-2 job-title" value="" placeholder="เช่น นักพัฒนาซอฟต์แวร์">
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="space-y-1">
                            <label class="text-[11px] font-bold text-gray-500">แผนก (Department)</label>
                            <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 job-dept" value="" placeholder="เช่น แผนกเทคโนโลยี">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[11px] font-bold text-gray-500">จำนวนที่เปิดรับ (Badge)</label>
                            <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 job-badge" value="" placeholder="เช่น 2 อัตรา">
                        </div>
                    </div>
                </div>
            </div>
            `;
    container.insertAdjacentHTML('beforeend', cardHtml);
}

function removeJobPositionCard(tempId) {
    const card = document.querySelector(`[data-job-id="${tempId}"]`);
    if (card) {
        card.remove();
        const container = document.getElementById('jobs-list-container');
        if (container && container.querySelectorAll('[data-job-id]').length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-sm text-center py-4 col-span-2">ไม่มีข้อมูลตำแหน่งงานที่เปิดรับ</p>`;
        }
    }
}

function addNewSubsidiaryCard() {
    const container = document.getElementById('subsidiaries-list-container');
    if (!container) return;

    const emptyPlaceholder = container.querySelector('p.text-gray-500');
    if (emptyPlaceholder) {
        emptyPlaceholder.remove();
    }

    const tempId = `LSTK-TEMP-${Date.now()}`;
    const count = container.querySelectorAll('[data-sub-id]').length + 1;

    const cardHtml = `
            <div class="p-5 border border-dashed border-indigo-300 rounded-xl space-y-4 bg-indigo-50/20 shadow-inner hover:border-indigo-400 transition-all animate-pulse-once" data-sub-id="${tempId}">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-3">
                    <div class="flex flex-wrap items-center gap-2">
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-bold text-gray-600">รหัสอ้างอิง (ID):</span>
                            <input type="text" class="w-36 bg-white border border-indigo-200 text-brandindigo text-xs font-bold rounded-lg p-1.5 uppercase tracking-wider sub-id-input" placeholder="LSTK-XXXX" value="">
                        </div>
                        <span class="text-sm font-bold text-gray-700">ลำดับ:</span>
                        <input type="number" class="w-16 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-1 text-center font-bold sub-sort-order" value="${count}">
                        <span class="text-xs text-red-500 font-bold ml-2">(บริษัทใหม่)</span>
                    </div>
                    
                    <div class="flex items-center gap-3 w-full sm:w-auto">
                        <div class="relative w-12 h-12 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                            <img class="w-full h-full object-contain p-1 sub-logo-preview" src="" style="display:none;" />
                            <div class="text-gray-400 text-xs font-bold uppercase tracking-wider text-center p-1 sub-logo-placeholder">🏢</div>
                        </div>
                        <div class="flex flex-col gap-1 w-full sm:w-auto">
                            <div class="flex gap-2">
                                <button type="button" onclick="triggerSubLogoUpload('${tempId}')" class="bg-white border border-gray-300 hover:bg-gray-50 text-[10px] font-bold py-1 px-2.5 rounded-lg shadow-sm transition-colors text-gray-700">
                                    <i class="fa-solid fa-upload mr-1"></i>อัปโหลดโลโก้
                                </button>
                                <button type="button" onclick="clearSubLogo('${tempId}')" class="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold py-1 px-2.5 rounded-lg transition-colors">
                                    <i class="fa-solid fa-trash-can mr-1"></i>ลบ
                                </button>
                            </div>
                            <input type="file" id="sub-file-${tempId}" accept="image/*" class="hidden" onchange="previewSubLogo('${tempId}', this)" />
                            <input type="text" class="w-full sm:w-64 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-1 px-2 sub-emoji" value="🏢" id="sub-val-${tempId}">
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-gray-600">ชื่อบริษัท (Name) <span class="text-red-500">*</span></label>
                        <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 sub-name" placeholder="ชื่อบริษัทเต็ม..." value="">
                    </div>
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-gray-600">สโลแกน / หัวข้อย่อย (Title)</label>
                        <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 sub-title" placeholder="เช่น HEALTH CENTER..." value="">
                    </div>
                </div>
                
                <div class="space-y-1">
                    <label class="text-xs font-bold text-gray-600">คำอธิบายรายละเอียด (Description)</label>
                    <textarea rows="3" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 sub-desc" placeholder="คำอธิบายสั้นๆ ของธุรกิจย่อยนี้..."></textarea>
                </div>
                
                <div class="flex justify-end pt-1">
                    <button type="button" onclick="removeUnsavedSubCard('${tempId}')" class="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1">
                        <i class="fa-solid fa-xmark"></i> ยกเลิกบริษัทย่อยนี้
                    </button>
                </div>
            </div>
            `;

    container.insertAdjacentHTML('beforeend', cardHtml);

    const newCard = container.querySelector(`[data-sub-id="${tempId}"]`);
    if (newCard) {
        newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function removeUnsavedSubCard(tempId) {
    const card = document.querySelector(`[data-sub-id="${tempId}"]`);
    if (card) {
        card.remove();

        const container = document.getElementById('subsidiaries-list-container');
        if (container && container.querySelectorAll('[data-sub-id]').length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-sm text-center py-4">ไม่มีข้อมูลบริษัทในเครือ</p>`;
        }
    }
}

function deleteSubsidiaryCard(subId) {
    showConfirmModal(
        'ยืนยันการลบบริษัท',
        `คุณแน่ใจหรือไม่ว่าต้องการลบบริษัท <b>${subId}</b>?<br><span class="text-[11px] text-red-500 mt-2 block uppercase tracking-widest font-medium">การลบนี้จะมีผลถาวรหลังจากคลิก "บันทึกทั้งหมด"</span>`,
        () => {
            deletedSubsidiaries.push(subId);
            const card = document.querySelector(`[data-sub-id="${subId}"]`);
            if (card) {
                card.remove();
            }
            const container = document.getElementById('subsidiaries-list-container');
            if (container && container.querySelectorAll('[data-sub-id]').length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-sm text-center py-4">ไม่มีข้อมูลบริษัทในเครือ</p>`;
            }
        }
    );
}

function saveCompanySettings() {
    toggleLoading(true, 'SAVING COMPANY INFO...');

    const logoValue = document.getElementById('comp-logo-url').value;

    const jobsUpdates = [];
    const jobCards = document.querySelectorAll('[data-job-id]');
    jobCards.forEach(card => {
        const title = card.querySelector('.job-title').value.trim();
        const dept = card.querySelector('.job-dept').value.trim();
        const badge = card.querySelector('.job-badge').value.trim();
        if (title) {
            jobsUpdates.push({ title, dept, badge });
        }
    });

    const heroSlidesUpdates = [];
    const slideCards = document.querySelectorAll('[data-slide-id]');
    slideCards.forEach(card => {
        const imgInput = card.querySelector('.slide-url-input');
        const titleInput = card.querySelector('.slide-title-input');
        const subtitleInput = card.querySelector('.slide-subtitle-input');
        const img = imgInput ? imgInput.value.trim() : '';
        const title = titleInput ? titleInput.value.trim() : '';
        const subtitle = subtitleInput ? subtitleInput.value.trim() : '';
        if (img) {
            heroSlidesUpdates.push({ id: card.getAttribute('data-slide-id'), image: img, title, subtitle });
        }
    });

    const doSave = (finalLogoUrl, finalSubUpdates) => {
        const infoUpdates = [
            { key: 'about_title', value: document.getElementById('comp-about-title').value },
            { key: 'about_desc', value: document.getElementById('comp-about-desc').value },
            { key: 'vision', value: document.getElementById('comp-vision').value },
            { key: 'values_desc', value: document.getElementById('comp-values').value },
            { key: 'subsidiaries_desc', value: document.getElementById('comp-subsidiaries-desc').value },
            { key: 'mission_mastering', value: document.getElementById('comp-mission-mastering').value },
            { key: 'mission_commanding', value: document.getElementById('comp-mission-commanding').value },
            { key: 'mission_unifying', value: document.getElementById('comp-mission-unifying').value },
            { key: 'company_logo', value: finalLogoUrl },
            { key: 'careers', value: JSON.stringify(jobsUpdates) },
            { key: 'hero_slides', value: JSON.stringify(heroSlidesUpdates) },
            { key: 'contact_address', value: document.getElementById('comp-address').value },
            { key: 'contact_facebook', value: document.getElementById('comp-facebook').value },
            { key: 'contact_instagram', value: document.getElementById('comp-instagram').value },
            { key: 'contact_line', value: document.getElementById('comp-line').value },
            { key: 'map_lat', value: document.getElementById('comp-map-lat').value },
            { key: 'map_lng', value: document.getElementById('comp-map-lng').value },
            { key: 'map_label', value: document.getElementById('comp-map-label').value }
        ];

        const safeSetItem = (key, val) => {
            try {
                localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
            } catch (e) {
                console.warn(`[LocalStorage] Skipped caching '${key}' due to storage quota:`, e.message);
            }
        };

        safeSetItem('stk_company_info', infoUpdates);
        safeSetItem('stk_subsidiaries', finalSubUpdates);
        safeSetItem('stk_careers', jobsUpdates);
        safeSetItem('stk_hero_slides', heroSlidesUpdates);

        google.script.run.withSuccessHandler(res => {
            toggleLoading(false);
            if (res.success) {
                showToast('บันทึกข้อมูลบริษัทสำเร็จแล้ว!', 'success');
                loadCompanySettings();
            } else {
                showToast(res.message || 'บันทึกข้อมูลไม่สำเร็จ', 'error');
            }
        }).saveCompanyProfile(infoUpdates, finalSubUpdates, deletedSubsidiaries);
    };

    const subUpdatesRaw = [];
    const subCards = document.querySelectorAll('[data-sub-id]');
    let hasError = false;

    subCards.forEach(card => {
        if (hasError) return;

        let id = card.getAttribute('data-sub-id');
        const idInput = card.querySelector('.sub-id-input');
        if (idInput) {
            id = idInput.value.trim().toUpperCase();
            if (!id) {
                showToast('กรุณาระบุ รหัสอ้างอิง (ID) สำหรับบริษัทใหม่', 'warning');
                idInput.focus();
                hasError = true;
                return;
            }
            if (id.startsWith('LSTK-TEMP-')) {
                showToast('รหัสอ้างอิง (ID) ไม่สามารถขึ้นต้นด้วย LSTK-TEMP-', 'warning');
                idInput.focus();
                hasError = true;
                return;
            }
        }

        const name = card.querySelector('.sub-name').value.trim();
        if (!name) {
            showToast('กรุณาระบุ ชื่อบริษัท', 'warning');
            card.querySelector('.sub-name').focus();
            hasError = true;
            return;
        }

        const title = card.querySelector('.sub-title').value;
        const description = card.querySelector('.sub-desc').value;
        const emoji = card.querySelector('.sub-emoji').value;
        const sort_order = Number(card.querySelector('.sub-sort-order').value || 99);

        subUpdatesRaw.push({ id, name, title, description, emoji, sort_order });
    });

    if (hasError) {
        toggleLoading(false);
        return;
    }

    const uploadPromises = [];

    let mainLogoPromise;
    if (logoValue && logoValue.startsWith('data:image')) {
        const fileInput = document.getElementById('comp-logo-file');
        const file = fileInput.files[0];
        const fileName = file ? file.name : 'logo.png';
        mainLogoPromise = new Promise((resolve, reject) => {
            google.script.run.withSuccessHandler(res => {
                if (res.success) resolve(res.url);
                else reject(new Error(res.message));
            }).withFailureHandler(reject).uploadImageToDrive(logoValue, fileName);
        });
    } else {
        mainLogoPromise = Promise.resolve(logoValue);
    }
    uploadPromises.push(mainLogoPromise);

    subUpdatesRaw.forEach((sub, index) => {
        let subLogoPromise;
        if (sub.emoji && sub.emoji.startsWith('data:image')) {
            const fileInput = document.getElementById(`sub-file-${sub.id}`) || document.getElementById(`sub-file-${subCards[index].getAttribute('data-sub-id')}`);
            const file = fileInput ? fileInput.files[0] : null;
            const fileName = file ? file.name : `${sub.id}-logo.png`;
            subLogoPromise = new Promise((resolve, reject) => {
                google.script.run.withSuccessHandler(res => {
                    if (res.success) resolve({ index, url: res.url });
                    else reject(new Error(res.message));
                }).withFailureHandler(reject).uploadImageToDrive(sub.emoji, fileName);
            });
        } else {
            subLogoPromise = Promise.resolve({ index, url: sub.emoji });
        }
        uploadPromises.push(subLogoPromise);
    });

    Promise.all(uploadPromises)
        .then(results => {
            const finalMainLogoUrl = results[0];
            const subResults = results.slice(1);

            subResults.forEach(item => {
                subUpdatesRaw[item.index].emoji = item.url;
            });

            doSave(finalMainLogoUrl, subUpdatesRaw);
        })
        .catch(err => {
            toggleLoading(false);
            showToast('อัปโหลดไฟล์ล้มเหลว: ' + err.message, 'error');
        });
}

function setFormStarRating(rating) {
    document.getElementById('hidden-star-input').value = rating;
    document.getElementById('form-star-text').innerText = rating + ' / 5';

    for (let i = 1; i <= 5; i++) {
        let star = document.getElementById('form-star-' + i);
        if (star) {
            if (i <= rating) {
                star.className = 'fa-solid fa-star text-yellow-400 text-3xl cursor-pointer hover:scale-110 transition-transform mx-1';
            } else {
                star.className = 'fa-regular fa-star text-gray-300 text-3xl cursor-pointer hover:scale-110 transition-transform mx-1';
            }
        }
    }
}

/* =====================================================================
 * 🕒 ฟังก์ชันสำหรับหน้าต่าง Popup ประวัติการได้ดาว และ รายละเอียดต่างๆ
 * ===================================================================== */
function showRatingHistory(empId, empName) {
    let rawData = tableCache[currentSheet] ? tableCache[currentSheet].data : [];
    let historyData = rawData.filter(row => {
        let id = String(getFuzzyValue(row, ['employees id', 'emp_id', 'employee_id'])).toUpperCase().trim();
        return id === empId;
    });

    let modalId = 'history-modal-' + new Date().getTime();

    let html = `
            <div id="${modalId}" class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm transition-opacity">
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] m-4 animate-fade-in-up border border-gray-100">
                    
                    <div class="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div class="flex items-center">
                            <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3">
                                <i class="fa-solid fa-clock-rotate-left text-lg"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-gray-800 leading-tight">ประวัติการได้ดาว</h3>
                                <p class="text-xs text-gray-500">${empName} (${empId})</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('${modalId}').remove()" class="text-gray-400 hover:text-red-500 hover:bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                            <i class="fa-solid fa-times text-lg"></i>
                        </button>
                    </div>

                    <div class="p-6 overflow-y-auto flex-1 bg-gray-50/30">
                        <div class="space-y-3">
            `;

    if (historyData.length === 0) {
        html += `<div class="text-center text-gray-400 py-10"><i class="fa-solid fa-box-open text-4xl mb-3 opacity-50"></i><br>ไม่พบประวัติการประเมิน</div>`;
    } else {
        historyData.forEach(row => {
            let date = getFuzzyValue(row, ['ranting date', 'date', 'วันที่', 'เดือน']) || '-';
            let category = getFuzzyValue(row, ['category', 'หมวดหมู่']) || '-';
            let stars = parseFloat(getFuzzyValue(row, ['star point', 'star_point', 'ดาว', 'rating', 'score'])) || 0;
            if (stars > 5) stars = stars / 100;
            let giver = getFuzzyValue(row, ['give by', 'given by', 'ผู้ประเมิน', 'ผู้ให้', 'หัวหน้า', 'give_by']) || 'ไม่ระบุตัวตน';
            let comment = getFuzzyValue(row, ['comment', 'review', 'ความคิดเห็น', 'ข้อเสนอแนะ', 'remark']);

            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= stars) starsHtml += '<i class="fa-solid fa-star text-[#FACC15] text-[10px] mx-[1px]"></i>';
                else starsHtml += '<i class="fa-regular fa-star text-gray-200 text-[10px] mx-[1px]"></i>';
            }

            html += `
                    <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span class="font-bold text-gray-800 text-sm">${category}</span>
                                <span class="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-bold tracking-wider uppercase border border-blue-100"><i class="fa-regular fa-calendar mr-1"></i>${date}</span>
                            </div>
                            <p class="text-xs text-gray-500 mb-1"><i class="fa-solid fa-user-pen mr-1.5 text-gray-400"></i>ให้ดาวโดย: <span class="font-bold text-gray-700">${giver}</span></p>
                            ${comment && comment !== '-' ? `<p class="text-[11px] text-gray-400 italic bg-gray-50 p-2 rounded-lg mt-2 border border-gray-100">"${comment}"</p>` : ''}
                        </div>
                        <div class="flex flex-col items-end justify-center bg-gray-50/80 px-4 py-2 rounded-xl border border-gray-100 md:min-w-[120px]">
                            <div class="flex items-center mb-1">${starsHtml}</div>
                            <span class="text-[10px] font-bold text-gray-400">ได้มา <span class="text-gray-800 text-sm">${stars}</span> ดาว</span>
                        </div>
                    </div>`;
        });
    }

    html += `
                        </div>
                    </div>
                    
                    <div class="p-4 border-t border-gray-100 bg-white flex justify-end">
                        <button onclick="document.getElementById('${modalId}').remove()" class="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-gray-200">ปิดหน้าต่าง</button>
                    </div>
                </div>
            </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
}

function editRatingByRowId(rowId, event) {
    if (event) event.stopPropagation();
    if (!rowId || rowId === '-') return;

    // ค้นหา record จาก cache
    const sheetData = tableCache[currentSheet] || tableCache['Employees Ranting '] || tableCache['Employees Ranting'] || tableCache['Employees Rating'] || tableCache['employees_rating'];
    const rows = sheetData ? sheetData.data : [];
    const headers = sheetData ? sheetData.headers : [];

    // หา row ที่ตรงกับ rowId
    const matchRow = rows.find(r => {
        const id = getRecordId(r);
        return String(id).trim() === String(rowId).trim();
    });

    if (!matchRow) {
        showToast('ไม่พบข้อมูลที่ต้องการแก้ไข', 'error');
        return;
    }

    // ตั้ง headers ให้ถูกต้องถ้ายังว่างอยู่
    if (headers && headers.length > 0) {
        currentHeaders = headers;
    }

    openFormModal(encodeURIComponent(JSON.stringify(matchRow)).replace(/'/g, '%27'));
}

function showEmpQRCode(empId, encodedName) {

    let empName = decodeURIComponent(encodedName);
    let modalId = 'qr-modal-' + new Date().getTime();

    let html = `
            <div id="${modalId}" class="fixed inset-0 z-[130] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm transition-opacity">
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col m-4 animate-fade-in-up border border-gray-100 p-8 text-center relative transform scale-95 transition-transform duration-300" id="${modalId}-box">
                    
                    <button onclick="closeEmpQRCode('${modalId}')" class="absolute top-4 right-4 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                        <i class="fa-solid fa-times text-lg"></i>
                    </button>
 
                    <div class="w-16 h-16 rounded-full bg-indigo-50 text-brandindigo flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <i class="fa-solid fa-qrcode text-3xl"></i>
                    </div>

                    <h3 class="text-xl font-bold text-gray-900 mb-1 tracking-tight">QR Code ประจำตัว</h3>
                    <p class="text-sm font-bold text-gray-500 mb-6">${empName} <br><span class="text-brandindigo tracking-wider">${empId}</span></p>

                    <div class="flex justify-center bg-white p-4 rounded-2xl border border-gray-200 shadow-inner inline-block mx-auto">
                        <div id="qr-container-${modalId}"></div>
                    </div>

                    <div class="mt-8">
                         <button onclick="closeEmpQRCode('${modalId}')" class="w-full px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors shadow-sm">ปิดหน้าต่าง</button>
                    </div>
                </div>
            </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => {
        let box = document.getElementById(`${modalId}-box`);
        if (box) {
            box.classList.remove('scale-95');
            box.classList.add('scale-100');
        }
    }, 10);

    let qrContainer = document.getElementById(`qr-container-${modalId}`);
    new QRCode(qrContainer, {
        text: empId,
        width: 160,
        height: 160,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

function closeEmpQRCode(modalId) {
    let modal = document.getElementById(modalId);
    let box = document.getElementById(`${modalId}-box`);
    if (modal && box) {
        modal.classList.add('opacity-0');
        box.classList.remove('scale-100');
        box.classList.add('scale-95');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function showTrainingDetail(encodedRow) {
    const row = JSON.parse(decodeURIComponent(encodedRow));

    let topic = getFuzzyValue(row, ['course', 'หลักสูตร', 'subject', 'หัวข้อ', 'name', 'ชื่อ', 'detail', 'รายละเอียด'], 1) || '-';
    let photoUrl = getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']);
    let dateDetail = getFuzzyValue(row, ['date', 'วันที่', 'เวลา', 'training date', 'วันอบรม']) || '-';
    let status = getFuzzyValue(row, ['status', 'สถานะ', 'ສະຖານະ']) || '-';
    let trainer = getFuzzyValue(row, ['trainer', 'วิทยากร', 'ผู้สอน']) || '-';
    let location = getFuzzyValue(row, ['location', 'สถานที่', 'place', 'venue', 'รูปแบบ']) || '-';
    let ytUrl = getFuzzyValue(row, ['youtube', 'yt', 'ยูทูป', 'video', 'วิดีโอ']);
    let fbUrl = getFuzzyValue(row, ['facebook', 'fb', 'เฟสบุ๊ค', 'เพจ']);
    let generalUrl = getFuzzyValue(row, ['link', 'url', 'ลิงก์', 'เอกสาร']);

    if (photoUrl && photoUrl.includes('drive.google.com')) {
        let fileId = '';
        if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
        else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
        if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
    }

    const imgEl = document.getElementById('train-modal-img');
    const imgContainer = document.getElementById('train-modal-img-container');
    if (photoUrl && photoUrl !== '-' && photoUrl.trim() !== '') {
        imgEl.src = photoUrl;
        imgContainer.classList.remove('hidden'); imgContainer.classList.add('flex');
    } else {
        imgContainer.classList.add('hidden'); imgContainer.classList.remove('flex');
    }

    document.getElementById('train-modal-topic').innerText = topic;
    document.getElementById('train-modal-status').innerText = status;
    document.getElementById('train-modal-date').innerHTML = `<i class="fa-regular fa-calendar mr-1.5"></i>${dateDetail}`;
    document.getElementById('train-modal-trainer').innerHTML = `<b>วิทยากร:</b> ${trainer}`;
    document.getElementById('train-modal-location').innerHTML = `<b>สถานที่/รูปแบบ:</b> ${location}`;

    let linksHtml = '';
    if (ytUrl && ytUrl !== '-' && ytUrl.trim() !== '') {
        linksHtml += `<a href="${ytUrl}" target="_blank" rel="noopener noreferrer" class="flex justify-center px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm transition-colors gap-2"><i class="fa-brands fa-youtube mt-0.5"></i> เรียนผ่าน YouTube</a>`;
    }
    if (fbUrl && fbUrl !== '-' && fbUrl.trim() !== '') {
        linksHtml += `<a href="${fbUrl}" target="_blank" rel="noopener noreferrer" class="flex justify-center px-4 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm transition-colors gap-2"><i class="fa-brands fa-facebook mt-0.5"></i> ดูผ่าน Facebook</a>`;
    }
    if (generalUrl && generalUrl !== '-' && generalUrl.trim() !== '') {
        linksHtml += `<a href="${generalUrl}" target="_blank" rel="noopener noreferrer" class="flex justify-center px-4 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-brandindigo font-bold text-sm transition-colors gap-2"><i class="fa-solid fa-link mt-0.5"></i> เอกสารประกอบการเรียน</a>`;
    }
    document.getElementById('train-modal-links-container').innerHTML = linksHtml;

    const modal = document.getElementById('training-modal');
    const modalBox = modal.querySelector('div.bg-white');
    modal.classList.remove('hidden'); void modal.offsetWidth;
    modal.classList.remove('opacity-0'); modalBox.classList.remove('scale-95'); modalBox.classList.add('scale-100');
}

function closeTrainingDetail() {
    const modal = document.getElementById('training-modal');
    const modalBox = modal.querySelector('div.bg-white');
    modal.classList.add('opacity-0'); modalBox.classList.remove('scale-100'); modalBox.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

function showAssetDetail(encodedRow) {
    const row = JSON.parse(decodeURIComponent(encodedRow));

    let name = getFuzzyValue(row, ['asset', 'ทรัพย์สิน', 'name', 'ชื่อ'], 1) || '-';
    let photoUrl = getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']);
    let dateDetail = getFuzzyValue(row, ['date', 'วันที่', 'เวลา', 'issue', 'ວັນເລີ່ມໃຊ້ງານ'], 2) || '-';
    let status = getFuzzyValue(row, ['status', 'สถานะ', 'ສະຖານະ']) || 'Active';
    let employee = getFuzzyValue(row, ['employee', 'ผู้ถือครอง', 'ລະຫັດພະນັກງານ'], 3) || '-';
    let type = getFuzzyValue(row, ['type', 'ประเภท', 'ປະເພດ'], 4) || '-';
    let assetId = getRecordId(row) || '-';

    if (photoUrl && photoUrl.includes('drive.google.com')) {
        let fileId = '';
        if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
        else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
        if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
    }

    const imgEl = document.getElementById('asset-modal-img');
    const imgContainer = document.getElementById('asset-modal-img-container');
    if (photoUrl && photoUrl !== '-' && photoUrl.trim() !== '') {
        imgEl.src = photoUrl;
        imgContainer.classList.remove('hidden'); imgContainer.classList.add('flex');
    } else {
        imgContainer.classList.add('hidden'); imgContainer.classList.remove('flex');
    }

    document.getElementById('asset-modal-name').innerText = name;
    document.getElementById('asset-modal-status').innerText = status;
    document.getElementById('asset-modal-date').innerHTML = `<i class="fa-regular fa-calendar mr-1.5"></i>${dateDetail}`;
    document.getElementById('asset-modal-emp').innerText = employee;
    document.getElementById('asset-modal-id').innerText = assetId;
    document.getElementById('asset-modal-type').innerText = type;

    const modal = document.getElementById('asset-modal');
    const modalBox = modal.querySelector('div.bg-white');
    modal.classList.remove('hidden'); void modal.offsetWidth;
    modal.classList.remove('opacity-0'); modalBox.classList.remove('scale-95'); modalBox.classList.add('scale-100');
}

function closeAssetDetail() {
    const modal = document.getElementById('asset-modal');
    const modalBox = modal.querySelector('div.bg-white');
    modal.classList.add('opacity-0'); modalBox.classList.remove('scale-100'); modalBox.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

function showAnnouncementDetail(encodedRow) {
    const row = JSON.parse(decodeURIComponent(encodedRow));

    let topic = getFuzzyValue(row, ['topic', 'หัวข้อ', 'เรื่อง', 'รายละเอียด', 'detail']) || '-';
    if (topic === '-') topic = 'Announcement';
    let type = getFuzzyValue(row, ['type', 'ประเภท']) || 'General';
    let date = getFuzzyValue(row, ['date', 'วันที่']) || '-';

    let photoUrl = row['photo'] || row['Photo'] || getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']) || '';

    if (typeof photoUrl === 'string') {
        if (photoUrl.startsWith('data:image')) {
            photoUrl = photoUrl.replace(/[\r\n\t\s]+/g, "");
        } else if (photoUrl.includes('drive.google.com')) {
            let fileId = '';
            if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
            else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
            if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
        }
    }

    let safeTopic = encodeURIComponent(String(topic).substring(0, 20));
    let fallbackImg = `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

    if (!photoUrl || photoUrl === '-' || String(photoUrl).trim() === '') {
        photoUrl = fallbackImg;
    }

    const imgEl = document.getElementById('announce-modal-img');
    const imgContainer = document.getElementById('announce-modal-img-container');

    imgEl.src = photoUrl;
    imgEl.onerror = function () {
        this.onerror = null;
        this.src = fallbackImg;
    };

    imgContainer.classList.remove('hidden');
    imgContainer.classList.add('flex');

    const titleEl = document.getElementById('announce-modal-title');
    if (titleEl) titleEl.classList.add('hidden');

    document.getElementById('announce-modal-topic').innerText = topic;
    document.getElementById('announce-modal-type').innerText = type;
    document.getElementById('announce-modal-date').innerHTML = `<i class="fa-regular fa-calendar mr-1.5"></i>${date}`;

    const modal = document.getElementById('announcement-modal');
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modalBox.classList.remove('scale-95');
    modalBox.classList.add('scale-100');
}

function showNewsDetail(encodedRow) {
    const row = JSON.parse(decodeURIComponent(encodedRow));

    let topic = getFuzzyValue(row, ['topic', 'หัวข้อ', 'เรื่อง']) || '-';
    let content = getFuzzyValue(row, ['content', 'รายละเอียด', 'เนื้อหา']) || '-';
    let type = getFuzzyValue(row, ['type', 'ประเภท']) || 'General';
    let date = getFuzzyValue(row, ['date', 'วันที่']) || '-';

    let photoUrl = row['photo'] || row['Photo'] || getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']) || '';

    if (typeof photoUrl === 'string') {
        if (photoUrl.startsWith('data:image')) {
            photoUrl = photoUrl.replace(/[\r\n\t\s]+/g, "");
        } else if (photoUrl.includes('drive.google.com')) {
            let fileId = '';
            if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
            else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
            if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
        }
    }

    let safeTopic = encodeURIComponent(String(topic).substring(0, 20));
    let fallbackImg = `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

    if (!photoUrl || photoUrl === '-' || String(photoUrl).trim() === '') {
        photoUrl = fallbackImg;
    }

    const imgEl = document.getElementById('announce-modal-img');
    const imgContainer = document.getElementById('announce-modal-img-container');

    imgEl.src = photoUrl;
    imgEl.onerror = function () {
        this.onerror = null;
        this.src = fallbackImg;
    };

    imgContainer.classList.remove('hidden');
    imgContainer.classList.add('flex');

    const titleEl = document.getElementById('announce-modal-title');
    if (titleEl) {
        titleEl.innerText = topic;
        titleEl.classList.remove('hidden');
    }
    document.getElementById('announce-modal-topic').innerText = content;
    document.getElementById('announce-modal-type').innerText = type;
    document.getElementById('announce-modal-date').innerHTML = `<i class="fa-regular fa-calendar mr-1.5"></i>${date}`;

    const modal = document.getElementById('announcement-modal');
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modalBox.classList.remove('scale-95');
    modalBox.classList.add('scale-100');
}

function closeAnnouncementModal() {
    const modal = document.getElementById('announcement-modal');
    if (!modal) return;

    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.add('opacity-0');
    if (modalBox) {
        modalBox.classList.remove('scale-100');
        modalBox.classList.add('scale-95');
    }

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function showPolicyDetail(encodedRow) {
    const row = JSON.parse(decodeURIComponent(encodedRow));

    let topic = getFuzzyValue(row, ['head_name', 'หัวข้อ', 'ชื่อ']) || 'เอกสารนโยบาย / Policy';
    let fileUrl = getFuzzyValue(row, ['link', 'url', 'ไฟล์', 'document']) || '';
    let originalUrl = fileUrl;

    let isPdf = false;
    if (typeof originalUrl === 'string') {
        isPdf = originalUrl.toLowerCase().includes('.pdf') || originalUrl.startsWith('data:application/pdf');
    }

    if (fileUrl.includes('drive.google.com/file/d/')) {
        let fileId = fileUrl.split('/d/')[1].split('/')[0];
        fileUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
    }

    let safeTopic = encodeURIComponent(String(topic).substring(0, 15));
    let fallbackImg = `https://ui-avatars.com/api/?background=f8fafc&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

    if (!fileUrl || fileUrl === '-' || String(fileUrl).trim() === '') {
        fileUrl = fallbackImg;
    }

    const imgContainer = document.getElementById('policy-modal-img-container');
    if (isPdf) {
        imgContainer.innerHTML = `
                    <div class="absolute inset-0 flex items-center justify-center opacity-5"><i class="fa-solid fa-file-contract text-[10rem] text-brandindigo"></i></div>
                    <div class="relative z-10 flex flex-col items-center justify-center">
                        <i class="fa-solid fa-file-pdf text-[8rem] text-red-500 mb-6 drop-shadow-md"></i>
                        <span class="text-sm font-bold text-gray-500 uppercase tracking-widest bg-white px-4 py-1.5 rounded-full shadow-sm border border-gray-100">PDF Document</span>
                    </div>`;
    } else {
        imgContainer.innerHTML = `
                    <div class="absolute inset-0 flex items-center justify-center opacity-5"><i class="fa-solid fa-file-contract text-[10rem] text-brandindigo"></i></div>
                    <img id="policy-modal-img" src="${fileUrl}" alt="Policy Cover" class="w-full h-full object-contain relative z-10" onerror="this.onerror=null; this.src='${fallbackImg}';">
                `;
    }

    document.getElementById('policy-modal-topic').innerText = topic;

    const readBtn = document.getElementById('policy-modal-read-btn');
    readBtn.onclick = function () {
        showAttachmentPreview(originalUrl, topic);
    };

    const modal = document.getElementById('policy-modal');
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modalBox.classList.remove('scale-95');
    modalBox.classList.add('scale-100');
}

function closePolicyModal() {
    const modal = document.getElementById('policy-modal');
    if (!modal) return;
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.add('opacity-0');
    if (modalBox) {
        modalBox.classList.remove('scale-100');
        modalBox.classList.add('scale-95');
    }

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function showDocumentDetail(encodedRow) {
    const row = JSON.parse(decodeURIComponent(encodedRow));

    let topic = getFuzzyValue(row, ['document_name', 'document name', 'ชื่อเอกสาร', 'หัวข้อ', 'ชื่อ']) || 'เอกสาร / Document';
    let docType = getFuzzyValue(row, ['document_types', 'document types ', 'ประเภท', 'type']) || 'DOCUMENT';

    let fileUrl = row['Photo'] || row['photo'] || getFuzzyValue(row, ['photo', 'file', 'link', 'url', 'ไฟล์', 'document', 'ไฟล์แนบ']) || '';

    if (typeof fileUrl === 'string' && fileUrl.startsWith('data:')) {
        fileUrl = fileUrl.replace(/[\r\n\t\s]+/g, "");
    }

    let originalUrl = fileUrl;

    let isPdf = false;
    if (typeof originalUrl === 'string') {
        isPdf = originalUrl.toLowerCase().includes('.pdf') || originalUrl.startsWith('data:application/pdf');
    }

    if (fileUrl.includes('drive.google.com/file/d/')) {
        let fileId = fileUrl.split('/d/')[1].split('/')[0];
        fileUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
    }

    let safeTopic = encodeURIComponent(String(topic).substring(0, 15));
    let fallbackImg = `https://ui-avatars.com/api/?background=f8fafc&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

    if (!fileUrl || fileUrl === '-' || String(fileUrl).trim() === '') {
        fileUrl = fallbackImg;
    }

    const imgContainer = document.getElementById('document-modal-img-container');
    if (isPdf) {
        imgContainer.innerHTML = `
                    <div class="absolute inset-0 flex items-center justify-center opacity-5"><i class="fa-solid fa-folder-open text-[10rem] text-brandindigo"></i></div>
                    <div class="relative z-10 flex flex-col items-center justify-center">
                        <i class="fa-solid fa-file-pdf text-[8rem] text-red-500 mb-6 drop-shadow-md"></i>
                        <span class="text-sm font-bold text-gray-500 uppercase tracking-widest bg-white px-4 py-1.5 rounded-full shadow-sm border border-gray-100">PDF Document</span>
                    </div>`;
    } else {
        imgContainer.innerHTML = `
                    <div class="absolute inset-0 flex items-center justify-center opacity-5"><i class="fa-solid fa-folder-open text-[10rem] text-brandindigo"></i></div>
                    <img id="document-modal-img" src="${fileUrl}" alt="Document Cover" class="w-full h-full object-contain relative z-10" onerror="this.onerror=null; this.src='${fallbackImg}';">
                `;
    }

    document.getElementById('document-modal-topic').innerText = topic;
    document.getElementById('document-modal-type').innerHTML = `<i class="fa-solid fa-file-lines mr-1.5"></i> ${docType}`;

    const readBtn = document.getElementById('document-modal-read-btn');
    readBtn.onclick = function () {
        showAttachmentPreview(originalUrl, topic);
    };

    const downloadBtn = document.getElementById('document-modal-download-btn');
    downloadBtn.onclick = function () {
        const a = document.createElement('a');
        a.href = originalUrl;
        a.download = topic;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const modal = document.getElementById('document-modal');
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modalBox.classList.remove('scale-95');
    modalBox.classList.add('scale-100');
}

function closeDocumentModal() {
    const modal = document.getElementById('document-modal');
    if (!modal) return;
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.add('opacity-0');
    if (modalBox) {
        modalBox.classList.remove('scale-100');
        modalBox.classList.add('scale-95');
    }

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

