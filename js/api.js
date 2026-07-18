// ─────────────────────────────────────────────────────────────────────────────
// js/api.js - Supabase / Google Sheets API Sync Layer
// ─────────────────────────────────────────────────────────────────────────────

/* =====================================================================
 * 📌 ส่วนที่ 13: DATA FETCHING & API (ฟังก์ชันดึงข้อมูลจาก Google Sheets / Supabase)
 * ===================================================================== */
function fetchData(sheetName, forceRefresh = false) {
    if (sheetName.trim() === 'Organization Structure') {
        currentSheet = sheetName;

        document.getElementById('searchInput').value = '';
        if (document.getElementById('tableStartDate')) document.getElementById('tableStartDate').value = '';
        if (document.getElementById('tableEndDate')) document.getElementById('tableEndDate').value = '';

        if (tableCache['staff'] && !forceRefresh) {
            rawData = filterDataForUser(tableCache['staff'].data);
            renderOrgChart(rawData);
            return;
        }

        toggleLoading(true, 'FETCHING ORG DATA...');
        google.script.run
            .withSuccessHandler(res => {
                toggleLoading(false);
                if (res.success) {
                    tableCache['staff'] = { headers: res.headers || [], data: res.data || [] };
                    rawData = filterDataForUser(res.data || []);
                    renderOrgChart(rawData);
                } else {
                    showToast(res.message, 'error');
                }
            })
            .withFailureHandler(err => {
                toggleLoading(false);
                showToast('Connection failed: ' + err.message, 'error');
            })
            .getSheetData('staff');
        return;
    }

    if (tableCache[sheetName] && !forceRefresh) {
        currentHeaders = tableCache[sheetName].headers;
        rawData = filterDataForUser(tableCache[sheetName].data);
        if (sheetName === 'Organization Structure ') {
            renderOrgChart(rawData);
        } else {
            renderTable(rawData);
        }
        return;
    }

    toggleLoading(true, 'FETCHING DATA...');
    google.script.run
        .withSuccessHandler(res => {
            try {
                if (res.success) {
                    const cleanedHeaders = ensureHeadersForSheet(sheetName, res.headers);
                    tableCache[sheetName] = { headers: cleanedHeaders, data: res.data || [] };
                    currentHeaders = cleanedHeaders;
                    rawData = filterDataForUser(res.data || []);

                    if (sheetName === 'Organization Structure ') {
                        renderOrgChart(rawData);
                    } else {
                        renderTable(rawData);
                    }
                } else {
                    showToast(res.message, 'error');
                }
            } catch (error) {
                console.error("Render Table Error:", error);
                showToast('ดึงข้อมูลสำเร็จ แต่พบปัญหาการแสดงผลตาราง', 'error');
            } finally {
                toggleLoading(false);
            }
        })
        .withFailureHandler(err => {
            showToast('Connection failed: ' + err.message, 'error');
            toggleLoading(false);
        })
        .getSheetData(sheetName, forceRefresh);
}

function filterData() {
    const keyword = document.getElementById('searchInput').value.toLowerCase();
    const startDateStr = document.getElementById('tableStartDate') ? document.getElementById('tableStartDate').value : '';
    const endDateStr = document.getElementById('tableEndDate') ? document.getElementById('tableEndDate').value : '';

    let filtered = rawData;

    if (keyword) {
        filtered = filtered.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(keyword)));
    }

    if (startDateStr || endDateStr) {
        let startObj = startDateStr ? new Date(startDateStr) : null;
        let endObj = endDateStr ? new Date(endDateStr) : null;
        if (startObj) startObj.setHours(0, 0, 0, 0);
        if (endObj) endObj.setHours(23, 59, 59, 999);

        filtered = filtered.filter(row => {
            let rowDateStr = null;
            for (let key in row) {
                let lwK = String(key).toLowerCase().trim();
                if (lwK === 'start_date' || lwK === 'date' || lwK.includes('วันที่') || lwK === 'start date') {
                    rowDateStr = row[key];
                    break;
                }
            }

            if (!rowDateStr || rowDateStr === '-') return true;

            let rowDate = new Date(rowDateStr);
            if (isNaN(rowDate.getTime())) {
                let parts = String(rowDateStr).split(/[\/\-]/);
                if (parts.length === 3) {
                    if (parts[2].length === 4) {
                        rowDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
                    } else if (parts[0].length === 4) {
                        rowDate = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
                    }
                }
            }

            if (isNaN(rowDate.getTime())) return true;
            rowDate.setHours(12, 0, 0, 0);

            if (startObj && rowDate < startObj) return false;
            if (endObj && rowDate > endObj) return false;

            return true;
        });
    }

    if (currentSheet === 'Organization Structure ') renderOrgChart(filtered);
    else renderTable(filtered);
}

function changeApprovalStatus(id, columnName, selectElement) {
    const newValue = selectElement.value;
    if (!newValue) return;

    let isDanger = newValue === 'Rejected' || newValue === 'Inactive';

    showConfirmModal(
        'Confirm Status Change',
        `Are you sure you want to change status to <br><b class="${isDanger ? 'text-red-500' : 'text-brandindigo'} uppercase tracking-wide">"${newValue}"</b>?`,
        () => {
            const rowIndex = rawData.findIndex(r => getRecordId(r) === id);
            if (rowIndex > -1) {
                rawData[rowIndex][columnName] = newValue;
                if (tableCache[currentSheet]) tableCache[currentSheet].data = rawData;
                renderTable(rawData);
            }

            toggleLoading(true, 'SAVING STATUS...');
            google.script.run
                .withSuccessHandler(res => {
                    toggleLoading(false);
                    if (res.success) showSuccessModal("Status Updated", `Successfully changed status to <b>${newValue}</b>`);
                    else { showToast(res.message, 'error'); fetchData(currentSheet, true); }
                })
                .withFailureHandler(err => {
                    toggleLoading(false);
                    showToast('Connection failed: ' + err.message, 'error');
                    fetchData(currentSheet, true);
                })
                .updateRecordData(currentSheet, id, columnName, newValue);
        },
        () => {
            renderTable(rawData);
        },
        isDanger
    );
}

function getFuzzyValue(row, searchKeys, defaultIndex = null) {
    for (let k in row) {
        let lwK = k.toLowerCase().trim();
        for (let searchKey of searchKeys) {
            if (lwK.includes(searchKey.toLowerCase())) return row[k];
        }
    }
    if (defaultIndex !== null && Object.keys(row).length > defaultIndex) return Object.values(row)[defaultIndex];
    return '-';
}
