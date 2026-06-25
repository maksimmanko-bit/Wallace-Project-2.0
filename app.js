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
let lastReceivedCount = 0;
let lastShippedCount = 0;
let lastPickedUpCount = 0;

// Sort state variables
let currentSortColumn = 'id';
let currentSortDirection = 'desc';
let currentDashboardTab = 'receiving';
let currentDashboardPeriod = 'today';
let lastOrdersSignature = '';

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
let selectedOutboundPhotoFiles = [];
let selectedPickupPhotoFiles = [];
let selectedTrailerDocs = [];
let selectedTrailerIssuePhotos = [];
let selectedWarrantyPhotos = [];
let selectedInspectionPhotos = [];

let currentAdminSelectedCarrier = 'UPS';
let tempCarrierSupportInfo = {};
let modalLockDepth = 0;

const CARRIER_OPTIONS = [
    'ABF',
    'Applied (Stan)',
    'Canada Post',
    'DayRoss',
    'Estes',
    'FedEx',
    'First Choice Messenger',
    'Gardewine',
    'Lee River Transport',
    'LTL / Other',
    'Manitoulin',
    'Progress Express',
    'Purolator',
    'River City Express',
    'TST-express',
    'UPS'
];

const STANDARD_CARRIERS = CARRIER_OPTIONS.filter(carrier => carrier !== 'LTL / Other');
const WARRANTY_STATUSES = ['To be Claimed', 'Working on it', 'Request Submitted', 'Approved', 'Denied'];
const TERMINAL_STATUSES = new Set([
    'Received',
    'Dispatched',
    'Approved',
    'Denied',
    'Inspected - damage found',
    'Inspected - good to go'
]);
const TABLE_COLUMNS = {
    receiving: [
        ['reference', 'PO Number', 'po_number'], ['supplier', 'Supplier', 'supplier'], ['eta', 'ETA', 'eta'],
        ['carrier', 'Carrier', 'carrier'], ['status', 'Status', 'status'], ['attachments', 'Attachments'], ['next_action', 'Next Action']
    ],
    outbound: [
        ['reference', 'Job Number', 'job_number'], ['customer', 'Customer', 'customer'], ['carrier', 'Carrier', 'carrier'],
        ['photos', 'Photos']
    ],
    pickup: [
        ['reference', 'Job Number', 'job_number'], ['customer', 'Customer', 'customer_name'],
        ['comments', 'Comments'], ['date', 'Pick Up Date', 'pickup_date'], ['photos', 'Photos']
    ],
    trailers: [
        ['reference', 'BOL #', 'bol_number'], ['trip', 'Trip #', 'trip_number'], ['status', 'Status', 'status'], ['timeline', 'Timeline', 'arrived_date'],
        ['attachments', 'Documents / Issue'], ['next_action', 'Next Action']
    ],
    warranty: [
        ['reference', 'Job Number', 'job_number'], ['order_type', 'Order Type', 'order_type'], ['claim_type', 'Claim Type', 'claim_type'],
        ['issue', 'Reported Issue'], ['status', 'Status', 'status'], ['customer', 'Customer / IDs'], ['photos', 'Photos'], ['next_action', 'Next Action']
    ],
    inspections: [
        ['reference', 'Job Number', 'job_number'], ['customer', 'Customer', 'customer_name'], ['status', 'Status', 'status'],
        ['notes', 'Notes'], ['photos', 'Photos'], ['next_action', 'Next Action']
    ]
};
let pendingColumnOrder = [];
let tableDensity = 'comfortable';
const photoPreviewCache = new Map();
let draggedColumnKey = null;
let columnDragStarted = false;

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
    employees: ["Alex", "Amanda", "Brian", "Bryson", "Darren", "David", "Emily", "Jacque", "Maksym", "Stacey", "Thomas"],
    pickupEmployees: ["Alex", "Brian", "Max", "Valerii"],
    trailerEmailRecipients: 'purchasing@maxshipping.com',
    trailerEmailSubject: '[CLOPAY ARRIVED] Trip {trip_number} - Stop {stop_number}',
    trailerEmailBody: `Trailer has arrived.

Trip #: {trip_number}
BOL #: {bol_number}
Stop #: {stop_number}
Weight: {weight}
Trailer #: {trailer_number}
Arrived: {arrived_date}

Issue: {issue_description}

Please review before sending.`,
    adminPasswordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
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
        'Estes': {
            title: 'Estes Claims & Support',
            phone: '1-866-378-3748',
            link: 'https://www.estes-express.com/myestes/claims/',
            instructions: 'Inspect freight before signing. Note visible damage or shortages on the delivery receipt, photograph the freight, labels, and packaging, retain all materials, and file the claim with Estes using the delivery paperwork and photos.'
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
        'Applied (Stan)': {
            title: 'Applied (Stan) OSD Support',
            instructions: 'Before signing, note all visible damage, shortage, or count discrepancies on the delivery paperwork. Take photos of the freight, labels, pallet condition, and any broken packaging. Contact Stan or the Applied dispatcher immediately with the PO, tracking/pro number, photos, and signed paperwork.'
        },
        'River City Express': {
            title: 'River City Express OSD Support',
            instructions: 'Do not sign clean if freight is damaged or short. Write the exception clearly on the POD/BOL, photograph the shipment before moving it, keep all packaging, and contact River City Express dispatch/customer service with the photos and delivery paperwork the same day.'
        },
        'First Choice Messenger': {
            title: 'First Choice Messenger OSD Support',
            instructions: 'Record damages or missing pieces on the driver paperwork before release. Take clear photos of the item, labels, and packaging, keep the shipment available for inspection, and notify First Choice Messenger dispatch/customer service with the PO, job details, and photos.'
        },
        'Lee River Transport': {
            title: 'Lee River Transport OSD Support',
            instructions: 'Inspect freight before signing. If damage or shortage is found, mark the exception on the BOL/POD, take photos from multiple angles including labels, retain packaging, and contact Lee River Transport dispatch/customer service immediately with all supporting documents.'
        },
        'Progress Express': {
            title: 'Progress Express OSD Support',
            instructions: 'Inspect every piece before the driver leaves. Record visible damage or shortages on the BOL/POD, photograph the freight, labels, and packaging, retain all materials for inspection, and notify Progress Express dispatch or customer service the same day with the shipment paperwork and photos.'
        },
        'LTL / Other': {
            title: 'LTL Freight / Custom Carrier Support',
            instructions: 'Please inspect the shipment carefully. Note all damages/discrepancies on the Bill of Lading (BOL) before the driver departs. Take clear photos of all labels and damaged areas.'
        }
    }
};

let settings = { ...DEFAULT_SETTINGS };

async function hashAdminPasscode(passcode) {
    const data = new TextEncoder().encode(passcode);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function normalizeSettings() {
    let settingsChanged = false;
    const hadPickupEmployees = Array.isArray(settings.pickupEmployees) && settings.pickupEmployees.length > 0;
    const hadTrailerEmailSettings = Boolean(settings.trailerEmailRecipients && settings.trailerEmailSubject && settings.trailerEmailBody);
    settings = {
        ...DEFAULT_SETTINGS,
        ...settings,
        carrierSupportInfo: {
            ...DEFAULT_SETTINGS.carrierSupportInfo,
            ...(settings.carrierSupportInfo || {})
        }
    };
    CARRIER_OPTIONS.forEach(carrier => {
        if (!settings.carrierSupportInfo[carrier]) {
            settings.carrierSupportInfo[carrier] = DEFAULT_SETTINGS.carrierSupportInfo[carrier] || {
                title: `${carrier} Claims & Support`,
                instructions: DEFAULT_SETTINGS.carrierSupportInfo['LTL / Other'].instructions
            };
            settingsChanged = true;
        }
    });

    // Migrate older shared settings that stored the passcode as plain text.
    if (settings.adminPassword) {
        settings.adminPasswordHash = await hashAdminPasscode(settings.adminPassword);
        delete settings.adminPassword;
        settingsChanged = true;
    }

    const previousDefaultEmployees = ["Bryan", "Maksym", "Stacey", "Emily", "Bryson", "Thomas", "Jacque", "Amanda", "Daren"];
    if (JSON.stringify(settings.employees) === JSON.stringify(previousDefaultEmployees)) {
        settings.employees = [...DEFAULT_SETTINGS.employees];
        settingsChanged = true;
    }
    ['employees', 'pickupEmployees'].forEach(key => {
        if (!Array.isArray(settings[key])) return;
        const renamed = settings[key].map(name => name === 'Bryan' ? 'Brian' : name);
        if (JSON.stringify(renamed) !== JSON.stringify(settings[key])) {
            settings[key] = renamed;
            settingsChanged = true;
        }
    });
    if (!hadPickupEmployees) settingsChanged = true;
    if (!hadTrailerEmailSettings) settingsChanged = true;

    return settingsChanged;
}

function carrierOptionLabel(carrier) {
    if (carrier === 'DayRoss') return 'Day & Ross';
    if (carrier === 'ABF') return 'ABF Freight';
    if (carrier === 'TST-express') return 'TST-CF Express';
    return carrier;
}

function populateCarrierDropdowns() {
    const carrierSelectIds = ['formCarrier', 'outboundCarrier', 'adminCarrierSelect'];
    carrierSelectIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        
        const currentValue = select.value;
        const includeBlank = id === 'formCarrier';
        select.innerHTML = includeBlank ? '<option value="" selected>Select Carrier (Optional)</option>' : '';
        
        CARRIER_OPTIONS.forEach(carrier => {
            const option = document.createElement('option');
            option.value = carrier;
            option.textContent = carrierOptionLabel(carrier);
            select.appendChild(option);
        });
        
        if (currentValue && CARRIER_OPTIONS.includes(currentValue)) {
            select.value = currentValue;
        }
    });
    
    const filterCarrier = document.getElementById('filterCarrier');
    if (filterCarrier) {
        const currentValue = filterCarrier.value;
        filterCarrier.innerHTML = '<option value="all">All Carriers</option>';
        CARRIER_OPTIONS.forEach(carrier => {
            const option = document.createElement('option');
            option.value = carrier;
            option.textContent = carrierOptionLabel(carrier);
            filterCarrier.appendChild(option);
        });
        filterCarrier.value = CARRIER_OPTIONS.includes(currentValue) ? currentValue : 'all';
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    setupTheme();
    populateCarrierDropdowns();
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
    
    document.getElementById('onboardingIcon').innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--brand-red);"></i>';
}

