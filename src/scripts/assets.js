/**
 * ============================================
 * ASSETS MODULE
 * Madison 88 IT Equipment Inventory System
 * ============================================
 * 
 * Handles all asset CRUD operations.
 */

const Assets = {
    // ===========================================
    // CRUD OPERATIONS
    // ===========================================
    
    /**
     * Get all assets with filters and pagination
     * @param {object} options - Query options
     * @returns {Promise<object>} Assets and pagination info
     */
    async getAll({ 
        page = 1, 
        perPage = 25, 
        search = '', 
        status = null, 
        category = null, 
        department = null,
        sortBy = 'created_at',
        sortOrder = 'desc'
    } = {}) {
        try {
            let query = window.supabase
                .from('assets')
                .select(`
                    *,
                    category:asset_categories(id, name),
                    department:departments(id, name)
                `, { count: 'exact' });
            
            // Apply filters
            if (search) {
                query = query.or(`serial_number.ilike.%${search}%,asset_tag.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%`);
            }
            
            if (status) {
                if (Array.isArray(status)) {
                    query = query.in('status', status);
                } else {
                    query = query.eq('status', status);
                }
            }
            
            if (category) {
                query = query.eq('category_id', category);
            }
            
            if (department) {
                query = query.eq('department_id', department);
            }
            
            // Sorting
            query = query.order(sortBy, { ascending: sortOrder === 'asc' });
            
            // Pagination
            const from = (page - 1) * perPage;
            const to = from + perPage - 1;
            query = query.range(from, to);
            
            const { data, error, count } = await query;
            
            if (error) throw error;
            
            return {
                success: true,
                data: data || [],
                count: count || 0,
                totalPages: Math.ceil((count || 0) / perPage),
                currentPage: page
            };
        } catch (error) {
            console.error('Get assets error:', error);
            return { success: false, error: error.message, data: [], count: 0 };
        }
    },
    
    /**
     * Get single asset by ID
     * @param {string} id - Asset ID
     * @returns {Promise<object>} Asset data
     */
    async getById(id) {
        try {
            const { data, error } = await window.supabase
                .from('assets')
                .select(`
                    *,
                    category:asset_categories(id, name),
                    department:departments(id, name)
                `)
                .eq('id', id)
                .single();
            
            if (error) throw error;
            
            return { success: true, data };
        } catch (error) {
            console.error('Get asset error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get asset by serial number
     * @param {string} serialNumber - Serial number
     * @returns {Promise<object>} Asset data
     */
    async getBySerialNumber(serialNumber) {
        try {
            const { data, error } = await window.supabase
                .from('assets')
                .select('*')
                .eq('serial_number', serialNumber)
                .maybeSingle();
            
            if (error) throw error;
            
            return { success: true, data };
        } catch (error) {
            console.error('Get asset by serial error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Create new asset
     * @param {object} assetData - Asset data
     * @returns {Promise<object>} Created asset
     */
    async create(assetData) {
        try {
            // Validate required fields
            if (!assetData.serial_number) {
                throw new Error('Serial number is required');
            }
            
            if (!assetData.category_id) {
                throw new Error('Category is required');
            }
            
            // Check for duplicate serial number
            const existing = await this.getBySerialNumber(assetData.serial_number);
            if (existing.data) {
                throw new Error('An asset with this serial number already exists');
            }
            
            // Add metadata
            const insertData = {
                ...assetData,
                created_by: Auth.user?.id || assetData.created_by || null,
                logged_by: Auth.user?.id || assetData.logged_by || null,  // Track who logged/created this asset
                status: 'available',  // All new assets must be available
                region_id: Auth.getRegionId() || assetData.region_id || null  // Assign to user's region, fall back to supplied value
            };
            
            const { data, error } = await window.supabase
                .from('assets')
                .insert(insertData)
                .select()
                .single();
            
            if (error) throw error;
            
            // Log audit
            await Audit.logAssetCreated(data);
            
            return { success: true, data };
        } catch (error) {
            console.error('Create asset error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Update asset
     * @param {string} id - Asset ID
     * @param {object} updates - Updated fields
     * @returns {Promise<object>} Updated asset
     */
    async update(id, updates) {
        try {
            // Get current data for audit
            const current = await this.getById(id);
            if (!current.success) throw new Error('Asset not found');
            
            const { data, error } = await window.supabase
                .from('assets')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            
            // Log audit
            await Audit.logAssetUpdated(id, current.data, data);
            
            return { success: true, data };
        } catch (error) {
            console.error('Update asset error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Delete asset
     * @param {string} id - Asset ID
     * @returns {Promise<object>} Result
     */
    async delete(id) {
        try {
            // Get current data for audit
            const current = await this.getById(id);
            if (!current.success) throw new Error('Asset not found');
            
            const { error } = await window.supabase
                .from('assets')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            // Log audit
            await Audit.logAssetDeleted(current.data);
            
            return { success: true };
        } catch (error) {
            console.error('Delete asset error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ===========================================
    // STATUS OPERATIONS
    // ===========================================
    
    /**
     * Update asset status
     * @param {string} id - Asset ID
     * @param {string} newStatus - New status
     * @returns {Promise<object>} Result
     */
    async updateStatus(id, newStatus) {
        try {
            const current = await this.getById(id);
            if (!current.success) throw new Error('Asset not found');
            
            const oldStatus = current.data.status;
            
            const { data, error } = await window.supabase
                .from('assets')
                .update({ status: newStatus })
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            
            // Log status change
            await Audit.logStatusChange(id, current.data.asset_tag, oldStatus, newStatus);
            
            return { success: true, data };
        } catch (error) {
            console.error('Update status error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Decommission asset
     * @param {string} id - Asset ID
     * @param {string} reason - Reason for decommissioning
     * @returns {Promise<object>} Result
     */
    async decommission(id, reason = '') {
        try {
            const updates = {
                status: 'decommissioned',
                notes: reason ? `Decommissioned: ${reason}` : 'Decommissioned'
            };
            
            return await this.update(id, updates);
        } catch (error) {
            console.error('Decommission error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ===========================================
    // STATISTICS
    // ===========================================
    
    /**
     * Get asset statistics for dashboard
     * @returns {Promise<object>} Statistics
     */
    async getStatistics() {
        try {
            // Get counts by status
            const { data: statusCounts, error: statusError } = await window.supabase
                .rpc('get_asset_status_counts');
            
            // Fallback if RPC doesn't exist
            if (statusError) {
                // Manual count
                const statuses = ['available', 'assigned', 'under_repair', 'lost', 'damaged', 'decommissioned'];
                const counts = {};
                
                for (const status of statuses) {
                    const { count } = await window.supabase
                        .from('assets')
                        .select('*', { count: 'exact', head: true })
                        .eq('status', status);
                    counts[status] = count || 0;
                }
                
                return {
                    success: true,
                    data: {
                        byStatus: counts,
                        total: Object.values(counts).reduce((a, b) => a + b, 0)
                    }
                };
            }
            
            return { success: true, data: statusCounts };
        } catch (error) {
            console.error('Get statistics error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get assets by category
     * @returns {Promise<object>} Category counts
     */
    async getByCategory() {
        try {
            const { data, error } = await window.supabase
                .from('assets')
                .select(`
                    category_id,
                    category:asset_categories(name)
                `)
                .neq('status', 'decommissioned');
            
            if (error) throw error;
            
            // Group and count
            const counts = {};
            data.forEach(asset => {
                const catName = asset.category?.name || 'Unknown';
                counts[catName] = (counts[catName] || 0) + 1;
            });
            
            return { success: true, data: counts };
        } catch (error) {
            console.error('Get by category error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get assets by department
     * @returns {Promise<object>} Department counts
     */
    async getByDepartment() {
        try {
            const { data, error } = await window.supabase
                .from('assets')
                .select(`
                    department_id,
                    department:departments(name)
                `)
                .neq('status', 'decommissioned');
            
            if (error) throw error;
            
            // Group and count
            const counts = {};
            data.forEach(asset => {
                const deptName = asset.department?.name || 'Unassigned';
                counts[deptName] = (counts[deptName] || 0) + 1;
            });
            
            return { success: true, data: counts };
        } catch (error) {
            console.error('Get by department error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ===========================================
    // ASSIGNMENT HELPERS
    // ===========================================
    
    /**
     * Get current assignment for an asset
     * @param {string} assetId - Asset ID
     * @returns {Promise<object>} Assignment data
     */
    async getCurrentAssignment(assetId) {
        try {
            const { data, error } = await window.supabase
                .from('asset_assignments')
                .select(`
                    *,
                    employee:employees(id, employee_id, full_name, email)
                `)
                .eq('asset_id', assetId)
                .is('returned_date', null)
                .single();
            
            if (error && error.code !== 'PGRST116') throw error;
            
            return { success: true, data };
        } catch (error) {
            console.error('Get assignment error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get assignment history for an asset
     * @param {string} assetId - Asset ID
     * @returns {Promise<object>} Assignment history
     */
    async getAssignmentHistory(assetId) {
        try {
            const { data, error } = await window.supabase
                .from('asset_assignments')
                .select(`
                    *,
                    employee:employees(id, employee_id, full_name)
                `)
                .eq('asset_id', assetId)
                .order('assigned_date', { ascending: false });
            
            if (error) throw error;
            
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Get assignment history error:', error);
            return { success: false, error: error.message, data: [] };
        }
    },
    
    // ===========================================
    // MAINTENANCE HELPERS
    // ===========================================
    
    /**
     * Get maintenance history for an asset
     * @param {string} assetId - Asset ID
     * @returns {Promise<object>} Maintenance history
     */
    async getMaintenanceHistory(assetId) {
        try {
            const { data, error } = await window.supabase
                .from('maintenance_records')
                .select('*')
                .eq('asset_id', assetId)
                .order('start_date', { ascending: false });
            
            if (error) throw error;
            
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Get maintenance history error:', error);
            return { success: false, error: error.message, data: [] };
        }
    },
    
    // ===========================================
    // BULK OPERATIONS
    // ===========================================
    
    /**
     * Bulk import assets
     * @param {object[]} assets - Array of asset data
     * @param {File} file - The file being imported (for audit logging)
     * @returns {Promise<object>} Import result
     */
    async bulkImport(assets, file) {
        try {
            const results = {
                success: 0,
                failed: 0,
                errors: []
            };
            
            for (const asset of assets) {
                const { _existingId, ...assetData } = asset; // strip internal flag
                let result;
                if (_existingId) {
                    // Overwrite: update the existing record
                    result = await this.update(_existingId, assetData);
                } else {
                    result = await this.create(assetData);
                }
                if (result.success) {
                    results.success++;
                } else {
                    results.failed++;
                    results.errors.push({
                        serial: asset.serial_number,
                        error: result.error
                    });
                }
            }
            
            // Log import audit
            await Audit.logImport('assets', assets.length, results.success, results.failed, file?.name || 'unknown.csv');
            
            return { success: true, data: results };
        } catch (error) {
            console.error('Bulk import error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Bulk update status
     * @param {string[]} ids - Asset IDs
     * @param {string} status - New status
     * @returns {Promise<object>} Result
     */
    async bulkUpdateStatus(ids, status) {
        try {
            const { error } = await window.supabase
                .from('assets')
                .update({ status })
                .in('id', ids);
            
            if (error) throw error;
            
            return { success: true, count: ids.length };
        } catch (error) {
            console.error('Bulk update error:', error);
            return { success: false, error: error.message };
        }
    }
};

// Export for use in other modules
window.Assets = Assets;

// ES Module exports
export { Assets, Assets as AssetManager };
