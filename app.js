/* ==========================================
   Max Shipping - Shipping Portal JS
   ========================================== */

// Global State
let orders = [];
let selectedFile = null;
let syncInterval = null;

// Supabase configuration
// Replace these values with your Supabase project settings.
const SUPABASE_URL = 'https://jiwmcrkhpadkzozcdigk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kF1taXJFpJaKTpb5KPiMwA_vt_N2RGX';
const SUPABASE_STORAGE_BUCKET = 'shipping-files';
const SUPABASE_ORDERS_TABLE = 'shipping_orders';
const SUPABASE_SETTINGS_TABLE = 'shipping_settings';
let supabaseClient = null;

// Track last stat values for animated counters
let lastActiveCount = 0;
let lastReceivedCount = 0;
let lastCarriersCount = 0;

// Sort state variables
let currentSortColumn = 'id';
let currentSortDirection = 'desc';

// Gallery state variables
let currentGalleryFiles = [];
let currentGalleryIndex = 0;
let zoomScale = 1.0;
let rotateAngle = 0;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panOffset = { x: 0, y: 0 };
let activeObjectURL = null;
let currentGalleryOrder = null;

// Upload file state variables
let selectedPackingSlipFile = null;
let selectedPodFiles = [];
let selectedOsdFiles = [];

let currentAdminSelectedCarrier = 'UPS';
let tempCarrierSupportInfo = {};

const DEFAULT_SETTINGS = {
    managerEmails: 'purchasing@maxshipping.com',
    emailSubjectTemplate: '[RECEIVED] PO# {po_number} - {supplier}',
    emailBodyTemplate: `Hi Purchasing Team,

{issue_notice}We have received the following shipment today:

• PO Number: {po_number}
• Supplier: {supplier}
• Items: {item_description}
• Carrier: {carrier} ({tracking_number})

• Received By: {received_by}
• Received Date: {received_date}
• Receiving Notes: {notes}

{action_required}The invoice/packing slip scan has been saved to Supabase Storage.

Best regards,
Shipping & Receiving Department
Max Shipping`,
    employees: ["Bryan", "Maksym", "Stacey", "Emily", "Bryson", "Thomas", "Jacque", "Amanda", "Daren"],
    adminPassword: 'admin',
    carrierSupportInfo: {
        'UPS': {
            title: 'UPS Claims & Support',
            phone: '1-800-742-5877 (1-800-PICK-UPS)',
            link: 'https://www.ups.com/ca/en/support/file-a-claim.page',
            instructions: 'Report damage or missing packages immediately. Keep all packaging materials for inspection.'
        },
        'FedEx': {
            title: 'FedEx Claims & Support',
            phone: '1-800-463-3339 (1-800-Go-FedEx)',
            link: 'https://www.fedex.com/en-ca/customer-support/claims.html',
            instructions: 'File claims for visible damage/shortage within 21 days. Keep original shipping carton.'
        },
        'DHL': {
            title: 'DHL Express Claims & Support',
            phone: '1-855-345-7447',
            link: 'https://www.dhl.com/ca-en/home/our-divisions/express/customer-service/claims.html',
            instructions: 'Submit claims in writing with photos of package damage within 30 days.'
        },
        'Canada Post': {
            title: 'Canada Post Support',
            phone: '1-866-607-6301',
            link: 'https://www.canadapost-postescanada.ca/cpc/en/support/kb/claims/file-a-claim',
            instructions: 'Contact Canada Post within 30 days of delivery. The sender must initiate the official claim.'
        },
        'Purolator': {
            title: 'Purolator Claims & Support',
            phone: '1-888-787-6528 (1-888-SHIP-123)',
            link: 'https://www.purolator.com/en/resources-support/file-claim',
            instructions: 'File claims within 21 days for hidden damage or shortage. Retain all packaging.'
        },
        'Manitoulin': {
            title: 'Manitoulin Transport Claims',
            phone: '1-800-265-1485',
            email: 'custservice@manitoulintransport.com',
            link: 'https://manitoulintransport.com/claims-process/',
            instructions: 'Note damages on the delivery receipt (BOL) before the driver leaves. File claim within 60 days.'
        },
        'Gardewine': {
            title: 'Gardewine Claims & Support',
            phone: '1-800-282-8000 (Winnipeg)',
            email: 'claims@gardewine.com',
            link: 'https://www.gardewine.com/',
            instructions: 'Ensure damage/shortage is noted on the Delivery Receipt. File written claim within 60 days.'
        },
        'DayRoss': {
            title: 'Day & Ross Claims & Support',
            phone: '1-866-329-7677',
            email: 'custservice@dayandrossinc.ca',
            link: 'https://dayross.com',
            instructions: 'File cargo loss or damage claims within 60 days. Ensure discrepancies are noted on the BOL at delivery.'
        },
        'ABF': {
            title: 'ABF Freight (ArcBest) Claims',
            phone: '1-800-610-5544',
            link: 'https://arcb.com/track',
            instructions: 'File damage/shortage claims immediately. Note all exceptions on the delivery receipt.'
        },
        'TST-express': {
            title: 'TST-CF Express Claims & Support',
            phone: '1-888-878-9229',
            email: 'customerservice@tst-cfexpress.com',
            link: 'https://www.tst-cfexpress.com',
            instructions: 'Note damage or shortage on the delivery receipt before signing. File intentions within 24-48 hours.'
        },
        'LTL / Other': {
            title: 'LTL Freight / Custom Carrier Support',
            instructions: 'Please inspect the shipment carefully. Note all damages/discrepancies on the Bill of Lading (BOL) before the driver departs. Take clear photos of all labels and damaged areas.'
        }
    }
};

let settings = { ...DEFAULT_SETTINGS };

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    setupTheme();
    setupEventListeners();
    await tryAutoConnect();
});

// Setup Dark/Light Theme
function setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggleIcon(savedTheme);
    
    const btnThemeToggle = document.getElementById('btnThemeToggle');
    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeToggleIcon(newTheme);
        });
    }
}

function updateThemeToggleIcon(theme) {
    const btnThemeToggle = document.getElementById('btnThemeToggle');
    if (btnThemeToggle) {
        const icon = btnThemeToggle.querySelector('i');
        if (icon) {
            if (theme === 'dark') {
                icon.className = 'fa-solid fa-sun';
            } else {
                icon.className = 'fa-solid fa-moon';
            }
        }
    }
}

function isSupabaseConfigured() {
    return Boolean(
        SUPABASE_URL &&
        SUPABASE_ANON_KEY &&
        !SUPABASE_URL.includes('YOUR-PROJECT-REF') &&
        !SUPABASE_ANON_KEY.includes('YOUR-SUPABASE-ANON-KEY')
    );
}

function getSupabaseClient() {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured. Add your project URL and anon key in app.js.');
    }
    
    if (!window.supabase || !window.supabase.createClient) {
        throw new Error('Supabase library did not load. Check your internet connection or host the library locally.');
    }
    
    if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    
    return supabaseClient;
}

// Auto-connect to Supabase on page load
async function tryAutoConnect() {
    try {
        if (isSupabaseConfigured()) {
            await connectSupabase();
        } else {
            showUnconfiguredState();
        }
    } catch (err) {
        console.error('Error connecting to Supabase:', err);
        showUnconfiguredState();
    }
}

// Show state when Supabase has not been configured yet
function showUnconfiguredState() {
    const statusDiv = document.getElementById('connectionStatus');
    statusDiv.className = 'status-badge disconnected';
    statusDiv.innerHTML = '<span class="indicator"></span><span class="status-text">Not Configured</span>';
    statusDiv.style.cursor = 'default';
    statusDiv.onclick = null;
    
    // Onboarding UI
    document.getElementById('onboardingIcon').innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--brand-red);"></i>';
    document.getElementById('onboardingTitle').textContent = 'Supabase Not Configured';
    document.getElementById('onboardingDesc').innerHTML = 'Add your Supabase project URL and anon key in <strong>app.js</strong>, then refresh this page.';
    
    document.getElementById('onboardingActionArea').innerHTML = '';
}

