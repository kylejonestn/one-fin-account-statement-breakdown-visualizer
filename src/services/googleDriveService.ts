const FILE_NAME = 'finance-data.json';
const BOUNDARY = '-------314159265358979323846';

export interface AppData {
  transactions: any[];
  settings: {
    geminiApiKey?: string;
  };
}

const DEFAULT_DATA: AppData = {
  transactions: [],
  settings: {},
};

export class GoogleDriveService {
  private accessToken: string | null = null;

  setToken(token: string) {
    this.accessToken = token;
  }

  hasToken(): boolean {
    return !!this.accessToken;
  }

  private async request(url: string, options: RequestInit = {}) {
    if (!this.accessToken) throw new Error("No access token set");
    
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.accessToken}`);
    
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Drive API error: ${response.status} ${errorText}`);
    }
    return response;
  }

  // Find the file ID of our data file
  async findDataFile(): Promise<string | null> {
    const url = `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and trashed=false&spaces=drive&fields=files(id, name)`;
    const response = await this.request(url);
    const data = await response.json();
    
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  }

  // Create the data file initially
  private async createDataFile(initialData: AppData): Promise<string> {
    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    
    const metadata = {
      name: FILE_NAME,
      mimeType: 'application/json'
    };

    const requestBody = 
      `\r\n--${BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${BOUNDARY}\r\nContent-Type: application/json\r\n\r\n` +
      JSON.stringify(initialData) +
      `\r\n--${BOUNDARY}--`;

    const response = await this.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${BOUNDARY}`,
      },
      body: requestBody
    });

    const data = await response.json();
    return data.id;
  }

  // Load data from the file
  async loadData(): Promise<AppData> {
    let fileId = await this.findDataFile();
    
    if (!fileId) {
      // File doesn't exist, create it with default data
      console.log('Data file not found, creating new one...');
      await this.createDataFile(DEFAULT_DATA);
      return DEFAULT_DATA;
    }

    // File exists, download its contents
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await this.request(url);
    const data = await response.json();
    
    // Merge with defaults in case of missing fields
    return { ...DEFAULT_DATA, ...data };
  }

  // Save data to the file
  async saveData(appData: AppData): Promise<void> {
    let fileId = await this.findDataFile();
    
    if (!fileId) {
       fileId = await this.createDataFile(appData);
       return;
    }

    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    await this.request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(appData)
    });
  }
}

export const driveService = new GoogleDriveService();
