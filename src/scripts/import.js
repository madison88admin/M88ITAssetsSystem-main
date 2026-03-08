/**
 * ============================================
 * IMPORT MODULE
 * Madison 88 IT Equipment Inventory System
 * ============================================
 * 
 * Handles Excel and CSV file imports with
 * pre-import validation and row-by-row preview.
 */

const Import = {
    // ===========================================
    // STATE
    // ===========================================
    
    _importCancelled: false,
    _previewOverlay: null,
    
    // ===========================================
    // FILE PARSING
    // ===========================================
    
    /**
     * Parse uploaded file (Excel or CSV)
     * @param {File} file - Uploaded file
     * @returns {Promise<object[]>} Parsed data
     */
    async parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error('Failed to parse file: ' + error.message));
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    },
    
    // ===========================================
    // COLUMN MAPPING HELPERS
    // ===========================================
    
    /**
     * Map raw row data to standardized field names using flexible aliases
     */
    _mapColumns(row, columnMap) {
        const mapped = {};
        Object.entries(columnMap).forEach(([field, aliases]) => {
            for (const alias of aliases) {
                const key = Object.keys(row).find(k => k.toLowerCase().trim() === alias);
                if (key && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
                    mapped[field] = String(row[key]).trim();
                    break;
                }
            }
        });
        return mapped;
    },

    // Asset column aliases
    _assetColumnMap: {
        name: ['name', 'asset name', 'asset_name'],
        asset_tag: ['asset_tag', 'assettag', 'asset tag', 'tag'],
        serial_number: ['serial_number', 'serial', 'serialnumber', 'sn', 'serial no', 'serial no.'],
        category: ['category', 'type', 'asset type', 'category_name'],
        brand: ['brand', 'manufacturer', 'make'],
        model: ['model', 'model name', 'model no', 'model no.'],
        purchase_date: ['purchase_date', 'purchase date', 'date purchased', 'purchasedate', 'date_purchased'],
        purchase_cost: ['purchase_cost', 'cost', 'price', 'purchase cost'],
        vendor: ['vendor', 'supplier', 'seller'],
        warranty_end_date: ['warranty_end_date', 'warranty end', 'warranty', 'warranty date', 'warranty_end'],
        department: ['department', 'dept', 'department_name'],
        location: ['location', 'loc', 'site'],
        specifications: ['specifications', 'specs', 'spec'],
        notes: ['notes', 'remarks', 'comments', 'note']
    },

    // Employee column aliases
    _employeeColumnMap: {
        employee_id: ['employee_id', 'employeeid', 'emp_id', 'empid', 'id', 'employee id', 'emp id'],
        full_name: ['full_name', 'fullname', 'name', 'employee name', 'employee_name'],
        email: ['email', 'email address', 'e-mail'],
        department: ['department', 'dept', 'department_name'],
        location: ['location', 'table', 'seat', 'table no', 'table_no'],
        position: ['position', 'title', 'job title', 'role', 'job_title'],
        status: ['status', 'is_active', 'active']
    },

    // Assignment column aliases (combines asset + employee + assignment fields)
    _assignmentColumnMap: {
        // Asset identification
        serial_number: ['serial_number', 'serial', 'serialnumber', 'sn', 'serial no', 'serial no.', 'asset_serial', 'asset serial'],
        category: ['category', 'type', 'asset type', 'category_name', 'asset_category', 'asset category'],
        // Asset optional (for auto-creation)
        asset_name: ['asset_name', 'asset name', 'asset'],
        asset_tag: ['asset_tag', 'assettag', 'asset tag', 'tag'],
        brand: ['brand', 'manufacturer', 'make'],
        model: ['model', 'model name', 'model no', 'model no.'],
        // Employee identification
        employee_id: ['employee_id', 'employeeid', 'emp_id', 'empid', 'emp id', 'employee id'],
        full_name: ['full_name', 'fullname', 'employee name', 'employee_name', 'assigned_to', 'assigned to', 'name'],
        // Employee optional (for auto-creation)
        email: ['email', 'email address', 'e-mail'],
        position: ['position', 'title', 'job title', 'role', 'job_title'],
        // Shared
        department: ['department', 'dept', 'department_name'],
        location: ['location', 'loc', 'site', 'table', 'seat'],
        // Assignment specific
        assigned_date: ['assigned_date', 'date assigned', 'date', 'assignment_date', 'assigned date'],
        notes: ['notes', 'remarks', 'comments', 'note']
    },

    // ===========================================
    // ASSET VALIDATION (pre-import)
    // ===========================================
    
    /**
     * Validate asset data against the database before import.
     * Returns row-by-row results with status, warnings, errors, and the DB-ready record.
     *
     * @param {object[]} jsonData - Raw parsed rows from the file
     * @param {object} supabase - Supabase client instance
     * @returns {Promise<object>} { rows, summary } or { error }
     */
    async validateAssetImport(jsonData, supabase) {
        // Fetch lookup tables
        const { data: categories } = await supabase.from('asset_categories').select('id, name');
        const { data: locations } = await supabase.from('locations').select('id, name');
        const { data: departments } = await supabase.from('departments').select('id, name');

        if (!categories || categories.length === 0) {
            return { error: 'No categories found. Please create at least one category first.' };
        }

        const categoryMap = {};
        categories.forEach(c => { categoryMap[c.name.toLowerCase()] = c.id; });
        const defaultCategoryId = categories[0].id;
        const defaultCategoryName = categories[0].name;

        const locationMap = {};
        (locations || []).forEach(l => { locationMap[l.name.toLowerCase()] = l.id; });

        const deptMap = {};
        (departments || []).forEach(d => { deptMap[d.name.toLowerCase()] = d.id; });

        // Fetch existing serial numbers for duplicate checking
        const { data: existingAssets } = await supabase
            .from('assets')
            .select('id, serial_number, name, asset_tag, brand, model');

        const existingSerialMap = {};
        (existingAssets || []).forEach(a => {
            if (a.serial_number) existingSerialMap[a.serial_number.toLowerCase()] = a;
        });

        const rows = [];
        const seenSerials = {};

        for (let i = 0; i < jsonData.length; i++) {
            const raw = jsonData[i];
            const rowNum = i + 2;
            const mapped = this._mapColumns(raw, this._assetColumnMap);

            const r = {
                row: rowNum,
                mapped,
                dbRecord: null,
                status: 'new',       // new | duplicate | error | file_duplicate
                selected: true,
                warnings: [],
                errors: [],
                existingRecord: null
            };

            // --- Required fields ---
            if (!mapped.serial_number) {
                r.errors.push('Missing serial number');
                r.status = 'error';
                r.selected = false;
            }

            // --- Category ---
            let categoryId = defaultCategoryId;
            if (!mapped.category) {
                r.warnings.push('Missing category \u2014 will use default: ' + defaultCategoryName);
            } else {
                const id = categoryMap[mapped.category.toLowerCase()];
                if (id) {
                    categoryId = id;
                } else {
                    r.warnings.push('Category "' + mapped.category + '" not found \u2014 will use default: ' + defaultCategoryName);
                }
            }

            // --- Department ---
            let departmentId = null;
            if (mapped.department) {
                departmentId = deptMap[mapped.department.toLowerCase()] || null;
                if (!departmentId) {
                    r.warnings.push('Department "' + mapped.department + '" not found \u2014 will be set to null');
                }
            }

            // --- Location ---
            let locationId = null;
            if (mapped.location) {
                locationId = locationMap[mapped.location.toLowerCase()] || null;
                if (!locationId) {
                    r.warnings.push('Location "' + mapped.location + '" not found \u2014 will be set to null');
                }
            }

            // --- Duplicate within file ---
            if (mapped.serial_number && r.status !== 'error') {
                const key = mapped.serial_number.toLowerCase();
                if (seenSerials[key] !== undefined) {
                    r.status = 'file_duplicate';
                    r.errors.push('Duplicate serial number in file (same as row ' + seenSerials[key] + ')');
                    r.selected = false;
                } else {
                    seenSerials[key] = rowNum;
                }
            }

            // --- Duplicate in database ---
            if (mapped.serial_number && r.status === 'new') {
                const existing = existingSerialMap[mapped.serial_number.toLowerCase()];
                if (existing) {
                    r.status = 'duplicate';
                    r.existingRecord = existing;
                    r.selected = false;
                }
            }

            // --- Build DB-ready record ---
            r.dbRecord = {
                name: mapped.name || '',
                asset_tag: mapped.asset_tag || null,
                serial_number: mapped.serial_number || '',
                brand: mapped.brand || '',
                model: mapped.model || '',
                status: 'available',
                category_id: categoryId,
                location_id: locationId,
                department_id: departmentId,
                purchase_date: mapped.purchase_date || null,
                purchase_cost: mapped.purchase_cost || null,
                warranty_end_date: mapped.warranty_end_date || null,
                specifications: mapped.specifications || null,
                notes: mapped.notes || null
            };

            rows.push(r);
        }

        return {
            rows,
            summary: this._buildSummary(rows),
            lookups: { categories, locations: locations || [], departments: departments || [] }
        };
    },

    // ===========================================
    // EMPLOYEE VALIDATION (pre-import)
    // ===========================================
    
    /**
     * Validate employee data against the database before import.
     *
     * @param {object[]} jsonData - Raw parsed rows from the file
     * @param {object} supabase - Supabase client instance
     * @returns {Promise<object>} { rows, summary } or { error }
     */
    async validateEmployeeImport(jsonData, supabase) {
        const { data: departments } = await supabase.from('departments').select('id, name');
        const { data: locations } = await supabase.from('locations').select('id, name');

        const deptMap = {};
        (departments || []).forEach(d => { deptMap[d.name.toLowerCase()] = d.id; });
        const locMap = {};
        (locations || []).forEach(l => { locMap[l.name.toLowerCase()] = l.id; });

        // Existing employees for duplicate check
        const { data: existingEmployees } = await supabase
            .from('employees')
            .select('id, employee_id, full_name, email, position');

        const existingEmpMap = {};
        (existingEmployees || []).forEach(e => {
            if (e.employee_id) existingEmpMap[e.employee_id.toLowerCase()] = e;
        });

        const rows = [];
        const seenIds = {};

        for (let i = 0; i < jsonData.length; i++) {
            const raw = jsonData[i];
            const rowNum = i + 2;
            const mapped = this._mapColumns(raw, this._employeeColumnMap);

            const r = {
                row: rowNum,
                mapped,
                dbRecord: null,
                status: 'new',
                selected: true,
                warnings: [],
                errors: [],
                existingRecord: null
            };

            // --- Required fields ---
            if (!mapped.employee_id) {
                r.errors.push('Missing employee ID');
                r.status = 'error';
                r.selected = false;
            }
            if (!mapped.full_name) {
                r.errors.push('Missing full name');
                if (r.status !== 'error') { r.status = 'error'; r.selected = false; }
            }

            // --- Department ---
            let departmentId = null;
            if (mapped.department) {
                departmentId = deptMap[mapped.department.toLowerCase()] || null;
                if (!departmentId) {
                    r.warnings.push('Department "' + mapped.department + '" not found \u2014 will be set to null');
                }
            }

            // --- Location ---
            let locationId = null;
            if (mapped.location) {
                locationId = locMap[mapped.location.toLowerCase()] || null;
                if (!locationId) {
                    r.warnings.push('Location "' + mapped.location + '" not found \u2014 will be set to null');
                }
            }

            // --- Duplicate within file ---
            if (mapped.employee_id && r.status !== 'error') {
                const key = mapped.employee_id.toLowerCase();
                if (seenIds[key] !== undefined) {
                    r.status = 'file_duplicate';
                    r.errors.push('Duplicate employee ID in file (same as row ' + seenIds[key] + ')');
                    r.selected = false;
                } else {
                    seenIds[key] = rowNum;
                }
            }

            // --- Duplicate in DB ---
            if (mapped.employee_id && r.status === 'new') {
                const existing = existingEmpMap[mapped.employee_id.toLowerCase()];
                if (existing) {
                    r.status = 'duplicate';
                    r.existingRecord = existing;
                    r.selected = false;
                }
            }

            // --- DB-ready record ---
            r.dbRecord = {
                full_name: mapped.full_name || '',
                employee_id: mapped.employee_id || '',
                email: mapped.email || null,
                position: mapped.position || null,
                department_id: departmentId,
                location_id: locationId,
                is_active: mapped.status ? mapped.status.toLowerCase() === 'active' : true
            };

            rows.push(r);
        }

        return {
            rows,
            summary: this._buildSummary(rows),
            lookups: { departments: departments || [], locations: locations || [] }
        };
    },

    _buildSummary(rows) {
        return {
            total: rows.length,
            new: rows.filter(r => r.status === 'new').length,
            duplicates: rows.filter(r => r.status === 'duplicate').length,
            fileDuplicates: rows.filter(r => r.status === 'file_duplicate').length,
            errors: rows.filter(r => r.status === 'error').length,
            warnings: rows.filter(r => r.warnings.length > 0).length
        };
    },

    // ===========================================
    // ASSIGNMENT VALIDATION (pre-import)
    // ===========================================

    /**
     * Validate assignment data against the database before import.
     * Checks asset/employee existence, auto-creates missing ones, detects reassignments.
     *
     * @param {object[]} jsonData - Raw parsed rows from the file
     * @param {object} supabase - Supabase client instance
     * @returns {Promise<object>} { rows, summary, lookups } or { error }
     */
    async validateAssignmentImport(jsonData, supabase) {
        // Fetch lookup tables
        const { data: categories } = await supabase.from('asset_categories').select('id, name');
        const { data: departments } = await supabase.from('departments').select('id, name');
        const { data: locations } = await supabase.from('locations').select('id, name');

        if (!categories || categories.length === 0) {
            return { error: 'No categories found. Please create at least one category first.' };
        }

        const catMap = {};
        categories.forEach(c => { catMap[c.name.toLowerCase()] = c.id; });
        const defaultCatId = categories[0].id;
        const defaultCatName = categories[0].name;

        const deptMap = {};
        (departments || []).forEach(d => { deptMap[d.name.toLowerCase()] = d.id; });

        const locMap = {};
        (locations || []).forEach(l => { locMap[l.name.toLowerCase()] = l.id; });

        // Fetch existing assets
        const { data: existingAssets } = await supabase
            .from('assets')
            .select('id, serial_number, name, asset_tag, brand, model, status, category_id');

        const assetSerialMap = {};
        (existingAssets || []).forEach(a => {
            if (a.serial_number) assetSerialMap[a.serial_number.toLowerCase()] = a;
        });

        // Fetch existing employees
        const { data: existingEmployees } = await supabase
            .from('employees')
            .select('id, employee_id, full_name, email, position, is_active');

        const empIdMap = {};
        (existingEmployees || []).forEach(e => {
            if (e.employee_id) empIdMap[e.employee_id.toLowerCase()] = e;
        });

        // Fetch active assignments
        const { data: activeAssignments } = await supabase
            .from('asset_assignments')
            .select('id, asset_id, employee_id, assigned_date, notes')
            .is('returned_date', null);

        const assetAssignmentMap = {};
        (activeAssignments || []).forEach(a => {
            assetAssignmentMap[a.asset_id] = a;
        });

        const rows = [];
        const seenPairs = {};

        for (let i = 0; i < jsonData.length; i++) {
            const raw = jsonData[i];
            const rowNum = i + 2;
            const mapped = this._mapColumns(raw, this._assignmentColumnMap);

            const r = {
                row: rowNum,
                mapped,
                status: 'new',
                selected: true,
                warnings: [],
                errors: [],
                existingAsset: null,
                existingEmployee: null,
                currentAssignment: null,
                assetDbRecord: null,
                employeeDbRecord: null,
                assignmentData: {
                    assigned_date: mapped.assigned_date ? this.parseDate(mapped.assigned_date) || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                }
            };

            // --- Required fields ---
            if (!mapped.serial_number) {
                r.errors.push('Missing serial number');
                r.status = 'error';
                r.selected = false;
            }
            if (!mapped.employee_id) {
                r.errors.push('Missing employee ID');
                if (r.status !== 'error') { r.status = 'error'; r.selected = false; }
            }

            // --- Category ---
            let categoryId = defaultCatId;
            let categoryName = defaultCatName;
            if (mapped.category) {
                const cid = catMap[mapped.category.toLowerCase()];
                if (cid) {
                    categoryId = cid;
                    categoryName = mapped.category;
                } else {
                    r.warnings.push('Category "' + mapped.category + '" not found \u2014 will use default: ' + defaultCatName);
                }
            }

            // --- Department ---
            let departmentId = null;
            if (mapped.department) {
                departmentId = deptMap[mapped.department.toLowerCase()] || null;
                if (!departmentId) {
                    r.warnings.push('Department "' + mapped.department + '" not found \u2014 set to null');
                }
            }

            // --- Location ---
            let locationId = null;
            if (mapped.location) {
                locationId = locMap[mapped.location.toLowerCase()] || null;
                if (!locationId) {
                    r.warnings.push('Location "' + mapped.location + '" not found \u2014 set to null');
                }
            }

            // --- File-internal duplicate (same serial+employee pair) ---
            if (r.status !== 'error') {
                const pairKey = (mapped.serial_number + '||' + mapped.employee_id).toLowerCase();
                if (seenPairs[pairKey] !== undefined) {
                    r.status = 'file_duplicate';
                    r.errors.push('Duplicate assignment in file (same as row ' + seenPairs[pairKey] + ')');
                    r.selected = false;
                } else {
                    seenPairs[pairKey] = rowNum;
                }
            }

            if (r.status === 'error' || r.status === 'file_duplicate') {
                rows.push(r);
                continue;
            }

            // --- Check asset existence ---
            const existingAsset = mapped.serial_number ? assetSerialMap[mapped.serial_number.toLowerCase()] : null;
            let needsCreateAsset = false;

            if (existingAsset) {
                r.existingAsset = existingAsset;
                if (existingAsset.status === 'decommissioned') {
                    r.warnings.push('Asset is decommissioned \u2014 will be set to "assigned" if selected');
                }
            } else {
                needsCreateAsset = true;
                r.assetDbRecord = {
                    name: mapped.asset_name || '',
                    asset_tag: mapped.asset_tag || null,
                    serial_number: mapped.serial_number,
                    brand: mapped.brand || '',
                    model: mapped.model || '',
                    status: 'available',
                    category_id: categoryId,
                    department_id: departmentId,
                    location_id: locationId,
                    notes: mapped.notes || null
                };
            }

            // --- Check employee existence ---
            const existingEmployee = mapped.employee_id ? empIdMap[mapped.employee_id.toLowerCase()] : null;
            let needsCreateEmployee = false;

            if (existingEmployee) {
                r.existingEmployee = existingEmployee;
                if (!existingEmployee.is_active) {
                    r.warnings.push('Employee is inactive \u2014 will still be assigned if selected');
                }
            } else {
                needsCreateEmployee = true;
                if (!mapped.full_name) {
                    r.errors.push('Employee not found in DB and no Full Name provided for auto-creation');
                    r.status = 'error';
                    r.selected = false;
                    rows.push(r);
                    continue;
                }
                r.employeeDbRecord = {
                    employee_id: mapped.employee_id,
                    full_name: mapped.full_name,
                    email: mapped.email || null,
                    position: mapped.position || null,
                    department_id: departmentId,
                    location_id: locationId,
                    is_active: true
                };
            }

            // --- Determine status ---
            if (needsCreateAsset && needsCreateEmployee) {
                r.status = 'new_both';
                r.warnings.push('Asset and employee will be auto-created');
            } else if (needsCreateAsset) {
                r.status = 'new_asset';
                r.warnings.push('Asset will be auto-created');
            } else if (needsCreateEmployee) {
                r.status = 'new_employee';
                r.warnings.push('Employee will be auto-created');
            } else {
                // Both exist — check current assignment status
                const currentAssignment = assetAssignmentMap[existingAsset.id];

                if (currentAssignment) {
                    r.currentAssignment = currentAssignment;

                    if (currentAssignment.employee_id === existingEmployee.id) {
                        r.status = 'already_assigned';
                        r.selected = false;
                    } else {
                        r.status = 'reassign';
                        r.selected = false;
                        const currentEmp = (existingEmployees || []).find(e => e.id === currentAssignment.employee_id);
                        r.warnings.push('Currently assigned to: ' + (currentEmp ? currentEmp.full_name + ' (' + currentEmp.employee_id + ')' : 'Unknown employee'));
                    }
                } else {
                    if (existingAsset.status !== 'available') {
                        r.warnings.push('Asset status is "' + existingAsset.status + '" \u2014 will be changed to "assigned"');
                    }
                    r.status = 'new';
                }
            }

            rows.push(r);
        }

        return {
            rows,
            summary: this._buildAssignmentSummary(rows),
            lookups: { categories, departments: departments || [], locations: locations || [] }
        };
    },

    _buildAssignmentSummary(rows) {
        const newAsset = rows.filter(r => r.status === 'new_asset').length;
        const newEmployee = rows.filter(r => r.status === 'new_employee').length;
        const newBoth = rows.filter(r => r.status === 'new_both').length;
        return {
            total: rows.length,
            new: rows.filter(r => r.status === 'new').length,
            autoCreate: newAsset + newEmployee + newBoth,
            newAsset,
            newEmployee,
            newBoth,
            reassign: rows.filter(r => r.status === 'reassign').length,
            alreadyAssigned: rows.filter(r => r.status === 'already_assigned').length,
            fileDuplicates: rows.filter(r => r.status === 'file_duplicate').length,
            errors: rows.filter(r => r.status === 'error').length,
            warnings: rows.filter(r => r.warnings.length > 0).length
        };
    },

    // ===========================================
    // VALIDATION PREVIEW MODAL
    // ===========================================

    /**
     * Show full row-by-row preview with per-record checkboxes.
     * Returns a promise that resolves with { action, selectedRows }.
     *
     * @param {object} validation - Output from validateAssetImport / validateEmployeeImport
     * @param {string} type - 'assets' | 'employees' | 'assignments'
     * @returns {Promise<{action: string, selectedRows: object[]}>}
     */
    showValidationPreview(validation, type) {
        const { rows, summary } = validation;
        const isAssets = type === 'assets';
        const isAssignments = type === 'assignments';

        return new Promise((resolve) => {
            // ---- Summary bar ----
            let summaryHtml;
            if (isAssignments) {
                const autoCreate = (summary.autoCreate || 0);
                summaryHtml = `
                <div class="import-preview-summary">
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-white">${summary.total}</span>
                        <span class="import-preview-stat-label">Total Rows</span>
                    </div>
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-green-400">${summary.new}</span>
                        <span class="import-preview-stat-label">Ready</span>
                    </div>
                    ${autoCreate > 0 ? `
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-cyan-400">${autoCreate}</span>
                        <span class="import-preview-stat-label">Auto-Create</span>
                    </div>` : ''}
                    ${summary.reassign > 0 ? `
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-orange-400">${summary.reassign}</span>
                        <span class="import-preview-stat-label">Reassign</span>
                    </div>` : ''}
                    ${summary.alreadyAssigned > 0 ? `
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-yellow-400">${summary.alreadyAssigned}</span>
                        <span class="import-preview-stat-label">Already Assigned</span>
                    </div>` : ''}
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-red-400">${summary.errors}</span>
                        <span class="import-preview-stat-label">Errors</span>
                    </div>
                    ${summary.warnings > 0 ? `
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-blue-400">${summary.warnings}</span>
                        <span class="import-preview-stat-label">Warnings</span>
                    </div>` : ''}
                </div>`;
            } else {
                summaryHtml = `
                <div class="import-preview-summary">
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-white">${summary.total}</span>
                        <span class="import-preview-stat-label">Total Rows</span>
                    </div>
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-green-400">${summary.new}</span>
                        <span class="import-preview-stat-label">New</span>
                    </div>
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-yellow-400">${summary.duplicates}</span>
                        <span class="import-preview-stat-label">Already Exist</span>
                    </div>
                    ${summary.fileDuplicates > 0 ? `
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-orange-400">${summary.fileDuplicates}</span>
                        <span class="import-preview-stat-label">File Duplicates</span>
                    </div>` : ''}
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-red-400">${summary.errors}</span>
                        <span class="import-preview-stat-label">Errors</span>
                    </div>
                    ${summary.warnings > 0 ? `
                    <div class="import-preview-stat">
                        <span class="import-preview-stat-count text-blue-400">${summary.warnings}</span>
                        <span class="import-preview-stat-label">Warnings</span>
                    </div>` : ''}
                </div>`;
            }

            // ---- Table headers ----
            const headers = isAssignments
                ? ['', 'Row', 'Status', 'Serial Number', 'Category', 'Employee ID', 'Employee Name', 'Issues']
                : isAssets
                    ? ['', 'Row', 'Status', 'Serial Number', 'Name', 'Category', 'Brand / Model', 'Issues']
                    : ['', 'Row', 'Status', 'Employee ID', 'Full Name', 'Email', 'Department', 'Issues'];

            const thHtml = headers.map(h => '<th class="import-preview-th">' + h + '</th>').join('');

            // ---- Table rows ----
            const tbodyHtml = rows.map((r, idx) => {
                const badge = this._getStatusBadge(r.status);
                const isDisabled = (r.status === 'error' || r.status === 'file_duplicate');
                const checkDisabled = isDisabled ? 'disabled' : '';
                const checkChecked = r.selected ? 'checked' : '';
                const rowClass = r.status === 'error' ? 'import-row-error'
                    : r.status === 'file_duplicate' ? 'import-row-error'
                    : (r.status === 'duplicate' || r.status === 'already_assigned') ? 'import-row-duplicate'
                    : r.status === 'reassign' ? 'import-row-reassign'
                    : '';

                // Issues column
                const allIssues = [
                    ...r.errors.map(e => '<span class="text-xs text-red-400">' + this._escHtml(e) + '</span>'),
                    ...r.warnings.map(w => '<span class="text-xs text-yellow-400">\u26A0 ' + this._escHtml(w) + '</span>')
                ];
                const issueHtml = allIssues.length > 0
                    ? '<div class="import-preview-issues">' + allIssues.join('<br>') + '</div>'
                    : '<span class="text-xs text-green-400">\u2714 OK</span>';

                let cells;
                if (isAssignments) {
                    cells = `
                        <td class="import-preview-td"><input type="checkbox" class="import-row-check" data-idx="${idx}" ${checkChecked} ${checkDisabled}></td>
                        <td class="import-preview-td text-slate-500 text-xs">${r.row}</td>
                        <td class="import-preview-td">${badge}</td>
                        <td class="import-preview-td font-mono text-sm">${this._escHtml(r.mapped.serial_number || '\u2014')}</td>
                        <td class="import-preview-td text-sm">${this._escHtml(r.mapped.category || 'default')}</td>
                        <td class="import-preview-td font-mono text-sm">${this._escHtml(r.mapped.employee_id || '\u2014')}</td>
                        <td class="import-preview-td">${this._escHtml(r.mapped.full_name || (r.existingEmployee ? r.existingEmployee.full_name : '\u2014'))}</td>
                        <td class="import-preview-td">${issueHtml}</td>`;
                } else if (isAssets) {
                    cells = `
                        <td class="import-preview-td"><input type="checkbox" class="import-row-check" data-idx="${idx}" ${checkChecked} ${checkDisabled}></td>
                        <td class="import-preview-td text-slate-500 text-xs">${r.row}</td>
                        <td class="import-preview-td">${badge}</td>
                        <td class="import-preview-td font-mono text-sm">${this._escHtml(r.mapped.serial_number || '\u2014')}</td>
                        <td class="import-preview-td">${this._escHtml(r.mapped.name || '\u2014')}</td>
                        <td class="import-preview-td">${this._escHtml(r.mapped.category || 'default')}</td>
                        <td class="import-preview-td text-sm">${this._escHtml((r.mapped.brand || '') + (r.mapped.model ? ' / ' + r.mapped.model : ''))}</td>
                        <td class="import-preview-td">${issueHtml}</td>`;
                } else {
                    cells = `
                        <td class="import-preview-td"><input type="checkbox" class="import-row-check" data-idx="${idx}" ${checkChecked} ${checkDisabled}></td>
                        <td class="import-preview-td text-slate-500 text-xs">${r.row}</td>
                        <td class="import-preview-td">${badge}</td>
                        <td class="import-preview-td font-mono text-sm">${this._escHtml(r.mapped.employee_id || '\u2014')}</td>
                        <td class="import-preview-td">${this._escHtml(r.mapped.full_name || '\u2014')}</td>
                        <td class="import-preview-td text-sm">${this._escHtml(r.mapped.email || '\u2014')}</td>
                        <td class="import-preview-td text-sm">${this._escHtml(r.mapped.department || '\u2014')}</td>
                        <td class="import-preview-td">${issueHtml}</td>`;
                }

                // Existing record detail row for duplicates / reassignments
                let dupDetail = '';
                if (isAssignments && r.status === 'reassign' && r.currentAssignment) {
                    const curEmp = r.existingEmployee ? '' : '';
                    const info = 'Will return from current assignee and reassign to <strong>' + this._escHtml(r.mapped.full_name || r.existingEmployee?.full_name || '\u2014') + '</strong>';
                    dupDetail = '<tr class="import-row-dup-detail"><td colspan="' + headers.length + '" class="import-preview-td" style="padding-left:2.5rem;"><div class="import-dup-info">' + info + '</div></td></tr>';
                } else if (isAssignments && r.status === 'already_assigned') {
                    const info = 'Already assigned to this employee \u2014 selecting will update notes/date';
                    dupDetail = '<tr class="import-row-dup-detail"><td colspan="' + headers.length + '" class="import-preview-td" style="padding-left:2.5rem;"><div class="import-dup-info">' + info + '</div></td></tr>';
                } else if (!isAssignments && r.status === 'duplicate' && r.existingRecord) {
                    const ex = r.existingRecord;
                    const info = isAssets
                        ? 'Existing in DB: <strong>' + this._escHtml(ex.name || '\u2014') + '</strong> | Tag: ' + this._escHtml(ex.asset_tag || '\u2014') + ' | Brand: ' + this._escHtml(ex.brand || '\u2014') + ' | Model: ' + this._escHtml(ex.model || '\u2014')
                        : 'Existing in DB: <strong>' + this._escHtml(ex.full_name || '\u2014') + '</strong> | Email: ' + this._escHtml(ex.email || '\u2014') + ' | Position: ' + this._escHtml(ex.position || '\u2014');
                    dupDetail = '<tr class="import-row-dup-detail"><td colspan="' + headers.length + '" class="import-preview-td" style="padding-left:2.5rem;"><div class="import-dup-info">' + info + '</div></td></tr>';
                }

                return '<tr class="' + rowClass + '" data-row-idx="' + idx + '">' + cells + '</tr>' + dupDetail;
            }).join('');

            const initialSelected = rows.filter(r => r.selected).length;

            // ---- Toolbar select-all checkboxes ----
            let toolbarCheckboxes;
            if (isAssignments) {
                toolbarCheckboxes = `
                    <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;color:#cbd5e1;cursor:pointer;">
                        <input type="checkbox" id="import-select-all-new" checked> Select all new
                    </label>
                    <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;color:#cbd5e1;cursor:pointer;">
                        <input type="checkbox" id="import-select-all-reassign"> Select all reassignments
                    </label>
                    <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;color:#cbd5e1;cursor:pointer;">
                        <input type="checkbox" id="import-select-all-existing"> Select all existing (overwrite)
                    </label>`;
            } else {
                toolbarCheckboxes = `
                    <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;color:#cbd5e1;cursor:pointer;">
                        <input type="checkbox" id="import-select-all-new" checked> Select all new
                    </label>
                    <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;color:#cbd5e1;cursor:pointer;">
                        <input type="checkbox" id="import-select-all-dup"> Select all existing (overwrite)
                    </label>`;
            }

            // ---- Modal title ----
            const titleLabel = isAssignments ? 'Assignments' : (isAssets ? 'Assets' : 'Employees');

            // ---- Full modal markup ----
            const html = `
                <div class="import-preview-overlay" id="import-preview-overlay">
                    <div class="import-preview-modal">
                        <div class="import-preview-header">
                            <div>
                                <h3 class="text-lg font-semibold text-white">Import Preview \u2014 ${titleLabel}</h3>
                                <p class="text-sm text-slate-400 mt-1">Review and select which records to import</p>
                            </div>
                            <button class="import-preview-close" id="import-preview-close">&times;</button>
                        </div>

                        ${summaryHtml}

                        <div class="import-preview-toolbar">
                            <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                                ${toolbarCheckboxes}
                            </div>
                            <div style="font-size:0.85rem;color:#94a3b8;">
                                <span id="import-selected-count">${initialSelected}</span> / ${summary.total} selected
                            </div>
                        </div>

                        <div class="import-preview-table-wrap">
                            <table class="import-preview-table">
                                <thead><tr>${thHtml}</tr></thead>
                                <tbody id="import-preview-tbody">${tbodyHtml}</tbody>
                            </table>
                        </div>

                        <div class="import-preview-footer">
                            <button class="btn btn-secondary" id="import-preview-cancel">Cancel</button>
                            <button class="btn btn-primary" id="import-preview-confirm">
                                Import Selected (<span id="import-confirm-count">${initialSelected}</span>)
                            </button>
                        </div>
                    </div>
                </div>`;

            // Inject
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            const overlay = wrapper.firstElementChild;
            document.body.appendChild(overlay);
            this._previewOverlay = overlay;

            // Animate in
            requestAnimationFrame(() => overlay.classList.add('open'));

            // ---- Event wiring ----
            const updateCount = () => {
                const checks = overlay.querySelectorAll('.import-row-check:not(:disabled)');
                let n = 0;
                checks.forEach(ch => { if (ch.checked) n++; });
                overlay.querySelector('#import-selected-count').textContent = n;
                overlay.querySelector('#import-confirm-count').textContent = n;
                // sync state
                checks.forEach(ch => {
                    rows[parseInt(ch.dataset.idx)].selected = ch.checked;
                });
            };

            overlay.querySelectorAll('.import-row-check').forEach(ch => {
                ch.addEventListener('change', updateCount);
            });

            // "Select all new" — covers 'new' + assignment auto-create statuses
            overlay.querySelector('#import-select-all-new').addEventListener('change', (e) => {
                const newStatuses = isAssignments
                    ? ['new', 'new_asset', 'new_employee', 'new_both']
                    : ['new'];
                rows.forEach((r, idx) => {
                    if (newStatuses.includes(r.status)) {
                        r.selected = e.target.checked;
                        const cb = overlay.querySelector('.import-row-check[data-idx="' + idx + '"]');
                        if (cb) cb.checked = e.target.checked;
                    }
                });
                updateCount();
            });

            // "Select all existing (overwrite)" for assets/employees
            const dupCheckbox = overlay.querySelector('#import-select-all-dup');
            if (dupCheckbox) {
                dupCheckbox.addEventListener('change', (e) => {
                    rows.forEach((r, idx) => {
                        if (r.status === 'duplicate') {
                            r.selected = e.target.checked;
                            const cb = overlay.querySelector('.import-row-check[data-idx="' + idx + '"]');
                            if (cb) cb.checked = e.target.checked;
                        }
                    });
                    updateCount();
                });
            }

            // Assignment-specific: "Select all reassignments"
            const reassignCheckbox = overlay.querySelector('#import-select-all-reassign');
            if (reassignCheckbox) {
                reassignCheckbox.addEventListener('change', (e) => {
                    rows.forEach((r, idx) => {
                        if (r.status === 'reassign') {
                            r.selected = e.target.checked;
                            const cb = overlay.querySelector('.import-row-check[data-idx="' + idx + '"]');
                            if (cb) cb.checked = e.target.checked;
                        }
                    });
                    updateCount();
                });
            }

            // Assignment-specific: "Select all existing (overwrite)"
            const existingCheckbox = overlay.querySelector('#import-select-all-existing');
            if (existingCheckbox) {
                existingCheckbox.addEventListener('change', (e) => {
                    rows.forEach((r, idx) => {
                        if (r.status === 'already_assigned') {
                            r.selected = e.target.checked;
                            const cb = overlay.querySelector('.import-row-check[data-idx="' + idx + '"]');
                            if (cb) cb.checked = e.target.checked;
                        }
                    });
                    updateCount();
                });
            }

            const close = (action) => {
                overlay.classList.remove('open');
                setTimeout(() => {
                    overlay.remove();
                    this._previewOverlay = null;
                }, 250);

                if (action === 'cancel') {
                    resolve({ action: 'cancel', selectedRows: [] });
                } else if (isAssignments) {
                    // For assignments, return rich objects with action metadata
                    const selected = rows
                        .filter(r => r.selected && r.status !== 'error' && r.status !== 'file_duplicate')
                        .map(r => ({
                            _action: r.status,
                            _existingAssetId: r.existingAsset?.id || null,
                            _existingEmployeeId: r.existingEmployee?.id || null,
                            _currentAssignmentId: r.currentAssignment?.id || null,
                            assetData: r.assetDbRecord,
                            employeeData: r.employeeDbRecord,
                            assignmentData: r.assignmentData,
                            mapped: r.mapped
                        }));
                    resolve({ action: 'import', selectedRows: selected });
                } else {
                    // For assets/employees, return flat db records
                    const selected = rows
                        .filter(r => r.selected && r.status !== 'error' && r.status !== 'file_duplicate')
                        .map(r => {
                            const rec = { ...r.dbRecord };
                            if (r.status === 'duplicate' && r.existingRecord?.id) {
                                rec._existingId = r.existingRecord.id;
                            }
                            return rec;
                        });
                    resolve({ action: 'import', selectedRows: selected });
                }
            };

            overlay.querySelector('#import-preview-cancel').addEventListener('click', () => close('cancel'));
            overlay.querySelector('#import-preview-close').addEventListener('click', () => close('cancel'));
            overlay.querySelector('#import-preview-confirm').addEventListener('click', () => close('import'));
        });
    },

    // ===========================================
    // HELPERS
    // ===========================================

    _escHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    _getStatusBadge(status) {
        const map = {
            'new':              '<span class="import-badge import-badge-new">New</span>',
            'duplicate':        '<span class="import-badge import-badge-dup">Existing</span>',
            'file_duplicate':   '<span class="import-badge import-badge-filedup">File Dup</span>',
            'error':            '<span class="import-badge import-badge-error">Error</span>',
            'new_asset':        '<span class="import-badge import-badge-create">+ Asset</span>',
            'new_employee':     '<span class="import-badge import-badge-create">+ Employee</span>',
            'new_both':         '<span class="import-badge import-badge-create">+ Both</span>',
            'reassign':         '<span class="import-badge import-badge-reassign">Reassign</span>',
            'already_assigned': '<span class="import-badge import-badge-dup">Assigned</span>'
        };
        return map[status] || '<span class="import-badge">' + status + '</span>';
    },

    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================

    parseDate(dateStr) {
        if (!dateStr) return null;
        // Handle Excel serial date numbers (e.g. 44436 → 2021-09-02)
        const num = Number(dateStr);
        if (!isNaN(num) && num > 25569 && num < 2958465) {
            // Excel serial: days since 1899-12-30, convert to JS timestamp
            const date = new Date(Math.round((num - 25569) * 86400 * 1000));
            if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
        }
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
        return null;
    },

    downloadAssetTemplate() {
        const ws = XLSX.utils.json_to_sheet([{
            'Serial Number': 'SN-001', 'Category': 'Laptop', 'Brand': 'Dell',
            'Model': 'Latitude 5520', 'Purchase Date': '2024-01-15',
            'Vendor': 'Tech Supplier Inc.', 'Warranty End': '2027-01-15',
            'Department': 'IT', 'Notes': 'Sample asset'
        }]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Assets');
        XLSX.writeFile(wb, 'Asset_Import_Template.xlsx');
    },

    downloadEmployeeTemplate() {
        const ws = XLSX.utils.json_to_sheet([{
            'Employee ID': 'EMP-001', 'Full Name': 'John Doe',
            'Email': 'john.doe@madison88.com', 'Department': 'IT',
            'Location': 'Table 1', 'Position': 'IT Specialist'
        }]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Employees');
        XLSX.writeFile(wb, 'Employee_Import_Template.xlsx');
    },

    // ===========================================
    // UI HELPERS
    // ===========================================

    cancelImport() {
        this._importCancelled = true;
        if (this._previewOverlay) {
            this._previewOverlay.classList.remove('open');
            setTimeout(() => {
                this._previewOverlay && this._previewOverlay.remove();
                this._previewOverlay = null;
            }, 250);
        }
    },

    /**
     * Show import info / requirements pane before file selection
     * @param {string} type - 'assets' or 'employees'
     * @returns {Promise<boolean>}
     */
    async showImportInfo(type) {
        const isAssets = type === 'assets';
        const isAssignments = type === 'assignments';

        const columns = isAssignments ? [
            { name: 'Serial_Number', required: true, aliases: 'serial_number, serial, sn' },
            { name: 'Category', required: true, aliases: 'category, type, asset type' },
            { name: 'Employee_ID', required: true, aliases: 'employee_id, emp_id' },
            { name: 'Full_Name', required: true, aliases: 'full_name, name, assigned_to' },
            { name: 'Brand', required: false, aliases: 'brand, manufacturer, make' },
            { name: 'Model', required: false, aliases: 'model, model name' },
            { name: 'Asset_Tag', required: false, aliases: 'asset_tag, tag' },
            { name: 'Email', required: false, aliases: 'email, e-mail' },
            { name: 'Position', required: false, aliases: 'position, title, role' },
            { name: 'Department', required: false, aliases: 'department, dept' },
            { name: 'Location', required: false, aliases: 'location, table, seat' },
            { name: 'Assigned_Date', required: false, aliases: 'assigned_date, date' },
            { name: 'Notes', required: false, aliases: 'notes, remarks, comments' }
        ] : isAssets ? [
            { name: 'Name', required: false, aliases: 'name, asset name' },
            { name: 'Serial_Number', required: true, aliases: 'serial_number, serial, sn' },
            { name: 'Category', required: true, aliases: 'category, type, asset type' },
            { name: 'Brand', required: false, aliases: 'brand, manufacturer, make' },
            { name: 'Model', required: false, aliases: 'model, model name' },
            { name: 'Purchase_Date', required: false, aliases: 'purchase_date, date purchased' },
            { name: 'Vendor', required: false, aliases: 'vendor, supplier' },
            { name: 'Warranty_End', required: false, aliases: 'warranty_end_date, warranty end' },
            { name: 'Department', required: false, aliases: 'department, dept' },
            { name: 'Notes', required: false, aliases: 'notes, remarks, comments' }
        ] : [
            { name: 'Employee_ID', required: true, aliases: 'employee_id, emp_id, id' },
            { name: 'Full_Name', required: true, aliases: 'full_name, name' },
            { name: 'Email', required: false, aliases: 'email, e-mail' },
            { name: 'Department', required: false, aliases: 'department, dept' },
            { name: 'Location', required: false, aliases: 'location, table, seat' },
            { name: 'Position', required: false, aliases: 'position, title, job title' }
        ];

        const rules = isAssignments ? [
            'Each row represents one asset-to-employee assignment',
            'If the asset (Serial Number) does not exist, it will be auto-created',
            'If the employee (Employee ID) does not exist, it will be auto-created',
            'Full_Name is required when the employee is not yet in the system',
            'Category is used when auto-creating assets (defaults to first category)',
            'Assets already assigned to a different employee will be flagged as "Reassign"',
            'Existing assignments can be overwritten (update notes/date)',
            'Department and Location names must match existing values (optional)'
        ] : isAssets ? [
            'Category must exist in the system before import',
            'Serial numbers should be unique',
            'Dates should be in format: YYYY-MM-DD or MM/DD/YYYY',
            'All imported assets will have "Available" status',
            'Department names must match existing departments (optional)'
        ] : [
            'Employee IDs should be unique',
            'Department names must match existing departments (optional)',
            'Location names must match existing locations (optional)',
            'Status will be set to "Active" by default'
        ];

        const columnRows = columns.map(col => `
            <tr>
                <td class="py-2 px-3 border-b border-slate-700">
                    <span class="font-medium ${col.required ? 'text-red-400' : 'text-slate-300'}">
                        ${col.name}${col.required ? ' *' : ''}
                    </span>
                </td>
                <td class="py-2 px-3 border-b border-slate-700 text-sm text-slate-400">${col.aliases}</td>
            </tr>`).join('');

        const ruleItems = rules.map(r => '<li class="text-sm text-slate-300 mb-1">' + r + '</li>').join('');

        const content = `
            <div class="space-y-4">
                <div class="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 mb-4">
                    <p class="text-sm text-blue-300">
                        <svg class="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
                        Accepted formats: CSV, XLSX, XLS. Data will be validated before import.
                    </p>
                </div>
                <div>
                    <h4 class="text-sm font-semibold text-slate-300 mb-2" style="text-align:left;">Required Columns:</h4>
                    <div class="bg-slate-800/50 rounded-lg overflow-hidden">
                        <table class="w-full">
                            <thead class="bg-slate-700/50">
                                <tr>
                                    <th class="py-2 px-3 text-left text-xs font-semibold text-slate-400 uppercase">Column</th>
                                    <th class="py-2 px-3 text-left text-xs font-semibold text-slate-400 uppercase">Accepted Aliases</th>
                                </tr>
                            </thead>
                            <tbody style="text-align:left;">${columnRows}</tbody>
                        </table>
                    </div>
                    <p class="text-xs text-red-400 mt-2" style="text-align:left;">* Required fields</p>
                </div>
                <div>
                    <h4 class="text-sm font-semibold text-slate-300 mb-2" style="text-align:left;">Import Rules:</h4>
                    <ul class="list-disc list-inside space-y-1 bg-slate-800/50 rounded-lg p-3" style="text-align:left;">${ruleItems}</ul>
                </div>
            </div>`;

        return Components.showModal({
            title: 'Import ' + Utils.capitalize(type) + ' \u2014 Requirements',
            content,
            confirmText: 'Continue to Select File',
            cancelText: 'Cancel',
            showCancel: true
        });
    },

    // ===========================================
    // IMPORT TYPE CHOICE MODAL
    // ===========================================

    /**
     * Show a modal letting the user choose between Basic Import and Detailed Import.
     * @param {string} type - 'assets' | 'employees' | 'assignments'
     * @returns {Promise<string|null>} 'basic' | 'detailed' | null (cancelled)
     */
    showImportChoice(type) {
        const titleLabel = type === 'assignments' ? 'Assignments' : type === 'assets' ? 'IT Equipment' : 'Employees';
        return new Promise((resolve) => {
            const html = `
                <div class="import-choice-overlay" id="import-choice-overlay">
                    <div class="import-choice-modal">
                        <div class="import-choice-header">
                            <h3 class="text-lg font-semibold text-white">Import ${titleLabel}</h3>
                            <button class="import-preview-close" id="import-choice-close">&times;</button>
                        </div>
                        <div class="import-choice-body">
                            <p class="text-sm text-slate-400 mb-5">Choose an import method:</p>
                            <div class="import-choice-cards">
                                <button class="import-choice-card" id="import-choice-basic">
                                    <div class="import-choice-icon import-choice-icon-basic">
                                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                    </div>
                                    <div class="import-choice-label">Basic Import</div>
                                    <div class="import-choice-desc">Quick &amp; automatic. Scans your file, validates columns, and imports all valid records instantly. Duplicates are updated automatically.</div>
                                </button>
                                <button class="import-choice-card" id="import-choice-detailed">
                                    <div class="import-choice-icon import-choice-icon-detailed">
                                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                                    </div>
                                    <div class="import-choice-label">Detailed Import</div>
                                    <div class="import-choice-desc">Full control. Preview every row, select which records to import or skip, review duplicates and errors individually.</div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;

            const wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            const overlay = wrapper.firstElementChild;
            document.body.appendChild(overlay);

            requestAnimationFrame(() => overlay.classList.add('open'));

            const close = (choice) => {
                overlay.classList.remove('open');
                setTimeout(() => overlay.remove(), 250);
                resolve(choice);
            };

            overlay.querySelector('#import-choice-close').addEventListener('click', () => close(null));
            overlay.querySelector('#import-choice-basic').addEventListener('click', () => close('basic'));
            overlay.querySelector('#import-choice-detailed').addEventListener('click', () => close('detailed'));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(null);
            });
        });
    },

    // ===========================================
    // BASIC IMPORT — COLUMN SCAN + AUTO-IMPORT
    // ===========================================

    /**
     * Show the Basic Import scanning overlay.
     * Scans the file columns, shows animated checklist, then auto-imports.
     *
     * @param {File} file - Uploaded file
     * @param {string} type - 'assets' | 'employees' | 'assignments'
     * @param {object} supabase - Supabase client instance
     * @param {object} currentUser - Current authenticated user
     * @returns {Promise<{success: boolean, imported: number, updated: number, skipped: number, errors: object[], skippedDetails: object[]}|null>}
     */
    async runBasicImport(file, type, supabase, currentUser) {
        // Determine required and optional columns for this type
        const columnDefs = this._getBasicImportColumns(type);
        const columnMap = type === 'assets' ? this._assetColumnMap
            : type === 'employees' ? this._employeeColumnMap
            : this._assignmentColumnMap;

        // Create the scanning overlay
        const overlay = this._createScanOverlay(type, columnDefs);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('open'));

        const scanItems = overlay.querySelectorAll('.basic-import-scan-item');
        const statusArea = overlay.querySelector('#basic-import-status');
        const actionArea = overlay.querySelector('#basic-import-actions');

        // Helper to update a scan item
        const updateItem = (index, state, detail) => {
            const item = scanItems[index];
            if (!item) return;
            const icon = item.querySelector('.basic-import-scan-icon');
            const detailEl = item.querySelector('.basic-import-scan-detail');
            if (state === 'scanning') {
                icon.innerHTML = '<div class="basic-import-spinner"></div>';
                item.classList.add('scanning');
                item.classList.remove('success', 'error');
            } else if (state === 'success') {
                icon.innerHTML = '<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
                item.classList.remove('scanning');
                item.classList.add('success');
            } else if (state === 'error') {
                icon.innerHTML = '<svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
                item.classList.remove('scanning');
                item.classList.add('error');
            } else if (state === 'skipped') {
                icon.innerHTML = '<svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>';
                item.classList.remove('scanning');
                item.classList.add('skipped');
            }
            if (detail) detailEl.textContent = detail;
        };

        const delay = (ms) => new Promise(r => setTimeout(r, ms));

        try {
            // Step 1: Parse file
            statusArea.textContent = 'Reading file...';
            const jsonData = await this.parseFile(file);
            if (!jsonData || !jsonData.length) {
                statusArea.innerHTML = '<span class="text-red-400">No data found in the file.</span>';
                actionArea.innerHTML = '<button class="btn btn-secondary" id="basic-import-close">Close</button>';
                actionArea.querySelector('#basic-import-close').addEventListener('click', () => {
                    overlay.classList.remove('open');
                    setTimeout(() => overlay.remove(), 250);
                });
                return null;
            }

            statusArea.textContent = 'Found ' + jsonData.length + ' rows. Scanning columns...';
            await delay(300);

            // Step 2: Check each column
            const fileHeaders = Object.keys(jsonData[0]).map(k => k.toLowerCase().trim());
            let requiredMissing = false;
            const foundColumns = {};

            for (let i = 0; i < columnDefs.length; i++) {
                const col = columnDefs[i];
                updateItem(i, 'scanning', 'Checking...');
                await delay(400);

                // Find this column in the file using aliases from the column map
                const aliases = columnMap[col.field] || [col.field.toLowerCase()];
                let foundAlias = null;
                let matchedHeader = null;

                for (const alias of aliases) {
                    const match = fileHeaders.find(h => h === alias);
                    if (match) {
                        foundAlias = alias;
                        matchedHeader = Object.keys(jsonData[0]).find(k => k.toLowerCase().trim() === match);
                        break;
                    }
                }

                if (foundAlias && matchedHeader) {
                    // Column found — check values
                    if (col.required) {
                        // Verify no empty values for required columns
                        const emptyCount = jsonData.filter(row => {
                            const val = row[matchedHeader];
                            return val === undefined || val === null || String(val).trim() === '';
                        }).length;

                        if (emptyCount > 0) {
                            updateItem(i, 'success', 'Found in column "' + matchedHeader + '" — ' + emptyCount + ' empty value(s) will be flagged');
                        } else {
                            updateItem(i, 'success', 'Found in column "' + matchedHeader + '" — all values valid');
                        }
                    } else {
                        updateItem(i, 'success', 'Found in column "' + matchedHeader + '"');
                    }
                    foundColumns[col.field] = matchedHeader;
                } else {
                    // Column not found
                    if (col.required) {
                        updateItem(i, 'error', 'NOT FOUND — this column is required');
                        requiredMissing = true;
                    } else {
                        updateItem(i, 'skipped', 'Not found — will be skipped');
                    }
                }
            }

            await delay(300);

            // Step 3: Handle result
            if (requiredMissing) {
                statusArea.innerHTML = '<span class="text-red-400 font-semibold">Required columns are missing.</span><br><span class="text-slate-400 text-sm">Please use <strong>Detailed Import</strong> to manually map your columns, or update your file to include the required columns.</span>';
                actionArea.innerHTML = '<button class="btn btn-secondary" id="basic-import-close">Close</button>';
                actionArea.querySelector('#basic-import-close').addEventListener('click', () => {
                    overlay.classList.remove('open');
                    setTimeout(() => overlay.remove(), 250);
                });
                return null;
            }

            // All required columns found — proceed with validation and import
            statusArea.textContent = 'All columns verified! Validating data...';
            await delay(500);

            let validation;
            if (type === 'assets') {
                validation = await this.validateAssetImport(jsonData, supabase);
            } else if (type === 'employees') {
                validation = await this.validateEmployeeImport(jsonData, supabase);
            } else {
                validation = await this.validateAssignmentImport(jsonData, supabase);
            }

            if (validation.error) {
                statusArea.innerHTML = '<span class="text-red-400">' + this._escHtml(validation.error) + '</span>';
                actionArea.innerHTML = '<button class="btn btn-secondary" id="basic-import-close">Close</button>';
                actionArea.querySelector('#basic-import-close').addEventListener('click', () => {
                    overlay.classList.remove('open');
                    setTimeout(() => overlay.remove(), 250);
                });
                return null;
            }

            const { rows } = validation;

            // For basic import: auto-select all importable rows (new + duplicates for overwrite)
            const importableRows = rows.filter(r =>
                r.status !== 'error' && r.status !== 'file_duplicate'
            );

            // Mark all importable rows as selected (including duplicates for overwrite)
            importableRows.forEach(r => r.selected = true);

            const errorRows = rows.filter(r => r.status === 'error' || r.status === 'file_duplicate');

            statusArea.textContent = 'Importing ' + importableRows.length + ' records...';

            // Step 4: Perform the import
            const result = await this._executeBasicImport(importableRows, type, supabase, currentUser, (progress) => {
                statusArea.textContent = 'Importing... ' + progress.current + ' of ' + progress.total;
            });

            // Step 5: Show summary
            const summaryHtml = this._buildBasicImportSummary(result, errorRows, type);
            statusArea.innerHTML = summaryHtml;

            actionArea.innerHTML = '<button class="btn btn-primary" id="basic-import-done">Done</button>';

            return new Promise((resolve2) => {
                actionArea.querySelector('#basic-import-done').addEventListener('click', () => {
                    overlay.classList.remove('open');
                    setTimeout(() => overlay.remove(), 250);
                    resolve2(result);
                });
            });

        } catch (err) {
            statusArea.innerHTML = '<span class="text-red-400">Import failed: ' + this._escHtml(err.message) + '</span>';
            actionArea.innerHTML = '<button class="btn btn-secondary" id="basic-import-close">Close</button>';
            actionArea.querySelector('#basic-import-close').addEventListener('click', () => {
                overlay.classList.remove('open');
                setTimeout(() => overlay.remove(), 250);
            });
            return null;
        }
    },

    /**
     * Get column definitions for Basic Import scanning checklist
     */
    _getBasicImportColumns(type) {
        if (type === 'assets') {
            return [
                { field: 'serial_number', label: 'Serial Number', required: true },
                { field: 'category', label: 'Category', required: true },
                { field: 'name', label: 'Name', required: false },
                { field: 'brand', label: 'Brand', required: false },
                { field: 'model', label: 'Model', required: false },
                { field: 'purchase_date', label: 'Purchase Date', required: false },
                { field: 'purchase_cost', label: 'Purchase Cost', required: false },
                { field: 'vendor', label: 'Vendor', required: false },
                { field: 'warranty_end_date', label: 'Warranty End Date', required: false },
                { field: 'department', label: 'Department', required: false },
                { field: 'specifications', label: 'Specifications', required: false },
                { field: 'notes', label: 'Notes', required: false }
            ];
        } else if (type === 'employees') {
            return [
                { field: 'employee_id', label: 'Employee ID', required: true },
                { field: 'full_name', label: 'Full Name', required: true },
                { field: 'email', label: 'Email', required: false },
                { field: 'department', label: 'Department', required: false },
                { field: 'location', label: 'Location', required: false },
                { field: 'position', label: 'Position', required: false },
                { field: 'status', label: 'Status', required: false }
            ];
        } else {
            // assignments
            return [
                { field: 'serial_number', label: 'Serial Number', required: true },
                { field: 'employee_id', label: 'Employee ID', required: true },
                { field: 'category', label: 'Category', required: true },
                { field: 'full_name', label: 'Full Name', required: true },
                { field: 'asset_name', label: 'Asset Name', required: false },
                { field: 'asset_tag', label: 'Asset Tag', required: false },
                { field: 'brand', label: 'Brand', required: false },
                { field: 'model', label: 'Model', required: false },
                { field: 'email', label: 'Email', required: false },
                { field: 'position', label: 'Position', required: false },
                { field: 'department', label: 'Department', required: false },
                { field: 'location', label: 'Location', required: false },
                { field: 'assigned_date', label: 'Assigned Date', required: false },
                { field: 'notes', label: 'Notes', required: false }
            ];
        }
    },

    /**
     * Create the scanning overlay DOM
     */
    _createScanOverlay(type, columnDefs) {
        const titleLabel = type === 'assignments' ? 'Assignments' : type === 'assets' ? 'IT Equipment' : 'Employees';

        const itemsHtml = columnDefs.map((col, i) => `
            <div class="basic-import-scan-item" data-index="${i}">
                <div class="basic-import-scan-icon">
                    <div class="basic-import-scan-pending">
                        <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/></svg>
                    </div>
                </div>
                <div class="basic-import-scan-content">
                    <div class="basic-import-scan-label">
                        ${col.label}
                        ${col.required ? '<span class="text-red-400 text-xs ml-1">REQUIRED</span>' : '<span class="text-slate-500 text-xs ml-1">optional</span>'}
                    </div>
                    <div class="basic-import-scan-detail text-xs text-slate-500">Waiting...</div>
                </div>
            </div>
        `).join('');

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="import-choice-overlay" id="basic-import-overlay">
                <div class="basic-import-scan-modal">
                    <div class="import-choice-header">
                        <h3 class="text-lg font-semibold text-white">Basic Import — ${titleLabel}</h3>
                    </div>
                    <div class="basic-import-scan-body">
                        <div class="basic-import-scan-list">
                            ${itemsHtml}
                        </div>
                        <div class="basic-import-scan-status" id="basic-import-status">
                            Preparing...
                        </div>
                    </div>
                    <div class="basic-import-scan-footer" id="basic-import-actions"></div>
                </div>
            </div>`;
        return wrapper.firstElementChild;
    },

    /**
     * Execute the actual import for Basic Import mode
     */
    async _executeBasicImport(importableRows, type, supabase, currentUser, onProgress) {
        const result = { success: true, imported: 0, updated: 0, skipped: 0, errors: [], skippedDetails: [] };
        const total = importableRows.length;

        if (type === 'assets') {
            const Assets = window.Assets;
            for (let i = 0; i < importableRows.length; i++) {
                const r = importableRows[i];
                onProgress({ current: i + 1, total });
                try {
                    if (r.status === 'duplicate' && r.existingRecord?.id) {
                        // Overwrite existing
                        const updateData = { ...r.dbRecord };
                        delete updateData._existingId;
                        const { error } = await supabase.from('assets').update(updateData).eq('id', r.existingRecord.id);
                        if (error) throw new Error(error.message);
                        result.updated++;
                    } else if (r.status === 'new') {
                        const regionId = currentUser.region_id || null;
                        const createResult = await Assets.create({
                            ...r.dbRecord,
                            region_id: regionId,
                            created_by: currentUser.id || null,
                            logged_by: currentUser.id || null
                        });
                        if (!createResult.success) throw new Error(createResult.error);
                        result.imported++;
                    } else {
                        result.skipped++;
                        result.skippedDetails.push({ row: r.row, reason: 'Status: ' + r.status });
                    }
                } catch (err) {
                    result.errors.push({ row: r.row, serial: r.mapped?.serial_number || 'N/A', error: err.message });
                }
            }
        } else if (type === 'employees') {
            const Employees = window.Employees;
            for (let i = 0; i < importableRows.length; i++) {
                const r = importableRows[i];
                onProgress({ current: i + 1, total });
                try {
                    if (r.status === 'duplicate' && r.existingRecord?.id) {
                        const updateData = { ...r.dbRecord };
                        const { error } = await supabase.from('employees').update(updateData).eq('id', r.existingRecord.id);
                        if (error) throw new Error(error.message);
                        result.updated++;
                    } else if (r.status === 'new') {
                        const regionId = currentUser.region_id || null;
                        const createResult = await Employees.create({
                            ...r.dbRecord,
                            region_id: regionId,
                            created_by: currentUser.id || null
                        });
                        if (!createResult.success) throw new Error(createResult.error);
                        result.imported++;
                    } else {
                        result.skipped++;
                        result.skippedDetails.push({ row: r.row, reason: 'Status: ' + r.status });
                    }
                } catch (err) {
                    result.errors.push({ row: r.row, employee_id: r.mapped?.employee_id || 'N/A', error: err.message });
                }
            }
        } else {
            // Assignments
            const Assets = window.Assets;
            const Employees = window.Employees;
            const Assignments = window.Assignments;
            const createdAssetCache = {};
            const createdEmployeeCache = {};

            for (let i = 0; i < importableRows.length; i++) {
                const r = importableRows[i];
                onProgress({ current: i + 1, total });
                try {
                    let assetId = r.existingAsset?.id || null;
                    let employeeId = r.existingEmployee?.id || null;

                    // Auto-create asset if needed
                    if (!assetId && r.assetDbRecord) {
                        const serialKey = (r.assetDbRecord.serial_number || '').toLowerCase();
                        if (createdAssetCache[serialKey]) {
                            assetId = createdAssetCache[serialKey];
                        } else {
                            const createResult = await Assets.create({
                                ...r.assetDbRecord,
                                region_id: currentUser.region_id || null,
                                created_by: currentUser.id || null,
                                logged_by: currentUser.id || null
                            });
                            if (!createResult.success) throw new Error('Failed to create asset: ' + createResult.error);
                            assetId = createResult.data.id;
                            createdAssetCache[serialKey] = assetId;
                        }
                    }

                    // Auto-create employee if needed
                    if (!employeeId && r.employeeDbRecord) {
                        const empKey = (r.employeeDbRecord.employee_id || '').toLowerCase();
                        if (createdEmployeeCache[empKey]) {
                            employeeId = createdEmployeeCache[empKey];
                        } else {
                            const createResult = await Employees.create({
                                ...r.employeeDbRecord,
                                region_id: currentUser.region_id || null,
                                created_by: currentUser.id || null
                            });
                            if (!createResult.success) throw new Error('Failed to create employee: ' + createResult.error);
                            employeeId = createResult.data.id;
                            createdEmployeeCache[empKey] = employeeId;
                        }
                    }

                    // Handle reassignment
                    if (r.status === 'reassign' && r.currentAssignment?.id) {
                        await Assignments.unassign(r.currentAssignment.id, 'Reassigned via basic import');
                        result.updated++;
                    }

                    // Handle already assigned (update)
                    if (r.status === 'already_assigned' && r.currentAssignment?.id) {
                        if (r.mapped?.notes && r.existingAsset?.id) {
                            await supabase.from('assets').update({ notes: r.mapped.notes }).eq('id', r.existingAsset.id);
                        }
                        if (r.assignmentData?.assigned_date) {
                            await supabase.from('asset_assignments').update({ assigned_date: r.assignmentData.assigned_date }).eq('id', r.currentAssignment.id);
                        }
                        result.updated++;
                        continue;
                    }

                    // For new assignments, ensure asset is available
                    if (r.status !== 'reassign') {
                        const { data: assetCheck } = await supabase.from('assets').select('status').eq('id', assetId).single();
                        if (assetCheck && assetCheck.status !== 'available') {
                            await supabase.from('assets').update({ status: 'available' }).eq('id', assetId);
                        }
                    }

                    // Create assignment
                    const assignResult = await Assignments.assign({
                        assetId,
                        employeeId,
                        notes: 'Imported via basic import',
                        assignedBy: currentUser.id,
                        assignedDate: r.assignmentData?.assigned_date || null
                    });
                    if (!assignResult.success) throw new Error(assignResult.error);
                    result.imported++;

                } catch (err) {
                    result.errors.push({
                        row: r.row,
                        serial: r.mapped?.serial_number || 'N/A',
                        employee: r.mapped?.employee_id || 'N/A',
                        error: err.message
                    });
                }
            }
        }

        return result;
    },

    /**
     * Build the summary HTML for Basic Import results
     */
    _buildBasicImportSummary(result, errorRows, type) {
        let html = '<div class="basic-import-summary">';

        // Success stats
        if (result.imported > 0) {
            html += '<div class="basic-import-summary-stat"><span class="text-green-400 font-bold text-xl">' + result.imported + '</span><span class="text-slate-400 text-sm">New records imported</span></div>';
        }
        if (result.updated > 0) {
            html += '<div class="basic-import-summary-stat"><span class="text-blue-400 font-bold text-xl">' + result.updated + '</span><span class="text-slate-400 text-sm">Existing records updated</span></div>';
        }
        if (result.skipped > 0) {
            html += '<div class="basic-import-summary-stat"><span class="text-yellow-400 font-bold text-xl">' + result.skipped + '</span><span class="text-slate-400 text-sm">Rows skipped</span></div>';
        }
        if (result.errors.length > 0) {
            html += '<div class="basic-import-summary-stat"><span class="text-red-400 font-bold text-xl">' + result.errors.length + '</span><span class="text-slate-400 text-sm">Failed</span></div>';
        }

        // If nothing happened
        if (result.imported === 0 && result.updated === 0 && result.errors.length === 0) {
            html += '<div class="text-center py-2"><span class="text-slate-400">No records were imported.</span></div>';
        }

        html += '</div>';

        // Errors detail
        if (result.errors.length > 0) {
            html += '<div class="mt-3 p-3 bg-red-900/20 rounded-lg border border-red-700/30">';
            html += '<p class="text-sm font-semibold text-red-400 mb-2">Errors:</p>';
            html += '<ul class="space-y-1">';
            const showErrors = result.errors.slice(0, 8);
            showErrors.forEach(e => {
                html += '<li class="text-xs text-red-300">Row ' + e.row + ': ' + this._escHtml(e.error) + '</li>';
            });
            if (result.errors.length > 8) {
                html += '<li class="text-xs text-slate-500">...and ' + (result.errors.length - 8) + ' more errors</li>';
            }
            html += '</ul></div>';
        }

        // Rows that were in the file but had errors (not attempted)
        if (errorRows && errorRows.length > 0) {
            html += '<div class="mt-3 p-3 bg-yellow-900/20 rounded-lg border border-yellow-700/30">';
            html += '<p class="text-sm font-semibold text-yellow-400 mb-2">Not imported (' + errorRows.length + ' rows with issues):</p>';
            html += '<ul class="space-y-1">';
            const showSkipped = errorRows.slice(0, 8);
            showSkipped.forEach(r => {
                const reason = r.errors.join(', ') || r.status;
                html += '<li class="text-xs text-yellow-300">Row ' + r.row + ': ' + this._escHtml(reason) + '</li>';
            });
            if (errorRows.length > 8) {
                html += '<li class="text-xs text-slate-500">...and ' + (errorRows.length - 8) + ' more</li>';
            }
            html += '</ul></div>';
        }

        return html;
    },

    // ===========================================
    // EXISTING IMPORT RESULTS
    // ===========================================

    /**
     * Show import results modal
     */
    showImportResult(result, type) {
        let content = '';
        if (result.success) {
            content = '<div class="text-center mb-4"><div class="text-green-400 text-3xl font-bold">' + result.imported + '</div><div class="text-slate-400">records imported successfully</div></div>';
            if (result.failed > 0) {
                content += '<div class="text-center mb-4"><div class="text-red-400 text-xl font-bold">' + result.failed + '</div><div class="text-slate-400">records failed</div></div>';
            }
            if (result.errors && result.errors.length > 0) {
                const list = result.errors.slice(0, 5).map(e => '<li class="text-sm text-red-300">Row ' + (e.row || 'N/A') + ': ' + e.error + '</li>').join('');
                content += '<div class="mt-4 p-3 bg-red-900/20 rounded-lg"><p class="text-sm font-medium text-red-400 mb-2">Errors:</p><ul class="list-disc list-inside">' + list + '</ul>';
                if (result.errors.length > 5) content += '<p class="text-xs text-slate-400 mt-2">...and ' + (result.errors.length - 5) + ' more</p>';
                content += '</div>';
            }
        } else {
            content = '<div class="text-center text-red-400"><p class="font-medium">Import failed</p><p class="text-sm mt-2">' + (result.error || '') + '</p></div>';
        }

        Components.showModal({
            title: Utils.capitalize(type) + ' Import Complete',
            content,
            type: result.success ? 'success' : 'error',
            confirmText: 'OK',
            showCancel: false
        });
    }
};

// Export for use in other modules
window.Import = Import;
