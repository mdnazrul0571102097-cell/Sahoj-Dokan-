/**
 * Client-Side PDF Generation Utility using html2pdf.js with native Android / browser print fallback
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
  // If running inside Android WebView where blob downloads might be blocked, also attempt Android native print
  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  try {
    const opt: any = {
      margin: [10, 10, 10, 10],
      filename: cleanFilename,
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
      const worker = html2pdf().set(opt).from(element);
      await worker.save();
      return true;
    }
  } catch (err) {
    console.warn('html2pdf.js direct export failed, attempting dynamic print fallback:', err);
  }

  // Fallback 1: Native Android App print
  if (typeof window !== 'undefined' && (window as any).AndroidApp?.printReceipt) {
    try {
      (window as any).AndroidApp.printReceipt();
      return true;
    } catch (_) {}
  }

  // Fallback 2: window.print()
  try {
    window.print();
    return true;
  } catch (printErr) {
    console.error('Print fallback failed:', printErr);
    return false;
  }
}
