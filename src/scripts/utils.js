/**
 * ============================================
 * UTILITY FUNCTIONS
 * Madison 88 IT Equipment Inventory System
 * ============================================
 * 
 * Common helper functions used throughout the application.
 */

const Utils = {
    // ===========================================
    // DATE UTILITIES
    // ===========================================
    
    /**
     * Format date to readable string
     * @param {string|Date} date - Date to format
     * @param {string} format - Format type: 'short', 'long', 'iso'
     * @returns {string} Formatted date
     */
    formatDate(date, format = 'short') {
        if (!date) return '-';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        
        const options = {
            short: { year: 'numeric', month: 'short', day: 'numeric' },
            long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
            datetime: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
            iso: null
        };
        
        if (format === 'iso') {
            return d.toISOString().split('T')[0];
        }
        
        if (format === 'datetime') {
            return d.toLocaleString('en-US', options.datetime);
        }
        
        return d.toLocaleDateString('en-US', options[format] || options.short);
    },
    
    /**
     * Get relative time (e.g., "2 days ago")
     * @param {string|Date} date - Date to compare
     * @returns {string} Relative time string
     */
    getRelativeTime(date) {
        if (!date) return '-';
        
        const d = new Date(date);
        const now = new Date();
        const diffMs = now - d;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    },
    
    /**
     * Calculate days until a date
     * @param {string|Date} date - Target date
     * @returns {number} Days until date (negative if past)
     */
    daysUntil(date) {
        if (!date) return null;
        
        const d = new Date(date);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        d.setHours(0, 0, 0, 0);
        
        return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    },
    
    // ===========================================
    // STRING UTILITIES
    // ===========================================
    
    /**
     * Capitalize first letter of string
     * @param {string} str - String to capitalize
     * @returns {string} Capitalized string
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    
    /**
     * Convert snake_case to Title Case
     * @param {string} str - String in snake_case
     * @returns {string} Title Case string
     */
    snakeToTitle(str) {
        if (!str) return '';
        return str.split('_').map(word => this.capitalize(word)).join(' ');
    },
    
    /**
     * Truncate string with ellipsis
     * @param {string} str - String to truncate
     * @param {number} length - Maximum length
     * @returns {string} Truncated string
     */
    truncate(str, length = 50) {
        if (!str) return '';
        if (str.length <= length) return str;
        return str.substring(0, length) + '...';
    },
    
    /**
     * Generate a random ID
     * @param {number} length - ID length
     * @returns {string} Random ID
     */
    generateId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    // ===========================================
    // NUMBER UTILITIES
    // ===========================================
    
    /**
     * Format number with commas
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return num.toLocaleString();
    },
    
    /**
     * Format currency
     * @param {number} amount - Amount to format
     * @param {string} currency - Currency code
     * @returns {string} Formatted currency
     */
    formatCurrency(amount, currency = 'PHP') {
        if (amount === null || amount === undefined) return '-';
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },
    
    // ===========================================
    // DOM UTILITIES
    // ===========================================
    
    /**
     * Safely get element by ID
     * @param {string} id - Element ID
     * @returns {HTMLElement|null} Element or null
     */
    $(id) {
        return document.getElementById(id);
    },
    
    /**
     * Query selector shorthand
     * @param {string} selector - CSS selector
     * @param {HTMLElement} parent - Parent element
     * @returns {HTMLElement|null} Element or null
     */
    qs(selector, parent = document) {
        return parent.querySelector(selector);
    },
    
    /**
     * Query selector all shorthand
     * @param {string} selector - CSS selector
     * @param {HTMLElement} parent - Parent element
     * @returns {NodeList} Elements
     */
    qsa(selector, parent = document) {
        return parent.querySelectorAll(selector);
    },
    
    /**
     * Create element with attributes and content
     * @param {string} tag - HTML tag
     * @param {object} attrs - Attributes
     * @param {string|HTMLElement} content - Inner content
     * @returns {HTMLElement} Created element
     */
    createElement(tag, attrs = {}, content = '') {
        const el = document.createElement(tag);
        
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    el.dataset[dataKey] = dataValue;
                });
            } else if (key.startsWith('on')) {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                el.setAttribute(key, value);
            }
        });
        
        if (typeof content === 'string') {
            el.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            el.appendChild(content);
        }
        
        return el;
    },
    
    /**
     * Show/hide element
     * @param {HTMLElement|string} el - Element or ID
     * @param {boolean} show - Show or hide
     */
    toggleVisibility(el, show) {
        const element = typeof el === 'string' ? this.$(el) : el;
        if (!element) return;
        
        if (show) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    },
    
    // ===========================================
    // FORM UTILITIES
    // ===========================================
    
    /**
     * Get form data as object
     * @param {HTMLFormElement} form - Form element
     * @returns {object} Form data
     */
    getFormData(form) {
        const formData = new FormData(form);
        const data = {};
        
        formData.forEach((value, key) => {
            // Handle multiple values (checkboxes, multi-select)
            if (data[key]) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value);
            } else {
                data[key] = value;
            }
        });
        
        return data;
    },
    
    /**
     * Populate form with data
     * @param {HTMLFormElement} form - Form element
     * @param {object} data - Data to populate
     */
    populateForm(form, data) {
        Object.entries(data).forEach(([key, value]) => {
            const field = form.elements[key];
            if (!field) return;
            
            if (field.type === 'checkbox') {
                field.checked = Boolean(value);
            } else if (field.type === 'radio') {
                const radio = form.querySelector(`input[name="${key}"][value="${value}"]`);
                if (radio) radio.checked = true;
            } else {
                field.value = value || '';
            }
        });
    },
    
    /**
     * Reset form
     * @param {HTMLFormElement} form - Form element
     */
    resetForm(form) {
        form.reset();
        // Clear any custom validation states
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.error-message').forEach(el => el.remove());
    },
    
    // ===========================================
    // VALIDATION UTILITIES
    // ===========================================
    
    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Is valid
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    /**
     * Check if value is empty
     * @param {*} value - Value to check
     * @returns {boolean} Is empty
     */
    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    },
    
    // ===========================================
    // STORAGE UTILITIES
    // ===========================================
    
    /**
     * Save to localStorage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     */
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error('Storage error:', e);
            }
        },
        
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('Storage error:', e);
                return defaultValue;
            }
        },
        
        remove(key) {
            localStorage.removeItem(key);
        },
        
        clear() {
            localStorage.clear();
        }
    },
    
    // ===========================================
    // DEBOUNCE & THROTTLE
    // ===========================================
    
    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Limit in ms
     * @returns {Function} Throttled function
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // ===========================================
    // URL UTILITIES
    // ===========================================
    
    /**
     * Get URL parameters
     * @returns {object} URL parameters
     */
    getUrlParams() {
        const params = {};
        const searchParams = new URLSearchParams(window.location.search);
        for (const [key, value] of searchParams) {
            params[key] = value;
        }
        return params;
    },
    
    /**
     * Update URL parameters without reload
     * @param {object} params - Parameters to set
     */
    setUrlParams(params) {
        const url = new URL(window.location);
        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') {
                url.searchParams.delete(key);
            } else {
                url.searchParams.set(key, value);
            }
        });
        window.history.replaceState({}, '', url);
    },
    
    // ===========================================
    // COPY TO CLIPBOARD
    // ===========================================
    
    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} Success
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Copy failed:', err);
            return false;
        }
    },
    
    // ===========================================
    // DOWNLOAD UTILITIES
    // ===========================================
    
    /**
     * Download data as file
     * @param {string|Blob} data - Data to download
     * @param {string} filename - File name
     * @param {string} type - MIME type
     */
    downloadFile(data, filename, type = 'application/octet-stream') {
        const blob = data instanceof Blob ? data : new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    // ===========================================
    // PERMISSION UTILITIES
    // ===========================================
    
    /**
     * Check a permission setting from system_settings table
     * @param {object} supabase - Supabase client instance
     * @param {string} settingKey - The setting_key to check
     * @returns {Promise<boolean>} True if enabled, false otherwise
     */
    async checkPermission(supabase, settingKey) {
        try {
            const { data } = await supabase
                .from('system_settings')
                .select('setting_value')
                .eq('setting_key', settingKey)
                .single();
            
            return data ? data.setting_value === 'true' : true; // Default to true if not found
        } catch (error) {
            console.error(`Error checking permission ${settingKey}:`, error);
            return true; // Fail open - allow access on error
        }
    },

    /**
     * Legacy wrapper — checks IT staff reports permission
     * @param {object} supabase - Supabase client instance
     * @returns {Promise<boolean>} True if allowed
     */
    async checkReportsPermission(supabase) {
        return this.checkPermission(supabase, 'it_staff_can_access_reports');
    },

    /**
     * Setup navigation visibility based on user role and permissions.
     * Centralised function — call from every page's init().
     * Replaces the duplicated inline nav-hiding blocks.
     *
     * Nav structure:
     *   - Main: Dashboard (always visible)
     *   - asset-management-nav: Assets, Employees, Assignments
     *   - tracking-nav: Maintenance, Lost Assets, Software Licenses
     *   - reports-nav: Reports link + Audit Logs link
     *   - admin-nav: Settings
     *
     * Role visibility:
     *   Executive  → Dashboard, Reports, Audit Logs, Settings
     *   Admin      → All sections
     *   IT Staff   → All except Settings; Reports/Audit conditional
     *   Viewer     → Dashboard only
     *
     * @param {object} currentUser - Current user with role property
     * @param {object} supabase - Supabase client instance
     */
    async setupNavigation(currentUser, supabase) {
        const assetManagementNav = document.getElementById('asset-management-nav');
        const trackingNav = document.getElementById('tracking-nav');
        const reportsNav = document.getElementById('reports-nav');
        const adminNav = document.getElementById('admin-nav');
        const reportsLink = reportsNav?.querySelector('a[href="reports.html"]');
        const auditLogsLink = document.getElementById('audit-logs-link');

        switch (currentUser.role) {
            case 'executive':
                // Executive: Dashboard, Reports, Audit Logs, Settings
                assetManagementNav?.classList.add('hidden');
                trackingNav?.classList.add('hidden');
                // reports-nav and admin-nav stay visible
                break;

            case 'admin':
                // Admin: all sections visible
                break;

            case 'it_staff': {
                // IT Staff: hide admin; conditionally show reports & audit logs
                adminNav?.classList.add('hidden');

                // Check both permissions in parallel
                const [hasReports, hasAuditLogs] = await Promise.all([
                    this.checkPermission(supabase, 'it_staff_can_access_reports'),
                    this.checkPermission(supabase, 'it_staff_can_access_audit_logs')
                ]);

                if (!hasReports && !hasAuditLogs) {
                    // Neither — hide entire section
                    reportsNav?.classList.add('hidden');
                } else {
                    // Show section, hide individual links as needed
                    if (!hasReports && reportsLink) {
                        reportsLink.classList.add('hidden');
                    }
                    if (!hasAuditLogs && auditLogsLink) {
                        auditLogsLink.classList.add('hidden');
                    }
                }
                break;
            }

            case 'viewer':
                // Viewer: dashboard only
                assetManagementNav?.classList.add('hidden');
                trackingNav?.classList.add('hidden');
                reportsNav?.classList.add('hidden');
                adminNav?.classList.add('hidden');
                break;

            default:
                // Unknown role — hide everything except dashboard
                assetManagementNav?.classList.add('hidden');
                trackingNav?.classList.add('hidden');
                reportsNav?.classList.add('hidden');
                adminNav?.classList.add('hidden');
                break;
        }
    },

    /**
     * Legacy wrapper — kept for backward compatibility.
     * Prefer setupNavigation() which handles everything.
     * @param {object} currentUser - Current user object with role
     * @param {object} supabase - Supabase client instance
     */
    async handleReportsNavVisibility(currentUser, supabase) {
        // Now handled by setupNavigation — this is a no-op if setupNavigation was already called.
        // Kept for safety in case any page still calls it.
    },

    // ===========================================
    // KEYBOARD NAVIGATION FOR DROPDOWNS
    // ===========================================

    /**
     * Enable keyboard incremental search for select dropdowns
     * Allows typing to quickly find options anywhere in the text
     * Examples: "A" → "Available", "As" → "Assigned", "ged" → "Damaged", "air" → "Repair"
     * @param {HTMLSelectElement|string} selectElement - Select element or selector
     * @param {number} resetDelay - Time in ms before resetting search buffer (default: 1000)
     */
    enableSelectKeyboardSearch(selectElement, resetDelay = 1000) {
        const select = typeof selectElement === 'string' 
            ? document.querySelector(selectElement) 
            : selectElement;
        
        if (!select || select.tagName !== 'SELECT') {
            console.warn('Invalid select element provided to enableSelectKeyboardSearch');
            return;
        }

        let searchBuffer = '';
        let searchTimeout = null;

        select.addEventListener('keydown', (e) => {
            // Only handle alphanumeric keys and space
            if (e.key.length === 1 && /[a-zA-Z0-9 ]/.test(e.key)) {
                e.preventDefault();
                
                // Clear existing timeout
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                }

                // Add key to search buffer
                searchBuffer += e.key.toLowerCase();

                // Find matching option (substring match anywhere in text)
                const options = Array.from(select.options);
                const matchingOption = options.find(option => {
                    const text = option.textContent.toLowerCase();
                    return text.includes(searchBuffer);
                });

                if (matchingOption) {
                    select.value = matchingOption.value;
                    
                    // Highlight the option in the dropdown
                    matchingOption.selected = true;
                    
                    // Trigger change event if value changed
                    const event = new Event('change', { bubbles: true });
                    select.dispatchEvent(event);
                }

                // Reset search buffer after delay
                searchTimeout = setTimeout(() => {
                    searchBuffer = '';
                }, resetDelay);
            } else if (e.key === 'Backspace' && searchBuffer.length > 0) {
                // Allow backspace to remove last character from search
                e.preventDefault();
                searchBuffer = searchBuffer.slice(0, -1);
                
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                }
                
                searchTimeout = setTimeout(() => {
                    searchBuffer = '';
                }, resetDelay);
            } else if (e.key === 'Escape') {
                // Clear search buffer on Escape
                searchBuffer = '';
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                }
            }
        });
    },

    /**
     * Apply keyboard search to all select elements on the page
     * @param {string} selector - CSS selector for select elements (default: 'select')
     * @param {number} resetDelay - Time in ms before resetting search buffer
     */
    enableAllSelectsKeyboardSearch(selector = 'select', resetDelay = 1000) {
        const selects = document.querySelectorAll(selector);
        selects.forEach(select => {
            this.enableSelectKeyboardSearch(select, resetDelay);
        });
    },

    // ===========================================
    // FORM SUBMISSION UTILITIES
    // ===========================================

    /**
     * Handle form submission with loading state and duplicate prevention
     * @param {HTMLButtonElement} button - The submit button element
     * @param {Function} submitFunction - Async function to execute for submission
     * @param {string} loadingText - Text to show during loading (default: 'Saving...')
     * @returns {Promise<boolean>} True if submission successful, false otherwise
     */
    async handleFormSubmit(button, submitFunction, loadingText = 'Saving...') {
        // Prevent multiple submissions
        if (button.disabled) return false;

        // Store original button content
        const originalContent = button.innerHTML;
        const originalText = button.textContent;

        try {
            // Disable button and show loading state
            button.disabled = true;
            button.innerHTML = `
                <svg class="animate-spin h-4 w-4 inline-block mr-2" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                ${loadingText}
            `;
            button.style.cursor = 'not-allowed';
            button.classList.add('opacity-75');

            // Execute the submission function
            await submitFunction();

            return true;
        } catch (error) {
            // Error will be handled by the calling function
            throw error;
        } finally {
            // Re-enable button and restore original content
            button.disabled = false;
            button.innerHTML = originalContent;
            button.style.cursor = 'pointer';
            button.classList.remove('opacity-75');
        }
    },

    /**
     * Set button loading state manually
     * @param {HTMLButtonElement} button - The button element
     * @param {boolean} isLoading - True to show loading, false to restore
     * @param {string} loadingText - Text to show during loading
     */
    setButtonLoading(button, isLoading, loadingText = 'Processing...') {
        if (!button._originalContent && isLoading) {
            // Store original content on first load
            button._originalContent = button.innerHTML;
        }

        if (isLoading) {
            button.disabled = true;
            button.innerHTML = `
                <svg class="animate-spin h-4 w-4 inline-block mr-2" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                ${loadingText}
            `;
            button.style.cursor = 'not-allowed';
            button.classList.add('opacity-75');
        } else {
            button.disabled = false;
            button.innerHTML = button._originalContent || button.innerHTML;
            button.style.cursor = 'pointer';
            button.classList.remove('opacity-75');
            delete button._originalContent;
        }
    }
};

// Export for use in other modules
window.Utils = Utils;

// ES Module export
export { Utils };
export default Utils;

// Named exports for convenience
export const formatDate = Utils.formatDate.bind(Utils);
export const getRelativeTime = Utils.getRelativeTime.bind(Utils);
export const formatCurrency = Utils.formatCurrency.bind(Utils);
