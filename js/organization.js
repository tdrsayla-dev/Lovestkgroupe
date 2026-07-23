// ─────────────────────────────────────────────────────────────────────────────
// js/organization.js - Modernized Organization Structure Chart Rendering
// ─────────────────────────────────────────────────────────────────────────────

let orgChartZoom = 1;
let selectedOrgDept = 'ALL';

function setOrgZoom(delta) {
    if (delta === 0) {
        orgChartZoom = 1;
    } else {
        orgChartZoom = Math.max(0.4, Math.min(1.8, Math.round((orgChartZoom + delta) * 10) / 10));
    }
    const treeEl = document.getElementById('org-tree-container');
    const zoomTextEl = document.getElementById('org-zoom-level');
    if (treeEl) {
        treeEl.style.transform = `scale(${orgChartZoom})`;
        treeEl.style.transformOrigin = 'top center';
    }
    if (zoomTextEl) {
        zoomTextEl.innerText = Math.round(orgChartZoom * 100) + '%';
    }
}

function filterOrgDept(deptName) {
    selectedOrgDept = deptName;
    if (window._rawOrgData) {
        renderOrgChart(window._rawOrgData, true);
    }
}

function createOrgCard(person) {
    let picUrl = getFuzzyValue(person, ['photos', 'photo', 'profile', 'รูป', 'pic', 'image']);
    let name = getFuzzyValue(person, ['first_name', 'name', 'ชื่อ', 'full_name', 'employee']);
    let lastName = getFuzzyValue(person, ['last_name', 'นามสกุล']);
    let fullName = name !== '-' ? (lastName !== '-' ? name + ' ' + lastName : name) : 'Unknown';

    let empId = getFuzzyValue(person, ['employee_id', 'emp_id', 'id']) || '';

    let cleanFullName = fullName;
    if (empId && cleanFullName.toUpperCase().includes(empId.toUpperCase())) {
        cleanFullName = cleanFullName.replace(new RegExp(empId, 'ig'), '').trim();
        if (cleanFullName.startsWith('-')) cleanFullName = cleanFullName.substring(1).trim();
    }

    const colors = ['#4f46e5', '#0284c7', '#0d9488', '#16a34a', '#d97706', '#9333ea', '#db2777'];
    let hash = 0;
    for (let i = 0; i < cleanFullName.length; i++) {
        hash = cleanFullName.charCodeAt(i) + ((hash << 5) - hash);
    }
    let themeColor = colors[Math.abs(hash) % colors.length];

    const encodedName = encodeURIComponent(cleanFullName);
    const fallbackAvatar = `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=${encodedName}&size=128&bold=true`;

    if (picUrl && picUrl.includes('drive.google.com')) {
        let fileId = picUrl.includes('id=') ? picUrl.split('id=')[1].split('&')[0] : (picUrl.includes('/d/') ? picUrl.split('/d/')[1].split('/')[0] : '');
        if (fileId) picUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w300';
    }

    if (!picUrl || picUrl === '-' || picUrl.trim() === '' || picUrl === '[object Object]') {
        picUrl = fallbackAvatar;
    }

    let position = getFuzzyValue(person, ['position', 'ตำแหน่ง', 'position_id']) || '-';
    let dept = getFuzzyValue(person, ['department_name', 'department', 'แผนก', 'department_id']) || '';
    let posLower = position.toLowerCase();

    let isExecutive = posLower.includes('ceo') || posLower.includes('ประธาน') || posLower.includes('md') || posLower.includes('managing');
    let isCLevel = posLower.includes('cfo') || posLower.includes('coo') || posLower.includes('cto') || posLower.includes('cmo') || posLower.includes('director') || posLower.includes('ผู้อำนวยการ') || posLower.includes('ผู้บริหาร') || posLower.includes('c-level');
    let isManager = posLower.includes('manager') || posLower.includes('ผู้จัดการ') || posLower.includes('mgr') || posLower.includes('head') || posLower.includes('หัวหน้า');

    let cardGradient = 'from-brandindigo to-brandpurple';
    let badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    let avatarRing = 'ring-4 ring-indigo-500/20';

    if (isExecutive) {
        cardGradient = 'from-amber-500 via-purple-600 to-indigo-600';
        badgeColor = 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold';
        avatarRing = 'ring-4 ring-amber-400/60 shadow-lg shadow-amber-500/20';
    } else if (isCLevel) {
        cardGradient = 'from-blue-600 via-indigo-600 to-purple-600';
        badgeColor = 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
        avatarRing = 'ring-4 ring-blue-500/30';
    } else if (isManager) {
        cardGradient = 'from-emerald-600 to-teal-600';
        badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        avatarRing = 'ring-2 ring-emerald-500/30';
    }

    const rowId = getRecordId(person);
    const encodedPerson = encodeURIComponent(JSON.stringify(person)).replace(/'/g, "%27");

    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff';
    if (sessionStr) { try { let s = JSON.parse(sessionStr); role = s.role || 'Staff'; } catch (e) { } }

    return `
        <div class="inline-block group relative mx-3 my-2 text-left" onclick="showEmployeeProfile('${encodedPerson}')">
            <!-- Executive Glassmorphic Card -->
            <div class="w-64 bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.08)] group-hover:shadow-[0_12px_30px_-4px_rgba(79,70,229,0.22)] transition-all duration-300 transform group-hover:-translate-y-1.5 cursor-pointer overflow-hidden relative">
                
                <!-- Top Accent Line -->
                <div class="h-2 w-full bg-gradient-to-r ${cardGradient}"></div>

                <!-- Admin Quick Actions -->
                ${role !== 'Staff' ? `
                <div class="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-gray-100 p-1 flex space-x-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()">
                    <button onclick="openFormModal('${encodedPerson}')" title="Edit Record" class="text-blue-600 hover:bg-blue-50 w-6 h-6 rounded-md flex items-center justify-center transition-colors"><i class="fa-solid fa-pen-to-square text-xs"></i></button>
                    <button onclick="deleteRecord('${rowId}')" title="Delete Record" class="text-red-500 hover:bg-red-50 w-6 h-6 rounded-md flex items-center justify-center transition-colors"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>` : ''}

                <div class="p-4 flex flex-col items-center text-center">
                    <!-- Avatar Image -->
                    <div class="relative mb-2.5">
                        <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-white ${avatarRing} shadow-md bg-gray-50 flex-shrink-0">
                            <img src="${picUrl}" alt="${cleanFullName}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.onerror=null; this.src='${fallbackAvatar}'">
                        </div>
                        ${isExecutive ? `<span class="absolute -top-1.5 -right-1.5 bg-amber-400 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm"><i class="fa-solid fa-crown"></i></span>` : ''}
                    </div>

                    <!-- Employee ID Badge -->
                    ${empId ? `<span class="inline-block px-2.5 py-0.5 mb-1 text-[10px] font-bold rounded-full border ${badgeColor}">${empId}</span>` : ''}

                    <!-- Full Name -->
                    <h3 class="font-bold text-sm text-gray-900 leading-snug truncate w-full group-hover:text-brandindigo transition-colors" title="${cleanFullName}">${cleanFullName}</h3>

                    <!-- Position -->
                    <p class="text-xs font-semibold text-brandindigo truncate w-full mt-0.5" title="${position}">${position}</p>

                    <!-- Department Tag -->
                    ${dept && dept !== '-' ? `
                    <div class="mt-2 pt-2 border-t border-gray-100 w-full flex items-center justify-center text-[11px] text-gray-500 font-medium truncate">
                        <i class="fa-solid fa-building text-[10px] text-gray-400 mr-1.5"></i>
                        <span class="truncate" title="${dept}">${dept}</span>
                    </div>` : ''}
                </div>
            </div>
        </div>`;
}

/* =====================================================================
 * 📌 ส่วนที่ 16: ORGANIZATION CHART (ฟังก์ชันแผนผังองค์กรแบบใหม่)
 * ===================================================================== */
function renderOrgChart(data, isFilteredCall = false) {
    const orgWrapper = document.getElementById('org-chart-wrapper');
    if (!orgWrapper) return;

    ['table-controls-wrapper', 'table-wrapper', 'card-wrapper', 'table-summary', 'calendar-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    orgWrapper.classList.remove('hidden');

    if (!isFilteredCall) {
        window._rawOrgData = data;
    }

    if (!data || data.length === 0) {
        orgWrapper.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-gray-500 mt-10"><i class="fa-solid fa-sitemap text-5xl mb-4 text-gray-300"></i><p class="font-medium">No organizational data available.</p></div>';
        return;
    }

    // Extract all unique departments
    const allDeptsSet = new Set();
    window._rawOrgData.forEach(emp => {
        let status = String(getFuzzyValue(emp, ['status', 'สถานะ'])).toLowerCase();
        if (status.includes('inactive') || status.includes('ลาออก') || status.includes('พ้นสภาพ')) return;
        let dept = String(getFuzzyValue(emp, ['department_name', 'department', 'แผนก', 'department_id']) || 'General').toUpperCase().trim();
        if (dept && dept !== '-') allDeptsSet.add(dept);
    });
    const deptList = Array.from(allDeptsSet).sort();

    let ceos = [], clevels = [];
    let depts = {};

    window._rawOrgData.forEach(emp => {
        let status = String(getFuzzyValue(emp, ['status', 'สถานะ'])).toLowerCase();
        if (status.includes('inactive') || status.includes('ลาออก') || status.includes('พ้นสภาพ')) return;

        let pos = String(getFuzzyValue(emp, ['position', 'ตำแหน่ง', 'position_id'])).toLowerCase();
        let dept = String(getFuzzyValue(emp, ['department_name', 'department', 'แผนก', 'department_id']) || 'General').toUpperCase().trim();

        if (selectedOrgDept !== 'ALL' && dept !== selectedOrgDept && !pos.includes('ceo') && !pos.includes('md') && !pos.includes('c-level')) {
            return;
        }

        if (pos.includes('ceo') || pos.includes('ประธาน') || pos.includes('md') || pos.includes('managing')) {
            ceos.push(emp);
        } else if (pos.includes('cfo') || pos.includes('coo') || pos.includes('cto') || pos.includes('cmo') || pos.includes('director') || pos.includes('ผู้อำนวยการ') || pos.includes('ผู้บริหาร') || pos.includes('c-level')) {
            clevels.push(emp);
        } else {
            if (!depts[dept]) depts[dept] = { managers: [], heads: [], staffs: [] };
            if (pos.includes('manager') || pos.includes('ผู้จัดการ') || pos.includes('mgr')) {
                depts[dept].managers.push(emp);
            } else if (pos.includes('head') || pos.includes('หัวหน้า') || pos.includes('lead') || pos.includes('supervisor')) {
                depts[dept].heads.push(emp);
            } else {
                depts[dept].staffs.push(emp);
            }
        }
    });

    let deptBranchesHtml = '';

    Object.keys(depts).sort().forEach(deptName => {
        let d = depts[deptName];
        let staffHtml = d.staffs.length > 0 ? `<ul><li><div class="flex justify-center flex-wrap gap-2">${d.staffs.map(e => createOrgCard(e)).join('')}</div></li></ul>` : '';
        let headHtml = d.heads.length > 0 ? `<ul><li><div class="flex justify-center flex-wrap gap-2">${d.heads.map(e => createOrgCard(e)).join('')}</div>${staffHtml}</li></ul>` : staffHtml;

        let branchLi = '';
        if (d.managers.length > 0) {
            branchLi = `<li><div class="flex justify-center flex-wrap gap-2">${d.managers.map(e => createOrgCard(e)).join('')}</div>${headHtml}</li>`;
        } else if (d.heads.length > 0) {
            branchLi = `<li><div class="flex justify-center flex-wrap gap-2">${d.heads.map(e => createOrgCard(e)).join('')}</div>${staffHtml}</li>`;
        } else if (d.staffs.length > 0) {
            branchLi = `<li><div class="flex justify-center flex-wrap gap-2">${d.staffs.map(e => createOrgCard(e)).join('')}</div></li>`;
        }
        deptBranchesHtml += branchLi;
    });

    let deptsUl = deptBranchesHtml ? `<ul>${deptBranchesHtml}</ul>` : '';

    let clevelHtml = '';
    if (clevels.length > 0) {
        clevelHtml = `<ul><li><div class="flex justify-center flex-wrap gap-4 relative z-10">${clevels.map(e => createOrgCard(e)).join('')}</div>${deptsUl}</li></ul>`;
    } else {
        clevelHtml = deptsUl;
    }

    let finalTreeHtml = '';
    if (ceos.length > 0) {
        finalTreeHtml = `<ul><li><div class="flex justify-center flex-wrap gap-4 relative z-10">${ceos.map(e => createOrgCard(e)).join('')}</div>${clevelHtml}</li></ul>`;
    } else {
        finalTreeHtml = clevelHtml;
    }

    // Controls Header Toolbar
    const deptPills = `
        <button onclick="filterOrgDept('ALL')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${selectedOrgDept === 'ALL' ? 'bg-gradient-to-r from-brandindigo to-brandpurple text-white shadow-indigo-500/20' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}">
            <i class="fa-solid fa-layer-group mr-1"></i> All (${window._rawOrgData.length})
        </button>
        ${deptList.map(d => `
            <button onclick="filterOrgDept('${d}')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${selectedOrgDept === d ? 'bg-gradient-to-r from-brandindigo to-brandpurple text-white shadow-indigo-500/20' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}">
                ${d}
            </button>
        `).join('')}
    `;

    const toolbarHtml = `
        <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-gray-200/80 shadow-sm">
            <div class="flex items-center flex-wrap gap-2 overflow-x-auto custom-scrollbar flex-1">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1 flex items-center"><i class="fa-solid fa-filter mr-1.5 text-brandindigo"></i> Department:</span>
                ${deptPills}
            </div>
            
            <div class="flex items-center justify-end gap-2 shrink-0">
                <div class="bg-gray-100/80 rounded-xl p-1 flex items-center gap-1 border border-gray-200/80 shadow-inner">
                    <button onclick="setOrgZoom(-0.1)" title="Zoom Out" class="w-8 h-8 rounded-lg bg-white text-gray-700 hover:bg-indigo-50 hover:text-brandindigo font-bold flex items-center justify-center shadow-sm transition-all active:scale-95"><i class="fa-solid fa-minus text-xs"></i></button>
                    <span id="org-zoom-level" class="text-xs font-bold text-gray-700 px-2 min-w-[45px] text-center">${Math.round(orgChartZoom * 100)}%</span>
                    <button onclick="setOrgZoom(0.1)" title="Zoom In" class="w-8 h-8 rounded-lg bg-white text-gray-700 hover:bg-indigo-50 hover:text-brandindigo font-bold flex items-center justify-center shadow-sm transition-all active:scale-95"><i class="fa-solid fa-plus text-xs"></i></button>
                    <button onclick="setOrgZoom(0)" title="Reset Zoom" class="w-8 h-8 rounded-lg bg-white text-gray-700 hover:bg-indigo-50 hover:text-brandindigo font-bold flex items-center justify-center shadow-sm transition-all active:scale-95"><i class="fa-solid fa-rotate text-xs"></i></button>
                </div>
            </div>
        </div>
    `;

    const styles = `<style>
        .org-tree * { margin: 0; padding: 0; box-sizing: border-box; }
        .org-tree-wrapper { display: flex; justify-content: center; width: 100%; overflow-x: auto; padding-bottom: 60px; min-height: 500px; }
        .org-tree { display: flex; justify-content: center; width: 100%; transition: transform 0.2s ease-out; }
        .org-tree ul { padding-top: 30px; position: relative; transition: all 0.3s; display: flex; justify-content: center; white-space: nowrap; }
        .org-tree li { float: left; text-align: center; list-style-type: none; position: relative; padding: 30px 6px 0 6px; transition: all 0.3s; }
        
        .org-tree li::before, .org-tree li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 2px solid #6366f1; width: 50%; height: 30px; }
        .org-tree li::after { right: auto; left: 50%; border-left: 2px solid #6366f1; }
        
        .org-tree li:only-child::after, .org-tree li:only-child::before { display: none; }
        .org-tree li:only-child { padding-top: 0; }
        
        .org-tree li:first-child::before, .org-tree li:last-child::after { border: 0 none; }
        
        .org-tree li:last-child::before { border-right: 2px solid #6366f1; border-radius: 0 12px 0 0; }
        .org-tree li:first-child::after { border-radius: 12px 0 0 0; }
        
        .org-tree ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 2px solid #6366f1; width: 0; height: 30px; transform: translateX(-50%); }
    </style>`;

    orgWrapper.innerHTML = styles + toolbarHtml + `<div class="org-tree-wrapper custom-scrollbar"><div id="org-tree-container" class="org-tree inline-block min-w-max pt-6" style="transform: scale(${orgChartZoom}); transform-origin: top center;">` + finalTreeHtml + `</div></div>`;
}