async function connectSupabase() {
    try {
        getSupabaseClient();
        
        await loadSettings();
        
        const statusDiv = document.getElementById('connectionStatus');
        statusDiv.className = 'status-badge connected';
        statusDiv.innerHTML = '<span class="indicator"></span><span class="status-text">Supabase Connected</span>';
        statusDiv.style.cursor = 'default';
        statusDiv.onclick = null;
        
        const pathSpan = document.getElementById('adminFolderPath');
        if (pathSpan) {
            pathSpan.textContent = `Connected: ${new URL(SUPABASE_URL).hostname}`;
        }
        
        document.getElementById('onboardingSection').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        
        await syncDatabase();
        
        if (syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(syncDatabase, 10000);
    } catch (err) {
        console.error('Failed to connect Supabase:', err);
        alert(err.message || 'Could not connect to Supabase. Please check configuration and table permissions.');
    }
}

// Load settings from Supabase
async function loadSettings() {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from(SUPABASE_SETTINGS_TABLE)
            .select('data')
            .eq('key', 'default')
            .maybeSingle();
        
        if (error) throw error;
        
        if (data && data.data) {
            settings = data.data;
            // Fallback for missing fields (backward compatibility)
            if (!settings.employees) settings.employees = DEFAULT_SETTINGS.employees;
            if (!settings.adminPassword) settings.adminPassword = DEFAULT_SETTINGS.adminPassword;
            if (!settings.emailSubjectTemplate) settings.emailSubjectTemplate = DEFAULT_SETTINGS.emailSubjectTemplate;
            if (!settings.emailBodyTemplate) settings.emailBodyTemplate = DEFAULT_SETTINGS.emailBodyTemplate;
            if (!settings.carrierSupportInfo) settings.carrierSupportInfo = DEFAULT_SETTINGS.carrierSupportInfo;
        } else {
            // Write defaults if empty
            settings = { ...DEFAULT_SETTINGS };
            await saveSettings();
        }
        populateEmployeeDropdowns();
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

async function saveSettings() {
    try {
        const client = getSupabaseClient();
        const { error } = await client
            .from(SUPABASE_SETTINGS_TABLE)
            .upsert({ key: 'default', data: settings }, { onConflict: 'key' });
        
        if (error) throw error;
    } catch (err) {
        console.error('Failed to save settings:', err);
        throw err;
    }
}

async function saveOrderRecord(order) {
    const client = getSupabaseClient();
    const { error } = await client
        .from(SUPABASE_ORDERS_TABLE)
        .upsert({ id: Number(order.id), data: order }, { onConflict: 'id' });
    
    if (error) throw error;
}

async function deleteOrderRecord(orderId) {
    const client = getSupabaseClient();
    const { error } = await client
        .from(SUPABASE_ORDERS_TABLE)
        .delete()
        .eq('id', Number(orderId));
    
    if (error) throw error;
}

async function uploadStorageFile(folder, filename, file) {
    const client = getSupabaseClient();
    const path = `${folder}/${filename}`;
    const { error } = await client
        .storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(path, file, {
            upsert: true,
            contentType: file.type || 'application/octet-stream'
        });
    
    if (error) throw error;
    return filename;
}

async function getStorageFileUrl(folder, filename) {
    const client = getSupabaseClient();
    const path = `${folder}/${filename}`;
    const { data, error } = await client
        .storage
        .from(SUPABASE_STORAGE_BUCKET)
        .createSignedUrl(path, 60 * 60);
    
    if (error) throw error;
    return data.signedUrl;
}

// Sync Database (Read all order JSON files)
async function syncDatabase() {
    if (!supabaseClient) return;
    
    const refreshBtn = document.getElementById('btnRefresh');
    let refreshIcon = null;
    if (refreshBtn) {
        refreshIcon = refreshBtn.querySelector('i');
        if (refreshIcon) refreshIcon.classList.add('spinning');
    }
    
    try {
        // Sync settings from Supabase in background
        await loadSettings();
        
        const client = getSupabaseClient();
        const { data, error } = await client
            .from(SUPABASE_ORDERS_TABLE)
            .select('id, data')
            .order('id', { ascending: false });
        
        if (error) throw error;
        
        const loadedOrders = (data || []).map(row => row.data);
        
        // Sort: newest orders first (based on ordered_date and timestamp ID)
        loadedOrders.sort((a, b) => b.id - a.id);
        
        orders = loadedOrders;
        renderDashboard();
    } catch (err) {
        console.error('Failed to sync Supabase data:', err);
        const statusDiv = document.getElementById('connectionStatus');
        if (statusDiv.classList.contains('connected')) {
            statusDiv.className = 'status-badge disconnected';
            statusDiv.innerHTML = '<span class="indicator"></span><span class="status-text">Sync Error</span>';
        }
    } finally {
        if (refreshIcon) {
            setTimeout(() => {
                refreshIcon.classList.remove('spinning');
            }, 600);
        }
    }
}

// Render Dashboard Data
function renderDashboard() {
    const tableBody = document.getElementById('ordersTableBody');
    const emptyState = document.getElementById('emptyState');
    const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
    const filterStatus = document.getElementById('filterStatus').value;
    const filterCarrier = document.getElementById('filterCarrier').value;
    
    tableBody.innerHTML = '';
    
    // Filter orders
    const filteredOrders = orders.filter(order => {
        // Status filter
        if (filterStatus !== 'all' && order.status !== filterStatus) return false;
        
        // Carrier filter
        if (filterCarrier !== 'all') {
            if (filterCarrier === 'LTL / Other') {
                if (['UPS', 'FedEx', 'DHL', 'Canada Post', 'Purolator', 'Manitoulin', 'Gardewine', 'DayRoss', 'ABF', 'TST-express'].includes(order.carrier)) return false;
            } else if (order.carrier !== filterCarrier) {
                return false;
            }
        }
        
        // Search text
        if (searchVal) {
            const matchesSearch = 
                (order.po_number && order.po_number.toLowerCase().includes(searchVal)) ||
                (order.supplier && order.supplier.toLowerCase().includes(searchVal)) ||
                (order.item_description && order.item_description.toLowerCase().includes(searchVal)) ||
                (order.ordered_by && order.ordered_by.toLowerCase().includes(searchVal)) ||
                (order.tracking_number && order.tracking_number.toLowerCase().includes(searchVal)) ||
                (order.notes && order.notes.toLowerCase().includes(searchVal));
            
            if (!matchesSearch) return false;
        }
        
        return true;
    });
    
    // Sort filtered orders dynamically
    if (currentSortColumn) {
        filteredOrders.sort((a, b) => {
            let valA = a[currentSortColumn];
            let valB = b[currentSortColumn];
            
            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';
            
            if (currentSortColumn === 'id') {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
            } else if (currentSortColumn === 'ordered_date' || currentSortColumn === 'received_date') {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }
            
            if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    // Update Stats counters
    updateStats();
    
    // Show/Hide Empty State
    if (filteredOrders.length === 0) {
        emptyState.classList.remove('hidden');
        document.getElementById('recordCount').textContent = 'Showing 0 orders';
        return;
    } else {
        emptyState.classList.add('hidden');
        document.getElementById('recordCount').textContent = `Showing ${filteredOrders.length} order${filteredOrders.length > 1 ? 's' : ''}`;
    }
    
    // Render Table Rows
    filteredOrders.forEach(order => {
        const tr = document.createElement('tr');
        
        // Format Tracking Column
        let trackingCell = '-';
        if (order.tracking_number) {
            const carrierLabel = order.carrier || 'LTL / Other';
            const url = getTrackingUrl(order.carrier, order.tracking_number);
            if (url) {
                trackingCell = `
                    <div class="tracking-link-wrapper">
                        <span>${carrierLabel}</span>
                        <a href="${url}" target="_blank" class="tracking-link">
                            ${order.tracking_number} <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                    </div>`;
            } else {
                trackingCell = `
                    <div class="tracking-link-wrapper">
                        <span>${carrierLabel}</span>
                        <span class="tracking-no-link">${order.tracking_number}</span>
                    </div>`;
            }
        }
        
        // Format Attachments Column
        let scanCell = '';
        if (order.packing_slip_filename) {
            scanCell += `
                <button class="btn-scan attached" onclick="viewFileAttachment('${order.id}', 'packing_slip')" title="View Packing Slip" style="margin-bottom: 0.25rem;">
                    <i class="fa-solid fa-file-invoice"></i> Slip
                </button>`;
        }
        const podFiles = order.invoice_filenames || (order.invoice_filename ? [order.invoice_filename] : []);
        if (podFiles.length > 0) {
            scanCell += `
                <button class="btn-scan attached" onclick="viewFileAttachment('${order.id}', 'pod')" title="View POD" style="margin-bottom: 0.25rem;">
                    <i class="fa-solid fa-file-signature"></i> POD (${podFiles.length})
                </button>`;
        }
        if (order.osd_photos && order.osd_photos.length > 0) {
            scanCell += `
                <button class="btn-scan attached" onclick="viewOsdPhotos('${order.id}')" title="View Damage Photos" style="margin-bottom: 0.25rem; background: var(--status-error-bg); border-color: rgba(220, 38, 38, 0.3); color: var(--status-error);">
                    <i class="fa-solid fa-camera"></i> OSD (${order.osd_photos.length})
                </button>`;
        }
        if (!scanCell) {
            scanCell = `<span class="text-muted"><i class="fa-solid fa-minus"></i> None</span>`;
        }
        
        // Format Actions
        let actionCellHtml = '';
        if (order.status === 'Ordered' || order.status === 'In Transit') {
            actionCellHtml += `
                <button class="btn-table-action receive" onclick="openReceiveModal('${order.id}')" title="Receive Order">
                    <i class="fa-solid fa-check"></i> Receive
                </button>`;
        }
        
        actionCellHtml += `
            <button class="btn-table-action" onclick="openEditModal('${order.id}')" title="Edit Order">
                <i class="fa-regular fa-pen-to-square"></i>
            </button>`;
            
        if (order.status !== 'Received') {
            actionCellHtml += `
                <button class="btn-table-action delete" onclick="deleteOrder('${order.id}')" title="Delete Order">
                    <i class="fa-regular fa-trash-can"></i>
                </button>`;
        }
            
        // Format Status Column
        let statusCell = `<span class="badge ${order.status.toLowerCase().replace(' ', '-')}"><span class="badge-dot"></span>${order.status}</span>`;
        if (order.status === 'Received' && order.received_by && order.received_date) {
            statusCell += `<div class="received-info">by ${escapeHtml(order.received_by)}<br>${formatDateTimeDisplay(order.received_date)}</div>`;
        }
        if (order.has_issue) {
            statusCell += `<div class="badge-issue"><i class="fa-solid fa-triangle-exclamation"></i> OSD Reported</div>`;
        }
        
        const classificationBadge = order.classification ? `<div class="class-badge class-${order.classification.toLowerCase()}">${escapeHtml(order.classification)}</div>` : '';
        
        tr.innerHTML = `
            <td class="po-col">
                <a href="#" class="po-details-link" onclick="viewOrderDetails('${order.id}'); return false;">${escapeHtml(order.po_number)}</a>
                ${classificationBadge}
            </td>
            <td class="supplier-col">${escapeHtml(order.supplier)}</td>
            <td class="desc-col" title="${escapeHtml(order.item_description || '')}">${escapeHtml(order.item_description || '-')}</td>
            <td>${escapeHtml(order.ordered_by)}</td>
            <td>${formatDateTimeDisplay(order.ordered_date)}</td>
            <td>${trackingCell}</td>
            <td>${statusCell}</td>
            <td>${scanCell}</td>
            <td>
                <div class="action-buttons">${actionCellHtml}</div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// Update Stats counters on top
function updateStats() {
    let activeCount = 0;
    let receivedTodayCount = 0;
    const uniqueCarriers = new Set();
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    orders.forEach(order => {
        if (order.status === 'Ordered' || order.status === 'In Transit') {
            activeCount++;
        }
        
        if (order.status === 'Received' && order.received_date && order.received_date.split('T')[0] === todayStr) {
            receivedTodayCount++;
        }
        
        if (order.carrier && order.tracking_number && order.status !== 'Received') {
            uniqueCarriers.add(order.carrier);
        }
    });
    
    const activeEl = document.getElementById('statActive');
    const receivedEl = document.getElementById('statReceivedToday');
    const carriersEl = document.getElementById('statCarriers');
    
    animateValue(activeEl, lastActiveCount, activeCount, 800);
    animateValue(receivedEl, lastReceivedCount, receivedTodayCount, 800);
    animateValue(carriersEl, lastCarriersCount, uniqueCarriers.size, 800);
    
    lastActiveCount = activeCount;
    lastReceivedCount = receivedTodayCount;
    lastCarriersCount = uniqueCarriers.size;
    
    // If the analytics tab is active, trigger renderAnalytics() to sync metrics
    const analyticsSection = document.getElementById('analyticsSection');
    if (analyticsSection && !analyticsSection.classList.contains('hidden')) {
        renderAnalytics();
    }
}

// Animate numeric statistics counters helper
function animateValue(obj, start, end, duration) {
    if (start === end) {
        obj.textContent = end;
        return;
    }
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.textContent = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.textContent = end;
        }
    };
    window.requestAnimationFrame(step);
}

// Event Listeners setup
function setupEventListeners() {
    // Admin folder connection button click
    document.getElementById('btnAdminConnectFolder').addEventListener('click', adminSelectFolder);
    
    // New Order Modal
    document.getElementById('btnNewOrder').addEventListener('click', () => {
        openOrderModal();
    });
    
    // Manual sync button
    document.getElementById('btnRefresh').addEventListener('click', syncDatabase);
    
    // Search & Filter changes
    document.getElementById('searchInput').addEventListener('input', renderDashboard);
    document.getElementById('filterStatus').addEventListener('change', renderDashboard);
    document.getElementById('filterCarrier').addEventListener('change', renderDashboard);
    
    // Order form submit
    document.getElementById('orderForm').addEventListener('submit', handleOrderSubmit);
    
    // Receive form submit
    document.getElementById('receiveForm').addEventListener('submit', handleReceiveSubmit);
    
    // Email button in receive modal click
    document.getElementById('btnEmailReceive').addEventListener('click', handleEmailReceiveClick);
    
    // Damage Checkbox Listener
    document.getElementById('receiveIssueCheck').addEventListener('change', (e) => {
        toggleCarrierInstructions(e.target.checked);
        const osdGroup = document.getElementById('osdPhotosGroup');
        if (osdGroup) {
            if (e.target.checked) {
                osdGroup.classList.remove('hidden');
            } else {
                osdGroup.classList.add('hidden');
                selectedOsdFiles = [];
                resetOsdDragAndDropVisuals();
            }
        }
    });
    
    // Setup Modal Close Buttons
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    // Setup Annotation Modal Close Buttons
    document.querySelectorAll('.annotation-close-btn').forEach(btn => {
        btn.addEventListener('click', closeAnnotationModalOnly);
    });
    
    // Admin gear button click
    document.getElementById('btnAdmin').addEventListener('click', openAdminAuthModal);
    
    // Admin Auth form submit
    document.getElementById('adminAuthForm').addEventListener('submit', handleAdminAuthSubmit);
    
    // Admin Settings form submit
    document.getElementById('adminSettingsForm').addEventListener('submit', handleAdminSettingsSubmit);
    
    // Admin Settings Carrier Select listener
    document.getElementById('adminCarrierSelect').addEventListener('change', (e) => {
        saveAdminCarrierFields(currentAdminSelectedCarrier);
        currentAdminSelectedCarrier = e.target.value;
        loadAdminCarrierFields(currentAdminSelectedCarrier);
    });
    
    setupUploads();
    
    // Gallery controls
    document.getElementById('btnGalleryPrev').addEventListener('click', galleryPrev);
    document.getElementById('btnGalleryNext').addEventListener('click', galleryNext);
    document.getElementById('btnFloatPrev').addEventListener('click', galleryPrev);
    document.getElementById('btnFloatNext').addEventListener('click', galleryNext);
    document.getElementById('btnGalleryZoomIn').addEventListener('click', galleryZoomIn);
    document.getElementById('btnGalleryZoomOut').addEventListener('click', galleryZoomOut);
    document.getElementById('btnGalleryReset').addEventListener('click', galleryReset);
    document.getElementById('btnGalleryRotateCCW').addEventListener('click', galleryRotateCCW);
    document.getElementById('btnGalleryRotateCW').addEventListener('click', galleryRotateCW);
    document.getElementById('btnGalleryFullscreen').addEventListener('click', galleryFullscreen);
    window.addEventListener('keydown', handleGalleryKeydown);
    
    // Table Header Click Listeners for Sorting
    const headers = document.querySelectorAll('.orders-table th.sortable');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const sortCol = header.getAttribute('data-sort');
            if (currentSortColumn === sortCol) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = sortCol;
                currentSortDirection = 'asc';
            }
            
            headers.forEach(h => {
                h.classList.remove('asc', 'desc');
            });
            header.classList.add(currentSortDirection);
            
            renderDashboard();
        });
    });

    // --- ADMIN ACCORDION CLICK LISTENERS ---
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', (e) => {
            e.preventDefault();
            const item = header.closest('.accordion-item');
            const isActive = item.classList.contains('active');
            
            // Close all other accordion items
            document.querySelectorAll('.accordion-item').forEach(i => {
                i.classList.remove('active');
            });
            
            if (!isActive) {
                item.classList.add('active');
                
                // Trigger dynamic renders if needed
                if (item.id === 'accordionItemAnalytics') {
                    renderAnalytics();
                } else if (item.id === 'accordionItemManageShipments') {
                    renderAdminShipmentsList();
                }
            }
        });
    });

    // --- ADMIN SHIPMENTS SEARCH EVENT LISTENER ---
    document.getElementById('adminShipmentSearch')?.addEventListener('input', renderAdminShipmentsList);

    // --- CANVAS ANNOTATION TOOLBAR LISTENERS ---
    document.getElementById('btnToolPencil')?.addEventListener('click', () => setTool('pencil'));
    document.getElementById('btnToolArrow')?.addEventListener('click', () => setTool('arrow'));
    document.getElementById('btnToolRect')?.addEventListener('click', () => setTool('rect'));
    document.getElementById('btnToolText')?.addEventListener('click', () => setTool('text'));

    document.getElementById('btnColorRed')?.addEventListener('click', () => setColor('red'));
    document.getElementById('btnColorYellow')?.addEventListener('click', () => setColor('yellow'));
    document.getElementById('btnColorBlue')?.addEventListener('click', () => setColor('blue'));

    document.getElementById('btnSizeThin')?.addEventListener('click', () => setSize('thin'));
    document.getElementById('btnSizeMedium')?.addEventListener('click', () => setSize('medium'));
    document.getElementById('btnSizeThick')?.addEventListener('click', () => setSize('thick'));

    document.getElementById('btnAnnotationUndo')?.addEventListener('click', handleUndo);
    document.getElementById('btnAnnotationClear')?.addEventListener('click', handleClear);
    document.getElementById('btnSaveAnnotation')?.addEventListener('click', handleSaveAnnotation);

    setupCanvasDrawing();
}

// Admin connects Supabase
async function adminSelectFolder() {
    try {
        await connectSupabase();
        alert('Connected successfully to Supabase.');
    } catch (err) {
        console.error('Error connecting Supabase:', err);
        alert('Failed to connect Supabase. Check app.js configuration and Supabase permissions.');
    }
}

// Modal open/close actions
function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.add('hidden');
    });
    
    // Revoke any active Object URLs to prevent memory leaks
    if (activeObjectURL) {
        URL.revokeObjectURL(activeObjectURL);
        activeObjectURL = null;
    }
    
    // Revoke annotation background image URL
    const bgImg = document.getElementById('annotationBgImage');
    if (bgImg && bgImg.src && bgImg.src.startsWith('blob:')) {
        URL.revokeObjectURL(bgImg.src);
        bgImg.src = '';
    }
    
    // Clear thumbnails and revoke object URLs
    clearOsdThumbnails();
    
    // Clear the gallery media wrapper
    const wrapper = document.getElementById('galleryMediaWrapper');
    if (wrapper) {
        wrapper.innerHTML = '';
    }
    
    // Clear thumbnails
    const thumbs = document.getElementById('galleryThumbnails');
    if (thumbs) {
        thumbs.innerHTML = '';
    }
    
    // Reset state
    currentGalleryFiles = [];
    currentGalleryIndex = 0;
    currentGalleryOrder = null;
    
    // Reset body style from PDF mode
    const content = document.querySelector('.gallery-modal-content');
    if (content) {
        content.classList.remove('pdf-active');
    }
}

function openOrderModal(orderToEdit = null) {
    closeAllModals();
    const form = document.getElementById('orderForm');
    form.reset();
    
    selectedPackingSlipFile = null;
    resetPackingSlipVisuals();
    
    const title = document.getElementById('modalOrderTitle');
    const hiddenId = document.getElementById('orderId');
    const dateInput = document.getElementById('formOrderedDate');
    
    // Set default date to today (date and time)
    dateInput.value = getLocalDateTimeString();
    
    if (orderToEdit) {
        title.textContent = 'Edit Shipment Details';
        hiddenId.value = orderToEdit.id;
        
        document.getElementById('formPO').value = orderToEdit.po_number;
        document.getElementById('formSupplier').value = orderToEdit.supplier;
        document.getElementById('formDescription').value = orderToEdit.item_description || '';
        document.getElementById('formOrderedBy').value = orderToEdit.ordered_by;
        document.getElementById('formOrderedDate').value = orderToEdit.ordered_date;
        document.getElementById('formCarrier').value = orderToEdit.carrier || '';
        document.getElementById('formTracking').value = orderToEdit.tracking_number || '';
        document.getElementById('formStatus').value = orderToEdit.status;
        document.getElementById('formNotes').value = orderToEdit.notes || '';
        document.getElementById('formClassification').value = orderToEdit.classification || '';
        
        const selectStatus = document.getElementById('orderFileSelectionStatus');
        const dropZone = document.getElementById('orderDropZone');
        const textEl = document.getElementById('orderSelectedFileName');
        if (orderToEdit.packing_slip_filename) {
            textEl.textContent = `Attached: ${orderToEdit.packing_slip_filename}`;
            dropZone.classList.add('hidden');
            selectStatus.classList.remove('hidden');
        } else {
            dropZone.classList.remove('hidden');
            selectStatus.classList.add('hidden');
        }
    } else {
        title.textContent = 'Create New Shipment';
        hiddenId.value = '';
        document.getElementById('formCarrier').value = '';
    }
    
    document.getElementById('modalOrder').classList.remove('hidden');
}

function resetPackingSlipVisuals() {
    const dropZone = document.getElementById('orderDropZone');
    const statusEl = document.getElementById('orderFileSelectionStatus');
    const textEl = document.getElementById('orderSelectedFileName');
    if (dropZone && statusEl) {
        dropZone.classList.remove('hidden');
        statusEl.classList.add('hidden');
        textEl.textContent = 'No file selected';
    }
}

// Open modal to mark order as received
function openReceiveModal(orderId) {
    closeAllModals();
    const order = orders.find(o => o.id == orderId);
    if (!order) return;
    
    const form = document.getElementById('receiveForm');
    form.reset();
    selectedPodFiles = [];
    selectedOsdFiles = [];
    
    // Update file select visual state
    resetPodVisuals();
    resetOsdDragAndDropVisuals();
    
    const osdGroup = document.getElementById('osdPhotosGroup');
    if (osdGroup) osdGroup.classList.add('hidden');
    
    document.getElementById('receiveId').value = order.id;
    document.getElementById('receivePO').value = order.po_number;
    document.getElementById('receiveSupplier').value = order.supplier;
    
    // Reset Checkbox & instructions box
    document.getElementById('receiveIssueCheck').checked = false;
    document.getElementById('carrierInstructionsBox').classList.add('hidden');
    
    // Set default employee to "Maksym" if available
    const receiveBySelect = document.getElementById('receiveBy');
    if (receiveBySelect) {
        const optionExists = Array.from(receiveBySelect.options).some(opt => opt.value === 'Maksym');
        if (optionExists) {
            receiveBySelect.value = 'Maksym';
        }
    }
    
    // Set default receive date to today (date and time)
    document.getElementById('receiveDate').value = getLocalDateTimeString();
    
    document.getElementById('modalReceive').classList.remove('hidden');
}

function resetPodVisuals() {
    const dropZone = document.getElementById('dropZone');
    const statusEl = document.getElementById('fileSelectionStatus');
    const textEl = document.getElementById('selectedFileName');
    if (dropZone && statusEl) {
        dropZone.classList.remove('hidden');
        statusEl.classList.add('hidden');
        textEl.textContent = 'No file selected';
    }
}

function resetOsdDragAndDropVisuals() {
    const dropZone = document.getElementById('osdDropZone');
    const statusEl = document.getElementById('osdFileSelectionStatus');
    const textEl = document.getElementById('osdSelectedFilesName');
    if (dropZone && statusEl) {
        dropZone.classList.remove('hidden');
        statusEl.classList.add('hidden');
        textEl.textContent = 'No files selected';
    }
    clearOsdThumbnails();
}

// Open modal to edit existing order
function openEditModal(orderId) {
    const order = orders.find(o => o.id == orderId);
    if (order) {
        openOrderModal(order);
    }
}

// Delete Order from drive
async function deleteOrder(orderId) {
    const order = orders.find(o => o.id == orderId);
    if (!order) return;
    
    if (order.status === 'Received') {
        alert('Error: Received orders cannot be deleted by regular users.');
        return;
    }
    
    if (confirm(`Are you sure you want to delete PO Number: ${order.po_number}?`)) {
        try {
            await deleteOrderRecord(orderId);
            await syncDatabase();
        } catch (err) {
            console.error('Error deleting order:', err);
            alert('Failed to delete order. Check Supabase permissions.');
        }
    }
}

// Submit Order Form
async function handleOrderSubmit(e) {
    e.preventDefault();
    if (!supabaseClient) return;
    
    const id = document.getElementById('orderId').value || Date.now();
    const po = document.getElementById('formPO').value.trim();
    const supplier = document.getElementById('formSupplier').value.trim();
    const desc = document.getElementById('formDescription').value.trim();
    const orderedBy = document.getElementById('formOrderedBy').value.trim();
    const orderedDate = document.getElementById('formOrderedDate').value;
    const carrier = document.getElementById('formCarrier').value;
    const tracking = document.getElementById('formTracking').value.trim();
    const status = document.getElementById('formStatus').value;
    const notes = document.getElementById('formNotes').value.trim();
    const classification = document.getElementById('formClassification').value;
    
    // Check if PO exists in database (only for new orders)
    if (!document.getElementById('orderId').value) {
        const isDuplicate = orders.some(o => o.po_number.toLowerCase() === po.toLowerCase());
        if (isDuplicate) {
            if (!confirm(`Warning: An order with PO Number "${po}" already exists. Do you want to create a duplicate?`)) {
                return;
            }
        }
    }
    
    // Build order object
    let order = orders.find(o => o.id == id) || {
        id: Number(id),
        received_date: null,
        received_by: null,
        invoice_filename: null,
        packing_slip_filename: null,
        osd_photos: []
    };
    
    order.po_number = po;
    order.supplier = supplier;
    order.item_description = desc;
    order.ordered_by = orderedBy;
    order.ordered_date = orderedDate;
    order.carrier = carrier;
    order.tracking_number = tracking;
    order.status = status;
    order.notes = notes;
    order.classification = classification;
    
    let packingSlipFilename = order.packing_slip_filename;
    if (selectedPackingSlipFile === 'deleted') {
        packingSlipFilename = null;
    } else if (selectedPackingSlipFile) {
        try {
            const ext = selectedPackingSlipFile.name.split('.').pop();
            const poSafe = po.replace(/[^a-zA-Z0-9_-]/g, '_');
            packingSlipFilename = `slip_${poSafe}_${Date.now()}.${ext}`;
            
            await uploadStorageFile('scans', packingSlipFilename, selectedPackingSlipFile);
        } catch (err) {
            console.error('Error saving packing slip file:', err);
            alert('Failed to upload packing slip file. Order will not be saved.');
            return;
        }
    }
    order.packing_slip_filename = packingSlipFilename;
    
    // Clean up received info if user switched status back to ordered
    if (status !== 'Received') {
        order.received_date = null;
        order.received_by = null;
        order.invoice_filename = null;
        order.osd_photos = [];
    }
    
    try {
        await saveOrderRecord(order);
        
        closeAllModals();
        await syncDatabase();
    } catch (err) {
        console.error('Error saving order:', err);
        alert('Failed to save order. Please check Supabase permissions.');
    }
}

// Submit Receive Form
async function handleReceiveSubmit(e) {
    e.preventDefault();
    if (!supabaseClient) return;
    
    const id = document.getElementById('receiveId').value;
    const order = orders.find(o => o.id == id);
    if (!order) return;
    
    const receivedBy = document.getElementById('receiveBy').value.trim();
    const receivedDate = document.getElementById('receiveDate').value;
    const notes = document.getElementById('receiveNotes').value.trim();
    const hasIssue = document.getElementById('receiveIssueCheck').checked;
    
    let invoiceFilenames = order.invoice_filenames || (order.invoice_filename ? [order.invoice_filename] : []);
    
    // Upload POD files if selected
    if (selectedPodFiles === 'deleted') {
        invoiceFilenames = [];
    } else if (Array.isArray(selectedPodFiles) && selectedPodFiles.length > 0) {
        try {
            const uploadedPods = [];
            const poSafe = order.po_number.replace(/[^a-zA-Z0-9_-]/g, '_');
            for (let i = 0; i < selectedPodFiles.length; i++) {
                const file = selectedPodFiles[i];
                const ext = file.name.split('.').pop();
                const fn = `pod_${poSafe}_${Date.now()}_${i}.${ext}`;
                
                await uploadStorageFile('scans', fn, file);
                uploadedPods.push(fn);
            }
            invoiceFilenames = [...invoiceFilenames, ...uploadedPods];
        } catch (err) {
            console.error('Error saving POD files:', err);
            alert('Failed to upload POD files. Order will not be updated.');
            return;
        }
    }
    
    // Handle OSD Photos
    let osdPhotos = order.osd_photos || [];
    if (!hasIssue) {
        osdPhotos = [];
    } else if (selectedOsdFiles === 'deleted') {
        osdPhotos = [];
    } else if (selectedOsdFiles.length > 0) {
        try {
            const uploadedPhotos = [];
            for (const file of selectedOsdFiles) {
                const ext = file.name.split('.').pop();
                const poSafe = order.po_number.replace(/[^a-zA-Z0-9_-]/g, '_');
                const photoFilename = `osd_${poSafe}_${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
                
                await uploadStorageFile('osd', photoFilename, file);
                uploadedPhotos.push(photoFilename);
            }
            osdPhotos = [...osdPhotos, ...uploadedPhotos];
        } catch (err) {
            console.error('Error saving OSD photo files:', err);
            alert('Failed to upload damage photos. Order will not be updated.');
            return;
        }
    }
    
    // Update order object
    order.status = 'Received';
    order.received_by = receivedBy;
    order.received_date = receivedDate;
    order.invoice_filenames = invoiceFilenames;
    order.invoice_filename = invoiceFilenames.length > 0 ? invoiceFilenames[0] : null;
    order.notes = notes;
    order.has_issue = hasIssue;
    order.osd_photos = osdPhotos;
    
    try {
        await saveOrderRecord(order);
        
        closeAllModals();
        await syncDatabase();
    } catch (err) {
        console.error('Error receiving order:', err);
        alert('Failed to update order status.');
    }
}

// Handle Email button click in Receive Modal (only opens Outlook, does not save)
function handleEmailReceiveClick() {
    const form = document.getElementById('receiveForm');
    if (!form.reportValidity()) return;
    
    const id = document.getElementById('receiveId').value;
    const order = orders.find(o => o.id == id);
    if (!order) return;
    
    const tempOrder = {
        ...order,
        received_by: document.getElementById('receiveBy').value.trim(),
        received_date: document.getElementById('receiveDate').value,
        notes: document.getElementById('receiveNotes').value.trim(),
        has_issue: document.getElementById('receiveIssueCheck').checked
    };
    
    sendOutlookNotification(tempOrder);
}

// View Scan / File Attachments Modals
// View Scan / File Attachments Modals
async function viewFileAttachment(orderId, type) {
    const order = orders.find(o => o.id == orderId);
    if (!order) return;
    
    currentGalleryOrder = order;
    await buildGallery(order);
    
    // Find the index of the file we clicked
    let startIndex = 0;
    if (type === 'packing_slip') {
        startIndex = currentGalleryFiles.findIndex(f => f.type === 'packing_slip');
    } else if (type === 'pod') {
        startIndex = currentGalleryFiles.findIndex(f => f.type === 'pod');
    }
    
    if (startIndex === -1) startIndex = 0;
    openGalleryModal(startIndex);
}

async function viewOsdPhotos(orderId, startFilename = null) {
    const order = orders.find(o => o.id == orderId);
    if (!order) return;
    
    currentGalleryOrder = order;
    await buildGallery(order);
    
    let startIndex = 0;
    if (startFilename) {
        startIndex = currentGalleryFiles.findIndex(f => f.filename === startFilename);
    } else {
        startIndex = currentGalleryFiles.findIndex(f => f.type === 'osd');
    }
    
    if (startIndex === -1) startIndex = 0;
    openGalleryModal(startIndex);
}

// Build unified list of attachments for the active order
async function buildGallery(order) {
    currentGalleryFiles = [];
    
    // Add Packing Slip
    if (order.packing_slip_filename) {
        currentGalleryFiles.push({
            type: 'packing_slip',
            filename: order.packing_slip_filename,
            storageFolder: 'scans',
            title: 'Packing Slip'
        });
    }
    
    // Add POD
    const podFiles = order.invoice_filenames || (order.invoice_filename ? [order.invoice_filename] : []);
    podFiles.forEach((fn, idx) => {
        currentGalleryFiles.push({
            type: 'pod',
            filename: fn,
            storageFolder: 'scans',
            title: `Proof of Delivery (POD) ${idx + 1} of ${podFiles.length}`
        });
    });
    
    // Add OSD Damage Photos
    if (order.osd_photos && order.osd_photos.length > 0) {
        order.osd_photos.forEach((fn, idx) => {
            currentGalleryFiles.push({
                type: 'osd',
                filename: fn,
                storageFolder: 'osd',
                title: `OSD Photo ${idx + 1} of ${order.osd_photos.length}`
            });
        });
    }
}

// Launch the gallery modal and load specific file index
function openGalleryModal(index) {
    document.getElementById('modalViewScan').classList.remove('hidden');
    loadGalleryFile(index);
}

// Load and display a gallery file by index
async function loadGalleryFile(index) {
    if (index < 0 || index >= currentGalleryFiles.length) return;
    
    currentGalleryIndex = index;
    
    // Clean up previous blob URL
    if (activeObjectURL) {
        URL.revokeObjectURL(activeObjectURL);
        activeObjectURL = null;
    }
    
    const fileObj = currentGalleryFiles[index];
    const poNumber = currentGalleryOrder ? currentGalleryOrder.po_number : '-';
    
    // Update header title
    document.getElementById('viewScanTitle').textContent = `PO: ${poNumber} - ${fileObj.title}`;
    
    // Update toolbar index label
    document.getElementById('galleryIndexLabel').textContent = `${index + 1} of ${currentGalleryFiles.length}`;
    
    // Update prev/next button states
    const prevBtn = document.getElementById('btnGalleryPrev');
    const nextBtn = document.getElementById('btnGalleryNext');
    const floatPrev = document.getElementById('btnFloatPrev');
    const floatNext = document.getElementById('btnFloatNext');
    
    if (currentGalleryFiles.length <= 1) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        floatPrev.style.display = 'none';
        floatNext.style.display = 'none';
    } else {
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === currentGalleryFiles.length - 1;
        floatPrev.style.display = index === 0 ? 'none' : 'flex';
        floatNext.style.display = index === currentGalleryFiles.length - 1 ? 'none' : 'flex';
    }
    
    const wrapper = document.getElementById('galleryMediaWrapper');
    wrapper.innerHTML = '<div style="color: white; font-family: var(--font-body); font-size: 0.9rem; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading file...</div>';
    
    try {
        const fileUrl = await getStorageFileUrl(fileObj.storageFolder, fileObj.filename);
        activeObjectURL = fileUrl;
        
        wrapper.innerHTML = '';
        
        const isPdf = fileObj.filename.toLowerCase().endsWith('.pdf');
        const modalContent = document.querySelector('.gallery-modal-content');
        
        if (isPdf) {
            modalContent.classList.add('pdf-active');
            
            const iframe = document.createElement('iframe');
            iframe.src = fileUrl;
            wrapper.appendChild(iframe);
            
            // Reset state
            zoomScale = 1.0;
            rotateAngle = 0;
            panOffset = { x: 0, y: 0 };
        } else {
            modalContent.classList.remove('pdf-active');
            
            const img = document.createElement('img');
            img.src = fileUrl;
            img.id = 'galleryImage';
            
            // Reset transformation state
            zoomScale = 1.0;
            rotateAngle = 0;
            panOffset = { x: 0, y: 0 };
            
            img.style.setProperty('--zoom-scale', '1');
            img.style.setProperty('--rotate-angle', '0deg');
            img.style.setProperty('--pan-x', '0px');
            img.style.setProperty('--pan-y', '0px');
            
            wrapper.appendChild(img);
            document.getElementById('galleryZoomLabel').textContent = '100%';
            
            setupImageDragPan(img);
            setupImageScrollZoom(img);
        }
        
        // Setup download button
        const dlBtn = document.getElementById('btnDownloadInvoice');
        dlBtn.href = fileUrl;
        dlBtn.download = fileObj.filename;
        
    } catch (err) {
        console.error('Error loading gallery file:', err);
        wrapper.innerHTML = `<div style="color: var(--status-error); padding: 2rem; text-align: center;"><i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem;"></i><p>File not found or access denied.</p></div>`;
    }
    
    // Render thumbnails
    await renderGalleryThumbnails();
}

// Render thumbnails at the bottom
async function renderGalleryThumbnails() {
    const thumbsContainer = document.getElementById('galleryThumbnails');
    thumbsContainer.innerHTML = '';
    
    for (let i = 0; i < currentGalleryFiles.length; i++) {
        const fileObj = currentGalleryFiles[i];
        const thumbItem = document.createElement('div');
        thumbItem.className = `gallery-thumb-item ${i === currentGalleryIndex ? 'active' : ''}`;
        
        const isPdf = fileObj.filename.toLowerCase().endsWith('.pdf');
        
        if (isPdf) {
            thumbItem.innerHTML = `<i class="fa-regular fa-file-pdf thumb-icon-fallback"></i>`;
        } else {
            try {
                const fileUrl = await getStorageFileUrl(fileObj.storageFolder, fileObj.filename);
                
                const img = document.createElement('img');
                img.src = fileUrl;
                thumbItem.appendChild(img);
            } catch (e) {
                thumbItem.innerHTML = `<i class="fa-regular fa-file-image thumb-icon-fallback"></i>`;
            }
        }
        
        thumbItem.onclick = () => {
            loadGalleryFile(i);
        };
        
        thumbsContainer.appendChild(thumbItem);
    }
}

// Image drag-to-pan logic
function setupImageDragPan(img) {
    img.addEventListener('mousedown', (e) => {
        if (zoomScale <= 1.0) return; // Only pan when zoomed in
        isPanning = true;
        img.classList.add('dragging');
        panStart.x = e.clientX - panOffset.x;
        panStart.y = e.clientY - panOffset.y;
        e.preventDefault();
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        panOffset.x = e.clientX - panStart.x;
        panOffset.y = e.clientY - panStart.y;
        img.style.setProperty('--pan-x', `${panOffset.x}px`);
        img.style.setProperty('--pan-y', `${panOffset.y}px`);
    });
    
    window.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            img.classList.remove('dragging');
        }
    });

    // Touch support for tablets/mobiles
    img.addEventListener('touchstart', (e) => {
        if (zoomScale <= 1.0 || e.touches.length !== 1) return;
        isPanning = true;
        img.classList.add('dragging');
        panStart.x = e.touches[0].clientX - panOffset.x;
        panStart.y = e.touches[0].clientY - panOffset.y;
    });

    img.addEventListener('touchmove', (e) => {
        if (!isPanning || e.touches.length !== 1) return;
        panOffset.x = e.touches[0].clientX - panStart.x;
        panOffset.y = e.touches[0].clientY - panStart.y;
        img.style.setProperty('--pan-x', `${panOffset.x}px`);
        img.style.setProperty('--pan-y', `${panOffset.y}px`);
    });

    img.addEventListener('touchend', () => {
        if (isPanning) {
            isPanning = false;
            img.classList.remove('dragging');
        }
    });
}

// Mouse scroll zoom support
function setupImageScrollZoom(img) {
    img.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            // Zoom In
            zoomScale = Math.min(3.0, zoomScale + 0.1);
        } else {
            // Zoom Out
            zoomScale = Math.max(0.5, zoomScale - 0.1);
            if (zoomScale <= 1.0) {
                panOffset = { x: 0, y: 0 };
                img.style.setProperty('--pan-x', '0px');
                img.style.setProperty('--pan-y', '0px');
            }
        }
        img.style.setProperty('--zoom-scale', zoomScale);
        document.getElementById('galleryZoomLabel').textContent = `${Math.round(zoomScale * 100)}%`;
    }, { passive: false });
}

