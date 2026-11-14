import { getDocument, GlobalWorkerOptions, OPS } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;

/** PDF.js adapter: text and metadata only; image content remains uninspected. */
export class PDFParse {
  private task: ReturnType<typeof getDocument>;
  constructor({data}: {data: Uint8Array}) {
    this.task = getDocument({data, isEvalSupported: false, useSystemFonts: true});
  }
  async getText() {
    const doc = await this.task.promise;
    if (doc.numPages > 100) throw new Error('PDF exceeds the 100-page inspection limit');
    const pages = [];
    for (let num = 1; num <= doc.numPages; num++) {
      const page = await doc.getPage(num);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str !== undefined ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('');
      pages.push({num, text});
    }
    return {pages, total: doc.numPages};
  }
  async getImage() {
    const doc = await this.task.promise;
    const pages = [];
    for (let num = 1; num <= doc.numPages; num++) {
      const page = await doc.getPage(num);
      const ops = await page.getOperatorList();
      const imageOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObjectRepeat]);
      const images = ops.fnArray.filter(op => imageOps.has(op));
      pages.push({images});
    }
    return {pages};
  }
  async getInfo() { return (await this.task.promise).getMetadata(); }
  async destroy() { await this.task.destroy(); }
}
