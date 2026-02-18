/**
 * ============================================
 * UI COMPONENTS
 * Madison 88 IT Equipment Inventory System
 * ============================================
 * 
 * Reusable UI components for consistent styling.
 */

import { Utils } from './utils.js';

const Components = {
    // ===========================================
    // LOADING SCREEN
    // ===========================================
    
    /**
     * Show loading screen
     * @param {string} message - Loading message (optional)
     * @param {boolean} showCancel - Show cancel button (optional)
     */
    showLoading(message = 'Loading...', showCancel = false) {
        const loader = Utils.$('loading-screen');
        if (loader) {
            // Update message if provided
            const messageEl = loader.querySelector('p');
            if (messageEl && message) {
                messageEl.textContent = message;
            }
            
            // Add or remove cancel button
            let cancelBtn = loader.querySelector('.loading-cancel-btn');
            if (showCancel && !cancelBtn) {
                cancelBtn = Utils.createElement('button', {
                    className: 'loading-cancel-btn mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm transition-colors',
                    onclick: () => {
                        if (window.Import) {
                            window.Import.cancelImport();
                        }
                    }
                }, 'Cancel Import');
                
                const container = loader.querySelector('.text-center');
                if (container) {
                    container.appendChild(cancelBtn);
                }
            } else if (!showCancel && cancelBtn) {
                cancelBtn.remove();
            }
            
            loader.classList.remove('hidden');
            loader.classList.add('flex');
        }
    },
    
    /**
     * Hide loading screen
     */
    hideLoading() {
        const loader = Utils.$('loading-screen');
        if (loader) {
            loader.classList.add('hidden');
            loader.classList.remove('flex');
            
            // Remove cancel button
            const cancelBtn = loader.querySelector('.loading-cancel-btn');
            if (cancelBtn) {
                cancelBtn.remove();
            }
            
            // Reset message
            const messageEl = loader.querySelector('p');
            if (messageEl) {
                messageEl.textContent = 'Loading...';
            }
        }
    },
    
    /**
     * Show inline loading spinner
     * @param {HTMLElement} container - Container element
     */
    showSpinner(container) {
        const spinner = Utils.createElement('div', {
            className: 'spinner-container flex items-center justify-center p-8'
        }, `
            <div class="spinner"></div>
        `);
        container.innerHTML = '';
        container.appendChild(spinner);
    },
    
    // ===========================================
    // TOAST NOTIFICATIONS
    // ===========================================
    
    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in ms
     */
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container') || this.createToastContainer();
        
        const icons = {
            success: `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`,
            error: `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`,
            warning: `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`,
            info: `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
        };
        
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            warning: 'bg-yellow-600',
            info: 'bg-blue-600'
        };
        
        const toast = Utils.createElement('div', {
            className: `toast ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform translate-x-full transition-transform duration-300`
        }, `
            ${icons[type]}
            <span class="flex-1">${message}</span>
            <button class="shrink-0 hover:bg-white/20 rounded p-1 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        `);
        
        container.appendChild(toast);
        
        // Set up auto-close timer (15 seconds)
        let autoCloseTimer = setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }, 15000);
        
        // Handle manual close button
        const closeButton = toast.querySelector('button');
        closeButton.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        });
        
        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full');
        });
    },
    
    /**
     * Create toast container
     * @returns {HTMLElement} Toast container
     */
    createToastContainer() {
        const container = Utils.createElement('div', {
            id: 'toast-container',
            className: 'fixed top-4 right-4 z-50 flex flex-col gap-2'
        });
        document.body.appendChild(container);
        return container;
    },
    
    // ===========================================
    // MODAL DIALOGS
    // ===========================================
    
    /**
     * Show modal dialog
     * @param {object} options - Modal options
     * @returns {Promise} Resolves with user action
     */
    showModal({ title, content, type = 'info', confirmText = 'Confirm', cancelText = 'Cancel', showCancel = true }) {
        return new Promise((resolve) => {
            const overlay = Utils.createElement('div', {
                className: 'modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'
            });
            
            const icons = {
                info: `<div class="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center mb-4"><svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`,
                warning: `<div class="w-12 h-12 rounded-full bg-yellow-600/20 flex items-center justify-center mb-4"><svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`,
                danger: `<div class="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center mb-4"><svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`,
                success: `<div class="w-12 h-12 rounded-full bg-green-600/20 flex items-center justify-center mb-4"><svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>`
            };
            
            const confirmColors = {
                info: 'bg-blue-600 hover:bg-blue-700',
                warning: 'bg-yellow-600 hover:bg-yellow-700',
                danger: 'bg-red-600 hover:bg-red-700',
                success: 'bg-green-600 hover:bg-green-700'
            };
            
            const modal = Utils.createElement('div', {
                className: 'modal bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 transform scale-95 opacity-0 transition-all duration-200'
            }, `
                <div class="text-center">
                    ${icons[type] || icons.info}
                    <h3 class="text-xl font-semibold text-white mb-2">${title}</h3>
                    <p class="text-slate-300 mb-6">${content}</p>
                </div>
                <div class="flex gap-3 justify-center">
                    ${showCancel ? `<button class="modal-cancel px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors">${cancelText}</button>` : ''}
                    <button class="modal-confirm px-4 py-2 rounded-lg ${confirmColors[type] || confirmColors.info} text-white transition-colors">${confirmText}</button>
                </div>
            `);
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            // Animate in
            requestAnimationFrame(() => {
                modal.classList.remove('scale-95', 'opacity-0');
            });
            
            // Handle clicks
            const close = (result) => {
                modal.classList.add('scale-95', 'opacity-0');
                setTimeout(() => overlay.remove(), 200);
                resolve(result);
            };
            
            modal.querySelector('.modal-confirm')?.addEventListener('click', () => close(true));
            modal.querySelector('.modal-cancel')?.addEventListener('click', () => close(false));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            });
        });
    },
    
    /**
     * Show confirmation dialog
     * @param {string} message - Confirmation message
     * @returns {Promise<boolean>} User's choice
     */
    confirm(message, title = 'Confirm Action') {
        return this.showModal({
            title,
            content: message,
            type: 'warning',
            confirmText: 'Yes, Continue',
            cancelText: 'Cancel'
        });
    },
    
    /**
     * Show delete confirmation
     * @param {string} itemName - Item being deleted
     * @returns {Promise<boolean>} User's choice
     */
    confirmDelete(itemName) {
        return this.showModal({
            title: 'Delete Item',
            content: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
            type: 'danger',
            confirmText: 'Delete',
            cancelText: 'Cancel'
        });
    },
    
    // ===========================================
    // STATUS BADGES
    // ===========================================
    
    /**
     * Create status badge
     * @param {string} status - Status key
     * @param {string} type - Badge type: 'asset', 'maintenance'
     * @returns {string} HTML string
     */
    statusBadge(status, type = 'asset') {
        const config = type === 'asset' ? CONFIG.ASSET_STATUS : CONFIG.MAINTENANCE_STATUS;
        const statusConfig = config[status] || { label: status, color: 'gray' };
        
        const colors = {
            green: 'bg-green-600/20 text-green-400',
            blue: 'bg-blue-600/20 text-blue-400',
            yellow: 'bg-yellow-600/20 text-yellow-400',
            red: 'bg-red-600/20 text-red-400',
            orange: 'bg-orange-600/20 text-orange-400',
            gray: 'bg-slate-600/20 text-slate-400'
        };
        
        return `<span class="px-2 py-1 rounded-full text-xs font-medium ${colors[statusConfig.color]}">${statusConfig.label}</span>`;
    },
    
    /**
     * Create role badge
     * @param {string} role - User role
     * @returns {string} HTML string
     */
    roleBadge(role) {
        const roles = {
            executive: { label: 'Executive', class: 'bg-amber-600/20 text-amber-400' },
            admin: { label: 'Admin', class: 'bg-purple-600/20 text-purple-400' },
            it_staff: { label: 'IT Staff', class: 'bg-blue-600/20 text-blue-400' },
            viewer: { label: 'Viewer', class: 'bg-slate-600/20 text-slate-400' }
        };
        
        const config = roles[role] || roles.viewer;
        return `<span class="px-2 py-1 rounded-full text-xs font-medium ${config.class}">${config.label}</span>`;
    },
    
    // ===========================================
    // DATA TABLE
    // ===========================================
    
    /**
     * Create data table
     * @param {object} options - Table options
     * @returns {string} HTML string
     */
    dataTable({ columns, data, emptyMessage = 'No data found', actions = null }) {
        if (!data || data.length === 0) {
            return `
                <div class="text-center py-12">
                    <svg class="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                    </svg>
                    <p class="text-slate-400">${emptyMessage}</p>
                </div>
            `;
        }
        
        const headerCells = columns.map(col => 
            `<th class="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">${col.label}</th>`
        ).join('');
        
        const rows = data.map(row => {
            const cells = columns.map(col => {
                const value = col.render ? col.render(row[col.key], row) : (row[col.key] || '-');
                return `<td class="px-4 py-4 whitespace-nowrap text-sm text-slate-300">${value}</td>`;
            }).join('');
            
            const actionCell = actions ? `<td class="px-4 py-4 whitespace-nowrap text-sm">${actions(row)}</td>` : '';
            
            return `<tr class="hover:bg-slate-700/50 transition-colors" data-id="${row.id}">${cells}${actionCell}</tr>`;
        }).join('');
        
        return `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-slate-700">
                    <thead class="bg-slate-800">
                        <tr>${headerCells}${actions ? '<th class="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>' : ''}</tr>
                    </thead>
                    <tbody class="divide-y divide-slate-700">${rows}</tbody>
                </table>
            </div>
        `;
    },
    
    // ===========================================
    // PAGINATION
    // ===========================================
    
    /**
     * Create pagination
     * @param {object} options - Pagination options
     * @returns {string} HTML string
     */
    pagination({ currentPage, totalPages, onPageChange }) {
        if (totalPages <= 1) return '';
        
        let pages = [];
        const maxVisible = 5;
        
        if (totalPages <= maxVisible) {
            pages = Array.from({ length: totalPages }, (_, i) => i + 1);
        } else {
            if (currentPage <= 3) {
                pages = [1, 2, 3, 4, '...', totalPages];
            } else if (currentPage >= totalPages - 2) {
                pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            } else {
                pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
            }
        }
        
        const pageButtons = pages.map(page => {
            if (page === '...') {
                return `<span class="px-3 py-2 text-slate-500">...</span>`;
            }
            const isActive = page === currentPage;
            return `
                <button 
                    class="pagination-btn px-3 py-2 rounded-lg ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'} transition-colors"
                    data-page="${page}"
                    ${isActive ? 'disabled' : ''}
                >${page}</button>
            `;
        }).join('');
        
        return `
            <div class="flex items-center justify-between px-4 py-3 border-t border-slate-700">
                <div class="text-sm text-slate-400">
                    Page ${currentPage} of ${totalPages}
                </div>
                <div class="flex items-center gap-1">
                    <button 
                        class="pagination-btn px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        data-page="${currentPage - 1}"
                        ${currentPage === 1 ? 'disabled' : ''}
                    >Previous</button>
                    ${pageButtons}
                    <button 
                        class="pagination-btn px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        data-page="${currentPage + 1}"
                        ${currentPage === totalPages ? 'disabled' : ''}
                    >Next</button>
                </div>
            </div>
        `;
    },
    
    // ===========================================
    // CARDS
    // ===========================================
    
    /**
     * Create stat card
     * @param {object} options - Card options
     * @returns {string} HTML string
     */
    statCard({ title, value, icon, color = 'blue', change = null, link = null }) {
        const colors = {
            blue: 'from-blue-600 to-blue-800',
            green: 'from-green-600 to-green-800',
            yellow: 'from-yellow-600 to-yellow-800',
            red: 'from-red-600 to-red-800',
            purple: 'from-purple-600 to-purple-800'
        };
        
        const changeHtml = change !== null ? `
            <div class="flex items-center gap-1 text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${change >= 0 ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'}"></path>
                </svg>
                <span>${Math.abs(change)}%</span>
            </div>
        ` : '';
        
        const wrapper = link ? 'a' : 'div';
        const linkAttr = link ? `href="${link}"` : '';
        
        return `
            <${wrapper} ${linkAttr} class="stat-card bg-linear-to-br ${colors[color]} rounded-xl p-6 shadow-lg ${link ? 'hover:scale-105 transition-transform cursor-pointer' : ''}">
                <div class="flex items-center justify-between mb-4">
                    <div class="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
                        ${icon}
                    </div>
                    ${changeHtml}
                </div>
                <div class="text-3xl font-bold text-white mb-1">${value}</div>
                <div class="text-white/70 text-sm">${title}</div>
            </${wrapper}>
        `;
    },
    
    /**
     * Create alert/notification card
     * @param {object} options - Alert options
     * @returns {string} HTML string
     */
    alertCard({ title, message, type = 'info', dismissible = true }) {
        const configs = {
            info: { bg: 'bg-blue-600/10 border-blue-600/30', icon: 'text-blue-400' },
            warning: { bg: 'bg-yellow-600/10 border-yellow-600/30', icon: 'text-yellow-400' },
            error: { bg: 'bg-red-600/10 border-red-600/30', icon: 'text-red-400' },
            success: { bg: 'bg-green-600/10 border-green-600/30', icon: 'text-green-400' }
        };
        
        const config = configs[type] || configs.info;
        
        return `
            <div class="alert-card ${config.bg} border rounded-lg p-4 flex items-start gap-3">
                <div class="${config.icon} mt-0.5">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <div class="flex-1">
                    <h4 class="font-medium text-white">${title}</h4>
                    <p class="text-sm text-slate-300 mt-1">${message}</p>
                </div>
                ${dismissible ? `
                    <button class="alert-dismiss text-slate-400 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                ` : ''}
            </div>
        `;
    },
    
    // ===========================================
    // FORM COMPONENTS
    // ===========================================
    
    /**
     * Create select dropdown with options
     * @param {object} options - Select options
     * @returns {string} HTML string
     */
    select({ id, name, label, options, value = '', required = false, placeholder = 'Select...' }) {
        const optionsHtml = options.map(opt => 
            `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
        ).join('');
        
        return `
            <div class="form-group">
                <label for="${id}" class="block text-sm font-medium text-slate-300 mb-2">${label}${required ? '<span class="text-red-400 ml-1">*</span>' : ''}</label>
                <select 
                    id="${id}" 
                    name="${name || id}" 
                    class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    ${required ? 'required' : ''}
                >
                    <option value="">${placeholder}</option>
                    ${optionsHtml}
                </select>
            </div>
        `;
    },
    
    /**
     * Create text input
     * @param {object} options - Input options
     * @returns {string} HTML string
     */
    textInput({ id, name, label, type = 'text', value = '', required = false, placeholder = '', readonly = false }) {
        return `
            <div class="form-group">
                <label for="${id}" class="block text-sm font-medium text-slate-300 mb-2">${label}${required ? '<span class="text-red-400 ml-1">*</span>' : ''}</label>
                <input 
                    type="${type}" 
                    id="${id}" 
                    name="${name || id}" 
                    value="${value}"
                    placeholder="${placeholder}"
                    class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${readonly ? 'opacity-60 cursor-not-allowed' : ''}"
                    ${required ? 'required' : ''}
                    ${readonly ? 'readonly' : ''}
                >
            </div>
        `;
    },
    
    /**
     * Create textarea
     * @param {object} options - Textarea options
     * @returns {string} HTML string
     */
    textarea({ id, name, label, value = '', required = false, placeholder = '', rows = 3 }) {
        return `
            <div class="form-group">
                <label for="${id}" class="block text-sm font-medium text-slate-300 mb-2">${label}${required ? '<span class="text-red-400 ml-1">*</span>' : ''}</label>
                <textarea 
                    id="${id}" 
                    name="${name || id}" 
                    rows="${rows}"
                    placeholder="${placeholder}"
                    class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    ${required ? 'required' : ''}
                >${value}</textarea>
            </div>
        `;
    },
    
    // ===========================================
    // EMPTY STATES
    // ===========================================
    
    /**
     * Create empty state
     * @param {object} options - Empty state options
     * @returns {string} HTML string
     */
    emptyState({ icon, title, message, actionText = null, actionLink = null }) {
        const actionHtml = actionText && actionLink ? `
            <a href="${actionLink}" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mt-4">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                ${actionText}
            </a>
        ` : '';
        
        return `
            <div class="text-center py-12">
                <div class="w-20 h-20 mx-auto bg-slate-700 rounded-full flex items-center justify-center mb-4">
                    ${icon}
                </div>
                <h3 class="text-lg font-medium text-white mb-2">${title}</h3>
                <p class="text-slate-400 max-w-md mx-auto">${message}</p>
                ${actionHtml}
            </div>
        `;
    }
};

// Export for use in other modules
window.Components = Components;

// ES Module exports
export { Components };
export const showToast = (message, type, duration) => Components.showToast(message, type, duration);
export const showLoading = (message, showCancel) => Components.showLoading(message, showCancel);
export const hideLoading = () => Components.hideLoading();
