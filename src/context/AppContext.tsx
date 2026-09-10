import React, { createContext, useContext, useState, ReactNode } from 'react';
import { driveService } from '../services/googleDriveService';
import type { AppData } from '../services/googleDriveService';
import type { ParsedTransaction } from '../services/pdfParserService';

interface AppContextType {
  data: AppData | null;
  updateTransactions: (transactions: ParsedTransaction[]) => Promise<void>;
  updateSettings: (settings: any) => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode; initialData: AppData }> = ({ children, initialData }) => {
  const [data, setData] = useState<AppData>(initialData);
  const [isLoading, setIsLoading] = useState(false);

  const updateTransactions = async (newTransactions: ParsedTransaction[]) => {
    setIsLoading(true);
    try {
      const updatedData = { ...data, transactions: newTransactions };
      await driveService.saveData(updatedData);
      setData(updatedData);
    } catch (err) {
      console.error('Failed to save transactions', err);
      alert('Failed to save data to Google Drive');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: any) => {
    setIsLoading(true);
    try {
      const updatedData = { ...data, settings: { ...data.settings, ...newSettings } };
      await driveService.saveData(updatedData);
      setData(updatedData);
    } catch (err) {
      console.error('Failed to save settings', err);
      alert('Failed to save settings to Google Drive');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppContext.Provider value={{ data, updateTransactions, updateSettings, isLoading }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