// Navigation logic
function galleryPrev() {
    if (currentGalleryIndex > 0) {
        loadGalleryFile(currentGalleryIndex - 1);
    }
}

// Next
function galleryNext() {
    if (currentGalleryIndex < currentGalleryFiles.length - 1) {
        loadGalleryFile(currentGalleryIndex + 1);
    }
}

// Zoom logic
function galleryZoomIn() {
    const img = document.getElementById('galleryImage');
    if (!img) return;
    zoomScale = Math.min(3.0, zoomScale + 0.25);
    img.style.setProperty('--zoom-scale', zoomScale);
    document.getElementById('galleryZoomLabel').textContent = `${Math.round(zoomScale * 100)}%`;
}

function galleryZoomOut() {
    const img = document.getElementById('galleryImage');
    if (!img) return;
    zoomScale = Math.max(0.5, zoomScale - 0.25);
    if (zoomScale <= 1.0) {
        panOffset = { x: 0, y: 0 };
        img.style.setProperty('--pan-x', '0px');
        img.style.setProperty('--pan-y', '0px');
    }
    img.style.setProperty('--zoom-scale', zoomScale);
    document.getElementById('galleryZoomLabel').textContent = `${Math.round(zoomScale * 100)}%`;
}

// Reset view
function galleryReset() {
    const img = document.getElementById('galleryImage');
    if (!img) return;
    zoomScale = 1.0;
    rotateAngle = 0;
    panOffset = { x: 0, y: 0 };
    img.style.setProperty('--zoom-scale', '1');
    img.style.setProperty('--rotate-angle', '0deg');
    img.style.setProperty('--pan-x', '0px');
    img.style.setProperty('--pan-y', '0px');
    document.getElementById('galleryZoomLabel').textContent = '100%';
}

