/**
 * ============================================
 * EMPLOYEES MODULE
 * Madison 88 IT Equipment Inventory System
 * ============================================
 * 
 * Handles employee management operations.
 */

const Employees = {
    // ===========================================
    // CRUD OPERATIONS
    // ===========================================
    
    /**
     * Get all employees with filters and pagination
     * @param {object} options - Query options
     * @returns {Promise<object>} Employees and pagination info
     */
    async getAll({ 
        page = 1, 
        perPage = 25, 
        search = '', 
        department = null,
        location = null,
        activeOnly = true,
        sortBy = 'full_name',
        sortOrder = 'asc'
    } = {}) {
        try {
            let query = window.supabase
                .from('employees')
                .select(`
                    *,
                    department:departments(id, name),
                    location:locations(id, name)
                `, { count: 'exact' });
            
            // Apply filters
            if (search) {
                query = query.or(`employee_id.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`);
            }
            
            if (department) {
                query = query.eq('department_id', department);
            }
            
            if (location) {
                query = query.eq('location_id', location);
            }
            
            if (activeOnly) {
                query = query.eq('is_active', true);
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
            console.error('Get employees error:', error);
            return { success: false, error: error.message, data: [], count: 0 };
        }
    },
    
    /**
     * Get single employee by ID
     * @param {string} id - Employee UUID
     * @returns {Promise<object>} Employee data
     */
    async getById(id) {
        try {
            const { data, error } = await window.supabase
                .from('employees')
                .select(`
                    *,
                    department:departments(id, name),
                    location:locations(id, name)
                `)
                .eq('id', id)
                .single();
            
            if (error) throw error;
            
            return { success: true, data };
        } catch (error) {
            console.error('Get employee error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get employee by employee ID (not UUID)
     * @param {string} employeeId - Employee ID string
     * @returns {Promise<object>} Employee data
     */
    async getByEmployeeId(employeeId) {
        try {
            const { data, error } = await window.supabase
                .from('employees')
                .select('*')
                .eq('employee_id', employeeId)
                .maybeSingle();
            
            if (error) throw error;
            
            return { success: true, data };
        } catch (error) {
            console.error('Get employee by ID error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Create new employee
     * @param {object} employeeData - Employee data
     * @returns {Promise<object>} Created employee
     */
    async create(employeeData) {
        try {
            // Validate required fields
            if (!employeeData.employee_id) {
                throw new Error('Employee ID is required');
            }
            
            if (!employeeData.full_name) {
                throw new Error('Full name is required');
            }
            
            // Check for duplicate employee ID
            const existing = await this.getByEmployeeId(employeeData.employee_id);
            if (existing.data) {
                throw new Error('An employee with this ID already exists');
            }
            
            // Add created_by tracking
            const insertData = {
                ...employeeData,
                created_by: Auth.user?.id || employeeData.created_by || null,
                region_id: Auth.getRegionId() || employeeData.region_id || null  // Assign to user's region, fall back to supplied value
            };
            
            const { data, error } = await window.supabase
                .from('employees')
                .insert(insertData)
                .select()
                .single();
            
            if (error) throw error;
            
            // Log audit
            await Audit.logEmployeeCreated(data);
            
            return { success: true, data };
        } catch (error) {
            console.error('Create employee error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Update employee
     * @param {string} id - Employee UUID
     * @param {object} updates - Updated fields
     * @returns {Promise<object>} Updated employee
     */
    async update(id, updates) {
        try {
            const current = await this.getById(id);
            if (!current.success) throw new Error('Employee not found');
            
            const { data, error } = await window.supabase
                .from('employees')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            
            // Log audit
            await Audit.logEmployeeUpdated(id, current.data, data);
            
            return { success: true, data };
        } catch (error) {
            console.error('Update employee error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Delete employee (soft delete - set inactive)
     * @param {string} id - Employee UUID
     * @returns {Promise<object>} Result
     */
    async delete(id) {
        try {
            const current = await this.getById(id);
            if (!current.success) throw new Error('Employee not found');
            
            // Check for active assignments
            const { count } = await window.supabase
                .from('asset_assignments')
                .select('*', { count: 'exact', head: true })
                .eq('employee_id', id)
                .is('returned_date', null);
            
            if (count > 0) {
                throw new Error('Cannot delete employee with active asset assignments. Please return all assets first.');
            }
            
            // Soft delete
            const { error } = await window.supabase
                .from('employees')
                .update({ is_active: false })
                .eq('id', id);
            
            if (error) throw error;
            
            // Log audit
            await Audit.logEmployeeDeleted(current.data);
            
            return { success: true };
        } catch (error) {
            console.error('Delete employee error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Permanently delete employee
     * @param {string} id - Employee UUID
     * @returns {Promise<object>} Result
     */
    async hardDelete(id) {
        try {
            const current = await this.getById(id);
            if (!current.success) throw new Error('Employee not found');
            
            const { error } = await window.supabase
                .from('employees')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            await Audit.logEmployeeDeleted(current.data);
            
            return { success: true };
        } catch (error) {
            console.error('Hard delete employee error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ===========================================
    // ASSIGNMENT HELPERS
    // ===========================================
    
    /**
     * Get assets assigned to employee
     * @param {string} employeeId - Employee UUID
     * @returns {Promise<object>} Assigned assets
     */
    async getAssignedAssets(employeeId) {
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
                        status,
                        category:categories(name)
                    )
                `)
                .eq('employee_id', employeeId)
                .is('returned_date', null);
            
            if (error) throw error;
            
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Get assigned assets error:', error);
            return { success: false, error: error.message, data: [] };
        }
    },
    
    /**
     * Get assignment history for employee
     * @param {string} employeeId - Employee UUID
     * @returns {Promise<object>} Assignment history
     */
    async getAssignmentHistory(employeeId) {
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
                        category:categories(name)
                    )
                `)
                .eq('employee_id', employeeId)
                .order('assigned_date', { ascending: false });
            
            if (error) throw error;
            
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Get assignment history error:', error);
            return { success: false, error: error.message, data: [] };
        }
    },
    
    // ===========================================
    // STATISTICS
    // ===========================================
    
    /**
     * Get employee count by department
     * @returns {Promise<object>} Counts
     */
    async getCountByDepartment() {
        try {
            const { data, error } = await window.supabase
                .from('employees')
                .select(`
                    department_id,
                    department:departments(name)
                `)
                .eq('is_active', true);
            
            if (error) throw error;
            
            const counts = {};
            data.forEach(emp => {
                const deptName = emp.department?.name || 'Unassigned';
                counts[deptName] = (counts[deptName] || 0) + 1;
            });
            
            return { success: true, data: counts };
        } catch (error) {
            console.error('Get count by department error:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Get employee count by location
     * @returns {Promise<object>} Counts
     */
    async getCountByLocation() {
        try {
            const { data, error } = await window.supabase
                .from('employees')
                .select(`
                    location_id,
                    location:locations(name)
                `)
                .eq('is_active', true);
            
            if (error) throw error;
            
            const counts = {};
            data.forEach(emp => {
                const locName = emp.location?.name || 'Unassigned';
                counts[locName] = (counts[locName] || 0) + 1;
            });
            
            return { success: true, data: counts };
        } catch (error) {
            console.error('Get count by location error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ===========================================
    // BULK OPERATIONS
    // ===========================================
    
    /**
     * Bulk import employees
     * @param {object[]} employees - Array of employee data
     * @param {File} file - The file being imported (for audit logging)
     * @returns {Promise<object>} Import result
     */
    async bulkImport(employees, file) {
        try {
            const results = {
                success: 0,
                failed: 0,
                errors: []
            };
            
            for (const employee of employees) {
                const { _existingId, ...employeeData } = employee; // strip internal flag
                let result;
                if (_existingId) {
                    // Overwrite: update the existing record
                    result = await this.update(_existingId, employeeData);
                } else {
                    result = await this.create(employeeData);
                }
                if (result.success) {
                    results.success++;
                } else {
                    results.failed++;
                    results.errors.push({
                        employeeId: employee.employee_id,
                        error: result.error
                    });
                }
            }
            
            await Audit.logImport('employees', employees.length, results.success, results.failed, file?.name || 'uploaded_file');
            
            return { success: true, data: results };
        } catch (error) {
            console.error('Bulk import error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // ===========================================
    // DROPDOWN OPTIONS
    // ===========================================
    
    /**
     * Get employees for dropdown selection
     * @returns {Promise<object[]>} Employee options
     */
    async getDropdownOptions() {
        try {
            const { data, error } = await window.supabase
                .from('employees')
                .select('id, employee_id, full_name, department:departments(name)')
                .eq('is_active', true)
                .order('full_name');
            
            if (error) throw error;
            
            return {
                success: true,
                data: (data || []).map(emp => ({
                    value: emp.id,
                    label: `${emp.full_name} (${emp.employee_id})`,
                    department: emp.department?.name
                }))
            };
        } catch (error) {
            console.error('Get dropdown options error:', error);
            return { success: false, error: error.message, data: [] };
        }
    }
};

// Export for use in other modules
window.Employees = Employees;