async function connectSupabase() {
    try {
        getSupabaseClient();
        
        await loadSettings();
        
        const statusDiv = document.getElementById('connectionStatus');
        statusDiv.className = 'status-badge connected';
        statusDiv.innerHTML = '<span class="indicator"></span><span class="status-text">Server Connected</span>';
        statusDiv.style.cursor = 'default';
        statusDiv.onclick = null;
        
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
            const migratedSettings = await normalizeSettings();
            if (migratedSettings) await saveSettings();
        } else {
            // Write defaults if empty
            settings = { ...DEFAULT_SETTINGS };
            await normalizeSettings();
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
    applyEmbeddedActionTimes(order);
    order.updated_by = order.inspected_by || order.received_by || order.handled_by || order.requested_by || order.updated_by || order.ordered_by || '';
    order.updated_date = getLocalDateTimeString();
    appendStatusHistory(order);
    const client = getSupabaseClient();
    const { error } = await client
        .from(SUPABASE_ORDERS_TABLE)
        .upsert({ id: Number(order.id), data: order }, { onConflict: 'id' });
    
    if (error) throw error;
    showToast('Changes saved', `${getRecordTypeLabel(order)} ${getRecordReference(order)} is up to date.`);
}

function appendStatusHistory(order) {
    const status = order.status || (isOutboundOrder(order) ? 'Shipped Out' : (isPickupOrder(order) ? 'Picked Up' : 'Ordered'));
    if (!status) return;
    if (!Array.isArray(order.status_history)) order.status_history = [];
    const previous = order.status_history[order.status_history.length - 1];
    if (previous?.status === status) return;
    order.status_history.push({
        status,
        date: order.updated_date || getLocalDateTimeString(),
        actor: order.updated_by || order.received_by || order.inspected_by || order.handled_by || order.requested_by || order.ordered_by || ''
    });
}

function showToast(title, message = '', type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `app-toast ${type}`;
    const icon = type === 'error' ? 'fa-circle-exclamation' : (type === 'info' ? 'fa-circle-info' : 'fa-circle-check');
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><div><strong>${escapeHtml(title)}</strong>${message ? `<span>${escapeHtml(message)}</span>` : ''}</div>`;
    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3600);
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
    const preparedFile = await compressImageFile(file);
    const { error } = await client
        .storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(path, preparedFile, {
            upsert: true,
            contentType: preparedFile.type || 'application/octet-stream'
        });
    
    if (error) throw error;
    return filename;
}

function pickFiles({ accept = '*/*', multiple = true } = {}) {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.multiple = multiple;
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.addEventListener('change', () => {
            const files = Array.from(input.files || []);
            input.remove();
            resolve(files);
        }, { once: true });
        input.click();
    });
}

async function addFilesDirectly(orderId, kind) {
    const order = orders.find(item => item.id == orderId);
    if (!order || !supabaseClient) return;

    const config = {
        receiving_attached: { accept: '.pdf,image/*', folder: 'scans', prefix: 'slip', field: 'packing_slip_filenames', label: 'attached file' },
        receiving_pod: { accept: '.pdf,image/*', folder: 'scans', prefix: 'pod', field: 'invoice_filenames', label: 'POD file' },
        receiving_osd: { accept: 'image/*', folder: 'osd', prefix: 'osd', field: 'osd_photos', label: 'OSD photo', imagesOnly: true },
        outbound_photos: { accept: 'image/*', folder: 'shipped_out', prefix: 'shipped', field: 'shipped_photos', label: 'shipped photo', imagesOnly: true },
        pickup_photos: { accept: 'image/*', folder: 'customer_pickup', prefix: 'pickup', field: 'pickup_photos', label: 'pick up photo', imagesOnly: true },
        trailer_docs: { accept: '.pdf,.xls,.xlsx', folder: 'clopay_trailers', prefix: 'trailer_doc', field: 'documents', label: 'document', docsOnly: true },
        trailer_issue_photos: { accept: 'image/*', folder: 'clopay_issues', prefix: 'trailer_issue', field: 'issue_photos', label: 'issue photo', imagesOnly: true },
        warranty_photos: { accept: 'image/*', folder: 'warranty', prefix: 'warranty', field: 'photos', label: 'warranty photo', imagesOnly: true },
        inspection_photos: { accept: 'image/*', folder: 'panel_inspections', prefix: 'inspection', field: 'photos', label: 'inspection photo', imagesOnly: true }
    }[kind];

    if (!config) return;
    const files = await pickFiles({ accept: config.accept, multiple: true });
    if (!files.length) return;

    let validFiles = files;
    if (config.imagesOnly) validFiles = files.filter(file => file.type.startsWith('image/'));
    if (config.docsOnly) validFiles = files.filter(file => ['pdf', 'xls', 'xlsx'].includes(file.name.split('.').pop().toLowerCase()));
    if (!validFiles.length) {
        showToast('Wrong file type', `Please select ${config.imagesOnly ? 'image files' : config.accept}.`, 'error');
        return;
    }

    try {
        showToast('Uploading files', `${validFiles.length} ${config.label}${validFiles.length === 1 ? '' : 's'} selected.`, 'info');
        const safeRef = getRecordReference(order).replace(/[^a-zA-Z0-9_-]/g, '_');
        const uploaded = [];
        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            const ext = file.name.split('.').pop();
            const filename = `${config.prefix}_${safeRef}_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}.${ext}`;
            await uploadStorageFile(config.folder, filename, file);
            if (config.field === 'documents') {
                uploaded.push({ filename, original_name: file.name, uploaded_at: getLocalDateTimeString(), search_text: '' });
            } else {
                uploaded.push(filename);
            }
        }

        let current = Array.isArray(order[config.field]) ? order[config.field] : [];
        if (kind === 'receiving_attached') current = getPackingSlipFiles(order);
        if (kind === 'receiving_pod') current = order.invoice_filenames || (order.invoice_filename ? [order.invoice_filename] : []);
        order[config.field] = [...current, ...uploaded];
        if (kind === 'receiving_attached') order.packing_slip_filename = order.packing_slip_filenames[0] || null;
        if (kind === 'receiving_pod') order.invoice_filename = order.invoice_filenames[0] || null;
        if (kind === 'receiving_osd') order.has_issue = true;
        if (kind === 'trailer_issue_photos') order.has_issue = true;
        order.updated_date = getLocalDateTimeString();

        await saveOrderRecord(order);
        await syncDatabase();
        viewOrderDetails(order.id);
    } catch (err) {
        console.error('Direct file upload failed:', err);
        showToast('Upload failed', 'The selected files could not be saved.', 'error');
    }
}

async function compressImageFile(file) {
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!file || !supportedTypes.includes(file.type) || file.size <= 1024 * 1024) return file;

    const objectUrl = URL.createObjectURL(file);
    try {
        const image = await new Promise((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = reject;
            element.src = objectUrl;
        });

        const maximumDimension = 1920;
        const scale = Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return file;

        if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, width, height);
        }
        context.drawImage(image, 0, 0, width, height);

        const outputType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, outputType, 0.82));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], file.name, { type: outputType, lastModified: file.lastModified });
    } catch (err) {
        console.warn('Image optimization skipped:', err);
        return file;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
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
        
        const loadedOrders = (data || []).map(row => {
            const order = { ...(row.data || {}), id: Number(row.id) };
            if (isReceivingOrder(order) && order.status === 'In Transit') order.status = 'Ordered';
            ['ordered_by', 'received_by', 'handled_by', 'requested_by', 'inspected_by', 'updated_by'].forEach(key => {
                if (order[key] === 'Bryan') order[key] = 'Brian';
            });
            if (Array.isArray(order.status_history)) {
                order.status_history.forEach(entry => {
                    if (entry.actor === 'Bryan') entry.actor = 'Brian';
                });
            }
            return order;
        });
        
        // Sort: newest orders first (based on ordered_date and timestamp ID)
        loadedOrders.sort((a, b) => b.id - a.id);
        const nextSignature = JSON.stringify(loadedOrders);
        if (nextSignature === lastOrdersSignature) return;
        
        orders = loadedOrders;
        lastOrdersSignature = nextSignature;
        const tableBody = document.getElementById('ordersTableBody');
        tableBody?.classList.add('refreshing');
        renderDashboard();
        setTimeout(() => tableBody?.classList.remove('refreshing'), 180);
        if (!document.getElementById('modalDashboard')?.classList.contains('hidden')) renderOperationsDashboard();
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

function isOutboundOrder(order) {
    return order.record_type === 'outbound';
}

function isPickupOrder(order) {
    return order.record_type === 'customer_pickup';
}

function isTrailerOrder(order) {
    return order.record_type === 'clopay_trailer';
}

function isWarrantyOrder(order) {
    return order.record_type === 'warranty_claim';
}

function isInspectionOrder(order) {
    return order.record_type === 'panel_inspection';
}

function isReceivingOrder(order) {
    return !isOutboundOrder(order) && !isPickupOrder(order) && !isTrailerOrder(order) && !isWarrantyOrder(order) && !isInspectionOrder(order);
}

function getOrderViewType(order) {
    if (isOutboundOrder(order)) return 'outbound';
    if (isPickupOrder(order)) return 'pickup';
    if (isTrailerOrder(order)) return 'trailers';
    if (isWarrantyOrder(order)) return 'warranty';
    if (isInspectionOrder(order)) return 'inspections';
    return 'receiving';
}

function getRecordTypeLabel(order) {
    if (isOutboundOrder(order)) return 'Shipped Out';
    if (isPickupOrder(order)) return 'Customer Pick Up';
    if (isTrailerOrder(order)) return 'Trailer';
    if (isWarrantyOrder(order)) return 'Warranty Claim';
    if (isInspectionOrder(order)) return 'Panel Inspection';
    return 'Receiving';
}

function getRecordReference(order) {
    if (isTrailerOrder(order)) return `BOL ${order.bol_number || '-'}`;
    if (isOutboundOrder(order) || isPickupOrder(order) || isWarrantyOrder(order) || isInspectionOrder(order)) return `Job ${order.job_number || '-'}`;
    return `PO ${order.po_number || '-'}`;
}

function getRecordParty(order) {
    if (isTrailerOrder(order)) return `Trip ${order.trip_number || '-'} / Stop ${order.stop_number || '-'}`;
    if (isOutboundOrder(order)) return order.customer || '-';
    if (isPickupOrder(order) || isWarrantyOrder(order) || isInspectionOrder(order)) return order.customer_name || '-';
    return order.supplier || '-';
}

function getRecordSearchValues(order) {
    if (isTrailerOrder(order)) return [order.bol_number, order.trip_number, order.stop_number, order.trailer_number, order.weight, order.status, order.issue_description, ...(order.documents || []).flatMap(file => [file.original_name, file.filename, file.search_text])];
    if (isWarrantyOrder(order)) return [order.job_number, order.reported_issue, order.order_type, order.claim_type, order.status, order.original_order_id, order.customer_name, order.warranty_notes, order.approved_id, order.denied_reason];
    if (isInspectionOrder(order)) return [order.job_number, order.customer_name, order.status, order.requested_by, order.inspected_by, order.notes];
    if (isPickupOrder(order)) return [order.job_number, order.customer_name, order.handled_by, order.notes];
    if (isOutboundOrder(order)) return [order.job_number, order.customer, order.carrier, order.ship_to_address, order.payment_type, order.notes];
    return [order.po_number, order.supplier, order.item_description, order.ordered_by, order.carrier, order.tracking_number, order.notes];
}

function getRecordFiles(order) {
    if (isTrailerOrder(order)) return [
        ...(order.documents || []).map(file => ({ folder: 'clopay_trailers', filename: file.filename, downloadName: file.original_name || file.filename })),
        ...(order.issue_photos || []).map((filename, index) => ({ folder: 'clopay_issues', filename, downloadName: `Trailer_Issue_${index + 1}_${filename}` }))
    ];
    if (isWarrantyOrder(order)) return (order.photos || []).map((filename, index) => ({ folder: 'warranty', filename, downloadName: `Warranty_${index + 1}_${filename}` }));
    if (isInspectionOrder(order)) return (order.photos || []).map((filename, index) => ({ folder: 'panel_inspections', filename, downloadName: `Inspection_${index + 1}_${filename}` }));
    if (isPickupOrder(order)) return (order.pickup_photos || []).map((filename, index) => ({ folder: 'customer_pickup', filename, downloadName: `Pickup_${index + 1}_${filename}` }));
    if (isOutboundOrder(order)) return (order.shipped_photos || []).map((filename, index) => ({ folder: 'shipped_out', filename, downloadName: `Shipped_${index + 1}_${filename}` }));
    const packingSlipFiles = getPackingSlipFiles(order);
    const podFiles = order.invoice_filenames || (order.invoice_filename ? [order.invoice_filename] : []);
    return [
        ...packingSlipFiles.map((filename, index) => ({ folder: 'scans', filename, downloadName: `Packing_Slip_${index + 1}_${filename}` })),
        ...podFiles.map((filename, index) => ({ folder: 'scans', filename, downloadName: `POD_${index + 1}_${filename}` })),
        ...(order.osd_photos || []).map((filename, index) => ({ folder: 'osd', filename, downloadName: `OSD_${index + 1}_${filename}` }))
    ];
}

function getPackingSlipFiles(order) {
    return order.packing_slip_filenames || (order.packing_slip_filename ? [order.packing_slip_filename] : []);
}

function buildRecordTimeline(order) {
    let items = [];

    if (isReceivingOrder(order)) {
        items = [
            { label: 'Ordered', date: order.ordered_date || order.created_date, actor: order.ordered_by || '' },
            { label: 'Received', date: order.received_date, actor: order.received_by || '' }
        ];
    } else if (isTrailerOrder(order)) {
        items = [
            { label: 'Created', date: order.created_date, actor: order.created_by || '' },
            { label: 'Arrived', date: order.arrived_date, actor: order.arrived_by || '' },
            { label: 'Dispatched', date: order.dispatched_date, actor: order.dispatched_by || '' }
        ];
    } else if (isWarrantyOrder(order)) {
        const submittedDate = order.submitted_date || (order.status === 'Request Submitted' ? order.updated_date : '');
        items = [
            { label: 'Created', date: order.created_date, actor: order.created_by || '' },
            { label: 'Submitted', date: submittedDate, actor: order.submitted_by || '' }
        ];
        if (order.status === 'Denied') {
            items.push({ label: 'Denied', date: order.denied_date || (order.status === 'Denied' ? order.updated_date : ''), actor: order.denied_by || '' });
        } else if (order.status === 'Approved') {
            items.push({ label: 'Approved', date: order.approved_date || order.updated_date, actor: order.approved_by || '' });
        } else if (order.approved_date) {
            items.push({ label: 'Approved', date: order.approved_date, actor: order.approved_by || '' });
        } else if (order.denied_date) {
            items.push({ label: 'Denied', date: order.denied_date, actor: order.denied_by || '' });
        }
    } else if (isInspectionOrder(order)) {
        items = [
            { label: 'Created', date: order.created_date, actor: order.requested_by || '' },
            { label: 'Inspected', date: order.inspected_date || (order.status !== 'Inspection Request' ? order.updated_date : ''), actor: order.inspected_by || '' }
        ];
    } else {
        return '';
    }

    return `<section class="record-timeline"><div class="record-timeline-title">Record Timeline</div><div class="record-timeline-track">${items.map(item => `
        <div class="record-timeline-item ${item.date ? '' : 'pending'}">
            <span class="record-timeline-dot"></span>
            <div><strong>${escapeHtml(item.label)}</strong><span>${item.date ? `${formatDateTimeDisplay(item.date)} · ${escapeHtml(item.actor || 'Employee not recorded')}` : 'Not recorded'}</span></div>
        </div>`).join('')}</div></section>`;
}

function buildStatusHistory(order) {
    const history = Array.isArray(order.status_history) ? order.status_history : [];
    if (!history.length) return '';
    return `<section class="status-history"><div class="record-timeline-title">Status Log</div>${history.slice().reverse().map(item => `
        <div class="status-history-row">
            <span class="badge ${workflowStatusClass(item.status, order)}">${escapeHtml(item.status)}</span>
            <span>${formatDateTimeDisplay(item.date)}</span>
            <strong>${escapeHtml(item.actor || 'Employee not recorded')}</strong>
        </div>`).join('')}</section>`;
}

function stampWarrantyStatusTransition(claim, previousStatus, nextStatus) {
    if (previousStatus === nextStatus) return;
    const now = getLocalDateTimeString();
    if (nextStatus === 'Request Submitted' && !claim.submitted_date) claim.submitted_date = now;
    if (nextStatus === 'Approved' && !claim.approved_date) claim.approved_date = now;
    if (nextStatus === 'Denied' && !claim.denied_date) claim.denied_date = now;
}

async function quickSetTrailerStatus(orderId, status) {
    const trailer = orders.find(order => order.id == orderId && isTrailerOrder(order));
    if (!trailer) return;
    if (status === 'Arrived' && !trailer.arrived_date) trailer.arrived_date = getLocalDateTimeString();
    if (status === 'Dispatched') {
        if (!trailer.arrived_date) trailer.arrived_date = getLocalDateTimeString();
        trailer.dispatched_date = getLocalDateTimeString();
    }
    trailer.status = status;
    try {
        await saveOrderRecord(trailer);
        await syncDatabase();
    } catch (err) {
        console.error('Quick trailer update failed:', err);
        showToast('Status was not changed', 'Check the server connection and try again.', 'error');
    }
}

async function quickSetWarrantyStatus(orderId, status) {
    const claim = orders.find(order => order.id == orderId && isWarrantyOrder(order));
    if (!claim || claim.status === status) return;
    const previousStatus = claim.status || 'To be Claimed';
    const needsProgress = status !== 'To be Claimed';
    const missingProgress = needsProgress && (!claim.original_order_id || !claim.customer_name || !claim.warranty_notes);
    const missingDecision = (status === 'Approved' && !claim.approved_id) || (status === 'Denied' && !claim.denied_reason);
    if (missingProgress || missingDecision) {
        openWarrantyModal(orderId);
        document.getElementById('warrantyStatus').value = status;
        toggleWarrantyFields();
        showToast('More information required', `Complete the required fields for ${status}.`, 'info');
        return;
    }
    claim.status = status;
    stampWarrantyStatusTransition(claim, previousStatus, status);
    try {
        await saveOrderRecord(claim);
        await syncDatabase();
    } catch (err) {
        console.error('Quick warranty update failed:', err);
        showToast('Status was not changed', 'Check the server connection and try again.', 'error');
    }
}

function parseDateOnly(value) {
    if (!value) return null;
    const [year, month, day] = value.split('T')[0].split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

function getEtaState(order) {
    const etaDate = parseDateOnly(order.eta);
    if (!etaDate || order.status === 'Received' || order.status === 'Canceled') return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const difference = Math.round((etaDate - today) / 86400000);
    if (difference < 0) return { className: 'eta-overdue', label: `${Math.abs(difference)}d overdue`, difference };
    if (difference === 0) return { className: 'eta-today', label: 'Today', difference };
    if (difference <= 7) return { className: 'eta-upcoming', label: `In ${difference}d`, difference };
    return { className: 'eta-future', label: order.eta, difference };
}

function renderEtaBadge(order) {
    if (!order.eta) return '-';
    const state = getEtaState(order);
    if (!state) return `<span class="eta-table-badge eta-future">${escapeHtml(order.eta)}</span>`;
    return `<span class="eta-table-badge ${state.className}" title="${escapeHtml(order.eta)}">${state.label}</span>`;
}

function formatElapsedTime(startValue, endValue) {
    if (!startValue || !endValue) return '-';
    const milliseconds = new Date(endValue).getTime() - new Date(startValue).getTime();
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return '-';
    const totalMinutes = Math.round(milliseconds / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    return [days ? `${days}d` : '', hours ? `${hours}h` : '', `${minutes}m`].filter(Boolean).join(' ');
}

function workflowStatusClass(status, order = null) {
    if (['Received', 'Dispatched', 'Approved', 'Inspected - good to go', 'Shipped Out', 'Picked Up'].includes(status)) return 'status-complete';
    if (['Denied', 'Canceled', 'Inspected - damage found'].includes(status)) return 'status-problem';
    if (order?.has_issue) return 'status-problem';
    if (['Working on it', 'Request Submitted', 'Arrived'].includes(status)) return 'status-working';
    if (order && isReceivingOrder(order)) {
        const etaState = getEtaState(order);
        if (etaState && etaState.difference <= 0) return 'status-attention';
    }
    return 'status-waiting';
}

function getSavedColumnOrder(tab = currentDashboardTab) {
    const defaults = TABLE_COLUMNS[tab].map(column => column[0]);
    try {
        const saved = JSON.parse(localStorage.getItem(`max-logistics-columns-${tab}`) || '[]');
        const valid = saved.filter(key => defaults.includes(key));
        defaults.filter(key => !valid.includes(key)).forEach(key => valid.push(key));
        return valid;
    } catch {
        return defaults;
    }
}

function renderTableHeader() {
    const tableHead = document.getElementById('ordersTableHead');
    if (!tableHead) return;
    const columnsByKey = new Map(TABLE_COLUMNS[currentDashboardTab].map(column => [column[0], column]));
    tableHead.innerHTML = `<tr>${getSavedColumnOrder().map(key => {
        const [, label, sortKey] = columnsByKey.get(key);
        return `<th data-column="${key}" draggable="true" ${sortKey ? `class="sortable draggable-column" data-sort="${sortKey}"` : 'class="draggable-column"'}><span class="column-drag-label"><i class="fa-solid fa-grip-vertical"></i>${label}</span></th>`;
    }).join('')}</tr>`;
    setupSortableHeaders();
    setupDraggableColumns();
}

function recordRowState(order) {
    if (TERMINAL_STATUSES.has(order.status) || isOutboundOrder(order) || isPickupOrder(order)) return 'row-complete';
    if (order.has_issue) return 'row-problem';
    if (isReceivingOrder(order)) {
        const eta = getEtaState(order);
        if (eta && eta.difference <= 0 && order.status === 'Ordered') return 'row-attention';
    }
    if (['Working on it', 'Request Submitted', 'Arrived'].includes(order.status)) return 'row-working';
    return 'row-waiting';
}

function getPreviewPhotoFile(order) {
    if (isWarrantyOrder(order) && order.photos?.length) return { folder: 'warranty', filename: order.photos[0] };
    if (isInspectionOrder(order) && order.photos?.length) return { folder: 'panel_inspections', filename: order.photos[0] };
    if (isPickupOrder(order) && order.pickup_photos?.length) return { folder: 'customer_pickup', filename: order.pickup_photos[0] };
    if (isOutboundOrder(order) && order.shipped_photos?.length) return { folder: 'shipped_out', filename: order.shipped_photos[0] };
    if (isTrailerOrder(order) && order.issue_photos?.length) return { folder: 'clopay_issues', filename: order.issue_photos[0] };
    if (order.osd_photos?.length) return { folder: 'osd', filename: order.osd_photos[0] };
    return null;
}

function renderTablePhotoButton(order, count, viewer, label = 'Photos') {
    if (!count) return '<span class="text-muted"><i class="fa-solid fa-minus"></i> None</span>';
    return `<button type="button" class="btn-scan attached photo-preview-trigger" data-preview-order-id="${order.id}" onclick="${viewer}('${order.id}')" title="Open photo gallery"><i class="fa-solid fa-camera"></i> ${label} (${count})</button>`;
}

function renderNextAction(order) {
    if (TERMINAL_STATUSES.has(order.status)) return '<span class="text-muted">-</span>';
    if (isReceivingOrder(order) && order.status === 'Ordered') {
        return `<button type="button" class="btn-next-action" onclick="openReceiveModal('${order.id}')"><i class="fa-solid fa-check"></i> Receive</button>`;
    }
    if (isTrailerOrder(order) && order.status === 'Expected') {
        return `<button type="button" class="btn-next-action" onclick="quickSetTrailerStatus('${order.id}', 'Arrived')"><i class="fa-solid fa-warehouse"></i> Arrived</button>`;
    }
    if (isTrailerOrder(order) && order.status === 'Arrived') {
        return `<button type="button" class="btn-next-action" onclick="quickSetTrailerStatus('${order.id}', 'Dispatched')"><i class="fa-solid fa-truck-fast"></i> Dispatched</button>`;
    }
    if (isWarrantyOrder(order)) {
        if (order.status === 'To be Claimed') return `<button type="button" class="btn-next-action" onclick="quickSetWarrantyStatus('${order.id}', 'Working on it')"><i class="fa-solid fa-arrow-right"></i> Start Work</button>`;
        if (order.status === 'Working on it') return `<button type="button" class="btn-next-action" onclick="quickSetWarrantyStatus('${order.id}', 'Request Submitted')"><i class="fa-solid fa-paper-plane"></i> Submit</button>`;
        if (order.status === 'Request Submitted') return `<div class="next-action-buttons"><button type="button" class="btn-next-action" onclick="quickSetWarrantyStatus('${order.id}', 'Approved')"><i class="fa-solid fa-check"></i> Approve</button><button type="button" class="btn-next-action danger" onclick="quickSetWarrantyStatus('${order.id}', 'Denied')"><i class="fa-solid fa-xmark"></i> Deny</button></div>`;
    }
    if (isInspectionOrder(order) && order.status === 'Inspection Request') {
        return `<div class="next-action-buttons"><button type="button" class="btn-next-action" onclick="openInspectionForStatus('${order.id}', 'Inspected - good to go')"><i class="fa-solid fa-check"></i> Good</button><button type="button" class="btn-next-action danger" onclick="openInspectionForStatus('${order.id}', 'Inspected - damage found')"><i class="fa-solid fa-triangle-exclamation"></i> Damage</button></div>`;
    }
    return '<span class="text-muted">-</span>';
}

function appendConfiguredRow(tableBody, tr, order) {
    const defaultColumns = TABLE_COLUMNS[currentDashboardTab].map(column => column[0]);
    Array.from(tr.children).forEach((cell, index) => cell.dataset.column = defaultColumns[index]);
    const cells = new Map(Array.from(tr.children).map(cell => [cell.dataset.column, cell]));
    getSavedColumnOrder().forEach(key => cells.get(key) && tr.appendChild(cells.get(key)));
    tr.classList.add(recordRowState(order));
    const preview = getPreviewPhotoFile(order);
    if (preview) {
        tr.querySelectorAll('button').forEach(button => {
            if (/Photos|Damage Photos|Issue \(|OSD \(/.test(button.textContent)) {
                button.classList.add('photo-preview-trigger');
                button.dataset.previewOrderId = order.id;
            }
        });
    }
    tr.dataset.recordId = order.id;
    tr.addEventListener('click', event => {
        if (!window.matchMedia('(max-width: 768px)').matches) return;
        if (event.target.closest('a, button, select, input, textarea')) return;
        viewOrderDetails(order.id);
    });
    tableBody.appendChild(tr);
}

function applyTableDensity(density) {
    tableDensity = 'comfortable';
    document.body.classList.remove('table-density-compact');
}

function openColumnSettings() {
    showToast('Arrange columns', 'Drag table headers left or right to change column order.', 'info');
}

function renderColumnSettingsList() {
    const list = document.getElementById('columnSettingsList');
    if (!list) return;
    const labels = new Map(TABLE_COLUMNS[currentDashboardTab].map(column => [column[0], column[1]]));
    list.innerHTML = pendingColumnOrder.map((key, index) => `
        <div class="column-setting-row">
            <span class="column-setting-handle"><i class="fa-solid fa-grip-vertical"></i></span>
            <strong>${escapeHtml(labels.get(key))}</strong>
            <div class="column-setting-actions">
                <button type="button" onclick="movePendingColumn(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Move up"><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" onclick="movePendingColumn(${index}, 1)" ${index === pendingColumnOrder.length - 1 ? 'disabled' : ''} title="Move down"><i class="fa-solid fa-arrow-down"></i></button>
            </div>
        </div>`).join('');
}

function movePendingColumn(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= pendingColumnOrder.length) return;
    [pendingColumnOrder[index], pendingColumnOrder[target]] = [pendingColumnOrder[target], pendingColumnOrder[index]];
    renderColumnSettingsList();
}

function saveColumnSettings() {
    localStorage.setItem(`max-logistics-columns-${currentDashboardTab}`, JSON.stringify(pendingColumnOrder));
    closeAllModals();
    renderDashboard();
    showToast('Table view saved', `${document.getElementById('shipmentTableTitle')?.textContent || 'Table'} columns were updated.`);
}

function resetColumnSettings() {
    localStorage.removeItem(`max-logistics-columns-${currentDashboardTab}`);
    pendingColumnOrder = TABLE_COLUMNS[currentDashboardTab].map(column => column[0]);
    renderColumnSettingsList();
}

function hasActiveFilters() {
    const statusActive = !document.getElementById('statusFilterWrapper')?.classList.contains('hidden') && document.getElementById('filterStatus')?.value !== 'all';
    const carrierActive = !document.getElementById('carrierFilterWrapper')?.classList.contains('hidden') && document.getElementById('filterCarrier')?.value !== 'all';
    return Boolean(document.getElementById('searchInput')?.value.trim()) || statusActive || carrierActive;
}

function clearActiveFilter(type) {
    if (type === 'search' || type === 'all') document.getElementById('searchInput').value = '';
    if (type === 'status' || type === 'all') document.getElementById('filterStatus').value = 'all';
    if (type === 'carrier' || type === 'all') document.getElementById('filterCarrier').value = 'all';
    renderDashboard();
}

function renderActiveFilters() {
    const bar = document.getElementById('activeFilterBar');
    const search = document.getElementById('searchInput').value.trim();
    const status = document.getElementById('filterStatus').value;
    const carrier = document.getElementById('filterCarrier').value;
    const chips = [];
    if (search) chips.push(['search', 'Search', search]);
    if (status !== 'all' && !document.getElementById('statusFilterWrapper').classList.contains('hidden')) chips.push(['status', 'Status', status]);
    if (carrier !== 'all' && !document.getElementById('carrierFilterWrapper').classList.contains('hidden')) chips.push(['carrier', 'Carrier', carrierOptionLabel(carrier)]);
    const mobileCount = document.getElementById('mobileFilterCount');
    if (mobileCount) {
        mobileCount.textContent = chips.length;
        mobileCount.classList.toggle('hidden', chips.length === 0);
    }
    bar.classList.toggle('hidden', !chips.length);
    bar.innerHTML = chips.map(([type, label, value]) => `<button type="button" class="filter-chip" onclick="clearActiveFilter('${type}')"><span>${label}: <strong>${escapeHtml(value)}</strong></span><i class="fa-solid fa-xmark"></i></button>`).join('') + (chips.length ? '<button type="button" class="clear-filter-btn" onclick="clearActiveFilter(\'all\')">Clear all</button>' : '');
}

function createRecordForCurrentTab() {
    if (currentDashboardTab === 'outbound') openOutboundModal();
    else if (currentDashboardTab === 'pickup') openPickupModal();
    else if (currentDashboardTab === 'trailers') openTrailerModal();
    else if (currentDashboardTab === 'warranty') openWarrantyModal();
    else if (currentDashboardTab === 'inspections') openInspectionModal();
    else openOrderModal();
}

function getTaskGroups() {
    return [
        { label: 'ETA due or overdue', icon: 'fa-clock', items: orders.filter(order => isReceivingOrder(order) && order.status === 'Ordered' && getEtaState(order)?.difference <= 0) },
        { label: 'Warranty waiting to be claimed', icon: 'fa-shield-halved', items: orders.filter(order => isWarrantyOrder(order) && order.status === 'To be Claimed') },
        { label: 'Inspections waiting', icon: 'fa-clipboard-check', items: orders.filter(order => isInspectionOrder(order) && order.status === 'Inspection Request') }
    ];
}

function updateTaskCount() {
    const count = getTaskGroups().reduce((total, group) => total + group.items.length, 0);
    const badge = document.getElementById('taskCountBadge');
    if (!badge) return;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('hidden', count === 0);
}

function openTaskCenter() {
    closeAllModals();
    const groups = getTaskGroups();
    const total = groups.reduce((sum, group) => sum + group.items.length, 0);
    document.getElementById('taskCenterContent').innerHTML = total ? groups.map(group => `
        <section class="task-group">
            <div class="task-group-title"><span><i class="fa-solid ${group.icon}"></i>${group.label}</span><strong>${group.items.length}</strong></div>
            ${group.items.length ? group.items.map(order => `<button type="button" class="task-item" onclick="openTaskRecord('${order.id}')"><span><strong>${escapeHtml(getRecordReference(order))}</strong><small>${escapeHtml(getRecordParty(order))}</small></span><i class="fa-solid fa-chevron-right"></i></button>`).join('') : '<div class="task-group-empty">All clear</div>'}
        </section>`).join('') : '<div class="task-center-clear"><i class="fa-solid fa-circle-check"></i><strong>Everything is up to date</strong><span>No records need immediate action.</span></div>';
    showModal('modalTaskCenter');
}

function openTaskRecord(orderId) {
    const order = orders.find(item => item.id == orderId);
    if (!order) return;
    closeAllModals();
    setDashboardTab(getOrderViewType(order));
    viewOrderDetails(orderId);
}

function syncMobileNavigation() {
    document.querySelectorAll('[data-mobile-tab]').forEach(button => button.classList.toggle('active', button.dataset.mobileTab === currentDashboardTab));
    document.getElementById('btnMobileMore')?.classList.toggle('active', ['trailers', 'warranty', 'inspections'].includes(currentDashboardTab));
}

function triggerMobileCreate() {
    document.getElementById('mobileMorePanel')?.classList.add('hidden');
    createRecordForCurrentTab();
}

async function showPhotoHoverPreview(trigger) {
    const order = orders.find(item => item.id == trigger.dataset.previewOrderId);
    const file = order && getPreviewPhotoFile(order);
    if (!file) return;
    const preview = document.getElementById('photoHoverPreview');
    const media = preview.querySelector('.photo-hover-preview-media');
    preview.classList.remove('hidden');
    media.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    const rect = trigger.getBoundingClientRect();
    preview.style.left = `${Math.min(window.innerWidth - 250, Math.max(8, rect.left))}px`;
    preview.style.top = `${Math.max(8, rect.top - 190)}px`;
    const key = `${file.folder}/${file.filename}`;
    try {
        if (!photoPreviewCache.has(key)) {
            const { data, error } = await getSupabaseClient().storage.from(SUPABASE_STORAGE_BUCKET).download(key);
            if (error) throw error;
            photoPreviewCache.set(key, URL.createObjectURL(data));
        }
        if (!preview.classList.contains('hidden')) media.innerHTML = `<img src="${photoPreviewCache.get(key)}" alt="Photo preview">`;
    } catch {
        media.innerHTML = '<span>Preview unavailable</span>';
    }
}

function hidePhotoHoverPreview() {
    document.getElementById('photoHoverPreview')?.classList.add('hidden');
}

function updateDashboardChrome() {
    const isOutbound = currentDashboardTab === 'outbound';
    const isPickup = currentDashboardTab === 'pickup';
    const isTrailers = currentDashboardTab === 'trailers';
    const isWarranty = currentDashboardTab === 'warranty';
    const isInspections = currentDashboardTab === 'inspections';
    const isReceiving = !isOutbound && !isPickup && !isTrailers && !isWarranty && !isInspections;
    const mobileTabSelect = document.getElementById('mobileTabSelect');
    if (mobileTabSelect && mobileTabSelect.value !== currentDashboardTab) mobileTabSelect.value = currentDashboardTab;
    document.getElementById('tabReceiving')?.classList.toggle('active', isReceiving);
    document.getElementById('tabShippedOut')?.classList.toggle('active', isOutbound);
    document.getElementById('tabCustomerPickup')?.classList.toggle('active', isPickup);
    document.getElementById('tabClopayTrailers')?.classList.toggle('active', isTrailers);
    document.getElementById('tabWarranty')?.classList.toggle('active', isWarranty);
    document.getElementById('tabPanelInspections')?.classList.toggle('active', isInspections);
    document.getElementById('tabReceiving')?.setAttribute('aria-selected', String(isReceiving));
    document.getElementById('tabShippedOut')?.setAttribute('aria-selected', String(isOutbound));
    document.getElementById('tabCustomerPickup')?.setAttribute('aria-selected', String(isPickup));
    document.getElementById('tabClopayTrailers')?.setAttribute('aria-selected', String(isTrailers));
    document.getElementById('tabWarranty')?.setAttribute('aria-selected', String(isWarranty));
    document.getElementById('tabPanelInspections')?.setAttribute('aria-selected', String(isInspections));
    document.getElementById('btnNewOrder')?.classList.toggle('hidden', !isReceiving);
    document.getElementById('btnNewOutbound')?.classList.toggle('hidden', !isOutbound);
    document.getElementById('btnNewPickup')?.classList.toggle('hidden', !isPickup);
    document.getElementById('btnNewTrailer')?.classList.toggle('hidden', !isTrailers);
    document.getElementById('btnNewWarranty')?.classList.toggle('hidden', !isWarranty);
    document.getElementById('btnNewInspection')?.classList.toggle('hidden', !isInspections);
    document.getElementById('statusFilterWrapper')?.classList.toggle('hidden', !(isReceiving || isWarranty || isInspections));
    document.getElementById('carrierFilterWrapper')?.classList.toggle('hidden', isPickup || isTrailers || isWarranty || isInspections);

    const statusFilter = document.getElementById('filterStatus');
    if (statusFilter) {
        const desiredOptions = isWarranty
            ? ['all', 'To be Claimed', 'Working on it', 'Request Submitted', 'Approved', 'Denied']
            : isInspections
            ? ['all', 'Inspection Request', 'Inspected - good to go', 'Inspected - damage found']
            : ['all', 'Ordered', 'Received', 'Canceled'];
        const signature = desiredOptions.join('|');
        if (statusFilter.dataset.options !== signature) {
            statusFilter.innerHTML = desiredOptions.map(value => `<option value="${value}">${value === 'all' ? 'All Statuses' : value}</option>`).join('');
            statusFilter.dataset.options = signature;
        }
    }
    
    const tableTitle = document.getElementById('shipmentTableTitle');
    if (tableTitle) tableTitle.textContent = isTrailers ? 'Trailer Logs' : (isWarranty ? 'Warranty Claims' : (isInspections ? 'Panel Inspection Logs' : (isPickup ? 'Customer Pick Up Logs' : (isOutbound ? 'Shipped Out Logs' : 'Receiving Logs'))));
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.placeholder = isTrailers
            ? 'Search trailer fields and text inside PDF or Excel attachments...'
            : isWarranty
            ? 'Search warranty job, issue, customer, type, or status...'
            : isInspections
            ? 'Search inspection customer, job, employee, notes, or status...'
            : isPickup
            ? 'Search by customer, job number, or comments...'
            : (isOutbound
                ? 'Search by customer, job number, address, carrier, or notes...'
                : 'Search by PO#, supplier, carrier, tracking, or ordered by...');
    }
    
    const emptyText = document.getElementById('emptyStateText');
    if (emptyText) {
        emptyText.textContent = isTrailers
            ? 'No trailer records yet or matching search criteria.'
            : isWarranty
            ? 'No warranty claims yet or matching search criteria.'
            : isInspections
            ? 'No panel inspections yet or matching search criteria.'
            : isPickup
            ? 'No customer pick up records yet or matching search criteria.'
            : (isOutbound
                ? 'No shipped out records yet or matching search criteria.'
                : 'No receiving shipments logged yet or matching search criteria.');
    }
    
    renderTableHeader();
    syncMobileNavigation();
}

function setDashboardTab(tab) {
    currentDashboardTab = tab;
    document.querySelector('.controls-card')?.classList.remove('mobile-filters-open');
    document.getElementById('btnMobileFilters')?.setAttribute('aria-expanded', 'false');
    currentSortColumn = tab === 'outbound' ? 'shipped_date' : (tab === 'pickup' ? 'pickup_date' : (tab === 'warranty' || tab === 'inspections' ? 'updated_date' : 'id'));
    currentSortDirection = 'desc';
    renderDashboard();
}

// Render Dashboard Data
function renderDashboard() {
    updateDashboardChrome();
    renderActiveFilters();
    updateTaskCount();
    applyTableDensity(tableDensity);
    
    const tableBody = document.getElementById('ordersTableBody');
    const emptyState = document.getElementById('emptyState');
    const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
    const filterStatus = document.getElementById('filterStatus').value;
    const filterCarrier = document.getElementById('filterCarrier').value;
    const isOutboundTab = currentDashboardTab === 'outbound';
    const isPickupTab = currentDashboardTab === 'pickup';
    const isTrailersTab = currentDashboardTab === 'trailers';
    const isWarrantyTab = currentDashboardTab === 'warranty';
    const isInspectionsTab = currentDashboardTab === 'inspections';
    
    tableBody.innerHTML = '';
    
    // Filter orders
    const filteredOrders = orders.filter(order => {
        if (getOrderViewType(order) !== currentDashboardTab) return false;
        
        // Status filter
        if (!isOutboundTab && !isPickupTab && !isTrailersTab && filterStatus !== 'all' && order.status !== filterStatus) return false;
        
        // Carrier filter
        if (!isPickupTab && !isTrailersTab && !isWarrantyTab && !isInspectionsTab && filterCarrier !== 'all') {
            if (filterCarrier === 'LTL / Other') {
                if (STANDARD_CARRIERS.includes(order.carrier)) return false;
            } else if (order.carrier !== filterCarrier) {
                return false;
            }
        }
        
        // Search text
        if (searchVal) {
            const searchableFields = isTrailersTab
                ? [order.trip_number, order.bol_number, order.stop_number, order.weight, order.trailer_number, order.status, order.issue_description, ...(order.documents || []).flatMap(file => [file.original_name || file.filename, file.search_text])]
                : isWarrantyTab
                ? [order.job_number, order.reported_issue, order.order_type, order.claim_type, order.status, order.original_order_id, order.customer_name, order.warranty_notes, order.approved_id, order.denied_reason]
                : isInspectionsTab
                ? [order.job_number, order.customer_name, order.status, order.requested_by, order.inspected_by, order.notes]
                : isPickupTab
                ? [order.customer_name, order.job_number, order.handled_by, order.notes]
                : (isOutboundTab
                    ? [order.customer, order.job_number, order.carrier, order.ship_to_address, order.payment_type, order.notes]
                    : [order.po_number, order.supplier, order.item_description, order.ordered_by, order.tracking_number, order.notes]);
            const matchesSearch = searchableFields.some(value => value && String(value).toLowerCase().includes(searchVal));
            
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
            } else if (currentSortColumn === 'ordered_date' || currentSortColumn === 'received_date' || currentSortColumn === 'shipped_date' || currentSortColumn === 'pickup_date' || currentSortColumn === 'created_date' || currentSortColumn === 'updated_date') {
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
        document.querySelector('.table-card > .table-responsive')?.classList.add('hidden');
        const filtered = hasActiveFilters();
        document.getElementById('emptyStateTitle').textContent = filtered ? 'No matching records' : 'No records yet';
        document.getElementById('emptyStateText').textContent = filtered
            ? 'The current search or filters exclude every record in this section.'
            : 'Create the first record for this section to get started.';
        document.getElementById('btnEmptyClearFilters').classList.toggle('hidden', !filtered);
        document.getElementById('btnEmptyCreate').innerHTML = `<i class="fa-solid fa-plus"></i> ${currentDashboardTab === 'warranty' ? 'New Warranty Claim' : currentDashboardTab === 'inspections' ? 'New Inspection' : currentDashboardTab === 'trailers' ? 'New Trailer' : currentDashboardTab === 'pickup' ? 'New Pick Up' : currentDashboardTab === 'outbound' ? 'New Shipped Out' : 'New Receiving'}`;
        document.getElementById('recordCount').textContent = isTrailersTab ? 'Showing 0 trailers' : (isWarrantyTab ? 'Showing 0 warranty claims' : (isInspectionsTab ? 'Showing 0 inspections' : (isPickupTab ? 'Showing 0 pick up records' : (isOutboundTab ? 'Showing 0 shipped out records' : 'Showing 0 orders'))));
        return;
    } else {
        emptyState.classList.add('hidden');
        document.querySelector('.table-card > .table-responsive')?.classList.remove('hidden');
        document.getElementById('recordCount').textContent = isTrailersTab
            ? `Showing ${filteredOrders.length} trailer${filteredOrders.length > 1 ? 's' : ''}`
            : isWarrantyTab
            ? `Showing ${filteredOrders.length} warranty claim${filteredOrders.length > 1 ? 's' : ''}`
            : isInspectionsTab
            ? `Showing ${filteredOrders.length} inspection${filteredOrders.length > 1 ? 's' : ''}`
            : isPickupTab
            ? `Showing ${filteredOrders.length} pick up record${filteredOrders.length > 1 ? 's' : ''}`
            : (isOutboundTab
                ? `Showing ${filteredOrders.length} shipped out record${filteredOrders.length > 1 ? 's' : ''}`
                : `Showing ${filteredOrders.length} order${filteredOrders.length > 1 ? 's' : ''}`);
    }
    
    // Render Table Rows
    filteredOrders.forEach(order => {
        const tr = document.createElement('tr');

        if (isWarrantyTab) {
            const photoCount = order.photos?.length || 0;
            const photoCell = renderTablePhotoButton(order, photoCount, 'viewWarrantyPhotos');
            const secondaryId = order.status === 'Approved' ? order.approved_id : (order.status === 'Denied' ? order.denied_reason : order.original_order_id);
            tr.innerHTML = `
                <td class="po-col"><a href="#" class="po-details-link" onclick="viewOrderDetails('${order.id}'); return false;">${escapeHtml(order.job_number)}</a></td>
                <td>${escapeHtml(order.order_type)}</td>
                <td>${escapeHtml(order.claim_type)}</td>
                <td class="desc-col" title="${escapeHtml(order.reported_issue || '')}">${escapeHtml(order.reported_issue || '-')}</td>
                <td>
                    <span class="badge ${workflowStatusClass(order.status, order)}">${escapeHtml(order.status)}</span>
                </td>
                <td><strong>${escapeHtml(order.customer_name || '-')}</strong><div class="received-info">${escapeHtml(secondaryId || '-')}</div></td>
                <td>${photoCell}</td>
                <td>${renderNextAction(order)}</td>
            `;
            appendConfiguredRow(tableBody, tr, order);
            return;
        }

        if (isInspectionsTab) {
            const photoCount = order.photos?.length || 0;
            const photoCell = renderTablePhotoButton(order, photoCount, 'viewInspectionPhotos');
            tr.innerHTML = `
                <td class="po-col"><a href="#" class="po-details-link" onclick="viewOrderDetails('${order.id}'); return false;">${escapeHtml(order.job_number)}</a></td>
                <td class="supplier-col">${escapeHtml(order.customer_name)}</td>
                <td><span class="badge ${workflowStatusClass(order.status, order)}">${escapeHtml(order.status)}</span></td>
                <td class="desc-col" title="${escapeHtml(order.notes || '')}">${escapeHtml(order.notes || '-')}</td>
                <td>${photoCell}</td>
                <td>${renderNextAction(order)}</td>
            `;
            appendConfiguredRow(tableBody, tr, order);
            return;
        }

        if (isTrailersTab) {
            const documents = order.documents || [];
            const issuePhotos = order.issue_photos || [];
            const statusClass = workflowStatusClass(order.status, order);
            const documentButton = documents.length ? `<span class="attachment-count"><i class="fa-solid fa-paperclip"></i> ${documents.length} document${documents.length === 1 ? '' : 's'}</span>` : '<span class="text-muted">No docs</span>';
            const issueButton = order.has_issue
                ? (issuePhotos.length ? renderTablePhotoButton(order, issuePhotos.length, 'viewTrailerIssuePhotos', 'Issue Photos') : '<span class="attachment-count issue"><i class="fa-solid fa-triangle-exclamation"></i> Issue reported</span>')
                : '';

            tr.innerHTML = `
                <td class="po-col">
                    <a href="#" class="po-details-link" onclick="viewOrderDetails('${order.id}'); return false;">${escapeHtml(order.bol_number)}</a>
                </td>
                <td>${escapeHtml(order.trip_number)}</td>
                <td><span class="badge ${statusClass}">${escapeHtml(order.status)}</span></td>
                <td><div class="received-info">Arrived: ${formatDateTimeDisplay(order.arrived_date)}<br>Dispatched: ${formatDateTimeDisplay(order.dispatched_date)}</div>${order.arrived_date && order.dispatched_date ? `<div class="record-duration">Elapsed: ${formatElapsedTime(order.arrived_date, order.dispatched_date)}</div>` : ''}</td>
                <td><div class="attachment-actions">${documentButton}${issueButton}</div></td>
                <td>${renderNextAction(order)}</td>
            `;
            appendConfiguredRow(tableBody, tr, order);
            return;
        }

        if (isPickupTab) {
            const photoCount = order.pickup_photos ? order.pickup_photos.length : 0;
            const photoCell = renderTablePhotoButton(order, photoCount, 'viewPickupPhotos');

            tr.innerHTML = `
                <td class="po-col">
                    <a href="#" class="po-details-link" onclick="viewOrderDetails('${order.id}'); return false;">${escapeHtml(order.job_number)}</a>
                </td>
                <td class="supplier-col">${escapeHtml(order.customer_name || '-')}</td>
                <td class="desc-col" title="${escapeHtml(order.notes || '')}">${escapeHtml(order.notes || '-')}</td>
                <td>${formatDateTimeDisplay(order.pickup_date)}</td>
                <td>${photoCell}</td>
            `;
            appendConfiguredRow(tableBody, tr, order);
            return;
        }
        
        if (isOutboundTab) {
            const photoCount = order.shipped_photos ? order.shipped_photos.length : 0;
            const photoCell = renderTablePhotoButton(order, photoCount, 'viewOutboundPhotos');
            
            tr.innerHTML = `
                <td class="po-col">
                    <a href="#" class="po-details-link" onclick="viewOrderDetails('${order.id}'); return false;">${escapeHtml(order.job_number || '-')}</a>
                </td>
                <td class="supplier-col">${escapeHtml(order.customer)}</td>
                <td>${escapeHtml(carrierOptionLabel(order.carrier || 'LTL / Other'))}</td>
                <td>${photoCell}</td>
            `;
            appendConfiguredRow(tableBody, tr, order);
            return;
        }
        
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
        const packingSlipFiles = getPackingSlipFiles(order);
        if (packingSlipFiles.length > 0) {
            scanCell += `<span class="attachment-count"><i class="fa-solid fa-file-invoice"></i> ${packingSlipFiles.length} attached file${packingSlipFiles.length > 1 ? 's' : ''}</span>`;
        }
        const podFiles = order.invoice_filenames || (order.invoice_filename ? [order.invoice_filename] : []);
        if (podFiles.length > 0) {
            scanCell += `<span class="attachment-count"><i class="fa-solid fa-file-signature"></i> ${podFiles.length} POD</span>`;
        }
        if (order.osd_photos && order.osd_photos.length > 0) {
            scanCell += renderTablePhotoButton(order, order.osd_photos.length, 'viewOsdPhotos', 'OSD');
        }
        if (!scanCell) {
            scanCell = `<span class="text-muted"><i class="fa-solid fa-minus"></i> None</span>`;
        }
        
        // Format Status Column
        let statusCell = `<span class="badge ${workflowStatusClass(order.status, order)}"><span class="badge-dot"></span>${order.status}</span>`;
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
            <td>${renderEtaBadge(order)}</td>
            <td>${trackingCell}</td>
            <td>${statusCell}</td>
            <td><div class="attachment-actions">${scanCell}</div></td>
            <td>${renderNextAction(order)}</td>
        `;
        appendConfiguredRow(tableBody, tr, order);
    });
}

