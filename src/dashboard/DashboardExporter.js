// src/dashboard/DashboardExporter.js
// Comprehensive Export System for Dashboard Data

class DashboardExporter {
    constructor(dashboardInstance) {
        this.dashboard = dashboardInstance;
        this.supportedFormats = ['pdf', 'excel', 'csv', 'json', 'xml'];
        this.defaultOptions = {
            includeCharts: true,
            includeTables: true,
            includeMetadata: true,
            dateFormat: 'YYYY-MM-DD HH:mm:ss',
            fileNamePrefix: 'chajipoa-dashboard'
        };
    }
    
    // Export current dashboard view
    async exportView(format = 'pdf', options = {}) {
        const exportOptions = { ...this.defaultOptions, ...options };
        const viewData = await this.dashboard.getCurrentViewData();
        
        switch (format.toLowerCase()) {
            case 'pdf':
                return await this.exportToPDF(viewData, exportOptions);
            case 'excel':
                return await this.exportToExcel(viewData, exportOptions);
            case 'csv':
                return await this.exportToCSV(viewData, exportOptions);
            case 'json':
                return await this.exportToJSON(viewData, exportOptions);
            case 'xml':
                return await this.exportToXML(viewData, exportOptions);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    
    // Export to PDF with charts and tables
    async exportToPDF(data, options) {
        try {
            // Dynamically import PDF libraries
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;
            
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
            
            const {
                title = 'CHAJIPOA Dashboard Report',
                subtitle = `Generated on ${new Date().toLocaleDateString()}`,
                includeCharts = true,
                includeTables = true
            } = options;
            
            let yPos = 20;
            
            // Add header
            doc.setFontSize(22);
            doc.setTextColor(40, 40, 40);
            doc.text(title, 20, yPos);
            
            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            doc.text(subtitle, 20, yPos + 10);
            
            yPos += 25;
            
            // Add overview metrics table
            if (data.metrics && includeTables) {
                doc.setFontSize(16);
                doc.setTextColor(40, 40, 40);
                doc.text('Overview Metrics', 20, yPos);
                
                yPos += 10;
                
                const metricsTable = this.formatMetricsTable(data.metrics);
                autoTable(doc, {
                    head: [['Metric', 'Value', 'Previous Period', 'Change']],
                    body: metricsTable,
                    startY: yPos,
                    theme: 'grid',
                    styles: {
                        fontSize: 10,
                        cellPadding: 3
                    },
                    headStyles: {
                        fillColor: [66, 133, 244],
                        textColor: 255
                    }
                });
                
                yPos = doc.lastAutoTable.finalY + 15;
            }
            
            // Add charts as images
            if (includeCharts && data.charts) {
                for (const [index, chartConfig] of data.charts.entries()) {
                    if (yPos > 180) { // Start new page if near bottom
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    try {
                        const chartImage = await this.convertChartToImage(chartConfig);
                        if (chartImage) {
                            doc.addImage(chartImage, 'PNG', 20, yPos, 180, 80);
                            yPos += 90;
                            
                            // Add chart title
                            doc.setFontSize(14);
                            doc.setTextColor(40, 40, 40);
                            doc.text(chartConfig.title || `Chart ${index + 1}`, 20, yPos - 85);
                        }
                    } catch (error) {
                        console.warn('Failed to export chart:', error);
                    }
                }
            }
            
            // Add detailed tables
            if (data.tables && includeTables) {
                for (const table of data.tables) {
                    if (yPos > 150) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    doc.setFontSize(14);
                    doc.setTextColor(40, 40, 40);
                    doc.text(table.title || 'Data Table', 20, yPos);
                    
                    yPos += 10;
                    
                    autoTable(doc, {
                        head: [table.headers],
                        body: table.rows.slice(0, 50), // Limit rows for PDF
                        startY: yPos,
                        theme: 'striped',
                        styles: {
                            fontSize: 8,
                            cellPadding: 2
                        }
                    });
                    
                    yPos = doc.lastAutoTable.finalY + 15;
                }
            }
            
            // Add footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(
                    `Page ${i} of ${pageCount} | Generated by CHAJIPOA Dashboard`,
                    20,
                    doc.internal.pageSize.height - 10
                );
            }
            
            // Generate filename
            const filename = `${options.fileNamePrefix || 'dashboard'}-${this.getCurrentTimestamp()}.pdf`;
            
            // Return blob or trigger download
            if (options.returnBlob) {
                return doc.output('blob');
            } else {
                doc.save(filename);
                return { success: true, filename };
            }
            
        } catch (error) {
            console.error('PDF export failed:', error);
            throw new Error(`Failed to export to PDF: ${error.message}`);
        }
    }
    
    // Export to Excel workbook
    async exportToExcel(data, options) {
        try {
            const XLSX = await import('xlsx');
            
            const workbook = XLSX.utils.book_new();
            
            // Add overview sheet
            if (data.metrics) {
                const metricsSheet = XLSX.utils.aoa_to_sheet([
                    ['Metric', 'Current Value', 'Previous Value', 'Change %'],
                    ...this.formatMetricsForExcel(data.metrics)
                ]);
                XLSX.utils.book_append_sheet(workbook, metricsSheet, 'Overview');
            }
            
            // Add data sheets
            if (data.tables) {
                data.tables.forEach((table, index) => {
                    const worksheet = XLSX.utils.aoa_to_sheet([
                        table.headers,
                        ...table.rows.slice(0, 1000) // Excel row limit
                    ]);
                    XLSX.utils.book_append_sheet(workbook, worksheet, 
                        table.title?.substring(0, 31) || `Data_${index + 1}`);
                });
            }
            
            // Add raw data sheet
            if (data.rawData) {
                const rawDataSheet = XLSX.utils.json_to_sheet(data.rawData);
                XLSX.utils.book_append_sheet(workbook, rawDataSheet, 'Raw_Data');
            }
            
            // Generate filename
            const filename = `${options.fileNamePrefix || 'dashboard'}-${this.getCurrentTimestamp()}.xlsx`;
            
            if (options.returnBlob) {
                const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            } else {
                XLSX.writeFile(workbook, filename);
                return { success: true, filename };
            }
            
        } catch (error) {
            console.error('Excel export failed:', error);
            throw new Error(`Failed to export to Excel: ${error.message}`);
        }
    }
    
    // Export to CSV
    async exportToCSV(data, options) {
        try {
            let csvContent = '';
            
            // Add metadata header
            if (options.includeMetadata) {
                csvContent += `# CHAJIPOA Dashboard Export\n`;
                csvContent += `# Generated: ${new Date().toISOString()}\n`;
                csvContent += `# Format: ${options.dateFormat}\n\n`;
            }
            
            // Add metrics section
            if (data.metrics) {
                csvContent += 'METRICS\n';
                csvContent += 'Metric,Value,Previous Value,Change\n';
                const metricsRows = this.formatMetricsForCSV(data.metrics);
                csvContent += metricsRows.join('\n') + '\n\n';
            }
            
            // Add table data
            if (data.tables) {
                data.tables.forEach(table => {
                    csvContent += `${table.title || 'DATA'}\n`;
                    csvContent += table.headers.join(',') + '\n';
                    const tableRows = table.rows.map(row => 
                        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
                    );
                    csvContent += tableRows.join('\n') + '\n\n';
                });
            }
            
            // Generate filename
            const filename = `${options.fileNamePrefix || 'dashboard'}-${this.getCurrentTimestamp()}.csv`;
            
            if (options.returnBlob) {
                return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            } else {
                this.downloadBlob(new Blob([csvContent], { type: 'text/csv' }), filename);
                return { success: true, filename };
            }
            
        } catch (error) {
            console.error('CSV export failed:', error);
            throw new Error(`Failed to export to CSV: ${error.message}`);
        }
    }
    
    // Export to JSON
    async exportToJSON(data, options) {
        try {
            const exportData = {
                metadata: {
                    generatedAt: new Date().toISOString(),
                    dashboardVersion: '1.0',
                    exportFormat: 'json',
                    ...options.metadata
                },
                ...data
            };
            
            const jsonString = JSON.stringify(exportData, null, 2);
            const filename = `${options.fileNamePrefix || 'dashboard'}-${this.getCurrentTimestamp()}.json`;
            
            if (options.returnBlob) {
                return new Blob([jsonString], { type: 'application/json' });
            } else {
                this.downloadBlob(new Blob([jsonString], { type: 'application/json' }), filename);
                return { success: true, filename };
            }
            
        } catch (error) {
            console.error('JSON export failed:', error);
            throw new Error(`Failed to export to JSON: ${error.message}`);
        }
    }
    
    // Export to XML
    async exportToXML(data, options) {
        try {
            let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xmlContent += '<dashboardExport>\n';
            xmlContent += `  <metadata>\n`;
            xmlContent += `    <generatedAt>${new Date().toISOString()}</generatedAt>\n`;
            xmlContent += `    <format>xml</format>\n`;
            xmlContent += `  </metadata>\n`;
            
            // Add metrics
            if (data.metrics) {
                xmlContent += `  <metrics>\n`;
                Object.entries(data.metrics).forEach(([key, value]) => {
                    xmlContent += `    <metric>\n`;
                    xmlContent += `      <name>${this.escapeXml(key)}</name>\n`;
                    xmlContent += `      <value>${this.escapeXml(String(value))}</value>\n`;
                    xmlContent += `    </metric>\n`;
                });
                xmlContent += `  </metrics>\n`;
            }
            
            // Add tables
            if (data.tables) {
                xmlContent += `  <tables>\n`;
                data.tables.forEach((table, index) => {
                    xmlContent += `    <table id="${index}">\n`;
                    xmlContent += `      <title>${this.escapeXml(table.title || '')}</title>\n`;
                    xmlContent += `      <headers>\n`;
                    table.headers.forEach(header => {
                        xmlContent += `        <header>${this.escapeXml(header)}</header>\n`;
                    });
                    xmlContent += `      </headers>\n`;
                    xmlContent += `      <rows>\n`;
                    table.rows.forEach(row => {
                        xmlContent += `        <row>\n`;
                        row.forEach((cell, cellIndex) => {
                            const header = table.headers[cellIndex] || `column_${cellIndex}`;
                            xmlContent += `          <${header.toLowerCase().replace(/\s+/g, '_')}>${this.escapeXml(String(cell))}</${header.toLowerCase().replace(/\s+/g, '_')}>\n`;
                        });
                        xmlContent += `        </row>\n`;
                    });
                    xmlContent += `      </rows>\n`;
                    xmlContent += `    </table>\n`;
                });
                xmlContent += `  </tables>\n`;
            }
            
            xmlContent += '</dashboardExport>';
            
            const filename = `${options.fileNamePrefix || 'dashboard'}-${this.getCurrentTimestamp()}.xml`;
            
            if (options.returnBlob) {
                return new Blob([xmlContent], { type: 'application/xml' });
            } else {
                this.downloadBlob(new Blob([xmlContent], { type: 'application/xml' }), filename);
                return { success: true, filename };
            }
            
        } catch (error) {
            console.error('XML export failed:', error);
            throw new Error(`Failed to export to XML: ${error.message}`);
        }
    }
    
    // Helper methods
    formatMetricsTable(metrics) {
        return Object.entries(metrics).map(([key, value]) => [
            this.formatMetricName(key),
            this.formatMetricValue(value.current),
            this.formatMetricValue(value.previous),
            this.formatChange(value.change)
        ]);
    }
    
    formatMetricsForExcel(metrics) {
        return Object.entries(metrics).map(([key, value]) => [
            this.formatMetricName(key),
            value.current,
            value.previous || 0,
            value.change || 0
        ]);
    }
    
    formatMetricsForCSV(metrics) {
        return Object.entries(metrics).map(([key, value]) => 
            `"${this.formatMetricName(key)}","${value.current}","${value.previous || 0}","${value.change || 0}"`
        );
    }
    
    formatMetricName(name) {
        return name
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    formatMetricValue(value) {
        if (typeof value === 'number') {
            if (value > 1000000) return `${(value / 1000000).toFixed(2)}M`;
            if (value > 1000) return `${(value / 1000).toFixed(2)}K`;
            return value.toLocaleString();
        }
        return String(value);
    }
    
    formatChange(change) {
        if (change === undefined || change === null) return 'N/A';
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)}%`;
    }
    
    async convertChartToImage(chartConfig) {
        try {
            // This would integrate with your charting library (Chart.js, D3, etc.)
            // For now, returning placeholder
            return null;
        } catch (error) {
            console.warn('Chart conversion failed:', error);
            return null;
        }
    }
    
    escapeXml(unsafe) {
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }
    
    getCurrentTimestamp() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }
    
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Batch export multiple views
    async batchExport(exports) {
        const results = [];
        
        for (const exportConfig of exports) {
            try {
                const result = await this.exportView(
                    exportConfig.format,
                    exportConfig.options
                );
                results.push({ ...exportConfig, success: true, result });
            } catch (error) {
                results.push({ ...exportConfig, success: false, error: error.message });
            }
        }
        
        return results;
    }
    
    // Get export template for customization
    getExportTemplate(format) {
        const templates = {
            pdf: {
                pageSize: 'A4',
                orientation: 'landscape',
                margins: { top: 20, right: 20, bottom: 20, left: 20 },
                includeHeader: true,
                includeFooter: true,
                chartWidth: 180,
                chartHeight: 80
            },
            excel: {
                sheetNames: ['Overview', 'Data', 'Charts'],
                includeFormatting: true,
                freezeHeaders: true,
                autoFilter: true
            },
            csv: {
                delimiter: ',',
                includeHeaders: true,
                quoteStrings: true,
                escapeFormula: true
            }
        };
        
        return templates[format] || {};
    }
}

module.exports = DashboardExporter;