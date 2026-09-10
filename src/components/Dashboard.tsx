import React, { useRef, useState, useMemo } from 'react';
import { Upload, Search, Tag } from 'lucide-react';
import { pdfParserService } from '../services/pdfParserService';
import { useAppContext } from '../context/AppContext';
import type { ParsedTransaction } from '../services/pdfParserService';

export const Dashboard: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, updateTransactions } = useAppContext();
  const [isParsing, setIsParsing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const transactions = data?.transactions || [];

  const [hideTransfers, setHideTransfers] = useState(true);

  const spendingByAccount = useMemo(() => {
    const spending: Record<string, number> = {};
    let total = 0;
    
    transactions.forEach(tx => {
      if (tx.amount < 0 && !tx.description.toLowerCase().includes('internal transfer')) {
        const acc = tx.account || 'Uncategorized';
        // Clean up account names like "AK Groceries" to "Groceries" for cleaner UI
        const cleanAcc = acc.replace(/^AK\s+/i, '');
        const amount = Math.abs(tx.amount);
        spending[cleanAcc] = (spending[cleanAcc] || 0) + amount;
        total += amount;
      }
    });

    const topCategories = Object.entries(spending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4); // Get top 4 spending categories

    return { topCategories, total };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let result = transactions;
    
    if (hideTransfers) {
      result = result.filter(t => !t.description.toLowerCase().includes('internal transfer'));
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.description.toLowerCase().includes(lower) || 
        t.account?.toLowerCase().includes(lower) ||
        t.tags.some((tag: string) => tag.toLowerCase().includes(lower))
      );
    }

    // Sort newest to oldest
    return result.sort((a, b) => {
      const dateA = new Date(`${a.date} 2026`).getTime();
      const dateB = new Date(`${b.date} 2026`).getTime();
      return dateB - dateA;
    });
  }, [transactions, searchTerm, hideTransfers]);

  const processFile = async (file: File) => {
    setIsParsing(true);
    setProgressMsg('Starting import...');
    try {
      const newTransactions = await pdfParserService.parsePdfWithOCR(file, (msg) => {
        setProgressMsg(msg);
      });
      
      const existingIds = new Set(transactions.map(t => t.id));
      const addedTransactions = newTransactions.filter(t => !existingIds.has(t.id));
      
      if (addedTransactions.length > 0) {
        await updateTransactions([...transactions, ...addedTransactions]);
      } else {
        alert('No new transactions found. Check the console for the raw output.');
      }
    } catch (error) {
      console.error('Error parsing PDF:', error);
      alert('Failed to parse the PDF. Check the console for details.');
    } finally {
      setIsParsing(false);
      setProgressMsg('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const updateTx = (id: string, updates: Partial<ParsedTransaction>) => {
    const newTxs = transactions.map(t => t.id === id ? { ...t, ...updates } : t);
    updateTransactions(newTxs);
  };

  const [taggingTxId, setTaggingTxId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = (txId: string, currentTags: string[]) => {
    if (tagInput.trim()) {
      const newTag = tagInput.trim().toLowerCase();
      if (!currentTags.includes(newTag)) {
        updateTx(txId, { tags: [...currentTags, newTag] });
      }
    }
    setTaggingTxId(null);
    setTagInput('');
  };

  const removeTag = (txId: string, currentTags: string[], tagToRemove: string) => {
    updateTx(txId, { tags: currentTags.filter(t => t !== tagToRemove) });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Mini Dashboard Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Monthly Spending</h2>
            <div className="text-3xl font-light text-gray-800 mt-1">${spendingByAccount.total.toFixed(2)}</div>
          </div>
          <div className="text-sm text-gray-400">
            Top Categories
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {spendingByAccount.topCategories.map(([account, amount]) => {
            const percentage = spendingByAccount.total > 0 ? (amount / spendingByAccount.total) * 100 : 0;
            return (
              <div key={account} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="text-sm font-medium text-gray-700 truncate" title={account}>{account}</div>
                <div className="text-lg font-semibold text-red-500 mt-1">${amount.toFixed(2)}</div>
                <div className="w-full bg-gray-200 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="bg-red-400 h-full rounded-full" 
                    style={{ width: `${Math.min(percentage, 100)}%` }} 
                  />
                </div>
              </div>
            );
          })}
          {spendingByAccount.topCategories.length === 0 && (
            <div className="col-span-full text-center text-sm text-gray-400 py-4">
              No spending data available yet. Import your transactions!
            </div>
          )}
        </div>
      </div>

      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault(); setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file?.type === 'application/pdf') processFile(file);
        }}
        className={`flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-lg shadow-sm border-2 transition-colors ${
          isDragging ? 'border-teal-400 bg-teal-50' : 'border-transparent'
        }`}
      >
        <div className="flex-1 w-full max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search activities, tags, accounts..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
            />
          </div>
          <div className="mt-2 ml-2 flex items-center gap-2">
            <input 
              type="checkbox" 
              id="hideTransfers" 
              checked={hideTransfers}
              onChange={(e) => setHideTransfers(e.target.checked)}
              className="rounded text-teal-500 focus:ring-teal-500"
            />
            <label htmlFor="hideTransfers" className="text-xs text-gray-500 cursor-pointer">
              Hide internal transfers
            </label>
          </div>
        </div>
        
        <div>
          <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:border-teal-500 hover:text-teal-600 text-gray-600 px-5 py-2 rounded-full font-medium transition disabled:opacity-50 min-w-[200px] justify-center"
          >
            {isParsing ? <span className="animate-pulse">{progressMsg || 'Parsing...'}</span> : <> <Upload size={18} /> Import PDF </>}
          </button>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider p-4">
          <div className="w-24">Date</div>
          <div className="flex-1">Activity</div>
          <div className="w-48 text-right">Amount</div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {filteredTransactions.map((tx) => (
            <div key={tx.id} className="p-4 hover:bg-gray-50 transition-colors group flex items-start">
              <div className="w-24 pt-1">
                <span className="font-medium text-gray-700">{tx.date}</span>
              </div>
              
              <div className="flex-1 pr-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{tx.description}</span>
                  {tx.account && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                      {tx.account}
                    </span>
                  )}
                  {tx.tags.map((tag: string) => (
                    <span key={tag} className="text-xs bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-md flex items-center gap-1 group/tag">
                      #{tag}
                      <button onClick={() => removeTag(tx.id, tx.tags, tag)} className="opacity-0 group-hover/tag:opacity-100 hover:text-red-500 transition-opacity">×</button>
                    </span>
                  ))}
                </div>
                
                <div className={`mt-2 flex items-center gap-3 transition-opacity ${taggingTxId === tx.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {taggingTxId === tx.id ? (
                    <div className="flex items-center gap-2">
                      <input 
                        autoFocus
                        type="text" 
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddTag(tx.id, tx.tags); if (e.key === 'Escape') setTaggingTxId(null); }}
                        onBlur={() => handleAddTag(tx.id, tx.tags)}
                        placeholder="Type tag (e.g. personal)"
                        className="text-xs px-2 py-1 border border-teal-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 w-32"
                      />
                    </div>
                  ) : (
                    <button 
                      onClick={() => setTaggingTxId(tx.id)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-500 transition-colors"
                    >
                      <Tag size={14} /> Add Tag
                    </button>
                  )}
                </div>
              </div>
              
              <div className="w-48 text-right pt-1">
                <span className={`font-medium ${tx.amount < 0 ? 'text-gray-900' : 'text-teal-600'}`}>
                  {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            </div>
          ))}

          {filteredTransactions.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              {searchTerm ? 'No activities match your search.' : 'No activities yet. Import a PDF to get started!'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
