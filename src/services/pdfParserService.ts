import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category: string;
  tags: string[];
  comments: string;
  account?: string;
}

export class PdfParserService {
  async parsePdfWithOCR(
    file: File, 
    onProgress: (progress: string) => void
  ): Promise<ParsedTransaction[]> {
    onProgress('Extracting and aligning text by coordinates...');
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let reconstructedLines: string[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress(`Reconstructing layout on page ${i} of ${pdf.numPages}...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // We will group text items by their vertical Y-coordinate to reconstruct actual rows.
      // PDF coordinates have Y starting from the bottom, so we sort descending.
      const rows = new Map<number, { text: string; x: number }[]>();
      
      for (const item of textContent.items as any[]) {
        const str = item.str.trim();
        if (!str) continue;
        
        // transform[4] is X, transform[5] is Y
        const x = Math.round(item.transform[4]);
        // Round Y to the nearest 5 pixels to group items that belong on the same line
        const y = Math.round(item.transform[5] / 5) * 5; 
        
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y)!.push({ text: str, x });
      }

      // Sort rows from top of page (highest Y) to bottom of page (lowest Y)
      const sortedY = Array.from(rows.keys()).sort((a, b) => b - a);
      
      for (const y of sortedY) {
        // Sort items in this row from left (lowest X) to right (highest X)
        const rowItems = rows.get(y)!.sort((a, b) => a.x - b.x);
        const rowString = rowItems.map(item => item.text).join(' ');
        reconstructedLines.push(rowString);
      }
    }

    console.log("=== RECONSTRUCTED PDF TEXT ===");
    console.log(reconstructedLines.slice(0, 100).join('\n'));
    
    return this.extractTransactions(reconstructedLines, onProgress);
  }

  private extractTransactions(lines: string[], onProgress: (msg: string) => void): ParsedTransaction[] {
    onProgress('Structuring transaction data...');
    const transactions: ParsedTransaction[] = [];
    
    let currentAccount = 'Checking';

    for (const line of lines) {
      const accMatch = line.match(/(Checking|OnePay Advance Overdraft|Savings|AK [A-Za-z\s]+)\s+x\d{4}/i);
      if (accMatch) {
         currentAccount = accMatch[1].trim();
      }

      // Date (Month Day), Description, ..., Amount ($XX.XX)
      // Now that the text is properly sorted left-to-right, this regex will work!
      const txRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(.*?)([+-]?\$?\d+\.\d{2})$/;
      const match = line.match(txRegex);
      
      if (match) {
        const month = match[1];
        const day = match[2];
        const description = match[3].replace(/(Card|Internal Transfer|ACH)$/i, '').trim(); // Clean up trailing type
        const amountStr = match[4].replace(/[$\s]/g, '');
        const amount = parseFloat(amountStr);
        
        transactions.push({
          id: this.generateId(`${month} ${day}`, description, amountStr),
          date: `${month} ${day}`,
          description,
          amount,
          type: amount < 0 ? 'debit' : 'credit',
          category: 'Uncategorized',
          tags: [],
          comments: '',
          account: currentAccount
        });
      }
    }

    const unique = Array.from(new Map(transactions.map(item => [item.id, item])).values());
    onProgress('Done!');
    return unique;
  }

  private generateId(date: string, desc: string, amount: string): string {
    return btoa(`${date}-${desc}-${amount}`).replace(/=/g, '');
  }
}

export const pdfParserService = new PdfParserService();
