/**
 * ============================================
 * IMPORT MODULE
 * Madison 88 IT Equipment Inventory System
 * ============================================
 * 
 * Handles Excel and CSV file imports.
 */

const Import = {
    // ===========================================
    // STATE
    // ===========================================
    
    _importCancelled: false,
    
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
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
                    
                    // Get first sheet
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                        raw: false,
                        dateNF: 'yyyy-mm-dd'
                    });
                    
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error('Failed to parse file: ' + error.message));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsBinaryString(file);
        });
    },
    
    // ===========================================
    // ASSET IMPORT
    // ===========================================
    
    /**
     * Import assets from file
     * @param {File} file - Uploaded file
     * @returns {Promise<object>} Import result
     */
    async importAssets(file) {
        this._importCancelled = false;
        Components.showLoading('Importing assets...', true); // Show with cancel button
        
        try {
            // Parse file
            const rawData = await this.parseFile(file);
            
            if (this._importCancelled) {
                return { success: false, error: 'Import cancelled by user' };
            }
            
            if (!rawData || rawData.length === 0) {
                throw new Error('No data found in file');
            }
            
            // Validate and transform data
            const { validData, errors } = await this.validateAssetData(rawData);
            
            if (this._importCancelled) {
                return { success: false, error: 'Import cancelled by user' };
            }
            
            if (validData.length === 0) {
                return {
                    success: false,
                    error: 'No valid records found',
                    errors
                };
            }
            
            // Import valid records
            const result = await Assets.bulkImport(validData);
            
            return {
                success: true,
                imported: result.data.success,
                failed: result.data.failed + errors.length,
                errors: [...errors, ...result.data.errors]
            };
        } catch (error) {
            console.error('Import assets error:', error);
            return { success: false, error: error.message };
        } finally {
            Components.hideLoading();
        }
    },
    
    /**
     * Validate and transform asset data
     * @param {object[]} data - Raw data from file
     * @returns {Promise<object>} Validated data and errors
     */
    async validateAssetData(data) {
        const validData = [];
        const errors = [];
        
        // Get lookup data
        const categories = App.categories;
        const departments = App.departments;
        
        // Column mapping (flexible column names)
        const columnMap = {
            serial_number: ['serial_number', 'serial', 'serialnumber', 'sn', 'serial no', 'serial no.'],
            category: ['category', 'type', 'asset type', 'category_name'],
            brand: ['brand', 'manufacturer', 'make'],
            model: ['model', 'model name', 'model no', 'model no.'],
            purchase_date: ['purchase_date', 'purchase date', 'date purchased', 'purchasedate', 'date_purchased'],
            vendor: ['vendor', 'supplier', 'seller'],
            warranty_end_date: ['warranty_end_date', 'warranty end', 'warranty', 'warranty date', 'warranty_end'],
            department: ['department', 'dept', 'department_name'],
            notes: ['notes', 'remarks', 'comments', 'note']
        };
        
        // Process each row
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // +2 for header row and 0-index
            
            try {
                // Map columns
                const mapped = {};
                Object.entries(columnMap).forEach(([field, aliases]) => {
                    for (const alias of aliases) {
                        const key = Object.keys(row).find(k => k.toLowerCase().trim() === alias);
                        if (key && row[key]) {
                            mapped[field] = String(row[key]).trim();
                            break;
                        }
                    }
                });
                
                // Validate required fields
                if (!mapped.serial_number) {
                    errors.push({ row: rowNum, error: 'Missing serial number' });
                    continue;
                }
                
                if (!mapped.category) {
                    errors.push({ row: rowNum, error: 'Missing category', serial: mapped.serial_number });
                    continue;
                }
                
                // Find category ID
                const category = categories.find(c => 
                    c.name.toLowerCase() === mapped.category.toLowerCase()
                );
                
                if (!category) {
                    errors.push({ row: rowNum, error: `Unknown category: ${mapped.category}`, serial: mapped.serial_number });
                    continue;
                }
                
                // Find department ID (optional)
                let department_id = null;
                if (mapped.department) {
                    const department = departments.find(d => 
                        d.name.toLowerCase() === mapped.department.toLowerCase()
                    );
                    if (department) {
                        department_id = department.id;
                    }
                }
                
                // Parse dates
                let purchase_date = null;
                if (mapped.purchase_date) {
                    purchase_date = this.parseDate(mapped.purchase_date);
                }
                
                let warranty_end_date = null;
                if (mapped.warranty_end_date) {
                    warranty_end_date = this.parseDate(mapped.warranty_end_date);
                }
                
                // Build asset object
                validData.push({
                    serial_number: mapped.serial_number,
                    category_id: category.id,
                    brand: mapped.brand || null,
                    model: mapped.model || null,
                    purchase_date,
                    vendor: mapped.vendor || null,
                    warranty_end_date,
                    department_id,
                    notes: mapped.notes || null,
                    status: 'available'
                });
                
            } catch (error) {
                errors.push({ row: rowNum, error: error.message });
            }
        }
        
        return { validData, errors };
    },
    
    // ===========================================
    // EMPLOYEE IMPORT
    // ===========================================
    
    /**
     * Import employees from file
     * @param {File} file - Uploaded file
     * @returns {Promise<object>} Import result
     */
    async importEmployees(file) {
        this._importCancelled = false;
        Components.showLoading('Importing employees...', true); // Show with cancel button
        
        try {
            const rawData = await this.parseFile(file);
            
            if (this._importCancelled) {
                return { success: false, error: 'Import cancelled by user' };
            }
            
            if (!rawData || rawData.length === 0) {
                throw new Error('No data found in file');
            }
            
            const { validData, errors } = await this.validateEmployeeData(rawData);
            
            if (this._importCancelled) {
                return { success: false, error: 'Import cancelled by user' };
            }
            
            if (validData.length === 0) {
                return {
                    success: false,
                    error: 'No valid records found',
                    errors
                };
            }
            
            const result = await Employees.bulkImport(validData);
            
            return {
                success: true,
                imported: result.data.success,
                failed: result.data.failed + errors.length,
                errors: [...errors, ...result.data.errors]
            };
        } catch (error) {
            console.error('Import employees error:', error);
            return { success: false, error: error.message };
        } finally {
            Components.hideLoading();
        }
    },
    
    /**
     * Validate and transform employee data
     * @param {object[]} data - Raw data from file
     * @returns {Promise<object>} Validated data and errors
     */
    async validateEmployeeData(data) {
        const validData = [];
        const errors = [];
        
        const departments = App.departments;
        const locations = App.locations;
        
        const columnMap = {
            employee_id: ['employee_id', 'employeeid', 'emp_id', 'empid', 'id', 'employee id', 'emp id'],
            full_name: ['full_name', 'fullname', 'name', 'employee name', 'employee_name'],
            email: ['email', 'email address', 'e-mail'],
            department: ['department', 'dept', 'department_name'],
            location: ['location', 'table', 'seat', 'table no', 'table_no'],
            position: ['position', 'title', 'job title', 'role', 'job_title']
        };
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2;
            
            try {
                const mapped = {};
                Object.entries(columnMap).forEach(([field, aliases]) => {
                    for (const alias of aliases) {
                        const key = Object.keys(row).find(k => k.toLowerCase().trim() === alias);
                        if (key && row[key]) {
                            mapped[field] = String(row[key]).trim();
                            break;
                        }
                    }
                });
                
                // Validate required fields
                if (!mapped.employee_id) {
                    errors.push({ row: rowNum, error: 'Missing employee ID' });
                    continue;
                }
                
                if (!mapped.full_name) {
                    errors.push({ row: rowNum, error: 'Missing full name', employeeId: mapped.employee_id });
                    continue;
                }
                
                // Find department ID
                let department_id = null;
                if (mapped.department) {
                    const department = departments.find(d => 
                        d.name.toLowerCase() === mapped.department.toLowerCase()
                    );
                    if (department) {
                        department_id = department.id;
                    }
                }
                
                // Find location ID
                let location_id = null;
                if (mapped.location) {
                    const location = locations.find(l => 
                        l.name.toLowerCase() === mapped.location.toLowerCase() ||
                        l.name.toLowerCase().includes(mapped.location.toLowerCase())
                    );
                    if (location) {
                        location_id = location.id;
                    }
                }
                
                // Build employee object
                validData.push({
                    employee_id: mapped.employee_id,
                    full_name: mapped.full_name,
                    email: mapped.email || null,
                    department_id,
                    location_id,
                    position: mapped.position || null,
                    is_active: true
                });
                
            } catch (error) {
                errors.push({ row: rowNum, error: error.message });
            }
        }
        
        return { validData, errors };
    },
    
    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================
    
    /**
     * Parse date string to ISO format
     * @param {string} dateStr - Date string
     * @returns {string|null} ISO date string
     */
    parseDate(dateStr) {
        if (!dateStr) return null;
        
        // Try different date formats
        const formats = [
            // ISO
            /^(\d{4})-(\d{2})-(\d{2})$/,
            // MM/DD/YYYY
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            // DD/MM/YYYY
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
        ];
        
        // Try parsing as Date
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
        
        return null;
    },
    
    /**
     * Generate import template for assets
     * @returns {void}
     */
    downloadAssetTemplate() {
        const template = [
            {
                'Serial Number': 'SN-001',
                'Category': 'Laptop',
                'Brand': 'Dell',
                'Model': 'Latitude 5520',
                'Purchase Date': '2024-01-15',
                'Vendor': 'Tech Supplier Inc.',
                'Warranty End': '2027-01-15',
                'Department': 'IT',
                'Notes': 'Sample asset'
            }
        ];
        
        const worksheet = XLSX.utils.json_to_sheet(template);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
        
        XLSX.writeFile(workbook, 'Asset_Import_Template.xlsx');
        
        Components.showToast('Template downloaded', 'success');
    },
    
    /**
     * Generate import template for employees
     * @returns {void}
     */
    downloadEmployeeTemplate() {
        const template = [
            {
                'Employee ID': 'EMP-001',
                'Full Name': 'John Doe',
                'Email': 'john.doe@madison88.com',
                'Department': 'IT',
                'Location': 'Table 1',
                'Position': 'IT Specialist'
            }
        ];
        
        const worksheet = XLSX.utils.json_to_sheet(template);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
        
        XLSX.writeFile(workbook, 'Employee_Import_Template.xlsx');
        
        Components.showToast('Template downloaded', 'success');
    },
    
    // ===========================================
    // UI HELPERS
    // ===========================================
    
    /**
     * Cancel ongoing import
     */
    cancelImport() {
        this._importCancelled = true;
        Components.hideLoading();
        Components.showToast('Import cancelled', 'info');
    },
    
    /**
     * Show import info before file selection
     * @param {string} type - 'assets' or 'employees'
     * @returns {Promise<boolean>} True if user wants to proceed
     */
    async showImportInfo(type) {
        const isAssets = type === 'assets';
        
        const columns = isAssets ? [
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
        
        const rules = isAssets ? [
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
                <td class="py-2 px-3 border-b border-slate-700 text-sm text-slate-400">
                    ${col.aliases}
                </td>
            </tr>
        `).join('');
        
        const ruleItems = rules.map(rule => `
            <li class="text-sm text-slate-300 mb-1">${rule}</li>
        `).join('');
        
        const content = `
            <div class="space-y-4">
                <div class="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 mb-4">
                    <p class="text-sm text-blue-300">
                        <svg class="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                        </svg>
                        Accepted file formats: CSV, XLSX, XLS
                    </p>
                </div>
                
                <div>
                    <h4 class="text-sm font-semibold text-slate-300 mb-2" style="text-align: left;">Required Columns:</h4>
                    <div class="bg-slate-800/50 rounded-lg overflow-hidden">
                        <table class="w-full">
                            <thead class="bg-slate-700/50">
                                <tr>
                                    <th class="py-2 px-3 text-left text-xs font-semibold text-slate-400 uppercase">Column Name</th>
                                    <th class="py-2 px-3 text-left text-xs font-semibold text-slate-400 uppercase">Alternative Names</th>
                                </tr>
                            </thead>
                            <tbody style="text-align: left;">
                                ${columnRows}
                            </tbody>
                        </table>
                    </div>
                    <p class="text-xs text-red-400 mt-2" style="text-align: left;">* Required fields</p>
                </div>
                
                <div>
                    <h4 class="text-sm font-semibold text-slate-300 mb-2" style="text-align: left;">Import Rules:</h4>
                    <ul class="list-disc list-inside space-y-1 bg-slate-800/50 rounded-lg p-3" style="text-align: left;">
                        ${ruleItems}
                    </ul>
                </div>
            </div>
        `;
        
        return Components.showModal({
            title: `Import ${Utils.capitalize(type)} - Requirements`,
            content,
            confirmText: 'Continue to Select File',
            cancelText: 'Cancel',
            showCancel: true
        });
    },
    
    /**
     * Show import results modal
     * @param {object} result - Import result
     * @param {string} type - 'assets' or 'employees'
     */
    showImportResult(result, type) {
        let content = '';
        
        if (result.success) {
            content = `
                <div class="text-center mb-4">
                    <div class="text-green-400 text-3xl font-bold">${result.imported}</div>
                    <div class="text-slate-400">records imported successfully</div>
                </div>
            `;
            
            if (result.failed > 0) {
                content += `
                    <div class="text-center mb-4">
                        <div class="text-red-400 text-xl font-bold">${result.failed}</div>
                        <div class="text-slate-400">records failed</div>
                    </div>
                `;
            }
            
            if (result.errors && result.errors.length > 0) {
                const errorList = result.errors.slice(0, 5).map(e => 
                    `<li class="text-sm text-red-300">Row ${e.row || 'N/A'}: ${e.error}</li>`
                ).join('');
                
                content += `
                    <div class="mt-4 p-3 bg-red-900/20 rounded-lg">
                        <p class="text-sm font-medium text-red-400 mb-2">Errors:</p>
                        <ul class="list-disc list-inside">${errorList}</ul>
                        ${result.errors.length > 5 ? `<p class="text-xs text-slate-400 mt-2">...and ${result.errors.length - 5} more</p>` : ''}
                    </div>
                `;
            }
        } else {
            content = `
                <div class="text-center text-red-400">
                    <p class="font-medium">Import failed</p>
                    <p class="text-sm mt-2">${result.error}</p>
                </div>
            `;
        }
        
        Components.showModal({
            title: `${Utils.capitalize(type)} Import Complete`,
            content,
            type: result.success ? 'success' : 'error',
            confirmText: 'OK',
            showCancel: false
        });
    }
};

// Export for use in other modules
window.Import = Import;