// Update Stats counters on top
function updateStats() {
    let receivedTodayCount = 0;
    let shippedTodayCount = 0;
    let pickedUpTodayCount = 0;
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    orders.filter(isReceivingOrder).forEach(order => {
        if (order.status === 'Received' && order.received_date && order.received_date.split('T')[0] === todayStr) {
            receivedTodayCount++;
        }
    });

    orders.filter(isOutboundOrder).forEach(order => {
        if (order.shipped_date && order.shipped_date.split('T')[0] === todayStr) shippedTodayCount++;
    });

    orders.filter(isPickupOrder).forEach(order => {
        if (order.pickup_date && order.pickup_date.split('T')[0] === todayStr) pickedUpTodayCount++;
    });
    
    const receivedEl = document.getElementById('statReceivedToday');
    const shippedEl = document.getElementById('statShippedToday');
    const pickedUpEl = document.getElementById('statPickedUpToday');
    
    animateValue(receivedEl, lastReceivedCount, receivedTodayCount, 800);
    animateValue(shippedEl, lastShippedCount, shippedTodayCount, 800);
    animateValue(pickedUpEl, lastPickedUpCount, pickedUpTodayCount, 800);
    
    lastReceivedCount = receivedTodayCount;
    lastShippedCount = shippedTodayCount;
    lastPickedUpCount = pickedUpTodayCount;
    
    // If the analytics tab is active, trigger renderAnalytics() to sync metrics
    const analyticsSection = document.getElementById('analyticsSection');
    if (analyticsSection && !analyticsSection.classList.contains('hidden')) {
        renderAnalytics();
    }
}

function getDashboardPeriodRange(period) {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (period === 'week') {
        start.setDate(start.getDate() - 6);
        return { start, end, label: 'Last 7 days' };
    }
    if (period === 'month') {
        start.setDate(1);
        return { start, end, label: 'This month' };
    }
    return { start, end, label: 'Today' };
}

function isDateInDashboardRange(value, range) {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date >= range.start && date <= range.end;
}

function formatAverageDuration(milliseconds) {
    if (!milliseconds || milliseconds <= 0) return '-';
    const hours = milliseconds / 3600000;
    if (hours < 48) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
}

function openOperationsDashboard() {
    closeAllModals();
    showModal('modalDashboard');
    renderOperationsDashboard();
}

function renderOperationsDashboard() {
    const range = getDashboardPeriodRange(currentDashboardPeriod);
    document.getElementById('dashboardPeriodLabel').textContent = range.label;

    const receivedOrders = orders.filter(order =>
        isReceivingOrder(order) &&
        order.status === 'Received' &&
        isDateInDashboardRange(order.received_date, range)
    );
    const shippedOrders = orders.filter(order => isOutboundOrder(order) && isDateInDashboardRange(order.shipped_date, range));
    const pickedUpOrders = orders.filter(order => isPickupOrder(order) && isDateInDashboardRange(order.pickup_date, range));
    const warrantyClaims = orders.filter(order => isWarrantyOrder(order) && isDateInDashboardRange(order.created_date, range));
    const osdOrders = receivedOrders.filter(order => order.has_issue);

    const durations = receivedOrders
        .map(order => new Date(order.received_date).getTime() - new Date(order.ordered_date).getTime())
        .filter(duration => Number.isFinite(duration) && duration > 0);
    const averageDuration = durations.length
        ? durations.reduce((total, duration) => total + duration, 0) / durations.length
        : 0;

    document.getElementById('dashboardReceived').textContent = receivedOrders.length;
    document.getElementById('dashboardShipped').textContent = shippedOrders.length;
    document.getElementById('dashboardPickedUp').textContent = pickedUpOrders.length;
    document.getElementById('dashboardOsd').textContent = osdOrders.length;
    document.getElementById('dashboardWarranty').textContent = warrantyClaims.length;
    document.getElementById('dashboardAvgTime').textContent = formatAverageDuration(averageDuration);

    renderDashboardEtaList();
    renderDashboardOsdCarriers(receivedOrders);
    renderWarrantyBreakdown('dashboardWarrantyStatuses', warrantyClaims, 'status');
    renderWarrantyBreakdown('dashboardWarrantyTypes', warrantyClaims, 'claim_type');
}

function renderWarrantyBreakdown(containerId, claims, field) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const counts = {};
    claims.forEach(claim => {
        const label = claim[field] || 'Not specified';
        counts[label] = (counts[label] || 0) + 1;
    });
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!rows.length) {
        container.innerHTML = '<div class="dashboard-empty">No warranty claims in this period.</div>';
        return;
    }
    const maximum = rows[0][1];
    container.innerHTML = rows.map(([label, count]) => `
        <div class="dashboard-carrier-row">
            <div class="dashboard-carrier-meta"><strong>${escapeHtml(label)}</strong><span>${count}</span></div>
            <div class="dashboard-carrier-bar"><span style="width:${(count / maximum) * 100}%"></span></div>
        </div>`).join('');
}

function renderDashboardEtaList() {
    const container = document.getElementById('dashboardEtaList');
    const etaOrders = orders
        .filter(isReceivingOrder)
        .map(order => ({ order, state: getEtaState(order) }))
        .filter(item => item.state && (item.state.difference <= 7))
        .sort((a, b) => a.state.difference - b.state.difference);

    document.getElementById('dashboardEtaCount').textContent = etaOrders.length;
    if (etaOrders.length === 0) {
        container.innerHTML = '<div class="dashboard-empty">No overdue or upcoming ETA notifications.</div>';
        return;
    }

    container.innerHTML = etaOrders.map(({ order, state }) => `
        <div class="dashboard-eta-item">
            <strong>${escapeHtml(order.eta)}</strong>
            <div>
                <strong>PO ${escapeHtml(order.po_number)}</strong>
                <p>${escapeHtml(order.supplier || 'Unknown supplier')}</p>
            </div>
            <span class="eta-indicator ${state.className}">${state.label}</span>
        </div>
    `).join('');
}

