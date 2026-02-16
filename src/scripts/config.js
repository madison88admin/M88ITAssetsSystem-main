/**
 * ============================================
 * CONFIGURATION FILE
 * Madison 88 IT Equipment Inventory System
 * ============================================
 * 
 * This file contains all configuration settings.
 * Update the Supabase credentials below with your own.
 */

// Import Supabase from npm package (bundled by Vite, not exposed as separate CDN source)
import { createClient } from '@supabase/supabase-js';

// ===========================================
// SUPABASE CONFIGURATION
// ===========================================
// Credentials are loaded from .env file (VITE_ prefix required)
// See .env.example for the template

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that environment variables are set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        '❌ Missing Supabase credentials!\n' +
        'Please create a .env file in the project root with:\n' +
        '  VITE_SUPABASE_URL=your_supabase_url\n' +
        '  VITE_SUPABASE_ANON_KEY=your_supabase_anon_key\n' +
        'See .env.example for reference.'
    );
}

// Create and export the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Also make available globally for non-module scripts
window.supabase = supabase;

// Export URL for reference
export { SUPABASE_URL };

// ===========================================
// APPLICATION SETTINGS
// ===========================================

const APP_CONFIG = {
    // Application name
    appName: 'Madison 88 IT Assets',
    
    // Company name
    companyName: 'Madison 88',
    
    // Version
    version: '1.0.0',
    
    // Default pagination
    itemsPerPage: 25,
    
    // Asset refresh cycle (years)
    refreshCycleYears: 5,
    
    // Warranty alert threshold (days)
    warrantyAlertDays: 90,
    
    // Date format
    dateFormat: 'YYYY-MM-DD',
    
    // Currency
    currency: 'USD',
    
    // Theme
    defaultTheme: 'dark'
};

// ===========================================
// STATUS CONFIGURATIONS
// ===========================================

const ASSET_STATUS = {
    available: { label: 'Available', color: 'green', icon: 'check-circle' },
    assigned: { label: 'Assigned', color: 'blue', icon: 'user' },
    under_repair: { label: 'Under Repair', color: 'yellow', icon: 'wrench' },
    lost: { label: 'Lost', color: 'red', icon: 'x-circle' },
    damaged: { label: 'Damaged', color: 'orange', icon: 'alert-triangle' },
    decommissioned: { label: 'Decommissioned', color: 'gray', icon: 'archive' }
};

const MAINTENANCE_STATUS = {
    pending: { label: 'Pending', color: 'yellow', icon: 'clock' },
    in_progress: { label: 'In Progress', color: 'blue', icon: 'loader' },
    completed: { label: 'Completed', color: 'green', icon: 'check' },
    cancelled: { label: 'Cancelled', color: 'gray', icon: 'x' }
};

const USER_ROLES = {
    executive: { label: 'Executive', level: 4 },
    admin: { label: 'Administrator', level: 3 },
    it_staff: { label: 'IT Staff', level: 2 },
    viewer: { label: 'Viewer', level: 1 }
};

// ===========================================
// REGION CONFIGURATION
// ===========================================

const REGIONS = {
    PH: { label: 'Madison88 IT Assets in the Philippines', country: 'Philippines' },
    ID: { label: 'Madison88 IT Assets in Indonesia', country: 'Indonesia' },
    CN: { label: 'Madison88 IT Assets in China', country: 'China' },
    US: { label: 'Madison88 IT Assets in United States', country: 'United States' }
};

// ===========================================
// NOTIFICATION TYPES
// ===========================================

const NOTIFICATION_TYPES = {
    info: { icon: 'info', color: 'blue' },
    warning: { icon: 'alert-triangle', color: 'yellow' },
    error: { icon: 'x-circle', color: 'red' },
    success: { icon: 'check-circle', color: 'green' }
};

// ===========================================
// EXPORT CONFIGURATION
// Don't modify unless necessary
// ===========================================

// Export all configurations as named exports
export { APP_CONFIG, ASSET_STATUS, MAINTENANCE_STATUS, USER_ROLES, REGIONS, NOTIFICATION_TYPES };

// Also make config available globally for non-module scripts
window.CONFIG = {
    SUPABASE_URL,
    APP: APP_CONFIG,
    ASSET_STATUS,
    MAINTENANCE_STATUS,
    USER_ROLES,
    REGIONS,
    NOTIFICATION_TYPES
};

// Log success
// console.log('✅ Config loaded, Supabase client ready');
