import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import { NotificationService } from './notification.service';

interface ColumnConfig {
  header: string;
  dataKey: string;
  width?: number;
}

interface ExportOptions {
  title?: string;
  orientation?: 'portrait' | 'landscape';
  filename?: string;
  fontSize?: number;
  autoColumnWidth?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ExportService {
  private notification = inject(NotificationService);

  exportToExcel(data: any[], fileName: string, sheetName: string = 'Datos'): void {
    if (!data.length) {
      this.notification.warning('No hay datos para exportar', 'Exportar');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = { Sheets: { [sheetName]: worksheet }, SheetNames: [sheetName] };
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(blob, `${fileName}.xlsx`);
  }

  exportToPDF(data: any[], columns: ColumnConfig[], options: ExportOptions = {}): void {
    if (!data.length) {
      this.notification.warning('No hay datos para exportar', 'Exportar');
      return;
    }

    const numColumns = columns.length;
    let defaultFontSize = 8;
    if (numColumns >= 10) {
      defaultFontSize = 6;
    } else if (numColumns >= 8) {
      defaultFontSize = 7;
    }

    const config = {
      title: options.title || 'Reporte',
      orientation: options.orientation || 'landscape',
      filename: options.filename || 'reporte',
      fontSize: options.fontSize || defaultFontSize,
      autoColumnWidth: options.autoColumnWidth ?? false
    };

    const doc = new jsPDF(config.orientation, 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(config.title, 10, 10);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, 10, 15);

    const bodyData = data.map(item =>
      columns.map(col => item[col.dataKey] ?? '')
    );

    const headers = columns.map(col => col.header);

    const marginLeft = 5;
    const marginRight = 5;
    const availableWidth = pageWidth - marginLeft - marginRight;

    const tableConfig: any = {
      startY: 19,
      head: [headers],
      body: bodyData,
      theme: 'grid',
      styles: {
        fontSize: config.fontSize,
        cellPadding: 1,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: config.fontSize,
        halign: 'center'
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: marginLeft, right: marginRight },
      tableWidth: availableWidth
    };

    if (!config.autoColumnWidth && columns.length > 0) {
      const columnWidths = this.calcProportionalWidths(columns, data, availableWidth);
      tableConfig.columnStyles = columns.reduce((acc: any, _, idx) => {
        acc[idx] = { cellWidth: columnWidths[idx] };
        return acc;
      }, {} as any);
    }

    autoTable(doc, tableConfig);

    doc.save(`${config.filename}.pdf`);
  }

  private calcProportionalWidths(columns: ColumnConfig[], data: any[], availableWidth: number): number[] {
    const weights = columns.map(col => {
      if (col.width) return col.width;

      let maxLen = col.header.length;
      data.slice(0, 20).forEach(item => {
        const val = item[col.dataKey];
        if (val) {
          const len = String(val).length;
          if (len > maxLen) maxLen = Math.min(len, 30);
        }
      });

      if (maxLen <= 5) return 8;
      if (maxLen <= 10) return 15;
      if (maxLen <= 15) return 22;
      return Math.min(maxLen * 1.5, 40);
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    return weights.map(w => (w / totalWeight) * availableWidth);
  }

}