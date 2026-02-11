/**
 * SheetJS (XLSX) vendor shim
 * Imports XLSX from npm and makes it available globally
 * (replaces CDN: https://cdn.sheetjs.com/xlsx)
 */
import * as XLSX from 'xlsx';
window.XLSX = XLSX;
