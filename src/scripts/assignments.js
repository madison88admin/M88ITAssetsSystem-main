/**
 * ============================================
 * ASSIGNMENTS MODULE
 * Madison 88 IT Equipment Inventory System
 * ============================================
 * 
 * Handles asset assignment operations.
 */

const Assignments = {
    // ===========================================
    // CRUD OPERATIONS
    // ===========================================
    
    /**
     * Get all assignments with filters and pagination
     * @param {object} options - Query options
     * @returns {Promise<object>} Assignments and pagination info
     */
    async getAll({ 
        page = 1, 
        perPage = 25, 
        activeOnly = true,
        employeeId = null,
        assetId = null,
        sortBy = 'assigned_date',
        sortOrder = 'desc'
    } = {}) {
        try {
            let query = window.supabase
                .from('asset_assignments')
                .select(`
                    *,
                    asset:assets(
                        id,
                        asset_tag,
                        serial_number,
                        brand,
                        model,
                        category:categories(name)
                    ),
                    employee:employees(
                        id,
                        employee_id,
                        full_name,
                        department:departments(name),
                        location:locations(name)
                    )
                `, { count: 'exact' });
            
            // Apply filters
            if (activeOnly) {
                query = query.is('returned_date', null);
            }
            
            if (employeeId) {
                query = query.eq('employee_id', employeeId);
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
            console.error('Get assignments error:', error);
            return { success: false, error: error.message, data: [], count: 0 };
        }
    },
    
    /**
     * Get single assignment by ID
     * @param {string} id - Assignment ID
     * @returns {Promise<object>} Assignment data
     */
    async getById(id) {
        try {
            const { data, error } = await window.supabase
                .from('asset_assignments')
                .select(`
                    *,
                    asset:assets(
                        id,
                        asset_tag,
                        serial_number,
                        brand,
                        model,
                        category:asset_categories(name)
                    ),
                    employee:employees(
                        id,
                        employee_id,
                        full_name,
                        department:departments(name)
                    )
                `)
                .eq('id', id)
                .single();
            
            if (error) throw error;
            
            return { success: true, data };
        } catch (error) {
            console.error('Get assignment error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Assign asset to employee
     * @param {object} assignmentData - Assignment data
     * @returns {Promise<object>} Created assignment
     */
    async assign({ assetId, employeeId, notes = '', assignedBy = null, assignedDate = null, assignmentType = 'permanent', replacedAssignmentId = null }) {
        try {
            // Validate asset
            const asset = await Assets.getById(assetId);
            if (!asset.success) throw new Error('Asset not found');
            
            // Block assignment if asset is under repair
            if (asset.data.status === 'under_repair') {
                throw new Error('Cannot assign asset that is under repair. Please wait for the maintenance to be completed.');
            }
            
            // Check if asset is available
            if (asset.data.status !== 'available') {
                throw new Error(`Asset is not available for assignment. Current status: ${asset.data.status}`);
            }
            
            // Check category assignment rules
            const { data: category, error: catError } = await window.supabase
                .from('asset_categories')
                .select('name, allow_multiple_assignment')
                .eq('id', asset.data.category_id)
                .single();
            
            if (catError) console.error('Category check error:', catError);
            
            // If category doesn't allow multiple assignments, check if employee already has one
            // (Temporary replacements bypass this check since the original asset is unavailable)
            if (category && category.allow_multiple_assignment === false && assignmentType !== 'temporary') {
                // Get all active assignments for this employee
                const { data: activeAssignments, error: checkError } = await window.supabase
                    .from('asset_assignments')
                    .select('id, asset:assets(serial_number, name, category_id)')
                    .eq('employee_id', employeeId)
                    .filter('returned_date', 'is', null);
                
                if (checkError) console.error('Assignment check error:', checkError);
                
                // Check if any of the active assignments are from the same category
                const existingInCategory = activeAssignments?.find(
                    assignment => assignment.asset?.category_id === asset.data.category_id
                );
                
                if (existingInCategory) {
                    throw new Error(`Employee already has an assigned ${category.name} (${existingInCategory.asset.serial_number}). This category only allows single assignment. Please return the existing asset first.`);
                }
            }
            
            // Validate employee
            const employee = await Employees.getById(employeeId);
            if (!employee.success) throw new Error('Employee not found');
            
            if (!employee.data.is_active) {
                throw new Error('Cannot assign to inactive employee');
            }
            
            // Get current user ID (try assignedBy parameter, Auth.user, or session)
            let currentUserId = assignedBy || Auth.user?.id;
            if (!currentUserId) {
                const { data: { session } } = await window.supabase.auth.getSession();
                currentUserId = session?.user?.id;
            }
            
            // Create assignment
            const { data, error } = await window.supabase
                .from('asset_assignments')
                .insert({
                    asset_id: assetId,
                    employee_id: employeeId,
                    assigned_date: assignedDate || new Date().toISOString().split('T')[0],
                    assigned_by: currentUserId,
                    notes,
                    assignment_type: assignmentType,
                    replaced_assignment_id: replacedAssignmentId || null
                })
                .select()
                .single();
            
            if (error) throw error;
            
            // Update asset status to assigned
            await Assets.updateStatus(assetId, 'assigned');
            
            // Get asset and employee info for audit log
            const assetResult = await Assets.getById(assetId);
            const employeeResult = await Employees.getById(employeeId);
            
            // Log audit
            await Audit.logAssignment(
                data,
                assetResult.data,
                employeeResult.data
            );
            
            return { success: true, data };
        } catch (error) {
            console.error('Assign asset error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Return/unassign asset
     * @param {string} assignmentId - Assignment ID
     * @param {string} notes - Return notes
     * @returns {Promise<object>} Updated assignment
     */
    async unassign(assignmentId, notes = '') {
        try {
            // Get current assignment
            const current = await this.getById(assignmentId);
            if (!current.success) throw new Error('Assignment not found');
            
            if (current.data.returned_date) {
                throw new Error('Asset has already been returned');
            }
            
            // Update assignment with return date
            const returnNotes = notes ? 
                `${current.data.notes || ''}\nReturned: ${notes}`.trim() : 
                current.data.notes;
            
            const { data, error } = await window.supabase
                .from('asset_assignments')
                .update({
                    returned_date: new Date().toISOString().split('T')[0],
                    notes: returnNotes
                })
                .eq('id', assignmentId)
                .select()
                .single();
            
            if (error) throw error;
            
            // Update asset status back to available
            await Assets.updateStatus(current.data.asset_id, 'available');
            
            // Get asset and employee info for audit log
            const assetResult = await Assets.getById(current.data.asset_id);
            const employeeResult = await Employees.getById(current.data.employee_id);
            
            // Log audit
            await Audit.logUnassignment(
                data,
                assetResult.data,
                employeeResult.data
            );
            
            return { success: true, data };
        } catch (error) {
            console.error('Unassign asset error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Transfer asset to different employee
     * @param {string} assignmentId - Current assignment ID
     * @param {string} newEmployeeId - New employee ID
     * @param {string} notes - Transfer notes
     * @returns {Promise<object>} New assignment
     */
    async transfer(assignmentId, newEmployeeId, notes = '') {
        try {
            // Get current assignment
            const current = await this.getById(assignmentId);
            if (!current.success) throw new Error('Assignment not found');
            
            if (current.data.returned_date) {
                throw new Error('Asset has already been returned');
            }
            
            // Return from current employee
            await this.unassign(assignmentId, `Transferred: ${notes}`);
            
            // Temporarily set asset as available for new assignment
            await Assets.updateStatus(current.data.asset_id, 'available');
            
            // Assign to new employee
            const newAssignment = await this.assign({
                assetId: current.data.asset_id,
                employeeId: newEmployeeId,
                notes: `Transferred from ${current.data.employee?.full_name || 'previous employee'}. ${notes}`.trim()
            });
            
            return newAssignment;
        } catch (error) {
            console.error('Transfer asset error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ===========================================
    // STATISTICS
    // ===========================================
    
    /**
     * Get assignment statistics
     * @returns {Promise<object>} Statistics
     */
    async getStatistics() {
        try {
            // Active assignments count
            const { count: activeCount } = await window.supabase
                .from('asset_assignments')
                .select('*', { count: 'exact', head: true })
                .is('returned_date', null);
            
            // Total assignments (all time)
            const { count: totalCount } = await window.supabase
                .from('asset_assignments')
                .select('*', { count: 'exact', head: true });
            
            // Assignments this month
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            
            const { count: monthCount } = await window.supabase
                .from('asset_assignments')
                .select('*', { count: 'exact', head: true })
                .gte('assigned_date', startOfMonth.toISOString().split('T')[0]);
            
            return {
                success: true,
                data: {
                    active: activeCount || 0,
                    total: totalCount || 0,
                    thisMonth: monthCount || 0
                }
            };
        } catch (error) {
            console.error('Get statistics error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get employees with most assets
     * @param {number} limit - Number of results
     * @returns {Promise<object>} Top employees
     */
    async getTopEmployees(limit = 10) {
        try {
            const { data, error } = await window.supabase
                .from('asset_assignments')
                .select(`
                    employee_id,
                    employee:employees(full_name, department:departments(name))
                `)
                .is('returned_date', null);
            
            if (error) throw error;
            
            // Count assignments per employee
            const counts = {};
            data.forEach(assignment => {
                const empId = assignment.employee_id;
                if (!counts[empId]) {
                    counts[empId] = {
                        id: empId,
                        name: assignment.employee?.full_name || 'Unknown',
                        department: assignment.employee?.department?.name || 'N/A',
                        count: 0
                    };
                }
                counts[empId].count++;
            });
            
            // Sort and limit
            const sorted = Object.values(counts)
                .sort((a, b) => b.count - a.count)
                .slice(0, limit);
            
            return { success: true, data: sorted };
        } catch (error) {
            console.error('Get top employees error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ===========================================
    // REPORTS
    // ===========================================
    
    /**
     * Get all active assignments for report
     * @returns {Promise<object>} All assignments
     */
    async getActiveAssignmentsReport() {
        try {
            const { data, error } = await window.supabase
                .from('asset_assignments')
                .select(`
                    *,
                    asset:assets(
                        asset_tag,
                        serial_number,
                        brand,
                        model,
                        category:categories(name)
                    ),
                    employee:employees(
                        employee_id,
                        full_name,
                        email,
                        department:departments(name),
                        location:locations(name)
                    )
                `)
                .is('returned_date', null)
                .order('assigned_date', { ascending: false });
            
            if (error) throw error;
            
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Get assignments report error:', error);
            return { success: false, error: error.message, data: [] };
        }
    }
};

// Export for use in other modules
window.Assignments = Assignments;