// Rotation logic
function galleryRotateCW() {
    const img = document.getElementById('galleryImage');
    if (!img) return;
    rotateAngle = (rotateAngle + 90) % 360;
    img.style.setProperty('--rotate-angle', `${rotateAngle}deg`);
}

function galleryRotateCCW() {
    const img = document.getElementById('galleryImage');
    if (!img) return;
    rotateAngle = (rotateAngle - 90) % 360;
    img.style.setProperty('--rotate-angle', `${rotateAngle}deg`);
}

// Fullscreen logic
function galleryFullscreen() {
    const viewport = document.getElementById('galleryViewport');
    if (!viewport) return;
    
    if (!document.fullscreenElement) {
        viewport.requestFullscreen().catch(err => {
            console.error('Error enabling fullscreen:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// Keyboard shortcuts handler
function handleGalleryKeydown(e) {
    const modal = document.getElementById('modalViewScan');
    if (modal.classList.contains('hidden')) return;
    
    if (e.key === 'ArrowLeft') {
        galleryPrev();
    } else if (e.key === 'ArrowRight') {
        galleryNext();
    } else if (e.key === 'Escape') {
        closeAllModals();
    } else if (e.key === '+' || e.key === '=') {
        galleryZoomIn();
    } else if (e.key === '-') {
        galleryZoomOut();
    }
}

// View Detailed Order Information Modal
function viewOrderDetails(orderId) {
    const order = orders.find(o => o.id == orderId);
    if (!order) return;
    
    document.getElementById('viewOrderPOTitle').textContent = order.po_number;
    const content = document.getElementById('orderDetailsContent');
    
    // Attachments download/preview buttons
    let attachmentsHtml = '';
    if (order.packing_slip_filename) {
        attachmentsHtml += `<button class="btn btn-secondary" onclick="closeAllModals(); viewFileAttachment('${order.id}', 'packing_slip');" style="margin-right: 0.5rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-file-invoice"></i> Packing Slip</button>`;
    }
    const podFiles = order.invoice_filenames || (order.invoice_filename ? [order.invoice_filename] : []);
    if (podFiles.length > 0) {
        attachmentsHtml += `<button class="btn btn-secondary" onclick="closeAllModals(); viewFileAttachment('${order.id}', 'pod');" style="margin-right: 0.5rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-file-signature"></i> POD (${podFiles.length})</button>`;
    }
    if (order.osd_photos && order.osd_photos.length > 0) {
        attachmentsHtml += `<button class="btn btn-accent" onclick="closeAllModals(); viewOsdPhotos('${order.id}');" style="margin-right: 0.5rem; margin-bottom: 0.5rem; background: var(--status-error); border-color: var(--status-error);"><i class="fa-solid fa-camera"></i> Damage Photos (${order.osd_photos.length})</button>`;
    }
    if (!attachmentsHtml) {
        attachmentsHtml = '<span class="text-muted">None</span>';
    }
    
    let statusBadge = `<span class="badge ${order.status.toLowerCase().replace(' ', '-')}"><span class="badge-dot"></span>${order.status}</span>`;
    if (order.has_issue) {
        statusBadge += ` <span class="badge-issue"><i class="fa-solid fa-triangle-exclamation"></i> OSD Reported</span>`;
    }
    
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; font-size: 0.95rem; line-height: 1.5;">
            <div>
                <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">Shipment Info</h4>
                <p><strong>PO Number:</strong> ${escapeHtml(order.po_number)}</p>
                <p><strong>Classification:</strong> ${order.classification ? `<span class="class-badge class-${order.classification.toLowerCase()}" style="margin-top: 0; vertical-align: middle;">${escapeHtml(order.classification)}</span>` : '-'}</p>
                <p><strong>Supplier:</strong> ${escapeHtml(order.supplier)}</p>
                <p><strong>Status:</strong> ${statusBadge}</p>
                <p><strong>Carrier:</strong> ${escapeHtml(order.carrier || '-')}</p>
                <p><strong>Tracking Number:</strong> ${order.tracking_number ? `<span style="font-family: monospace;">${escapeHtml(order.tracking_number)}</span>` : '-'}</p>
            </div>
            
            <div>
                <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">Logistics Log</h4>
                <p><strong>Ordered By:</strong> ${escapeHtml(order.ordered_by)}</p>
                <p><strong>Date Ordered:</strong> ${formatDateTimeDisplay(order.ordered_date)}</p>
                <p><strong>Received By:</strong> ${order.received_by ? escapeHtml(order.received_by) : '-'}</p>
                <p><strong>Date Received:</strong> ${order.received_date ? formatDateTimeDisplay(order.received_date) : '-'}</p>
            </div>
            
            <div style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red);">Description & Items</h4>
                <p style="white-space: pre-wrap; background: var(--bg-admin-box); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); margin: 0;">${escapeHtml(order.item_description || 'No description logged.')}</p>
            </div>
            
            <div style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red);">Receiving Notes / Damage details</h4>
                <p style="white-space: pre-wrap; background: var(--bg-admin-box); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); margin: 0;">${escapeHtml(order.notes || 'No receiving notes logged.')}</p>
            </div>
            
            <div style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red);">Attached Files</h4>
                <div style="margin-top: 0.5rem;">${attachmentsHtml}</div>
            </div>
        </div>
    `;
    
    // Setup Edit button click handler
    const editBtn = document.getElementById('btnEditFromDetails');
    editBtn.onclick = () => {
        closeAllModals();
        openEditModal(order.id);
    };
    
    document.getElementById('modalViewOrderDetails').classList.remove('hidden');
}

// Mailto URL Parser for Outlook
function sendOutlookNotification(order) {
    const recipients = settings.managerEmails || 'purchasing@maxshipping.com';
    
    // Parse subject
    let subject = settings.emailSubjectTemplate || '[RECEIVED] PO# {po_number} - {supplier}';
    if (order.has_issue) {
        // Automatically prefix subject if there's an issue
        subject = `⚠️ [DAMAGED/SHORTAGE] ` + subject.replace(/\[RECEIVED\]\s*/g, '');
    }
    subject = parseEmailTemplate(subject, order);
    
    // Parse body
    const bodyTemplate = settings.emailBodyTemplate || DEFAULT_SETTINGS.emailBodyTemplate;
    const emailBody = parseEmailTemplate(bodyTemplate, order);
    
    const mailtoUrl = `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    
    // Open system client
    window.location.href = mailtoUrl;
}

// Generate URL for tracking package
function getTrackingUrl(carrier, trackingNumber) {
    if (!trackingNumber) return null;
    const cleanNum = trackingNumber.trim();
    
    switch (carrier) {
        case 'UPS':
            return `https://www.ups.com/track?HTML&loc=en_US&tracknum=${cleanNum}`;
        case 'FedEx':
            return `https://www.fedex.com/apps/fedextrack/?tracknumbers=${cleanNum}`;
        case 'DHL':
            return `https://www.dhl.com/en/express/tracking.html?AWB=${cleanNum}`;
        case 'Canada Post':
            return `https://www.canadapost-postescanada.ca/track-repere/en#/details/${cleanNum}`;
        case 'Purolator':
            return `https://www.purolator.com/en/shipping/tracker?pins=${cleanNum}`;
        case 'Manitoulin':
            return `https://www.mtdirect.ca/MANITOULIN/pages/PROBILL?output=5&probill=${cleanNum}`;
        case 'Gardewine':
            return `https://www.gardewine.com/`;
        case 'DayRoss':
            return `https://dayross.com/`;
        case 'ABF':
            return `https://arcb.com/track`;
        case 'TST-express':
            return `https://www.tst-cfexpress.com`;
        default:
            return null;
    }
}

// Helper to escape HTML tags
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
}

// File Drag and Drop logic
function setupUploads() {
    // 1. New Order: Packing Slip
    setupSingleUpload(
        'orderDropZone',
        'orderPackingSlipUpload',
        'orderFileSelectionStatus',
        'orderSelectedFileName',
        'btnRemoveOrderFile',
        (file) => { selectedPackingSlipFile = file; }
    );
    
    // 2. Receive Modal: POD (Multiple)
    setupMultipleUpload(
        'dropZone',
        'invoiceUpload',
        'fileSelectionStatus',
        'selectedFileName',
        'btnRemoveFile',
        (files) => { selectedPodFiles = files; },
        false // isImageOnly = false
    );
    
    // 3. Receive Modal: OSD Photos (Multiple)
    setupMultipleUpload(
        'osdDropZone',
        'osdUpload',
        'osdFileSelectionStatus',
        'osdSelectedFilesName',
        'btnRemoveOsdFiles',
        (files) => { selectedOsdFiles = files; },
        true // isImageOnly = true
    );
}

function setupSingleUpload(zoneId, inputId, statusId, textId, clearId, setFileCallback) {
    const dropZone = document.getElementById(zoneId);
    const fileInput = document.getElementById(inputId);
    const statusEl = document.getElementById(statusId);
    const textEl = document.getElementById(textId);
    const clearBtn = document.getElementById(clearId);
    
    if (!dropZone || !fileInput) return;
    
    const dragEvents = ['dragenter', 'dragover'];
    dragEvents.forEach(eName => {
        dropZone.addEventListener(eName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
    });
    
    const leaveEvents = ['dragleave', 'drop'];
    leaveEvents.forEach(eName => {
        dropZone.addEventListener(eName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });
    });
    
    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleSingleFileSelection(files[0]);
        }
    });
    
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleSingleFileSelection(fileInput.files[0]);
        }
    });
    
    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setFileCallback('deleted');
        fileInput.value = '';
        dropZone.classList.remove('hidden');
        statusEl.classList.add('hidden');
        textEl.textContent = 'No file selected';
    });
    
    function handleSingleFileSelection(file) {
        const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            alert('Invalid file format. Please upload PDF, PNG or JPEG/JPG images.');
            return;
        }
        setFileCallback(file);
        
        const fileIcon = statusEl.querySelector('.file-icon');
        if (fileIcon) {
            if (file.type === 'application/pdf') {
                fileIcon.className = 'fa-regular fa-file-pdf file-icon';
            } else {
                fileIcon.className = 'fa-regular fa-file-image file-icon';
            }
        }
        
        textEl.textContent = `${file.name} (${formatBytes(file.size)})`;
        dropZone.classList.add('hidden');
        statusEl.classList.remove('hidden');
    }
}

