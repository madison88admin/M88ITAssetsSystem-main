/**
 * ============================================
 * MAINTENANCE MODULE
 * Madison 88 IT Equipment Inventory System
 * ============================================
 * 
 * Handles maintenance and repair tracking.
 */

const Maintenance = {
    // ===========================================
    // TEMPORARY REPLACEMENT HELPERS
    // ===========================================

    /**
     * Auto-assign a temporary replacement asset to the employee
     * when their current asset goes under repair or is reported lost.
     * @param {string} assetId - The original asset going unavailable
     * @param {string} reason - Reason for replacement ('maintenance' or 'lost')
     * @returns {Promise<object>} Result with replacement info
     */
    async autoAssignTemporaryReplacement(assetId, reason = 'maintenance') {
        try {
            // 1. Find the active assignment for this asset
            const { data: activeAssignment } = await window.supabase
                .from('asset_assignments')
                .select('id, employee_id, asset_id')
                .eq('asset_id', assetId)
                .is('returned_date', null)
                .eq('assignment_type', 'permanent')
                .maybeSingle();

            if (!activeAssignment) {
                // Asset is not assigned to anyone — no replacement needed
                return { success: true, replaced: false, message: 'Asset not assigned to any employee' };
            }

            // 2. Check if there's already a temporary replacement for this assignment
            const { data: existingTemp } = await window.supabase
                .from('asset_assignments')
                .select('id')
                .eq('replaced_assignment_id', activeAssignment.id)
                .is('returned_date', null)
                .maybeSingle();

            if (existingTemp) {
                return { success: true, replaced: false, message: 'Temporary replacement already exists' };
            }

            // 3. Get the asset's category and region
            const { data: asset } = await window.supabase
                .from('assets')
                .select('category_id, region_id, name, asset_tag')
                .eq('id', assetId)
                .single();

            if (!asset || !asset.category_id) {
                return { success: true, replaced: false, message: 'Could not determine asset category' };
            }

            // 4. Find an available asset in the same category (and region)
            let availQ = window.supabase
                .from('assets')
                .select('id, name, asset_tag')
                .eq('category_id', asset.category_id)
                .eq('status', 'available')
                .neq('id', assetId)
                .limit(1);
            if (asset.region_id) availQ = availQ.eq('region_id', asset.region_id);
            const { data: availableAssets } = await availQ;

            if (!availableAssets || availableAssets.length === 0) {
                return { success: true, replaced: false, noStock: true, message: 'No available replacement asset in the same category' };
            }

            const replacementAsset = availableAssets[0];

            // 5. Create a temporary assignment
            const result = await Assignments.assign({
                assetId: replacementAsset.id,
                employeeId: activeAssignment.employee_id,
                notes: `Temporary replacement (${reason}) for ${asset.name || ''} (${asset.asset_tag || ''})`,
                assignedBy: Auth.user?.id,
                assignmentType: 'temporary',
                replacedAssignmentId: activeAssignment.id
            });

            if (!result.success) {
                return { success: false, error: result.error };
            }

            // 6. Log audit
            const employee = await Employees.getById(activeAssignment.employee_id);
            await Audit.log({
                action: 'TEMP_ASSIGN',
                actionCategory: Audit.CATEGORIES.ASSIGNMENT,
                description: `Auto-assigned temporary replacement ${replacementAsset.asset_tag || replacementAsset.name} to ${employee.data?.full_name || 'employee'} (original ${asset.asset_tag || asset.name} is ${reason === 'lost' ? 'lost' : 'under repair'})`,
                tableName: 'asset_assignments',
                recordId: result.data.id,
                newValues: { 
                    assignment_type: 'temporary', 
                    replaced_assignment_id: activeAssignment.id,
                    reason 
                }
            });

            return { 
                success: true, 
                replaced: true, 
                replacementAsset, 
                employeeName: employee.data?.full_name,
                data: result.data 
            };
        } catch (error) {
            console.error('Auto-assign temporary replacement error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Auto-return a temporary replacement when the original asset is restored.
     * @param {string} assetId - The original asset being restored
     * @returns {Promise<object>} Result with return info
     */
    async autoReturnTemporaryReplacement(assetId) {
        try {
            // 1. Find the original (permanent) assignment for this asset
            const { data: originalAssignment } = await window.supabase
                .from('asset_assignments')
                .select('id, employee_id')
                .eq('asset_id', assetId)
                .is('returned_date', null)
                .eq('assignment_type', 'permanent')
                .maybeSingle();

            if (!originalAssignment) {
                return { success: true, returned: false, message: 'No active permanent assignment found' };
            }

            // 2. Find the active temporary replacement linked to this assignment
            const { data: tempAssignment } = await window.supabase
                .from('asset_assignments')
                .select('id, asset_id, asset:assets(name, asset_tag)')
                .eq('replaced_assignment_id', originalAssignment.id)
                .is('returned_date', null)
                .eq('assignment_type', 'temporary')
                .maybeSingle();

            if (!tempAssignment) {
                return { success: true, returned: false, message: 'No active temporary replacement found' };
            }

            // 3. Return the temporary asset
            const result = await Assignments.unassign(tempAssignment.id, 'Auto-returned: original asset restored');

            if (!result.success) {
                return { success: false, error: result.error };
            }

            // 4. Log audit
            const employee = await Employees.getById(originalAssignment.employee_id);
            const tempAssetName = tempAssignment.asset?.asset_tag || tempAssignment.asset?.name || 'Unknown';
            await Audit.log({
                action: 'TEMP_RETURN',
                actionCategory: Audit.CATEGORIES.ASSIGNMENT,
                description: `Auto-returned temporary replacement ${tempAssetName} from ${employee.data?.full_name || 'employee'} (original asset restored)`,
                tableName: 'asset_assignments',
                recordId: tempAssignment.id,
                oldValues: { assignment_type: 'temporary', replaced_assignment_id: originalAssignment.id }
            });

            return { 
                success: true, 
                returned: true, 
                tempAssetName,
                employeeName: employee.data?.full_name,
                data: result.data 
            };
        } catch (error) {
            console.error('Auto-return temporary replacement error:', error);
            return { success: false, error: error.message };
        }
    },

    // ===========================================
    // CRUD OPERATIONS
    // ===========================================
    
    /**
     * Get all maintenance records with filters
     * @param {object} options - Query options
     * @returns {Promise<object>} Records and pagination info
     */
    async getAll({ 
        page = 1, 
        perPage = 25, 
        status = null,
        assetId = null,
        excludeDecommissioned = true,
        sortBy = 'created_at',
        sortOrder = 'desc'
    } = {}) {
        try {
            // Use the view that excludes decommissioned assets
            const tableName = excludeDecommissioned ? 'v_maintenance_active' : 'maintenance_records';
            
            let query = window.supabase
                .from(tableName)
                .select('*', { count: 'exact' });
            
            // Apply filters
            if (status) {
                if (Array.isArray(status)) {
                    query = query.in('status', status);
                } else {
                    query = query.eq('status', status);
                }
            }
            
            if (assetId) {
                query = query.eq('asset_id', assetId);
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
            console.error('Get maintenance records error:', error);
            return { success: false, error: error.message, data: [], count: 0 };
        }
    },
    
    /**
     * Get single maintenance record by ID
     * @param {string} id - Record ID
     * @returns {Promise<object>} Record data
     */
    async getById(id) {
        try {
            const { data, error } = await window.supabase
                .from('maintenance_records')
                .select(`
                    *,
                    asset:assets(
                        id,
                        asset_tag,
                        serial_number,
                        brand,
                        model,
                        status,
                        category:asset_categories(name)
                    )
                `)
                .eq('id', id)
                .single();
            
            if (error) throw error;
            
            return { success: true, data };
        } catch (error) {
            console.error('Get maintenance record error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Create maintenance record
     * @param {object} recordData - Record data
     * @returns {Promise<object>} Created record
     */
    async create(recordData) {
        try {
            // Validate required fields
            if (!recordData.asset_id) {
                throw new Error('Asset is required');
            }
            
            if (!recordData.issue_description) {
                throw new Error('Issue description is required');
            }
            
            // Check asset exists and is not decommissioned
            const asset = await Assets.getById(recordData.asset_id);
            if (!asset.success) throw new Error('Asset not found');
            
            if (asset.data.status === 'decommissioned') {
                throw new Error('Cannot create maintenance record for decommissioned asset. Decommissioned assets cannot be repaired.');
            }
            
            // Check if asset already has active maintenance
            const { data: activeMaintenance, error: checkError } = await window.supabase
                .from('maintenance_records')
                .select('id, issue_description, start_date')
                .eq('asset_id', recordData.asset_id)
                .in('status', ['pending', 'in_progress'])
                .maybeSingle();
            
            if (checkError && checkError.code !== 'PGRST116') throw checkError;
            
            if (activeMaintenance) {
                throw new Error('This asset already has an active maintenance record. Please complete the current maintenance before creating a new one.');
            }
            
            // Store the original asset status before changing to under_repair
            const originalStatus = asset.data.status;
            
            // Prepare data
            const insertData = {
                ...recordData,
                created_by: Auth.user?.id,
                status: recordData.status || 'pending',
                original_asset_status: originalStatus
            };
            
            const { data, error } = await window.supabase
                .from('maintenance_records')
                .insert(insertData)
                .select()
                .single();
            
            if (error) throw error;
            
            // Automatically change asset status to under_repair
            await Assets.updateStatus(recordData.asset_id, 'under_repair');
            
            // Log audit
            await Audit.logMaintenanceCreated(data, asset.data);
            
            // Auto-assign temporary replacement if asset was assigned
            let replacementResult = null;
            if (originalStatus === 'assigned') {
                replacementResult = await this.autoAssignTemporaryReplacement(recordData.asset_id, 'maintenance');
            }
            
            return { success: true, data, replacementResult };
        } catch (error) {
            console.error('Create maintenance record error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Update maintenance record
     * @param {string} id - Record ID
     * @param {object} updates - Updated fields
     * @returns {Promise<object>} Updated record
     */
    async update(id, updates) {
        try {
            const current = await this.getById(id);
            if (!current.success) throw new Error('Record not found');
            
            const { data, error } = await window.supabase
                .from('maintenance_records')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            
            // Get asset info for audit
            const asset = await Assets.getById(current.data.asset_id);
            
            // Log audit
            await Audit.logMaintenanceUpdated(id, current.data, data, asset.data);
            
            return { success: true, data };
        } catch (error) {
            console.error('Update maintenance record error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Complete maintenance record
     * @param {string} id - Record ID
     * @param {object} completionData - Completion details
     * @returns {Promise<object>} Updated record
     */
    async complete(id, { endDate = null, cost = null, notes = '' } = {}) {
        try {
            const current = await this.getById(id);
            if (!current.success) throw new Error('Record not found');
            
            const updateData = {
                status: 'completed',
                end_date: endDate || new Date().toISOString().split('T')[0]
            };
            
            if (cost !== null) updateData.cost = cost;
            if (notes) updateData.notes = notes;
            
            const { data, error } = await window.supabase
                .from('maintenance_records')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            
            let tempReturnResult = null;
            
            // Check if asset has other active maintenance (excluding current record)
            const { data: otherMaintenance, count } = await window.supabase
                .from('maintenance_records')
                .select('*', { count: 'exact' })
                .eq('asset_id', current.data.asset_id)
                .neq('id', id)
                .in('status', ['pending', 'in_progress']);
            
            // console.log('Other active maintenance count:', count);
            // console.log('Other active maintenance records:', otherMaintenance);
            
            // If no other active maintenance, restore asset status
            if (count === 0) {
                const originalStatus = data.original_asset_status;
                // console.log('Original asset status before maintenance:', originalStatus);
                
                // Determine new status based on original status and current assignment
                let newStatus = 'available';
                
                if (originalStatus === 'assigned') {
                    // Check if asset still has an active permanent assignment
                    const { data: assignment, error: assignmentError } = await window.supabase
                        .from('asset_assignments')
                        .select('id, employee_id')
                        .eq('asset_id', current.data.asset_id)
                        .eq('assignment_type', 'permanent')
                        .filter('returned_date', 'is', null)
                        .maybeSingle();
                    
                    // console.log('Active assignment:', assignment);
                    
                    if (assignment) {
                        // Asset still assigned - restore to assigned status
                        newStatus = 'assigned';
                    } else {
                        // Assignment was returned during maintenance - set to available
                        newStatus = 'available';
                    }
                } else if (originalStatus === 'available') {
                    // Was available before, return to available
                    newStatus = 'available';
                } else if (originalStatus === 'damaged' || originalStatus === 'lost') {
                    // Damaged or lost assets become available after repair
                    newStatus = 'available';
                } else if (originalStatus === 'decommissioned') {
                    // This shouldn't happen (blocked at creation), but keep decommissioned if it does
                    newStatus = 'decommissioned';
                } else {
                    // Default to available for any other status
                    newStatus = 'available';
                }
                
                // console.log('Restoring asset status to:', newStatus);
                await Assets.updateStatus(current.data.asset_id, newStatus);
                
                // Auto-return temporary replacement if one exists
                const returnResult = await this.autoReturnTemporaryReplacement(current.data.asset_id);
                if (returnResult.returned) {
                    console.log('Auto-returned temporary replacement:', returnResult.tempAssetName);
                }
                tempReturnResult = returnResult;
            } else {
                // console.log('Skipping asset status update - other active maintenance exists');
            }
            
            // Get asset info for audit
            const asset = await Assets.getById(current.data.asset_id);
            
            // Log audit
            await Audit.logMaintenanceCompleted(data, asset.data);
            
            return { success: true, data, tempReturnResult };
        } catch (error) {
            console.error('Complete maintenance error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Cancel maintenance record
     * @param {string} id - Record ID
     * @param {string} reason - Cancellation reason
     * @returns {Promise<object>} Updated record
     */
    async cancel(id, reason = '') {
        try {
            const current = await this.getById(id);
            if (!current.success) throw new Error('Record not found');
            
            const { data, error } = await window.supabase
                .from('maintenance_records')
                .update({
                    status: 'cancelled',
                    notes: reason ? `Cancelled: ${reason}` : 'Cancelled'
                })
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            
            // Check if asset has other active maintenance
            const { count } = await window.supabase
                .from('maintenance_records')
                .select('*', { count: 'exact', head: true })
                .eq('asset_id', current.data.asset_id)
                .in('status', ['pending', 'in_progress']);
            
            // If no other active maintenance, set asset to available
            if (count === 0) {
                await Assets.updateStatus(current.data.asset_id, 'available');
                
                // Auto-return temporary replacement if one exists
                await this.autoReturnTemporaryReplacement(current.data.asset_id);
            }
            
            return { success: true, data };
        } catch (error) {
            console.error('Cancel maintenance error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Delete maintenance record
     * @param {string} id - Record ID
     * @returns {Promise<object>} Result
     */
    async delete(id) {
        try {
            const current = await this.getById(id);
            if (!current.success) throw new Error('Record not found');
            
            const { error } = await window.supabase
                .from('maintenance_records')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            return { success: true };
        } catch (error) {
            console.error('Delete maintenance record error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ===========================================
    // STATISTICS
    // ===========================================
    
    /**
     * Get maintenance statistics
     * @returns {Promise<object>} Statistics
     */
    async getStatistics() {
        try {
            const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];
            const counts = {};
            
            for (const status of statuses) {
                const { count } = await window.supabase
                    .from('v_maintenance_active')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', status);
                counts[status] = count || 0;
            }
            
            // Total cost this year
            const startOfYear = new Date();
            startOfYear.setMonth(0, 1);
            startOfYear.setHours(0, 0, 0, 0);
            
            const { data: costData } = await window.supabase
                .from('maintenance_records')
                .select('cost')
                .eq('status', 'completed')
                .gte('end_date', startOfYear.toISOString().split('T')[0]);
            
            const totalCost = costData?.reduce((sum, r) => sum + (r.cost || 0), 0) || 0;
            
            return {
                success: true,
                data: {
                    byStatus: counts,
                    totalActive: counts.pending + counts.in_progress,
                    totalCostThisYear: totalCost
                }
            };
        } catch (error) {
            console.error('Get statistics error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get assets with most repairs
     * @param {number} limit - Number of results
     * @returns {Promise<object>} Top assets
     */
    async getAssetsWithMostRepairs(limit = 10) {
        try {
            const { data, error } = await window.supabase
                .from('v_maintenance_active')
                .select('asset_id, serial_number, asset_tag, brand, model, category_name');
            
            if (error) throw error;
            
            // Count repairs per asset
            const counts = {};
            data.forEach(record => {
                const assetId = record.asset_id;
                if (!counts[assetId]) {
                    counts[assetId] = {
                        id: assetId,
                        serialNumber: record.serial_number,
                        assetTag: record.asset_tag,
                        description: `${record.brand || ''} ${record.model || ''}`.trim(),
                        category: record.category_name,
                        count: 0
                    };
                }
                counts[assetId].count++;
            });
            
            // Sort and limit
            const sorted = Object.values(counts)
                .sort((a, b) => b.count - a.count)
                .slice(0, limit);
            
            return { success: true, data: sorted };
        } catch (error) {
            console.error('Get assets with most repairs error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ===========================================
    // REPORTS
    // ===========================================
    
    /**
     * Get maintenance report data
     * @param {object} options - Report options
     * @returns {Promise<object>} Report data
     */
    async getReport({ startDate = null, endDate = null, status = null } = {}) {
        try {
            let query = window.supabase
                .from('v_maintenance_active')
                .select('*')
                .order('start_date', { ascending: false });
            
            if (startDate) {
                query = query.gte('start_date', startDate);
            }
            
            if (endDate) {
                query = query.lte('start_date', endDate);
            }
            
            if (status) {
                query = query.eq('status', status);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Get maintenance report error:', error);
            return { success: false, error: error.message, data: [] };
        }
    }
};

// Export for use in other modules
window.Maintenance = Maintenance;
