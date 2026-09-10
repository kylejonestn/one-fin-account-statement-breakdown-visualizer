import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { X, Key, Save } from 'lucide-react';

export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { data, updateSettings } = useAppContext();
  const [apiKey, setApiKey] = useState(data?.settings?.geminiApiKey || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await updateSettings({ geminiApiKey: apiKey.trim() });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Key size={16} className="text-teal-500" />
              Gemini API Key
            </label>
            <p className="text-xs text-gray-500 mb-3">
              We use Gemini 1.5 to provide AI insights into your spending habits. Your key is stored securely in your own Google Drive file and never sent to our servers.
            </p>
            <input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : <> <Save size={16} /> Save Settings </>}
          </button>
        </div>
      </div>
    </div>
  );
};