function setupMultipleUpload(zoneId, inputId, statusId, textId, clearId, setFilesCallback, isImageOnly = false) {
    const dropZone = document.getElementById(zoneId);
    const fileInput = document.getElementById(inputId);
    const statusEl = document.getElementById(statusId);
    const textEl = document.getElementById(textId);
    const clearBtn = document.getElementById(clearId);
    
    if (!dropZone || !fileInput) return;
    
    const dragEvents = ['dragenter', 'dragover'];
    dragEvents.forEach(eName => {
        dropZone.addEventListener(eName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
    });
    
    const leaveEvents = ['dragleave', 'drop'];
    leaveEvents.forEach(eName => {
        dropZone.addEventListener(eName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });
    });
    
    dropZone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleMultipleFilesSelection(files);
        }
    });
    
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleMultipleFilesSelection(Array.from(fileInput.files));
        }
    });
    
    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setFilesCallback('deleted');
        fileInput.value = '';
        dropZone.classList.remove('hidden');
        statusEl.classList.add('hidden');
        textEl.textContent = 'No files selected';
        if (isImageOnly) {
            clearOsdThumbnails();
        }
    });
    
    function handleMultipleFilesSelection(files) {
        let validFiles = [];
        if (isImageOnly) {
            validFiles = files.filter(f => f.type.startsWith('image/'));
            if (validFiles.length === 0) {
                alert('Invalid files. Please upload images only for OSD Damage photos.');
                return;
            }
        } else {
            const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
            validFiles = files.filter(f => validTypes.includes(f.type));
            if (validFiles.length === 0) {
                alert('Invalid files. Please upload PDF, PNG or JPEG/JPG files.');
                return;
            }
        }
        setFilesCallback(validFiles);
        
        const suffix = isImageOnly ? ' image' : ' file';
        const fileNamesList = validFiles.map(f => f.name).join(', ');
        textEl.textContent = `${validFiles.length}${suffix}${validFiles.length > 1 ? 's' : ''} selected (${fileNamesList})`;
        dropZone.classList.add('hidden');
        statusEl.classList.remove('hidden');
        
        if (isImageOnly) {
            renderOsdThumbnails();
        }
    }
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

