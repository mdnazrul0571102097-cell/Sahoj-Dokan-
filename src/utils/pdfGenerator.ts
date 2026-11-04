/**
 * Client-Side PDF Generation Utility using html2pdf.js with fallback to native print
 * Generates clean, crisp A4 / receipt formatted PDFs with full Bengali unicode support.
 */

// @ts-ignore
import html2pdf from 'html2pdf.js';

export interface DayClosePdfOptions {
  filename?: string;
}

export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<boolean> {
  try {
    const opt: any = {
      margin: [10, 10, 10, 10],
      filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation,
      },
    };

    if (typeof html2pdf !== 'undefined') {
      await html2pdf().set(opt).from(element).save();
      return true;
    }
  } catch (err) {
    console.warn('html2pdf.js direct export failed, attempting dynamic import or print fallback:', err);
  }

  // Fallback: window.print()
  try {
    window.print();
    return true;
  } catch (printErr) {
    console.error('Print fallback failed:', printErr);
    return false;
  }
}
