// src/lib/pdf.ts
// -----------------------------------------------------------------------------
// WHAT: Turns the on-screen report (a DOM element) into a downloadable, paginated
//       A4 PDF — WITHOUT cutting cards/sections in half at page boundaries.
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
//
// PAGE BREAKS: Earlier this file sliced the tall report image at FIXED A4 heights,
//       which cut straight through whatever happened to sit on the fold (a card
//       title on one page, its value on the next). Now we read the geometry of the
//       report's "blocks" (elements marked `data-pdf-block` in ReportView) and only
//       break the page in the GAPS between blocks — never through a block. Headings
//       marked `data-pdf-keep="next"` are pushed to the next page rather than left
//       orphaned at the bottom. A block taller than a full page is hard-split as a
//       last resort so nothing is ever lost.
// -----------------------------------------------------------------------------

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

/** A4 page size in millimetres (jsPDF is configured in 'mm'). */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/** A single page slice: a [topY, bottomY] range in CANVAS pixels. */
type Segment = { top: number; bottom: number };

/**
 * Read the vertical position of every `data-pdf-block` element, expressed in the
 * captured canvas's pixel space (relative to the report's top edge).
 */
function readBlocks(element: HTMLElement, canvasScale: number) {
  const elTop = element.getBoundingClientRect().top;
  return Array.from(element.querySelectorAll<HTMLElement>('[data-pdf-block]'))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        top: (r.top - elTop) * canvasScale,
        bottom: (r.bottom - elTop) * canvasScale,
        // Headings ask to "stay with" the block that follows them.
        keepNext: el.dataset.pdfKeep === 'next',
      };
    })
    .sort((a, b) => a.top - b.top);
}

/**
 * Decide where each page should END (in canvas px) so no block is split.
 * Returns the list of page segments covering the whole canvas top→bottom.
 */
function computeSegments(
  blocks: ReturnType<typeof readBlocks>,
  canvasHeight: number,
  pageHeightPx: number,
): Segment[] {
  const breaks: number[] = [];
  let pageStart = 0;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];

    // Does this block spill past the bottom of the current page?
    if (b.bottom - pageStart > pageHeightPx && b.top > pageStart) {
      let breakAt = b.top;
      // Don't orphan a heading: if the previous block(s) want to stay with this
      // one, move the break up to before them instead.
      let j = i - 1;
      while (j >= 0 && blocks[j].keepNext && blocks[j].top > pageStart) {
        breakAt = blocks[j].top;
        j--;
      }
      breaks.push(breakAt);
      pageStart = breakAt;
    }

    // A single block taller than a whole page: hard-split it across pages.
    while (b.bottom - pageStart > pageHeightPx) {
      pageStart += pageHeightPx;
      breaks.push(pageStart);
    }
  }

  // Turn break positions into [top, bottom] segments covering the full canvas.
  const segments: Segment[] = [];
  let prev = 0;
  for (const br of breaks) {
    if (br - prev > 1) segments.push({ top: prev, bottom: br });
    prev = br;
  }
  segments.push({ top: prev, bottom: canvasHeight });
  return segments;
}

/**
 * Generate and trigger download of the report PDF.
 * @param element  The DOM node containing the fully-rendered report.
 * @param fileName Desired download filename (without extension).
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

  // Canvas pixels per on-screen CSS pixel (html2canvas honours `scale`).
  const canvasScale = canvas.width / element.offsetWidth;
  // How many canvas px correspond to one full A4 page at our chosen width.
  const pageHeightPx = canvas.width * (A4_HEIGHT_MM / A4_WIDTH_MM);
  const pxToMm = A4_WIDTH_MM / canvas.width;

  const blocks = readBlocks(element, canvasScale);
  const segments = computeSegments(blocks, canvas.height, pageHeightPx);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  segments.forEach((seg, idx) => {
    const sliceHeight = Math.round(seg.bottom - seg.top);
    if (sliceHeight <= 0) return;

    // Copy just this page's slice onto its own canvas, placed at the top.
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, seg.top, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    const imgData = slice.toDataURL('image/jpeg', 0.92); // JPEG keeps file small
    if (idx > 0) pdf.addPage();
    // Place at the top of the page with the slice's natural height (last page may
    // be shorter than A4 — that's fine, no stretching).
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, sliceHeight * pxToMm);
  });

  pdf.save(`${fileName}.pdf`);
}
