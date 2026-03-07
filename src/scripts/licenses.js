/**
 * ============================================
 * SOFTWARE LICENSES MODULE
 * Madison 88 IT Equipment Inventory System
 * ============================================
 * 
 * Handles software license management.
 * Licenses are created automatically when a software product is
 * assigned to an employee via the Employees or Assignments forms.
 */

const Licenses = {
    // ===========================================
    // CRUD OPERATIONS
    // ===========================================
    
    /**
     * Get all licenses with filters
     * @param {object} options - Query options
     * @returns {Promise<object>} Licenses and pagination info
     */
    async getAll({ 
        page = 1, 
        perPage = 25, 
        search = '',
        expiringSoon = false,
        sortBy = 'name',
        sortOrder = 'asc'
    } = {}) {
        try {
            let query = window.supabase
                .from('software_licenses')
                .select('*', { count: 'exact' });
            
            // Apply filters
            if (search) {
                query = query.or(`name.ilike.%${search}%,vendor.ilike.%${search}%,license_key.ilike.%${search}%`);
            }
            
            if (expiringSoon) {
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 90);
                query = query
                    .gte('expiry_date', new Date().toISOString().split('T')[0])
                    .lte('expiry_date', futureDate.toISOString().split('T')[0]);
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
            console.error('Get licenses error:', error);
            return { success: false, error: error.message, data: [], count: 0 };
        }
    },
    
    /**
     * Get single license by ID
     * @param {string} id - License ID
     * @returns {Promise<object>} License data
     */
    async getById(id) {
        try {
            const { data, error } = await window.supabase
                .from('software_licenses')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            
            return { success: true, data };
        } catch (error) {
            console.error('Get license error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Create new license
     * @param {object} licenseData - License data
     * @returns {Promise<object>} Created license
     */
    async create(licenseData) {
        try {
            if (!licenseData.name) {
                throw new Error('License name is required');
            }
            
            const insertData = {
                ...licenseData,
                created_by: Auth.user?.id
            };
            
            const { data, error } = await window.supabase
                .from('software_licenses')
                .insert(insertData)
                .select()
                .single();
            
            if (error) throw error;
            
            await Audit.logLicenseCreated(data);
            
            return { success: true, data };
        } catch (error) {
            console.error('Create license error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Update license
     * @param {string} id - License ID
     * @param {object} updates - Updated fields
     * @returns {Promise<object>} Updated license
     */
    async update(id, updates) {
        try {
            const current = await this.getById(id);
            if (!current.success) throw new Error('License not found');
            
            const { data, error } = await window.supabase
                .from('software_licenses')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            
            await Audit.logLicenseUpdated(id, current.data, data);
            
            return { success: true, data };
        } catch (error) {
            console.error('Update license error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Delete license
     * @param {string} id - License ID
     * @returns {Promise<object>} Result
     */
    async delete(id) {
        try {
            const current = await this.getById(id);
            if (!current.success) throw new Error('License not found');
            
            // Check for assignments
            const { count } = await window.supabase
                .from('license_assignments')
                .select('*', { count: 'exact', head: true })
                .eq('license_id', id);
            
            if (count > 0) {
                throw new Error('Cannot delete license with active assignments. Remove all assignments first.');
            }
            
            const { error } = await window.supabase
                .from('software_licenses')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            await Audit.logLicenseDeleted(current.data);
            
            return { success: true };
        } catch (error) {
            console.error('Delete license error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ===========================================
    // FIND OR CREATE LICENSE (New workflow)
    // ===========================================

    /**
     * Find an existing license for a software category + region, or create one.
     * Used when assigning a product to an employee from the employee/assignment forms.
     * @param {object} params
     * @param {string} params.categoryId - Software category ID
     * @param {string} params.categoryName - Software category name (used as product name)
     * @param {string} params.regionId - Region ID
     * @param {string} [params.licenseKey] - License key or email credential (optional)
     * @param {string} [params.keyType] - 'license_key' or 'email' (default: 'license_key')
     * @param {string} [params.expiryDate] - Expiry date (optional)
     * @returns {Promise<object>} License record
     */
    async findOrCreateForCategory({ categoryId, categoryName, regionId, licenseKey, keyType, expiryDate, cost }) {
        try {
            // Always create a new license record per assignment.
            // Each employee gets their own license entry so keys/emails are never shared
            // between employees automatically.
            const licenseData = {
                name: categoryName,
                category_id: categoryId,
                license_key: licenseKey || null,
                key_type: keyType || 'license_key',
                license_type: expiryDate ? 'subscription' : 'perpetual',
                seats: 9999, // Unlimited seats - quantity tracked via assignments
                expiry_date: expiryDate || null,
                cost: (cost !== null && cost !== undefined && cost !== '') ? parseFloat(cost) : null,
                region_id: regionId || null,
                is_active: true,
                created_by: Auth.user?.id
            };

            const { data, error } = await window.supabase
                .from('software_licenses')
                .insert(licenseData)
                .select()
                .single();

            if (error) throw error;
            if (!data) throw new Error('License record could not be created (no data returned — check RLS policies)');

            await Audit.logLicenseCreated(data);
            return { success: true, data };
        } catch (error) {
            console.error('Create license error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ===========================================
    // ASSIGNMENT OPERATIONS
    // ===========================================
    
    /**
     * Assign license to asset
     * @param {string} licenseId - License ID
     * @param {string} assetId - Asset ID
     * @param {string} notes - Optional notes
     * @returns {Promise<object>} Assignment result
     */
    async assignToAsset(licenseId, assetId, notes = '') {
        try {
            // Validate license
            const license = await this.getById(licenseId);
            if (!license.success) throw new Error('License not found');
            
            // Check available seats
            const usedSeats = await this.getUsedSeats(licenseId);
            if (usedSeats >= license.data.seats) {
                throw new Error('No available license seats');
            }
            
            // Validate asset
            const asset = await Assets.getById(assetId);
            if (!asset.success) throw new Error('Asset not found');
            
            // Check if already assigned
            const { data: existing } = await window.supabase
                .from('license_assignments')
                .select('id')
                .eq('license_id', licenseId)
                .eq('asset_id', assetId)
                .maybeSingle();
            
            if (existing) {
                throw new Error('License is already assigned to this asset');
            }
            
            const { data, error } = await window.supabase
                .from('license_assignments')
                .insert({
                    license_id: licenseId,
                    asset_id: assetId,
                    assigned_date: new Date().toISOString().split('T')[0],
                    notes
                })
                .select()
                .single();
            
            if (error) throw error;
            
            return { success: true, data };
        } catch (error) {
            console.error('Assign license error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Assign license directly to employee (no hardware link required).
     * If licenseId is not provided, finds or creates one for the given category.
     * @param {string} licenseId - License ID
     * @param {string} employeeId - Employee ID
     * @param {string} notes - Optional notes
     * @returns {Promise<object>} Assignment result
     */
    async assignToEmployee(licenseId, employeeId, notes = '') {
        try {
            // Validate license
            const license = await this.getById(licenseId);
            if (!license.success) throw new Error('License not found');
            
            // Check if already assigned to this employee
            const { data: existing } = await window.supabase
                .from('license_assignments')
                .select('id')
                .eq('license_id', licenseId)
                .eq('employee_id', employeeId)
                .maybeSingle();
            
            if (existing) {
                throw new Error('License is already assigned to this employee');
            }
            
            const { data, error } = await window.supabase
                .from('license_assignments')
                .insert({
                    license_id: licenseId,
                    employee_id: employeeId,
                    assigned_date: new Date().toISOString().split('T')[0],
                    notes
                })
                .select()
                .single();
            
            if (error) throw error;
            
            return { success: true, data };
        } catch (error) {
            console.error('Assign license to employee error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Remove license from asset
     * @param {string} assignmentId - Assignment ID
     * @returns {Promise<object>} Result
     */
    async removeFromAsset(assignmentId) {
        try {
            const { error } = await window.supabase
                .from('license_assignments')
                .delete()
                .eq('id', assignmentId);
            
            if (error) throw error;
            
            return { success: true };
        } catch (error) {
            console.error('Remove license assignment error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get assets assigned to a license
     * @param {string} licenseId - License ID
     * @returns {Promise<object>} Assigned assets
     */
    async getAssignedAssets(licenseId) {
        try {
            const { data, error } = await window.supabase
                .from('license_assignments')
                .select(`
                    *,
                    asset:assets(
                        id,
                        asset_tag,
                        serial_number,
                        brand,
                        model,
                        category:categories(name)
                    )
                `)
                .eq('license_id', licenseId);
            
            if (error) throw error;
            
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Get assigned assets error:', error);
            return { success: false, error: error.message, data: [] };
        }
    },
    
    /**
     * Get licenses assigned to an asset
     * @param {string} assetId - Asset ID
     * @returns {Promise<object>} Assigned licenses
     */
    async getLicensesForAsset(assetId) {
        try {
            const { data, error } = await window.supabase
                .from('license_assignments')
                .select(`
                    *,
                    license:software_licenses(*)
                `)
                .eq('asset_id', assetId);
            
            if (error) throw error;
            
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Get licenses for asset error:', error);
            return { success: false, error: error.message, data: [] };
        }
    },
    
    /**
     * Get used seats for a license
     * @param {string} licenseId - License ID
     * @returns {Promise<number>} Used seats count
     */
    async getUsedSeats(licenseId) {
        try {
            const { count, error } = await window.supabase
                .from('license_assignments')
                .select('*', { count: 'exact', head: true })
                .eq('license_id', licenseId);
            
            if (error) throw error;
            
            return count || 0;
        } catch (error) {
            console.error('Get used seats error:', error);
            return 0;
        }
    },
    
    // ===========================================
    // STATISTICS
    // ===========================================
    
    /**
     * Get license statistics
     * @returns {Promise<object>} Statistics
     */
    async getStatistics() {
        try {
            // Total licenses
            const { count: totalCount } = await window.supabase
                .from('software_licenses')
                .select('*', { count: 'exact', head: true });
            
            // Expiring soon (90 days)
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 90);
            
            const { count: expiringCount } = await window.supabase
                .from('software_licenses')
                .select('*', { count: 'exact', head: true })
                .gte('expiry_date', new Date().toISOString().split('T')[0])
                .lte('expiry_date', futureDate.toISOString().split('T')[0]);
            
            // Expired
            const { count: expiredCount } = await window.supabase
                .from('software_licenses')
                .select('*', { count: 'exact', head: true })
                .lt('expiry_date', new Date().toISOString().split('T')[0]);
            
            // Total cost
            const { data: costData } = await window.supabase
                .from('software_licenses')
                .select('cost');
            
            const totalCost = costData?.reduce((sum, l) => sum + (l.cost || 0), 0) || 0;
            
            return {
                success: true,
                data: {
                    total: totalCount || 0,
                    expiringSoon: expiringCount || 0,
                    expired: expiredCount || 0,
                    totalCost
                }
            };
        } catch (error) {
            console.error('Get statistics error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get expiring licenses
     * @param {number} days - Days threshold
     * @returns {Promise<object>} Expiring licenses
     */
    async getExpiring(days = 90) {
        try {
            const today = new Date();
            const futureDate = new Date();
            futureDate.setDate(today.getDate() + days);
            
            const { data, error } = await window.supabase
                .from('software_licenses')
                .select('*')
                .gte('expiry_date', today.toISOString().split('T')[0])
                .lte('expiry_date', futureDate.toISOString().split('T')[0])
                .order('expiry_date');
            
            if (error) throw error;
            
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Get expiring licenses error:', error);
            return { success: false, error: error.message, data: [] };
        }
    }
};

// Export for use in other modules
window.Licenses = Licenses;