let currentAdminSelectedCarrierLocal = 'UPS';

function loadAdminCarrierFields(carrier) {
    const info = tempCarrierSupportInfo[carrier] || { title: '', phone: '', email: '', link: '', instructions: '' };
    document.getElementById('adminCarrierTitle').value = info.title || '';
    document.getElementById('adminCarrierPhone').value = info.phone || '';
    document.getElementById('adminCarrierEmail').value = info.email || '';
    document.getElementById('adminCarrierLink').value = info.link || '';
    document.getElementById('adminCarrierInstructions').value = info.instructions || '';
}

function saveAdminCarrierFields(carrier) {
    if (!tempCarrierSupportInfo[carrier]) {
        tempCarrierSupportInfo[carrier] = {};
    }
    tempCarrierSupportInfo[carrier].title = document.getElementById('adminCarrierTitle').value.trim();
    tempCarrierSupportInfo[carrier].phone = document.getElementById('adminCarrierPhone').value.trim();
    tempCarrierSupportInfo[carrier].email = document.getElementById('adminCarrierEmail').value.trim();
    tempCarrierSupportInfo[carrier].link = document.getElementById('adminCarrierLink').value.trim();
    tempCarrierSupportInfo[carrier].instructions = document.getElementById('adminCarrierInstructions').value.trim();
}

// Toggle carrier claims instructions visibility and content
function toggleCarrierInstructions(show) {
    const box = document.getElementById('carrierInstructionsBox');
    if (!show) {
        box.classList.add('hidden');
        return;
    }
    
    const id = document.getElementById('receiveId').value;
    const order = orders.find(o => o.id == id);
    const carrier = order ? (order.carrier || 'LTL / Other') : 'LTL / Other';
    const supportInfo = settings.carrierSupportInfo || DEFAULT_SETTINGS.carrierSupportInfo;
    const info = supportInfo[carrier] || supportInfo['LTL / Other'] || { title: carrier + ' Support', instructions: '' };
    
    document.getElementById('instructionsTitle').innerHTML = `⚠️ ${escapeHtml(info.title)}`;
    
    const list = document.getElementById('instructionsList');
    list.innerHTML = '';
    
    // Add carrier instructions
    if (info.instructions && info.instructions.trim()) {
        const descLi = document.createElement('li');
        descLi.innerHTML = `<strong>Note:</strong> ${escapeHtml(info.instructions)}`;
        list.appendChild(descLi);
    }
    
    // Add phone if exists
    if (info.phone && info.phone.trim()) {
        const phoneLi = document.createElement('li');
        phoneLi.innerHTML = `<i class="fa-solid fa-phone"></i> <strong>Phone:</strong> ${escapeHtml(info.phone)}`;
        list.appendChild(phoneLi);
    }
    
    // Add email if exists
    if (info.email && info.email.trim()) {
        const emailLi = document.createElement('li');
        emailLi.innerHTML = `<i class="fa-solid fa-envelope"></i> <strong>Email:</strong> <a href="mailto:${escapeHtml(info.email)}">${escapeHtml(info.email)}</a>`;
        list.appendChild(emailLi);
    }
    
    // Add link if exists
    if (info.link && info.link.trim()) {
        const linkLi = document.createElement('li');
        linkLi.innerHTML = `<i class="fa-solid fa-globe"></i> <strong>Claims Link:</strong> <a href="${escapeHtml(info.link)}" target="_blank">File Claim Online <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.7rem;"></i></a>`;
        list.appendChild(linkLi);
    }
    
    box.classList.remove('hidden');
}

// Populate Ordered By and Received By dropdown menus dynamically
function populateEmployeeDropdowns() {
    const orderedSelect = document.getElementById('formOrderedBy');
    const receivedSelect = document.getElementById('receiveBy');
    if (!orderedSelect || !receivedSelect) return;
    
    const orderedValue = orderedSelect.value;
    const receivedValue = receivedSelect.value;
    
    // Preserve placeholder
    const placeholder1 = orderedSelect.options[0];
    const placeholder2 = receivedSelect.options[0];
    
    orderedSelect.innerHTML = '';
    receivedSelect.innerHTML = '';
    
    orderedSelect.appendChild(placeholder1);
    receivedSelect.appendChild(placeholder2);
    
    const list = settings.employees || DEFAULT_SETTINGS.employees;
    list.forEach(emp => {
        const opt1 = document.createElement('option');
        opt1.value = emp;
        opt1.textContent = emp;
        orderedSelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = emp;
        opt2.textContent = emp;
        receivedSelect.appendChild(opt2);
    });
    
    if (orderedValue) orderedSelect.value = orderedValue;
    if (receivedValue) receivedSelect.value = receivedValue;
}

// Replaces placeholders inside email templates
function parseEmailTemplate(template, order) {
    const issueNotice = order.has_issue ? `*** WARNING: DAMAGES OR QUANTITY SHORTAGES REPORTED FOR THIS SHIPMENT ***\n\n` : '';
    const actionRequired = order.has_issue ? `⚠️ Action Required: Claims support instructions have been displayed at the warehouse terminal. Please review the scanned packing slip / invoice and file a claim with the carrier if necessary.\n\n` : '';
    
    return template
        .replace(/{po_number}/g, order.po_number || '')
        .replace(/{supplier}/g, order.supplier || '')
        .replace(/{item_description}/g, order.item_description || 'N/A')
        .replace(/{carrier}/g, order.carrier || 'N/A')
        .replace(/{tracking_number}/g, order.tracking_number || 'N/A')
        .replace(/{received_by}/g, order.received_by || '')
        .replace(/{received_date}/g, order.received_date || '')
        .replace(/{notes}/g, order.notes || 'Arrived complete and in good condition.')
        .replace(/{issue_notice}/g, issueNotice)
        .replace(/{action_required}/g, actionRequired);
}

// Admin Auth Modal Trigger
function openAdminAuthModal() {
    closeAllModals();
    document.getElementById('adminAuthForm').reset();
    document.getElementById('modalAdminAuth').classList.remove('hidden');
}

// Verify Admin Passcode and forward to settings
function handleAdminAuthSubmit(e) {
    e.preventDefault();
    const passInput = document.getElementById('adminPasswordInput').value;
    const correctPass = settings.adminPassword || 'admin';
    
    if (passInput === correctPass) {
        closeAllModals();
        openAdminSettingsModal();
    } else {
        alert('Incorrect admin passcode. Access denied.');
    }
}