function renderDashboardOsdCarriers(receivedOrders) {
    const container = document.getElementById('dashboardOsdCarriers');
    const carrierCounts = {};
    receivedOrders.filter(order => order.has_issue).forEach(order => {
        const carrier = carrierOptionLabel(order.carrier || 'LTL / Other');
        carrierCounts[carrier] = (carrierCounts[carrier] || 0) + 1;
    });

    const rows = Object.entries(carrierCounts).sort((a, b) => b[1] - a[1]);
    if (rows.length === 0) {
        container.innerHTML = '<div class="dashboard-empty">No OSD incidents in this period.</div>';
        return;
    }

    const maximum = rows[0][1];
    container.innerHTML = rows.map(([carrier, count]) => `
        <div class="dashboard-carrier-row">
            <div class="dashboard-carrier-meta">
                <strong>${escapeHtml(carrier)}</strong>
                <span>${count} incident${count === 1 ? '' : 's'}</span>
            </div>
            <div class="dashboard-carrier-bar"><span style="width: ${(count / maximum) * 100}%"></span></div>
        </div>
    `).join('');
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

function setupSortableHeaders() {
    const headers = document.querySelectorAll('.orders-table th.sortable');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            if (columnDragStarted) {
                columnDragStarted = false;
                return;
            }
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
}

function setupDraggableColumns() {
    const headers = document.querySelectorAll('.orders-table th[data-column]');
    headers.forEach(header => {
        header.addEventListener('dragstart', event => {
            draggedColumnKey = header.dataset.column;
            columnDragStarted = false;
            header.classList.add('column-dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', draggedColumnKey);
        });
        header.addEventListener('dragover', event => {
            event.preventDefault();
            if (!draggedColumnKey || draggedColumnKey === header.dataset.column) return;
            header.classList.add('column-drop-target');
            event.dataTransfer.dropEffect = 'move';
        });
        header.addEventListener('dragleave', () => {
            header.classList.remove('column-drop-target');
        });
        header.addEventListener('drop', event => {
            event.preventDefault();
            const targetKey = header.dataset.column;
            document.querySelectorAll('.orders-table th').forEach(th => th.classList.remove('column-drop-target', 'column-dragging'));
            if (!draggedColumnKey || draggedColumnKey === targetKey) return;
            const order = getSavedColumnOrder();
            const from = order.indexOf(draggedColumnKey);
            const to = order.indexOf(targetKey);
            if (from === -1 || to === -1) return;
            order.splice(to, 0, order.splice(from, 1)[0]);
            localStorage.setItem(`max-logistics-columns-${currentDashboardTab}`, JSON.stringify(order));
            columnDragStarted = true;
            const tableBody = document.getElementById('ordersTableBody');
            tableBody?.classList.add('refreshing');
            renderDashboard();
            setTimeout(() => tableBody?.classList.remove('refreshing'), 220);
            showToast('Column order saved', 'Your table view was updated.');
        });
        header.addEventListener('dragend', () => {
            document.querySelectorAll('.orders-table th').forEach(th => th.classList.remove('column-drop-target', 'column-dragging'));
            draggedColumnKey = null;
        });
    });
}

function openGlobalSearch() {
    closeAllModals();
    const input = document.getElementById('globalSearchInput');
    if (input) input.value = '';
    document.getElementById('globalSearchCount').textContent = '0 results';
    document.getElementById('globalSearchResults').innerHTML = '<div class="global-search-empty"><i class="fa-solid fa-keyboard"></i><strong>Search across the entire portal</strong><span>Enter at least two characters to begin.</span></div>';
    showModal('modalGlobalSearch');
    window.setTimeout(() => input?.focus(), 50);
}

function renderGlobalSearch() {
    const query = document.getElementById('globalSearchInput').value.toLowerCase().trim();
    const results = document.getElementById('globalSearchResults');
    const count = document.getElementById('globalSearchCount');
    if (query.length < 2) {
        count.textContent = '0 results';
        results.innerHTML = '<div class="global-search-empty"><i class="fa-solid fa-keyboard"></i><strong>Search across the entire portal</strong><span>Enter at least two characters to begin.</span></div>';
        return;
    }
    const matches = orders.filter(order => getRecordSearchValues(order).some(value => value && String(value).toLowerCase().includes(query)));
    count.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'}`;
    if (!matches.length) {
        results.innerHTML = '<div class="global-search-empty"><i class="fa-solid fa-magnifying-glass"></i><strong>No matching records</strong><span>Try a PO, Job, BOL, customer, carrier, or document phrase.</span></div>';
        return;
    }
    const groups = new Map();
    matches.forEach(order => {
        const label = getRecordTypeLabel(order);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(order);
    });
    results.innerHTML = Array.from(groups.entries()).map(([label, records]) => `
        <section class="global-search-group">
            <div class="global-search-group-title"><span>${escapeHtml(label)}</span><span>${records.length}</span></div>
            ${records.slice(0, 12).map(order => `
                <button type="button" class="global-search-result" onclick="openGlobalSearchResult('${order.id}')">
                    <span class="global-search-result-reference">${escapeHtml(getRecordReference(order))}</span>
                    <span class="global-search-result-copy"><strong>${escapeHtml(getRecordParty(order))}</strong><span>${escapeHtml(getRecordSearchValues(order).filter(Boolean).slice(0, 4).join(' · '))}</span></span>
                    <span class="badge ${workflowStatusClass(order.status || (isOutboundOrder(order) ? 'Shipped Out' : (isPickupOrder(order) ? 'Picked Up' : 'Ordered')), order)}">${escapeHtml(order.status || getRecordTypeLabel(order))}</span>
                </button>`).join('')}
        </section>`).join('');
}

function openGlobalSearchResult(orderId) {
    closeAllModals();
    viewOrderDetails(orderId);
}

function getRecordActionButtons(order) {
    const buttons = [];
    if (isReceivingOrder(order) && order.status === 'Ordered') {
        buttons.push(`<button class="btn btn-success" onclick="closeAllModals(); openReceiveModal('${order.id}')"><i class="fa-solid fa-check"></i> Receive</button>`);
    } else if (isTrailerOrder(order) && order.status === 'Expected') {
        buttons.push(`<button class="btn btn-success" onclick="changeStatusFromDetails('${order.id}', 'Arrived')"><i class="fa-solid fa-warehouse"></i> Mark Arrived</button>`);
    } else if (isTrailerOrder(order) && order.status === 'Arrived') {
        buttons.push(`<button class="btn btn-success" onclick="changeStatusFromDetails('${order.id}', 'Dispatched')"><i class="fa-solid fa-truck-fast"></i> Mark Dispatched</button>`);
    } else if (isWarrantyOrder(order)) {
        const next = order.status === 'To be Claimed' ? 'Working on it' : (order.status === 'Working on it' ? 'Request Submitted' : '');
        if (next) buttons.push(`<button class="btn btn-success" onclick="changeStatusFromDetails('${order.id}', '${next}')"><i class="fa-solid fa-arrow-right"></i> ${next}</button>`);
        if (order.status === 'Request Submitted') {
            buttons.push(`<button class="btn btn-success" onclick="changeStatusFromDetails('${order.id}', 'Approved')"><i class="fa-solid fa-check"></i> Approve</button>`);
            buttons.push(`<button class="btn btn-danger" onclick="changeStatusFromDetails('${order.id}', 'Denied')"><i class="fa-solid fa-xmark"></i> Deny</button>`);
        }
    } else if (isInspectionOrder(order) && order.status === 'Inspection Request') {
        buttons.push(`<button class="btn btn-success" onclick="openInspectionForStatus('${order.id}', 'Inspected - good to go')"><i class="fa-solid fa-check"></i> Good to Go</button>`);
        buttons.push(`<button class="btn btn-danger" onclick="openInspectionForStatus('${order.id}', 'Inspected - damage found')"><i class="fa-solid fa-triangle-exclamation"></i> Damage Found</button>`);
    }
    if (isTrailerOrder(order) && order.arrived_date) {
        buttons.push(`<button class="btn btn-secondary" onclick="emailTrailerArrival('${order.id}')"><i class="fa-solid fa-envelope"></i> Email</button>`);
    }
    return buttons;
}

function configureDetailDrawer(order) {
    const downloadButton = document.getElementById('btnDownloadAllFromDetails');
    const files = getRecordFiles(order);
    downloadButton.classList.toggle('hidden', files.length === 0);
    downloadButton.onclick = () => downloadAllRecordFiles(order.id);
    const status = order.status || (isOutboundOrder(order) ? 'Shipped Out' : (isPickupOrder(order) ? 'Picked Up' : 'Ordered'));
    const badge = document.getElementById('viewOrderStatusBadge');
    badge.className = `badge ${workflowStatusClass(status, order)}`;
    badge.textContent = status;
    const pdfButton = document.getElementById('btnPdfFromDetails');
    pdfButton.onclick = () => generateOrderPdfReport(order.id);
    const actions = document.getElementById('recordStatusActions');
    actions.innerHTML = '';
}

function getRecordDetailSubtitle(order) {
    if (isTrailerOrder(order)) return `Trip ${order.trip_number || '-'} / Stop ${order.stop_number || '-'}`;
    if (isOutboundOrder(order)) return `${order.customer || '-'} · ${carrierOptionLabel(order.carrier || 'LTL / Other')}`;
    if (isPickupOrder(order)) return `${order.customer_name || '-'} · Picked up ${formatDateTimeDisplay(order.pickup_date)}`;
    if (isWarrantyOrder(order)) return `${order.order_type || '-'} · ${order.claim_type || '-'}`;
    if (isInspectionOrder(order)) return `${order.customer_name || '-'} · ${order.status || '-'}`;
    return `${order.supplier || '-'} · ${carrierOptionLabel(order.carrier || 'LTL / Other')}`;
}

function renderRecordHero(order) {
    const status = order.status || (isOutboundOrder(order) ? 'Shipped Out' : (isPickupOrder(order) ? 'Picked Up' : 'Ordered'));
    const meta = [];
    if (isReceivingOrder(order)) {
        meta.push(['fa-calendar-plus', `Ordered ${formatDateTimeDisplay(order.ordered_date)}`]);
        if (order.eta) meta.push(['fa-calendar-day', `ETA ${order.eta}`]);
        if (order.received_date) meta.push(['fa-circle-check', `Received ${formatDateTimeDisplay(order.received_date)}`]);
    } else if (isTrailerOrder(order)) {
        meta.push(['fa-warehouse', `Arrived ${formatDateTimeDisplay(order.arrived_date)}`]);
        meta.push(['fa-truck-fast', `Dispatched ${formatDateTimeDisplay(order.dispatched_date)}`]);
        if (order.arrived_date && order.dispatched_date) meta.push(['fa-stopwatch', formatElapsedTime(order.arrived_date, order.dispatched_date)]);
    } else if (isOutboundOrder(order)) {
        meta.push(['fa-truck-fast', `Shipped ${formatDateTimeDisplay(order.shipped_date)}`]);
        meta.push(['fa-credit-card', order.payment_type || '-']);
    } else if (isPickupOrder(order)) {
        meta.push(['fa-user-check', `Handled by ${order.handled_by || '-'}`]);
        meta.push(['fa-clock', formatDateTimeDisplay(order.pickup_date)]);
    } else if (isWarrantyOrder(order)) {
        meta.push(['fa-screwdriver-wrench', order.order_type || '-']);
        meta.push(['fa-tag', order.claim_type || '-']);
    } else if (isInspectionOrder(order)) {
        meta.push(['fa-user-pen', `Requested by ${order.requested_by || '-'}`]);
        if (order.inspected_by) meta.push(['fa-user-check', `Inspected by ${order.inspected_by}`]);
    }
    return `
        <section class="record-hero">
            <div class="record-hero-top">
                <div>
                    <span class="record-hero-type">${escapeHtml(getRecordTypeLabel(order))}</span>
                    <h3 class="record-hero-ref">${escapeHtml(getRecordReference(order))}</h3>
                    <div class="record-hero-party">${escapeHtml(getRecordParty(order))}</div>
                </div>
                <span class="badge ${workflowStatusClass(status, order)}">${escapeHtml(status)}</span>
            </div>
            ${meta.length ? `<div class="record-hero-meta">${meta.map(([icon, text]) => `<span class="record-meta-pill"><i class="fa-solid ${icon}"></i>${escapeHtml(text || '-')}</span>`).join('')}</div>` : ''}
        </section>`;
}

function renderDetailSection(title, icon, body, extraClass = '') {
    if (!body) return '';
    return `<section class="record-detail-section ${extraClass}">
        <h4 class="record-section-title"><i class="fa-solid ${icon}"></i>${escapeHtml(title)}</h4>
        ${body}
    </section>`;
}

function renderInfoGrid(fields) {
    return `<div class="record-info-grid">${fields.map(([label, value]) => `
        <div class="record-info-item">
            <span class="record-info-label">${escapeHtml(label)}</span>
            <div class="record-info-value">${value === undefined || value === null || value === '' ? '-' : value}</div>
        </div>`).join('')}</div>`;
}

function renderTextBlock(value, fallback = 'No details logged.') {
    return `<div class="record-text-block">${escapeHtml(value || fallback)}</div>`;
}

function renderActionSection(order) {
    const buttons = getRecordActionButtons(order);
    if (!buttons.length) return '';
    return renderDetailSection('Next action', 'fa-bolt', `<div class="record-action-grid">${buttons.join('')}</div>`);
}

function renderFileTile({ title, count = 0, icon = 'fa-paperclip', view, add, tone = '' }) {
    const hasFiles = count > 0;
    return `<div class="record-file-tile ${hasFiles ? '' : 'empty'} ${tone}">
        <span class="record-file-icon"><i class="fa-solid ${icon}"></i></span>
        <div>
            <span class="record-file-title">${escapeHtml(title)}</span>
            <span class="record-file-count">${hasFiles ? `${count} saved` : 'No files yet'}</span>
        </div>
        <div class="record-file-actions">
            ${hasFiles && view ? `<button class="btn btn-secondary btn-icon" onclick="${view}" title="View"><i class="fa-solid fa-eye"></i></button>` : ''}
            ${add ? `<button class="btn btn-secondary btn-icon" onclick="${add}" title="Add"><i class="fa-solid fa-plus"></i></button>` : ''}
        </div>
    </div>`;
}

function getRecordPhotoFiles(order) {
    if (isWarrantyOrder(order)) return (order.photos || []).map(filename => ({ folder: 'warranty', filename }));
    if (isInspectionOrder(order)) return (order.photos || []).map(filename => ({ folder: 'panel_inspections', filename }));
    if (isPickupOrder(order)) return (order.pickup_photos || []).map(filename => ({ folder: 'customer_pickup', filename }));
    if (isOutboundOrder(order)) return (order.shipped_photos || []).map(filename => ({ folder: 'shipped_out', filename }));
    if (isTrailerOrder(order)) return (order.issue_photos || []).map(filename => ({ folder: 'clopay_issues', filename }));
    const packingImages = getPackingSlipFiles(order).filter(isImageFilename).map(filename => ({ folder: 'scans', filename }));
    const podImages = (order.invoice_filenames || (order.invoice_filename ? [order.invoice_filename] : [])).filter(isImageFilename).map(filename => ({ folder: 'scans', filename }));
    const osdImages = (order.osd_photos || []).map(filename => ({ folder: 'osd', filename }));
    return [...packingImages, ...podImages, ...osdImages];
}

async function renderDetailPhotoPreviewStrip(order) {
    const container = document.querySelector(`[data-detail-previews="${order.id}"]`);
    if (!container) return;
    const photos = getRecordPhotoFiles(order).slice(0, 3);
    if (!photos.length) {
        container.innerHTML = '';
        return;
    }
    const thumbs = await Promise.all(photos.map(async file => {
        const key = `${file.folder}/${file.filename}`;
        try {
            if (!photoPreviewCache.has(key)) {
                const { data, error } = await getSupabaseClient().storage.from(SUPABASE_STORAGE_BUCKET).download(key);
                if (error) throw error;
                photoPreviewCache.set(key, URL.createObjectURL(data));
            }
            return `<img class="record-preview-thumb" src="${photoPreviewCache.get(key)}" alt="Photo preview">`;
        } catch {
            return '';
        }
    }));
    const remaining = getRecordPhotoFiles(order).length - photos.length;
    container.innerHTML = thumbs.join('') + (remaining > 0 ? `<span class="record-meta-pill">+${remaining} more</span>` : '');
}

function renderFilesSection(order) {
    let tiles = [];
    if (isReceivingOrder(order)) {
        const packingSlipFiles = getPackingSlipFiles(order);
        const podFiles = order.invoice_filenames || (order.invoice_filename ? [order.invoice_filename] : []);
        tiles = [
            renderFileTile({ title: 'Attached Files', count: packingSlipFiles.length, icon: 'fa-file-invoice', view: `closeAllModals(); viewFileAttachment('${order.id}', 'packing_slip')`, add: `addFilesDirectly('${order.id}', 'receiving_attached')` })
        ];
        if (order.status === 'Received') {
            tiles.push(renderFileTile({ title: 'POD / Photos', count: podFiles.length, icon: 'fa-file-signature', view: `closeAllModals(); viewFileAttachment('${order.id}', 'pod')`, add: `addFilesDirectly('${order.id}', 'receiving_pod')` }));
        }
        if (order.has_issue) {
            tiles.push(renderFileTile({ title: 'OSD Photos', count: order.osd_photos?.length || 0, icon: 'fa-camera', view: `closeAllModals(); viewOsdPhotos('${order.id}')`, add: `addFilesDirectly('${order.id}', 'receiving_osd')`, tone: 'record-issue-block' }));
        }
    } else if (isTrailerOrder(order)) {
        tiles = [
            renderFileTile({ title: 'Documents', count: order.documents?.length || 0, icon: 'fa-paperclip', view: `closeAllModals(); viewTrailerDocuments('${order.id}')`, add: `addFilesDirectly('${order.id}', 'trailer_docs')` })
        ];
        if (order.has_issue) {
            tiles.push(renderFileTile({ title: 'Issue Photos', count: order.issue_photos?.length || 0, icon: 'fa-camera', view: `closeAllModals(); viewTrailerIssuePhotos('${order.id}')`, add: `addFilesDirectly('${order.id}', 'trailer_issue_photos')`, tone: 'record-issue-block' }));
        }
    } else {
        const isPickup = isPickupOrder(order);
        const isOutbound = isOutboundOrder(order);
        const kind = isPickup ? 'pickup_photos' : isOutbound ? 'outbound_photos' : isWarrantyOrder(order) ? 'warranty_photos' : 'inspection_photos';
        const viewer = isPickup ? 'viewPickupPhotos' : isOutbound ? 'viewOutboundPhotos' : isWarrantyOrder(order) ? 'viewWarrantyPhotos' : 'viewInspectionPhotos';
        const count = isPickup ? (order.pickup_photos?.length || 0) : isOutbound ? (order.shipped_photos?.length || 0) : (order.photos?.length || 0);
        tiles = [renderFileTile({ title: 'Photos', count, icon: 'fa-camera', view: `closeAllModals(); ${viewer}('${order.id}')`, add: `addFilesDirectly('${order.id}', '${kind}')` })];
    }
    return renderDetailSection('Files & photos', 'fa-folder-open', `<div class="record-file-grid">${tiles.join('')}</div><div class="record-preview-strip" data-detail-previews="${order.id}"></div>`);
}

function renderIssueSection(order) {
    if (isReceivingOrder(order) && order.has_issue) return renderDetailSection('Issue reported', 'fa-triangle-exclamation', renderTextBlock(order.notes, 'OSD reported. No details logged.'), 'record-issue-block');
    if (isTrailerOrder(order) && order.has_issue) return renderDetailSection('Issue reported', 'fa-triangle-exclamation', renderTextBlock(order.issue_description, 'Issue reported. No details logged.'), 'record-issue-block');
    if (isInspectionOrder(order) && order.status === 'Inspected - damage found') return renderDetailSection('Damage found', 'fa-triangle-exclamation', renderTextBlock(order.notes, 'Damage found. No details logged.'), 'record-issue-block');
    if (isWarrantyOrder(order) && order.status === 'Denied') return renderDetailSection('Denied reason', 'fa-triangle-exclamation', renderTextBlock(order.denied_reason, 'No denial reason logged.'), 'record-issue-block');
    return '';
}

function getActionTimeFields(order) {
    if (isReceivingOrder(order)) return [
        { key: 'ordered_date', label: 'Ordered', statuses: ['Ordered'] },
        { key: 'received_date', label: 'Received', statuses: ['Received'] }
    ];
    if (isOutboundOrder(order)) return [{ key: 'shipped_date', label: 'Shipped Out', statuses: ['Shipped Out'] }];
    if (isPickupOrder(order)) return [{ key: 'pickup_date', label: 'Customer Pick Up', statuses: ['Picked Up'] }];
    if (isTrailerOrder(order)) return [
        { key: 'created_date', label: 'Created / Expected', statuses: ['Expected'] },
        { key: 'arrived_date', label: 'Arrived', statuses: ['Arrived'] },
        { key: 'dispatched_date', label: 'Dispatched', statuses: ['Dispatched'] }
    ];
    if (isWarrantyOrder(order)) {
        const fields = [
            { key: 'created_date', label: 'Created', statuses: ['To be Claimed'] },
            { key: 'submitted_date', label: 'Request Submitted', statuses: ['Request Submitted'] }
        ];
        if (order.status === 'Approved' || order.approved_date) fields.push({ key: 'approved_date', label: 'Approved', statuses: ['Approved'] });
        if (order.status === 'Denied' || order.denied_date) fields.push({ key: 'denied_date', label: 'Denied', statuses: ['Denied'] });
        return fields;
    }
    if (isInspectionOrder(order)) return [
        { key: 'created_date', label: 'Created / Requested', statuses: ['Inspection Request'] },
        { key: 'inspected_date', label: 'Inspected', statuses: ['Inspected - good to go', 'Inspected - damage found'] }
    ];
    return [];
}

function renderEmbeddedActionTimes(form, order) {
    form?.querySelector('.edit-action-times')?.remove();
    if (!form || !order) return;
    const fields = getActionTimeFields(order).filter(field => !(form.id === 'orderForm' && field.key === 'ordered_date'));
    if (!fields.length) return;
    const container = form.querySelector('.form-grid');
    if (!container) return;
    const section = document.createElement('fieldset');
    section.className = 'edit-action-times col-span-2';
    section.dataset.orderId = String(order.id);
    section.innerHTML = `
        <legend><i class="fa-regular fa-clock"></i> Action Times</legend>
        <p>Correct saved action times here. Timeline and Status Log will update when this record is saved.</p>
        <div class="timestamp-fields">${fields.map(field => `
            <div class="timestamp-field">
                <label for="timestamp_${order.id}_${field.key}">${escapeHtml(field.label)}</label>
                <input type="datetime-local" id="timestamp_${order.id}_${field.key}" data-time-key="${field.key}" data-time-statuses="${field.statuses.join('|')}" value="${escapeHtml(order[field.key] || '')}">
            </div>`).join('')}</div>`;
    container.appendChild(section);
}

function applyEmbeddedActionTimes(order) {
    const section = document.querySelector(`.edit-action-times[data-order-id="${order.id}"]`);
    if (!section) return;
    section.querySelectorAll('[data-time-key]').forEach(input => {
        const key = input.dataset.timeKey;
        const statuses = (input.dataset.timeStatuses || '').split('|').filter(Boolean);
        let value = input.value || null;
        if (key === 'received_date' && order.status !== 'Received') value = null;
        if (key === 'inspected_date' && order.status === 'Inspection Request') value = null;
        if (key === 'approved_date' && order.status !== 'Approved') value = null;
        if (key === 'denied_date' && order.status !== 'Denied') value = null;
        order[key] = value;
        if (Array.isArray(order.status_history)) {
            order.status_history.forEach(entry => {
                if (statuses.includes(entry.status)) entry.date = value;
            });
        }
    });
}

async function changeStatusFromDetails(orderId, status) {
    const order = orders.find(item => item.id == orderId);
    if (!order) return;
    if (isTrailerOrder(order)) await quickSetTrailerStatus(orderId, status);
    else if (isWarrantyOrder(order)) await quickSetWarrantyStatus(orderId, status);
    const updated = orders.find(item => item.id == orderId);
    if (updated && !document.getElementById('modalViewOrderDetails').classList.contains('hidden')) viewOrderDetails(orderId);
}

function openInspectionForStatus(orderId, status) {
    closeAllModals();
    openInspectionModal(orderId);
    document.getElementById('inspectionStatus').value = status;
    toggleInspectionFields();
    showToast('Complete inspection', 'Select the inspector and add the required photos.', 'info');
}

async function downloadAllRecordFiles(orderId) {
    const order = orders.find(item => item.id == orderId);
    if (!order) return;
    const files = getRecordFiles(order);
    if (!files.length) {
        showToast('No attachments', 'This record does not contain downloadable files.', 'info');
        return;
    }
    if (!window.JSZip) {
        showToast('Download unavailable', 'The ZIP library did not load. Refresh and try again.', 'error');
        return;
    }
    const button = document.getElementById('btnDownloadAllFromDetails');
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing ZIP';
    showToast('Preparing download', `${files.length} file${files.length === 1 ? '' : 's'} will be packaged.`, 'info');
    try {
        const zip = new window.JSZip();
        let downloaded = 0;
        for (const file of files) {
            const { data, error } = await getSupabaseClient().storage.from(SUPABASE_STORAGE_BUCKET).download(`${file.folder}/${file.filename}`);
            if (error) {
                console.warn(`Could not download ${file.filename}:`, error);
                continue;
            }
            const safeName = (file.downloadName || file.filename).replace(/[\\/:*?"<>|]/g, '_');
            zip.file(`${String(downloaded + 1).padStart(2, '0')}_${safeName}`, data);
            downloaded++;
        }
        if (!downloaded) throw new Error('No files could be downloaded.');
        const archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        const url = URL.createObjectURL(archive);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${getRecordReference(order).replace(/[^a-zA-Z0-9_-]/g, '_')}_attachments.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Download started', `${downloaded} file${downloaded === 1 ? '' : 's'} saved as one ZIP archive.`);
    } catch (err) {
        console.error('Bulk download failed:', err);
        showToast('Download failed', 'One or more files could not be prepared.', 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-file-zipper"></i> Download All';
    }
}

function openHelpCenter() {
    closeAllModals();
    const search = document.getElementById('helpSearch');
    const content = document.getElementById('helpContent');
    if (search) search.value = '';
    document.querySelectorAll('.help-section').forEach(section => section.classList.remove('hidden'));
    document.querySelectorAll('.help-nav-btn').forEach((button, index) => button.classList.toggle('active', index === 0));
    document.getElementById('helpNoResults')?.classList.add('hidden');
    if (content) content.scrollTop = 0;
    showModal('modalHelp');
}

function setupHelpCenter() {
    document.getElementById('btnHelp')?.addEventListener('click', openHelpCenter);
    const content = document.getElementById('helpContent');
    const navigationButtons = Array.from(document.querySelectorAll('.help-nav-btn'));
    navigationButtons.forEach(button => {
        button.addEventListener('click', () => {
            const target = document.getElementById(button.dataset.helpTarget);
            if (!target || !content) return;
            navigationButtons.forEach(item => item.classList.toggle('active', item === button));
            const contentTop = content.getBoundingClientRect().top;
            const targetTop = target.getBoundingClientRect().top;
            content.scrollTo({ top: Math.max(0, content.scrollTop + targetTop - contentTop), behavior: 'smooth' });
        });
    });

    content?.addEventListener('scroll', () => {
        if (document.getElementById('helpSearch')?.value.trim()) return;
        const sections = Array.from(document.querySelectorAll('.help-section'));
        const current = sections.reduce((best, section) => section.offsetTop <= content.scrollTop + 80 ? section : best, sections[0]);
        navigationButtons.forEach(button => button.classList.toggle('active', button.dataset.helpTarget === current?.id));
    });

    document.getElementById('helpSearch')?.addEventListener('input', event => {
        const query = event.target.value.toLowerCase().trim();
        let visibleCount = 0;
        document.querySelectorAll('.help-section').forEach(section => {
            const searchableText = `${section.dataset.helpTitle || ''} ${section.textContent}`.toLowerCase();
            const visible = !query || searchableText.includes(query);
            section.classList.toggle('hidden', !visible);
            if (visible) visibleCount++;
        });
        navigationButtons.forEach(button => {
            const target = document.getElementById(button.dataset.helpTarget);
            button.classList.toggle('hidden', Boolean(query) && target?.classList.contains('hidden'));
            button.classList.remove('active');
        });
        const firstVisibleButton = navigationButtons.find(button => !button.classList.contains('hidden'));
        firstVisibleButton?.classList.add('active');
        document.getElementById('helpNoResults')?.classList.toggle('hidden', visibleCount > 0);
        if (content) content.scrollTop = 0;
    });
}

// Event Listeners setup
function setupEventListeners() {
    setupHelpCenter();
    document.getElementById('btnGlobalSearch')?.addEventListener('click', openGlobalSearch);
    document.getElementById('btnTaskCenter')?.addEventListener('click', openTaskCenter);
    document.getElementById('btnMobileTasks')?.addEventListener('click', () => {
        document.getElementById('mobileMorePanel')?.classList.add('hidden');
        openTaskCenter();
    });
    document.getElementById('btnEmptyClearFilters')?.addEventListener('click', () => clearActiveFilter('all'));
    document.getElementById('btnEmptyCreate')?.addEventListener('click', createRecordForCurrentTab);
    document.getElementById('btnMobileCreate')?.addEventListener('click', triggerMobileCreate);
    document.getElementById('btnMobileMore')?.addEventListener('click', () => document.getElementById('mobileMorePanel')?.classList.toggle('hidden'));
    document.getElementById('btnMobileHeaderMore')?.addEventListener('click', () => document.getElementById('mobileMorePanel')?.classList.toggle('hidden'));
    document.getElementById('btnMobileFilters')?.addEventListener('click', event => {
        const controls = document.querySelector('.controls-card');
        const isOpen = controls?.classList.toggle('mobile-filters-open') || false;
        event.currentTarget.setAttribute('aria-expanded', String(isOpen));
    });
    document.getElementById('btnMobileDashboard')?.addEventListener('click', () => {
        document.getElementById('mobileMorePanel')?.classList.add('hidden');
        openOperationsDashboard();
    });
    document.getElementById('btnMobileTheme')?.addEventListener('click', () => {
        document.getElementById('mobileMorePanel')?.classList.add('hidden');
        document.getElementById('btnThemeToggle')?.click();
    });
    document.getElementById('btnMobileHelp')?.addEventListener('click', () => {
        document.getElementById('mobileMorePanel')?.classList.add('hidden');
        openHelpCenter();
    });
    document.getElementById('btnMobileAdmin')?.addEventListener('click', () => {
        document.getElementById('mobileMorePanel')?.classList.add('hidden');
        openAdminAuthModal();
    });
    document.querySelectorAll('[data-mobile-tab]').forEach(button => button.addEventListener('click', () => {
        document.getElementById('mobileMorePanel')?.classList.add('hidden');
        setDashboardTab(button.dataset.mobileTab);
    }));
    document.addEventListener('mouseover', event => {
        const trigger = event.target.closest('.photo-preview-trigger');
        if (trigger && !trigger.contains(event.relatedTarget)) showPhotoHoverPreview(trigger);
    });
    document.addEventListener('mouseout', event => {
        const trigger = event.target.closest('.photo-preview-trigger');
        if (trigger && !trigger.contains(event.relatedTarget)) hidePhotoHoverPreview();
    });
    document.getElementById('globalSearchInput')?.addEventListener('input', renderGlobalSearch);
    document.getElementById('mobileTabSelect')?.addEventListener('change', event => setDashboardTab(event.target.value));
    document.getElementById('tabReceiving')?.addEventListener('click', () => setDashboardTab('receiving'));
    document.getElementById('tabShippedOut')?.addEventListener('click', () => setDashboardTab('outbound'));
    document.getElementById('tabCustomerPickup')?.addEventListener('click', () => setDashboardTab('pickup'));
    document.getElementById('tabClopayTrailers')?.addEventListener('click', () => setDashboardTab('trailers'));
    document.getElementById('tabWarranty')?.addEventListener('click', () => setDashboardTab('warranty'));
    document.getElementById('tabPanelInspections')?.addEventListener('click', () => setDashboardTab('inspections'));
    
    // New Order Modal
    document.getElementById('btnNewOrder').addEventListener('click', () => {
        openOrderModal();
    });
    document.getElementById('btnNewOutbound')?.addEventListener('click', () => {
        openOutboundModal();
    });
    document.getElementById('btnNewPickup')?.addEventListener('click', () => {
        openPickupModal();
    });
    document.getElementById('btnNewTrailer')?.addEventListener('click', () => {
        openTrailerModal();
    });
    document.getElementById('btnNewWarranty')?.addEventListener('click', () => openWarrantyModal());
    document.getElementById('btnNewInspection')?.addEventListener('click', () => openInspectionModal());
    document.getElementById('btnDashboard')?.addEventListener('click', openOperationsDashboard);
    document.querySelectorAll('.dashboard-period-btn').forEach(button => {
        button.addEventListener('click', () => {
            currentDashboardPeriod = button.dataset.period;
            document.querySelectorAll('.dashboard-period-btn').forEach(item => item.classList.toggle('active', item === button));
            renderOperationsDashboard();
        });
    });
    
    // Manual sync button
    document.getElementById('btnRefresh').addEventListener('click', syncDatabase);
    
    // Search & Filter changes
    document.getElementById('searchInput').addEventListener('input', renderDashboard);
    document.getElementById('filterStatus').addEventListener('change', renderDashboard);
    document.getElementById('filterCarrier').addEventListener('change', renderDashboard);
    
    // Order form submit
    document.getElementById('orderForm').addEventListener('submit', handleOrderSubmit);
    document.getElementById('outboundForm')?.addEventListener('submit', handleOutboundSubmit);
    document.getElementById('pickupForm')?.addEventListener('submit', handlePickupSubmit);
    document.getElementById('trailerForm')?.addEventListener('submit', handleTrailerSubmit);
    document.getElementById('warrantyForm')?.addEventListener('submit', handleWarrantySubmit);
    document.getElementById('inspectionForm')?.addEventListener('submit', handleInspectionSubmit);
    document.getElementById('trailerStatus')?.addEventListener('change', updateTrailerEmailButton);
    document.getElementById('trailerIssueCheck')?.addEventListener('change', toggleTrailerIssueFields);
    document.getElementById('btnTrailerEmail')?.addEventListener('click', () => {
        const id = document.getElementById('trailerId').value;
        if (id) emailTrailerArrival(id);
    });
    document.getElementById('warrantyStatus')?.addEventListener('change', toggleWarrantyFields);
    document.getElementById('inspectionStatus')?.addEventListener('change', toggleInspectionFields);

    const configureWorkflowPhotos = (prefix, setSelection) => {
        const zone = document.getElementById(`${prefix}PhotoDropZone`);
        const input = document.getElementById(`${prefix}PhotoUpload`);
        const remove = document.getElementById(`btnRemove${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Photos`);
        if (!zone || !input) return;
        const acceptFiles = files => {
            const images = Array.from(files || []).filter(file => file.type.startsWith('image/'));
            setSelection(images);
            updateWorkflowPhotoVisual(prefix, images, 0);
        };
        zone.addEventListener('click', () => input.click());
        input.addEventListener('change', () => acceptFiles(input.files));
        zone.addEventListener('dragover', event => {
            event.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', event => {
            event.preventDefault();
            zone.classList.remove('drag-over');
            acceptFiles(event.dataTransfer.files);
        });
        remove?.addEventListener('click', () => {
            setSelection('deleted');
            input.value = '';
            updateWorkflowPhotoVisual(prefix, [], 0);
        });
    };
    configureWorkflowPhotos('warranty', value => { selectedWarrantyPhotos = value; });
    configureWorkflowPhotos('inspection', value => { selectedInspectionPhotos = value; });
    
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
    document.getElementById('modalViewOrderDetails')?.addEventListener('click', event => {
        if (event.target === event.currentTarget && window.matchMedia('(min-width: 769px)').matches) closeAllModals();
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
    document.getElementById('btnDownloadInvoice').addEventListener('click', downloadCurrentGalleryFile);
    document.getElementById('btnAnnotateGalleryPhoto')?.addEventListener('click', annotateCurrentGalleryPhoto);
    window.addEventListener('keydown', handleGalleryKeydown);
    
    setupSortableHeaders();

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

// Modal open/close actions
function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.add('hidden');
    });
    unlockPageScroll();
    
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

function lockPageScroll() {
    if (modalLockDepth === 0) {
        document.body.classList.add('modal-open');
    }
    modalLockDepth++;
}

function unlockPageScroll() {
    modalLockDepth = 0;
    document.body.classList.remove('modal-open');
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    lockPageScroll();
}

function openOrderModal(orderToEdit = null) {
    closeAllModals();
    const form = document.getElementById('orderForm');
    form.reset();
    
    selectedPackingSlipFile = [];
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
        document.getElementById('formETA').value = orderToEdit.eta || '';
        document.getElementById('formCarrier').value = orderToEdit.carrier || '';
        document.getElementById('formTracking').value = orderToEdit.tracking_number || '';
        document.getElementById('formStatus').value = orderToEdit.status === 'In Transit' ? 'Ordered' : orderToEdit.status;
        document.getElementById('formNotes').value = orderToEdit.notes || '';
        document.getElementById('formClassification').value = orderToEdit.classification || '';
        
        const selectStatus = document.getElementById('orderFileSelectionStatus');
        const dropZone = document.getElementById('orderDropZone');
        const textEl = document.getElementById('orderSelectedFileName');
        const packingSlipFiles = getPackingSlipFiles(orderToEdit);
        if (packingSlipFiles.length) {
            textEl.textContent = `Attached: ${packingSlipFiles.length} file${packingSlipFiles.length > 1 ? 's' : ''}`;
            dropZone.classList.remove('hidden');
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
    
    renderEmbeddedActionTimes(form, orderToEdit);
    showModal('modalOrder');
}

function resetPackingSlipVisuals() {
    const dropZone = document.getElementById('orderDropZone');
    const statusEl = document.getElementById('orderFileSelectionStatus');
    const textEl = document.getElementById('orderSelectedFileName');
    if (dropZone && statusEl) {
        dropZone.classList.remove('hidden');
        statusEl.classList.add('hidden');
        textEl.textContent = 'No files selected';
    }
}

function resetOutboundPhotoVisuals() {
    const dropZone = document.getElementById('outboundPhotoDropZone');
    const statusEl = document.getElementById('outboundPhotoSelectionStatus');
    const textEl = document.getElementById('outboundSelectedPhotosName');
    if (dropZone && statusEl) {
        dropZone.classList.remove('hidden');
        statusEl.classList.add('hidden');
        textEl.textContent = 'No files selected';
    }
}

function resetPickupPhotoVisuals() {
    const dropZone = document.getElementById('pickupPhotoDropZone');
    const statusEl = document.getElementById('pickupPhotoSelectionStatus');
    const textEl = document.getElementById('pickupSelectedPhotosName');
    if (dropZone && statusEl) {
        dropZone.classList.remove('hidden');
        statusEl.classList.add('hidden');
        textEl.textContent = 'No files selected';
    }
}

function openOutboundModal(orderId = null) {
    closeAllModals();
    const form = document.getElementById('outboundForm');
    if (!form) return;
    
    form.reset();
    selectedOutboundPhotoFiles = [];
    resetOutboundPhotoVisuals();
    
    const outbound = orderId ? orders.find(o => o.id == orderId && isOutboundOrder(o)) : null;
    document.getElementById('modalOutboundTitle').textContent = outbound ? 'Edit Shipped Out Record' : 'Create Shipped Out Record';
    document.getElementById('outboundId').value = outbound ? outbound.id : '';
    
    if (outbound) {
        document.getElementById('outboundCustomer').value = outbound.customer || '';
        document.getElementById('outboundJobNumber').value = outbound.job_number || '';
        document.getElementById('outboundCarrier').value = outbound.carrier || '';
        document.getElementById('outboundPaymentType').value = outbound.payment_type || '';
        document.getElementById('outboundAddress').value = outbound.ship_to_address || '';
        document.getElementById('outboundNotes').value = outbound.notes || '';
        
        if (outbound.shipped_photos && outbound.shipped_photos.length > 0) {
            document.getElementById('outboundSelectedPhotosName').textContent = `Attached: ${outbound.shipped_photos.length} photo${outbound.shipped_photos.length > 1 ? 's' : ''}`;
            document.getElementById('outboundPhotoDropZone').classList.remove('hidden');
            document.getElementById('outboundPhotoSelectionStatus').classList.remove('hidden');
        }
    }
    
    renderEmbeddedActionTimes(form, outbound);
    showModal('modalOutbound');
}

function openPickupModal(orderId = null) {
    closeAllModals();
    const form = document.getElementById('pickupForm');
    if (!form) return;

    form.reset();
    selectedPickupPhotoFiles = [];
    resetPickupPhotoVisuals();

    const pickup = orderId ? orders.find(o => o.id == orderId && isPickupOrder(o)) : null;
    document.getElementById('modalPickupTitle').textContent = pickup ? 'Edit Customer Pick Up Record' : 'Create Customer Pick Up Record';
    document.getElementById('pickupId').value = pickup ? pickup.id : '';

    if (pickup) {
        document.getElementById('pickupCustomer').value = pickup.customer_name || '';
        document.getElementById('pickupJobNumber').value = pickup.job_number || '';
        document.getElementById('pickupHandledBy').value = pickup.handled_by || '';
        document.getElementById('pickupNotes').value = pickup.notes || '';

        if (pickup.pickup_photos && pickup.pickup_photos.length > 0) {
            document.getElementById('pickupSelectedPhotosName').textContent = `Attached: ${pickup.pickup_photos.length} photo${pickup.pickup_photos.length > 1 ? 's' : ''}`;
            document.getElementById('pickupPhotoDropZone').classList.remove('hidden');
            document.getElementById('pickupPhotoSelectionStatus').classList.remove('hidden');
        }
    }

    renderEmbeddedActionTimes(form, pickup);
    showModal('modalPickup');
}

function resetTrailerUploadVisuals() {
    [
        ['trailerDocsDropZone', 'trailerDocsSelectionStatus', 'trailerSelectedDocsName'],
        ['trailerIssuePhotoDropZone', 'trailerIssuePhotoSelectionStatus', 'trailerSelectedIssuePhotosName']
    ].forEach(([zoneId, statusId, textId]) => {
        document.getElementById(zoneId)?.classList.remove('hidden');
        document.getElementById(statusId)?.classList.add('hidden');
        const text = document.getElementById(textId);
        if (text) text.textContent = 'No files selected';
    });
    const thumbnails = document.getElementById('trailerIssueThumbnailsContainer');
    if (thumbnails) thumbnails.innerHTML = '';
}

function toggleTrailerIssueFields() {
    const checked = document.getElementById('trailerIssueCheck').checked;
    document.getElementById('trailerIssueFields').classList.toggle('hidden', !checked);
    document.getElementById('trailerIssueDescription').required = checked;
}

function updateTrailerEmailButton() {
    const hasSavedRecord = Boolean(document.getElementById('trailerId').value);
    const arrived = document.getElementById('trailerStatus').value === 'Arrived';
    document.getElementById('btnTrailerEmail').classList.toggle('hidden', !(hasSavedRecord && arrived));
}

function openTrailerModal(orderId = null) {
    closeAllModals();
    const form = document.getElementById('trailerForm');
    form.reset();
    selectedTrailerDocs = [];
    selectedTrailerIssuePhotos = [];
    resetTrailerUploadVisuals();

    const trailer = orderId ? orders.find(order => order.id == orderId && isTrailerOrder(order)) : null;
    document.getElementById('modalTrailerTitle').textContent = trailer ? 'Edit Trailer' : 'Add Trailer';
    document.getElementById('trailerId').value = trailer ? trailer.id : '';

    if (trailer) {
        document.getElementById('trailerTripNumber').value = trailer.trip_number || '';
        document.getElementById('trailerBolNumber').value = trailer.bol_number || '';
        document.getElementById('trailerStopNumber').value = trailer.stop_number || '';
        document.getElementById('trailerStatus').value = trailer.status || 'Expected';
        document.getElementById('trailerWeight').value = trailer.weight || '';
        document.getElementById('trailerNumber').value = trailer.trailer_number || '';
        document.getElementById('trailerIssueCheck').checked = Boolean(trailer.has_issue);
        document.getElementById('trailerIssueDescription').value = trailer.issue_description || '';

        if (trailer.documents?.length) {
            document.getElementById('trailerDocsDropZone').classList.remove('hidden');
            document.getElementById('trailerDocsSelectionStatus').classList.remove('hidden');
            document.getElementById('trailerSelectedDocsName').textContent = `Attached: ${trailer.documents.length} document${trailer.documents.length > 1 ? 's' : ''}`;
        }
        if (trailer.issue_photos?.length) {
            document.getElementById('trailerIssuePhotoDropZone').classList.remove('hidden');
            document.getElementById('trailerIssuePhotoSelectionStatus').classList.remove('hidden');
            document.getElementById('trailerSelectedIssuePhotosName').textContent = `Attached: ${trailer.issue_photos.length} photo${trailer.issue_photos.length > 1 ? 's' : ''}`;
        }
    }

    document.getElementById('trailerArrivedDisplay').textContent = formatDateTimeDisplay(trailer?.arrived_date);
    document.getElementById('trailerDispatchedDisplay').textContent = formatDateTimeDisplay(trailer?.dispatched_date);
    toggleTrailerIssueFields();
    updateTrailerEmailButton();
    renderEmbeddedActionTimes(form, trailer);
    showModal('modalTrailer');
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
    
    // Restore issue state for existing received records so more OSD photos can be added.
    const hasExistingIssue = Boolean(order.has_issue);
    document.getElementById('receiveIssueCheck').checked = hasExistingIssue;
    document.getElementById('receiveNotes').value = order.notes || '';
    document.getElementById('carrierInstructionsBox').classList.add('hidden');
    
    // Set default employee to "Maksym" if available
    const receiveBySelect = document.getElementById('receiveBy');
    if (receiveBySelect) {
        const optionExists = Array.from(receiveBySelect.options).some(opt => opt.value === 'Maksym');
        if (optionExists) {
            receiveBySelect.value = 'Maksym';
        }
    }
    
    // Set default receive date to saved value or today (date and time)
    document.getElementById('receiveDate').value = order.received_date || getLocalDateTimeString();
    if (order.received_by && receiveBySelect) receiveBySelect.value = order.received_by;
    if (hasExistingIssue) {
        if (osdGroup) osdGroup.classList.remove('hidden');
        toggleCarrierInstructions(true);
    }
    
    showModal('modalReceive');
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

    if (isOutboundOrder(order) || isPickupOrder(order) || isTrailerOrder(order)) {
        alert('Completed handoff and trailer records can only be deleted from Admin Settings.');
        return;
    }
    
    if (order.status === 'Received') {
        alert('Error: Received orders cannot be deleted by regular users.');
        return;
    }
    
    const label = isOutboundOrder(order) ? `shipped out record for ${order.customer}` : `PO Number: ${order.po_number}`;
    if (confirm(`Are you sure you want to delete ${label}?`)) {
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
    const eta = document.getElementById('formETA').value;
    const carrier = document.getElementById('formCarrier').value;
    const tracking = document.getElementById('formTracking').value.trim();
    const status = document.getElementById('formStatus').value;
    const notes = document.getElementById('formNotes').value.trim();
    const classification = document.getElementById('formClassification').value;
    
    // Check if PO exists in database (only for new orders)
    if (!document.getElementById('orderId').value) {
        const normalizedPO = po.toLowerCase();
        const isDuplicate = orders.some(order =>
            isReceivingOrder(order) &&
            typeof order.po_number === 'string' &&
            order.po_number.toLowerCase() === normalizedPO
        );
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
        packing_slip_filenames: [],
        osd_photos: []
    };
    
    order.po_number = po;
    order.supplier = supplier;
    order.item_description = desc;
    order.ordered_by = orderedBy;
    order.ordered_date = orderedDate;
    order.eta = eta;
    order.carrier = carrier;
    order.tracking_number = tracking;
    order.status = status;
    order.notes = notes;
    order.classification = classification;
    
    let packingSlipFilenames = getPackingSlipFiles(order);
    if (selectedPackingSlipFile === 'deleted') {
        packingSlipFilenames = [];
    } else if (Array.isArray(selectedPackingSlipFile) && selectedPackingSlipFile.length > 0) {
        try {
            const poSafe = po.replace(/[^a-zA-Z0-9_-]/g, '_');
            const uploadedSlips = [];
            for (let i = 0; i < selectedPackingSlipFile.length; i++) {
                const file = selectedPackingSlipFile[i];
                const ext = file.name.split('.').pop();
                const packingSlipFilename = `slip_${poSafe}_${Date.now()}_${i}.${ext}`;
                await uploadStorageFile('scans', packingSlipFilename, file);
                uploadedSlips.push(packingSlipFilename);
            }
            packingSlipFilenames = [...packingSlipFilenames, ...uploadedSlips];
        } catch (err) {
            console.error('Error saving packing slip file:', err);
            alert('Failed to upload packing slip file. Order will not be saved.');
            return;
        }
    }
    order.packing_slip_filenames = packingSlipFilenames;
    order.packing_slip_filename = packingSlipFilenames[0] || null;
    
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

async function handleOutboundSubmit(e) {
    e.preventDefault();
    if (!supabaseClient) return;
    
    const editId = document.getElementById('outboundId').value;
    const id = editId || Date.now();
    const customer = document.getElementById('outboundCustomer').value.trim();
    const jobNumber = document.getElementById('outboundJobNumber').value.trim();
    const carrier = document.getElementById('outboundCarrier').value;
    const paymentType = document.getElementById('outboundPaymentType').value;
    const address = document.getElementById('outboundAddress').value.trim();
    const notes = document.getElementById('outboundNotes').value.trim();
    
    const existingOutbound = orders.find(o => o.id == id && isOutboundOrder(o));
    if (editId && !existingOutbound) {
        alert('This Shipped Out record could not be found. Refresh the page and try again.');
        return;
    }
    let outbound = existingOutbound || {
        id: Number(id),
        record_type: 'outbound',
        shipped_date: getLocalDateTimeString(),
        shipped_photos: []
    };
    
    let shippedPhotos = outbound.shipped_photos || [];
    if (selectedOutboundPhotoFiles === 'deleted') {
        shippedPhotos = [];
    } else if (Array.isArray(selectedOutboundPhotoFiles) && selectedOutboundPhotoFiles.length > 0) {
        try {
            const uploadedPhotos = [];
            const customerSafe = customer.replace(/[^a-zA-Z0-9_-]/g, '_');
            for (const file of selectedOutboundPhotoFiles) {
                const ext = file.name.split('.').pop();
                const photoFilename = `shipped_${customerSafe}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
                await uploadStorageFile('shipped_out', photoFilename, file);
                uploadedPhotos.push(photoFilename);
            }
            shippedPhotos = [...shippedPhotos, ...uploadedPhotos];
        } catch (err) {
            console.error('Error uploading shipped out photos:', err);
            alert('Failed to upload shipped out photos. Record will not be saved.');
            return;
        }
    }
    
    outbound.customer = customer;
    outbound.job_number = jobNumber;
    outbound.carrier = carrier;
    outbound.payment_type = paymentType;
    outbound.ship_to_address = address;
    outbound.notes = notes;
    outbound.shipped_photos = shippedPhotos;
    
    try {
        await saveOrderRecord(outbound);
        closeAllModals();
        currentDashboardTab = 'outbound';
        await syncDatabase();
    } catch (err) {
        console.error('Error saving shipped out record:', err);
        alert('Failed to save shipped out record. Please check Supabase permissions.');
    }
}

async function handlePickupSubmit(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const editId = document.getElementById('pickupId').value;
    const id = editId || Date.now();
    const customerName = document.getElementById('pickupCustomer').value.trim();
    const jobNumber = document.getElementById('pickupJobNumber').value.trim();
    const handledBy = document.getElementById('pickupHandledBy').value;
    const notes = document.getElementById('pickupNotes').value.trim();

    const existingPickup = orders.find(o => o.id == id && isPickupOrder(o));
    if (editId && !existingPickup) {
        alert('This Customer Pick Up record could not be found. Refresh the page and try again.');
        return;
    }
    let pickup = existingPickup || {
        id: Number(id),
        record_type: 'customer_pickup',
        pickup_date: getLocalDateTimeString(),
        pickup_photos: []
    };

    let pickupPhotos = pickup.pickup_photos || [];
    if (selectedPickupPhotoFiles === 'deleted') {
        pickupPhotos = [];
    } else if (Array.isArray(selectedPickupPhotoFiles) && selectedPickupPhotoFiles.length > 0) {
        try {
            const uploadedPhotos = [];
            const jobSafe = jobNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
            for (const file of selectedPickupPhotoFiles) {
                const ext = file.name.split('.').pop();
                const photoFilename = `pickup_${jobSafe}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
                await uploadStorageFile('customer_pickup', photoFilename, file);
                uploadedPhotos.push(photoFilename);
            }
            pickupPhotos = [...pickupPhotos, ...uploadedPhotos];
        } catch (err) {
            console.error('Error uploading customer pick up photos:', err);
            alert('Failed to upload pick up photos. Record will not be saved.');
            return;
        }
    }

    if (pickupPhotos.length === 0) {
        alert('At least one pick up photo is required.');
        return;
    }

    pickup.customer_name = customerName;
    pickup.job_number = jobNumber;
    pickup.handled_by = handledBy;
    pickup.notes = notes;
    pickup.pickup_photos = pickupPhotos;

    try {
        await saveOrderRecord(pickup);
        closeAllModals();
        currentDashboardTab = 'pickup';
        await syncDatabase();
    } catch (err) {
        console.error('Error saving customer pick up record:', err);
        alert('Failed to save customer pick up record. Please check Supabase permissions.');
    }
}

function updateWorkflowPhotoVisual(prefix, selection, existingCount = 0) {
    const zone = document.getElementById(`${prefix}PhotoDropZone`);
    const status = document.getElementById(`${prefix}PhotoSelectionStatus`);
    const label = document.getElementById(`${prefix}SelectedPhotosName`);
    const count = Array.isArray(selection) ? selection.length : existingCount;
    if (!zone || !status || !label) return;
    if (count > 0) {
        zone.classList.toggle('hidden', Array.isArray(selection));
        status.classList.remove('hidden');
        label.textContent = Array.isArray(selection) ? `${count} new photo${count > 1 ? 's' : ''} selected` : `Attached: ${count} photo${count > 1 ? 's' : ''}`;
    } else {
        zone.classList.remove('hidden');
        status.classList.add('hidden');
        label.textContent = 'No files selected';
    }
}

function toggleWarrantyFields() {
    const status = document.getElementById('warrantyStatus').value;
    const needsProgress = status !== 'To be Claimed';
    document.getElementById('warrantyProgressFields').classList.toggle('hidden', !needsProgress);
    document.getElementById('warrantyApprovedField').classList.toggle('hidden', status !== 'Approved');
    document.getElementById('warrantyDeniedField').classList.toggle('hidden', status !== 'Denied');
    ['warrantyOriginalOrderId', 'warrantyCustomerName', 'warrantyNotes'].forEach(id => {
        document.getElementById(id).required = needsProgress;
    });
    document.getElementById('warrantyApprovedId').required = status === 'Approved';
    document.getElementById('warrantyDeniedReason').required = status === 'Denied';
}

function openWarrantyModal(orderId = null) {
    closeAllModals();
    const form = document.getElementById('warrantyForm');
    form.reset();
    selectedWarrantyPhotos = [];
    updateWorkflowPhotoVisual('warranty', [], 0);
    const claim = orderId ? orders.find(order => order.id == orderId && isWarrantyOrder(order)) : null;
    document.getElementById('modalWarrantyTitle').textContent = claim ? 'Edit Warranty Claim' : 'Create Warranty Claim';
    document.getElementById('warrantyId').value = claim?.id || '';
    if (claim) {
        document.getElementById('warrantyJobNumber').value = claim.job_number || '';
        document.getElementById('warrantyReportedIssue').value = claim.reported_issue || '';
        document.getElementById('warrantyOrderType').value = claim.order_type || 'Install';
        document.getElementById('warrantyClaimType').value = claim.claim_type || 'Damage/Defect';
        document.getElementById('warrantyStatus').value = claim.status || 'To be Claimed';
        document.getElementById('warrantyOriginalOrderId').value = claim.original_order_id || '';
        document.getElementById('warrantyCustomerName').value = claim.customer_name || '';
        document.getElementById('warrantyNotes').value = claim.warranty_notes || '';
        document.getElementById('warrantyApprovedId').value = claim.approved_id || '';
        document.getElementById('warrantyDeniedReason').value = claim.denied_reason || '';
        updateWorkflowPhotoVisual('warranty', null, claim.photos?.length || 0);
    }
    toggleWarrantyFields();
    renderEmbeddedActionTimes(form, claim);
    showModal('modalWarranty');
}

async function handleWarrantySubmit(e) {
    e.preventDefault();
    if (!supabaseClient) return;
    const editId = document.getElementById('warrantyId').value;
    const id = editId || Date.now();
    const existing = orders.find(order => order.id == id && isWarrantyOrder(order));
    if (editId && !existing) {
        alert('This warranty claim could not be found. Refresh the page and try again.');
        return;
    }
    const claim = existing || { id: Number(id), record_type: 'warranty_claim', created_date: getLocalDateTimeString(), photos: [] };
    const previousStatus = claim.status || 'To be Claimed';
    let photos = claim.photos || [];
    if (selectedWarrantyPhotos === 'deleted') photos = [];
    else if (Array.isArray(selectedWarrantyPhotos) && selectedWarrantyPhotos.length) {
        try {
            const uploaded = [];
            const jobSafe = document.getElementById('warrantyJobNumber').value.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            for (const file of selectedWarrantyPhotos) {
                const ext = file.name.split('.').pop();
                const filename = `warranty_${jobSafe}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
                await uploadStorageFile('warranty', filename, file);
                uploaded.push(filename);
            }
            photos = [...photos, ...uploaded];
        } catch (err) {
            console.error('Warranty photo upload failed:', err);
            alert('Warranty photos could not be uploaded. The claim was not saved.');
            return;
        }
    }
    claim.job_number = document.getElementById('warrantyJobNumber').value.trim();
    claim.reported_issue = document.getElementById('warrantyReportedIssue').value.trim();
    claim.order_type = document.getElementById('warrantyOrderType').value;
    claim.claim_type = document.getElementById('warrantyClaimType').value;
    claim.status = document.getElementById('warrantyStatus').value;
    stampWarrantyStatusTransition(claim, previousStatus, claim.status);
    claim.original_order_id = document.getElementById('warrantyOriginalOrderId').value.trim();
    claim.customer_name = document.getElementById('warrantyCustomerName').value.trim();
    claim.warranty_notes = document.getElementById('warrantyNotes').value.trim();
    claim.approved_id = claim.status === 'Approved' ? document.getElementById('warrantyApprovedId').value.trim() : '';
    claim.denied_reason = claim.status === 'Denied' ? document.getElementById('warrantyDeniedReason').value.trim() : '';
    claim.photos = photos;
    claim.updated_date = getLocalDateTimeString();
    try {
        await saveOrderRecord(claim);
        closeAllModals();
        currentDashboardTab = 'warranty';
        await syncDatabase();
    } catch (err) {
        console.error('Warranty claim save failed:', err);
        alert('The warranty claim could not be saved.');
    }
}

function toggleInspectionFields() {
    const completed = document.getElementById('inspectionStatus').value !== 'Inspection Request';
    document.getElementById('inspectionRequestedField').classList.toggle('hidden', completed);
    document.getElementById('inspectionCompletedFields').classList.toggle('hidden', !completed);
    document.getElementById('inspectionRequestedBy').required = !completed;
    document.getElementById('inspectionInspectedBy').required = completed;
}

function openInspectionModal(orderId = null) {
    closeAllModals();
    const form = document.getElementById('inspectionForm');
    form.reset();
    selectedInspectionPhotos = [];
    updateWorkflowPhotoVisual('inspection', [], 0);
    const inspection = orderId ? orders.find(order => order.id == orderId && isInspectionOrder(order)) : null;
    document.getElementById('modalInspectionTitle').textContent = inspection ? 'Edit Panel Inspection' : 'Create Panel Inspection';
    document.getElementById('inspectionId').value = inspection?.id || '';
    if (inspection) {
        document.getElementById('inspectionCustomerName').value = inspection.customer_name || '';
        document.getElementById('inspectionJobNumber').value = inspection.job_number || '';
        document.getElementById('inspectionStatus').value = inspection.status || 'Inspection Request';
        document.getElementById('inspectionRequestedBy').value = inspection.requested_by || '';
        document.getElementById('inspectionInspectedBy').value = inspection.inspected_by || '';
        document.getElementById('inspectionNotes').value = inspection.notes || '';
        updateWorkflowPhotoVisual('inspection', null, inspection.photos?.length || 0);
    }
    toggleInspectionFields();
    renderEmbeddedActionTimes(form, inspection);
    showModal('modalInspection');
}

async function handleInspectionSubmit(e) {
    e.preventDefault();
    if (!supabaseClient) return;
    const editId = document.getElementById('inspectionId').value;
    const id = editId || Date.now();
    const existing = orders.find(order => order.id == id && isInspectionOrder(order));
    if (editId && !existing) {
        alert('This panel inspection could not be found. Refresh the page and try again.');
        return;
    }
    const inspection = existing || { id: Number(id), record_type: 'panel_inspection', created_date: getLocalDateTimeString(), photos: [] };
    const previousStatus = inspection.status || 'Inspection Request';
    let photos = inspection.photos || [];
    if (selectedInspectionPhotos === 'deleted') photos = [];
    else if (Array.isArray(selectedInspectionPhotos) && selectedInspectionPhotos.length) {
        try {
            const uploaded = [];
            const jobSafe = document.getElementById('inspectionJobNumber').value.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            for (const file of selectedInspectionPhotos) {
                const ext = file.name.split('.').pop();
                const filename = `inspection_${jobSafe}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
                await uploadStorageFile('panel_inspections', filename, file);
                uploaded.push(filename);
            }
            photos = [...photos, ...uploaded];
        } catch (err) {
            console.error('Inspection photo upload failed:', err);
            alert('Inspection photos could not be uploaded. The inspection was not saved.');
            return;
        }
    }
    const status = document.getElementById('inspectionStatus').value;
    if (status !== 'Inspection Request' && photos.length === 0) {
        alert('At least one inspection photo is required after the panels are inspected.');
        return;
    }
    inspection.customer_name = document.getElementById('inspectionCustomerName').value.trim();
    inspection.job_number = document.getElementById('inspectionJobNumber').value.trim();
    inspection.status = status;
    if (previousStatus === 'Inspection Request' && status !== 'Inspection Request' && !inspection.inspected_date) {
        inspection.inspected_date = getLocalDateTimeString();
    }
    inspection.requested_by = status === 'Inspection Request' ? document.getElementById('inspectionRequestedBy').value : '';
    inspection.inspected_by = status !== 'Inspection Request' ? document.getElementById('inspectionInspectedBy').value : '';
    inspection.notes = document.getElementById('inspectionNotes').value.trim();
    inspection.photos = photos;
    inspection.updated_date = getLocalDateTimeString();
    try {
        await saveOrderRecord(inspection);
        closeAllModals();
        currentDashboardTab = 'inspections';
        await syncDatabase();
    } catch (err) {
        console.error('Inspection save failed:', err);
        alert('The panel inspection could not be saved.');
    }
}

async function extractTrailerDocumentText(file) {
    try {
        const extension = file.name.split('.').pop().toLowerCase();
        const buffer = await file.arrayBuffer();
        if (extension === 'pdf') {
            if (!window.pdfjsLib) throw new Error('PDF text reader is unavailable.');
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
            const pages = [];
            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                const page = await pdf.getPage(pageNumber);
                const content = await page.getTextContent();
                pages.push(content.items.map(item => item.str).join(' '));
            }
            return pages.join('\n').slice(0, 250000);
        }
        if (extension === 'xls' || extension === 'xlsx') {
            if (!window.XLSX) throw new Error('Excel text reader is unavailable.');
            const workbook = window.XLSX.read(buffer, { type: 'array' });
            return workbook.SheetNames.map(name => `${name}\n${window.XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join('\n').slice(0, 250000);
        }
    } catch (err) {
        console.warn(`Could not index ${file.name}:`, err);
    }
    return '';
}

async function handleTrailerSubmit(e) {
    e.preventDefault();
    if (!supabaseClient) return;

    const id = document.getElementById('trailerId').value || Date.now();
    const existing = orders.find(order => order.id == id && isTrailerOrder(order));
    const status = document.getElementById('trailerStatus').value;
    const tripNumber = document.getElementById('trailerTripNumber').value.trim();
    const hasIssue = document.getElementById('trailerIssueCheck').checked;
    const issueDescription = document.getElementById('trailerIssueDescription').value.trim();
    const trailer = existing || {
        id: Number(id),
        record_type: 'clopay_trailer',
        created_date: getLocalDateTimeString(),
        status: 'Expected',
        documents: [],
        issue_photos: []
    };

    let documents = trailer.documents || [];
    if (selectedTrailerDocs === 'deleted') {
        documents = [];
    } else if (Array.isArray(selectedTrailerDocs) && selectedTrailerDocs.length) {
        try {
            const uploaded = [];
            const tripSafe = tripNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
            for (const file of selectedTrailerDocs) {
                const extension = file.name.split('.').pop().toLowerCase();
                const filename = `trailer_${tripSafe}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;
                const searchText = await extractTrailerDocumentText(file);
                await uploadStorageFile('clopay_trailers', filename, file);
                uploaded.push({ filename, original_name: file.name, type: file.type, search_text: searchText });
            }
            documents = [...documents, ...uploaded];
        } catch (err) {
            console.error('Error uploading trailer documents:', err);
            alert('Trailer documents could not be uploaded. The record was not saved.');
            return;
        }
    }

    let issuePhotos = trailer.issue_photos || [];
    if (!hasIssue || selectedTrailerIssuePhotos === 'deleted') {
        issuePhotos = [];
    } else if (Array.isArray(selectedTrailerIssuePhotos) && selectedTrailerIssuePhotos.length) {
        try {
            const uploaded = [];
            const tripSafe = tripNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
            for (const file of selectedTrailerIssuePhotos) {
                const extension = file.name.split('.').pop();
                const filename = `issue_${tripSafe}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;
                await uploadStorageFile('clopay_issues', filename, file);
                uploaded.push(filename);
            }
            issuePhotos = [...issuePhotos, ...uploaded];
        } catch (err) {
            console.error('Error uploading trailer issue photos:', err);
            alert('Issue photos could not be uploaded. The record was not saved.');
            return;
        }
    }

    const now = getLocalDateTimeString();
    if (status === 'Arrived' && !trailer.arrived_date) trailer.arrived_date = now;
    if (status === 'Dispatched') {
        if (!trailer.arrived_date) trailer.arrived_date = now;
        if (!trailer.dispatched_date) trailer.dispatched_date = now;
    }

    trailer.trip_number = tripNumber;
    trailer.bol_number = document.getElementById('trailerBolNumber').value.trim();
    trailer.stop_number = document.getElementById('trailerStopNumber').value.trim();
    trailer.weight = document.getElementById('trailerWeight').value.trim();
    trailer.trailer_number = document.getElementById('trailerNumber').value.trim();
    trailer.status = status;
    trailer.documents = documents;
    trailer.has_issue = hasIssue;
    trailer.issue_description = hasIssue ? issueDescription : '';
    trailer.issue_photos = issuePhotos;

    try {
        await saveOrderRecord(trailer);
        closeAllModals();
        currentDashboardTab = 'trailers';
        await syncDatabase();
    } catch (err) {
        console.error('Error saving trailer:', err);
        alert('The trailer record could not be saved. Please check Supabase permissions.');
    }
}

function parseTrailerEmailTemplate(template, trailer) {
    const values = {
        trip_number: trailer.trip_number || '',
        bol_number: trailer.bol_number || '',
        stop_number: trailer.stop_number || '',
        weight: trailer.weight || 'N/A',
        trailer_number: trailer.trailer_number || 'N/A',
        arrived_date: formatDateTimeDisplay(trailer.arrived_date),
        issue_description: trailer.issue_description || 'No issue reported'
    };
    return Object.entries(values).reduce((text, [key, value]) => text.replace(new RegExp(`{${key}}`, 'g'), value), template);
}

function emailTrailerArrival(orderId) {
    const trailer = orders.find(order => order.id == orderId && isTrailerOrder(order));
    if (!trailer) return;
    const recipients = settings.trailerEmailRecipients || DEFAULT_SETTINGS.trailerEmailRecipients;
    const subject = parseTrailerEmailTemplate(settings.trailerEmailSubject || DEFAULT_SETTINGS.trailerEmailSubject, trailer);
    const body = parseTrailerEmailTemplate(settings.trailerEmailBody || DEFAULT_SETTINGS.trailerEmailBody, trailer);
    window.location.href = `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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

async function viewOutboundPhotos(orderId, startFilename = null) {
    const order = orders.find(o => o.id == orderId && isOutboundOrder(o));
    if (!order) return;
    
    currentGalleryOrder = order;
    currentGalleryFiles = [];
    
    if (order.shipped_photos && order.shipped_photos.length > 0) {
        order.shipped_photos.forEach((fn, idx) => {
            currentGalleryFiles.push({
                type: 'shipped_out',
                filename: fn,
                storageFolder: 'shipped_out',
                title: `Shipped Freight Photo ${idx + 1} of ${order.shipped_photos.length}`
            });
        });
    }
    
    let startIndex = 0;
    if (startFilename) {
        startIndex = currentGalleryFiles.findIndex(f => f.filename === startFilename);
    }
    
    if (startIndex === -1) startIndex = 0;
    openGalleryModal(startIndex);
}

async function viewPickupPhotos(orderId, startFilename = null) {
    const order = orders.find(o => o.id == orderId && isPickupOrder(o));
    if (!order) return;

    currentGalleryOrder = order;
    currentGalleryFiles = [];

    if (order.pickup_photos && order.pickup_photos.length > 0) {
        order.pickup_photos.forEach((fn, idx) => {
            currentGalleryFiles.push({
                type: 'customer_pickup',
                filename: fn,
                storageFolder: 'customer_pickup',
                title: `Customer Pick Up Photo ${idx + 1} of ${order.pickup_photos.length}`
            });
        });
    }

    let startIndex = 0;
    if (startFilename) {
        startIndex = currentGalleryFiles.findIndex(f => f.filename === startFilename);
    }

    if (startIndex === -1) startIndex = 0;
    openGalleryModal(startIndex);
}

function viewWarrantyPhotos(orderId) {
    const claim = orders.find(order => order.id == orderId && isWarrantyOrder(order));
    if (!claim?.photos?.length) return;
    currentGalleryOrder = claim;
    currentGalleryFiles = claim.photos.map((filename, index) => ({
        type: 'warranty',
        filename,
        storageFolder: 'warranty',
        title: `Warranty Photo ${index + 1} of ${claim.photos.length}`
    }));
    openGalleryModal(0);
}

function viewInspectionPhotos(orderId) {
    const inspection = orders.find(order => order.id == orderId && isInspectionOrder(order));
    if (!inspection?.photos?.length) return;
    currentGalleryOrder = inspection;
    currentGalleryFiles = inspection.photos.map((filename, index) => ({
        type: 'panel_inspection',
        filename,
        storageFolder: 'panel_inspections',
        title: `Inspection Photo ${index + 1} of ${inspection.photos.length}`
    }));
    openGalleryModal(0);
}

async function viewTrailerDocuments(orderId) {
    const trailer = orders.find(order => order.id == orderId && isTrailerOrder(order));
    if (!trailer || !trailer.documents?.length) return;
    currentGalleryOrder = trailer;
    currentGalleryFiles = trailer.documents.map((file, index) => ({
        type: 'trailer_document',
        filename: file.filename,
        originalName: file.original_name || file.filename,
        storageFolder: 'clopay_trailers',
        title: `Supporting Document ${index + 1} of ${trailer.documents.length}`
    }));
    openGalleryModal(0);
}

async function viewTrailerIssuePhotos(orderId) {
    const trailer = orders.find(order => order.id == orderId && isTrailerOrder(order));
    if (!trailer || !trailer.issue_photos?.length) return;
    currentGalleryOrder = trailer;
    currentGalleryFiles = trailer.issue_photos.map((filename, index) => ({
        type: 'trailer_issue',
        filename,
        storageFolder: 'clopay_issues',
        title: `Issue Photo ${index + 1} of ${trailer.issue_photos.length}`
    }));
    openGalleryModal(0);
}

// Build unified list of attachments for the active order
async function buildGallery(order) {
    currentGalleryFiles = [];
    
    // Add Packing Slips / Attached Files
    const packingSlipFiles = getPackingSlipFiles(order);
    packingSlipFiles.forEach((fn, idx) => {
        currentGalleryFiles.push({
            type: 'packing_slip',
            filename: fn,
            storageFolder: 'scans',
            title: `Attached File ${idx + 1} of ${packingSlipFiles.length}`
        });
    });
    
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
    showModal('modalViewScan');
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
    const galleryRecordLabel = currentGalleryOrder
        ? (isTrailerOrder(currentGalleryOrder)
            ? `Trip: ${currentGalleryOrder.trip_number}`
            : isWarrantyOrder(currentGalleryOrder)
            ? `Warranty Job: ${currentGalleryOrder.job_number}`
            : isInspectionOrder(currentGalleryOrder)
            ? `Inspection Job: ${currentGalleryOrder.job_number}`
            : isPickupOrder(currentGalleryOrder)
            ? `Job: ${currentGalleryOrder.job_number}`
            : (isOutboundOrder(currentGalleryOrder) ? currentGalleryOrder.customer : `PO: ${currentGalleryOrder.po_number}`))
        : '-';
    
    // Update header title
    document.getElementById('viewScanTitle').textContent = `${galleryRecordLabel} - ${fileObj.title}`;
    
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
    const annotateButton = document.getElementById('btnAnnotateGalleryPhoto');
    
    try {
        const fileUrl = await getStorageFileUrl(fileObj.storageFolder, fileObj.filename);
        activeObjectURL = fileUrl;
        
        wrapper.innerHTML = '';
        
        const isPdf = fileObj.filename.toLowerCase().endsWith('.pdf');
        const isImage = /\.(png|jpe?g|webp|gif)$/i.test(fileObj.filename);
        const modalContent = document.querySelector('.gallery-modal-content');
        annotateButton?.classList.toggle('hidden', !isImage);
        
        if (isPdf) {
            modalContent.classList.add('pdf-active');
            
            const iframe = document.createElement('iframe');
            iframe.src = fileUrl;
            wrapper.appendChild(iframe);
            
            // Reset state
            zoomScale = 1.0;
            rotateAngle = 0;
            panOffset = { x: 0, y: 0 };
        } else if (isImage) {
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
        } else {
            modalContent.classList.add('pdf-active');
            wrapper.innerHTML = `<div class="generic-file-preview"><i class="fa-regular fa-file-excel"></i><strong>${escapeHtml(fileObj.originalName || fileObj.filename)}</strong><p>Use Download to open this spreadsheet.</p></div>`;
        }
        
    } catch (err) {
        console.error('Error loading gallery file:', err);
        annotateButton?.classList.add('hidden');
        wrapper.innerHTML = `<div style="color: var(--status-error); padding: 2rem; text-align: center;"><i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem;"></i><p>File not found or access denied.</p></div>`;
    }
    
    // Render thumbnails
    await renderGalleryThumbnails();
}

function annotateCurrentGalleryPhoto() {
    const fileObj = currentGalleryFiles[currentGalleryIndex];
    if (!fileObj || !currentGalleryOrder) return;
    if (!/\.(png|jpe?g|webp|gif)$/i.test(fileObj.filename)) {
        showToast('Not an image', 'Only photos can be annotated.', 'info');
        return;
    }
    annotateSavedPhoto(currentGalleryOrder.id, fileObj.storageFolder, fileObj.filename);
}

async function downloadCurrentGalleryFile() {
    const fileObj = currentGalleryFiles[currentGalleryIndex];
    if (!fileObj) return;

    const downloadButton = document.getElementById('btnDownloadInvoice');
    const originalContent = downloadButton.innerHTML;
    downloadButton.disabled = true;
    downloadButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Downloading...';

    try {
        const path = `${fileObj.storageFolder}/${fileObj.filename}`;
        const { data: fileBlob, error } = await getSupabaseClient()
            .storage
            .from(SUPABASE_STORAGE_BUCKET)
            .download(path);

        if (error) throw error;

        const objectUrl = URL.createObjectURL(fileBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = objectUrl;
        downloadLink.download = fileObj.filename;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();

        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
        console.error('Error downloading gallery file:', err);
        alert('The file could not be downloaded. Please check the connection and try again.');
    } finally {
        downloadButton.disabled = false;
        downloadButton.innerHTML = originalContent;
    }
}

function isImageFilename(filename) {
    return /\.(png|jpe?g|webp|gif)$/i.test(filename || '');
}

function getPdfReportData(order) {
    if (isWarrantyOrder(order)) {
        return {
            title: 'Warranty Claim Report', reference: `Job ${order.job_number}`,
            fields: [
                ['Job Number', order.job_number], ['Status', order.status], ['Order Type', order.order_type], ['Claim Type', order.claim_type],
                ['Reported Issue', order.reported_issue], ['Original Order ID', order.original_order_id], ['Customer Name', order.customer_name],
                ['Warranty Notes', order.warranty_notes], ['Approved ID', order.approved_id], ['Denied Reason', order.denied_reason],
                ['Created', order.created_date], ['Updated', order.updated_date]
            ],
            attachments: [],
            photos: (order.photos || []).map((filename, index) => ({ folder: 'warranty', filename, label: `Warranty Photo ${index + 1}` }))
        };
    }
    if (isInspectionOrder(order)) {
        return {
            title: 'Panel Inspection Report', reference: `Job ${order.job_number}`,
            fields: [
                ['Customer Name', order.customer_name], ['Job Number', order.job_number], ['Status', order.status],
                ['Requested By', order.requested_by], ['Inspected By', order.inspected_by], ['Notes', order.notes],
                ['Created', order.created_date], ['Updated', order.updated_date]
            ],
            attachments: [],
            photos: (order.photos || []).map((filename, index) => ({ folder: 'panel_inspections', filename, label: `Panel Inspection Photo ${index + 1}` }))
        };
    }
    if (isTrailerOrder(order)) {
        return {
            title: 'Trailer Report',
            reference: `Trip ${order.trip_number}`,
            fields: [
                ['Trip #', order.trip_number], ['BOL #', order.bol_number], ['Stop #', order.stop_number],
                ['Status', order.status], ['Weight (lb)', order.weight], ['Trailer #', order.trailer_number],
                ['Created', order.created_date], ['Arrived', order.arrived_date], ['Dispatched', order.dispatched_date],
                ['Arrived to Dispatched', formatElapsedTime(order.arrived_date, order.dispatched_date)],
                ['Report an Issue', order.has_issue ? 'Yes' : 'No'], ['Issue Description', order.issue_description]
            ],
            attachments: (order.documents || []).map(file => file.original_name || file.filename),
            photos: (order.issue_photos || []).map((filename, index) => ({ folder: 'clopay_issues', filename, label: `Trailer Issue Photo ${index + 1}` }))
        };
    }
    if (isPickupOrder(order)) {
        return {
            title: 'Customer Pick Up Report', reference: `Job ${order.job_number}`,
            fields: [['Customer', order.customer_name], ['Job Number', order.job_number], ['Handled By', order.handled_by], ['Picked Up', order.pickup_date], ['Comments', order.notes]],
            attachments: [],
            photos: (order.pickup_photos || []).map((filename, index) => ({ folder: 'customer_pickup', filename, label: `Customer Pick Up Photo ${index + 1}` }))
        };
    }
    if (isOutboundOrder(order)) {
        return {
            title: 'Shipped Out Report', reference: order.customer || `Job ${order.job_number}`,
            fields: [['Customer', order.customer], ['Job Number', order.job_number], ['Carrier', order.carrier], ['Ship To Address', order.ship_to_address], ['Payment Type', order.payment_type], ['Shipped Date', order.shipped_date], ['Notes', order.notes]],
            attachments: [],
            photos: (order.shipped_photos || []).map((filename, index) => ({ folder: 'shipped_out', filename, label: `Shipped Freight Photo ${index + 1}` }))
        };
    }

    const packingSlipFiles = getPackingSlipFiles(order);
    const podFiles = order.invoice_filenames || (order.invoice_filename ? [order.invoice_filename] : []);
    const photos = [];
    packingSlipFiles.filter(isImageFilename).forEach((filename, index) => photos.push({ folder: 'scans', filename, label: `Packing Slip Image ${index + 1}` }));
    podFiles.filter(isImageFilename).forEach((filename, index) => photos.push({ folder: 'scans', filename, label: `POD Photo ${index + 1}` }));
    (order.osd_photos || []).forEach((filename, index) => photos.push({ folder: 'osd', filename, label: `OSD Damage Photo ${index + 1}` }));
    return {
        title: 'Receiving Shipment Report', reference: `PO ${order.po_number}`,
        fields: [
            ['PO Number', order.po_number], ['Supplier', order.supplier], ['Classification', order.classification],
            ['Description / Items', order.item_description], ['Ordered By', order.ordered_by], ['Ordered Date', order.ordered_date],
            ['ETA', order.eta], ['Carrier', order.carrier], ['Tracking Number', order.tracking_number], ['Status', order.status],
            ['Received By', order.received_by], ['Received Date', order.received_date], ['OSD Reported', order.has_issue ? 'Yes' : 'No'], ['Notes', order.notes]
        ],
        attachments: [...packingSlipFiles, ...podFiles].filter(Boolean),
        photos
    };
}

function getPdfAttachmentFiles(order) {
    if (isTrailerOrder(order)) {
        return (order.documents || []).map(file => ({
            folder: 'clopay_trailers',
            filename: file.filename,
            label: file.original_name || file.filename,
            searchText: file.search_text || ''
        }));
    }
    if (isReceivingOrder(order)) {
        const packingSlipFiles = getPackingSlipFiles(order)
            .filter(filename => !isImageFilename(filename))
            .map((filename, index) => ({ folder: 'scans', filename, label: `Attached File ${index + 1}: ${filename}` }));
        const podFiles = (order.invoice_filenames || (order.invoice_filename ? [order.invoice_filename] : []))
            .filter(filename => !isImageFilename(filename))
            .map((filename, index) => ({ folder: 'scans', filename, label: `POD ${index + 1}: ${filename}` }));
        return [...packingSlipFiles, ...podFiles];
    }
    return [];
}

async function storageImageToJpeg(folder, filename) {
    const { data, error } = await getSupabaseClient().storage.from(SUPABASE_STORAGE_BUCKET).download(`${folder}/${filename}`);
    if (error) throw error;
    const objectUrl = URL.createObjectURL(data);
    try {
        const image = await new Promise((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = reject;
            element.src = objectUrl;
        });
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return { dataUrl: canvas.toDataURL('image/jpeg', 0.84), width: canvas.width, height: canvas.height };
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

function getPdfTimelineItems(order) {
    if (isReceivingOrder(order)) return [
        { label: 'Ordered', date: order.ordered_date || order.created_date, actor: order.ordered_by },
        { label: 'Received', date: order.received_date, actor: order.received_by }
    ];
    if (isTrailerOrder(order)) return [
        { label: 'Created', date: order.created_date, actor: order.created_by },
        { label: 'Arrived', date: order.arrived_date, actor: order.arrived_by },
        { label: 'Dispatched', date: order.dispatched_date, actor: order.dispatched_by }
    ];
    if (isWarrantyOrder(order)) {
        const items = [
            { label: 'Created', date: order.created_date, actor: order.created_by },
            { label: 'Submitted', date: order.submitted_date, actor: order.submitted_by }
        ];
        if (order.status === 'Approved' || order.approved_date) items.push({ label: 'Approved', date: order.approved_date || order.updated_date, actor: order.approved_by });
        else if (order.status === 'Denied' || order.denied_date) items.push({ label: 'Denied', date: order.denied_date || order.updated_date, actor: order.denied_by });
        return items;
    }
    if (isInspectionOrder(order)) return [
        { label: 'Created', date: order.created_date, actor: order.requested_by },
        { label: 'Inspected', date: order.inspected_date || (order.status !== 'Inspection Request' ? order.updated_date : ''), actor: order.inspected_by }
    ];
    return [];
}

function getPdfProblem(order) {
    if (isReceivingOrder(order) && order.has_issue) return { title: 'OSD / RECEIVING ISSUE', text: order.notes || 'Damage, shortage, or discrepancy was reported during receiving.' };
    if (isTrailerOrder(order) && order.has_issue) return { title: 'TRAILER ISSUE', text: order.issue_description || 'An issue was reported for this trailer.' };
    if (isWarrantyOrder(order)) {
        const decision = order.status === 'Denied' && order.denied_reason ? ` Denied reason: ${order.denied_reason}` : '';
        return { title: 'REPORTED WARRANTY ISSUE', text: `${order.reported_issue || 'Warranty issue reported.'}${decision}` };
    }
    if (isInspectionOrder(order) && order.status === 'Inspected - damage found') return { title: 'DAMAGE FOUND', text: order.notes || 'Panel damage was found during inspection.' };
    return null;
}

let pdfDarkHeaderLogoPromise = null;

function createPdfDarkHeaderLogo(sourceDataUrl) {
    if (pdfDarkHeaderLogoPromise) return pdfDarkHeaderLogoPromise;
    pdfDarkHeaderLogoPromise = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, 0, 0);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            const headerColor = [17, 24, 39];
            for (let index = 0; index < pixels.data.length; index += 4) {
                const red = pixels.data[index];
                const green = pixels.data[index + 1];
                const blue = pixels.data[index + 2];
                const isRed = red > 140 && red - green > 45 && red - blue > 45;
                let targetColor;
                let opacity;
                if (isRed) {
                    targetColor = [239, 22, 38];
                    opacity = Math.max(0, 255 - Math.min(green, blue)) / 255;
                } else {
                    const brightness = (red + green + blue) / 3;
                    targetColor = [255, 255, 255];
                    opacity = Math.max(0, 255 - brightness) / 255;
                }
                pixels.data[index] = Math.round(targetColor[0] * opacity + headerColor[0] * (1 - opacity));
                pixels.data[index + 1] = Math.round(targetColor[1] * opacity + headerColor[1] * (1 - opacity));
                pixels.data[index + 2] = Math.round(targetColor[2] * opacity + headerColor[2] * (1 - opacity));
                pixels.data[index + 3] = 255;
            }
            context.putImageData(pixels, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = reject;
        image.src = sourceDataUrl;
    });
    return pdfDarkHeaderLogoPromise;
}

async function generateOrderPdfReport(orderId) {
    const order = orders.find(item => item.id == orderId);
    if (!order) return;
    if (!window.jspdf?.jsPDF) {
        alert('PDF report library did not load. Check the internet connection and try again.');
        return;
    }

    const pdfLogoDataUrl = window.MAXM_PDF_LOGO_DATA_URL;
    if (!pdfLogoDataUrl) {
        alert('The embedded MAXM logo is unavailable. Refresh the page and try again.');
        return;
    }
    const pdfHeaderLogoDataUrl = window.MAXM_PDF_HEADER_LOGO_DATA_URL;
    if (!pdfHeaderLogoDataUrl) {
        alert('The PDF header logo did not load. Upload pdf-logo-data.js and refresh the page.');
        return;
    }

    const report = getPdfReportData(order);
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 0;
    const sanitizePdfText = value => String(value)
        .normalize('NFKC')
        .replace(/[\u00a0\u2007\u202f]/g, ' ')
        .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .trim();

    const formatPdfValue = value => {
        const clean = value === undefined || value === null || value === '' ? '-' : sanitizePdfText(value);
        return /^\d{4}-\d{2}-\d{2}T/.test(clean) ? clean.replace('T', ' ') : clean;
    };
    const statusColor = status => {
        if (['Received', 'Dispatched', 'Approved', 'Inspected - good to go', 'Shipped Out', 'Picked Up'].includes(status)) return [22, 163, 74];
        if (['Denied', 'Inspected - damage found'].includes(status)) return [220, 38, 38];
        if (['Working on it', 'Request Submitted', 'Arrived'].includes(status)) return [37, 99, 235];
        return [107, 114, 128];
    };
    const drawPdfLogo = () => {
        const boxWidth = 66;
        const boxHeight = 21;
        const boxX = pageWidth - margin - boxWidth;
        const boxY = 4;
        const paddingX = 3;
        const paddingY = 2.5;
        const properties = doc.getImageProperties(pdfHeaderLogoDataUrl);
        const sourceWidth = properties.width || 1512;
        const sourceHeight = properties.height || 388;
        const scale = Math.min(
            (boxWidth - paddingX * 2) / sourceWidth,
            (boxHeight - paddingY * 2) / sourceHeight
        );
        const logoWidth = sourceWidth * scale;
        const logoHeight = sourceHeight * scale;
        const logoX = boxX + (boxWidth - logoWidth) / 2;
        const logoY = boxY + (boxHeight - logoHeight) / 2;
        doc.addImage(pdfHeaderLogoDataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight, 'maxm-logo-dark-header', 'FAST');
    };
    const addHeader = section => {
        doc.setFillColor(17, 24, 39);
        doc.rect(0, 0, pageWidth, 29, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(report.title, margin, 11.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(209, 213, 219);
        doc.text(sanitizePdfText(section || report.reference), margin, 20);
        drawPdfLogo();
        doc.setTextColor(17, 24, 39);
        y = 37;
    };
    const ensureSpace = height => {
        if (y + height > pageHeight - 18) {
            doc.addPage();
            addHeader(report.reference);
        }
    };
    const drawSectionTitle = title => {
        ensureSpace(11);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(75, 85, 99);
        doc.text(sanitizePdfText(title).toUpperCase(), margin, y + 4);
        doc.setDrawColor(207, 46, 46);
        doc.setLineWidth(0.8);
        doc.line(margin, y + 7, margin + 18, y + 7);
        y += 12;
    };
    const downloadAttachmentBlob = async attachment => {
        const { data, error } = await getSupabaseClient()
            .storage
            .from(SUPABASE_STORAGE_BUCKET)
            .download(`${attachment.folder}/${attachment.filename}`);
        if (error) throw error;
        return data;
    };
    const addAttachmentInfoPage = (attachment, message, text = '') => {
        doc.addPage();
        addHeader(`${report.reference} | Attachment`);
        drawSectionTitle('Attached File');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(17, 24, 39);
        doc.text(doc.splitTextToSize(sanitizePdfText(attachment.label || attachment.filename), contentWidth), margin, y);
        y += 9;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.text(doc.splitTextToSize(sanitizePdfText(message), contentWidth), margin, y);
        y += 12;
        if (text) {
            drawSectionTitle('Extracted Text');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(17, 24, 39);
            const lines = doc.splitTextToSize(sanitizePdfText(text).slice(0, 6000), contentWidth);
            lines.forEach(line => {
                ensureSpace(4.5);
                doc.text(line, margin, y);
                y += 4.2;
            });
        }
    };
    const addPdfAttachmentPages = async (attachment, blob) => {
        if (!window.pdfjsLib) {
            addAttachmentInfoPage(attachment, 'PDF preview library is unavailable, so this attachment could not be rendered into the report.');
            return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const buffer = await blob.arrayBuffer();
        const embeddedPdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        for (let pageNumber = 1; pageNumber <= embeddedPdf.numPages; pageNumber++) {
            const page = await embeddedPdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1.6 });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            doc.addPage();
            addHeader(`${report.reference} | ${sanitizePdfText(attachment.label || attachment.filename)} (${pageNumber}/${embeddedPdf.numPages})`);
            const imageData = canvas.toDataURL('image/jpeg', 0.88);
            const maxWidth = contentWidth;
            const maxHeight = pageHeight - 47;
            const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
            const imageWidth = canvas.width * ratio;
            const imageHeight = canvas.height * ratio;
            const imageX = (pageWidth - imageWidth) / 2;
            const imageY = 36 + (maxHeight - imageHeight) / 2;
            doc.addImage(imageData, 'JPEG', imageX, imageY, imageWidth, imageHeight, undefined, 'FAST');
        }
    };
    const appendAttachmentPages = async () => {
        const attachmentFiles = getPdfAttachmentFiles(order);
        for (const attachment of attachmentFiles) {
            try {
                const extension = (attachment.filename.split('.').pop() || '').toLowerCase();
                const blob = await downloadAttachmentBlob(attachment);
                if (extension === 'pdf') {
                    await addPdfAttachmentPages(attachment, blob);
                } else if (['xls', 'xlsx'].includes(extension)) {
                    addAttachmentInfoPage(attachment, 'Excel files cannot be embedded visually by the browser. The file is listed here with any extracted searchable text saved for this record.', attachment.searchText || '');
                } else {
                    addAttachmentInfoPage(attachment, 'This attachment type cannot be rendered visually inside the PDF report.');
                }
            } catch (err) {
                console.warn(`Could not append attachment ${attachment.filename}:`, err);
                addAttachmentInfoPage(attachment, 'This attachment could not be loaded from storage when the report was created.');
            }
        }
    };

    addHeader(`${sanitizePdfText(report.reference)} | Generated ${formatDateTimeDisplay(getLocalDateTimeString())}`);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(17, 24, 39);
    doc.text(sanitizePdfText(report.reference), margin, y + 7);
    const status = order.status || (isOutboundOrder(order) ? 'Shipped Out' : (isPickupOrder(order) ? 'Picked Up' : 'Ordered'));
    const [statusR, statusG, statusB] = statusColor(status);
    const statusText = sanitizePdfText(status);
    doc.setFontSize(8.5);
    const statusWidth = Math.min(58, doc.getTextWidth(statusText) + 10);
    doc.setFillColor(statusR, statusG, statusB);
    doc.roundedRect(pageWidth - margin - statusWidth, y, statusWidth, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(statusText, pageWidth - margin - statusWidth / 2, y + 6.5, { align: 'center' });
    y += 16;

    drawSectionTitle('Record Summary');
    const fieldGap = 4;
    const cellWidth = (contentWidth - fieldGap) / 2;
    for (let index = 0; index < report.fields.length; index += 2) {
        const pair = report.fields.slice(index, index + 2);
        const prepared = pair.map(([label, value]) => {
            const lines = doc.splitTextToSize(formatPdfValue(value), cellWidth - 8);
            return { label: sanitizePdfText(label).toUpperCase(), lines };
        });
        const rowHeight = Math.max(15, ...prepared.map(field => field.lines.length * 4 + 9));
        ensureSpace(rowHeight + 3);
        prepared.forEach((field, pairIndex) => {
            const x = margin + pairIndex * (cellWidth + fieldGap);
            doc.setFillColor(index % 4 === 0 ? 248 : 252, index % 4 === 0 ? 250 : 252, index % 4 === 0 ? 252 : 253);
            doc.roundedRect(x, y, cellWidth, rowHeight, 1.5, 1.5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(107, 114, 128);
            doc.text(field.label, x + 4, y + 5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(17, 24, 39);
            doc.text(field.lines, x + 4, y + 11);
        });
        y += rowHeight + 3;
    }

    const timeline = getPdfTimelineItems(order);
    if (timeline.length) {
        drawSectionTitle('Timeline');
        ensureSpace(34);
        const startX = margin + 8;
        const endX = pageWidth - margin - 8;
        const step = timeline.length > 1 ? (endX - startX) / (timeline.length - 1) : 0;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(1.2);
        if (timeline.length > 1) doc.line(startX, y + 6, endX, y + 6);
        timeline.forEach((item, index) => {
            const x = startX + step * index;
            const completed = Boolean(item.date);
            doc.setFillColor(completed ? 207 : 203, completed ? 46 : 213, completed ? 46 : 225);
            doc.circle(x, y + 6, 2.5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(17, 24, 39);
            doc.text(sanitizePdfText(item.label), x, y + 13, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.7);
            doc.setTextColor(107, 114, 128);
            const detail = item.date ? formatPdfValue(item.date) : 'Pending';
            doc.text(doc.splitTextToSize(detail, Math.max(34, step - 5)), x, y + 18, { align: 'center' });
            if (item.actor) doc.text(sanitizePdfText(item.actor), x, y + 27, { align: 'center' });
        });
        y += 35;
    }

    const problem = getPdfProblem(order);
    if (problem) {
        const problemLines = doc.splitTextToSize(sanitizePdfText(problem.text), contentWidth - 12);
        const problemHeight = Math.max(23, problemLines.length * 4.5 + 15);
        ensureSpace(problemHeight + 4);
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(220, 38, 38);
        doc.setLineWidth(0.8);
        doc.roundedRect(margin, y, contentWidth, problemHeight, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(185, 28, 28);
        doc.text(sanitizePdfText(problem.title), margin + 6, y + 7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(69, 10, 10);
        doc.text(problemLines, margin + 6, y + 14);
        y += problemHeight + 5;
    }

    if (report.attachments.length) {
        drawSectionTitle('Attached Documents');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(17, 24, 39);
        report.attachments.forEach(name => {
            ensureSpace(6);
            doc.text(`- ${sanitizePdfText(name)}`, margin + 2, y + 4);
            y += 6;
        });
    }

    await appendAttachmentPages();

    const loadedPhotos = [];
    for (const photo of report.photos) {
        try {
            loadedPhotos.push({ ...photo, image: await storageImageToJpeg(photo.folder, photo.filename) });
        } catch (err) {
            console.warn(`Could not add ${photo.filename} to report:`, err);
        }
    }
    for (let index = 0; index < loadedPhotos.length; index += 2) {
        doc.addPage();
        addHeader(`${report.reference} | Photo Evidence`);
        const pair = loadedPhotos.slice(index, index + 2);
        pair.forEach((photo, slot) => {
            const slotY = 38 + slot * 122;
            const slotHeight = 113;
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(margin, slotY, contentWidth, slotHeight, 2, 2, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(17, 24, 39);
            doc.text(sanitizePdfText(photo.label), margin + 5, slotY + 7);
            const maxWidth = contentWidth - 10;
            const maxHeight = slotHeight - 17;
            const ratio = Math.min(maxWidth / photo.image.width, maxHeight / photo.image.height);
            const imageWidth = photo.image.width * ratio;
            const imageHeight = photo.image.height * ratio;
            const imageX = (pageWidth - imageWidth) / 2;
            const imageY = slotY + 11 + (maxHeight - imageHeight) / 2;
            doc.addImage(photo.image.dataUrl, 'JPEG', imageX, imageY, imageWidth, imageHeight, undefined, 'FAST');
        });
    }

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(107, 114, 128);
        doc.text('Generated by MAXM | Internal Logistics Record', margin, pageHeight - 6);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }

    const safeName = report.reference.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`${safeName}_report.pdf`);
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
        const isImage = /\.(png|jpe?g|webp|gif)$/i.test(fileObj.filename);
        
        if (isPdf) {
            thumbItem.innerHTML = `<i class="fa-regular fa-file-pdf thumb-icon-fallback"></i>`;
        } else if (isImage) {
            try {
                const fileUrl = await getStorageFileUrl(fileObj.storageFolder, fileObj.filename);
                
                const img = document.createElement('img');
                img.src = fileUrl;
                thumbItem.appendChild(img);
            } catch (e) {
                thumbItem.innerHTML = `<i class="fa-regular fa-file-image thumb-icon-fallback"></i>`;
            }
        } else {
            thumbItem.innerHTML = `<i class="fa-regular fa-file-excel thumb-icon-fallback"></i>`;
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
    const timelineHtml = buildRecordTimeline(order) + buildStatusHistory(order);
    configureDetailDrawer(order);

    if (isWarrantyOrder(order) || isInspectionOrder(order)) {
        const warranty = isWarrantyOrder(order);
        const photos = order.photos || [];
        document.getElementById('viewOrderPOTitle').textContent = `${warranty ? 'Warranty' : 'Inspection'} Job ${order.job_number || '-'}`;
        const fields = warranty
            ? [
                ['Job Number', order.job_number], ['Status', order.status], ['Order Type', order.order_type],
                ['Claim Type', order.claim_type], ['Original Order ID', order.original_order_id],
                ['Customer Name', order.customer_name], ['Approved ID', order.approved_id], ['Denied Reason', order.denied_reason]
            ]
            : [
                ['Job Number', order.job_number], ['Customer Name', order.customer_name], ['Status', order.status],
                ['Requested By', order.requested_by], ['Inspected By', order.inspected_by]
            ];
        const description = warranty ? order.reported_issue : order.notes;
        const notes = warranty ? order.warranty_notes : '';
        const photoAction = `${photos.length
            ? `<button class="btn btn-secondary" onclick="closeAllModals(); ${warranty ? 'viewWarrantyPhotos' : 'viewInspectionPhotos'}('${order.id}');"><i class="fa-solid fa-camera"></i> View Photos (${photos.length})</button>`
            : '<span class="text-muted">No photos attached</span>'}
            <button class="btn btn-secondary" onclick="addFilesDirectly('${order.id}', '${warranty ? 'warranty_photos' : 'inspection_photos'}')"><i class="fa-solid fa-plus"></i> Add Photos</button>`;
        document.getElementById('orderDetailsContent').innerHTML = `${timelineHtml}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;font-size:0.95rem;line-height:1.5;">
                ${fields.map(([label, value]) => `<p style="margin:0;"><strong>${label}:</strong> ${escapeHtml(value || '-')}</p>`).join('')}
                <div style="grid-column:span 2;border-top:1px solid var(--border-color);padding-top:0.75rem;">
                    <h4 style="font-family:var(--font-header);font-size:1.05rem;margin-bottom:0.5rem;color:var(--brand-red);">${warranty ? 'Reported Issue' : 'Inspection Notes'}</h4>
                    <p style="white-space:pre-wrap;background:var(--bg-admin-box);padding:0.75rem;border-radius:6px;border:1px solid var(--border-color);margin:0;">${escapeHtml(description || 'No details logged.')}</p>
                </div>
                ${warranty ? `<div style="grid-column:span 2;"><h4 style="font-family:var(--font-header);font-size:1.05rem;margin-bottom:0.5rem;color:var(--brand-red);">Warranty Notes</h4><p style="white-space:pre-wrap;background:var(--bg-admin-box);padding:0.75rem;border-radius:6px;border:1px solid var(--border-color);margin:0;">${escapeHtml(notes || 'No warranty notes logged.')}</p></div>` : ''}
                <div style="grid-column:span 2;border-top:1px solid var(--border-color);padding-top:0.75rem;"><h4 style="font-family:var(--font-header);font-size:1.05rem;margin-bottom:0.5rem;color:var(--brand-red);">Attached Photos</h4>${photoAction}</div>
            </div>`;
        document.getElementById('btnEditFromDetails').onclick = () => {
            closeAllModals();
            if (warranty) openWarrantyModal(order.id);
            else openInspectionModal(order.id);
        };
        showModal('modalViewOrderDetails');
        return;
    }

    if (isTrailerOrder(order)) {
        const documents = order.documents || [];
        const issuePhotos = order.issue_photos || [];
        const documentAction = documents.length > 0
            ? `<button class="btn btn-secondary" onclick="closeAllModals(); viewTrailerDocuments('${order.id}');"><i class="fa-solid fa-paperclip"></i> View Documents (${documents.length})</button>`
            : '<span class="text-muted">No documents attached</span>';
        const addDocumentAction = `<button class="btn btn-secondary" onclick="addFilesDirectly('${order.id}', 'trailer_docs')"><i class="fa-solid fa-plus"></i> Add Documents</button>`;
        const issuePhotoAction = `${issuePhotos.length > 0
            ? `<button class="btn btn-accent" onclick="closeAllModals(); viewTrailerIssuePhotos('${order.id}');" style="background: var(--status-error); border-color: var(--status-error);"><i class="fa-solid fa-camera"></i> View Issue Photos (${issuePhotos.length})</button>`
            : '<span class="text-muted">No issue photos attached</span>'}
            <button class="btn btn-secondary" onclick="addFilesDirectly('${order.id}', 'trailer_issue_photos')"><i class="fa-solid fa-plus"></i> Add Issue Photos</button>`;

        document.getElementById('viewOrderPOTitle').textContent = `BOL ${order.bol_number || '-'}`;
        const content = document.getElementById('orderDetailsContent');
        content.innerHTML = `${timelineHtml}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; font-size: 0.95rem; line-height: 1.5;">
                <div>
                    <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">Trailer Info</h4>
                    <p><strong>BOL #:</strong> ${escapeHtml(order.bol_number || '-')}</p>
                    <p><strong>Trip #:</strong> ${escapeHtml(order.trip_number || '-')}</p>
                    <p><strong>Stop #:</strong> ${escapeHtml(order.stop_number || '-')}</p>
                    <p><strong>Trailer #:</strong> ${escapeHtml(order.trailer_number || '-')}</p>
                    <p><strong>Weight:</strong> ${order.weight ? `${escapeHtml(order.weight)} lb` : '-'}</p>
                </div>
                <div>
                    <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">Status Timeline</h4>
                    <p><strong>Status:</strong> <span class="badge ${workflowStatusClass(order.status, order)}">${escapeHtml(order.status || 'Expected')}</span></p>
                    <p><strong>Arrived:</strong> ${formatDateTimeDisplay(order.arrived_date)}</p>
                    <p><strong>Dispatched:</strong> ${formatDateTimeDisplay(order.dispatched_date)}</p>
                    <p><strong>Arrived to Dispatched:</strong> ${formatElapsedTime(order.arrived_date, order.dispatched_date)}</p>
                </div>
                <div style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                    <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red);">Supporting Documents</h4>
                    ${documentAction} ${addDocumentAction}
                </div>
                <div style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                    <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red);">Reported Issue</h4>
                    <p style="white-space: pre-wrap; background: var(--bg-admin-box); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); margin: 0 0 0.75rem;">${escapeHtml(order.issue_description || 'No issue reported.')}</p>
                    ${issuePhotoAction}
                </div>
            </div>
        `;

        const editBtn = document.getElementById('btnEditFromDetails');
        editBtn.onclick = () => {
            closeAllModals();
            openTrailerModal(order.id);
        };

        showModal('modalViewOrderDetails');
        return;
    }

    if (isOutboundOrder(order) || isPickupOrder(order)) {
        const isPickup = isPickupOrder(order);
        const jobNumber = order.job_number || '-';
        const photos = isPickup ? (order.pickup_photos || []) : (order.shipped_photos || []);
        const photoAction = `${photos.length > 0
            ? `<button class="btn btn-secondary" onclick="closeAllModals(); ${isPickup ? 'viewPickupPhotos' : 'viewOutboundPhotos'}('${order.id}');"><i class="fa-solid fa-camera"></i> View Photos (${photos.length})</button>`
            : '<span class="text-muted">No photos attached</span>'}
            <button class="btn btn-secondary" onclick="addFilesDirectly('${order.id}', '${isPickup ? 'pickup_photos' : 'outbound_photos'}')"><i class="fa-solid fa-plus"></i> Add Photos</button>`;

        document.getElementById('viewOrderPOTitle').textContent = `Job ${jobNumber}`;
        const content = document.getElementById('orderDetailsContent');
        content.innerHTML = isPickup ? `${timelineHtml}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; font-size: 0.95rem; line-height: 1.5;">
                <div>
                    <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">Customer Pick Up</h4>
                    <p><strong>Job Number:</strong> ${escapeHtml(jobNumber)}</p>
                    <p><strong>Customer:</strong> ${escapeHtml(order.customer_name || '-')}</p>
                </div>
                <div>
                    <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">Handoff Log</h4>
                    <p><strong>Handled By:</strong> ${escapeHtml(order.handled_by || '-')}</p>
                    <p><strong>Pick Up Date:</strong> ${formatDateTimeDisplay(order.pickup_date)}</p>
                </div>
                <div style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                    <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red);">Comments</h4>
                    <p style="white-space: pre-wrap; background: var(--bg-admin-box); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); margin: 0;">${escapeHtml(order.notes || 'No comments logged.')}</p>
                </div>
                <div style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                    <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red);">Attached Photos</h4>
                    ${photoAction}
                </div>
            </div>
        ` : `${timelineHtml}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; font-size: 0.95rem; line-height: 1.5;">
                <div>
                    <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">Shipment Info</h4>
                    <p><strong>Job Number:</strong> ${escapeHtml(jobNumber)}</p>
                    <p><strong>Customer:</strong> ${escapeHtml(order.customer || '-')}</p>
                    <p><strong>Carrier:</strong> ${escapeHtml(carrierOptionLabel(order.carrier || 'LTL / Other'))}</p>
                    <p><strong>Payment Type:</strong> ${escapeHtml(order.payment_type || '-')}</p>
                </div>
                <div>
                    <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">Delivery Log</h4>
                    <p><strong>Shipped Date:</strong> ${formatDateTimeDisplay(order.shipped_date)}</p>
                    <p><strong>Ship To Address:</strong><br>${escapeHtml(order.ship_to_address || '-')}</p>
                </div>
                <div style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                    <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red);">Notes</h4>
                    <p style="white-space: pre-wrap; background: var(--bg-admin-box); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); margin: 0;">${escapeHtml(order.notes || 'No notes logged.')}</p>
                </div>
                <div style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                    <h4 style="font-family: var(--font-header); font-size: 1.05rem; margin-bottom: 0.5rem; color: var(--brand-red);">Attached Photos</h4>
                    ${photoAction}
                </div>
            </div>
        `;

        const editBtn = document.getElementById('btnEditFromDetails');
        editBtn.onclick = () => {
            closeAllModals();
            if (isPickup) openPickupModal(order.id);
            else openOutboundModal(order.id);
        };

        showModal('modalViewOrderDetails');
        return;
    }
    
    document.getElementById('viewOrderPOTitle').textContent = order.po_number;
    const content = document.getElementById('orderDetailsContent');
    
    // Attachments download/preview buttons
    let attachmentsHtml = '';
    const packingSlipFiles = getPackingSlipFiles(order);
    if (packingSlipFiles.length > 0) {
        attachmentsHtml += `<button class="btn btn-secondary" onclick="closeAllModals(); viewFileAttachment('${order.id}', 'packing_slip');" style="margin-right: 0.5rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-file-invoice"></i> Attached Files (${packingSlipFiles.length})</button>`;
    }
    const podFiles = order.invoice_filenames || (order.invoice_filename ? [order.invoice_filename] : []);
    if (podFiles.length > 0) {
        attachmentsHtml += `<button class="btn btn-secondary" onclick="closeAllModals(); viewFileAttachment('${order.id}', 'pod');" style="margin-right: 0.5rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-file-signature"></i> POD (${podFiles.length})</button>`;
    }
    if (order.osd_photos && order.osd_photos.length > 0) {
        attachmentsHtml += `<button class="btn btn-accent" onclick="closeAllModals(); viewOsdPhotos('${order.id}');" style="margin-right: 0.5rem; margin-bottom: 0.5rem; background: var(--status-error); border-color: var(--status-error);"><i class="fa-solid fa-camera"></i> Damage Photos (${order.osd_photos.length})</button>`;
    }
    attachmentsHtml += `<button class="btn btn-secondary" onclick="addFilesDirectly('${order.id}', 'receiving_attached')" style="margin-right: 0.5rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-paperclip"></i> Add Attached Files</button>`;
    attachmentsHtml += `<button class="btn btn-secondary" onclick="addFilesDirectly('${order.id}', 'receiving_pod')" style="margin-right: 0.5rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-plus"></i> Add POD / Photos</button>`;
    if (order.has_issue) {
        attachmentsHtml += `<button class="btn btn-secondary" onclick="addFilesDirectly('${order.id}', 'receiving_osd')" style="margin-right: 0.5rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-camera"></i> Add OSD Photos</button>`;
    }
    if (!attachmentsHtml) {
        attachmentsHtml = '<span class="text-muted">None</span>';
    }
    
    let statusBadge = `<span class="badge ${workflowStatusClass(order.status, order)}"><span class="badge-dot"></span>${order.status}</span>`;
    if (order.has_issue) {
        statusBadge += ` <span class="badge-issue"><i class="fa-solid fa-triangle-exclamation"></i> OSD Reported</span>`;
    }
    
    content.innerHTML = `${timelineHtml}
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
                <p><strong>ETA:</strong> ${escapeHtml(order.eta || '-')}</p>
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
    
    showModal('modalViewOrderDetails');
}

function setRecordEditHandlers(order) {
    const handler = () => {
        closeAllModals();
        if (isWarrantyOrder(order)) openWarrantyModal(order.id);
        else if (isInspectionOrder(order)) openInspectionModal(order.id);
        else if (isTrailerOrder(order)) openTrailerModal(order.id);
        else if (isPickupOrder(order)) openPickupModal(order.id);
        else if (isOutboundOrder(order)) openOutboundModal(order.id);
        else openEditModal(order.id);
    };
    const footerEdit = document.getElementById('btnEditFromDetails');
    const headerEdit = document.getElementById('btnEditHeaderFromDetails');
    if (footerEdit) footerEdit.onclick = handler;
    if (headerEdit) headerEdit.onclick = handler;
}

function renderStatusHistoryCompact(order) {
    const entries = Array.isArray(order.status_history) ? order.status_history.slice(-5).reverse() : [];
    if (!entries.length) return '';
    return renderDetailSection('Activity', 'fa-clock-rotate-left', `<div class="record-history">${entries.map(entry => `
        <div class="record-history-item"><strong>${escapeHtml(entry.actor || 'System')}</strong> set ${escapeHtml(entry.status || 'status')} · ${formatDateTimeDisplay(entry.date)}</div>
    `).join('')}</div>`);
}

function renderRecordOverview(order) {
    if (isReceivingOrder(order)) {
        return renderDetailSection('Overview', 'fa-circle-info', renderInfoGrid([
            ['PO Number', escapeHtml(order.po_number || '-')],
            ['Supplier', escapeHtml(order.supplier || '-')],
            ['Classification', order.classification ? `<span class="class-badge class-${order.classification.toLowerCase()}">${escapeHtml(order.classification)}</span>` : '-'],
            ['Carrier', escapeHtml(carrierOptionLabel(order.carrier || 'LTL / Other'))],
            ['Tracking Number', order.tracking_number ? `<span style="font-family:monospace;">${escapeHtml(order.tracking_number)}</span>` : '-'],
            ['ETA', escapeHtml(order.eta || '-')],
            ['Ordered By', escapeHtml(order.ordered_by || '-')],
            ['Received By', escapeHtml(order.received_by || '-')]
        ]));
    }
    if (isTrailerOrder(order)) {
        return renderDetailSection('Overview', 'fa-circle-info', renderInfoGrid([
            ['BOL #', escapeHtml(order.bol_number || '-')],
            ['Trip #', escapeHtml(order.trip_number || '-')],
            ['Stop #', escapeHtml(order.stop_number || '-')],
            ['Trailer #', escapeHtml(order.trailer_number || '-')],
            ['Weight', order.weight ? `${escapeHtml(order.weight)} lb` : '-'],
            ['Arrived to Dispatched', formatElapsedTime(order.arrived_date, order.dispatched_date)]
        ]));
    }
    if (isOutboundOrder(order)) {
        return renderDetailSection('Overview', 'fa-circle-info', renderInfoGrid([
            ['Job Number', escapeHtml(order.job_number || '-')],
            ['Customer', escapeHtml(order.customer || '-')],
            ['Carrier', escapeHtml(carrierOptionLabel(order.carrier || 'LTL / Other'))],
            ['Payment Type', escapeHtml(order.payment_type || '-')],
            ['Shipped Date', formatDateTimeDisplay(order.shipped_date)],
            ['Ship To Address', escapeHtml(order.ship_to_address || '-')]
        ]));
    }
    if (isPickupOrder(order)) {
        return renderDetailSection('Overview', 'fa-circle-info', renderInfoGrid([
            ['Job Number', escapeHtml(order.job_number || '-')],
            ['Customer', escapeHtml(order.customer_name || '-')],
            ['Handled By', escapeHtml(order.handled_by || '-')],
            ['Pick Up Date', formatDateTimeDisplay(order.pickup_date)]
        ]));
    }
    if (isWarrantyOrder(order)) {
        return renderDetailSection('Overview', 'fa-circle-info', renderInfoGrid([
            ['Job Number', escapeHtml(order.job_number || '-')],
            ['Order Type', escapeHtml(order.order_type || '-')],
            ['Claim Type', escapeHtml(order.claim_type || '-')],
            ['Original Order ID', escapeHtml(order.original_order_id || '-')],
            ['Customer Name', escapeHtml(order.customer_name || '-')],
            ['Approved ID', escapeHtml(order.approved_id || '-')]
        ]));
    }
    return renderDetailSection('Overview', 'fa-circle-info', renderInfoGrid([
        ['Job Number', escapeHtml(order.job_number || '-')],
        ['Customer Name', escapeHtml(order.customer_name || '-')],
        ['Requested By', escapeHtml(order.requested_by || '-')],
        ['Inspected By', escapeHtml(order.inspected_by || '-')]
    ]));
}

function renderRecordNotes(order) {
    if (isReceivingOrder(order)) {
        return renderDetailSection('Description', 'fa-align-left', renderTextBlock(order.item_description, 'No description logged.')) +
            renderDetailSection('Notes', 'fa-note-sticky', renderTextBlock(order.notes, 'No receiving notes logged.'));
    }
    if (isTrailerOrder(order)) return order.has_issue ? '' : renderDetailSection('Notes', 'fa-note-sticky', renderTextBlock(order.issue_description, 'No issue reported.'));
    if (isOutboundOrder(order)) return renderDetailSection('Notes', 'fa-note-sticky', renderTextBlock(order.notes, 'No notes logged.'));
    if (isPickupOrder(order)) return renderDetailSection('Comments', 'fa-comment-dots', renderTextBlock(order.notes, 'No comments logged.'));
    if (isWarrantyOrder(order)) {
        return renderDetailSection('Reported Issue', 'fa-triangle-exclamation', renderTextBlock(order.reported_issue, 'No issue logged.'), order.status === 'Denied' ? '' : '') +
            renderDetailSection('Warranty Notes', 'fa-note-sticky', renderTextBlock(order.warranty_notes, 'No warranty notes logged.'));
    }
    return renderDetailSection('Inspection Notes', 'fa-note-sticky', renderTextBlock(order.notes, 'No inspection notes logged.'));
}

// Active record details renderer
function viewOrderDetails(orderId) {
    const order = orders.find(o => o.id == orderId);
    if (!order) return;

    configureDetailDrawer(order);
    setRecordEditHandlers(order);

    document.getElementById('viewOrderPOTitle').textContent = getRecordReference(order);
    document.getElementById('viewOrderSubtitle').textContent = getRecordDetailSubtitle(order);

    const content = document.getElementById('orderDetailsContent');
    content.innerHTML = `<div class="record-detail-shell">
        ${renderActionSection(order)}
        ${buildRecordTimeline(order)}
        ${renderRecordOverview(order)}
        ${renderIssueSection(order)}
        ${renderFilesSection(order)}
        ${renderRecordNotes(order)}
        ${renderStatusHistoryCompact(order)}
    </div>`;

    showModal('modalViewOrderDetails');
    renderDetailPhotoPreviewStrip(order);
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
    setupMultipleUpload(
        'orderDropZone',
        'orderPackingSlipUpload',
        'orderFileSelectionStatus',
        'orderSelectedFileName',
        'btnRemoveOrderFile',
        (files) => { selectedPackingSlipFile = files; },
        false
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
    
    // 4. Shipped Out: freight condition photos
    setupMultipleUpload(
        'outboundPhotoDropZone',
        'outboundPhotoUpload',
        'outboundPhotoSelectionStatus',
        'outboundSelectedPhotosName',
        'btnRemoveOutboundPhotos',
        (files) => { selectedOutboundPhotoFiles = files; },
        true
    );

    // 5. Customer Pick Up: mandatory handoff photos
    setupMultipleUpload(
        'pickupPhotoDropZone',
        'pickupPhotoUpload',
        'pickupPhotoSelectionStatus',
        'pickupSelectedPhotosName',
        'btnRemovePickupPhotos',
        (files) => { selectedPickupPhotoFiles = files; },
        true
    );

    setupTrailerDocumentUpload();
    setupMultipleUpload(
        'trailerIssuePhotoDropZone',
        'trailerIssuePhotoUpload',
        'trailerIssuePhotoSelectionStatus',
        'trailerSelectedIssuePhotosName',
        'btnRemoveTrailerIssuePhotos',
        (files) => {
            selectedTrailerIssuePhotos = files;
            renderTrailerIssueThumbnails();
        },
        true
    );
}

function setupTrailerDocumentUpload() {
    const dropZone = document.getElementById('trailerDocsDropZone');
    const input = document.getElementById('trailerDocsUpload');
    const status = document.getElementById('trailerDocsSelectionStatus');
    const text = document.getElementById('trailerSelectedDocsName');
    const clear = document.getElementById('btnRemoveTrailerDocs');
    if (!dropZone || !input) return;

    const chooseFiles = files => {
        const valid = Array.from(files).filter(file => ['pdf', 'xls', 'xlsx'].includes(file.name.split('.').pop().toLowerCase()));
        if (!valid.length) {
            alert('Please select PDF, XLS, or XLSX documents.');
            return;
        }
        selectedTrailerDocs = valid;
        input.value = '';
        dropZone.classList.add('hidden');
        status.classList.remove('hidden');
        text.textContent = `${valid.length} document${valid.length > 1 ? 's' : ''} selected: ${valid.map(file => file.name).join(', ')}`;
    };

    ['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.remove('dragover');
    }));
    dropZone.addEventListener('drop', event => chooseFiles(event.dataTransfer.files));
    dropZone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => chooseFiles(input.files));
    clear.addEventListener('click', event => {
        event.stopPropagation();
        selectedTrailerDocs = 'deleted';
        input.value = '';
        dropZone.classList.remove('hidden');
        status.classList.add('hidden');
        text.textContent = 'No files selected';
    });
}

function setupSingleUpload(zoneId, inputId, statusId, textId, clearId, setFileCallback) {
    const dropZone = document.getElementById(zoneId);
    const fileInput = document.getElementById(inputId);
    const statusEl = document.getElementById(statusId);
    const textEl = document.getElementById(textId);
    const clearBtn = document.getElementById(clearId);
    let selectionVersion = 0;
    
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
        selectionVersion++;
        setFileCallback('deleted');
        fileInput.value = '';
        dropZone.classList.remove('hidden');
        statusEl.classList.add('hidden');
        textEl.textContent = 'No file selected';
    });
    
    async function handleSingleFileSelection(file) {
        const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            alert('Invalid file format. Please upload PDF, PNG or JPEG/JPG images.');
            return;
        }
        const currentVersion = ++selectionVersion;
        setFileCallback(file);
        textEl.textContent = file.type.startsWith('image/') ? 'Optimizing image...' : 'Preparing file...';
        dropZone.classList.add('hidden');
        statusEl.classList.remove('hidden');
        const preparedFile = await compressImageFile(file);
        if (currentVersion !== selectionVersion) return;
        setFileCallback(preparedFile);
        
        const fileIcon = statusEl.querySelector('.file-icon');
        if (fileIcon) {
            if (preparedFile.type === 'application/pdf') {
                fileIcon.className = 'fa-regular fa-file-pdf file-icon';
            } else {
                fileIcon.className = 'fa-regular fa-file-image file-icon';
            }
        }
        
        textEl.textContent = `${preparedFile.name} (${formatBytes(preparedFile.size)})`;
    }
}

function setupMultipleUpload(zoneId, inputId, statusId, textId, clearId, setFilesCallback, isImageOnly = false) {
    const dropZone = document.getElementById(zoneId);
    const fileInput = document.getElementById(inputId);
    const statusEl = document.getElementById(statusId);
    const textEl = document.getElementById(textId);
    const clearBtn = document.getElementById(clearId);
    let selectionVersion = 0;
    
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
        selectionVersion++;
        setFilesCallback('deleted');
        fileInput.value = '';
        dropZone.classList.remove('hidden');
        statusEl.classList.add('hidden');
        textEl.textContent = 'No files selected';
        if (isImageOnly && zoneId === 'osdDropZone') {
            clearOsdThumbnails();
        }
    });
    
    async function handleMultipleFilesSelection(files) {
        let validFiles = [];
        if (isImageOnly) {
            validFiles = files.filter(f => f.type.startsWith('image/'));
            if (validFiles.length === 0) {
                alert('Invalid files. Please upload images only.');
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
        const currentVersion = ++selectionVersion;
        setFilesCallback(validFiles);
        textEl.textContent = 'Optimizing photos...';
        dropZone.classList.add('hidden');
        statusEl.classList.remove('hidden');
        const preparedFiles = await Promise.all(validFiles.map(compressImageFile));
        if (currentVersion !== selectionVersion) return;
        setFilesCallback(preparedFiles);
        
        const suffix = isImageOnly ? ' image' : ' file';
        const fileNamesList = preparedFiles.map(f => f.name).join(', ');
        const totalSize = preparedFiles.reduce((sum, file) => sum + file.size, 0);
        textEl.textContent = `${preparedFiles.length}${suffix}${preparedFiles.length > 1 ? 's' : ''} selected (${formatBytes(totalSize)} total: ${fileNamesList})`;
        
        if (isImageOnly && zoneId === 'osdDropZone') {
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
    const pickupSelect = document.getElementById('pickupHandledBy');
    const inspectionRequestedSelect = document.getElementById('inspectionRequestedBy');
    if (!orderedSelect || !receivedSelect || !pickupSelect) return;
    
    const orderedValue = orderedSelect.value;
    const receivedValue = receivedSelect.value;
    const pickupValue = pickupSelect.value;
    const inspectionRequestedValue = inspectionRequestedSelect?.value || '';
    
    // Preserve placeholder
    const placeholder1 = orderedSelect.options[0];
    const placeholder2 = receivedSelect.options[0];
    const pickupPlaceholder = pickupSelect.options[0];
    const inspectionPlaceholder = inspectionRequestedSelect?.options[0];
    
    orderedSelect.innerHTML = '';
    receivedSelect.innerHTML = '';
    pickupSelect.innerHTML = '';
    if (inspectionRequestedSelect) inspectionRequestedSelect.innerHTML = '';
    
    orderedSelect.appendChild(placeholder1);
    receivedSelect.appendChild(placeholder2);
    pickupSelect.appendChild(pickupPlaceholder);
    if (inspectionRequestedSelect && inspectionPlaceholder) inspectionRequestedSelect.appendChild(inspectionPlaceholder);
    
    const list = [...(settings.employees || DEFAULT_SETTINGS.employees)].sort((a, b) => a.localeCompare(b));
    list.forEach(emp => {
        const opt1 = document.createElement('option');
        opt1.value = emp;
        opt1.textContent = emp;
        orderedSelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = emp;
        opt2.textContent = emp;
        receivedSelect.appendChild(opt2);

        if (inspectionRequestedSelect) {
            const inspectionOption = document.createElement('option');
            inspectionOption.value = emp;
            inspectionOption.textContent = emp;
            inspectionRequestedSelect.appendChild(inspectionOption);
        }
    });
    
    if (orderedValue) orderedSelect.value = orderedValue;
    if (receivedValue) receivedSelect.value = receivedValue;

    const pickupList = [...(settings.pickupEmployees || DEFAULT_SETTINGS.pickupEmployees)].sort((a, b) => a.localeCompare(b));
    pickupList.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp;
        option.textContent = emp;
        pickupSelect.appendChild(option);
    });
    if (pickupValue) pickupSelect.value = pickupValue;
    if (inspectionRequestedValue && inspectionRequestedSelect) inspectionRequestedSelect.value = inspectionRequestedValue;
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
    showModal('modalAdminAuth');
}

// Verify Admin Passcode and forward to settings
async function handleAdminAuthSubmit(e) {
    e.preventDefault();
    const passInput = document.getElementById('adminPasswordInput').value;
    const passHash = await hashAdminPasscode(passInput);
    const correctHash = settings.adminPasswordHash || DEFAULT_SETTINGS.adminPasswordHash;
    
    if (passHash === correctHash) {
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
    document.getElementById('adminEmployees').value = [...(settings.employees || [])].sort((a, b) => a.localeCompare(b)).join('\n');
    document.getElementById('adminPickupEmployees').value = [...(settings.pickupEmployees || DEFAULT_SETTINGS.pickupEmployees)].sort((a, b) => a.localeCompare(b)).join('\n');
    document.getElementById('adminSubjectTemplate').value = settings.emailSubjectTemplate || '';
    document.getElementById('adminBodyTemplate').value = settings.emailBodyTemplate || '';
    document.getElementById('adminTrailerEmails').value = settings.trailerEmailRecipients || DEFAULT_SETTINGS.trailerEmailRecipients;
    document.getElementById('adminTrailerSubject').value = settings.trailerEmailSubject || DEFAULT_SETTINGS.trailerEmailSubject;
    document.getElementById('adminTrailerBody').value = settings.trailerEmailBody || DEFAULT_SETTINGS.trailerEmailBody;
    document.getElementById('adminNewPassword').value = '';
    
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

    showModal('modalAdminSettings');
}

// Save Admin settings to Supabase
async function handleAdminSettingsSubmit(e) {
    e.preventDefault();
    
    const emails = document.getElementById('adminEmails').value.trim();
    const employeesText = document.getElementById('adminEmployees').value.trim();
    const pickupEmployeesText = document.getElementById('adminPickupEmployees').value.trim();
    const subjectTemplate = document.getElementById('adminSubjectTemplate').value.trim();
    const bodyTemplate = document.getElementById('adminBodyTemplate').value.trim();
    const trailerEmails = document.getElementById('adminTrailerEmails').value.trim();
    const trailerSubject = document.getElementById('adminTrailerSubject').value.trim();
    const trailerBody = document.getElementById('adminTrailerBody').value.trim();
    const newPass = document.getElementById('adminNewPassword').value.trim();
    
    // Save current carrier fields first
    saveAdminCarrierFields(currentAdminSelectedCarrier);
    
    // Parse employees text into array
    const employeesArray = employeesText
        .split('\n')
        .map(name => name.trim() === 'Bryan' ? 'Brian' : name.trim())
        .filter(name => name.length > 0);
    const pickupEmployeesArray = pickupEmployeesText
        .split('\n')
        .map(name => name.trim() === 'Bryan' ? 'Brian' : name.trim())
        .filter(name => name.length > 0);
        
    if (employeesArray.length === 0) {
        alert('You must provide at least one employee name.');
        return;
    }
    if (pickupEmployeesArray.length === 0) {
        alert('You must provide at least one Customer Pick Up employee.');
        return;
    }
    
    // Update settings object
    settings.managerEmails = emails;
    settings.employees = employeesArray.sort((a, b) => a.localeCompare(b));
    settings.pickupEmployees = pickupEmployeesArray.sort((a, b) => a.localeCompare(b));
    settings.emailSubjectTemplate = subjectTemplate;
    settings.emailBodyTemplate = bodyTemplate;
    settings.trailerEmailRecipients = trailerEmails;
    settings.trailerEmailSubject = trailerSubject;
    settings.trailerEmailBody = trailerBody;
    settings.carrierSupportInfo = tempCarrierSupportInfo;
    
    if (newPass) {
        settings.adminPasswordHash = await hashAdminPasscode(newPass);
        delete settings.adminPassword;
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
let currentAnnotationTarget = 'osd';
let currentAnnotationSavedMeta = null;
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
    const trailerThumbs = document.getElementById('trailerIssueThumbnailsContainer');
    if (trailerThumbs) trailerThumbs.innerHTML = '';
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

function renderTrailerIssueThumbnails() {
    const container = document.getElementById('trailerIssueThumbnailsContainer');
    if (!container) return;
    container.innerHTML = '';
    if (!Array.isArray(selectedTrailerIssuePhotos)) return;
    selectedTrailerIssuePhotos.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'osd-edit-thumbnail-container';
        const image = document.createElement('img');
        image.className = 'osd-edit-thumbnail';
        const url = URL.createObjectURL(file);
        thumbnailObjectURLs.push(url);
        image.src = url;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-osd-annotate';
        button.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Annotate';
        button.addEventListener('click', event => {
            event.preventDefault();
            openAnnotationModal(file, index, 'trailer');
        });
        item.append(image, button);
        container.appendChild(item);
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
function openAnnotationModal(file, index, target = 'osd') {
    currentAnnotationFile = file;
    currentAnnotationIndex = index;
    currentAnnotationTarget = target;
    if (target !== 'saved') currentAnnotationSavedMeta = null;
    
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
        showModal('modalPhotoAnnotation');
    }
}

async function annotateSavedPhoto(orderId, folder, filename) {
    const order = orders.find(item => item.id == orderId);
    if (!order || !filename) return;
    try {
        const { data, error } = await getSupabaseClient()
            .storage
            .from(SUPABASE_STORAGE_BUCKET)
            .download(`${folder}/${filename}`);
        if (error) throw error;
        const sourceFile = new File([data], filename, { type: data.type || 'image/png' });
        currentAnnotationSavedMeta = { orderId: order.id, folder, filename };
        openAnnotationModal(sourceFile, 0, 'saved');
    } catch (err) {
        console.error('Could not load photo for annotation:', err);
        showToast('Photo not loaded', 'The selected photo could not be opened for annotation.', 'error');
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
            if (currentAnnotationTarget === 'saved' && currentAnnotationSavedMeta) {
                uploadStorageFile(currentAnnotationSavedMeta.folder, currentAnnotationSavedMeta.filename, annotatedFile)
                    .then(async () => {
                        currentAnnotationSavedMeta = null;
                        photoPreviewCache.clear();
                        closeAnnotationModalOnly();
                        await loadGalleryFile(currentGalleryIndex);
                        showToast('Annotation saved', 'The existing photo was updated.');
                    })
                    .catch(err => {
                        console.error('Failed to save annotated photo:', err);
                        showToast('Annotation failed', 'The annotated photo could not be saved.', 'error');
                    });
            } else if (currentAnnotationTarget === 'trailer') {
                selectedTrailerIssuePhotos[currentAnnotationIndex] = annotatedFile;
                renderTrailerIssueThumbnails();
                closeAnnotationModalOnly();
            } else {
                selectedOsdFiles[currentAnnotationIndex] = annotatedFile;
                renderOsdThumbnails();
                closeAnnotationModalOnly();
            }
        }
    }, 'image/png');
}

// --- CARRIER PERFORMANCE ANALYTICS ---
function renderAnalytics() {
    const carrierStats = {};
    const CARRIERS_LIST = CARRIER_OPTIONS;
    
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
    
    orders.filter(isReceivingOrder).forEach(order => {
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
        if (isWarrantyOrder(order)) {
            return [order.job_number, order.reported_issue, order.order_type, order.claim_type, order.status, order.customer_name]
                .some(value => value && String(value).toLowerCase().includes(searchVal));
        }
        if (isInspectionOrder(order)) {
            return [order.job_number, order.customer_name, order.status, order.requested_by, order.inspected_by, order.notes]
                .some(value => value && String(value).toLowerCase().includes(searchVal));
        }
        if (isTrailerOrder(order)) {
            return [order.trip_number, order.bol_number, order.stop_number, order.trailer_number, order.weight, order.status]
                .some(value => value && String(value).toLowerCase().includes(searchVal));
        }
        if (isPickupOrder(order)) {
            return (
                (order.customer_name && order.customer_name.toLowerCase().includes(searchVal)) ||
                (order.job_number && order.job_number.toLowerCase().includes(searchVal)) ||
                (order.handled_by && order.handled_by.toLowerCase().includes(searchVal)) ||
                (order.notes && order.notes.toLowerCase().includes(searchVal))
            );
        }
        if (isOutboundOrder(order)) {
            return (
                (order.customer && order.customer.toLowerCase().includes(searchVal)) ||
                (order.job_number && order.job_number.toLowerCase().includes(searchVal)) ||
                (order.carrier && order.carrier.toLowerCase().includes(searchVal)) ||
                (order.ship_to_address && order.ship_to_address.toLowerCase().includes(searchVal))
            );
        }
        return (
            (order.po_number && order.po_number.toLowerCase().includes(searchVal)) ||
            (order.supplier && order.supplier.toLowerCase().includes(searchVal)) ||
            (order.carrier && order.carrier.toLowerCase().includes(searchVal))
        );
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 1rem;">No matching shipments.</td></tr>`;
        return;
    }
    
    filtered.forEach(order => {
        const tr = document.createElement('tr');
        
        let actionCellHtml = `
            <button type="button" class="btn btn-icon delete" onclick="adminDeleteOrder('${order.id}')" title="Delete Order" style="padding: 0.2rem 0.4rem; font-size: 0.72rem; background: var(--status-error); border-color: var(--status-error); color: white; display: flex; align-items: center; gap: 0.25rem; min-width: auto; border-radius: 4px;">
                <i class="fa-regular fa-trash-can"></i> Delete
            </button>`;
        
        const outbound = isOutboundOrder(order);
        const pickup = isPickupOrder(order);
        const trailer = isTrailerOrder(order);
        const warranty = isWarrantyOrder(order);
        const inspection = isInspectionOrder(order);
        const reference = trailer ? order.trip_number : ((outbound || pickup || warranty || inspection) ? (order.job_number || '-') : order.po_number);
        const party = trailer ? `BOL ${order.bol_number}` : ((warranty || inspection) ? (order.customer_name || '-') : (pickup ? (order.customer_name || '-') : (outbound ? order.customer : order.supplier)));
        const status = (trailer || warranty || inspection) ? order.status : (pickup ? 'Picked Up' : (outbound ? 'Shipped Out' : order.status));
        const statusClass = workflowStatusClass(status, order);
        const typeLabel = warranty ? 'WARRANTY' : (inspection ? 'INSPECTION' : (trailer ? 'TRAILER' : (pickup ? 'PICKUP' : (outbound ? 'OUT' : 'IN'))));

        tr.innerHTML = `
            <td><span class="admin-record-type">${typeLabel}</span></td>
            <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(reference)}</td>
            <td>${escapeHtml(party)}</td>
            <td>${escapeHtml(order.carrier || '-')}</td>
            <td><span class="badge ${statusClass}">${status}</span></td>
            <td>${actionCellHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Permanently delete a shipment log (Admin only)
async function adminDeleteOrder(orderId) {
    const order = orders.find(o => o.id == orderId);
    if (!order) return;
    
    const outbound = isOutboundOrder(order);
    const pickup = isPickupOrder(order);
    const trailer = isTrailerOrder(order);
    const warranty = isWarrantyOrder(order);
    const inspection = isInspectionOrder(order);
    let confirmMsg = warranty
        ? `ADMIN DELETE ACTION: Permanently delete Warranty Claim for Job ${order.job_number}?`
        : inspection
        ? `ADMIN DELETE ACTION: Permanently delete Panel Inspection for Job ${order.job_number}?`
        : trailer
        ? `ADMIN DELETE ACTION: Permanently delete Trailer Trip ${order.trip_number}?`
        : pickup
        ? `ADMIN DELETE ACTION: Permanently delete the Customer Pick Up record for Job ${order.job_number}?`
        : (outbound
            ? `ADMIN DELETE ACTION: Permanently delete the Shipped Out record for ${order.customer}?`
            : `ADMIN DELETE ACTION: Are you sure you want to permanently delete PO Number: ${order.po_number}?`);
    if (!outbound && !pickup && !trailer && !warranty && !inspection && order.status === 'Received') {
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
