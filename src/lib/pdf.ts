// src/lib/pdf.ts
// -----------------------------------------------------------------------------
// WHAT: Turns the on-screen report (a DOM element) into a downloadable, paginated
//       A4 PDF.
// WHY:  We render the report as styled HTML, then "photograph" that HTML with
//       html2canvas-pro and place the image into a jsPDF document. This approach
//       was chosen DELIBERATELY:
//         - Hindi (Devanagari) shaping is HARD in pure PDF libraries (they don't
//           lay out conjuncts/matras correctly). The browser, however, renders
//           Devanagari perfectly. By screenshotting the browser's render, the
//           Hindi PDF looks exactly right — no font-shaping engine needed.
//         - It guarantees the PDF looks IDENTICAL to what the user sees on screen
//           (one template, one source of truth = easy to maintain).
//       Trade-off: the PDF text is an image (not selectable). For a patient-
//       friendly, print-ready handout that is an acceptable, intentional choice.
// -----------------------------------------------------------------------------

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

/** A4 page size in CSS pixels at 96 DPI (jsPDF 'pt' unit uses 72; we use mm). */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/**
 * Generate and trigger download of the report PDF.
 * @param element  The DOM node containing the fully-rendered report.
 * @param fileName Desired download filename (without extension).
 *
 * Algorithm:
 *  1. Rasterize the element to a high-resolution canvas (scale 2 = crisp text).
 *  2. Compute how tall that image is when fit to A4 width.
 *  3. Slice the tall image across multiple A4 pages so nothing is cut off.
 */
export async function downloadReportPdf(element: HTMLElement, fileName: string): Promise<void> {
  // scale: 2 renders at 2x for sharp text on print/retina. backgroundColor white
  // ensures no transparent areas (some browsers export those as black).
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true, // allow the Google-hosted fonts/images to be captured
    logging: false,
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  // The image is fit to the full A4 width; its height scales proportionally.
  const imgWidthMm = A4_WIDTH_MM;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

  const imgData = canvas.toDataURL('image/jpeg', 0.92); // JPEG keeps file small

  let heightLeftMm = imgHeightMm;
  let positionMm = 0; // y-offset; goes negative as we move to later pages

  // First page.
  pdf.addImage(imgData, 'JPEG', 0, positionMm, imgWidthMm, imgHeightMm);
  heightLeftMm -= A4_HEIGHT_MM;

  // Additional pages: shift the same tall image up by one page each time.
  while (heightLeftMm > 0) {
    positionMm -= A4_HEIGHT_MM;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, positionMm, imgWidthMm, imgHeightMm);
    heightLeftMm -= A4_HEIGHT_MM;
  }

  pdf.save(`${fileName}.pdf`);
}
