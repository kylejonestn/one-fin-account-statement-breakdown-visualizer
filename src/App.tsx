import { useState, useEffect } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { driveService } from './services/googleDriveService';
import type { AppData } from './services/googleDriveService';
import { AppProvider } from './context/AppContext';
import { Dashboard } from './components/Dashboard';
import { SettingsModal } from './components/SettingsModal';
import { Settings } from 'lucide-react';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [initialData, setInitialData] = useState<AppData | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const appData = await driveService.loadData();
      setInitialData(appData);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Error loading data:', err);
      alert('Failed to load data from Google Drive. Your session may have expired.');
      handleLogout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('google_access_token');
    const expiresAt = localStorage.getItem('google_token_expires_at');
    
    if (storedToken && expiresAt && Date.now() < parseInt(expiresAt, 10)) {
      driveService.setToken(storedToken);
      loadData();
    }
  }, []);

  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive.file',
    onSuccess: async (tokenResponse) => {
      // Token usually expires in 3600 seconds (1 hour)
      const expiresIn = tokenResponse.expires_in || 3600;
      const expiresAt = Date.now() + (expiresIn * 1000);
      
      localStorage.setItem('google_access_token', tokenResponse.access_token);
      localStorage.setItem('google_token_expires_at', expiresAt.toString());
      
      driveService.setToken(tokenResponse.access_token);
      loadData();
    },
    onError: (error) => console.log('Login Failed:', error)
  });

  const handleLogout = () => {
    googleLogout();
    driveService.setToken('');
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expires_at');
    setIsAuthenticated(false);
    setInitialData(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-sm w-full">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Finance Tracker</h1>
          <p className="text-gray-600 mb-8">Sign in with Google to sync your financial data securely to your own Google Drive.</p>
          <button 
            onClick={() => login()}
            className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded hover:bg-blue-700 transition"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !initialData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading your data...</p>
      </div>
    );
  }

  return (
    <AppProvider initialData={initialData}>
      <div className="min-h-screen bg-[#f4f7f6] flex flex-col font-sans relative">
        <nav className="bg-white px-8 flex justify-between items-center z-10 border-b-4 border-blue-500 h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center">
              <div className="w-4 h-4 border border-blue-400 rounded-full" />
            </div>
            <h1 className="text-xl font-bold text-blue-500 tracking-wide">OneFin</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <button className="text-sm font-semibold text-gray-500 hover:text-gray-800 uppercase tracking-wider">Activity</button>
            <button className="text-sm font-semibold text-gray-400 hover:text-gray-800 uppercase tracking-wider">Tags</button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="text-gray-400 hover:text-teal-500 transition-colors"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={handleLogout}
              className="ml-4 text-sm text-gray-400 hover:text-gray-600 font-medium"
            >
              Sign out
            </button>
          </div>
        </nav>
        
        <main className="p-8 flex-1 w-full mx-auto">
          <Dashboard />
        </main>

        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    </AppProvider>
  );
}

export default App;
