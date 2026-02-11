/**
 * jsPDF vendor shim
 * Imports jsPDF and autotable plugin from npm and makes them available globally
 * (replaces CDN: cdnjs.cloudflare.com/ajax/libs/jspdf + jspdf-autotable)
 */
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
window.jspdf = { jsPDF };