// Open Admin settings modal and populate fields
function openAdminSettingsModal() {
    document.getElementById('adminSettingsForm').reset();
    
    document.getElementById('adminEmails').value = settings.managerEmails || '';
    document.getElementById('adminEmployees').value = (settings.employees || []).join('\n');
    document.getElementById('adminSubjectTemplate').value = settings.emailSubjectTemplate || '';
    document.getElementById('adminBodyTemplate').value = settings.emailBodyTemplate || '';
    document.getElementById('adminNewPassword').value = '';
    
    // Set Supabase status text
    const pathSpan = document.getElementById('adminFolderPath');
    if (supabaseClient && isSupabaseConfigured()) {
        pathSpan.textContent = `Connected: ${new URL(SUPABASE_URL).hostname}`;
    } else {
        pathSpan.textContent = 'Supabase not connected';
    }
    
    // Copy carrier settings
    tempCarrierSupportInfo = JSON.parse(JSON.stringify(settings.carrierSupportInfo || DEFAULT_SETTINGS.carrierSupportInfo));
    currentAdminSelectedCarrier = 'UPS';
    document.getElementById('adminCarrierSelect').value = 'UPS';
    loadAdminCarrierFields('UPS');
    
    // Reset accordions to default: only first active
    document.querySelectorAll('.accordion-item').forEach((item, index) => {
        if (index === 0) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    document.getElementById('modalAdminSettings').classList.remove('hidden');
}

// Save Admin settings to Supabase
async function handleAdminSettingsSubmit(e) {
    e.preventDefault();
    
    const emails = document.getElementById('adminEmails').value.trim();
    const employeesText = document.getElementById('adminEmployees').value.trim();
    const subjectTemplate = document.getElementById('adminSubjectTemplate').value.trim();
    const bodyTemplate = document.getElementById('adminBodyTemplate').value.trim();
    const newPass = document.getElementById('adminNewPassword').value.trim();
    
    // Save current carrier fields first
    saveAdminCarrierFields(currentAdminSelectedCarrier);
    
    // Parse employees text into array
    const employeesArray = employeesText
        .split('\n')
        .map(name => name.trim())
        .filter(name => name.length > 0);
        
    if (employeesArray.length === 0) {
        alert('You must provide at least one employee name.');
        return;
    }
    
    // Update settings object
    settings.managerEmails = emails;
    settings.employees = employeesArray;
    settings.emailSubjectTemplate = subjectTemplate;
    settings.emailBodyTemplate = bodyTemplate;
    settings.carrierSupportInfo = tempCarrierSupportInfo;
    
    if (newPass) {
        settings.adminPassword = newPass;
    }
    
    try {
        await saveSettings();
        populateEmployeeDropdowns();
        closeAllModals();
        alert('Admin settings saved successfully!');
    } catch (err) {
        console.error('Error saving settings:', err);
        alert('Failed to save settings. Check Supabase permissions.');
    }
}

// Helper to format Date to YYYY-MM-DDTHH:MM local datetime format
function getLocalDateTimeString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Helper to format datetime string for user display
function formatDateTimeDisplay(dtStr) {
    if (!dtStr) return '-';
    return dtStr.replace('T', ' ');
}

// --- PHOTO ANNOTATION VARIABLES & STATE ---
let currentAnnotationFile = null;
let currentAnnotationIndex = null;
let currentTool = 'pencil';
let currentDrawColor = '#dc2626'; // default Red
let currentDrawSize = 6; // default Medium
let dragStartImgData = null;
let startX = 0;
let startY = 0;
let undoStack = [];
let thumbnailObjectURLs = [];

const colors = {
    red: '#dc2626',
    yellow: '#eab308',
    blue: '#2563eb'
};

const sizes = {
    thin: 3,
    medium: 6,
    thick: 12
};

// Clear OSD thumbnails and revoke URLs
function clearOsdThumbnails() {
    thumbnailObjectURLs.forEach(url => URL.revokeObjectURL(url));
    thumbnailObjectURLs = [];
    const thumbsContainer = document.getElementById('osdThumbnailsContainer');
    if (thumbsContainer) {
        thumbsContainer.innerHTML = '';
    }
}

// Close only the photo annotation modal (leaves other modals like Receive open)
function closeAnnotationModalOnly() {
    document.getElementById('modalPhotoAnnotation').classList.add('hidden');
    
    // Revoke annotation background image URL
    const bgImg = document.getElementById('annotationBgImage');
    if (bgImg && bgImg.src && bgImg.src.startsWith('blob:')) {
        URL.revokeObjectURL(bgImg.src);
        bgImg.src = '';
    }
    
    // Clear canvas
    const canvas = document.getElementById('annotationCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    undoStack = [];
}

// Render OSD thumbnails under the drag zone
function renderOsdThumbnails() {
    let thumbsContainer = document.getElementById('osdThumbnailsContainer');
    if (!thumbsContainer) {
        thumbsContainer = document.createElement('div');
        thumbsContainer.id = 'osdThumbnailsContainer';
        thumbsContainer.style.marginTop = '0.75rem';
        thumbsContainer.style.display = 'flex';
        thumbsContainer.style.flexWrap = 'wrap';
        thumbsContainer.style.gap = '0.5rem';
        
        const osdPhotosGroup = document.getElementById('osdPhotosGroup');
        if (osdPhotosGroup) {
            osdPhotosGroup.appendChild(thumbsContainer);
        }
    }
    
    // Clear old thumbnails and revoke their URLs
    thumbnailObjectURLs.forEach(url => URL.revokeObjectURL(url));
    thumbnailObjectURLs = [];
    thumbsContainer.innerHTML = '';
    
    if (!selectedOsdFiles || selectedOsdFiles === 'deleted' || selectedOsdFiles.length === 0) {
        return;
    }
    
    selectedOsdFiles.forEach((file, index) => {
        const container = document.createElement('div');
        container.className = 'osd-edit-thumbnail-container';
        
        const img = document.createElement('img');
        img.className = 'osd-edit-thumbnail';
        const url = URL.createObjectURL(file);
        thumbnailObjectURLs.push(url);
        img.src = url;
        
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-osd-annotate';
        btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Annotate';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openAnnotationModal(file, index);
        });
        
        container.appendChild(img);
        container.appendChild(btn);
        thumbsContainer.appendChild(container);
    });
}

// Set drawing tool
function setTool(toolName) {
    currentTool = toolName;
    document.querySelectorAll('#btnToolPencil, #btnToolArrow, #btnToolRect, #btnToolText').forEach(btn => {
        btn.classList.remove('active');
    });
    
    let toolId = 'btnToolPencil';
    if (toolName === 'arrow') toolId = 'btnToolArrow';
    else if (toolName === 'rect') toolId = 'btnToolRect';
    else if (toolName === 'text') toolId = 'btnToolText';
    
    const activeBtn = document.getElementById(toolId);
    if (activeBtn) activeBtn.classList.add('active');
}

// Set drawing color
function setColor(colorName) {
    currentDrawColor = colors[colorName];
    document.querySelectorAll('#btnColorRed, #btnColorYellow, #btnColorBlue').forEach(btn => {
        btn.classList.remove('active-color');
    });
    const activeBtn = document.getElementById('btnColor' + colorName.charAt(0).toUpperCase() + colorName.slice(1));
    if (activeBtn) activeBtn.classList.add('active-color');
}

// Set brush size
function setSize(sizeName) {
    currentDrawSize = sizes[sizeName];
    document.querySelectorAll('#btnSizeThin, #btnSizeMedium, #btnSizeThick').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById('btnSize' + sizeName.charAt(0).toUpperCase() + sizeName.slice(1));
    if (activeBtn) activeBtn.classList.add('active');
}

// Save state for undo
function saveCanvasState() {
    const canvas = document.getElementById('annotationCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.length > 20) {
        undoStack.shift();
    }
}

// Undo action
function handleUndo() {
    if (undoStack.length > 1) {
        undoStack.pop(); // remove current state
        const prevState = undoStack[undoStack.length - 1];
        const canvas = document.getElementById('annotationCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.putImageData(prevState, 0, 0);
        }
    }
}

// Clear action
function handleClear() {
    if (confirm("Are you sure you want to clear all annotations?")) {
        const canvas = document.getElementById('annotationCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            undoStack = [];
            saveCanvasState();
        }
    }
}

// Open annotation canvas editor modal
function openAnnotationModal(file, index) {
    currentAnnotationFile = file;
    currentAnnotationIndex = index;
    
    setTool('pencil');
    setColor('red');
    setSize('medium');
    
    const bgImg = document.getElementById('annotationBgImage');
    const container = document.getElementById('annotationContainer');
    const canvas = document.getElementById('annotationCanvas');
    
    if (bgImg && canvas && container) {
        if (bgImg.src && bgImg.src.startsWith('blob:')) {
            URL.revokeObjectURL(bgImg.src);
        }
        
        bgImg.onload = () => {
            const w = bgImg.clientWidth;
            const h = bgImg.clientHeight;
            
            container.style.width = w + 'px';
            container.style.height = h + 'px';
            canvas.width = w;
            canvas.height = h;
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, w, h);
            
            undoStack = [];
            saveCanvasState();
        };
        
        bgImg.src = URL.createObjectURL(file);
        document.getElementById('modalPhotoAnnotation').classList.remove('hidden');
    }
}

// Get canvas coordinates normalized to bounding rect
function getCanvasCoords(e) {
    const canvas = document.getElementById('annotationCanvas');
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height
    };
}

