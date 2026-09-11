import React, { useRef, useState, useMemo } from 'react';
import { Upload, Search, Tag, MessageSquare } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { pdfParserService } from '../services/pdfParserService';
import { useAppContext } from '../context/AppContext';
import type { ParsedTransaction } from '../services/pdfParserService';

const CHART_COLORS = ['#14b8a6', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#10b981', '#64748b'];

export const Dashboard: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, updateTransactions } = useAppContext();
  const [isParsing, setIsParsing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const transactions = data?.transactions || [];

  const [hideTransfers, setHideTransfers] = useState(true);

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
        (t.note || '').toLowerCase().includes(lower) ||
        (t.tags || []).some((tag: string) => tag.toLowerCase().includes(lower))
      );
    }

    // Sort newest to oldest
    return result.sort((a, b) => {
      const dateA = new Date(`${a.date} 2026`).getTime();
      const dateB = new Date(`${b.date} 2026`).getTime();
      return dateB - dateA;
    });
  }, [transactions, searchTerm, hideTransfers]);

  const spendingByAccount = useMemo(() => {
    const spending: Record<string, number> = {};
    let total = 0;
    
    filteredTransactions.forEach(tx => {
      if (tx.amount < 0 && !tx.description.toLowerCase().includes('internal transfer')) {
        const acc = tx.account || 'Uncategorized';
        // Clean up account names like "AK Groceries" to "Groceries" for cleaner UI
        const cleanAcc = acc.replace(/^AK\s+/i, '');
        const amount = Math.abs(tx.amount);
        spending[cleanAcc] = (spending[cleanAcc] || 0) + amount;
        total += amount;
      }
    });

    const allCategories = Object.entries(spending)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    const topCategories = Object.entries(spending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4); // Get top 4 spending categories

    return { topCategories, allCategories, total };
  }, [filteredTransactions]);

  // One-time cleanup for any legacy tags that accidentally have '#' in them
  React.useEffect(() => {
    let needsUpdate = false;
    const cleanedTxs = transactions.map(tx => {
      if (!tx.tags) return tx;
      
      let modified = false;
      const cleanTags = tx.tags.map((t: string) => {
        const cleaned = t.replace(/^#+/, '');
        if (cleaned !== t) modified = true;
        return cleaned;
      });

      const uniqueCleanTags = Array.from(new Set(cleanTags));
      if (uniqueCleanTags.length !== tx.tags.length) modified = true;
      
      if (modified) {
        needsUpdate = true;
        return { ...tx, tags: uniqueCleanTags };
      }
      return tx;
    });

    if (needsUpdate) {
      updateTransactions(cleanedTxs);
    }
  }, [transactions, updateTransactions]);

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
  const [notingTxId, setNotingTxId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const tagFrequencies = useMemo(() => {
    const freqs: Record<string, number> = {};
    transactions.forEach(tx => {
      (tx.tags || []).forEach((tag: string) => {
        freqs[tag] = (freqs[tag] || 0) + 1;
      });
    });
    return freqs;
  }, [transactions]);

  const tagSuggestions = useMemo(() => {
    if (!tagInput) return [];
    const lowerInput = tagInput.toLowerCase();
    const suggestions = Object.entries(tagFrequencies)
      .filter(([tag]) => tag.includes(lowerInput))
      .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
      .map(([tag]) => tag);
    return suggestions.slice(0, 5); // Max 5 suggestions
  }, [tagInput, tagFrequencies]);

  const handleAddTag = (txId: string, currentTags: string[], explicitTag?: string) => {
    let tagToAdd = (explicitTag || tagInput).trim().toLowerCase();
    
    // Strip leading hash symbols (if the user typed #family instead of just family)
    tagToAdd = tagToAdd.replace(/^#+/, '');

    if (tagToAdd) {
      if (!currentTags.includes(tagToAdd)) {
        updateTx(txId, { tags: [...currentTags, tagToAdd] });
      }
    }
    setTaggingTxId(null);
    setTagInput('');
  };

  const handleSaveNote = (txId: string) => {
    const noteText = noteInput.trim();
    
    // Extract hashtags from note
    const hashtagRegex = /#([\w-]+)/g;
    const extractedTags: string[] = [];
    let match;
    while ((match = hashtagRegex.exec(noteText)) !== null) {
      extractedTags.push(match[1].toLowerCase());
    }

    const tx = transactions.find(t => t.id === txId);
    let newTags = [...(tx?.tags || [])];
    extractedTags.forEach(tag => {
      if (!newTags.includes(tag)) newTags.push(tag);
    });

    updateTx(txId, { note: noteText, tags: newTags });
    setNotingTxId(null);
    setNoteInput('');
  };

  const removeTag = (txId: string, currentTags: string[], tagToRemove: string) => {
    updateTx(txId, { tags: currentTags.filter(t => t !== tagToRemove) });
  };

  // Check if user is currently typing a hashtag in the note input
  const noteTagMatch = noteInput.match(/#([\w-]*)$/);
  const isTypingNoteTag = noteTagMatch !== null;
  const noteTagSearch = isTypingNoteTag ? noteTagMatch[1].toLowerCase() : '';

  const noteTagSuggestions = useMemo(() => {
    if (!isTypingNoteTag) return [];
    const suggestions = Object.entries(tagFrequencies)
      .filter(([tag]) => tag.includes(noteTagSearch))
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
    return suggestions.slice(0, 5);
  }, [isTypingNoteTag, noteTagSearch, tagFrequencies]);

  const handleSelectNoteTag = (suggestion: string) => {
    // Replace the currently typed partial hashtag with the full suggestion
    const updatedNote = noteInput.replace(/#([\w-]*)$/, `#${suggestion} `);
    setNoteInput(updatedNote);
  };



  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Visual Dashboard Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Total & Top 4 */}
        <div className="col-span-1 md:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Monthly Spending</h2>
              <div className="text-3xl font-light text-gray-800 mt-1">${spendingByAccount.total.toFixed(2)}</div>
            </div>
            <div className="text-sm text-gray-400">Top Categories</div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 flex-1">
            {spendingByAccount.topCategories.map(([account, amount]) => {
              const percentage = spendingByAccount.total > 0 ? (amount / spendingByAccount.total) * 100 : 0;
              return (
                <div key={account} className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex flex-col justify-center">
                  <div className="text-sm font-medium text-gray-700 truncate" title={account}>{account}</div>
                  <div className="text-lg font-semibold text-red-500 mt-1">${amount.toFixed(2)}</div>
                  <div className="w-full bg-gray-200 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div className="bg-red-400 h-full rounded-full" style={{ width: `${Math.min(percentage, 100)}%` }} />
                  </div>
                </div>
              );
            })}
            {spendingByAccount.topCategories.length === 0 && (
              <div className="col-span-full flex items-center justify-center text-sm text-gray-400 h-full">
                No spending data available yet. Import your transactions!
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Donut Chart */}
        <div className="col-span-1 bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[250px]">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider w-full mb-4 text-center">Spending Breakdown</h2>
          {spendingByAccount.allCategories.length > 0 ? (
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={spendingByAccount.allCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {spendingByAccount.allCategories.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => `$${Number(value).toFixed(2)}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-sm text-gray-400 text-center">No data for chart</div>
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
              placeholder="Search activities, tags, accounts, notes..." 
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
          {filteredTransactions.map((tx: any) => (
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
                  {(tx.tags || []).map((tag: string) => (
                    <span 
                      key={tag} 
                      onClick={() => setSearchTerm(tag)}
                      className="cursor-pointer hover:bg-teal-100 text-xs bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-md flex items-center gap-1 group/tag transition-colors"
                    >
                      #{tag}
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeTag(tx.id, tx.tags || [], tag); }} 
                        className="opacity-100 md:opacity-0 md:group-hover/tag:opacity-100 hover:text-red-500 transition-opacity ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                
                {tx.note && notingTxId !== tx.id && (
                  <div className="text-sm text-gray-500 mt-1 mb-2 italic">
                    {tx.note}
                  </div>
                )}
                
                <div className={`mt-2 flex flex-wrap items-center gap-3 transition-opacity ${(taggingTxId === tx.id || notingTxId === tx.id || tx.note || (tx.tags && tx.tags.length > 0)) ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                  {taggingTxId === tx.id ? (
                    <div className="relative flex items-center gap-2">
                      <input 
                        autoFocus
                        type="text" 
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddTag(tx.id, tx.tags || []); if (e.key === 'Escape') setTaggingTxId(null); }}
                        onBlur={() => {
                          // Slight delay to allow suggestion click to register before blur unmounts it
                          setTimeout(() => handleAddTag(tx.id, tx.tags || []), 150);
                        }}
                        placeholder="Type tag (e.g. personal)"
                        className="text-xs px-2 py-1 border border-teal-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 w-32"
                      />
                      {tagSuggestions.length > 0 && (
                        <div className="absolute top-full mt-1 left-0 w-full bg-white border border-teal-200 rounded-md shadow-lg z-10 overflow-hidden">
                          {tagSuggestions.map(suggestion => (
                            <button
                              key={suggestion}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleAddTag(tx.id, tx.tags || [], suggestion);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-teal-50 text-gray-700"
                            >
                              #{suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button 
                      onClick={() => setTaggingTxId(tx.id)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-500 transition-colors"
                    >
                      <Tag size={14} /> Add Tag
                    </button>
                  )}

                  {notingTxId === tx.id ? (
                     <div className="relative flex items-center gap-2 flex-1 max-w-sm">
                       <input 
                         autoFocus
                         type="text" 
                         value={noteInput}
                         onChange={e => setNoteInput(e.target.value)}
                         onKeyDown={e => { if (e.key === 'Enter') handleSaveNote(tx.id); if (e.key === 'Escape') setNotingTxId(null); }}
                         onBlur={() => {
                           setTimeout(() => handleSaveNote(tx.id), 150);
                         }}
                         placeholder="Add a memo or note... type # to tag"
                         className="text-xs px-2 py-1 border border-teal-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 w-full"
                       />
                       {noteTagSuggestions.length > 0 && (
                        <div className="absolute top-full mt-1 left-0 min-w-[120px] bg-white border border-teal-200 rounded-md shadow-lg z-10 overflow-hidden">
                          {noteTagSuggestions.map(suggestion => (
                            <button
                              key={suggestion}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectNoteTag(suggestion);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-teal-50 text-gray-700"
                            >
                              #{suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                     </div>
                  ) : (
                    <button 
                      onClick={() => { setNotingTxId(tx.id); setNoteInput(tx.note || ''); }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-500 transition-colors"
                    >
                      <MessageSquare size={14} /> {tx.note ? 'Edit Note' : 'Add Note'}
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
