/**
 * ============================================
 * ENHANCED AUDIT LOGGING MODULE
 * Madison 88 IT Equipment Inventory System
 * ============================================
 * 
 * Tracks all system changes with detailed categorization
 * Role-based access: Admin sees all, IT Staff sees most, Viewer sees own only
 */

const Audit = {
    // ===========================================
    // ACTION CATEGORIES
    // ===========================================
    
    CATEGORIES: {
        AUTHENTICATION: 'authentication',
        ASSET_MANAGEMENT: 'asset_management',
        USER_MANAGEMENT: 'user_management',
        SETTINGS: 'settings',
        IMPORT_EXPORT: 'import_export',
        MAINTENANCE: 'maintenance',
        ASSIGNMENT: 'assignment',
        SOFTWARE_LICENSES: 'software_licenses',
        LOST_ASSETS: 'lost_assets'
    },

    // ===========================================
    // CORE LOGGING METHOD
    // ===========================================
    
    /**
     * Enhanced audit log with action category and description
     * @param {object} params - Logging parameters
     * @param {string} params.action - Action performed
     * @param {string} params.actionCategory - Category of action
     * @param {string} params.description - Human-readable description
     * @param {string} params.tableName - Table affected
     * @param {string} params.recordId - ID of record
     * @param {object} params.oldValues - Previous values
     * @param {object} params.newValues - New values
     * @returns {Promise<object>} Result
     */
    async log({ action, actionCategory, description, tableName, recordId = null, oldValues = null, newValues = null }) {
        try {
            // Validate required parameters
            if (!action) {
                console.error('Audit log error: action is required');
                return { success: false, error: 'Action is required' };
            }
            if (!actionCategory) {
                console.error('Audit log error: actionCategory is required');
                return { success: false, error: 'Action category is required' };
            }
            if (!description) {
                console.error('Audit log error: description is required');
                return { success: false, error: 'Description is required' };
            }
            
            // Get current user
            let user = null;
            if (typeof Auth !== 'undefined' && Auth.user) {
                user = Auth.user;
            } else if (window.supabase) {
                const { data: { session } } = await window.supabase.auth.getSession();
                user = session?.user;
            }
            
            const logEntry = {
                user_id: user?.id || null,
                user_email: user?.email || 'system',
                action: action.toUpperCase(),
                action_category: actionCategory,
                description: description,
                table_name: tableName,
                record_id: recordId,
                old_values: oldValues,
                new_values: newValues
            };
            
            const { error } = await window.supabase
                .from('audit_logs')
                .insert(logEntry);
            
            if (error) {
                console.error('Audit log error:', error);
                return { success: false, error: error.message };
            }
            
            return { success: true };
        } catch (error) {
            console.error('Audit log error:', error);
            return { success: false, error: error.message };
        }
    },

    // ===========================================
    // AUTHENTICATION LOGGING
    // ===========================================
    
    async logLogin(userEmail) {
        return await this.log({
            action: 'LOGIN',
            actionCategory: this.CATEGORIES.AUTHENTICATION,
            description: `User ${userEmail} logged in`,
            tableName: 'auth',
            newValues: { email: userEmail, timestamp: new Date().toISOString() }
        });
    },

    async logLogout(userEmail) {
        return await this.log({
            action: 'LOGOUT',
            actionCategory: this.CATEGORIES.AUTHENTICATION,
            description: `User ${userEmail} logged out`,
            tableName: 'auth',
            newValues: { email: userEmail, timestamp: new Date().toISOString() }
        });
    },

    // ===========================================
    // ASSET MANAGEMENT LOGGING
    // ===========================================
    
    async logAssetCreated(asset) {
        return await this.log({
            action: 'CREATE',
            actionCategory: this.CATEGORIES.ASSET_MANAGEMENT,
            description: `Created asset: ${asset.serial_number} (${asset.brand || ''} ${asset.model || ''})`,
            tableName: 'assets',
            recordId: asset.id,
            newValues: asset
        });
    },
    
    async logAssetUpdated(assetId, oldData, newData) {
        const changes = this._getChangedFields(oldData, newData);
        return await this.log({
            action: 'UPDATE',
            actionCategory: this.CATEGORIES.ASSET_MANAGEMENT,
            description: `Updated asset ${oldData.serial_number}: ${changes.join(', ')}`,
            tableName: 'assets',
            recordId: assetId,
            oldValues: oldData,
            newValues: newData
        });
    },
    
    async logAssetDeleted(asset) {
        return await this.log({
            action: 'DELETE',
            actionCategory: this.CATEGORIES.ASSET_MANAGEMENT,
            description: `Deleted asset: ${asset.serial_number}`,
            tableName: 'assets',
            recordId: asset.id,
            oldValues: asset
        });
    },
    
    async logStatusChange(assetId, assetTag, oldStatus, newStatus) {
        return await this.log({
            action: 'STATUS_CHANGE',
            actionCategory: this.CATEGORIES.ASSET_MANAGEMENT,
            description: `Changed asset ${assetTag} status from ${oldStatus} to ${newStatus}`,
            tableName: 'assets',
            recordId: assetId,
            oldValues: { status: oldStatus },
            newValues: { status: newStatus }
        });
    },

    // ===========================================
    // IMPORT/EXPORT LOGGING
    // ===========================================
    
    async logImport(type, count, successCount, failedCount, fileName) {
        return await this.log({
            action: 'IMPORT',
            actionCategory: this.CATEGORIES.IMPORT_EXPORT,
            description: `Imported ${successCount} ${type} from ${fileName}${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
            tableName: type,
            newValues: { 
                fileName, 
                total: count, 
                success: successCount, 
                failed: failedCount 
            }
        });
    },

    async logExport(type, count, format, fileName) {
        return await this.log({
            action: 'EXPORT',
            actionCategory: this.CATEGORIES.IMPORT_EXPORT,
            description: `Exported ${count} ${type} records as ${format} to ${fileName}`,
            tableName: type,
            newValues: { fileName, count, format }
        });
    },

    // ===========================================
    // ASSIGNMENT LOGGING
    // ===========================================
    
    async logAssignment(assignment, assetInfo, employeeInfo) {
        return await this.log({
            action: 'ASSIGN',
            actionCategory: this.CATEGORIES.ASSIGNMENT,
            description: `Assigned ${assetInfo.serial_number} to ${employeeInfo.full_name}`,
            tableName: 'asset_assignments',
            recordId: assignment.id,
            newValues: assignment
        });
    },
    
    async logUnassignment(assignment, assetInfo, employeeInfo) {
        return await this.log({
            action: 'UNASSIGN',
            actionCategory: this.CATEGORIES.ASSIGNMENT,
            description: `Returned ${assetInfo.serial_number} from ${employeeInfo.full_name}`,
            tableName: 'asset_assignments',
            recordId: assignment.id,
            oldValues: assignment,
            newValues: { returned_date: new Date().toISOString() }
        });
    },

    // ===========================================
    // USER MANAGEMENT LOGGING
    // ===========================================
    
    async logUserRoleChanged(userId, userEmail, oldRole, newRole) {
        return await this.log({
            action: 'UPDATE',
            actionCategory: this.CATEGORIES.USER_MANAGEMENT,
            description: `Changed user ${userEmail} role from ${oldRole} to ${newRole}`,
            tableName: 'user_profiles',
            recordId: userId,
            oldValues: { role: oldRole },
            newValues: { role: newRole }
        });
    },

    async logUserStatusChanged(userId, userEmail, isActive) {
        return await this.log({
            action: 'UPDATE',
            actionCategory: this.CATEGORIES.USER_MANAGEMENT,
            description: `${isActive ? 'Activated' : 'Deactivated'} user ${userEmail}`,
            tableName: 'user_profiles',
            recordId: userId,
            oldValues: { is_active: !isActive },
            newValues: { is_active: isActive }
        });
    },

    // ===========================================
    // SETTINGS LOGGING
    // ===========================================
    
    async logAssignmentRuleChanged(categoryId, categoryName, allowMultiple) {
        return await this.log({
            action: 'UPDATE',
            actionCategory: this.CATEGORIES.SETTINGS,
            description: `Changed ${categoryName} assignment rule to ${allowMultiple ? 'Multiple Assignment' : 'Single Assignment'}`,
            tableName: 'asset_categories',
            recordId: categoryId,
            oldValues: { allow_multiple_assignment: !allowMultiple },
            newValues: { allow_multiple_assignment: allowMultiple }
        });
    },

    async logCategoryCreated(category) {
        return await this.log({
            action: 'CREATE',
            actionCategory: this.CATEGORIES.SETTINGS,
            description: `Created category: ${category.name}`,
            tableName: 'asset_categories',
            recordId: category.id,
            newValues: category
        });
    },

    async logCategoryUpdated(categoryId, oldData, newData) {
        return await this.log({
            action: 'UPDATE',
            actionCategory: this.CATEGORIES.SETTINGS,
            description: `Updated category: ${oldData.name}`,
            tableName: 'asset_categories',
            recordId: categoryId,
            oldValues: oldData,
            newValues: newData
        });
    },

    async logCategoryDeleted(category) {
        return await this.log({
            action: 'DELETE',
            actionCategory: this.CATEGORIES.SETTINGS,
            description: `Deleted category: ${category.name}`,
            tableName: 'asset_categories',
            recordId: category.id,
            oldValues: category
        });
    },

    // ===========================================
    // MAINTENANCE LOGGING
    // ===========================================
    
    async logMaintenanceCreated(record, assetInfo) {
        return await this.log({
            action: 'CREATE',
            actionCategory: this.CATEGORIES.MAINTENANCE,
            description: `Created maintenance record for ${assetInfo.serial_number}: ${record.issue_description}`,
            tableName: 'maintenance_records',
            recordId: record.id,
            newValues: record
        });
    },

    async logMaintenanceUpdated(recordId, oldData, newData, assetInfo) {
        return await this.log({
            action: 'UPDATE',
            actionCategory: this.CATEGORIES.MAINTENANCE,
            description: `Updated maintenance for ${assetInfo.serial_number}`,
            tableName: 'maintenance_records',
            recordId: recordId,
            oldValues: oldData,
            newValues: newData
        });
    },

    async logMaintenanceCompleted(record, assetInfo) {
        return await this.log({
            action: 'COMPLETE',
            actionCategory: this.CATEGORIES.MAINTENANCE,
            description: `Completed maintenance for ${assetInfo.asset_tag}`,
            tableName: 'maintenance_records',
            recordId: record.id,
            oldValues: { status: 'in_progress' },
            newValues: { status: 'completed', completion_date: new Date().toISOString() }
        });
    },

    // ===========================================
    // EMPLOYEE LOGGING
    // ===========================================
    
    async logEmployeeCreated(employee) {
        return await this.log({
            action: 'CREATE',
            actionCategory: this.CATEGORIES.USER_MANAGEMENT,
            description: `Created employee: ${employee.full_name}`,
            tableName: 'employees',
            recordId: employee.id,
            newValues: employee
        });
    },

    async logEmployeeUpdated(employeeId, oldData, newData) {
        return await this.log({
            action: 'UPDATE',
            actionCategory: this.CATEGORIES.USER_MANAGEMENT,
            description: `Updated employee: ${oldData.full_name}`,
            tableName: 'employees',
            recordId: employeeId,
            oldValues: oldData,
            newValues: newData
        });
    },

    async logEmployeeDeleted(employee) {
        return await this.log({
            action: 'DELETE',
            actionCategory: this.CATEGORIES.USER_MANAGEMENT,
            description: `Deleted employee: ${employee.full_name}`,
            tableName: 'employees',
            recordId: employee.id,
            oldValues: employee
        });
    },

    // ===========================================
    // SOFTWARE LICENSE LOGGING
    // ===========================================
    
    async logLicenseCreated(license) {
        return await this.log({
            action: 'CREATE',
            actionCategory: this.CATEGORIES.SOFTWARE_LICENSES,
            description: `Created software license: ${license.name}`,
            tableName: 'software_licenses',
            recordId: license.id,
            newValues: license
        });
    },

    async logLicenseUpdated(licenseId, oldData, newData) {
        const changes = this._getChangedFields(oldData, newData);
        return await this.log({
            action: 'UPDATE',
            actionCategory: this.CATEGORIES.SOFTWARE_LICENSES,
            description: `Updated license ${oldData.name}: ${changes.join(', ')}`,
            tableName: 'software_licenses',
            recordId: licenseId,
            oldValues: oldData,
            newValues: newData
        });
    },

    async logLicenseDeleted(license) {
        return await this.log({
            action: 'DELETE',
            actionCategory: this.CATEGORIES.SOFTWARE_LICENSES,
            description: `Deleted software license: ${license.name}`,
            tableName: 'software_licenses',
            recordId: license.id,
            oldValues: license
        });
    },

    // ===========================================
    // RETRIEVAL METHODS WITH ROLE-BASED FILTERING
    // ===========================================
    
    /**
     * Get audit logs with role-based filtering
     * @param {object} options - Query options
     * @param {object} currentUser - Current user object with role
     * @returns {Promise<object>} Logs and count
     */
    async getLogs({ 
        page = 1, 
        perPage = 100,
        action = null, 
        actionCategory = null,
        tableName = null, 
        userId = null, 
        startDate = null, 
        endDate = null,
        searchTerm = null 
    }, currentUser) {
        try {
            let query = window.supabase
                .from('audit_logs')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });
            
            // Role-based filtering
            if (currentUser.role === 'executive') {
                // Executive sees ALL logs across all regions - no filter
            } else if (currentUser.role === 'admin') {
                // Admin sees all logs except those from executives
                // Fetch executive user IDs and exclude them
                const { data: execUsers } = await window.supabase
                    .from('user_profiles')
                    .select('id')
                    .eq('role', 'executive');
                const execIds = (execUsers || []).map(u => u.id);
                if (execIds.length > 0) {
                    // Exclude executive users' logs
                    for (const execId of execIds) {
                        query = query.neq('user_id', execId);
                    }
                }
            } else if (currentUser.role === 'it_staff') {
                // IT Staff can only see their own logs (all categories)
                query = query.eq('user_id', currentUser.id);
            } else if (currentUser.role === 'viewer') {
                // Viewers can only see their own logs
                query = query.eq('user_id', currentUser.id);
            }

            // Apply additional filters
            if (action) {
                query = query.eq('action', action.toUpperCase());
            }
            
            if (actionCategory) {
                query = query.eq('action_category', actionCategory);
            }
            
            if (tableName) {
                query = query.eq('table_name', tableName);
            }
            
            if (userId) {
                query = query.eq('user_id', userId);
            }
            
            if (startDate) {
                query = query.gte('created_at', startDate);
            }
            
            if (endDate) {
                query = query.lte('created_at', endDate);
            }

            if (searchTerm) {
                query = query.or(`description.ilike.%${searchTerm}%,user_email.ilike.%${searchTerm}%`);
            }
            
            // Pagination
            const from = (page - 1) * perPage;
            const to = from + perPage - 1;
            query = query.range(from, to);
            
            const { data, error, count } = await query;
            
            if (error) throw error;
            
            return {
                success: true,
                data,
                count,
                totalPages: Math.ceil(count / perPage)
            };
        } catch (error) {
            console.error('Get audit logs error:', error);
            return { success: false, error: error.message, data: [], count: 0 };
        }
    },
    
    /**
     * Get logs for a specific record
     * @param {string} tableName - Table name
     * @param {string} recordId - Record ID
     * @returns {Promise<object>} Logs
     */
    async getRecordHistory(tableName, recordId) {
        try {
            const { data, error } = await window.supabase
                .from('audit_logs')
                .select('*')
                .eq('table_name', tableName)
                .eq('record_id', recordId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            return { success: true, data };
        } catch (error) {
            console.error('Get record history error:', error);
            return { success: false, error: error.message, data: [] };
        }
    },
    
    /**
     * Get activity summary for dashboard
     * @param {number} days - Number of days to look back
     * @param {object} currentUser - Current user for role-based filtering
     * @returns {Promise<object>} Activity summary
     */
    async getActivitySummary(days = 7, currentUser) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            let query = window.supabase
                .from('audit_logs')
                .select('action, action_category, description, table_name, created_at, user_email')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: false })
                .limit(50);

            // Apply role-based filtering
            if (currentUser && currentUser.role === 'viewer') {
                query = query.eq('user_id', currentUser.id);
            } else if (currentUser && currentUser.role === 'it_staff') {
                query = query.not('action_category', 'in', `(${this.CATEGORIES.AUTHENTICATION},${this.CATEGORIES.USER_MANAGEMENT})`);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            
            // Group by action
            const summary = {
                total: data.length,
                byAction: {},
                byCategory: {},
                byTable: {},
                recent: data.slice(0, 10)
            };
            
            data.forEach(log => {
                summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;
                if (log.action_category) {
                    summary.byCategory[log.action_category] = (summary.byCategory[log.action_category] || 0) + 1;
                }
                summary.byTable[log.table_name] = (summary.byTable[log.table_name] || 0) + 1;
            });
            
            return { success: true, data: summary };
        } catch (error) {
            console.error('Get activity summary error:', error);
            return { success: false, error: error.message };
        }
    },

    // ===========================================
    // HELPER METHODS
    // ===========================================

    /**
     * Get changed fields between old and new data
     * @private
     */
    _getChangedFields(oldData, newData) {
        const changes = [];
        for (const key in newData) {
            if (newData[key] !== oldData[key] && key !== 'updated_at' && key !== 'id') {
                changes.push(`${key.replace('_', ' ')}`);
            }
        }
        return changes;
    },
    
    /**
     * Format action for display
     * @param {string} action - Action code
     * @returns {object} Formatted action with label and color
     */
    formatAction(action) {
        const actions = {
            CREATE: { label: 'Created', color: 'green', icon: 'plus' },
            UPDATE: { label: 'Updated', color: 'blue', icon: 'edit' },
            DELETE: { label: 'Deleted', color: 'red', icon: 'trash' },
            LOGIN: { label: 'Logged In', color: 'purple', icon: 'login' },
            LOGOUT: { label: 'Logged Out', color: 'gray', icon: 'logout' },
            ASSIGN: { label: 'Assigned', color: 'blue', icon: 'user-plus' },
            UNASSIGN: { label: 'Returned', color: 'yellow', icon: 'user-minus' },
            STATUS_CHANGE: { label: 'Status Changed', color: 'orange', icon: 'refresh' },
            IMPORT: { label: 'Imported', color: 'green', icon: 'upload' },
            EXPORT: { label: 'Exported', color: 'blue', icon: 'download' },
            COMPLETE: { label: 'Completed', color: 'green', icon: 'check' }
        };
        
        return actions[action] || { label: action, color: 'gray', icon: 'activity' };
    },
    
    /**
     * Format table name for display
     * @param {string} tableName - Table name
     * @returns {string} Formatted name
     */
    formatTableName(tableName) {
        const tables = {
            assets: 'Asset',
            employees: 'Employee',
            asset_assignments: 'Assignment',
            maintenance_records: 'Maintenance',
            software_licenses: 'License',
            lost_assets: 'Lost Asset',
            user_profiles: 'User',
            asset_categories: 'Category',
            departments: 'Department',
            locations: 'Location',
            auth: 'Authentication'
        };
        
        return tables[tableName] || tableName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    },

    // ===========================================
    // LOST ASSETS LOGGING
    // ===========================================

    /**
     * Log lost asset report creation
     */
    async logLostAssetCreated(data, userEmail) {
        return await this.log({
            action: 'CREATE',
            actionCategory: this.CATEGORIES.LOST_ASSETS,
            description: `Reported asset lost. Status: ${data.status}`,
            tableName: 'lost_assets',
            recordId: data.asset_id,
            newValues: data
        });
    },

    /**
     * Log lost asset record update
     */
    async logLostAssetUpdated(oldData, newData, userEmail) {
        const changes = [];
        if (oldData.status !== newData.status) changes.push(`Status: ${oldData.status} → ${newData.status}`);
        if (oldData.date_found !== newData.date_found && newData.date_found) changes.push(`Date Found: ${newData.date_found}`);
        if (oldData.liability_amount !== newData.liability_amount) changes.push(`Liability Amount: ${oldData.liability_amount || '0'} → ${newData.liability_amount || '0'}`);
        
        return await this.log({
            action: 'UPDATE',
            actionCategory: this.CATEGORIES.LOST_ASSETS,
            description: `Updated lost asset record${changes.length ? ': ' + changes.join(', ') : ''}`,
            tableName: 'lost_assets',
            recordId: oldData.id,
            oldValues: oldData,
            newValues: newData
        });
    }
};

// Export for use in other modules
window.Audit = Audit;
