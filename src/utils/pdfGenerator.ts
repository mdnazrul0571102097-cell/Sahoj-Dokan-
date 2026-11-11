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
  // Ensure standard naming format starting with "Sahoj_Dokan_"
  let safeName = filename.trim();
  if (!safeName.startsWith('Sahoj_Dokan_')) {
    safeName = `Sahoj_Dokan_${safeName.replace(/^SahojDokan[-_]?/i, '')}`;
  }
  const cleanFilename = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;

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

      // Check if Android native bridge exists for saving directly to public Environment.DIRECTORY_DOWNLOADS
      if (typeof window !== 'undefined' && (window as any).AndroidApp?.savePdfToPublicDownloads) {
        try {
          const pdfOutputBase64 = await worker.outputPdf('datauristring');
          const saveResult = (window as any).AndroidApp.savePdfToPublicDownloads(pdfOutputBase64, cleanFilename);
          if (saveResult && !saveResult.startsWith('ERROR')) {
            return true;
          }
        } catch (bridgeErr) {
          console.warn('Android bridge savePdfToPublicDownloads failed, falling back to browser save:', bridgeErr);
        }
      }

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