// Draw vector arrow
function drawArrow(ctx, fromX, fromY, toX, toY, size, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const headLength = Math.max(10, size * 2.5);
    
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

// Setup pointer and touch event listeners for canvas
let drawing = false;
function setupCanvasDrawing() {
    const canvas = document.getElementById('annotationCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const startDrawing = (e) => {
        e.preventDefault();
        drawing = true;
        const coords = getCanvasCoords(e);
        
        ctx.strokeStyle = currentDrawColor;
        ctx.lineWidth = currentDrawSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (currentTool === 'pencil') {
            ctx.beginPath();
            ctx.moveTo(coords.x, coords.y);
        } else if (currentTool === 'arrow' || currentTool === 'rect') {
            dragStartImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            startX = coords.x;
            startY = coords.y;
        }
    };
    
    const draw = (e) => {
        if (!drawing) return;
        e.preventDefault();
        const coords = getCanvasCoords(e);
        
        if (currentTool === 'pencil') {
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
        } else if (currentTool === 'arrow') {
            ctx.putImageData(dragStartImgData, 0, 0);
            drawArrow(ctx, startX, startY, coords.x, coords.y, currentDrawSize, currentDrawColor);
        } else if (currentTool === 'rect') {
            ctx.putImageData(dragStartImgData, 0, 0);
            ctx.strokeStyle = currentDrawColor;
            ctx.lineWidth = currentDrawSize;
            ctx.strokeRect(startX, startY, coords.x - startX, coords.y - startY);
        }
    };
    
    const stopDrawing = (e) => {
        if (!drawing) return;
        drawing = false;
        e.preventDefault();
        
        const coords = getCanvasCoords(e);
        
        if (currentTool === 'text') {
            const text = prompt("Enter annotation text:");
            if (text) {
                ctx.fillStyle = currentDrawColor;
                let fontSize = 16;
                if (currentDrawSize === 3) fontSize = 14;
                else if (currentDrawSize === 6) fontSize = 20;
                else if (currentDrawSize === 12) fontSize = 32;
                
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.fillText(text, coords.x, coords.y);
                saveCanvasState();
            }
        } else {
            saveCanvasState();
        }
    };
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', () => { drawing = false; });
    
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
}

// Merges drawing with background image and updates selectedOsdFiles queue
function handleSaveAnnotation() {
    const bgImg = document.getElementById('annotationBgImage');
    const canvas = document.getElementById('annotationCanvas');
    
    if (!bgImg || !canvas || !currentAnnotationFile) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(bgImg, 0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);
    
    tempCanvas.toBlob(blob => {
        if (blob) {
            const annotatedFile = new File([blob], currentAnnotationFile.name, { type: 'image/png' });
            selectedOsdFiles[currentAnnotationIndex] = annotatedFile;
            renderOsdThumbnails();
            closeAnnotationModalOnly();
        }
    }, 'image/png');
}

// --- CARRIER PERFORMANCE ANALYTICS ---
function renderAnalytics() {
    const carrierStats = {};
    const CARRIERS_LIST = ['UPS', 'FedEx', 'DHL', 'Canada Post', 'Purolator', 'Manitoulin', 'Gardewine', 'DayRoss', 'ABF', 'TST-express', 'LTL / Other'];
    
    CARRIERS_LIST.forEach(carrier => {
        carrierStats[carrier] = {
            total: 0,
            received: 0,
            damaged: 0,
            intact: 0,
            rate: 0
        };
    });
    
    let overallTotal = 0;
    let overallReceived = 0;
    let overallDamaged = 0;
    
    orders.forEach(order => {
        if (order.status === 'Canceled') return;
        
        const carrier = order.carrier || 'LTL / Other';
        if (!carrierStats[carrier]) {
            carrierStats[carrier] = { total: 0, received: 0, damaged: 0, intact: 0, rate: 0 };
        }
        
        carrierStats[carrier].total++;
        overallTotal++;
        
        if (order.status === 'Received') {
            overallReceived++;
            carrierStats[carrier].received++;
            if (order.has_issue) {
                carrierStats[carrier].damaged++;
                overallDamaged++;
            } else {
                carrierStats[carrier].intact++;
            }
        }
    });
    
    for (const carrier in carrierStats) {
        const stats = carrierStats[carrier];
        stats.rate = stats.received > 0 ? (stats.damaged / stats.received) * 100 : 0;
    }
    
    const overallIncidentRate = overallReceived > 0 ? (overallDamaged / overallReceived) * 100 : 0;
    
    document.getElementById('kpiTotalShipments').textContent = overallTotal;
    document.getElementById('kpiTotalIncidents').textContent = overallDamaged;
    document.getElementById('kpiIncidentRate').textContent = overallIncidentRate.toFixed(1) + '%';
    
    renderBarChart(carrierStats);
    renderDonutChart(carrierStats);
    renderLeaderboardTable(carrierStats);
}

// Render dynamic horizontal SVG Bar Chart
function renderBarChart(carrierStats) {
    const container = document.getElementById('carrierBarChartContainer');
    if (!container) return;
    
    const carriersWithData = Object.keys(carrierStats).map(name => ({
        name,
        ...carrierStats[name]
    })).filter(c => c.received > 0);
    
    if (carriersWithData.length === 0) {
        container.innerHTML = `
            <div style="height: 100%; display: flex; justify-content: center; align-items: center; color: var(--text-secondary); font-size: 0.9rem;">
                No delivery data available to generate chart.
            </div>`;
        return;
    }
    
    carriersWithData.sort((a, b) => b.rate - a.rate);
    
    const svgWidth = 500;
    const barHeight = 25;
    const barSpacing = 15;
    const paddingLeft = 110;
    const paddingRight = 50;
    const paddingTop = 20;
    const paddingBottom = 20;
    
    const svgHeight = paddingTop + paddingBottom + (barHeight + barSpacing) * carriersWithData.length - barSpacing;
    
    let maxRate = Math.max(...carriersWithData.map(c => c.rate));
    if (maxRate === 0) maxRate = 10;
    
    let svgHtml = `<svg width="100%" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`;
    
    carriersWithData.forEach((carrier, index) => {
        const y = paddingTop + index * (barHeight + barSpacing);
        const chartWidth = svgWidth - paddingLeft - paddingRight;
        const barWidth = (carrier.rate / maxRate) * chartWidth;
        
        let color = '#10b981';
        if (carrier.rate >= 15) color = '#ef4444';
        else if (carrier.rate >= 5) color = '#f97316';
        
        svgHtml += `<rect x="${paddingLeft}" y="${y}" width="${chartWidth}" height="${barHeight}" rx="4" fill="var(--bg-control)" stroke="var(--border-control)" stroke-width="1" />`;
        
        if (barWidth > 0) {
            svgHtml += `<rect x="${paddingLeft}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${color}">
                <animate attributeName="width" from="0" to="${barWidth}" dur="0.8s" fill="freeze" />
            </rect>`;
        }
        
        svgHtml += `<text x="${paddingLeft - 10}" y="${y + barHeight/2 + 5}" text-anchor="end" fill="var(--text-primary)" font-size="12" font-weight="600">${carrier.name}</text>`;
        svgHtml += `<text x="${paddingLeft + barWidth + 8}" y="${y + barHeight/2 + 5}" fill="var(--text-primary)" font-size="12" font-weight="700">${carrier.rate.toFixed(1)}%</text>`;
    });
    
    svgHtml += `</svg>`;
    container.innerHTML = svgHtml;
}

// Render dynamic SVG Donut Chart and legend
function renderDonutChart(carrierStats) {
    const container = document.getElementById('carrierPieChartContainer');
    if (!container) return;
    
    const carriersWithData = Object.keys(carrierStats).map(name => ({
        name,
        ...carrierStats[name]
    })).filter(c => c.total > 0);
    
    if (carriersWithData.length === 0) {
        container.innerHTML = `
            <div style="height: 100%; display: flex; justify-content: center; align-items: center; color: var(--text-secondary); font-size: 0.9rem;">
                No shipments logged to generate volume share.
            </div>`;
        return;
    }
    
    carriersWithData.sort((a, b) => b.total - a.total);
    const totalVolume = carriersWithData.reduce((sum, c) => sum + c.total, 0);
    
    const segmentColors = [
        '#cf2e2e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6b7280', '#6366f1'
    ];
    
    const size = 260;
    const center = size / 2;
    const radius = 80;
    const strokeWidth = 24;
    const circumference = 2 * Math.PI * radius;
    
    let accumulatedPercent = 0;
    let svgHtml = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
    
    carriersWithData.forEach((carrier, index) => {
        const percent = carrier.total / totalVolume;
        const strokeDashArray = circumference;
        const strokeDashOffset = circumference * (1 - percent);
        const rotationAngle = (accumulatedPercent * 360) - 90;
        const color = segmentColors[index % segmentColors.length];
        
        svgHtml += `
            <circle cx="${center}" cy="${center}" r="${radius}"
                    fill="transparent"
                    stroke="${color}"
                    stroke-width="${strokeWidth}"
                    stroke-dasharray="${strokeDashArray}"
                    stroke-dashoffset="${strokeDashArray}"
                    transform="rotate(${rotationAngle} ${center} ${center})"
                    class="donut-segment"
                    style="transition: stroke-dashoffset 0.8s ease-out; cursor: pointer;"
                    title="${carrier.name}: ${carrier.total} shipments (${(percent * 100).toFixed(1)}%)">
                <animate attributeName="stroke-dashoffset" from="${strokeDashArray}" to="${strokeDashOffset}" dur="0.8s" fill="freeze" />
            </circle>
        `;
        
        accumulatedPercent += percent;
    });
    
    svgHtml += `
        <circle cx="${center}" cy="${center}" r="${radius - strokeWidth/2 - 1}" fill="var(--bg-card)" />
        <text x="${center}" y="${center - 5}" text-anchor="middle" fill="var(--text-secondary)" font-size="11" font-weight="600" style="text-transform: uppercase; letter-spacing: 0.5px;">Total</text>
        <text x="${center}" y="${center + 18}" text-anchor="middle" fill="var(--text-primary)" font-size="20" font-weight="800" font-family="var(--font-header)">${totalVolume}</text>
    </svg>`;
    
    let legendHtml = `<div style="display: flex; flex-direction: column; gap: 0.4rem; max-height: 240px; overflow-y: auto; width: 100%; padding-left: 0.5rem;">`;
    carriersWithData.forEach((carrier, index) => {
        const percent = (carrier.total / totalVolume) * 100;
        const color = segmentColors[index % segmentColors.length];
        legendHtml += `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem;">
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
                    <span style="font-weight: 600; color: var(--text-primary);">${carrier.name}</span>
                </div>
                <span style="color: var(--text-secondary); font-weight: 700;">${carrier.total} (${percent.toFixed(1)}%)</span>
            </div>`;
    });
    legendHtml += `</div>`;
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; width: 100%;">
            ${svgHtml}
            ${legendHtml}
        </div>`;
}

// Render leaderboard table
function renderLeaderboardTable(carrierStats) {
    const tableBody = document.getElementById('analyticsTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    const carrierList = Object.keys(carrierStats).map(name => ({
        name,
        ...carrierStats[name]
    }));
    
    carrierList.sort((a, b) => {
        if (a.received === 0 && b.received === 0) {
            return a.name.localeCompare(b.name);
        }
        if (a.received === 0) return 1;
        if (b.received === 0) return -1;
        return a.rate - b.rate;
    });
    
    carrierList.forEach(carrier => {
        const tr = document.createElement('tr');
        
        let rateCellContent = '-';
        if (carrier.received > 0) {
            let barColor = 'var(--status-received)';
            if (carrier.rate >= 15) barColor = 'var(--status-error)';
            else if (carrier.rate >= 5) barColor = 'var(--status-pending)';
            
            rateCellContent = `
                <div class="leaderboard-rate-wrapper">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="leaderboard-rate-label" style="color: ${barColor};">${carrier.rate.toFixed(1)}%</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">(${carrier.damaged}/${carrier.received} received)</span>
                    </div>
                    <div class="leaderboard-rate-track">
                        <div class="leaderboard-rate-bar" style="width: ${Math.min(100, carrier.rate)}%; background: ${barColor};"></div>
                    </div>
                </div>`;
        }
        
        tr.innerHTML = `
            <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(carrier.name)}</td>
            <td style="font-weight: 600; color: var(--text-primary);">${carrier.total}</td>
            <td style="font-weight: 600; color: var(--status-received);">${carrier.intact}</td>
            <td style="font-weight: 600; color: ${carrier.damaged > 0 ? 'var(--status-error)' : 'var(--text-muted)'};">${carrier.damaged}</td>
            <td>${rateCellContent}</td>
        `;
        
        tableBody.appendChild(tr);
    });
}

// Render shipment logs in the admin delete panel
function renderAdminShipmentsList() {
    const tbody = document.getElementById('adminShipmentsTableBody');
    if (!tbody) return;
    
    const searchVal = document.getElementById('adminShipmentSearch').value.toLowerCase().trim();
    tbody.innerHTML = '';
    
    const filtered = orders.filter(order => {
        if (!searchVal) return true;
        return (
            (order.po_number && order.po_number.toLowerCase().includes(searchVal)) ||
            (order.supplier && order.supplier.toLowerCase().includes(searchVal)) ||
            (order.carrier && order.carrier.toLowerCase().includes(searchVal))
        );
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 1rem;">No matching shipments.</td></tr>`;
        return;
    }
    
    filtered.forEach(order => {
        const tr = document.createElement('tr');
        
        let actionCellHtml = `
            <button type="button" class="btn btn-icon delete" onclick="adminDeleteOrder('${order.id}')" title="Delete Order" style="padding: 0.2rem 0.4rem; font-size: 0.72rem; background: var(--status-error); border-color: var(--status-error); color: white; display: flex; align-items: center; gap: 0.25rem; min-width: auto; border-radius: 4px;">
                <i class="fa-regular fa-trash-can"></i> Delete
            </button>`;
        
        tr.innerHTML = `
            <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(order.po_number)}</td>
            <td>${escapeHtml(order.supplier)}</td>
            <td>${escapeHtml(order.carrier || '-')}</td>
            <td><span class="badge ${order.status.toLowerCase().replace(' ', '-')}">${order.status}</span></td>
            <td>${actionCellHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Permanently delete a shipment log (Admin only)
async function adminDeleteOrder(orderId) {
    const order = orders.find(o => o.id == orderId);
    if (!order) return;
    
    let confirmMsg = `ADMIN DELETE ACTION: Are you sure you want to permanently delete PO Number: ${order.po_number}?`;
    if (order.status === 'Received') {
        confirmMsg = `⚠️ WARNING: This shipment is marked as RECEIVED. Deleting it will permanently remove it from all warehouse history and analytics records.\n\nAre you sure you want to delete PO Number: ${order.po_number}?`;
    }
    
    if (confirm(confirmMsg)) {
        try {
            await deleteOrderRecord(orderId);
            await syncDatabase();
            renderAdminShipmentsList();
        } catch (err) {
            console.error('Error deleting order:', err);
            alert('Failed to delete order. Check Supabase permissions.');
        }
    }
}
